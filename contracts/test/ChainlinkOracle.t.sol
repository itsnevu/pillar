// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {ChainlinkOracle} from "../src/ChainlinkOracle.sol";
import {IAggregatorV3} from "../src/IAggregatorV3.sol";
import {StubAggregator} from "./mocks/StubAggregator.sol";

contract ChainlinkOracleTest is Test {
    ChainlinkOracle oracle;
    StubAggregator feed8;
    address owner = address(0xA11CE);
    address asset = address(0xAAA1);
    address stranger = address(0xBEEF);

    function setUp() public {
        vm.warp(1_700_000_000);
        oracle = new ChainlinkOracle(owner);
        feed8 = new StubAggregator(8, "AAPL / USD", 312_62000000); // 312.62 at 8 decimals
        vm.prank(owner);
        oracle.setFeed(asset, IAggregatorV3(address(feed8)), 0);
    }

    // ------------------------------------------------------------ normalisation

    function test_normalisesEightDecimalsTo1e18() public view {
        (uint256 price, uint256 updatedAt) = oracle.getPrice(asset);
        assertEq(price, 312.62e18);
        assertEq(updatedAt, block.timestamp);
    }

    function test_normalisesEighteenDecimalFeedUnchanged() public {
        StubAggregator feed18 = new StubAggregator(18, "X / USD", 7.5e18);
        vm.prank(owner);
        oracle.setFeed(asset, IAggregatorV3(address(feed18)), 0);
        (uint256 price,) = oracle.getPrice(asset);
        assertEq(price, 7.5e18);
    }

    function test_reportsFeedTimestampNotBlockTimestamp() public {
        feed8.setAnswerAt(300e8, 1_699_999_000);
        vm.warp(1_700_000_500);
        (, uint256 updatedAt) = oracle.getPrice(asset);
        // The oracle does not judge staleness; it reports what the feed said, so
        // PyrisCore stays the only place the staleness policy lives.
        assertEq(updatedAt, 1_699_999_000);
    }

    function testFuzz_normalisationRoundTrips(uint96 raw, uint8 dec) public {
        dec = uint8(bound(dec, 0, 18));
        vm.assume(raw > 0);
        StubAggregator f = new StubAggregator(dec, "F", int256(uint256(raw)));
        vm.prank(owner);
        oracle.setFeed(asset, IAggregatorV3(address(f)), 0);
        (uint256 price,) = oracle.getPrice(asset);
        assertEq(price, uint256(raw) * (10 ** (18 - dec)));
    }

    // ------------------------------------------------------------ bad answers

    function test_revertsOnZeroAnswer() public {
        feed8.setAnswer(0);
        vm.expectRevert(abi.encodeWithSelector(ChainlinkOracle.InvalidAnswer.selector, asset, int256(0)));
        oracle.getPrice(asset);
    }

    function test_revertsOnNegativeAnswer() public {
        feed8.setAnswer(-1e8);
        vm.expectRevert(abi.encodeWithSelector(ChainlinkOracle.InvalidAnswer.selector, asset, int256(-1e8)));
        oracle.getPrice(asset);
    }

    function test_revertsOnZeroTimestamp() public {
        feed8.setAnswerAt(300e8, 0);
        vm.expectRevert(abi.encodeWithSelector(ChainlinkOracle.IncompleteRound.selector, asset));
        oracle.getPrice(asset);
    }

    function test_revertsWhenAnswerCarriedFromEarlierRound() public {
        feed8.openNewRound(); // roundId advances, answeredInRound does not
        vm.expectRevert(abi.encodeWithSelector(ChainlinkOracle.IncompleteRound.selector, asset));
        oracle.getPrice(asset);
    }

    /// @dev Reverting rather than returning zero is the point: a caller cannot act
    ///      on a price it never received.
    function test_revertsOnUnknownAsset() public {
        vm.expectRevert(abi.encodeWithSelector(ChainlinkOracle.UnknownAsset.selector, address(0xDEAD)));
        oracle.getPrice(address(0xDEAD));
    }

    // ------------------------------------------------------------ ceiling

    function test_ceilingRejectsPinnedFeed() public {
        vm.prank(owner);
        oracle.setFeed(asset, IAggregatorV3(address(feed8)), 400e18);
        feed8.setAnswer(500e8);
        vm.expectRevert(
            abi.encodeWithSelector(ChainlinkOracle.AnswerAboveCeiling.selector, asset, uint256(500e18), uint256(400e18))
        );
        oracle.getPrice(asset);
    }

    function test_ceilingAllowsPriceAtTheBound() public {
        vm.prank(owner);
        oracle.setFeed(asset, IAggregatorV3(address(feed8)), 400e18);
        feed8.setAnswer(400e8);
        (uint256 price,) = oracle.getPrice(asset);
        assertEq(price, 400e18);
    }

    function test_zeroCeilingDisablesTheCheck() public {
        feed8.setAnswer(1_000_000e8);
        (uint256 price,) = oracle.getPrice(asset);
        assertEq(price, 1_000_000e18);
    }

    // ------------------------------------------------------------ admin

    function test_rejectsFeedWithMoreThanEighteenDecimals() public {
        StubAggregator wide = new StubAggregator(19, "W", 1);
        vm.prank(owner);
        vm.expectRevert(abi.encodeWithSelector(ChainlinkOracle.UnsupportedDecimals.selector, uint8(19)));
        oracle.setFeed(asset, IAggregatorV3(address(wide)), 0);
    }

    function test_onlyOwnerCanSetFeed() public {
        vm.prank(stranger);
        vm.expectRevert();
        oracle.setFeed(asset, IAggregatorV3(address(feed8)), 0);
    }

    function test_removeFeedMakesReadsRevert() public {
        vm.prank(owner);
        oracle.removeFeed(asset);
        vm.expectRevert(abi.encodeWithSelector(ChainlinkOracle.UnknownAsset.selector, asset));
        oracle.getPrice(asset);
    }

    function test_feedOfReportsRegistration() public view {
        (address agg, uint8 dec, uint256 maxAnswer) = oracle.feedOf(asset);
        assertEq(agg, address(feed8));
        assertEq(dec, 8);
        assertEq(maxAnswer, 0);
    }

    function test_replacingFeedSwitchesThePrice() public {
        StubAggregator replacement = new StubAggregator(8, "AAPL / USD v2", 99e8);
        vm.prank(owner);
        oracle.setFeed(asset, IAggregatorV3(address(replacement)), 0);
        (uint256 price,) = oracle.getPrice(asset);
        assertEq(price, 99e18);
    }
}
