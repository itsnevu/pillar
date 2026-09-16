// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {IPriceOracle} from "../../src/IPriceOracle.sol";

/// @title MockOracle
/// @notice Owner-set price feed for local development and tests.
/// @dev LOCAL / TEST ONLY. In production this is replaced by an adapter over a
///      Chainlink / Pyth / Arc Chain equities feed. `markStale` forces
///      `updatedAt` far into the past so tests can exercise staleness rules.
contract MockOracle is IPriceOracle, Ownable {
    struct Observation {
        uint256 price1e18;
        uint256 updatedAt;
    }

    mapping(address => Observation) private _obs;

    event PriceSet(address indexed asset, uint256 price1e18, uint256 updatedAt);
    event MarkedStale(address indexed asset);

    error UnknownAsset(address asset);

    constructor(address owner_) Ownable(owner_) {}

    /// @notice Set a price observed "now".
    function setPrice(address asset, uint256 price1e18) external onlyOwner {
        _obs[asset] = Observation(price1e18, block.timestamp);
        emit PriceSet(asset, price1e18, block.timestamp);
    }

    /// @notice Set a price with an explicit observation timestamp.
    function setPriceAt(address asset, uint256 price1e18, uint256 updatedAt) external onlyOwner {
        _obs[asset] = Observation(price1e18, updatedAt);
        emit PriceSet(asset, price1e18, updatedAt);
    }

    /// @notice Keep the price but push `updatedAt` to 0 so any staleness check fails.
    function markStale(address asset) external onlyOwner {
        _obs[asset].updatedAt = 0;
        emit MarkedStale(asset);
    }

    /// @notice Re-stamp the existing price as fresh.
    function refresh(address asset) external onlyOwner {
        _obs[asset].updatedAt = block.timestamp;
        emit PriceSet(asset, _obs[asset].price1e18, block.timestamp);
    }

    function getPrice(address asset) external view override returns (uint256 price1e18, uint256 updatedAt) {
        Observation memory o = _obs[asset];
        if (o.price1e18 == 0) revert UnknownAsset(asset);
        return (o.price1e18, o.updatedAt);
    }
}
