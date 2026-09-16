// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/**
 * @title PyrisPact
 * @notice Programmable B2B Escrow & Milestone Payments on Arc Chain.
 *         Enables businesses, agencies, and global contractors to lock USDC into
 *         trustless milestone escrows that disburse immediately upon client approval.
 * @dev Arc Chain features native USDC gas fees, enabling end-to-end USDC accounting.
 *      This contract supports standard ERC-20 USDC as well as native asset transfers.
 */

interface IERC20 {
    function transfer(address to, uint256 amount) external returns (bool);
    function transferFrom(address from, address to, uint256 amount) external returns (bool);
    function balanceOf(address account) external view returns (uint256);
}

contract PyrisPact {
    enum PactStatus {
        FUNDED,      // 0: Client deposited USDC into escrow
        SUBMITTED,   // 1: Contractor delivered work / submitted link
        RELEASED,    // 2: Client approved; USDC disbursed to contractor
        REFUNDED,    // 3: Refunded to client (expired or contractor canceled)
        DISPUTED     // 4: Under dispute review
    }

    struct Pact {
        uint256 id;
        address client;
        address vendor;
        uint256 amount;
        uint256 deadline;
        PactStatus status;
        string title;
        string description;
        string submissionNote;
        uint256 createdAt;
        uint256 submittedAt;
    }

    /// @notice Address of canonical USDC token (optional if using native USDC)
    IERC20 public immutable usdcToken;

    /// @notice Total count of pacts created
    uint256 public pactCount;

    /// @notice Pact storage by ID
    mapping(uint256 => Pact) public pacts;

    /// @notice Index of pacts created by a client
    mapping(address => uint256[]) private _clientPacts;

    /// @notice Index of pacts assigned to a vendor
    mapping(address => uint256[]) private _vendorPacts;

    // Events
    event PactCreated(
        uint256 indexed pactId,
        address indexed client,
        address indexed vendor,
        uint256 amount,
        uint256 deadline,
        string title
    );
    event WorkSubmitted(uint256 indexed pactId, string submissionNote, uint256 timestamp);
    event PactReleased(uint256 indexed pactId, address indexed vendor, uint256 amount);
    event PactRefunded(uint256 indexed pactId, address indexed client, uint256 amount);
    event PactDisputed(uint256 indexed pactId, address indexed initiator, string reason);

    // Custom Errors
    error InvalidAmount();
    error InvalidVendor();
    error InvalidDeadline();
    error PactNotFound();
    error Unauthorized();
    error InvalidState(PactStatus current, PactStatus expected);
    error DeadlineNotPassed();
    error TransferFailed();

    /**
     * @param _usdcToken Canonical USDC address on Arc Chain (or address(0) for native mode)
     */
    constructor(address _usdcToken) {
        usdcToken = IERC20(_usdcToken);
    }

    /**
     * @notice Create and fund a new escrow pact in USDC
     * @param vendor The contractor/agency receiving payment upon completion
     * @param amount The milestone payment amount (in USDC units, e.g. 6 decimals)
     * @param deadline Unix timestamp before which deliverables must be submitted
     * @param title Short deliverable title
     * @param description Scope of work or reference specification link
     * @return pactId The unique ID of the created pact
     */
    function createPact(
        address vendor,
        uint256 amount,
        uint256 deadline,
        string calldata title,
        string calldata description
    ) external payable returns (uint256 pactId) {
        if (amount == 0) revert InvalidAmount();
        if (vendor == address(0) || vendor == msg.sender) revert InvalidVendor();
        if (deadline <= block.timestamp) revert InvalidDeadline();

        // Transfer funds into escrow
        if (address(usdcToken) != address(0)) {
            bool ok = usdcToken.transferFrom(msg.sender, address(this), amount);
            if (!ok) revert TransferFailed();
        } else {
            if (msg.value != amount) revert InvalidAmount();
        }

        unchecked {
            pactId = ++pactCount;
        }

        pacts[pactId] = Pact({
            id: pactId,
            client: msg.sender,
            vendor: vendor,
            amount: amount,
            deadline: deadline,
            status: PactStatus.FUNDED,
            title: title,
            description: description,
            submissionNote: "",
            createdAt: block.timestamp,
            submittedAt: 0
        });

        _clientPacts[msg.sender].push(pactId);
        _vendorPacts[vendor].push(pactId);

        emit PactCreated(pactId, msg.sender, vendor, amount, deadline, title);
    }

    /**
     * @notice Contractor submits completed deliverable / proof link for review
     * @param pactId The pact ID
     * @param submissionNote Link to PR, Figma, report, or deliverable notes
     */
    function submitWork(uint256 pactId, string calldata submissionNote) external {
        Pact storage pact = pacts[pactId];
        if (pact.id == 0) revert PactNotFound();
        if (msg.sender != pact.vendor) revert Unauthorized();
        if (pact.status != PactStatus.FUNDED) {
            revert InvalidState(pact.status, PactStatus.FUNDED);
        }

        pact.status = PactStatus.SUBMITTED;
        pact.submittedAt = block.timestamp;
        pact.submissionNote = submissionNote;

        emit WorkSubmitted(pactId, submissionNote, block.timestamp);
    }

    /**
     * @notice Client approves deliverable and releases escrowed USDC to the contractor
     * @param pactId The pact ID
     */
    function releaseFunds(uint256 pactId) external {
        Pact storage pact = pacts[pactId];
        if (pact.id == 0) revert PactNotFound();
        if (msg.sender != pact.client) revert Unauthorized();
        if (pact.status != PactStatus.FUNDED && pact.status != PactStatus.SUBMITTED) {
            revert InvalidState(pact.status, PactStatus.SUBMITTED);
        }

        pact.status = PactStatus.RELEASED;
        uint256 amount = pact.amount;

        _disburse(pact.vendor, amount);

        emit PactReleased(pactId, pact.vendor, amount);
    }

    /**
     * @notice Claim refund of escrowed USDC
     *         - Client can claim if deadline passed without submission
     *         - Contractor can decline/cancel at any time, instantly refunding client
     * @param pactId The pact ID
     */
    function refund(uint256 pactId) external {
        Pact storage pact = pacts[pactId];
        if (pact.id == 0) revert PactNotFound();

        if (msg.sender == pact.client) {
            // Client can refund only if deadline expired and work was never submitted
            if (pact.status != PactStatus.FUNDED) {
                revert InvalidState(pact.status, PactStatus.FUNDED);
            }
            if (block.timestamp <= pact.deadline) {
                revert DeadlineNotPassed();
            }
        } else if (msg.sender == pact.vendor) {
            // Contractor can voluntarily release refund back to client
            if (pact.status != PactStatus.FUNDED && pact.status != PactStatus.SUBMITTED) {
                revert InvalidState(pact.status, PactStatus.FUNDED);
            }
        } else {
            revert Unauthorized();
        }

        pact.status = PactStatus.REFUNDED;
        uint256 amount = pact.amount;

        _disburse(pact.client, amount);

        emit PactRefunded(pactId, pact.client, amount);
    }

    /**
     * @notice Flag a pact as disputed if mutual agreement cannot be reached
     * @param pactId The pact ID
     * @param reason Description of the dispute
     */
    function dispute(uint256 pactId, string calldata reason) external {
        Pact storage pact = pacts[pactId];
        if (pact.id == 0) revert PactNotFound();
        if (msg.sender != pact.client && msg.sender != pact.vendor) revert Unauthorized();
        if (pact.status != PactStatus.FUNDED && pact.status != PactStatus.SUBMITTED) {
            revert InvalidState(pact.status, PactStatus.SUBMITTED);
        }

        pact.status = PactStatus.DISPUTED;
        emit PactDisputed(pactId, msg.sender, reason);
    }

    // View Helpers

    function getPact(uint256 pactId) external view returns (Pact memory) {
        if (pacts[pactId].id == 0) revert PactNotFound();
        return pacts[pactId];
    }

    function getClientPacts(address client) external view returns (uint256[] memory) {
        return _clientPacts[client];
    }

    function getVendorPacts(address vendor) external view returns (uint256[] memory) {
        return _vendorPacts[vendor];
    }

    function getPacts(uint256 offset, uint256 limit) external view returns (Pact[] memory list) {
        if (offset >= pactCount || limit == 0) {
            return new Pact[](0);
        }
        uint256 end = offset + limit;
        if (end > pactCount) {
            end = pactCount;
        }
        uint256 count = end - offset;
        list = new Pact[](count);
        for (uint256 i = 0; i < count; i++) {
            list[i] = pacts[offset + i + 1];
        }
    }

    // Internal Disburse
    function _disburse(address to, uint256 amount) internal {
        if (address(usdcToken) != address(0)) {
            bool ok = usdcToken.transfer(to, amount);
            if (!ok) revert TransferFailed();
        } else {
            (bool success, ) = to.call{value: amount}("");
            if (!success) revert TransferFailed();
        }
    }

    receive() external payable {}
}
