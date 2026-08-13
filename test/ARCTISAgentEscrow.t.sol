// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "../contracts/ARCTISAgentEscrow.sol";
import "./MockERC20.sol";
import "./Assert.sol";

interface EscrowVm {
    function warp(uint256 newTimestamp) external;
}

contract ProviderActor {
    function submit(address escrow, uint256 jobId, bytes32 resultHash) external {
        ARCTISAgentEscrow(escrow).submit(jobId, resultHash);
    }

    function dispute(address escrow, uint256 jobId) external {
        ARCTISAgentEscrow(escrow).dispute(jobId);
    }
}

contract BehaviorToken {
    mapping(address => uint256) public balanceOf;
    mapping(address => mapping(address => uint256)) public allowance;
    uint8 public mode;

    function mint(address to, uint256 amount) external {
        balanceOf[to] += amount;
    }

    function setMode(uint8 newMode) external {
        mode = newMode;
    }

    function approve(address spender, uint256 amount) external returns (bool) {
        allowance[msg.sender][spender] = amount;
        return true;
    }

    function transfer(address to, uint256 amount) external returns (bool) {
        if (mode == 1) return false;
        if (mode == 2) revert("TRANSFER_REVERT");
        if (balanceOf[msg.sender] < amount) revert("BALANCE");
        balanceOf[msg.sender] -= amount;
        balanceOf[to] += amount;
        return true;
    }

    function transferFrom(address from, address to, uint256 amount) external returns (bool) {
        if (mode == 1) return false;
        if (mode == 2) revert("TRANSFER_FROM_REVERT");
        if (allowance[from][msg.sender] < amount) revert("ALLOWANCE");
        if (balanceOf[from] < amount) revert("BALANCE");
        allowance[from][msg.sender] -= amount;
        balanceOf[from] -= amount;
        balanceOf[to] += amount;
        return true;
    }
}

