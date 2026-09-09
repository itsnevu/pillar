// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @title IYieldSource
/// @notice Where collateral goes to work while it backs a loan.
/// @dev Accounting is per (asset, account). PillarCore is the only `account` in
///      practice; it tracks user shares itself.
///
///      Principal is denominated in `asset`. Yield is denominated in USDG and is
///      settled by `harvest`, which transfers accrued USDG to the caller.
///
///      PRODUCTION NOTE: the real implementation is the Mosaic vault (or a lending
///      pool) that pays yield in the collateral asset itself. That adapter swaps the
///      yield leg to USDG on harvest and returns the USDG amount. The interface is
///      deliberately the same so PillarCore does not care which one is plugged in.
interface IYieldSource {
    /// @notice Pull `amount` of `asset` from msg.sender (requires prior approval).
    function deposit(address asset, uint256 amount) external;

    /// @notice Return `amount` of `asset` principal to msg.sender.
    function withdraw(address asset, uint256 amount) external;

    /// @notice Principal of `asset` held for `account`.
    function balanceOf(address asset, address account) external view returns (uint256);

    /// @notice USDG yield accrued for `account` on `asset`, not yet harvested.
    function pendingYield(address asset, address account) external view returns (uint256 usdg);

    /// @notice Settle pending yield: transfers USDG to msg.sender, returns the amount.
    function harvest(address asset) external returns (uint256 usdg);

    /// @notice Current yield rate in USDG (6 dec) per second for `account`'s position in `asset`.
    function yieldRatePerSecond(address asset, address account) external view returns (uint256 usdgPerSecond);
}
