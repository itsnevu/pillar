// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {MockERC20} from "./mocks/MockERC20.sol";
import {MockOracle} from "./mocks/MockOracle.sol";
import {MockYieldSource} from "./mocks/MockYieldSource.sol";
import {PillarCore} from "../src/PillarCore.sol";
import {IYieldSource} from "../src/IYieldSource.sol";
import {IPriceOracle} from "../src/IPriceOracle.sol";
import {Pausable} from "@openzeppelin/contracts/utils/Pausable.sol";

contract PillarCoreTest is Test {
    MockERC20 usdg;
    MockERC20 aapl;
    MockERC20 tsla;
    MockOracle oracle;
    MockYieldSource ys;
    PillarCore core;

    address owner = address(this);
    address alice = makeAddr("alice");
    address bob = makeAddr("bob");
    address liquidator = makeAddr("liquidator");
    address feeRecipient = makeAddr("fees");
    address keeper = makeAddr("keeper");

    uint256 constant AAPL_PRICE = 312.62e18;
    // ~8% APY: 0.08 / 31_536_000 seconds, 1e18 scale
    uint256 constant RATE_8PCT = 2_536_783_358;
    uint256 constant TREASURY = 5_000_000e6;

    function setUp() public {
        usdg = new MockERC20("Global Dollar", "USDG", 6);
        aapl = new MockERC20("Apple", "AAPL", 18);
        tsla = new MockERC20("Tesla", "TSLA", 18);
        oracle = new MockOracle(owner);
        oracle.setPrice(address(aapl), AAPL_PRICE);
        oracle.setPrice(address(tsla), 368.16e18);
        ys = new MockYieldSource(owner, usdg, IPriceOracle(address(oracle)), RATE_8PCT);
        core = new PillarCore(owner, usdg, IPriceOracle(address(oracle)), feeRecipient);

        core.listMarket(address(aapl), 4000, 5000, 500, 0, IYieldSource(address(ys)));
        core.listMarket(address(tsla), 3000, 4000, 500, 1_000e18, IYieldSource(address(ys)));
        core.setKeeper(keeper, true);

        usdg.mint(owner, TREASURY);
        usdg.approve(address(core), type(uint256).max);
        core.fundTreasury(TREASURY);

        aapl.mint(alice, 1_000e18);
        aapl.mint(bob, 1_000e18);
        tsla.mint(alice, 10_000e18);
        usdg.mint(liquidator, 1_000_000e6);

        vm.startPrank(alice);
        aapl.approve(address(core), type(uint256).max);
        tsla.approve(address(core), type(uint256).max);
        usdg.approve(address(core), type(uint256).max);
        vm.stopPrank();
        vm.startPrank(bob);
        aapl.approve(address(core), type(uint256).max);
        usdg.approve(address(core), type(uint256).max);
        vm.stopPrank();
        vm.prank(liquidator);
        usdg.approve(address(core), type(uint256).max);
    }

    // ------------------------------------------------------------ helpers

    function _depositAndBorrow(address who, uint256 coll, uint256 debt) internal {
        vm.startPrank(who);
        core.depositCollateral(address(aapl), coll);
        if (debt > 0) core.borrow(address(aapl), debt);
        vm.stopPrank();
    }

    function _debt(address who) internal view returns (uint256) {
        return core.getPosition(who, address(aapl)).debt;
    }

    function _coll(address who) internal view returns (uint256) {
        return core.getPosition(who, address(aapl)).collateral;
    }

    // 100 AAPL @ 312.62 = 31,262 USDG; 40% LTV = 12,504.8 USDG
    uint256 constant COLL = 100e18;
    uint256 constant COLL_VALUE = 31_262e6;
    uint256 constant MAX_BORROW = 12_504.8e6;

    // ------------------------------------------------------------ deposit / withdraw

    function test_deposit_forwardsToYieldSource() public {
        _depositAndBorrow(alice, COLL, 0);
        assertEq(_coll(alice), COLL);
        assertEq(ys.balanceOf(address(aapl), address(core)), COLL);
        assertEq(aapl.balanceOf(address(core)), 0, "core should not hold collateral");
        assertEq(core.collateralValue(alice, address(aapl)), COLL_VALUE);
    }

    function test_deposit_revertsZero() public {
        vm.prank(alice);
        vm.expectRevert(PillarCore.ZeroAmount.selector);
        core.depositCollateral(address(aapl), 0);
    }

    function test_deposit_revertsUnlisted() public {
        MockERC20 x = new MockERC20("X", "X", 18);
        vm.prank(alice);
        vm.expectRevert(PillarCore.MarketNotListed.selector);
        core.depositCollateral(address(x), 1);
    }

    function test_deposit_respectsCap() public {
        vm.startPrank(alice);
        core.depositCollateral(address(tsla), 1_000e18);
        vm.expectRevert(abi.encodeWithSelector(PillarCore.CapExceeded.selector, 1_000e18));
        core.depositCollateral(address(tsla), 1);
        vm.stopPrank();
    }

    function test_withdraw_noDebt_fullAmount() public {
        _depositAndBorrow(alice, COLL, 0);
        uint256 before = aapl.balanceOf(alice);
        vm.prank(alice);
        core.withdrawCollateral(address(aapl), COLL);
        assertEq(aapl.balanceOf(alice), before + COLL);
        assertEq(_coll(alice), 0);
    }

    function test_withdraw_allowedWithinLtv() public {
        _depositAndBorrow(alice, COLL, 6_000e6); // ~19% LTV
        vm.prank(alice);
        core.withdrawCollateral(address(aapl), 50e18); // now 6000/15631 = 38.4%
        assertLe(core.ltv(alice, address(aapl)), 4000);
    }

    function test_withdraw_revertsAboveLtv() public {
        _depositAndBorrow(alice, COLL, MAX_BORROW);
        vm.prank(alice);
        vm.expectRevert();
        core.withdrawCollateral(address(aapl), 1e18);
    }

    function test_withdraw_revertsInsufficientCollateral() public {
        _depositAndBorrow(alice, COLL, 0);
        vm.prank(alice);
        vm.expectRevert(PillarCore.InsufficientCollateral.selector);
        core.withdrawCollateral(address(aapl), COLL + 1);
    }

    // ------------------------------------------------------------ borrow

    function test_borrow_upToMaxLtv() public {
        _depositAndBorrow(alice, COLL, MAX_BORROW);
        assertEq(_debt(alice), MAX_BORROW);
        assertEq(usdg.balanceOf(alice), MAX_BORROW);
        assertEq(core.ltv(alice, address(aapl)), 4000);
        assertEq(core.treasury(), TREASURY - MAX_BORROW);
    }

    function test_borrow_revertsAboveMaxLtv() public {
        vm.startPrank(alice);
        core.depositCollateral(address(aapl), COLL);
        // 1 bps of LTV here is ~3.13 USDG; +4 USDG -> 12508.8/31262 = 40.013% -> 4001 bps.
        vm.expectRevert(abi.encodeWithSelector(PillarCore.ExceedsMaxLtv.selector, 4001, 4000));
        core.borrow(address(aapl), MAX_BORROW + 4e6);
        vm.stopPrank();
    }

    function test_maxBorrowable() public {
        _depositAndBorrow(alice, COLL, 0);
        assertEq(core.maxBorrowable(alice, address(aapl)), MAX_BORROW);
        vm.prank(alice);
        core.borrow(address(aapl), 5_000e6);
        assertEq(core.maxBorrowable(alice, address(aapl)), MAX_BORROW - 5_000e6);
    }

    function test_borrow_revertsInsufficientTreasury() public {
        core.withdrawTreasury(owner, TREASURY - 1_000e6);
        vm.startPrank(alice);
        core.depositCollateral(address(aapl), COLL);
        vm.expectRevert(abi.encodeWithSelector(PillarCore.InsufficientTreasury.selector, 1_000e6));
        core.borrow(address(aapl), 1_001e6);
        vm.stopPrank();
    }

    function test_borrow_revertsClosedMarket() public {
        core.closeMarket(address(aapl));
        vm.startPrank(alice);
        core.depositCollateral(address(aapl), COLL); // deposits still fine
        vm.expectRevert(PillarCore.MarketClosed.selector);
        core.borrow(address(aapl), 1e6);
        vm.stopPrank();
        core.openMarket(address(aapl));
        vm.prank(alice);
        core.borrow(address(aapl), 1e6);
    }

    function test_borrow_revertsWhenNoCollateral() public {
        vm.prank(alice);
        vm.expectRevert(abi.encodeWithSelector(PillarCore.ExceedsMaxLtv.selector, type(uint256).max, 4000));
        core.borrow(address(aapl), 1e6);
    }

    // ------------------------------------------------------------ oracle staleness

    function test_staleOracle_blocksBorrow() public {
        _depositAndBorrow(alice, COLL, 0);
        oracle.markStale(address(aapl));
        assertFalse(core.isPriceFresh(address(aapl)));
        vm.prank(alice);
        vm.expectRevert(abi.encodeWithSelector(PillarCore.StalePrice.selector, 0));
        core.borrow(address(aapl), 1e6);
    }

    function test_staleOracle_blocksWithdrawWithDebt_butNotWithoutDebt() public {
        _depositAndBorrow(alice, COLL, 1_000e6);
        oracle.markStale(address(aapl));
        vm.startPrank(alice);
        vm.expectRevert(abi.encodeWithSelector(PillarCore.StalePrice.selector, 0));
        core.withdrawCollateral(address(aapl), 1e18);
        core.repay(address(aapl), 1_000e6);
        core.withdrawCollateral(address(aapl), COLL); // no debt -> allowed even if stale
        vm.stopPrank();
        assertEq(_coll(alice), 0);
    }

    function test_staleOracle_doesNotBlockRepayDepositHarvest() public {
        _depositAndBorrow(alice, COLL, 5_000e6);
        oracle.markStale(address(aapl));
        vm.warp(block.timestamp + 1 days);
        vm.startPrank(alice);
        core.repay(address(aapl), 1_000e6);
        core.depositCollateral(address(aapl), 10e18);
        vm.stopPrank();
        core.harvest(address(aapl), alice);
        assertLt(_debt(alice), 4_000e6, "harvest applied yield while stale");
    }

    function test_staleness_isTimeBased() public {
        _depositAndBorrow(alice, COLL, 0);
        vm.warp(block.timestamp + 1 hours + 1);
        vm.prank(alice);
        vm.expectRevert();
        core.borrow(address(aapl), 1e6);
        oracle.refresh(address(aapl));
        vm.prank(alice);
        core.borrow(address(aapl), 1e6);
    }

    // ------------------------------------------------------------ harvest / self-repay

    function test_harvest_reducesDebt_withProtocolCut() public {
        _depositAndBorrow(alice, COLL, 10_000e6);
        vm.warp(block.timestamp + 30 days);

        uint256 pending = core.pendingYield(alice, address(aapl));
        // 8% APY on 31,262 for 30 days ≈ 205.6 USDG
        assertApproxEqRel(pending, 205.56e6, 0.01e18);

        uint256 feeBefore = usdg.balanceOf(feeRecipient);
        uint256 treasuryBefore = core.treasury();

        vm.expectEmit(true, true, false, false);
        emit PillarCore.SelfRepaid(alice, address(aapl), 0, 0);
        core.harvest(address(aapl), alice);

        uint256 cut = pending / 10;
        uint256 net = pending - cut;
        assertEq(usdg.balanceOf(feeRecipient) - feeBefore, cut, "protocol cut");
        assertEq(_debt(alice), 10_000e6 - net, "debt reduced by net yield");
        assertEq(core.getPosition(alice, address(aapl)).yieldAccruedToDebt, net);
        assertEq(core.treasury() - treasuryBefore, net, "repaid principal returns to treasury");
        assertEq(core.pendingYield(alice, address(aapl)), 0);
    }

    function test_harvest_zeroDebt_creditsUsdgCredit_andClaim() public {
        _depositAndBorrow(alice, COLL, 0);
        vm.warp(block.timestamp + 30 days);
        uint256 pending = core.pendingYield(alice, address(aapl));
        core.harvest(address(aapl), alice);
        uint256 net = pending - pending / 10;
        assertEq(core.usdgCredit(alice), net);
        assertEq(_debt(alice), 0);

        vm.prank(alice);
        core.claimCredit();
        assertEq(usdg.balanceOf(alice), net);
        assertEq(core.usdgCredit(alice), 0);
    }

    function test_harvest_overshoot_goesToCredit() public {
        _depositAndBorrow(alice, COLL, 10e6); // tiny debt
        vm.warp(block.timestamp + 30 days);
        uint256 pending = core.pendingYield(alice, address(aapl));
        uint256 net = pending - pending / 10;
        core.harvest(address(aapl), alice);
        assertEq(_debt(alice), 0);
        assertEq(core.usdgCredit(alice), net - 10e6);
    }

    function test_harvest_anyoneCanCall() public {
        _depositAndBorrow(alice, COLL, 5_000e6);
        vm.warp(block.timestamp + 7 days);
        vm.prank(bob);
        core.harvest(address(aapl), alice);
        assertLt(_debt(alice), 5_000e6);
    }

    function test_harvest_sharesYieldProportionally() public {
        _depositAndBorrow(alice, 100e18, 5_000e6);
        _depositAndBorrow(bob, 300e18, 5_000e6);
        vm.warp(block.timestamp + 30 days);
        uint256 pa = core.pendingYield(alice, address(aapl));
        uint256 pb = core.pendingYield(bob, address(aapl));
        assertApproxEqAbs(pb, pa * 3, 10);
        core.harvest(address(aapl), alice);
        core.harvest(address(aapl), bob);
        assertApproxEqAbs(5_000e6 - _debt(bob), (5_000e6 - _debt(alice)) * 3, 10);
    }

    function test_debtNeverIncreasesWithoutBorrowing() public {
        _depositAndBorrow(alice, COLL, MAX_BORROW);
        uint256 d0 = _debt(alice);
        for (uint256 i; i < 12; ++i) {
            vm.warp(block.timestamp + 30 days);
            core.harvest(address(aapl), alice);
            uint256 d = _debt(alice);
            assertLe(d, d0, "debt grew");
            d0 = d;
        }
        assertLt(d0, MAX_BORROW);
    }

    function test_debtNeverIncreases_zeroYield() public {
        _depositAndBorrow(alice, COLL, MAX_BORROW);
        ys.setRate(0);
        vm.warp(block.timestamp + 365 days);
        core.harvest(address(aapl), alice);
        assertEq(_debt(alice), MAX_BORROW, "zero yield: debt stops shrinking but never grows");
        // Debt pays off over time at 8%: 12,504.8 / (0.072 * 31,262 / yr) ≈ 5.6 years.
    }

    function test_selfRepay_reachesZero() public {
        _depositAndBorrow(alice, COLL, 1_000e6);
        vm.warp(block.timestamp + 365 days);
        core.harvest(address(aapl), alice);
        assertEq(_debt(alice), 0);
        assertGt(core.usdgCredit(alice), 0);
        // collateral comes back whole
        vm.prank(alice);
        core.withdrawCollateral(address(aapl), COLL);
        assertEq(aapl.balanceOf(alice), 1_000e18);
    }

    // ------------------------------------------------------------ liquidation

    function _setupUnderwater() internal {
        _depositAndBorrow(alice, COLL, MAX_BORROW); // 12,504.8 debt
        oracle.setPrice(address(aapl), 200e18); // value 20,000; LT 50% -> capacity 10,000
    }

    function test_priceDrop_healthFactorBelowOne() public {
        _depositAndBorrow(alice, COLL, MAX_BORROW);
        assertEq(core.healthFactor(alice, address(aapl)), 1.25e18); // 0.5 / 0.4
        oracle.setPrice(address(aapl), 200e18);
        uint256 hf = core.healthFactor(alice, address(aapl));
        assertApproxEqRel(hf, 0.7997e18, 0.001e18); // 10,000 / 12,504.8
        assertLt(hf, 1e18);
    }

    function test_liquidate_partial_restoresHealthExactly() public {
        _setupUnderwater();
        uint256 maxRepay = core.maxLiquidatable(alice, address(aapl));
        // (12504.8 - 10000) / (1 - 0.5*1.05) = 2504.8 / 0.475 = 5273.263...
        assertApproxEqAbs(maxRepay, 5_273.263158e6, 2);

        uint256 collBefore = _coll(alice);
        vm.prank(liquidator);
        core.liquidate(alice, address(aapl), maxRepay);

        assertEq(_debt(alice), MAX_BORROW - maxRepay);
        uint256 hf = core.healthFactor(alice, address(aapl));
        assertGe(hf, 1e18, "health restored");
        assertLt(hf, 1.0001e18, "not over-restored");
        assertGt(_coll(alice), 0, "position not wiped");
        assertLt(_coll(alice), collBefore);
    }

    function test_liquidate_smallerSliceAllowed() public {
        _setupUnderwater();
        vm.prank(liquidator);
        core.liquidate(alice, address(aapl), 1_000e6);
        assertEq(_debt(alice), MAX_BORROW - 1_000e6);
        assertLt(core.healthFactor(alice, address(aapl)), 1e18, "still unhealthy after small slice");
    }

    function test_liquidate_revertsOnOverLiquidation() public {
        _setupUnderwater();
        uint256 maxRepay = core.maxLiquidatable(alice, address(aapl));
        vm.prank(liquidator);
        vm.expectRevert(abi.encodeWithSelector(PillarCore.OverLiquidation.selector, maxRepay));
        core.liquidate(alice, address(aapl), maxRepay + 1);
    }

    function test_liquidate_revertsWhenHealthy() public {
        _depositAndBorrow(alice, COLL, MAX_BORROW);
        vm.prank(liquidator);
        vm.expectRevert(abi.encodeWithSelector(PillarCore.Healthy.selector, 1.25e18));
        core.liquidate(alice, address(aapl), 1e6);
        assertEq(core.maxLiquidatable(alice, address(aapl)), 0);
    }

    function test_liquidate_bonusMath() public {
        _setupUnderwater();
        uint256 repayAmt = 1_000e6;
        uint256 before = aapl.balanceOf(liquidator);
        vm.prank(liquidator);
        core.liquidate(alice, address(aapl), repayAmt);
        uint256 seized = aapl.balanceOf(liquidator) - before;
        // 1000 * 1.05 = 1050 USD of AAPL at $200 = 5.25 AAPL
        assertEq(seized, 5.25e18);
        assertEq(_coll(alice), COLL - 5.25e18);
        assertEq(usdg.balanceOf(liquidator), 1_000_000e6 - repayAmt);
    }

    function test_liquidate_requiresFreshPrice() public {
        _setupUnderwater();
        oracle.markStale(address(aapl));
        vm.prank(liquidator);
        vm.expectRevert(abi.encodeWithSelector(PillarCore.StalePrice.selector, 0));
        core.liquidate(alice, address(aapl), 1e6);
    }

    function test_liquidate_pendingYieldAppliedFirst() public {
        _depositAndBorrow(alice, COLL, MAX_BORROW);
        vm.warp(block.timestamp + 30 days);
        // yield ≈ 185 net; drop price just enough to be barely unhealthy before yield
        // capacity at 250: 25,000*0.5 = 12,500 < 12,504.8 -> HF < 1 pre-yield, > 1 post-yield.
        oracle.setPrice(address(aapl), 250e18);
        assertLt(core.healthFactor(alice, address(aapl)), 1e18);
        vm.prank(liquidator);
        vm.expectRevert(); // Healthy(...) after settling yield
        core.liquidate(alice, address(aapl), 1e6);
    }

    // ------------------------------------------------------------ admin / pause / keeper

    function test_pause_blocksBorrowDepositWithdraw_allowsRepayHarvest() public {
        _depositAndBorrow(alice, COLL, 5_000e6);
        core.pause();
        vm.startPrank(alice);
        vm.expectRevert(Pausable.EnforcedPause.selector);
        core.borrow(address(aapl), 1e6);
        vm.expectRevert(Pausable.EnforcedPause.selector);
        core.depositCollateral(address(aapl), 1e18);
        vm.expectRevert(Pausable.EnforcedPause.selector);
        core.withdrawCollateral(address(aapl), 1e18);
        core.repay(address(aapl), 1_000e6);
        vm.stopPrank();
        vm.warp(block.timestamp + 1 days);
        core.harvest(address(aapl), alice);
        assertLt(_debt(alice), 4_000e6);
        core.unpause();
        oracle.refresh(address(aapl));
        vm.prank(alice);
        core.borrow(address(aapl), 1e6);
    }

    function test_keeper_canPauseAndClose_notUnpauseOrOpen() public {
        vm.startPrank(keeper);
        core.pause();
        core.closeMarket(address(aapl));
        vm.expectRevert();
        core.unpause();
        vm.expectRevert();
        core.openMarket(address(aapl));
        vm.stopPrank();
        vm.prank(bob);
        vm.expectRevert(PillarCore.NotKeeperOrOwner.selector);
        core.pause();
    }

    function test_listMarket_rejectsBadParams() public {
        MockERC20 x = new MockERC20("X", "X", 18);
        IYieldSource s = IYieldSource(address(ys));
        vm.expectRevert(PillarCore.InvalidParams.selector);
        core.listMarket(address(x), 5000, 4000, 500, 0, s); // ltv >= threshold
        vm.expectRevert(PillarCore.InvalidParams.selector);
        core.listMarket(address(x), 9000, 9600, 500, 0, s); // LT*(1+bonus) >= 1
        vm.expectRevert(PillarCore.MarketAlreadyListed.selector);
        core.listMarket(address(aapl), 4000, 5000, 500, 0, s);
    }

    function test_setMarketParams_tightensLtv() public {
        _depositAndBorrow(alice, COLL, MAX_BORROW);
        core.setMarketParams(address(aapl), 3000, 4000, 500, 0);
        assertEq(core.maxBorrowable(alice, address(aapl)), 0);
        vm.prank(alice);
        vm.expectRevert();
        core.borrow(address(aapl), 1e6);
        // existing position is not liquidatable just because LTV tightened (HF = 0.4/0.4 = 1)
        assertGe(core.healthFactor(alice, address(aapl)), 1e18);
    }

    function test_treasury_fundAndWithdraw() public {
        usdg.mint(bob, 100e6);
        vm.prank(bob);
        core.fundTreasury(100e6);
        assertEq(core.treasury(), TREASURY + 100e6);
        vm.prank(bob);
        vm.expectRevert();
        core.withdrawTreasury(bob, 1);
        core.withdrawTreasury(owner, TREASURY + 100e6);
        assertEq(core.treasury(), 0);
    }

    function test_repayFor_thirdParty() public {
        _depositAndBorrow(alice, COLL, 5_000e6);
        usdg.mint(bob, 5_000e6);
        vm.prank(bob);
        core.repayFor(address(aapl), alice, 10_000e6); // overpay capped at debt
        assertEq(_debt(alice), 0);
        assertEq(usdg.balanceOf(bob), 0);
    }

    // ------------------------------------------------------------ fuzz

    function testFuzz_borrow_debtNeverExceedsMaxBorrow(uint256 coll, uint256 want) public {
        coll = bound(coll, 1e15, 1_000e18);
        want = bound(want, 1, 100_000e6);
        vm.startPrank(alice);
        core.depositCollateral(address(aapl), coll);
        uint256 cap = core.maxBorrowable(alice, address(aapl));
        if (want > cap || want > core.treasury()) {
            vm.expectRevert();
            core.borrow(address(aapl), want);
        } else {
            core.borrow(address(aapl), want);
            assertLe(core.ltv(alice, address(aapl)), 4000);
        }
        vm.stopPrank();
        uint256 v = core.collateralValue(alice, address(aapl));
        // Exact, with no slack: `borrow` and `maxBorrowable` agree to the unit.
        assertLe(_debt(alice), v * 4000 / 10_000);
    }

    /// @dev The boundary the fuzzer found: flooring in `_ltv` used to let a borrow of
    ///      exactly one unit above `maxBorrowable` through, so the number the protocol
    ///      advertised was not the number it enforced.
    function test_borrow_maxBorrowableIsExactlyTheLimit() public {
        vm.startPrank(alice);
        core.depositCollateral(address(aapl), COLL);
        uint256 cap = core.maxBorrowable(alice, address(aapl));

        vm.expectRevert();
        core.borrow(address(aapl), cap + 1);

        core.borrow(address(aapl), cap);
        assertEq(_debt(alice), cap);
        assertEq(core.maxBorrowable(alice, address(aapl)), 0, "nothing left to borrow");
        vm.stopPrank();
    }

    function testFuzz_repay_debtDecreasesAndNeverGrows(uint256 borrowAmt, uint256 repayAmt, uint32 dt) public {
        borrowAmt = bound(borrowAmt, 100e6, MAX_BORROW);
        repayAmt = bound(repayAmt, 1, borrowAmt * 2);
        _depositAndBorrow(alice, COLL, borrowAmt);
        vm.warp(block.timestamp + bound(uint256(dt), 0, 7 days)); // 7d yield (~43 USDG) < min debt
        uint256 before = _debt(alice);
        vm.prank(alice);
        core.repay(address(aapl), repayAmt);
        uint256 expected = repayAmt >= borrowAmt ? 0 : borrowAmt - repayAmt;
        assertLe(_debt(alice), expected, "yield can only shrink debt further");
        assertLe(_debt(alice), before);
        // paid = min(repayAmt, debt after yield) <= min(repayAmt, borrowAmt)
        assertGe(usdg.balanceOf(alice), borrowAmt - (repayAmt > borrowAmt ? borrowAmt : repayAmt));
    }

    function testFuzz_liquidate_restoresHealth_neverOverSeizes(uint256 priceDrop, uint256 slice) public {
        _depositAndBorrow(alice, COLL, MAX_BORROW);
        // price between 100 and 249 -> unhealthy (capacity 5,000..12,450 < 12,504.8)
        uint256 price = bound(priceDrop, 160e18, 249e18);
        oracle.setPrice(address(aapl), price);
        uint256 maxRepay = core.maxLiquidatable(alice, address(aapl));
        assertGt(maxRepay, 0);
        slice = bound(slice, 1e6, maxRepay);
        uint256 collBefore = _coll(alice);
        vm.prank(liquidator);
        core.liquidate(alice, address(aapl), slice);
        assertLt(_coll(alice), collBefore);
        assertGt(_coll(alice), 0);
        if (slice == maxRepay) assertGe(core.healthFactor(alice, address(aapl)), 1e18);
        vm.prank(liquidator);
        vm.expectRevert();
        core.liquidate(alice, address(aapl), maxRepay); // either healthy now or over-liquidation
    }
}
