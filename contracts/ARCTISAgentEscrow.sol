// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @title ARCTIS Agent Escrow
/// @notice Testnet-stage USDC-style escrow primitive for bounded agent economic agreements.
/// @dev Intentionally independent from existing ARCTIS Transfer/Swap/Bridge rails.
///      This contract is NOT audited and must not be used with meaningful funds.
contract ARCTISAgentEscrow {
    enum Status { None, Funded, Submitted, Released, Refunded, Disputed }

    struct Job {
        address payer;
        address provider;
        address token;
        uint256 amount;
        bytes32 jobHash;
        uint64 deadline;
        Status status;
    }

    address public immutable owner;
    uint256 public nextJobId;
    bool public paused;

    mapping(uint256 => Job) public jobs;

    event JobCreated(uint256 indexed jobId, address indexed payer, address indexed provider, address token, uint256 amount, bytes32 jobHash, uint64 deadline);
    event JobSubmitted(uint256 indexed jobId, bytes32 resultHash);
    event JobReleased(uint256 indexed jobId, address indexed provider, uint256 amount);
    event JobRefunded(uint256 indexed jobId, address indexed payer, uint256 amount);
    event JobDisputed(uint256 indexed jobId);
    event DisputeResolved(uint256 indexed jobId, bool releaseToProvider);
    event Paused();
    event Unpaused();

    error NotOwner();
    error NotPayer();
    error NotProvider();
    error InvalidAddress();
    error InvalidAmount();
    error InvalidDeadline();
    error InvalidState();
    error PausedState();
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
        if (initialOwner == address(0)) revert InvalidAddress();
        owner = initialOwner;
    }

    function pause() external onlyOwner {
        paused = true;
        emit Paused();
    }

    function unpause() external onlyOwner {
        paused = false;
        emit Unpaused();
    }

    /// @notice Creates and funds an economic agreement in one transaction.
    /// @dev Payer must approve this contract for `amount` first.
    function createJob(
        address provider,
        address token,
        uint256 amount,
        bytes32 jobHash,
        uint64 deadline
    ) external whenNotPaused returns (uint256 jobId) {
        if (provider == address(0) || token == address(0)) revert InvalidAddress();
        if (provider == msg.sender || amount == 0) revert InvalidAmount();
        if (deadline <= block.timestamp) revert InvalidDeadline();

        jobId = nextJobId++;
        jobs[jobId] = Job({
            payer: msg.sender,
            provider: provider,
            token: token,
            amount: amount,
            jobHash: jobHash,
            deadline: deadline,
            status: Status.Funded
        });

        _safeTransferFrom(token, msg.sender, address(this), amount);
        emit JobCreated(jobId, msg.sender, provider, token, amount, jobHash, deadline);
    }

    function submit(uint256 jobId, bytes32 resultHash) external whenNotPaused {
        Job storage job = jobs[jobId];
        if (job.status != Status.Funded) revert InvalidState();
        if (msg.sender != job.provider) revert NotProvider();
        if (block.timestamp > job.deadline) revert InvalidDeadline();
        job.status = Status.Submitted;
        emit JobSubmitted(jobId, resultHash);
    }

    function release(uint256 jobId) external whenNotPaused {
        Job storage job = jobs[jobId];
        if (msg.sender != job.payer) revert NotPayer();
        if (job.status != Status.Funded && job.status != Status.Submitted) revert InvalidState();
        job.status = Status.Released;
        _safeTransfer(job.token, job.provider, job.amount);
        emit JobReleased(jobId, job.provider, job.amount);
    }

    /// @notice Refunds only after the job deadline unless it has already been released/disputed.
    function refund(uint256 jobId) external whenNotPaused {
        Job storage job = jobs[jobId];
        if (msg.sender != job.payer) revert NotPayer();
        if (job.status != Status.Funded && job.status != Status.Submitted) revert InvalidState();
        if (block.timestamp <= job.deadline) revert InvalidState();
        job.status = Status.Refunded;
        _safeTransfer(job.token, job.payer, job.amount);
        emit JobRefunded(jobId, job.payer, job.amount);
    }

    function dispute(uint256 jobId) external whenNotPaused {
        Job storage job = jobs[jobId];
        if (job.status != Status.Submitted) revert InvalidState();
        if (msg.sender != job.payer && msg.sender != job.provider) revert InvalidState();
        job.status = Status.Disputed;
        emit JobDisputed(jobId);
    }

    /// @notice V1 dispute resolution is deliberately centralized to the contract owner.
    /// @dev This is a testnet arbitration primitive, not a decentralized dispute court.
    function resolveDispute(uint256 jobId, bool releaseToProvider) external onlyOwner whenNotPaused {
        Job storage job = jobs[jobId];
        if (job.status != Status.Disputed) revert InvalidState();
        job.status = releaseToProvider ? Status.Released : Status.Refunded;
        if (releaseToProvider) {
            _safeTransfer(job.token, job.provider, job.amount);
            emit JobReleased(jobId, job.provider, job.amount);
        } else {
            _safeTransfer(job.token, job.payer, job.amount);
            emit JobRefunded(jobId, job.payer, job.amount);
        }
        emit DisputeResolved(jobId, releaseToProvider);
    }

    function getJob(uint256 jobId) external view returns (Job memory) {
        return jobs[jobId];
    }

    function _safeTransfer(address token, address to, uint256 amount) internal {
        (bool ok, bytes memory data) = token.call(abi.encodeWithSelector(0xa9059cbb, to, amount));
        if (!ok || (data.length != 0 && !abi.decode(data, (bool)))) revert TransferFailed();
    }

    function _safeTransferFrom(address token, address from, address to, uint256 amount) internal {
        (bool ok, bytes memory data) = token.call(abi.encodeWithSelector(0x23b872dd, from, to, amount));
        if (!ok || (data.length != 0 && !abi.decode(data, (bool)))) revert TransferFailed();
    }
}
