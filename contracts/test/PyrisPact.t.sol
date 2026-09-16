// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {PyrisPact} from "../src/PyrisPact.sol";
import {MockERC20} from "./mocks/MockERC20.sol";

contract PyrisPactTest is Test {
    PyrisPact public pactContract;
    MockERC20 public usdc;

    address public client = address(0x1111);
    address public vendor = address(0x2222);
    address public stranger = address(0x3333);

    uint256 public constant INITIAL_BALANCE = 10_000 * 1e6; // 10,000 USDC

    function setUp() public {
        usdc = new MockERC20("USD Coin", "USDC", 6);
        pactContract = new PyrisPact(address(usdc));

        usdc.mint(client, INITIAL_BALANCE);
        vm.prank(client);
        usdc.approve(address(pactContract), type(uint256).max);
    }

    function test_CreatePact_LocksUSDC() public {
        uint256 amount = 1_500 * 1e6;
        uint256 deadline = block.timestamp + 7 days;

        vm.prank(client);
        uint256 pactId = pactContract.createPact(
            vendor,
            amount,
            deadline,
            "Build Landing Page",
            "Next.js landing page with Arc Chain branding"
        );

        assertEq(pactId, 1);
        assertEq(usdc.balanceOf(address(pactContract)), amount);
        assertEq(usdc.balanceOf(client), INITIAL_BALANCE - amount);

        PyrisPact.Pact memory p = pactContract.getPact(pactId);
        assertEq(p.client, client);
        assertEq(p.vendor, vendor);
        assertEq(p.amount, amount);
        assertEq(p.deadline, deadline);
        assertEq(uint256(p.status), uint256(PyrisPact.PactStatus.FUNDED));
        assertEq(p.title, "Build Landing Page");
    }

    function test_SubmitWork_OnlyVendor() public {
        uint256 amount = 1_000 * 1e6;
        uint256 deadline = block.timestamp + 5 days;

        vm.prank(client);
        uint256 pactId = pactContract.createPact(vendor, amount, deadline, "API Integration", "Deliver endpoints");

        // Stranger cannot submit work
        vm.prank(stranger);
        vm.expectRevert(PyrisPact.Unauthorized.selector);
        pactContract.submitWork(pactId, "https://github.com/pull/1");

        // Vendor submits work
        vm.prank(vendor);
        pactContract.submitWork(pactId, "https://github.com/pull/1");

        PyrisPact.Pact memory p = pactContract.getPact(pactId);
        assertEq(uint256(p.status), uint256(PyrisPact.PactStatus.SUBMITTED));
        assertEq(p.submissionNote, "https://github.com/pull/1");
        assertGt(p.submittedAt, 0);
    }

    function test_ReleaseFunds_TransfersToVendor() public {
        uint256 amount = 2_500 * 1e6;
        uint256 deadline = block.timestamp + 10 days;

        vm.prank(client);
        uint256 pactId = pactContract.createPact(vendor, amount, deadline, "Smart Contract Audit", "Full report");

        vm.prank(vendor);
        pactContract.submitWork(pactId, "https://audit.report.pdf");

        // Stranger cannot release funds
        vm.prank(stranger);
        vm.expectRevert(PyrisPact.Unauthorized.selector);
        pactContract.releaseFunds(pactId);

        // Client releases funds
        vm.prank(client);
        pactContract.releaseFunds(pactId);

        assertEq(usdc.balanceOf(vendor), amount);
        assertEq(usdc.balanceOf(address(pactContract)), 0);

        PyrisPact.Pact memory p = pactContract.getPact(pactId);
        assertEq(uint256(p.status), uint256(PyrisPact.PactStatus.RELEASED));
    }

    function test_Refund_AfterDeadlineExpired() public {
        uint256 amount = 500 * 1e6;
        uint256 deadline = block.timestamp + 3 days;

        vm.prank(client);
        uint256 pactId = pactContract.createPact(vendor, amount, deadline, "Icon Design", "10 SVG assets");

        // Client cannot refund before deadline
        vm.prank(client);
        vm.expectRevert(PyrisPact.DeadlineNotPassed.selector);
        pactContract.refund(pactId);

        // Warp time past deadline
        vm.warp(deadline + 1 hours);

        // Client claims refund
        vm.prank(client);
        pactContract.refund(pactId);

        assertEq(usdc.balanceOf(client), INITIAL_BALANCE);
        assertEq(usdc.balanceOf(address(pactContract)), 0);

        PyrisPact.Pact memory p = pactContract.getPact(pactId);
        assertEq(uint256(p.status), uint256(PyrisPact.PactStatus.REFUNDED));
    }

    function test_Refund_VendorVoluntaryCancellation() public {
        uint256 amount = 800 * 1e6;
        uint256 deadline = block.timestamp + 5 days;

        vm.prank(client);
        uint256 pactId = pactContract.createPact(vendor, amount, deadline, "Video Editing", "Promo reel");

        // Vendor voluntarily cancels
        vm.prank(vendor);
        pactContract.refund(pactId);

        assertEq(usdc.balanceOf(client), INITIAL_BALANCE);

        PyrisPact.Pact memory p = pactContract.getPact(pactId);
        assertEq(uint256(p.status), uint256(PyrisPact.PactStatus.REFUNDED));
    }

    function test_Dispute_FlaggedCorrectly() public {
        uint256 amount = 1_200 * 1e6;
        uint256 deadline = block.timestamp + 7 days;

        vm.prank(client);
        uint256 pactId = pactContract.createPact(vendor, amount, deadline, "Backend API", "Rust service");

        vm.prank(vendor);
        pactContract.submitWork(pactId, "Delivery link");

        vm.prank(client);
        pactContract.dispute(pactId, "Incomplete test coverage");

        PyrisPact.Pact memory p = pactContract.getPact(pactId);
        assertEq(uint256(p.status), uint256(PyrisPact.PactStatus.DISPUTED));
    }
}
