// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @title IAggregatorV3
/// @notice The Chainlink price feed interface, as published by every Chainlink
///         aggregator and by the feeds that copy its shape (Pyth's EVM adapter,
///         RedStone's classic adapter, and most chain-native equity feeds).
/// @dev Only the members Pyris actually reads are declared. `answer` is signed
///      because Chainlink allows negative answers on some feeds; an equity or
///      metal feed must never produce one, and ChainlinkOracle rejects it.
interface IAggregatorV3 {
    function decimals() external view returns (uint8);

    function description() external view returns (string memory);

    function latestRoundData()
        external
        view
        returns (uint80 roundId, int256 answer, uint256 startedAt, uint256 updatedAt, uint80 answeredInRound);
}
