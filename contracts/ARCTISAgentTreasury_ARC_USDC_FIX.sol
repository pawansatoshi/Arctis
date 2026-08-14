// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @title ARCTIS Agent Treasury
/// @notice Testnet-stage policy vault for bounded AI-agent economic actions.
/// @dev V1 is intentionally transfer-only. This contract is NOT audited and must not hold meaningful funds.
contract ARCTISAgentTreasury {
    /// @dev Arc exposes USDC through a protocol precompile, so code.length == 0.
    address public constant ARC_USDC = 0x3600000000000000000000000000000000000000;

    struct Policy {
        uint256 maxPerTransaction;
        uint256 maxDaily;
        uint256 dailySpent;
        uint64 dailyBucket;
        bool active;
    }

    struct Action {
        bytes32 agentId;
        address token;
        address recipient;
        uint256 amount;
        uint64 deadline;
        uint256 nonce;
    }

    struct Proposal {
        Action action;
        bytes32 actionHash;
        bool approved;
        bool executed;
        bool rejected;
    }

    address public immutable owner;
    bool public paused;

    mapping(bytes32 => Policy) public policies;
    mapping(bytes32 => bool) public registeredAgents;
    mapping(address => bool) public allowedTokens;
    mapping(bytes32 => uint256) public nextNonce;
    mapping(bytes32 => Proposal) public proposals;

    event AgentRegistered(bytes32 indexed agentId);
    event AgentRevoked(bytes32 indexed agentId);
    event PolicyUpdated(bytes32 indexed agentId, uint256 maxPerTransaction, uint256 maxDaily, bool active);
    event TokenPolicyUpdated(address indexed token, bool allowed);
    event Deposit(address indexed token, address indexed from, uint256 amount);
    event Withdrawal(address indexed token, address indexed to, uint256 amount);
    event ActionProposed(bytes32 indexed actionHash, bytes32 indexed agentId, address indexed token, address recipient, uint256 amount, uint256 nonce, uint64 deadline);
    event ActionApproved(bytes32 indexed actionHash);
    event ActionRejected(bytes32 indexed actionHash);
    event ActionExecuted(bytes32 indexed actionHash, address indexed token, address indexed recipient, uint256 amount);
    event Paused();
    event Unpaused();

    error NotOwner();
    error ZeroAddress();
    error PausedState();
    error InvalidAgent();
    error InvalidToken();
    error InvalidTokenContract();
    error InvalidRecipient();
    error InvalidAmount();
    error InvalidDeadline();
    error PolicyViolation();
    error InvalidAction();
    error TransferFailed();

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

        // Arc USDC is a protocol precompile with no ordinary EVM bytecode.
        // All other allowlisted assets must be deployed contracts.
        if (token.code.length == 0 && token != ARC_USDC) revert InvalidTokenContract();

        allowedTokens[token] = allowed;
        emit TokenPolicyUpdated(token, allowed);
    }

    function pause() external onlyOwner {
        paused = true;
        emit Paused();
    }

    function unpause() external onlyOwner {
        paused = false;
        emit Unpaused();
    }

    function deposit(address token, uint256 amount) external whenNotPaused {
        if (!allowedTokens[token]) revert InvalidToken();
        if (amount == 0) revert InvalidAmount();
        _safeTransferFrom(token, msg.sender, address(this), amount);
        emit Deposit(token, msg.sender, amount);
    }

    function withdraw(address token, address to, uint256 amount) external onlyOwner {
        if (to == address(0)) revert ZeroAddress();
        if (amount == 0) revert InvalidAmount();
        // Withdrawal is intentionally independent of the current token allowlist.
        // Revoking a token must stop new deposits/proposals/execution, not lock
        // already-held Treasury funds permanently.
        _safeTransfer(token, to, amount);
        emit Withdrawal(token, to, amount);
    }

    function propose(bytes32 agentId, address token, address recipient, uint256 amount, uint64 deadline)
        external onlyOwner whenNotPaused returns (bytes32 actionHash)
    {
        Policy storage policy = policies[agentId];

        if (!registeredAgents[agentId] || !policy.active) revert InvalidAgent();
        if (!allowedTokens[token]) revert InvalidToken();
        if (recipient == address(0)) revert InvalidRecipient();
        if (amount == 0 || amount > policy.maxPerTransaction) revert PolicyViolation();
        if (deadline <= block.timestamp) revert InvalidDeadline();

        uint256 day = block.timestamp / 1 days;
        if (policy.dailyBucket != day) {
            policy.dailyBucket = uint64(day);
            policy.dailySpent = 0;
        }

        if (policy.dailySpent + amount > policy.maxDaily) revert PolicyViolation();

        uint256 nonce = nextNonce[agentId]++;

        Action memory action = Action({
            agentId: agentId,
            token: token,
            recipient: recipient,
            amount: amount,
            deadline: deadline,
            nonce: nonce
        });

        actionHash = keccak256(
            abi.encode(
                address(this),
                block.chainid,
                action.agentId,
                action.token,
                action.recipient,
                action.amount,
                action.deadline,
                action.nonce
            )
        );

        proposals[actionHash] = Proposal({
            action: action,
            actionHash: actionHash,
            approved: false,
            executed: false,
            rejected: false
        });

        emit ActionProposed(actionHash, agentId, token, recipient, amount, nonce, deadline);
    }

    function approve(bytes32 actionHash) external onlyOwner whenNotPaused {
        Proposal storage proposal = proposals[actionHash];

        if (
            proposal.actionHash != actionHash ||
            proposal.rejected ||
            proposal.executed ||
            proposal.approved
        ) revert InvalidAction();

        if (proposal.action.deadline <= block.timestamp) revert InvalidDeadline();

        proposal.approved = true;
        emit ActionApproved(actionHash);
    }

    function reject(bytes32 actionHash) external onlyOwner {
        Proposal storage proposal = proposals[actionHash];

        if (
            proposal.actionHash != actionHash ||
            proposal.rejected ||
            proposal.executed
        ) revert InvalidAction();

        proposal.rejected = true;
        emit ActionRejected(actionHash);
    }

    function execute(bytes32 actionHash) external whenNotPaused {
        Proposal storage proposal = proposals[actionHash];

        if (
            proposal.actionHash != actionHash ||
            proposal.rejected ||
            proposal.executed ||
            !proposal.approved
        ) revert InvalidAction();

        if (proposal.action.deadline <= block.timestamp) revert InvalidDeadline();

        Policy storage policy = policies[proposal.action.agentId];

        if (!registeredAgents[proposal.action.agentId] || !policy.active) revert InvalidAgent();
        if (!allowedTokens[proposal.action.token]) revert InvalidToken();

        uint256 day = block.timestamp / 1 days;

        if (policy.dailyBucket != day) {
            policy.dailyBucket = uint64(day);
            policy.dailySpent = 0;
        }

        if (policy.dailySpent + proposal.action.amount > policy.maxDaily) revert PolicyViolation();

        policy.dailySpent += proposal.action.amount;
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

    function getAction(bytes32 actionHash) external view returns (Proposal memory) {
        return proposals[actionHash];
    }

    function _safeTransfer(address token, address to, uint256 amount) internal {
        (bool ok, bytes memory data) = token.call(
            abi.encodeWithSelector(0xa9059cbb, to, amount)
        );

        if (!ok || (data.length != 0 && !abi.decode(data, (bool)))) {
            revert TransferFailed();
        }
    }

    function _safeTransferFrom(address token, address from, address to, uint256 amount) internal {
        (bool ok, bytes memory data) = token.call(
            abi.encodeWithSelector(0x23b872dd, from, to, amount)
        );

        if (!ok || (data.length != 0 && !abi.decode(data, (bool)))) {
            revert TransferFailed();
        }
    }
}
