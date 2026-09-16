// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/**
 * @title PyrisPact
 * @notice Programmable B2B Escrow & Milestone Payments on Arc Chain.
 *         A client locks USDC into a milestone escrow, the contractor submits proof
 *         of delivery onchain, and the client releases the funds. Neither party, nor
 *         the deployer, can move escrowed funds outside the state machine below.
 *
 * @dev Arc Chain settles gas in native USDC, so the contract runs in one of two modes
 *      fixed at deployment: native mode (usdcToken == address(0), amounts are msg.value)
 *      or ERC-20 mode (amounts are pulled with transferFrom). Amount decimals follow
 *      the mode: 18 for native value, the token's own decimals for ERC-20.
 *
 *      State machine:
 *        FUNDED    --submitWork (before deadline)--> SUBMITTED
 *        FUNDED    --refund by client (after deadline)--> REFUNDED
 *        FUNDED | SUBMITTED --releaseFunds by client--> RELEASED
 *        FUNDED | SUBMITTED --refund by vendor--> REFUNDED
 *        FUNDED | SUBMITTED --dispute by either--> DISPUTED
 *        DISPUTED  --both parties agree on a split, or the arbiter rules--> RESOLVED
 *
 *      Hardening over v1:
 *        - submitWork rejects late submissions, so a vendor cannot front-run the client's
 *          refund after the deadline and trap the funds in SUBMITTED.
 *        - DISPUTED is no longer terminal: a mutual split proposal or an optional
 *          per-pact arbiter can settle it.
 *        - Payouts that fail (recipient contract rejects value) are credited to
 *          pendingWithdrawals instead of reverting, so no counterparty can block settlement.
 *        - Reentrancy guard on every value-moving function; string inputs are bounded.
 *        - No receive(): stray value cannot be sent to the contract and lost.
 */

interface IERC20 {
    function transfer(address to, uint256 amount) external returns (bool);
    function transferFrom(address from, address to, uint256 amount) external returns (bool);
}

