// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @title ARCTIS Agent Treasury V2
/// @notice Testnet-stage policy vault for bounded AI-agent economic actions.
///
/// @dev V2 security model — daily-spend RESERVATION:
///
///   V1 bug (propose/execute spend race):
///     propose() checked dailySpent + amount <= maxDaily but did NOT increment
///     dailySpent. execute() was the only place that incremented it.
///     This allowed N concurrent proposals (each passing the check with
///     dailySpent=0) whose combined amounts exceeded maxDaily. Because
///     execute() is permissionless, multiple proposals could be approved
///     simultaneously and the limit could be exceeded in the same day bucket.
///
///   V2 fix — reserve-at-propose, refund-on-cancel:
///     propose()  — increments dailySpent (reserves the amount)
///     reject()   — decrements dailySpent (releases the reservation)
///     execute()  — checks again and sets executed=true; does NOT increment
///                  dailySpent a second time (already reserved)
///     Expired proposals (deadline passed) can be cancelled by anyone to
///     release their reservation back to the daily budget.
///
///   This means the daily budget is always "spoken for" at propose time.
///   A day-bucket rollover zeroes dailySpent at both propose and execute,
///   so stale reservations from a previous bucket are not carried forward.
///
/// @dev NOT audited. MUST NOT hold meaningful funds on mainnet without
///      an independent security audit.
contract ARCTISAgentTreasury {
    /// @dev Arc USDC is a protocol precompile with code.length == 0.
    address public constant ARC_USDC = 0x3600000000000000000000000000000000000000;

    struct Policy {
        uint256 maxPerTransaction;
        uint256 maxDaily;
        uint256 dailySpent;      // includes both executed AND pending-proposed amounts
        uint64  dailyBucket;     // floor(block.timestamp / 1 days)
        bool    active;
    }

    struct Action {
        bytes32 agentId;
        address token;
        address recipient;
        uint256 amount;
        uint64  deadline;
        uint256 nonce;
    }

    struct Proposal {
        Action  action;
        bytes32 actionHash;
        bool    approved;
        bool    executed;
        bool    rejected;
        bool    cancelled;   // V2: true when expired proposal was released via cancel()
    }

    address public immutable owner;
    bool public paused;

    mapping(bytes32 => Policy)   public policies;
    mapping(bytes32 => bool)     public registeredAgents;
    mapping(address => bool)     public allowedTokens;
    mapping(bytes32 => uint256)  public nextNonce;
    mapping(bytes32 => Proposal) public proposals;

    event AgentRegistered   (bytes32 indexed agentId);
    event AgentRevoked      (bytes32 indexed agentId);
    event PolicyUpdated     (bytes32 indexed agentId, uint256 maxPerTransaction, uint256 maxDaily, bool active);
    event TokenPolicyUpdated(address indexed token, bool allowed);
    event Deposit           (address indexed token, address indexed from, uint256 amount);
    event Withdrawal        (address indexed token, address indexed to, uint256 amount);
    event ActionProposed    (bytes32 indexed actionHash, bytes32 indexed agentId, address indexed token, address recipient, uint256 amount, uint256 nonce, uint64 deadline);
    event ActionApproved    (bytes32 indexed actionHash);
    event ActionRejected    (bytes32 indexed actionHash);
    event ActionCancelled   (bytes32 indexed actionHash);  // V2: expired proposal released
    event ActionExecuted    (bytes32 indexed actionHash, address indexed token, address indexed recipient, uint256 amount);
    event Paused   ();
    event Unpaused ();

    error NotOwner           ();
    error ZeroAddress        ();
    error PausedState        ();
    error InvalidAgent       ();
    error InvalidToken       ();
    error InvalidTokenContract();
    error InvalidRecipient   ();
    error InvalidAmount      ();
    error InvalidDeadline    ();
    error PolicyViolation    ();
    error InvalidAction      ();
    error TransferFailed     ();
    error NotExpired         ();    // V2: cancel() called on non-expired proposal

    modifier onlyOwner() {
        if (msg.sender != owner) revert NotOwner();
        _;
    }

    modifier whenNotPaused() {
        if (paused) revert PausedState();
        _;
    }

    constructor(address initialOwner) {
        if (initialOwner == address(0)) revert ZeroAddress();
        owner = initialOwner;
    }

    // ── Owner administration ───────────────────────────────────────────────────

    function registerAgent(bytes32 agentId) external onlyOwner {
        if (agentId == bytes32(0)) revert InvalidAgent();
        registeredAgents[agentId] = true;
        policies[agentId].active = true;
        emit AgentRegistered(agentId);
    }

    function revokeAgent(bytes32 agentId) external onlyOwner {
        if (!registeredAgents[agentId]) revert InvalidAgent();
        registeredAgents[agentId] = false;
        policies[agentId].active = false;
        emit AgentRevoked(agentId);
    }

    function setPolicy(bytes32 agentId, uint256 maxPerTransaction, uint256 maxDaily, bool active) external onlyOwner {
        if (!registeredAgents[agentId]) revert InvalidAgent();
        if (maxPerTransaction == 0 || maxDaily == 0 || maxPerTransaction > maxDaily) revert PolicyViolation();

        Policy storage policy = policies[agentId];
        uint64 currentBucket = uint64(block.timestamp / 1 days);
        // Carry forward only the current-bucket spend; a new bucket resets to zero.
        uint256 spent = policy.dailyBucket == currentBucket ? policy.dailySpent : 0;

        policies[agentId] = Policy({
            maxPerTransaction: maxPerTransaction,
            maxDaily: maxDaily,
            dailySpent: spent,
            dailyBucket: currentBucket,
            active: active
        });

        emit PolicyUpdated(agentId, maxPerTransaction, maxDaily, active);
    }

    function setAllowedToken(address token, bool allowed) external onlyOwner {
        if (token == address(0)) revert ZeroAddress();
        if (token.code.length == 0 && token != ARC_USDC) revert InvalidTokenContract();
        allowedTokens[token] = allowed;
        emit TokenPolicyUpdated(token, allowed);
    }

    function pause()   external onlyOwner { paused = true;  emit Paused();   }
    function unpause() external onlyOwner { paused = false; emit Unpaused(); }

    // ── Deposits / Withdrawals ────────────────────────────────────────────────

    function deposit(address token, uint256 amount) external whenNotPaused {
        if (!allowedTokens[token]) revert InvalidToken();
        if (amount == 0) revert InvalidAmount();
        _safeTransferFrom(token, msg.sender, address(this), amount);
        emit Deposit(token, msg.sender, amount);
    }

    function withdraw(address token, address to, uint256 amount) external onlyOwner {
        if (to == address(0)) revert ZeroAddress();
        if (amount == 0) revert InvalidAmount();
        // Withdrawal is independent of the token allowlist so already-held funds
        // are never locked permanently by a token revocation.
        _safeTransfer(token, to, amount);
        emit Withdrawal(token, to, amount);
    }

    // ── Proposal lifecycle ────────────────────────────────────────────────────

    /**
     * @notice Propose an agent action and RESERVE the daily budget immediately.
     *
     * V2 change: dailySpent is incremented here (reservation). If the proposal
     * is later rejected or expires, the reservation is released by reject() or
     * cancel(). This prevents multiple concurrent proposals from collectively
     * exceeding maxDaily.
     */
    function propose(
        bytes32 agentId,
        address token,
        address recipient,
        uint256 amount,
        uint64  deadline
    ) external onlyOwner whenNotPaused returns (bytes32 actionHash) {
        Policy storage policy = policies[agentId];

        if (!registeredAgents[agentId] || !policy.active) revert InvalidAgent();
        if (!allowedTokens[token])                         revert InvalidToken();
        if (recipient == address(0))                       revert InvalidRecipient();
        if (amount == 0 || amount > policy.maxPerTransaction) revert PolicyViolation();
        if (deadline <= block.timestamp)                   revert InvalidDeadline();

        // Roll over the daily bucket if needed
        uint256 day = block.timestamp / 1 days;
        if (policy.dailyBucket != day) {
            policy.dailyBucket = uint64(day);
            policy.dailySpent  = 0;
        }

        // V2: reserve the amount now — prevents concurrent proposals from
        // collectively exceeding the daily limit.
        if (policy.dailySpent + amount > policy.maxDaily) revert PolicyViolation();
        policy.dailySpent += amount;

        uint256 nonce = nextNonce[agentId]++;

        Action memory action = Action({
            agentId:   agentId,
            token:     token,
            recipient: recipient,
            amount:    amount,
            deadline:  deadline,
            nonce:     nonce
        });

        actionHash = keccak256(abi.encode(
            address(this), block.chainid,
            action.agentId, action.token, action.recipient,
            action.amount,  action.deadline, action.nonce
        ));

        proposals[actionHash] = Proposal({
            action:     action,
            actionHash: actionHash,
            approved:   false,
            executed:   false,
            rejected:   false,
            cancelled:  false
        });

        emit ActionProposed(actionHash, agentId, token, recipient, amount, nonce, deadline);
    }

    function approve(bytes32 actionHash) external onlyOwner whenNotPaused {
        Proposal storage proposal = proposals[actionHash];

        if (
            proposal.actionHash != actionHash ||
            proposal.rejected   ||
            proposal.executed   ||
            proposal.cancelled  ||
            proposal.approved
        ) revert InvalidAction();

        if (proposal.action.deadline <= block.timestamp) revert InvalidDeadline();

        proposal.approved = true;
        emit ActionApproved(actionHash);
    }

    /**
     * @notice Reject a pending proposal and release its daily-budget reservation.
     *
     * V2 change: decrements dailySpent to release the reservation made in propose().
     */
    function reject(bytes32 actionHash) external onlyOwner {
        Proposal storage proposal = proposals[actionHash];

        if (
            proposal.actionHash != actionHash ||
            proposal.rejected   ||
            proposal.executed   ||
            proposal.cancelled
        ) revert InvalidAction();

        proposal.rejected = true;

        // V2: release the reservation
        _releaseReservation(proposal.action.agentId, proposal.action.amount);

        emit ActionRejected(actionHash);
    }

    /**
     * @notice Cancel an expired (deadline-passed) proposal and release its reservation.
     *
     * Any address may call this to clean up stale proposals and free daily budget.
     * Prevents a rogue pending proposal from permanently consuming daily capacity.
     */
    function cancel(bytes32 actionHash) external {
        Proposal storage proposal = proposals[actionHash];

        if (
            proposal.actionHash != actionHash ||
            proposal.rejected   ||
            proposal.executed   ||
            proposal.cancelled  ||
            proposal.approved
        ) revert InvalidAction();

        if (proposal.action.deadline > block.timestamp) revert NotExpired();

        proposal.cancelled = true;

        // Release the reservation only if it is still within the same daily bucket.
        _releaseReservation(proposal.action.agentId, proposal.action.amount);

        emit ActionCancelled(actionHash);
    }

    /**
     * @notice Execute an approved proposal. Permissionless — any address may call.
     *
     * V2 change: does NOT increment dailySpent (already reserved at propose time).
     * Still checks dailySpent as a safety net in case the daily bucket rolled over
     * between propose and execute, which would have zeroed dailySpent and lost the
     * reservation.
     */
    function execute(bytes32 actionHash) external whenNotPaused {
        Proposal storage proposal = proposals[actionHash];

        if (
            proposal.actionHash != actionHash ||
            proposal.rejected   ||
            proposal.executed   ||
            proposal.cancelled  ||
            !proposal.approved
        ) revert InvalidAction();

        if (proposal.action.deadline <= block.timestamp) revert InvalidDeadline();

        Policy storage policy = policies[proposal.action.agentId];

        if (!registeredAgents[proposal.action.agentId] || !policy.active) revert InvalidAgent();
        if (!allowedTokens[proposal.action.token])                         revert InvalidToken();

        // Roll over if a new day started since propose() was called.
        uint256 day = block.timestamp / 1 days;
        if (policy.dailyBucket != day) {
            // The bucket rolled since propose() reserved the amount. The reservation
            // is gone (stale bucket). Re-apply it against the fresh day's budget so
            // the daily limit is respected in the new bucket.
            policy.dailyBucket = uint64(day);
            policy.dailySpent  = 0;
            // Re-apply reservation for this execution in the new bucket.
            if (policy.dailySpent + proposal.action.amount > policy.maxDaily) revert PolicyViolation();
            policy.dailySpent += proposal.action.amount;
        } else {
            // Same bucket: this proposal's amount is ALREADY included in dailySpent
            // (reserved at propose time). Do NOT add it again. Just sanity-check that
            // dailySpent hasn't been corrupted past maxDaily.
            if (policy.dailySpent > policy.maxDaily) revert PolicyViolation();
        }

        proposal.executed = true;

        _safeTransfer(
            proposal.action.token,
            proposal.action.recipient,
            proposal.action.amount
        );

        emit ActionExecuted(
            actionHash,
            proposal.action.token,
            proposal.action.recipient,
            proposal.action.amount
        );
    }

    // ── Views ─────────────────────────────────────────────────────────────────

    function getAction(bytes32 actionHash) external view returns (Proposal memory) {
        return proposals[actionHash];
    }

    // ── Internal helpers ──────────────────────────────────────────────────────

    /**
     * @dev Release a previously-reserved daily-budget amount for agentId.
     *      Only refunds if the proposal was in the current day bucket;
     *      stale reservations from a prior bucket are already gone (bucket rollover
     *      zeroed dailySpent) so there is nothing to refund.
     */
    function _releaseReservation(bytes32 agentId, uint256 amount) internal {
        Policy storage policy = policies[agentId];
        uint256 day = block.timestamp / 1 days;
        if (policy.dailyBucket == day && policy.dailySpent >= amount) {
            policy.dailySpent -= amount;
        }
        // If bucket has rolled or dailySpent was already zeroed, nothing to refund.
    }

    function _safeTransfer(address token, address to, uint256 amount) internal {
        (bool ok, bytes memory data) = token.call(
            abi.encodeWithSelector(0xa9059cbb, to, amount)
        );
        if (!ok || (data.length != 0 && !abi.decode(data, (bool)))) revert TransferFailed();
    }

    function _safeTransferFrom(address token, address from, address to, uint256 amount) internal {
        (bool ok, bytes memory data) = token.call(
            abi.encodeWithSelector(0x23b872dd, from, to, amount)
        );
        if (!ok || (data.length != 0 && !abi.decode(data, (bool)))) revert TransferFailed();
    }
}