contract ARCTISAgentEscrowTest is Assert {
    EscrowVm internal constant vm = EscrowVm(address(uint160(uint256(keccak256("hevm cheat code")))));

    ARCTISAgentEscrow internal escrow;
    MockERC20 internal token;
    ProviderActor internal provider;
    uint256 internal constant FUND = 100;
    bytes32 internal constant JOB_HASH = keccak256("job-1");

    function setUp() public {
        escrow = new ARCTISAgentEscrow(address(this));
        token = new MockERC20();
        provider = new ProviderActor();

        token.mint(address(this), FUND * 20);
        token.approve(address(escrow), type(uint256).max);
    }

    function testCreateSubmitReleaseLifecycle() external {
        uint256 providerBefore = token.balanceOf(address(provider));
        uint256 jobId = escrow.createJob(address(provider), address(token), FUND, JOB_HASH, uint64(block.timestamp + 1 days));

        escrow.getJob(jobId);
        provider.submit(address(escrow), jobId, keccak256("result"));
        escrow.release(jobId);

        (, , , uint256 amount, , , ARCTISAgentEscrow.Status status) = escrow.jobs(jobId);
        _assertEq(amount, FUND, "funded amount mismatch");
        _assertTrue(status == ARCTISAgentEscrow.Status.Released, "job not released");
        _assertEq(token.balanceOf(address(provider)), providerBefore + FUND, "provider payment mismatch");
    }

    function testRefundRequiresDeadline() external {
        uint64 deadline = uint64(block.timestamp + 10);
        uint256 jobId = escrow.createJob(address(provider), address(token), FUND, JOB_HASH, deadline);

        (bool earlyRefundOk,) = address(escrow).call(abi.encodeWithSelector(escrow.refund.selector, jobId));
        _assertTrue(!earlyRefundOk, "refund allowed before deadline");

        vm.warp(block.timestamp + 11);
        uint256 payerBefore = token.balanceOf(address(this));
        escrow.refund(jobId);
        _assertEq(token.balanceOf(address(this)), payerBefore + FUND, "refund amount mismatch");

        (, , , , , , ARCTISAgentEscrow.Status status) = escrow.jobs(jobId);
        _assertTrue(status == ARCTISAgentEscrow.Status.Refunded, "job not refunded");
    }

    function testDisputeAndOwnerResolution() external {
        uint256 jobId = escrow.createJob(address(provider), address(token), FUND, JOB_HASH, uint64(block.timestamp + 1 days));
        provider.submit(address(escrow), jobId, keccak256("result"));
        provider.dispute(address(escrow), jobId);

        uint256 payerBefore = token.balanceOf(address(this));
        escrow.resolveDispute(jobId, false);
        _assertEq(token.balanceOf(address(this)), payerBefore + FUND, "dispute refund mismatch");

        (, , , , , , ARCTISAgentEscrow.Status status) = escrow.jobs(jobId);
        _assertTrue(status == ARCTISAgentEscrow.Status.Refunded, "dispute not resolved to refund");
    }

    function testTerminalStateCannotBeReused() external {
        uint256 jobId = escrow.createJob(address(provider), address(token), FUND, JOB_HASH, uint64(block.timestamp + 1 days));
        escrow.release(jobId);

        (bool secondReleaseOk,) = address(escrow).call(abi.encodeWithSelector(escrow.release.selector, jobId));
        _assertTrue(!secondReleaseOk, "released job released twice");

        (bool disputeOk,) = address(escrow).call(abi.encodeWithSelector(escrow.dispute.selector, jobId));
        _assertTrue(!disputeOk, "released job disputed");
    }

    function testProviderSubmissionIsDeadlineBound() external {
        uint64 deadline = uint64(block.timestamp + 10);
        uint256 jobId = escrow.createJob(address(provider), address(token), FUND, JOB_HASH, deadline);
        vm.warp(block.timestamp + 11);

        (bool submitOk,) = address(provider).call(
            abi.encodeWithSelector(ProviderActor.submit.selector, address(escrow), jobId, bytes32(uint256(1)))
        );
        _assertTrue(!submitOk, "provider submitted after deadline");
    }

    function testInvalidTokenContractAndJobHashAreRejected() external {
        (bool tokenOk,) = address(escrow).call(
            abi.encodeWithSelector(
                escrow.createJob.selector,
                address(provider),
                address(0xBEEF),
                FUND,
                JOB_HASH,
                uint64(block.timestamp + 1 days)
            )
        );
        _assertTrue(!tokenOk, "EOA token was accepted");

        (bool hashOk,) = address(escrow).call(
            abi.encodeWithSelector(
                escrow.createJob.selector,
                address(provider),
                address(token),
                FUND,
                bytes32(0),
                uint64(block.timestamp + 1 days)
            )
        );
        _assertTrue(!hashOk, "zero job hash was accepted");
    }

    function testPauseBlocksLifecycleMutations() external {
        escrow.pause();
        (bool createOk,) = address(escrow).call(
            abi.encodeWithSelector(
                escrow.createJob.selector,
                address(provider),
                address(token),
                FUND,
                JOB_HASH,
                uint64(block.timestamp + 1 days)
            )
        );
        _assertTrue(!createOk, "job creation worked while paused");
        escrow.unpause();

        uint256 jobId = escrow.createJob(address(provider), address(token), FUND, JOB_HASH, uint64(block.timestamp + 1 days));
        escrow.pause();
        (bool releaseOk,) = address(escrow).call(abi.encodeWithSelector(escrow.release.selector, jobId));
        _assertTrue(!releaseOk, "release worked while paused");
    }

    function testERC20FalseReturnAndRevertAreRejected() external {
        BehaviorToken behavior = new BehaviorToken();
        behavior.mint(address(this), FUND * 2);
        behavior.approve(address(escrow), type(uint256).max);

        behavior.setMode(1);
        (bool falseReturnOk,) = address(escrow).call(
            abi.encodeWithSelector(
                escrow.createJob.selector,
                address(provider),
                address(behavior),
                FUND,
                JOB_HASH,
                uint64(block.timestamp + 1 days)
            )
        );
        _assertTrue(!falseReturnOk, "false-return token was accepted");

        behavior.setMode(2);
        (bool revertOk,) = address(escrow).call(
            abi.encodeWithSelector(
                escrow.createJob.selector,
                address(provider),
                address(behavior),
                FUND,
                JOB_HASH,
                uint64(block.timestamp + 1 days)
            )
        );
        _assertTrue(!revertOk, "reverting token was accepted");
    }
}
