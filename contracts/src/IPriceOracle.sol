// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @title IPriceOracle
/// @notice Minimal price feed interface used by PyrisCore.
/// @dev Prices are USD per 1 whole unit of `asset`, scaled to 1e18.
///      `updatedAt` is the unix timestamp of the last observation; PyrisCore
///      compares it to `block.timestamp - maxStaleness` before allowing new
///      borrows / withdrawals / liquidations. Repay, harvest and deposit never
///      depend on price freshness.
interface IPriceOracle {
    function getPrice(address asset) external view returns (uint256 price1e18, uint256 updatedAt);
}
