// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {IERC4626} from "@openzeppelin/contracts/interfaces/IERC4626.sol";
import {PillarCore} from "../src/PillarCore.sol";
import {ChainlinkOracle} from "../src/ChainlinkOracle.sol";
import {ERC4626YieldSource} from "../src/ERC4626YieldSource.sol";
import {IAggregatorV3} from "../src/IAggregatorV3.sol";
import {IPriceOracle} from "../src/IPriceOracle.sol";
import {IYieldSource} from "../src/IYieldSource.sol";
import {ISwapRouter} from "../src/ISwapRouter.sol";
import {MockERC20} from "./mocks/MockERC20.sol";
import {StubAggregator} from "./mocks/StubAggregator.sol";
import {StubVault} from "./mocks/StubVault.sol";
import {StubRouter} from "./mocks/StubRouter.sol";

/// @title ProductionStack
/// @notice The whole protocol wired with the contracts that will actually be deployed:
///         PillarCore over ChainlinkOracle over a real Chainlink feed shape, and
///         ERC4626YieldSource over a genuine ERC-4626 vault. Nothing under `src/` is
///         a mock; the only stand-ins are the external systems Pillar does not own —
///         the aggregator, the vault, the swap venue and the tokens.
///
///         The claim this file exists to prove is the one on the landing page: the
///         yield repays the loan, and the borrower never makes a payment.
contract ProductionStackTest is Test {
    PillarCore core;
    ChainlinkOracle oracle;
    ERC4626YieldSource ys;

    MockERC20 usdg;
    MockERC20 aapl;
    StubAggregator feed;
    StubVault vault;
    StubRouter router;

    address owner = address(0xA11CE);
    address alice = address(0xA71CE);
    address feeRecipient = address(0xFEE5);

    int256 constant PRICE_8DEC = 300e8; // $300 per AAPL on an 8-decimal feed
    uint256 constant COLLATERAL = 100e18; // 100 AAPL = $30,000
    uint256 constant TREASURY = 1_000_000e6;

    function setUp() public {
        vm.warp(1_700_000_000);

        usdg = new MockERC20("Global Dollar", "USDG", 6);
        aapl = new MockERC20("Apple", "AAPL", 18);
        feed = new StubAggregator(8, "AAPL / USD", PRICE_8DEC);
        vault = new StubVault(aapl);

        vm.startPrank(owner);
        oracle = new ChainlinkOracle(owner);
        oracle.setFeed(address(aapl), IAggregatorV3(address(feed)), 0);

        router = new StubRouter(IPriceOracle(address(oracle)), usdg);
        ys = new ERC4626YieldSource(
            owner, IERC20(address(usdg)), IPriceOracle(address(oracle)), ISwapRouter(address(router)), 100
        );
        ys.setVault(address(aapl), IERC4626(address(vault)));

        core = new PillarCore(owner, IERC20(address(usdg)), IPriceOracle(address(oracle)), feeRecipient);
        core.listMarket(address(aapl), 4000, 5000, 500, 0, IYieldSource(address(ys)));
        vm.stopPrank();

        usdg.mint(owner, TREASURY);
        vm.startPrank(owner);
        usdg.approve(address(core), TREASURY);
        core.fundTreasury(TREASURY);
        vm.stopPrank();

        aapl.mint(alice, COLLATERAL);
        vm.startPrank(alice);
        aapl.approve(address(core), type(uint256).max);
        core.depositCollateral(address(aapl), COLLATERAL);
        vm.stopPrank();
    }

    function _debt() internal view returns (uint256) {
        return core.getPosition(alice, address(aapl)).debt;
    }

    /// @dev A year of vault performance, expressed the way a vault actually delivers
    ///      it: the underlying the vault holds grows, so every share is worth more.
    function _vaultEarns(uint256 apyBps, uint256 duration) internal {
        skip(duration);
        feed.setAnswer(PRICE_8DEC); // a live feed keeps publishing
        uint256 held = aapl.balanceOf(address(vault));
        vault.accrue(held * apyBps * duration / (10_000 * 365 days));
    }

    // ------------------------------------------------------------ the core claim

    function test_priceFlowsFromTheChainlinkFeedIntoCollateralValue() public view {
        // 100 AAPL at $300 = $30,000, in USDG's 6 decimals.
        assertEq(core.collateralValue(alice, address(aapl)), 30_000e6);
        assertEq(core.maxBorrowable(alice, address(aapl)), 12_000e6, "40% of $30,000");
    }

    function test_yieldRepaysTheLoanWithoutTheBorrowerPaying() public {
        vm.prank(alice);
        core.borrow(address(aapl), 10_000e6);
        assertEq(_debt(), 10_000e6);
        uint256 usdgAfterBorrow = usdg.balanceOf(alice);

        _vaultEarns(800, 365 days); // 8% for a year

        core.harvest(address(aapl), alice); // a keeper, not Alice

        uint256 debtAfter = _debt();
        assertLt(debtAfter, 10_000e6, "the debt went down");
        // $30,000 of collateral earning 8% is $2,400; the protocol keeps 10%, so
        // $2,160 lands on the debt.
        assertApproxEqRel(10_000e6 - debtAfter, 2_160e6, 0.01e18);
        assertEq(usdg.balanceOf(alice), usdgAfterBorrow, "Alice never spent a cent repaying");
        assertGt(usdg.balanceOf(feeRecipient), 0, "the protocol took its cut of the yield");
    }

    function test_debtReachesZeroAndCollateralComesBackWhole() public {
        vm.prank(alice);
        core.borrow(address(aapl), 4_000e6);

        // Six annual harvests at 8%. No payment is ever made by Alice.
        for (uint256 i; i < 6 && _debt() > 0; ++i) {
            _vaultEarns(800, 365 days);
            core.harvest(address(aapl), alice);
        }

        assertEq(_debt(), 0, "time paid the loan off");

        vm.prank(alice);
        core.withdrawCollateral(address(aapl), COLLATERAL);
        assertEq(aapl.balanceOf(alice), COLLATERAL, "every share of the position came back");
    }

    /// @dev The limit stated on the risk page, proved against the production stack:
    ///      a vault that earns nothing leaves the debt exactly where it was. It does
    ///      not grow, because nothing accrues against the borrower.
    function test_zeroYieldFreezesTheDebtRatherThanGrowingIt() public {
        vm.prank(alice);
        core.borrow(address(aapl), 10_000e6);

        skip(365 days);
        feed.setAnswer(PRICE_8DEC);
        core.harvest(address(aapl), alice);

        assertEq(_debt(), 10_000e6, "unchanged in both directions");
    }

    // ------------------------------------------------------------ oracle policy

    function test_staleChainlinkFeedBlocksBorrowingButNotRepaying() public {
        vm.prank(alice);
        core.borrow(address(aapl), 5_000e6);

        // The feed stops publishing; PillarCore's own staleness window lapses.
        skip(2 hours);

        vm.prank(alice);
        vm.expectRevert();
        core.borrow(address(aapl), 1e6);

        // Making yourself safer is never blocked.
        usdg.mint(alice, 1_000e6);
        vm.startPrank(alice);
        usdg.approve(address(core), 1_000e6);
        core.repay(address(aapl), 1_000e6);
        vm.stopPrank();
        assertEq(_debt(), 4_000e6);

        assertFalse(core.isPriceFresh(address(aapl)));
        feed.setAnswer(PRICE_8DEC);
        assertTrue(core.isPriceFresh(address(aapl)));
    }

    /// @dev A feed reporting a broken answer takes the whole market offline rather
    ///      than letting anyone act on the number. The revert propagates from
    ///      ChainlinkOracle through PillarCore.
    function test_brokenFeedAnswerHaltsTheMarket() public {
        feed.setAnswer(0);
        vm.expectRevert(abi.encodeWithSelector(ChainlinkOracle.InvalidAnswer.selector, address(aapl), int256(0)));
        core.collateralValue(alice, address(aapl));

        vm.prank(alice);
        vm.expectRevert();
        core.borrow(address(aapl), 1e6);
    }

    // ------------------------------------------------------------ liquidation

    function test_partialLiquidationAfterAWeekendGap() public {
        vm.prank(alice);
        core.borrow(address(aapl), 12_000e6); // the full 40% LTV

        // Monday opens 40% below Friday's close — the scenario the conservative
        // LTV exists for, arriving through the real feed.
        skip(3 days);
        feed.setAnswer(180e8);

        assertLt(core.healthFactor(alice, address(aapl)), 1e18, "underwater");
        uint256 maxRepay = core.maxLiquidatable(alice, address(aapl));
        assertGt(maxRepay, 0);
        assertLt(maxRepay, _debt(), "partial by construction, never the whole position");

        address liquidator = address(0x11D0);
        usdg.mint(liquidator, maxRepay);
        vm.startPrank(liquidator);
        usdg.approve(address(core), maxRepay);
        vm.expectRevert(); // over-liquidating is refused outright
        core.liquidate(alice, address(aapl), maxRepay + 1e6);
        core.liquidate(alice, address(aapl), maxRepay);
        vm.stopPrank();

        assertGe(core.healthFactor(alice, address(aapl)), 1e18, "restored to health, not seized");
        assertGt(core.getPosition(alice, address(aapl)).collateral, 0, "Alice still holds a position");
    }

    // ------------------------------------------------------------ swap venue

    /// @dev Yield only becomes a repayment once it has been swapped to USDG. If the
    ///      swap cannot be filled within tolerance, the harvest reverts and the debt
    ///      simply stays where it is — the protocol never books a repayment it did
    ///      not receive.
    function test_unfillableSwapLeavesTheDebtUntouched() public {
        vm.prank(alice);
        core.borrow(address(aapl), 10_000e6);
        _vaultEarns(800, 365 days);

        router.setSpreadBps(500); // 5% against a 1% tolerance
        vm.expectRevert();
        core.harvest(address(aapl), alice);
        assertEq(_debt(), 10_000e6);

        router.setSpreadBps(50); // venue recovers
        core.harvest(address(aapl), alice);
        assertLt(_debt(), 10_000e6);
    }
}
