// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Ownable2Step, Ownable} from "@openzeppelin/contracts/access/Ownable2Step.sol";
import {Pausable} from "@openzeppelin/contracts/utils/Pausable.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {IERC20Metadata} from "@openzeppelin/contracts/token/ERC20/extensions/IERC20Metadata.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {IPriceOracle} from "./IPriceOracle.sol";
import {IYieldSource} from "./IYieldSource.sol";

/// @title PillarCore
/// @notice Self-repaying credit against tokenized stocks.
///
/// Deposit a listed stock token as collateral -> borrow USDG up to the market's max
/// LTV -> collateral is routed to the market's yield source -> harvested yield is
/// applied to the debt. Pillar charges NO interest: debt never grows on its own, it
/// only shrinks (via yield or manual repay). If yield is zero the debt simply stops
/// shrinking. Protocol revenue is `protocolCutBps` of harvested yield.
///
/// Risk posture (stocks close, debt is live 24/7):
///  * LTVs are conservative and per-market.
///  * A stale oracle pauses NEW borrows, withdrawals and liquidations. Deposit,
///    repay and harvest never depend on price freshness.
///  * Liquidation is partial: a liquidator may repay at most the amount that
///    restores the position to health factor == 1. Over-liquidation reverts.
contract PillarCore is Ownable2Step, Pausable, ReentrancyGuard {
    using SafeERC20 for IERC20;

    // ------------------------------------------------------------------ types

    struct Market {
        bool listed;
        bool open; // new borrows allowed
        uint8 decimals; // asset decimals (cached)
        uint16 maxLtvBps; // max loan-to-value for borrow / withdraw
        uint16 liqThresholdBps; // LTV at which health factor == 1
        uint16 liqBonusBps; // liquidator bonus on seized collateral
        uint256 cap; // max total collateral (asset units), 0 = unlimited
        uint256 totalCollateral; // asset units held for users
        uint256 totalDebt; // USDG 6 dec
        uint256 yieldIndex; // cumulative USDG yield per 1e18 asset units, 1e18-scaled
        IYieldSource yieldSource;
    }

    struct Position {
        uint256 collateral; // asset units
        uint256 debt; // USDG (6 dec)
        uint256 yieldAccruedToDebt; // lifetime USDG applied to this position's debt via yield
        uint256 yieldIndexSnapshot; // market.yieldIndex at last settlement
    }

    // -------------------------------------------------------------- constants

    uint256 public constant BPS = 10_000;
    uint256 public constant WAD = 1e18;
    uint8 public constant USDG_DECIMALS = 6;

    // ---------------------------------------------------------------- storage

    IERC20 public immutable usdg;
    IPriceOracle public oracle;
    address public feeRecipient;
    uint256 public protocolCutBps = 1_000; // 10% of yield
    uint256 public maxStaleness = 1 hours;

    /// @notice USDG available for new borrows (funded by owner / LPs, replenished by repayments).
    uint256 public treasury;

    address[] public listedAssets;
    mapping(address => Market) public markets;
    mapping(address => mapping(address => Position)) internal _positions; // user => asset => Position
    /// @notice Yield harvested for a user who had no debt at the time, claimable in USDG.
    mapping(address => uint256) public usdgCredit;
    mapping(address => bool) public isKeeper;

    // ----------------------------------------------------------------- events

    event MarketListed(address indexed asset, uint16 maxLtvBps, uint16 liqThresholdBps, uint16 liqBonusBps, uint256 cap, address yieldSource);
    event MarketParamsSet(address indexed asset, uint16 maxLtvBps, uint16 liqThresholdBps, uint16 liqBonusBps, uint256 cap);
    event MarketOpenSet(address indexed asset, bool open);
    event OracleSet(address oracle);
    event FeeRecipientSet(address feeRecipient);
    event ProtocolCutSet(uint256 bps);
    event MaxStalenessSet(uint256 seconds_);
    event KeeperSet(address indexed keeper, bool enabled);
    event TreasuryFunded(address indexed from, uint256 amount);
    event TreasuryWithdrawn(address indexed to, uint256 amount);

    event CollateralDeposited(address indexed user, address indexed asset, uint256 amount);
    event CollateralWithdrawn(address indexed user, address indexed asset, uint256 amount);
    event Borrowed(address indexed user, address indexed asset, uint256 usdgAmount, uint256 newDebt);
    event Repaid(address indexed user, address indexed asset, address indexed payer, uint256 usdgAmount, uint256 remainingDebt);
    event YieldSynced(address indexed asset, uint256 usdgAmount, uint256 newIndex);
    event Harvested(address indexed user, address indexed asset, uint256 gross, uint256 protocolCut, uint256 toDebt, uint256 toCredit);
    event SelfRepaid(address indexed user, address indexed asset, uint256 amount, uint256 remainingDebt);
    event CreditClaimed(address indexed user, uint256 amount);
    event Liquidated(address indexed user, address indexed asset, address indexed liquidator, uint256 repaid, uint256 seized, uint256 remainingDebt);

    // ----------------------------------------------------------------- errors

    error MarketNotListed();
    error MarketAlreadyListed();
    error MarketClosed();
    error InvalidParams();
    error ZeroAmount();
    error ZeroAddress();
    error StalePrice(uint256 updatedAt);
    error ExceedsMaxLtv(uint256 ltvBps, uint256 maxLtvBps);
    error InsufficientCollateral();
    error InsufficientTreasury(uint256 available);
    error CapExceeded(uint256 cap);
    error Healthy(uint256 healthFactor);
    error OverLiquidation(uint256 maxRepay);
    error NotKeeperOrOwner();
    error NothingToClaim();

    // -------------------------------------------------------------- modifiers

    modifier onlyListed(address asset) {
        if (!markets[asset].listed) revert MarketNotListed();
        _;
    }

    modifier onlyKeeperOrOwner() {
        if (msg.sender != owner() && !isKeeper[msg.sender]) revert NotKeeperOrOwner();
        _;
    }

    // ------------------------------------------------------------ constructor

    constructor(address owner_, IERC20 usdg_, IPriceOracle oracle_, address feeRecipient_) Ownable(owner_) {
        if (address(usdg_) == address(0) || address(oracle_) == address(0) || feeRecipient_ == address(0)) revert ZeroAddress();
        usdg = usdg_;
        oracle = oracle_;
        feeRecipient = feeRecipient_;
    }

    // ------------------------------------------------------------------ admin

    function listMarket(
        address asset,
        uint16 maxLtvBps,
        uint16 liqThresholdBps,
        uint16 liqBonusBps,
        uint256 cap,
        IYieldSource yieldSource
    ) external onlyOwner {
        if (markets[asset].listed) revert MarketAlreadyListed();
        if (address(yieldSource) == address(0) || asset == address(0)) revert ZeroAddress();
        _validateParams(maxLtvBps, liqThresholdBps, liqBonusBps);
        Market storage m = markets[asset];
        m.listed = true;
        m.open = true;
        m.decimals = IERC20Metadata(asset).decimals();
        m.maxLtvBps = maxLtvBps;
        m.liqThresholdBps = liqThresholdBps;
        m.liqBonusBps = liqBonusBps;
        m.cap = cap;
        m.yieldSource = yieldSource;
        listedAssets.push(asset);
        IERC20(asset).forceApprove(address(yieldSource), type(uint256).max);
        emit MarketListed(asset, maxLtvBps, liqThresholdBps, liqBonusBps, cap, address(yieldSource));
    }

    function setMarketParams(address asset, uint16 maxLtvBps, uint16 liqThresholdBps, uint16 liqBonusBps, uint256 cap)
        external
        onlyOwner
        onlyListed(asset)
    {
        _validateParams(maxLtvBps, liqThresholdBps, liqBonusBps);
        Market storage m = markets[asset];
        m.maxLtvBps = maxLtvBps;
        m.liqThresholdBps = liqThresholdBps;
        m.liqBonusBps = liqBonusBps;
        m.cap = cap;
        emit MarketParamsSet(asset, maxLtvBps, liqThresholdBps, liqBonusBps, cap);
    }

    function openMarket(address asset) external onlyOwner onlyListed(asset) {
        markets[asset].open = true;
        emit MarketOpenSet(asset, true);
    }

    /// @dev Keepers may close a market as a circuit breaker; only the owner may reopen.
    function closeMarket(address asset) external onlyKeeperOrOwner onlyListed(asset) {
        markets[asset].open = false;
        emit MarketOpenSet(asset, false);
    }

    function setOracle(IPriceOracle oracle_) external onlyOwner {
        if (address(oracle_) == address(0)) revert ZeroAddress();
        oracle = oracle_;
        emit OracleSet(address(oracle_));
    }

    function setFeeRecipient(address r) external onlyOwner {
        if (r == address(0)) revert ZeroAddress();
        feeRecipient = r;
        emit FeeRecipientSet(r);
    }

    function setProtocolCut(uint256 bps) external onlyOwner {
        if (bps > 5_000) revert InvalidParams();
        protocolCutBps = bps;
        emit ProtocolCutSet(bps);
    }

    function setMaxStaleness(uint256 seconds_) external onlyOwner {
        if (seconds_ == 0) revert InvalidParams();
        maxStaleness = seconds_;
        emit MaxStalenessSet(seconds_);
    }

    function setKeeper(address keeper, bool enabled) external onlyOwner {
        isKeeper[keeper] = enabled;
        emit KeeperSet(keeper, enabled);
    }

    function pause() external onlyKeeperOrOwner {
        _pause();
    }

    function unpause() external onlyOwner {
        _unpause();
    }

    /// @notice Add USDG lending liquidity. Anyone may fund (owner / LPs).
    function fundTreasury(uint256 amount) external nonReentrant {
        if (amount == 0) revert ZeroAmount();
        usdg.safeTransferFrom(msg.sender, address(this), amount);
        treasury += amount;
        emit TreasuryFunded(msg.sender, amount);
    }

    function withdrawTreasury(address to, uint256 amount) external onlyOwner nonReentrant {
        if (amount > treasury) revert InsufficientTreasury(treasury);
        treasury -= amount;
        usdg.safeTransfer(to, amount);
        emit TreasuryWithdrawn(to, amount);
    }

    // ------------------------------------------------------------ user actions

    /// @notice Deposit collateral. Never depends on oracle freshness.
    function depositCollateral(address asset, uint256 amount) external nonReentrant whenNotPaused onlyListed(asset) {
        if (amount == 0) revert ZeroAmount();
        Market storage m = markets[asset];
        if (m.cap != 0 && m.totalCollateral + amount > m.cap) revert CapExceeded(m.cap);

        _settleYield(asset, msg.sender); // settle before changing the share

        IERC20(asset).safeTransferFrom(msg.sender, address(this), amount);
        m.yieldSource.deposit(asset, amount);

        _positions[msg.sender][asset].collateral += amount;
        m.totalCollateral += amount;
        emit CollateralDeposited(msg.sender, asset, amount);
    }

    /// @notice Withdraw collateral. Requires a fresh price unless the position has no debt.
    function withdrawCollateral(address asset, uint256 amount) external nonReentrant whenNotPaused onlyListed(asset) {
        if (amount == 0) revert ZeroAmount();
        _settleYield(asset, msg.sender);

        Position storage p = _positions[msg.sender][asset];
        Market storage m = markets[asset];
        if (p.collateral < amount) revert InsufficientCollateral();

        p.collateral -= amount;
        m.totalCollateral -= amount;

        if (p.debt > 0) {
            uint256 price = _freshPrice(asset);
            _requireLtvOk(m, p, price);
        }

        m.yieldSource.withdraw(asset, amount);
        IERC20(asset).safeTransfer(msg.sender, amount);
        emit CollateralWithdrawn(msg.sender, asset, amount);
    }

    /// @notice Borrow USDG against `asset` collateral. Requires an open market, a fresh
    ///         price, resulting LTV <= maxLtv and treasury liquidity.
    function borrow(address asset, uint256 usdgAmount) external nonReentrant whenNotPaused onlyListed(asset) {
        if (usdgAmount == 0) revert ZeroAmount();
        Market storage m = markets[asset];
        if (!m.open) revert MarketClosed();
        if (usdgAmount > treasury) revert InsufficientTreasury(treasury);

        _settleYield(asset, msg.sender);

        Position storage p = _positions[msg.sender][asset];
        p.debt += usdgAmount;
        m.totalDebt += usdgAmount;

        uint256 price = _freshPrice(asset);
        _requireLtvOk(m, p, price);

        treasury -= usdgAmount;
        usdg.safeTransfer(msg.sender, usdgAmount);
        emit Borrowed(msg.sender, asset, usdgAmount, p.debt);
    }

    /// @notice Repay USDG on your own position. Always allowed (even paused / stale).
    function repay(address asset, uint256 usdgAmount) external nonReentrant onlyListed(asset) {
        _repayFor(asset, msg.sender, usdgAmount);
    }

    /// @notice Repay USDG on someone else's position. Always allowed.
    function repayFor(address asset, address user, uint256 usdgAmount) external nonReentrant onlyListed(asset) {
        _repayFor(asset, user, usdgAmount);
    }

    function _repayFor(address asset, address user, uint256 usdgAmount) internal {
        if (usdgAmount == 0) revert ZeroAmount();
        _settleYield(asset, user);
        Position storage p = _positions[user][asset];
        Market storage m = markets[asset];
        uint256 amount = usdgAmount > p.debt ? p.debt : usdgAmount;
        if (amount == 0) revert ZeroAmount();
        usdg.safeTransferFrom(msg.sender, address(this), amount);
        p.debt -= amount;
        m.totalDebt -= amount;
        treasury += amount;
        emit Repaid(user, asset, msg.sender, amount, p.debt);
    }

    /// @notice Pull yield accrued on `user`'s collateral and apply it to their debt.
    ///         Callable by anyone (keepers). Never depends on oracle freshness.
    function harvest(address asset, address user) external nonReentrant onlyListed(asset) {
        _settleYield(asset, user);
    }

    /// @notice Harvest several positions in one call.
    function harvestMany(address[] calldata assets, address[] calldata users) external nonReentrant {
        if (assets.length != users.length) revert InvalidParams();
        for (uint256 i; i < assets.length; ++i) {
            if (!markets[assets[i]].listed) revert MarketNotListed();
            _settleYield(assets[i], users[i]);
        }
    }

    /// @notice Claim USDG yield that was harvested while you had no debt.
    function claimCredit() external nonReentrant {
        uint256 c = usdgCredit[msg.sender];
        if (c == 0) revert NothingToClaim();
        usdgCredit[msg.sender] = 0;
        usdg.safeTransfer(msg.sender, c);
        emit CreditClaimed(msg.sender, c);
    }

    /// @notice Partially liquidate an unhealthy position. `repayAmount` is capped at the
    ///         amount that restores health factor to exactly 1; larger amounts revert.
    function liquidate(address user, address asset, uint256 repayAmount)
        external
        nonReentrant
        whenNotPaused
        onlyListed(asset)
    {
        if (repayAmount == 0) revert ZeroAmount();
        _settleYield(asset, user); // pending yield may already restore health

        Market storage m = markets[asset];
        Position storage p = _positions[user][asset];
        uint256 price = _freshPrice(asset);

        uint256 hf = _healthFactor(m, p, price);
        if (hf >= WAD) revert Healthy(hf);

        uint256 maxRepay = _maxLiquidatable(m, p, price);
        if (repayAmount > maxRepay) revert OverLiquidation(maxRepay);

        // collateral worth repayAmount * (1 + bonus)
        uint256 seizeValue = repayAmount * (BPS + m.liqBonusBps) / BPS;
        uint256 seize = _usdgToAsset(m, seizeValue, price);
        if (seize > p.collateral) seize = p.collateral; // bad-debt edge: never seize more than exists

        usdg.safeTransferFrom(msg.sender, address(this), repayAmount);
        p.debt -= repayAmount;
        m.totalDebt -= repayAmount;
        treasury += repayAmount;

        p.collateral -= seize;
        m.totalCollateral -= seize;
        m.yieldSource.withdraw(asset, seize);
        IERC20(asset).safeTransfer(msg.sender, seize);

        emit Liquidated(user, asset, msg.sender, repayAmount, seize, p.debt);
    }

    // ------------------------------------------------------------------ views

    function getPosition(address user, address asset) external view returns (Position memory) {
        return _positions[user][asset];
    }

    function listedAssetsLength() external view returns (uint256) {
        return listedAssets.length;
    }

    function getListedAssets() external view returns (address[] memory) {
        return listedAssets;
    }

    /// @notice Value of `user`'s collateral in USDG (6 dec) at the last oracle price (fresh or not).
    function collateralValue(address user, address asset) external view onlyListed(asset) returns (uint256) {
        (uint256 price,) = oracle.getPrice(asset);
        return _assetToUsdg(markets[asset], _positions[user][asset].collateral, price);
    }

    /// @notice Current LTV in bps. 0 if no debt; type(uint256).max if debt and no collateral.
    function ltv(address user, address asset) external view onlyListed(asset) returns (uint256) {
        (uint256 price,) = oracle.getPrice(asset);
        return _ltv(markets[asset], _positions[user][asset], price);
    }

    /// @notice (collateralValue * liqThreshold) / debt, 1e18 scale. type(uint256).max if no debt.
    function healthFactor(address user, address asset) external view onlyListed(asset) returns (uint256) {
        (uint256 price,) = oracle.getPrice(asset);
        return _healthFactor(markets[asset], _positions[user][asset], price);
    }

    /// @notice Additional USDG the user could borrow now (LTV bound only; treasury checked at borrow).
    function maxBorrowable(address user, address asset) external view onlyListed(asset) returns (uint256) {
        (uint256 price,) = oracle.getPrice(asset);
        Market storage m = markets[asset];
        Position storage p = _positions[user][asset];
        uint256 cap = _assetToUsdg(m, p.collateral, price) * m.maxLtvBps / BPS;
        return cap > p.debt ? cap - p.debt : 0;
    }

    /// @notice Max USDG a liquidator may repay right now (0 if healthy).
    function maxLiquidatable(address user, address asset) external view onlyListed(asset) returns (uint256) {
        (uint256 price,) = oracle.getPrice(asset);
        Market storage m = markets[asset];
        Position storage p = _positions[user][asset];
        if (_healthFactor(m, p, price) >= WAD) return 0;
        return _maxLiquidatable(m, p, price);
    }

    /// @notice USDG yield the user could harvest right now (before protocol cut).
    function pendingYield(address user, address asset) external view onlyListed(asset) returns (uint256) {
        Market storage m = markets[asset];
        Position storage p = _positions[user][asset];
        if (m.totalCollateral == 0 || p.collateral == 0) return 0;
        uint256 unsynced = m.yieldSource.pendingYield(asset, address(this));
        uint256 idx = m.yieldIndex + unsynced * WAD / m.totalCollateral;
        return p.collateral * (idx - p.yieldIndexSnapshot) / WAD;
    }

    /// @notice Estimated USDG/second flowing to the user's debt after the protocol cut.
    function yieldRateToDebt(address user, address asset) external view onlyListed(asset) returns (uint256) {
        Market storage m = markets[asset];
        Position storage p = _positions[user][asset];
        if (m.totalCollateral == 0 || p.collateral == 0) return 0;
        uint256 marketRate = m.yieldSource.yieldRatePerSecond(asset, address(this));
        uint256 userRate = marketRate * p.collateral / m.totalCollateral;
        return userRate * (BPS - protocolCutBps) / BPS;
    }

    function isPriceFresh(address asset) external view returns (bool) {
        (, uint256 updatedAt) = oracle.getPrice(asset);
        return updatedAt != 0 && block.timestamp <= updatedAt + maxStaleness;
    }

    // -------------------------------------------------------------- internals

    function _validateParams(uint16 maxLtvBps, uint16 liqThresholdBps, uint16 liqBonusBps) internal pure {
        if (maxLtvBps == 0 || maxLtvBps >= liqThresholdBps || liqThresholdBps >= BPS) revert InvalidParams();
        // Partial liquidation must be able to restore health: LT * (1 + bonus) < 1.
        if (uint256(liqThresholdBps) * (BPS + liqBonusBps) >= BPS * BPS) revert InvalidParams();
    }

    function _freshPrice(address asset) internal view returns (uint256 price) {
        uint256 updatedAt;
        (price, updatedAt) = oracle.getPrice(asset);
        if (updatedAt == 0 || block.timestamp > updatedAt + maxStaleness) revert StalePrice(updatedAt);
    }

    /// @dev asset units -> USDG (6 dec) at `price` (USD/asset, 1e18).
    function _assetToUsdg(Market storage m, uint256 amount, uint256 price) internal view returns (uint256) {
        // amount * price / 1e18 = USD in 10^dec; rescale to 1e6.
        return amount * price * (10 ** USDG_DECIMALS) / (WAD * (10 ** m.decimals));
    }

    /// @dev USDG (6 dec) -> asset units at `price`, rounded down.
    function _usdgToAsset(Market storage m, uint256 usdgAmount, uint256 price) internal view returns (uint256) {
        return usdgAmount * WAD * (10 ** m.decimals) / (price * (10 ** USDG_DECIMALS));
    }

    function _ltv(Market storage m, Position storage p, uint256 price) internal view returns (uint256) {
        if (p.debt == 0) return 0;
        uint256 v = _assetToUsdg(m, p.collateral, price);
        if (v == 0) return type(uint256).max;
        return p.debt * BPS / v;
    }

    function _healthFactor(Market storage m, Position storage p, uint256 price) internal view returns (uint256) {
        if (p.debt == 0) return type(uint256).max;
        uint256 v = _assetToUsdg(m, p.collateral, price);
        return v * m.liqThresholdBps * WAD / (BPS * p.debt);
    }

    /// @dev Compares by cross-multiplication rather than through `_ltv`, which floors.
    ///      Flooring let a debt one unit above the limit report an LTV exactly equal to
    ///      it, so `borrow` accepted an amount `maxBorrowable` had said was unavailable.
    ///      The two now agree exactly, and the check is the stricter of the pair.
    function _requireLtvOk(Market storage m, Position storage p, uint256 price) internal view {
        if (p.debt == 0) return;
        uint256 v = _assetToUsdg(m, p.collateral, price);
        if (v == 0 || p.debt * BPS > v * m.maxLtvBps) {
            revert ExceedsMaxLtv(_ltv(m, p, price), m.maxLtvBps);
        }
    }

    /// @dev Smallest repay r that restores HF == 1:
    ///      (V - r(1+b)) * LT = (D - r)  =>  r = (D - V*LT) / (1 - LT*(1+b))
    ///      All in bps fractions. Result is rounded up so HF >= 1 after liquidation.
    function _maxLiquidatable(Market storage m, Position storage p, uint256 price) internal view returns (uint256) {
        uint256 v = _assetToUsdg(m, p.collateral, price);
        uint256 vLt = v * m.liqThresholdBps / BPS; // debt capacity at threshold
        if (p.debt <= vLt) return 0;
        uint256 numer = (p.debt - vLt) * BPS; // scaled by BPS
        uint256 denom = BPS - (uint256(m.liqThresholdBps) * (BPS + m.liqBonusBps) / BPS);
        uint256 r = (numer + denom - 1) / denom;
        return r > p.debt ? p.debt : r;
    }

    /// @dev Pull all accrued USDG from the market's yield source into the per-unit index.
    function _syncMarket(address asset, Market storage m) internal {
        if (m.totalCollateral == 0) {
            // Nothing to attribute; harvest anyway so dust doesn't leak into later depositors.
            uint256 dust = m.yieldSource.harvest(asset);
            if (dust > 0) treasury += dust;
            return;
        }
        uint256 got = m.yieldSource.harvest(asset);
        if (got == 0) return;
        m.yieldIndex += got * WAD / m.totalCollateral;
        emit YieldSynced(asset, got, m.yieldIndex);
    }

    /// @dev Settle `user`'s share of yield: protocol cut -> feeRecipient, rest -> debt
    ///      (or usdgCredit when there is no debt). Emits SelfRepaid when debt shrinks.
    function _settleYield(address asset, address user) internal {
        Market storage m = markets[asset];
        Position storage p = _positions[user][asset];
        _syncMarket(asset, m);

        uint256 owed = p.collateral * (m.yieldIndex - p.yieldIndexSnapshot) / WAD;
        p.yieldIndexSnapshot = m.yieldIndex;
        if (owed == 0) return;

        uint256 cut = owed * protocolCutBps / BPS;
        uint256 net = owed - cut;
        if (cut > 0) usdg.safeTransfer(feeRecipient, cut);

        uint256 toDebt;
        uint256 toCredit;
        if (p.debt > 0) {
            toDebt = net > p.debt ? p.debt : net;
            p.debt -= toDebt;
            m.totalDebt -= toDebt;
            p.yieldAccruedToDebt += toDebt;
            treasury += toDebt; // repaid principal returns to lending liquidity
            emit SelfRepaid(user, asset, toDebt, p.debt);
        }
        toCredit = net - toDebt;
        if (toCredit > 0) usdgCredit[user] += toCredit;

        emit Harvested(user, asset, owed, cut, toDebt, toCredit);
    }
}
