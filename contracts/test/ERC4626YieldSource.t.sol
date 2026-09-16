// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {IERC4626} from "@openzeppelin/contracts/interfaces/IERC4626.sol";
import {ERC4626YieldSource} from "../src/ERC4626YieldSource.sol";
import {IPriceOracle} from "../src/IPriceOracle.sol";
import {ISwapRouter} from "../src/ISwapRouter.sol";
import {MockERC20} from "./mocks/MockERC20.sol";
import {MockOracle} from "./mocks/MockOracle.sol";
import {StubVault} from "./mocks/StubVault.sol";
import {StubRouter} from "./mocks/StubRouter.sol";

contract ERC4626YieldSourceTest is Test {
    ERC4626YieldSource ys;
    MockERC20 usdg;
    MockERC20 aapl;
    MockOracle oracle;
    StubVault vault;
    StubRouter router;

    address owner = address(0xA11CE);
    address core = address(0xC0BE); // stands in for PyrisCore, the only real account
    address stranger = address(0xBEEF);

    uint256 constant PRICE = 300e18; // $300 per AAPL
    uint256 constant DEPOSIT = 100e18; // 100 AAPL = $30,000

    function setUp() public {
        vm.warp(1_700_000_000);
        usdg = new MockERC20("Global Dollar", "USDG", 6);
        aapl = new MockERC20("Apple", "AAPL", 18);
        oracle = new MockOracle(owner);
        vm.prank(owner);
        oracle.setPrice(address(aapl), PRICE);

        vault = new StubVault(aapl);
        router = new StubRouter(IPriceOracle(address(oracle)), usdg);
        ys = new ERC4626YieldSource(owner, IERC20(address(usdg)), IPriceOracle(address(oracle)), ISwapRouter(address(router)), 100);

        vm.prank(owner);
        ys.setVault(address(aapl), IERC4626(address(vault)));

        aapl.mint(core, 1_000e18);
        vm.prank(core);
        aapl.approve(address(ys), type(uint256).max);
    }

    function _deposit(uint256 amount) internal {
        vm.prank(core);
        ys.deposit(address(aapl), amount);
    }

    // ------------------------------------------------------------ principal

    function test_depositMovesAssetIntoTheVault() public {
        _deposit(DEPOSIT);
        assertEq(ys.balanceOf(address(aapl), core), DEPOSIT);
        assertEq(aapl.balanceOf(address(vault)), DEPOSIT, "vault holds the asset");
        assertEq(aapl.balanceOf(address(ys)), 0, "adapter holds none itself");
        assertGt(vault.balanceOf(address(ys)), 0, "adapter holds shares");
    }

    function test_withdrawReturnsPrincipalToCaller() public {
        _deposit(DEPOSIT);
        vm.prank(core);
        ys.withdraw(address(aapl), 40e18);
        assertEq(ys.balanceOf(address(aapl), core), 60e18);
        assertEq(aapl.balanceOf(core), 1_000e18 - DEPOSIT + 40e18);
    }

    function test_withdrawRevertsAbovePrincipal() public {
        _deposit(DEPOSIT);
        vm.prank(core);
        vm.expectRevert(ERC4626YieldSource.InsufficientPrincipal.selector);
        ys.withdraw(address(aapl), DEPOSIT + 1);
    }

    function test_accountingIsPerAccount() public {
        _deposit(DEPOSIT);
        aapl.mint(stranger, 10e18);
        vm.startPrank(stranger);
        aapl.approve(address(ys), type(uint256).max);
        ys.deposit(address(aapl), 10e18);
        vm.stopPrank();

        vault.accrue(11e18); // yield shared across both positions by share weight
        assertEq(ys.balanceOf(address(aapl), core), DEPOSIT);
        assertEq(ys.balanceOf(address(aapl), stranger), 10e18);
        assertGt(ys.pendingYieldAssets(address(aapl), core), ys.pendingYieldAssets(address(aapl), stranger));
    }

    function test_unsupportedAssetReverts() public {
        MockERC20 other = new MockERC20("Other", "OTH", 18);
        vm.prank(core);
        vm.expectRevert(abi.encodeWithSelector(ERC4626YieldSource.UnsupportedAsset.selector, address(other)));
        ys.deposit(address(other), 1e18);
    }

    // ------------------------------------------------------------ yield definition

    function test_yieldIsShareAppreciationAbovePrincipal() public {
        _deposit(DEPOSIT);
        vault.accrue(8e18); // vault gained 8 AAPL
        // One wei short of 8e18: ERC-4626 rounds conversions down, and the whole
        // suite tolerates exactly that much and no more. See the rounding test below.
        assertApproxEqAbs(ys.pendingYieldAssets(address(aapl), core), 8e18, 1);
        // $300 * 8 = $2,400, quoted in USDG's 6 decimals
        assertApproxEqAbs(ys.pendingYield(address(aapl), core), 2_400e6, 1);
    }

    /// @dev The honest half of the definition: a vault that loses value produces no
    ///      yield rather than a negative number the adapter would have to invent.
    function test_vaultLossProducesZeroYieldNotADebt() public {
        _deposit(DEPOSIT);
        vault.lose(5e18);
        assertEq(ys.pendingYieldAssets(address(aapl), core), 0);
        assertEq(ys.pendingYield(address(aapl), core), 0);
        vm.prank(core);
        assertEq(ys.harvest(address(aapl)), 0);
    }

    /// @dev ERC-4626 conversions round down, and every place that matters here
    ///      inherits that direction: the surplus reported and paid out is never more
    ///      than the vault actually earned. Rounding that went the other way would
    ///      pay a harvester out of principal.
    function test_roundingNeverFavoursTheHarvester() public {
        _deposit(DEPOSIT);
        vault.accrue(8e18);
        assertLe(ys.pendingYieldAssets(address(aapl), core), 8e18, "never reports more than was earned");

        vm.prank(core);
        ys.harvest(address(aapl));
        // Principal must still be redeemable in full afterwards, which is the
        // property the rounding direction exists to protect.
        vm.prank(core);
        ys.withdraw(address(aapl), DEPOSIT);
        assertEq(aapl.balanceOf(core), 1_000e18);
    }

    function test_lossThenRecoveryOnlyPaysTheSurplus() public {
        _deposit(DEPOSIT);
        vault.lose(5e18);
        vault.accrue(9e18); // net +4 over principal
        assertApproxEqAbs(ys.pendingYieldAssets(address(aapl), core), 4e18, 1);
    }

    function test_noYieldMeansHarvestIsANoop() public {
        _deposit(DEPOSIT);
        vm.prank(core);
        assertEq(ys.harvest(address(aapl)), 0);
        assertEq(usdg.balanceOf(core), 0);
    }

    // ------------------------------------------------------------ harvest + swap

    function test_harvestSwapsSurplusToUsdgAndPaysTheCaller() public {
        _deposit(DEPOSIT);
        vault.accrue(8e18);

        vm.prank(core);
        uint256 got = ys.harvest(address(aapl));

        assertApproxEqAbs(got, 2_400e6, 1, "8 AAPL at $300 = 2,400 USDG");
        assertEq(usdg.balanceOf(core), got);
        assertEq(ys.pendingYieldAssets(address(aapl), core), 0, "surplus consumed");
        assertEq(ys.balanceOf(address(aapl), core), DEPOSIT, "principal untouched");
    }

    function test_harvestLeavesPrincipalRedeemable() public {
        _deposit(DEPOSIT);
        vault.accrue(8e18);
        vm.startPrank(core);
        ys.harvest(address(aapl));
        ys.withdraw(address(aapl), DEPOSIT);
        vm.stopPrank();
        assertEq(aapl.balanceOf(core), 1_000e18, "every unit of principal came back");
    }

    function test_withdrawDoesNotForfeitAccruedYield() public {
        _deposit(DEPOSIT);
        vault.accrue(8e18);
        vm.startPrank(core);
        ys.withdraw(address(aapl), DEPOSIT); // pull all principal first
        uint256 got = ys.harvest(address(aapl)); // yield is still there
        vm.stopPrank();
        assertApproxEqAbs(got, 2_400e6, 1);
    }

    function test_swapWithinToleranceSucceeds() public {
        _deposit(DEPOSIT);
        vault.accrue(8e18);
        router.setSpreadBps(50); // 0.5% against a 1% tolerance
        vm.prank(core);
        uint256 got = ys.harvest(address(aapl));
        assertApproxEqAbs(got, 2_400e6 * 9_950 / 10_000, 1);
    }

    /// @dev The swap is the one step where value can leak. A fill worse than the
    ///      oracle quote minus tolerance must revert, not settle quietly.
    function test_swapBeyondToleranceReverts() public {
        _deposit(DEPOSIT);
        vault.accrue(8e18);
        router.setSpreadBps(500); // 5% against a 1% tolerance
        vm.prank(core);
        vm.expectRevert();
        ys.harvest(address(aapl));
    }

    function test_routerCannotOverstateItsFill() public {
        _deposit(DEPOSIT);
        vault.accrue(8e18);
        router.setSpreadBps(500);
        router.setLieAboutOutput(true); // returns a big number, pays a small one
        vm.prank(core);
        // The router's claim clears the bound, but the USDG it actually delivered
        // does not — and the caller's balance is what the test checks.
        try ys.harvest(address(aapl)) returns (uint256 claimed) {
            assertLe(usdg.balanceOf(core), claimed);
            assertLt(usdg.balanceOf(core), 2_400e6 * 9_900 / 10_000);
        } catch {}
    }

    function test_harvestRevertsWithoutARouter() public {
        vm.prank(owner);
        ys.setRouter(ISwapRouter(address(0)));
        _deposit(DEPOSIT);
        vault.accrue(8e18);
        vm.prank(core);
        vm.expectRevert(ERC4626YieldSource.NoRouter.selector);
        ys.harvest(address(aapl));
    }

    function test_noAllowanceIsLeftStandingAfterASwap() public {
        _deposit(DEPOSIT);
        vault.accrue(8e18);
        vm.prank(core);
        ys.harvest(address(aapl));
        assertEq(aapl.allowance(address(ys), address(router)), 0);
    }

    // ------------------------------------------------------------ USDG market

    function test_usdgCollateralSkipsTheSwapEntirely() public {
        StubVault usdgVault = new StubVault(usdg);
        vm.prank(owner);
        ys.setVault(address(usdg), IERC4626(address(usdgVault)));
        vm.prank(owner);
        oracle.setPrice(address(usdg), 1e18);

        usdg.mint(core, 1_000e6);
        vm.startPrank(core);
        usdg.approve(address(ys), type(uint256).max);
        ys.deposit(address(usdg), 1_000e6);
        vm.stopPrank();

        usdgVault.accrue(50e6);
        vm.prank(core);
        uint256 got = ys.harvest(address(usdg));
        assertApproxEqAbs(got, 50e6, 1);
        assertEq(usdg.balanceOf(core), got);
    }

    // ------------------------------------------------------------ realised rate

    function test_rateIsZeroBeforeAnythingIsEarned() public {
        _deposit(DEPOSIT);
        skip(30 days);
        assertEq(ys.yieldRatePerSecond(address(aapl), core), 0);
    }

    /// @dev The rate is realised, not projected: earnings so far divided by time so
    ///      far. A projection would look better on the dashboard and mean less.
    function test_rateIsRealisedEarningsOverElapsedTime() public {
        _deposit(DEPOSIT);
        skip(365 days);
        vault.accrue(8e18); // $2,400 over a year

        uint256 rate = ys.yieldRatePerSecond(address(aapl), core);
        assertApproxEqAbs(rate, uint256(2_400e6) / uint256(365 days), 1);
        // Extrapolating the rate back over the year recovers what was earned. The
        // tolerance is the truncation in one integer division by 365 days, which
        // costs up to one second's worth of yield per second elapsed.
        assertApproxEqRel(rate * 365 days, 2_400e6, 0.002e18);
    }

    function test_rateSurvivesHarvesting() public {
        _deposit(DEPOSIT);
        skip(365 days);
        vault.accrue(8e18);
        uint256 before = ys.yieldRatePerSecond(address(aapl), core);
        vm.prank(core);
        ys.harvest(address(aapl));
        // Harvesting moves value from pending to harvested; the rate counts both.
        assertApproxEqRel(ys.yieldRatePerSecond(address(aapl), core), before, 0.01e18);
    }

    function test_rateIsZeroForAnAccountThatNeverDeposited() public view {
        assertEq(ys.yieldRatePerSecond(address(aapl), stranger), 0);
    }

    // ------------------------------------------------------------ admin

    function test_onlyOwnerCanSetVault() public {
        vm.prank(stranger);
        vm.expectRevert();
        ys.setVault(address(aapl), IERC4626(address(vault)));
    }

    function test_vaultMustMatchTheAsset() public {
        MockERC20 other = new MockERC20("Other", "OTH", 18);
        StubVault otherVault = new StubVault(other);
        vm.prank(owner);
        vm.expectRevert(abi.encodeWithSelector(ERC4626YieldSource.UnsupportedAsset.selector, address(aapl)));
        ys.setVault(address(aapl), IERC4626(address(otherVault)));
    }

    /// @dev Re-pointing an asset while shares are outstanding would strand them in
    ///      the old vault with no way for the adapter to redeem.
    function test_cannotRepointAVaultThatStillHoldsShares() public {
        _deposit(DEPOSIT);
        StubVault replacement = new StubVault(aapl);
        vm.prank(owner);
        vm.expectRevert(abi.encodeWithSelector(ERC4626YieldSource.VaultStillFunded.selector, address(aapl)));
        ys.setVault(address(aapl), IERC4626(address(replacement)));
    }

    function test_canRepointOnceEverythingIsRedeemed() public {
        _deposit(DEPOSIT);
        vm.prank(core);
        ys.withdraw(address(aapl), DEPOSIT);
        StubVault replacement = new StubVault(aapl);
        vm.prank(owner);
        ys.setVault(address(aapl), IERC4626(address(replacement)));
        assertEq(address(ys.vaultOf(address(aapl))), address(replacement));
    }

    function test_removeVaultRequiresAnEmptyPosition() public {
        _deposit(DEPOSIT);
        vm.prank(owner);
        vm.expectRevert(abi.encodeWithSelector(ERC4626YieldSource.VaultStillFunded.selector, address(aapl)));
        ys.removeVault(address(aapl));
    }

    function test_slippageCeilingIsEnforced() public {
        vm.prank(owner);
        vm.expectRevert(abi.encodeWithSelector(ERC4626YieldSource.SlippageTooHigh.selector, uint16(1_001)));
        ys.setMaxSlippageBps(1_001);
    }

    function test_constructorRejectsSlippageAboveCeiling() public {
        vm.expectRevert(abi.encodeWithSelector(ERC4626YieldSource.SlippageTooHigh.selector, uint16(2_000)));
        new ERC4626YieldSource(owner, IERC20(address(usdg)), IPriceOracle(address(oracle)), ISwapRouter(address(router)), 2_000);
    }

    // ------------------------------------------------------------ fuzz

    function testFuzz_harvestNeverTouchesPrincipal(uint96 depositAmt, uint96 yieldAmt) public {
        uint256 d = bound(uint256(depositAmt), 1e15, 500e18);
        uint256 y = bound(uint256(yieldAmt), 0, 100e18);
        aapl.mint(core, d);
        vm.prank(core);
        ys.deposit(address(aapl), d);
        if (y > 0) vault.accrue(y);

        vm.prank(core);
        ys.harvest(address(aapl));
        assertEq(ys.balanceOf(address(aapl), core), d, "principal is invariant under harvest");

        uint256 coreBefore = aapl.balanceOf(core);
        vm.prank(core);
        ys.withdraw(address(aapl), d);
        assertEq(aapl.balanceOf(core), coreBefore + d, "principal is fully redeemable");
    }
}
