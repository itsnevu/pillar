// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {PyrisPact} from "../src/PyrisPact.sol";
import {MockERC20} from "./mocks/MockERC20.sol";

/// @dev Recipient that refuses native value, to exercise the pull-payment fallback.
contract RejectingReceiver {
    receive() external payable {
        revert("no");
    }

    function claim(PyrisPact p) external {
        p.withdraw();
    }
}

/// @dev Recipient that tries to reenter releaseFunds during payout.
contract Reenterer {
    PyrisPact public pact;
    uint256 public pactId;
    bool public reentered;

    receive() external payable {
        if (!reentered) {
            reentered = true;
            try pact.releaseFunds(pactId) {} catch {}
        }
    }

    function set(PyrisPact p, uint256 id) external {
        pact = p;
        pactId = id;
    }
}

contract PyrisPactTest is Test {
    PyrisPact public native; // native-value mode, as deployed on Arc
    PyrisPact public token; // ERC-20 mode
    MockERC20 public usdc;

    address public client = makeAddr("client");
    address public vendor = makeAddr("vendor");
    address public arbiter = makeAddr("arbiter");
    address public stranger = makeAddr("stranger");

    uint256 constant AMOUNT = 1_000 ether; // 1,000 USDC at 18 decimals (native mode)
    uint256 constant TOKEN_AMOUNT = 1_000 * 1e6;
    uint256 deadline;

    function setUp() public {
        native = new PyrisPact(address(0));
        usdc = new MockERC20("USD Coin", "USDC", 6);
        token = new PyrisPact(address(usdc));

        deadline = block.timestamp + 7 days;
        vm.deal(client, 100_000 ether);
        usdc.mint(client, 100_000 * 1e6);
        vm.prank(client);
        usdc.approve(address(token), type(uint256).max);
    }

    // ----------------------------------------------------------- helpers

    function _create(address arb) internal returns (uint256 id) {
        vm.prank(client);
        id = native.createPact{value: AMOUNT}(vendor, arb, AMOUNT, deadline, "Milestone 1", "Spec");
    }

    function _createSubmitted(address arb) internal returns (uint256 id) {
        id = _create(arb);
        vm.prank(vendor);
        native.submitWork(id, "https://example.com/pr/1");
    }

    function _createDisputed(address arb) internal returns (uint256 id) {
        id = _createSubmitted(arb);
        vm.prank(client);
        native.dispute(id, "scope mismatch");
    }

    // ------------------------------------------------------------ create

    function test_create_native_locksValue() public {
        uint256 id = _create(address(0));
        PyrisPact.Pact memory p = native.getPact(id);
        assertEq(id, 1);
        assertEq(p.client, client);
        assertEq(p.vendor, vendor);
        assertEq(p.amount, AMOUNT);
        assertEq(uint256(p.status), uint256(PyrisPact.PactStatus.FUNDED));
        assertEq(address(native).balance, AMOUNT);
        assertEq(native.getClientPacts(client).length, 1);
        assertEq(native.getVendorPacts(vendor).length, 1);
    }

    function test_create_native_rejectsValueMismatch() public {
        vm.prank(client);
        vm.expectRevert(PyrisPact.InvalidAmount.selector);
        native.createPact{value: AMOUNT - 1}(vendor, address(0), AMOUNT, deadline, "t", "d");
    }

    function test_create_token_pullsUsdc_andRejectsValue() public {
        vm.prank(client);
        uint256 id = token.createPact(vendor, address(0), TOKEN_AMOUNT, deadline, "t", "d");
        assertEq(usdc.balanceOf(address(token)), TOKEN_AMOUNT);
        assertEq(token.getPact(id).amount, TOKEN_AMOUNT);

        vm.deal(client, 1 ether);
        vm.prank(client);
        vm.expectRevert(PyrisPact.UnexpectedValue.selector);
        token.createPact{value: 1}(vendor, address(0), TOKEN_AMOUNT, deadline, "t", "d");
    }

    function test_create_rejectsBadParties() public {
        vm.startPrank(client);
        vm.expectRevert(PyrisPact.InvalidVendor.selector);
        native.createPact{value: AMOUNT}(client, address(0), AMOUNT, deadline, "t", "d");
        vm.expectRevert(PyrisPact.InvalidVendor.selector);
        native.createPact{value: AMOUNT}(address(0), address(0), AMOUNT, deadline, "t", "d");
        vm.expectRevert(PyrisPact.InvalidArbiter.selector);
        native.createPact{value: AMOUNT}(vendor, vendor, AMOUNT, deadline, "t", "d");
        vm.expectRevert(PyrisPact.InvalidArbiter.selector);
        native.createPact{value: AMOUNT}(vendor, client, AMOUNT, deadline, "t", "d");
        vm.expectRevert(PyrisPact.InvalidDeadline.selector);
        native.createPact{value: AMOUNT}(vendor, address(0), AMOUNT, block.timestamp, "t", "d");
        vm.stopPrank();
    }

    function test_create_rejectsOversizedText() public {
        string memory big = new string(129);
        vm.prank(client);
        vm.expectRevert(PyrisPact.TextTooLong.selector);
        native.createPact{value: AMOUNT}(vendor, address(0), AMOUNT, deadline, big, "d");
    }

    function test_noReceive_rejectsStrayValue() public {
        vm.prank(client);
        (bool ok,) = address(native).call{value: 1 ether}("");
        assertFalse(ok);
    }

    // ------------------------------------------------------------ submit

    function test_submit_onlyVendor_beforeDeadline() public {
        uint256 id = _create(address(0));
        vm.prank(stranger);
        vm.expectRevert(PyrisPact.Unauthorized.selector);
        native.submitWork(id, "x");

        vm.prank(vendor);
        native.submitWork(id, "https://example.com/pr/1");
        PyrisPact.Pact memory p = native.getPact(id);
        assertEq(uint256(p.status), uint256(PyrisPact.PactStatus.SUBMITTED));
        assertEq(p.submissionNote, "https://example.com/pr/1");
        assertEq(p.submittedAt, block.timestamp);
    }

    /// v1 bug: vendor could submit after the deadline and trap the client's refund.
    function test_submit_rejectedAfterDeadline_clientCanStillRefund() public {
        uint256 id = _create(address(0));
        vm.warp(deadline + 1);

        vm.prank(vendor);
        vm.expectRevert(PyrisPact.DeadlinePassed.selector);
        native.submitWork(id, "late");

        uint256 before = client.balance;
        vm.prank(client);
        native.refund(id);
        assertEq(client.balance - before, AMOUNT);
    }

    function test_extendDeadline_clientOnly_forwardOnly_thenSubmitAllowed() public {
        uint256 id = _create(address(0));
        vm.prank(vendor);
        vm.expectRevert(PyrisPact.Unauthorized.selector);
        native.extendDeadline(id, deadline + 1 days);

        vm.prank(client);
        vm.expectRevert(PyrisPact.InvalidDeadline.selector);
        native.extendDeadline(id, deadline - 1);

        vm.prank(client);
        native.extendDeadline(id, deadline + 3 days);
        vm.warp(deadline + 1 days);
        vm.prank(vendor);
        native.submitWork(id, "on time after extension");
        assertEq(uint256(native.getPact(id).status), uint256(PyrisPact.PactStatus.SUBMITTED));
    }

    // ----------------------------------------------------------- release

    function test_release_paysVendor_fromFundedOrSubmitted() public {
        uint256 a = _create(address(0));
        uint256 b = _createSubmitted(address(0));
        uint256 before = vendor.balance;

        vm.startPrank(client);
        native.releaseFunds(a);
        native.releaseFunds(b);
        vm.stopPrank();

        assertEq(vendor.balance - before, 2 * AMOUNT);
        assertEq(uint256(native.getPact(a).status), uint256(PyrisPact.PactStatus.RELEASED));
        assertEq(address(native).balance, 0);
    }

    function test_release_onlyClient_onlyOnce() public {
        uint256 id = _createSubmitted(address(0));
        vm.prank(vendor);
        vm.expectRevert(PyrisPact.Unauthorized.selector);
        native.releaseFunds(id);

        vm.prank(client);
        native.releaseFunds(id);
        vm.prank(client);
        vm.expectRevert(abi.encodeWithSelector(PyrisPact.InvalidState.selector, PyrisPact.PactStatus.RELEASED));
        native.releaseFunds(id);
    }

    function test_release_token_mode() public {
        vm.prank(client);
        uint256 id = token.createPact(vendor, address(0), TOKEN_AMOUNT, deadline, "t", "d");
        vm.prank(client);
        token.releaseFunds(id);
        assertEq(usdc.balanceOf(vendor), TOKEN_AMOUNT);
    }

    // ------------------------------------------------------------ refund

    function test_refund_client_requiresDeadline_andFundedState() public {
        uint256 id = _create(address(0));
        vm.prank(client);
        vm.expectRevert(PyrisPact.DeadlineNotPassed.selector);
        native.refund(id);

        uint256 sub = _createSubmitted(address(0));
        vm.warp(deadline + 1);
        vm.prank(client);
        vm.expectRevert(abi.encodeWithSelector(PyrisPact.InvalidState.selector, PyrisPact.PactStatus.SUBMITTED));
        native.refund(sub);
    }

    function test_refund_vendorCancels_fromSubmitted() public {
        uint256 id = _createSubmitted(address(0));
        uint256 before = client.balance;
        vm.prank(vendor);
        native.refund(id);
        assertEq(client.balance - before, AMOUNT);
        assertEq(uint256(native.getPact(id).status), uint256(PyrisPact.PactStatus.REFUNDED));
    }

    function test_refund_strangerRejected() public {
        uint256 id = _create(address(0));
        vm.prank(stranger);
        vm.expectRevert(PyrisPact.Unauthorized.selector);
        native.refund(id);
    }

    // ----------------------------------------------------------- dispute

    function test_dispute_freezesEverything() public {
        uint256 id = _createDisputed(address(0));
        assertEq(uint256(native.getPact(id).status), uint256(PyrisPact.PactStatus.DISPUTED));
        assertEq(native.getPact(id).disputedAt, block.timestamp);

        bytes memory err = abi.encodeWithSelector(PyrisPact.InvalidState.selector, PyrisPact.PactStatus.DISPUTED);
        vm.prank(client);
        vm.expectRevert(err);
        native.releaseFunds(id);
        vm.prank(vendor);
        vm.expectRevert(err);
        native.refund(id);
        vm.warp(deadline + 1);
        vm.prank(client);
        vm.expectRevert(err);
        native.refund(id);
    }

    function test_dispute_onlyParties_onlyActive() public {
        uint256 id = _create(address(0));
        vm.prank(stranger);
        vm.expectRevert(PyrisPact.Unauthorized.selector);
        native.dispute(id, "x");

        vm.prank(client);
        native.releaseFunds(id);
        vm.prank(vendor);
        vm.expectRevert(abi.encodeWithSelector(PyrisPact.InvalidState.selector, PyrisPact.PactStatus.RELEASED));
        native.dispute(id, "x");
    }

    // -------------------------------------------------------- resolution

    function test_resolution_mutualAgreement_splitsFunds() public {
        uint256 id = _createDisputed(address(0));
        uint256 cBefore = client.balance;
        uint256 vBefore = vendor.balance;

        vm.prank(vendor);
        native.proposeResolution(id, 6_000); // vendor asks 60%
        assertEq(uint256(native.getPact(id).status), uint256(PyrisPact.PactStatus.DISPUTED));

        vm.prank(client);
        native.proposeResolution(id, 6_000); // client agrees

        PyrisPact.Pact memory p = native.getPact(id);
        assertEq(uint256(p.status), uint256(PyrisPact.PactStatus.RESOLVED));
        assertEq(p.vendorShareBps, 6_000);
        assertEq(vendor.balance - vBefore, AMOUNT * 6_000 / 10_000);
        assertEq(client.balance - cBefore, AMOUNT * 4_000 / 10_000);
        assertEq(address(native).balance, 0);
    }

    function test_resolution_counterProposalReplaces_sameSideDoesNotSettle() public {
        uint256 id = _createDisputed(address(0));

        vm.prank(vendor);
        native.proposeResolution(id, 8_000);
        vm.prank(vendor);
        native.proposeResolution(id, 8_000); // same party repeating must not settle
        assertEq(uint256(native.getPact(id).status), uint256(PyrisPact.PactStatus.DISPUTED));

        vm.prank(client);
        native.proposeResolution(id, 5_000); // counter-offer replaces
        (address proposer, uint16 bps) = native.proposals(id);
        assertEq(proposer, client);
        assertEq(bps, 5_000);

        vm.prank(vendor);
        native.proposeResolution(id, 5_000); // vendor accepts counter
        assertEq(uint256(native.getPact(id).status), uint256(PyrisPact.PactStatus.RESOLVED));
        (proposer,) = native.proposals(id);
        assertEq(proposer, address(0));
    }

    function test_resolution_rejectsBadShare_andNonDisputed() public {
        uint256 id = _createDisputed(address(0));
        vm.prank(client);
        vm.expectRevert(PyrisPact.InvalidShare.selector);
        native.proposeResolution(id, 10_001);

        uint256 live = _create(address(0));
        vm.prank(client);
        vm.expectRevert(abi.encodeWithSelector(PyrisPact.InvalidState.selector, PyrisPact.PactStatus.FUNDED));
        native.proposeResolution(live, 5_000);
    }

    function test_arbiter_rules_whenSet() public {
        uint256 id = _createDisputed(arbiter);
        vm.prank(stranger);
        vm.expectRevert(PyrisPact.Unauthorized.selector);
        native.arbitrate(id, 0);

        uint256 cBefore = client.balance;
        vm.prank(arbiter);
        native.arbitrate(id, 0); // full refund to client
        assertEq(client.balance - cBefore, AMOUNT);
        assertEq(uint256(native.getPact(id).status), uint256(PyrisPact.PactStatus.RESOLVED));
    }

    function test_arbiter_absent_cannotArbitrate() public {
        uint256 id = _createDisputed(address(0));
        vm.prank(arbiter);
        vm.expectRevert(PyrisPact.Unauthorized.selector);
        native.arbitrate(id, 5_000);
    }

    // ----------------------------------------------------- pull payments

    function test_payoutDeferred_whenRecipientRejects_thenWithdraw() public {
        RejectingReceiver r = new RejectingReceiver();
        vm.prank(client);
        uint256 id = native.createPact{value: AMOUNT}(address(r), address(0), AMOUNT, deadline, "t", "d");

        vm.prank(client);
        native.releaseFunds(id); // must not revert
        assertEq(uint256(native.getPact(id).status), uint256(PyrisPact.PactStatus.RELEASED));
        assertEq(native.pendingWithdrawals(address(r)), AMOUNT);
        assertEq(address(native).balance, AMOUNT);

        // still rejects on pull: revert, balance kept
        vm.expectRevert(PyrisPact.TransferFailed.selector);
        r.claim(native);
        assertEq(native.pendingWithdrawals(address(r)), AMOUNT);
    }

    function test_withdraw_nothing_reverts() public {
        vm.prank(stranger);
        vm.expectRevert(PyrisPact.NothingToWithdraw.selector);
        native.withdraw();
    }

    function test_reentrancy_blocked() public {
        Reenterer r = new Reenterer();
        vm.prank(client);
        uint256 id = native.createPact{value: AMOUNT}(address(r), address(0), AMOUNT, deadline, "t", "d");
        r.set(native, id);

        vm.prank(client);
        native.releaseFunds(id);
        assertTrue(r.reentered());
        assertEq(address(r).balance, AMOUNT); // paid exactly once
        assertEq(address(native).balance, 0);
    }

    // ------------------------------------------------------------- views

    function test_getPacts_pagination() public {
        _create(address(0));
        _create(address(0));
        _create(address(0));
        assertEq(native.getPacts(0, 50).length, 3);
        assertEq(native.getPacts(1, 1).length, 1);
        assertEq(native.getPacts(1, 1)[0].id, 2);
        assertEq(native.getPacts(3, 1).length, 0);
        assertEq(native.getPacts(0, 0).length, 0);
    }

    function test_getPact_missing_reverts() public {
        vm.expectRevert(PyrisPact.PactNotFound.selector);
        native.getPact(99);
    }
}
