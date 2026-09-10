// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {IAggregatorV3} from "../../src/IAggregatorV3.sol";

/// @notice TEST ONLY. A Chainlink aggregator whose round data the test sets directly,
///         including the malformed shapes a real feed can produce.
contract StubAggregator is IAggregatorV3 {
    uint8 private _decimals;
    string private _description;

    uint80 public roundId = 1;
    int256 public answer;
    uint256 public startedAt;
    uint256 public updatedAt;
    uint80 public answeredInRound = 1;

    constructor(uint8 decimals_, string memory description_, int256 answer_) {
        _decimals = decimals_;
        _description = description_;
        answer = answer_;
        startedAt = block.timestamp;
        updatedAt = block.timestamp;
    }

    function decimals() external view returns (uint8) {
        return _decimals;
    }

    function description() external view returns (string memory) {
        return _description;
    }

    /// @notice Publish a new answer stamped now.
    function setAnswer(int256 answer_) external {
        roundId += 1;
        answeredInRound = roundId;
        answer = answer_;
        startedAt = block.timestamp;
        updatedAt = block.timestamp;
    }

    /// @notice Publish an answer with an arbitrary observation timestamp.
    function setAnswerAt(int256 answer_, uint256 updatedAt_) external {
        roundId += 1;
        answeredInRound = roundId;
        answer = answer_;
        updatedAt = updatedAt_;
    }

    /// @notice Leave the round open: `answeredInRound` lags `roundId`.
    function openNewRound() external {
        roundId += 1;
    }

    function latestRoundData() external view returns (uint80, int256, uint256, uint256, uint80) {
        return (roundId, answer, startedAt, updatedAt, answeredInRound);
    }
}