contract PyrisPact {
    // ------------------------------------------------------------------ types

    enum PactStatus {
        FUNDED,      // 0: client deposited into escrow
        SUBMITTED,   // 1: contractor submitted deliverable
        RELEASED,    // 2: client approved; full amount to contractor
        REFUNDED,    // 3: full amount back to client (expired or contractor cancelled)
        DISPUTED,    // 4: flagged; awaiting mutual split or arbiter ruling
        RESOLVED     // 5: dispute settled; amount split per agreed basis points
    }

    struct Pact {
        uint256 id;
        address client;
        address vendor;
        address arbiter;        // optional; address(0) means mutual resolution only
        uint256 amount;
        uint256 deadline;
        PactStatus status;
        string title;
        string description;
        string submissionNote;
        uint256 createdAt;
        uint256 submittedAt;
        uint256 disputedAt;
        uint16 vendorShareBps;  // set on RESOLVED: share of amount paid to vendor
    }

    /// @dev A pending split proposal for a disputed pact. Accepted when the counterparty
    ///      submits an identical vendorShareBps.
    struct Proposal {
        address proposer;
        uint16 vendorShareBps;
    }

    // -------------------------------------------------------------- constants

    uint16 public constant BPS = 10_000;
    uint256 public constant MAX_TITLE_BYTES = 128;
    uint256 public constant MAX_TEXT_BYTES = 2_048;

    // ---------------------------------------------------------------- storage

    /// @notice ERC-20 USDC address, or address(0) for native mode.
    IERC20 public immutable usdcToken;

    /// @notice Total pacts created; ids are 1..pactCount.
    uint256 public pactCount;

    mapping(uint256 => Pact) internal _pacts;
    mapping(uint256 => Proposal) public proposals;
    mapping(address => uint256[]) private _clientPacts;
    mapping(address => uint256[]) private _vendorPacts;

    /// @notice Amounts owed to recipients whose push payment failed. Claim with withdraw().
    mapping(address => uint256) public pendingWithdrawals;

    uint256 private _lock = 1;

    // ----------------------------------------------------------------- events

    event PactCreated(
        uint256 indexed pactId,
        address indexed client,
        address indexed vendor,
        address arbiter,
        uint256 amount,
        uint256 deadline,
        string title
    );
    event DeadlineExtended(uint256 indexed pactId, uint256 oldDeadline, uint256 newDeadline);
    event WorkSubmitted(uint256 indexed pactId, string submissionNote, uint256 timestamp);
    event PactReleased(uint256 indexed pactId, address indexed vendor, uint256 amount);
    event PactRefunded(uint256 indexed pactId, address indexed client, uint256 amount);
    event PactDisputed(uint256 indexed pactId, address indexed initiator, string reason);
    event ResolutionProposed(uint256 indexed pactId, address indexed proposer, uint16 vendorShareBps);
    event PactResolved(
        uint256 indexed pactId,
        address indexed resolver,
        uint16 vendorShareBps,
        uint256 vendorAmount,
        uint256 clientAmount
    );
    event PayoutDeferred(address indexed to, uint256 amount);
    event Withdrawn(address indexed to, uint256 amount);

    // ----------------------------------------------------------------- errors

    error InvalidAmount();
    error InvalidVendor();
    error InvalidArbiter();
    error InvalidDeadline();
    error InvalidShare();
    error TextTooLong();
    error PactNotFound();
    error Unauthorized();
    error InvalidState(PactStatus current);
    error DeadlineNotPassed();
    error DeadlinePassed();
    error UnexpectedValue();
    error TransferFailed();
    error NothingToWithdraw();
    error Reentrancy();

    // -------------------------------------------------------------- modifiers

    modifier nonReentrant() {
        if (_lock != 1) revert Reentrancy();
        _lock = 2;
        _;
        _lock = 1;
    }

    // ------------------------------------------------------------ constructor

    /// @param _usdcToken ERC-20 USDC address, or address(0) to escrow native value.
    constructor(address _usdcToken) {
        usdcToken = IERC20(_usdcToken);
    }

    // --------------------------------------------------------------- lifecycle

    /**
     * @notice Create and fund a milestone escrow.
     * @param vendor      Contractor paid on release. Must not be the caller.
     * @param arbiter     Optional third party who may rule on a dispute. address(0) for none.
     * @param amount      Escrowed amount. Native mode: must equal msg.value (18 decimals).
     * @param deadline    Unix time by which the vendor must submit.
     * @param title       Short deliverable title (<= 128 bytes).
     * @param description Scope or spec link (<= 2048 bytes).
     */
    function createPact(
        address vendor,
        address arbiter,
        uint256 amount,
        uint256 deadline,
        string calldata title,
        string calldata description
    ) external payable nonReentrant returns (uint256 pactId) {
        if (amount == 0) revert InvalidAmount();
        if (vendor == address(0) || vendor == msg.sender) revert InvalidVendor();
        if (arbiter == msg.sender || arbiter == vendor) revert InvalidArbiter();
        if (deadline <= block.timestamp) revert InvalidDeadline();
        if (bytes(title).length > MAX_TITLE_BYTES || bytes(description).length > MAX_TEXT_BYTES) {
            revert TextTooLong();
        }

        if (address(usdcToken) == address(0)) {
            if (msg.value != amount) revert InvalidAmount();
        } else {
            if (msg.value != 0) revert UnexpectedValue();
            if (!usdcToken.transferFrom(msg.sender, address(this), amount)) revert TransferFailed();
        }

        unchecked {
            pactId = ++pactCount;
        }

        Pact storage p = _pacts[pactId];
        p.id = pactId;
        p.client = msg.sender;
        p.vendor = vendor;
        p.arbiter = arbiter;
        p.amount = amount;
        p.deadline = deadline;
        p.status = PactStatus.FUNDED;
        p.title = title;
        p.description = description;
        p.createdAt = block.timestamp;

        _clientPacts[msg.sender].push(pactId);
        _vendorPacts[vendor].push(pactId);

        emit PactCreated(pactId, msg.sender, vendor, arbiter, amount, deadline, title);
    }

    /// @notice Client grants the vendor more time. Only while FUNDED; only forward.
    function extendDeadline(uint256 pactId, uint256 newDeadline) external {
        Pact storage p = _get(pactId);
        if (msg.sender != p.client) revert Unauthorized();
        if (p.status != PactStatus.FUNDED) revert InvalidState(p.status);
        if (newDeadline <= p.deadline || newDeadline <= block.timestamp) revert InvalidDeadline();

        emit DeadlineExtended(pactId, p.deadline, newDeadline);
        p.deadline = newDeadline;
    }

    /// @notice Vendor records proof of delivery. Rejected after the deadline so the
    ///         client's refund right cannot be front-run.
    function submitWork(uint256 pactId, string calldata submissionNote) external {
        Pact storage p = _get(pactId);
        if (msg.sender != p.vendor) revert Unauthorized();
        if (p.status != PactStatus.FUNDED) revert InvalidState(p.status);
        if (block.timestamp > p.deadline) revert DeadlinePassed();
        if (bytes(submissionNote).length > MAX_TEXT_BYTES) revert TextTooLong();

        p.status = PactStatus.SUBMITTED;
        p.submittedAt = block.timestamp;
        p.submissionNote = submissionNote;

        emit WorkSubmitted(pactId, submissionNote, block.timestamp);
    }

    /// @notice Client approves and pays the vendor in full.
    function releaseFunds(uint256 pactId) external nonReentrant {
        Pact storage p = _get(pactId);
        if (msg.sender != p.client) revert Unauthorized();
        if (p.status != PactStatus.FUNDED && p.status != PactStatus.SUBMITTED) revert InvalidState(p.status);

        p.status = PactStatus.RELEASED;
        _pay(p.vendor, p.amount);

        emit PactReleased(pactId, p.vendor, p.amount);
    }

    /**
     * @notice Return the full amount to the client.
     *         - Client: only if FUNDED and the deadline has passed.
     *         - Vendor: any time while FUNDED or SUBMITTED (voluntary cancellation).
     */
    function refund(uint256 pactId) external nonReentrant {
        Pact storage p = _get(pactId);

        if (msg.sender == p.client) {
            if (p.status != PactStatus.FUNDED) revert InvalidState(p.status);
            if (block.timestamp <= p.deadline) revert DeadlineNotPassed();
        } else if (msg.sender == p.vendor) {
            if (p.status != PactStatus.FUNDED && p.status != PactStatus.SUBMITTED) revert InvalidState(p.status);
        } else {
            revert Unauthorized();
        }

        p.status = PactStatus.REFUNDED;
        _pay(p.client, p.amount);

        emit PactRefunded(pactId, p.client, p.amount);
    }

    /// @notice Either party freezes the pact pending resolution.
    function dispute(uint256 pactId, string calldata reason) external {
        Pact storage p = _get(pactId);
        if (msg.sender != p.client && msg.sender != p.vendor) revert Unauthorized();
        if (p.status != PactStatus.FUNDED && p.status != PactStatus.SUBMITTED) revert InvalidState(p.status);
        if (bytes(reason).length > MAX_TEXT_BYTES) revert TextTooLong();

        p.status = PactStatus.DISPUTED;
        p.disputedAt = block.timestamp;

        emit PactDisputed(pactId, msg.sender, reason);
    }

    // ------------------------------------------------------------- resolution

    /**
     * @notice Propose, or accept, a split of a disputed pact.
     * @dev The first call from one party records a proposal. A call from the other party
     *      with the same vendorShareBps settles immediately; a different value replaces
     *      the proposal. Either party can re-propose at any time before settlement.
     * @param vendorShareBps Share of the amount paid to the vendor, 0..10000.
     */
    function proposeResolution(uint256 pactId, uint16 vendorShareBps) external nonReentrant {
        Pact storage p = _get(pactId);
        if (msg.sender != p.client && msg.sender != p.vendor) revert Unauthorized();
        if (p.status != PactStatus.DISPUTED) revert InvalidState(p.status);
        if (vendorShareBps > BPS) revert InvalidShare();

        Proposal storage prop = proposals[pactId];
        if (prop.proposer != address(0) && prop.proposer != msg.sender && prop.vendorShareBps == vendorShareBps) {
            delete proposals[pactId];
            _resolve(p, vendorShareBps, msg.sender);
            return;
        }

        prop.proposer = msg.sender;
        prop.vendorShareBps = vendorShareBps;
        emit ResolutionProposed(pactId, msg.sender, vendorShareBps);
    }

    /// @notice The pact's arbiter rules on a dispute. Only if an arbiter was set at creation.
    function arbitrate(uint256 pactId, uint16 vendorShareBps) external nonReentrant {
        Pact storage p = _get(pactId);
        if (p.arbiter == address(0) || msg.sender != p.arbiter) revert Unauthorized();
        if (p.status != PactStatus.DISPUTED) revert InvalidState(p.status);
        if (vendorShareBps > BPS) revert InvalidShare();

        delete proposals[pactId];
        _resolve(p, vendorShareBps, msg.sender);
    }

    /// @notice Claim a payout that could not be pushed to you.
    function withdraw() external nonReentrant {
        uint256 amount = pendingWithdrawals[msg.sender];
        if (amount == 0) revert NothingToWithdraw();
        pendingWithdrawals[msg.sender] = 0;

        // No fallback here: a failed pull is the recipient's own revert.
        if (!_transfer(msg.sender, amount)) revert TransferFailed();
        emit Withdrawn(msg.sender, amount);
    }

    // ------------------------------------------------------------------ views

    function getPact(uint256 pactId) external view returns (Pact memory) {
        return _get(pactId);
    }

    function getClientPacts(address client) external view returns (uint256[] memory) {
        return _clientPacts[client];
    }

    function getVendorPacts(address vendor) external view returns (uint256[] memory) {
        return _vendorPacts[vendor];
    }

    /// @notice Pacts in creation order, ids offset+1 .. offset+limit (clamped).
    function getPacts(uint256 offset, uint256 limit) external view returns (Pact[] memory list) {
        if (offset >= pactCount || limit == 0) return new Pact[](0);
        uint256 end = offset + limit;
        if (end > pactCount) end = pactCount;
        list = new Pact[](end - offset);
        for (uint256 i = 0; i < list.length; i++) {
            list[i] = _pacts[offset + i + 1];
        }
    }

    // -------------------------------------------------------------- internals

    function _get(uint256 pactId) internal view returns (Pact storage p) {
        p = _pacts[pactId];
        if (p.id == 0) revert PactNotFound();
    }

    function _resolve(Pact storage p, uint16 vendorShareBps, address resolver) internal {
        p.status = PactStatus.RESOLVED;
        p.vendorShareBps = vendorShareBps;

        uint256 vendorAmount = (p.amount * vendorShareBps) / BPS;
        uint256 clientAmount = p.amount - vendorAmount;
        if (vendorAmount > 0) _pay(p.vendor, vendorAmount);
        if (clientAmount > 0) _pay(p.client, clientAmount);

        emit PactResolved(p.id, resolver, vendorShareBps, vendorAmount, clientAmount);
    }

    /// @dev Push payment with pull fallback: a recipient that rejects value cannot block
    ///      the state transition; the amount waits in pendingWithdrawals instead.
    function _pay(address to, uint256 amount) internal {
        if (_transfer(to, amount)) return;
        pendingWithdrawals[to] += amount;
        emit PayoutDeferred(to, amount);
    }

    function _transfer(address to, uint256 amount) internal returns (bool ok) {
        if (address(usdcToken) != address(0)) {
            // Bubble a token revert as a plain false so the caller can defer.
            (bool callOk, bytes memory ret) =
                address(usdcToken).call(abi.encodeWithSelector(IERC20.transfer.selector, to, amount));
            return callOk && (ret.length == 0 || abi.decode(ret, (bool)));
        }
        // Bounded gas: a recipient cannot burn the caller's gas to force deferral cheaply,
        // nor reenter meaningfully (guarded).
        (ok,) = to.call{value: amount, gas: 30_000}("");
    }
}
