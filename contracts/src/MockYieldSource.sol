// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {IERC20Metadata} from "@openzeppelin/contracts/token/ERC20/extensions/IERC20Metadata.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {IYieldSource} from "./IYieldSource.sol";
import {IPriceOracle} from "./IPriceOracle.sol";
import {MockERC20} from "./MockERC20.sol";

/// @title MockYieldSource
/// @notice Holds collateral principal and accrues yield in USDG at a configurable
///         per-second rate on the USD value of the principal.
/// @dev LOCAL / TEST ONLY. Yield here is *minted* USDG (MockERC20). In production
///      the yield source is the Mosaic vault or a lending pool that pays yield in the
///      collateral asset; that adapter swaps the yield to USDG on harvest. The
///      accounting shape (principal in asset, yield in USDG) is identical.
///
///      Accrual: yield += principalValueUsd * ratePerSecond1e18 * dt / 1e18, where
///      principalValueUsd is computed from the oracle price at accrual time and scaled
///      to USDG's 6 decimals. Rate is per second, 1e18 = 100%/sec. ~8% APY ≈ 2.54e9.
contract MockYieldSource is IYieldSource, Ownable {
    using SafeERC20 for IERC20;

    struct Acct {
        uint256 principal; // in asset units
        uint256 accrued; // USDG (6 dec)
        uint256 lastAccrual;
    }

    MockERC20 public immutable usdg;
    IPriceOracle public oracle;
    /// @notice yield per second, 1e18 scale (fraction of principal value per second)
    uint256 public ratePerSecond;

    mapping(address => mapping(address => Acct)) private _accts; // asset => account => Acct

    event Deposited(address indexed asset, address indexed account, uint256 amount);
    event Withdrawn(address indexed asset, address indexed account, uint256 amount);
    event Harvested(address indexed asset, address indexed account, uint256 usdg);
    event RateSet(uint256 ratePerSecond);

    error InsufficientPrincipal();

    constructor(address owner_, MockERC20 usdg_, IPriceOracle oracle_, uint256 ratePerSecond_) Ownable(owner_) {
        usdg = usdg_;
        oracle = oracle_;
        ratePerSecond = ratePerSecond_;
    }

    function setRate(uint256 ratePerSecond_) external onlyOwner {
        ratePerSecond = ratePerSecond_;
        emit RateSet(ratePerSecond_);
    }

    function setOracle(IPriceOracle oracle_) external onlyOwner {
        oracle = oracle_;
    }

    // ---------------------------------------------------------------- accrual

    function _valueUsdg(address asset, uint256 principal) internal view returns (uint256) {
        if (principal == 0) return 0;
        (uint256 price,) = oracle.getPrice(asset); // staleness irrelevant for yield accrual
        uint8 dec = IERC20Metadata(asset).decimals();
        // principal * price / 1e18 -> USD 1e(dec); rescale to 6 dec
        uint256 usd18 = principal * price / (10 ** dec); // USD in 1e18
        return usd18 / 1e12;
    }

    function _accrue(address asset, address account) internal {
        Acct storage a = _accts[asset][account];
        if (a.lastAccrual == 0) {
            a.lastAccrual = block.timestamp;
            return;
        }
        uint256 dt = block.timestamp - a.lastAccrual;
        if (dt > 0 && a.principal > 0 && ratePerSecond > 0) {
            a.accrued += _valueUsdg(asset, a.principal) * ratePerSecond * dt / 1e18;
        }
        a.lastAccrual = block.timestamp;
    }

    function _pending(address asset, address account) internal view returns (uint256) {
        Acct storage a = _accts[asset][account];
        uint256 p = a.accrued;
        if (a.lastAccrual != 0 && a.principal > 0 && ratePerSecond > 0) {
            uint256 dt = block.timestamp - a.lastAccrual;
            p += _valueUsdg(asset, a.principal) * ratePerSecond * dt / 1e18;
        }
        return p;
    }

    // ---------------------------------------------------------------- IYieldSource

    function deposit(address asset, uint256 amount) external override {
        _accrue(asset, msg.sender);
        IERC20(asset).safeTransferFrom(msg.sender, address(this), amount);
        _accts[asset][msg.sender].principal += amount;
        emit Deposited(asset, msg.sender, amount);
    }

    function withdraw(address asset, uint256 amount) external override {
        _accrue(asset, msg.sender);
        Acct storage a = _accts[asset][msg.sender];
        if (a.principal < amount) revert InsufficientPrincipal();
        a.principal -= amount;
        IERC20(asset).safeTransfer(msg.sender, amount);
        emit Withdrawn(asset, msg.sender, amount);
    }

    function balanceOf(address asset, address account) external view override returns (uint256) {
        return _accts[asset][account].principal;
    }

    function pendingYield(address asset, address account) external view override returns (uint256) {
        return _pending(asset, account);
    }

    function harvest(address asset) external override returns (uint256 amount) {
        _accrue(asset, msg.sender);
        Acct storage a = _accts[asset][msg.sender];
        amount = a.accrued;
        a.accrued = 0;
        if (amount > 0) usdg.mint(msg.sender, amount); // mock: yield is minted
        emit Harvested(asset, msg.sender, amount);
    }

    function yieldRatePerSecond(address asset, address account) external view override returns (uint256) {
        return _valueUsdg(asset, _accts[asset][account].principal) * ratePerSecond / 1e18;
    }
}
