// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Ownable2Step, Ownable} from "@openzeppelin/contracts/access/Ownable2Step.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {IERC20Metadata} from "@openzeppelin/contracts/token/ERC20/extensions/IERC20Metadata.sol";
import {IERC4626} from "@openzeppelin/contracts/interfaces/IERC4626.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {IYieldSource} from "./IYieldSource.sol";
import {IPriceOracle} from "./IPriceOracle.sol";
import {ISwapRouter} from "./ISwapRouter.sol";

/// @title ERC4626YieldSource
/// @notice The production yield source: collateral is deposited into an ERC-4626
///         vault (a Mosaic vault, a lending-pool wrapper — anything that speaks the
///         standard), and the share appreciation above the deposited principal is
///         the yield.
/// @dev The shape PillarCore expects is "principal in the collateral asset, yield in
///      USDG". A real vault pays yield in the collateral asset instead, so this
///      adapter does the conversion: on `harvest` it redeems exactly the surplus,
///      swaps it to USDG through a router, and hands the USDG to the caller.
///
///      Principal is tracked explicitly rather than inferred from shares, because
///      shares are the thing that appreciates. `surplus = convertToAssets(shares) -
///      principal` is the entire yield definition, and it is honest in both
///      directions: if the vault loses value the surplus is zero and nothing is
///      harvested, rather than the adapter inventing a number.
///
///      Accounting is per (asset, account). PillarCore is the only account in
///      practice; it tracks per-user shares itself.
contract ERC4626YieldSource is IYieldSource, Ownable2Step, ReentrancyGuard {
    using SafeERC20 for IERC20;

    struct Position {
        /// @dev Collateral-asset units deposited and not yet withdrawn.
        uint256 principal;
        /// @dev Vault shares held on this account's behalf.
        uint256 shares;
        /// @dev Cumulative USDG delivered by `harvest`, used for the realised rate.
        uint256 harvestedUsdg;
        /// @dev Timestamp of the first deposit; the denominator of the realised rate.
        uint64 since;
    }

    /// @notice USDG — the token every harvest is settled in.
    IERC20 public immutable usdg;
    uint8 private immutable _usdgDecimals;

    /// @notice Vault backing each collateral asset. Unset means the asset is unsupported.
    mapping(address => IERC4626) public vaultOf;
    mapping(address => mapping(address => Position)) private _positions; // asset => account => Position

    /// @notice Price feed used to quote a swap's minimum acceptable output.
    IPriceOracle public oracle;
    /// @notice Venue that fills the yield -> USDG swap.
    ISwapRouter public router;
    /// @notice Slippage tolerance applied to the oracle quote when harvesting, in bps.
    uint16 public maxSlippageBps;

    uint16 public constant MAX_SLIPPAGE_CEILING_BPS = 1_000; // 10%
    uint256 private constant BPS = 10_000;

    event VaultSet(address indexed asset, address indexed vault);
    event VaultRemoved(address indexed asset);
    event OracleSet(address indexed oracle);
    event RouterSet(address indexed router);
    event MaxSlippageSet(uint16 bps);
    event Deposited(address indexed asset, address indexed account, uint256 amount, uint256 shares);
    event Withdrawn(address indexed asset, address indexed account, uint256 amount, uint256 shares);
    event Harvested(address indexed asset, address indexed account, uint256 surplusAssets, uint256 usdg);

    error ZeroAddress();
    error UnsupportedAsset(address asset);
    error InsufficientPrincipal();
    error SlippageTooHigh(uint16 bps);
    error VaultStillFunded(address asset);
    error NoRouter();
    error SwapReturnedLess(uint256 got, uint256 minOut);

    constructor(address owner_, IERC20 usdg_, IPriceOracle oracle_, ISwapRouter router_, uint16 maxSlippageBps_)
        Ownable(owner_)
    {
        if (address(usdg_) == address(0) || address(oracle_) == address(0)) revert ZeroAddress();
        if (maxSlippageBps_ > MAX_SLIPPAGE_CEILING_BPS) revert SlippageTooHigh(maxSlippageBps_);
        usdg = usdg_;
        _usdgDecimals = IERC20Metadata(address(usdg_)).decimals();
        oracle = oracle_;
        router = router_; // may be zero if every listed asset settles in USDG already
        maxSlippageBps = maxSlippageBps_;
    }

    // ---------------------------------------------------------------- admin

    /// @notice Point `asset` at the ERC-4626 vault that will hold it.
    /// @dev Rejects a vault whose underlying is not `asset`: a mismatch would send
    ///      collateral into a vault it can never be redeemed from.
    function setVault(address asset, IERC4626 vault) external onlyOwner {
        if (asset == address(0) || address(vault) == address(0)) revert ZeroAddress();
        if (vault.asset() != asset) revert UnsupportedAsset(asset);
        // Re-pointing an asset would strand the shares held in the old vault.
        IERC4626 current = vaultOf[asset];
        if (address(current) != address(0) && current.balanceOf(address(this)) != 0) {
            revert VaultStillFunded(asset);
        }
        vaultOf[asset] = vault;
        IERC20(asset).forceApprove(address(vault), type(uint256).max);
        emit VaultSet(asset, address(vault));
    }

    /// @notice Stop accepting `asset`. Only possible once every share is redeemed.
    function removeVault(address asset) external onlyOwner {
        IERC4626 vault = vaultOf[asset];
        if (address(vault) == address(0)) revert UnsupportedAsset(asset);
        if (vault.balanceOf(address(this)) != 0) revert VaultStillFunded(asset);
        IERC20(asset).forceApprove(address(vault), 0);
        delete vaultOf[asset];
        emit VaultRemoved(asset);
    }

    function setOracle(IPriceOracle oracle_) external onlyOwner {
        if (address(oracle_) == address(0)) revert ZeroAddress();
        oracle = oracle_;
        emit OracleSet(address(oracle_));
    }

    function setRouter(ISwapRouter router_) external onlyOwner {
        router = router_;
        emit RouterSet(address(router_));
    }

    function setMaxSlippageBps(uint16 bps) external onlyOwner {
        if (bps > MAX_SLIPPAGE_CEILING_BPS) revert SlippageTooHigh(bps);
        maxSlippageBps = bps;
        emit MaxSlippageSet(bps);
    }

    // ---------------------------------------------------------------- IYieldSource

    /// @inheritdoc IYieldSource
    function deposit(address asset, uint256 amount) external override nonReentrant {
        IERC4626 vault = _vault(asset);
        IERC20(asset).safeTransferFrom(msg.sender, address(this), amount);
        uint256 shares = vault.deposit(amount, address(this));

        Position storage p = _positions[asset][msg.sender];
        if (p.since == 0) p.since = uint64(block.timestamp);
        p.principal += amount;
        p.shares += shares;
        emit Deposited(asset, msg.sender, amount, shares);
    }

    /// @inheritdoc IYieldSource
    /// @dev Withdraws principal only. Any surplus stays in the vault as shares and
    ///      is still harvestable afterwards, so withdrawing never silently forfeits
    ///      accrued yield.
    function withdraw(address asset, uint256 amount) external override nonReentrant {
        IERC4626 vault = _vault(asset);
        Position storage p = _positions[asset][msg.sender];
        if (p.principal < amount) revert InsufficientPrincipal();

        uint256 burned = vault.withdraw(amount, msg.sender, address(this));
        p.principal -= amount;
        // A vault that lost value can burn more shares than the position holds; the
        // vault itself reverts in that case, so this subtraction cannot underflow.
        p.shares -= burned;
        emit Withdrawn(asset, msg.sender, amount, burned);
    }

    /// @inheritdoc IYieldSource
    function balanceOf(address asset, address account) external view override returns (uint256) {
        return _positions[asset][account].principal;
    }

    /// @inheritdoc IYieldSource
    /// @dev An oracle-priced estimate of what the surplus would fetch. The amount
    ///      actually delivered by `harvest` is whatever the router fills, which is
    ///      why this is only ever used for display and never for accounting.
    function pendingYield(address asset, address account) external view override returns (uint256) {
        return _quoteUsdg(asset, _surplusAssets(asset, account));
    }

    /// @notice Surplus in collateral-asset units: the yield before it is swapped.
    function pendingYieldAssets(address asset, address account) external view returns (uint256) {
        return _surplusAssets(asset, account);
    }

    /// @inheritdoc IYieldSource
    /// @dev Realised, not projected. It is total value earned since the first
    ///      deposit divided by the time elapsed, which means a brand-new position
    ///      reports a rate close to zero until the vault has actually produced
    ///      something. A projection would look better and mean less.
    function yieldRatePerSecond(address asset, address account) external view override returns (uint256) {
        Position memory p = _positions[asset][account];
        if (p.since == 0) return 0;
        uint256 elapsed = block.timestamp - p.since;
        if (elapsed == 0) return 0;
        uint256 earned = p.harvestedUsdg + _quoteUsdg(asset, _surplusAssets(asset, account));
        return earned / elapsed;
    }

    /// @inheritdoc IYieldSource
    function harvest(address asset) external override nonReentrant returns (uint256 amountUsdg) {
        IERC4626 vault = _vault(asset);
        Position storage p = _positions[asset][msg.sender];

        uint256 surplus = _surplusAssets(asset, msg.sender);
        if (surplus == 0) return 0;

        uint256 burned = vault.withdraw(surplus, address(this), address(this));
        p.shares -= burned;

        if (asset == address(usdg)) {
            // The vault already pays in USDG; there is nothing to swap.
            amountUsdg = surplus;
            usdg.safeTransfer(msg.sender, amountUsdg);
        } else {
            amountUsdg = _swapToUsdg(asset, surplus, msg.sender);
        }

        p.harvestedUsdg += amountUsdg;
        emit Harvested(asset, msg.sender, surplus, amountUsdg);
    }

    // ---------------------------------------------------------------- internals

    function _vault(address asset) internal view returns (IERC4626 vault) {
        vault = vaultOf[asset];
        if (address(vault) == address(0)) revert UnsupportedAsset(asset);
    }

    function _surplusAssets(address asset, address account) internal view returns (uint256) {
        Position memory p = _positions[asset][account];
        if (p.shares == 0) return 0;
        IERC4626 vault = vaultOf[asset];
        if (address(vault) == address(0)) return 0;
        uint256 value = vault.convertToAssets(p.shares);
        return value > p.principal ? value - p.principal : 0;
    }

    /// @dev `amount` of `asset` valued in USDG at the oracle price. Staleness is
    ///      irrelevant here: this figure only ever bounds a swap or feeds the UI,
    ///      and PillarCore applies the staleness rule to the actions that matter.
    function _quoteUsdg(address asset, uint256 amount) internal view returns (uint256) {
        if (amount == 0) return 0;
        if (asset == address(usdg)) return amount;
        (uint256 price1e18,) = oracle.getPrice(asset);
        uint8 dec = IERC20Metadata(asset).decimals();
        // amount * price -> USD at 1e18, then rescale to USDG's decimals.
        uint256 usd1e18 = amount * price1e18 / (10 ** dec);
        return _usdgDecimals >= 18
            ? usd1e18 * (10 ** (_usdgDecimals - 18))
            : usd1e18 / (10 ** (18 - _usdgDecimals));
    }

    function _swapToUsdg(address asset, uint256 amountIn, address to) internal returns (uint256 amountOut) {
        ISwapRouter r = router;
        if (address(r) == address(0)) revert NoRouter();

        uint256 minOut = _quoteUsdg(asset, amountIn) * (BPS - maxSlippageBps) / BPS;
        IERC20(asset).forceApprove(address(r), amountIn);
        amountOut = r.swapExactInput(asset, address(usdg), amountIn, minOut, to);
        // Belt and braces: the router reports its own fill, so verify it against the
        // bound rather than trusting the return value.
        if (amountOut < minOut) revert SwapReturnedLess(amountOut, minOut);
        // A router that pulled less than it was allowed must not keep the allowance.
        IERC20(asset).forceApprove(address(r), 0);
    }
}
