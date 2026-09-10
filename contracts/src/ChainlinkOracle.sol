// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Ownable2Step, Ownable} from "@openzeppelin/contracts/access/Ownable2Step.sol";
import {IPriceOracle} from "./IPriceOracle.sol";
import {IAggregatorV3} from "./IAggregatorV3.sol";

/// @title ChainlinkOracle
/// @notice Production price feed: one Chainlink-shaped aggregator per collateral
///         asset, normalised to the 1e18 USD price PillarCore expects.
/// @dev This contract does not decide whether a price is too old. It reports the
///      aggregator's `updatedAt` faithfully and lets PillarCore apply its own
///      staleness rule, so there is a single place where that policy lives.
///
///      What it does refuse to report at all is a price that cannot be true:
///      a zero or negative answer, or a round the aggregator never completed.
///      Reverting is the correct response — a caller that receives a revert
///      cannot act on a bad number, whereas a caller that receives `(0, 0)` might.
///
///      `maxAnswer` is an optional per-feed sanity ceiling. Chainlink aggregators
///      historically clamped answers to a circuit-breaker band and kept reporting
///      the clamped value as if it were real; a ceiling lets Pillar reject a feed
///      that has obviously pinned rather than lend against it.
contract ChainlinkOracle is IPriceOracle, Ownable2Step {
    struct Feed {
        IAggregatorV3 aggregator;
        /// @dev Cached at registration; aggregator decimals are immutable in practice.
        uint8 decimals;
        /// @dev 1e18-scaled upper bound. Zero disables the check.
        uint256 maxAnswer;
    }

    mapping(address => Feed) private _feeds;

    event FeedSet(address indexed asset, address indexed aggregator, uint8 decimals, uint256 maxAnswer);
    event FeedRemoved(address indexed asset);

    error ZeroAddress();
    error UnknownAsset(address asset);
    error InvalidAnswer(address asset, int256 answer);
    error IncompleteRound(address asset);
    error AnswerAboveCeiling(address asset, uint256 price1e18, uint256 maxAnswer);
    error UnsupportedDecimals(uint8 decimals);

    constructor(address owner_) Ownable(owner_) {}

    // ---------------------------------------------------------------- admin

    /// @notice Register or replace the aggregator backing `asset`.
    /// @param maxAnswer 1e18-scaled ceiling above which a price is rejected. 0 disables it.
    function setFeed(address asset, IAggregatorV3 aggregator, uint256 maxAnswer) external onlyOwner {
        if (asset == address(0) || address(aggregator) == address(0)) revert ZeroAddress();
        uint8 dec = aggregator.decimals();
        // Scaling to 1e18 must not lose precision or overflow the multiplier.
        if (dec > 18) revert UnsupportedDecimals(dec);
        _feeds[asset] = Feed({aggregator: aggregator, decimals: dec, maxAnswer: maxAnswer});
        emit FeedSet(asset, address(aggregator), dec, maxAnswer);
    }

    /// @notice Stop reporting a price for `asset`. Every read then reverts.
    /// @dev Delisting a market in PillarCore is the usual path; this is the
    ///      blunter one, for a feed that has been retired by its operator.
    function removeFeed(address asset) external onlyOwner {
        if (address(_feeds[asset].aggregator) == address(0)) revert UnknownAsset(asset);
        delete _feeds[asset];
        emit FeedRemoved(asset);
    }

    // ---------------------------------------------------------------- views

    /// @notice The aggregator backing `asset`, or the zero address if unregistered.
    function feedOf(address asset) external view returns (address aggregator, uint8 decimals, uint256 maxAnswer) {
        Feed memory f = _feeds[asset];
        return (address(f.aggregator), f.decimals, f.maxAnswer);
    }

    /// @inheritdoc IPriceOracle
    function getPrice(address asset) external view override returns (uint256 price1e18, uint256 updatedAt) {
        Feed memory f = _feeds[asset];
        if (address(f.aggregator) == address(0)) revert UnknownAsset(asset);

        (uint80 roundId, int256 answer, /* startedAt */, uint256 ts, uint80 answeredInRound) =
            f.aggregator.latestRoundData();

        if (answer <= 0) revert InvalidAnswer(asset, answer);
        // A round with no timestamp never settled; `answeredInRound < roundId` means
        // the answer is carried over from an earlier round and the current one is open.
        if (ts == 0 || answeredInRound < roundId) revert IncompleteRound(asset);

        price1e18 = uint256(answer) * (10 ** (18 - f.decimals));
        if (f.maxAnswer != 0 && price1e18 > f.maxAnswer) {
            revert AnswerAboveCeiling(asset, price1e18, f.maxAnswer);
        }
        updatedAt = ts;
    }
}
