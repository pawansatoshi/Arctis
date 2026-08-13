// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "../contracts/ARCTISAgentTreasury.sol";
import "./MockERC20.sol";
import "./Assert.sol";

interface Vm {
    function warp(uint256 newTimestamp) external;
}

contract TreasuryNonOwnerCaller {
    function registerAgent(address treasury, bytes32 agentId) external {
        ARCTISAgentTreasury(treasury).registerAgent(agentId);
    }

    function propose(
        address treasury,
        bytes32 agentId,
        address token,
        address recipient,
        uint256 amount,
        uint64 deadline
    ) external returns (bytes32) {
        return ARCTISAgentTreasury(treasury).propose(agentId, token, recipient, amount, deadline);
    }
}

contract ARCTISAgentTreasuryTest is Assert {
    Vm internal constant vm = Vm(address(uint160(uint256(keccak256("hevm cheat code")))));

    ARCTISAgentTreasury internal treasury;
    MockERC20 internal token;
    bytes32 internal constant AGENT = bytes32(uint256(1));
    uint256 internal constant INITIAL_BALANCE = 1_000_000;

    function setUp() public {
        treasury = new ARCTISAgentTreasury(address(this));
        token = new MockERC20();
        token.mint(address(this), INITIAL_BALANCE);
        token.approve(address(treasury), type(uint256).max);

        treasury.setAllowedToken(address(token), true);
        treasury.registerAgent(AGENT);
        treasury.setPolicy(AGENT, 100, 150, true);
        treasury.deposit(address(token), INITIAL_BALANCE);
    }

    function testProposalApprovalExecutionAndReplayProtection() external {
        uint256 recipientBefore = token.balanceOf(address(0xBEEF));
        bytes32 actionHash = treasury.propose(AGENT, address(token), address(0xBEEF), 40, uint64(block.timestamp + 1 days));

        treasury.approve(actionHash);
        treasury.execute(actionHash);

        _assertEq(token.balanceOf(address(0xBEEF)), recipientBefore + 40, "recipient amount mismatch");

        (bool replayed,) = address(treasury).call(abi.encodeWithSelector(treasury.execute.selector, actionHash));
        _assertTrue(!replayed, "executed action replayed");
    }

    function testOwnerOnlyBoundary() external {
        TreasuryNonOwnerCaller attacker = new TreasuryNonOwnerCaller();

        (bool registerOk,) = address(attacker).call(
            abi.encodeWithSelector(attacker.registerAgent.selector, address(treasury), bytes32(uint256(2)))
        );
        _assertTrue(!registerOk, "non-owner registered agent");

        (bool proposalOk,) = address(attacker).call(
            abi.encodeWithSelector(
                attacker.propose.selector,
                address(treasury),
                AGENT,
                address(token),
                address(0xBEEF),
                uint256(1),
                uint64(block.timestamp + 1 days)
            )
        );
        _assertTrue(!proposalOk, "non-owner proposed action");
    }

    function testRejectAndApprovalAreMutuallyExclusive() external {
        bytes32 actionHash = treasury.propose(AGENT, address(token), address(0xBEEF), 10, uint64(block.timestamp + 1 days));
        treasury.reject(actionHash);

        (bool approveOk,) = address(treasury).call(abi.encodeWithSelector(treasury.approve.selector, actionHash));
        _assertTrue(!approveOk, "rejected action was approved");

        (bool executeOk,) = address(treasury).call(abi.encodeWithSelector(treasury.execute.selector, actionHash));
        _assertTrue(!executeOk, "rejected action executed");
    }

    function testRevokedAgentCannotExecuteApprovedAction() external {
        bytes32 actionHash = treasury.propose(AGENT, address(token), address(0xBEEF), 10, uint64(block.timestamp + 1 days));
        treasury.approve(actionHash);
        treasury.revokeAgent(AGENT);

        (bool executeOk,) = address(treasury).call(abi.encodeWithSelector(treasury.execute.selector, actionHash));
        _assertTrue(!executeOk, "revoked agent executed");
    }

    function testAllowlistChangeBlocksApprovedAction() external {
        bytes32 actionHash = treasury.propose(AGENT, address(token), address(0xBEEF), 10, uint64(block.timestamp + 1 days));
        treasury.approve(actionHash);
        treasury.setAllowedToken(address(token), false);

        (bool executeOk,) = address(treasury).call(abi.encodeWithSelector(treasury.execute.selector, actionHash));
        _assertTrue(!executeOk, "disallowed token executed");
    }

    function testExpiredActionCannotExecute() external {
        bytes32 actionHash = treasury.propose(AGENT, address(token), address(0xBEEF), 10, uint64(block.timestamp + 10));
        treasury.approve(actionHash);
        vm.warp(block.timestamp + 11);

        (bool executeOk,) = address(treasury).call(abi.encodeWithSelector(treasury.execute.selector, actionHash));
        _assertTrue(!executeOk, "expired action executed");
    }

    function testPolicyUpdatePreservesSameDaySpent() external {
        bytes32 first = treasury.propose(AGENT, address(token), address(0xBEEF), 30, uint64(block.timestamp + 1 days));
        treasury.approve(first);
        treasury.execute(first);

        treasury.setPolicy(AGENT, 70, 70, true);

        (bool secondOk,) = address(treasury).call(
            abi.encodeWithSelector(
                treasury.propose.selector,
                AGENT,
                address(token),
                address(0xBEEF),
                uint256(50),
                uint64(block.timestamp + 1 days)
            )
        );
        _assertTrue(!secondOk, "policy update reset same-day spend");
    }

    function testDailyLimitAcrossExecutedActions() external {
        bytes32 first = treasury.propose(AGENT, address(token), address(0xBEEF), 100, uint64(block.timestamp + 1 days));
        treasury.approve(first);
        treasury.execute(first);

        (bool secondOk,) = address(treasury).call(
            abi.encodeWithSelector(
                treasury.propose.selector,
                AGENT,
                address(token),
                address(0xBEEF),
                uint256(51),
                uint64(block.timestamp + 1 days)
            )
        );
        _assertTrue(!secondOk, "daily policy exceeded");
    }

    function testPauseBlocksMutatingEconomicActions() external {
        treasury.pause();

        (bool depositOk,) = address(treasury).call(
            abi.encodeWithSelector(treasury.deposit.selector, address(token), uint256(1))
        );
        _assertTrue(!depositOk, "deposit worked while paused");

        (bool proposeOk,) = address(treasury).call(
            abi.encodeWithSelector(
                treasury.propose.selector,
                AGENT,
                address(token),
                address(0xBEEF),
                uint256(1),
                uint64(block.timestamp + 1 days)
            )
        );
        _assertTrue(!proposeOk, "proposal worked while paused");

        treasury.unpause();
        bytes32 actionHash = treasury.propose(AGENT, address(token), address(0xBEEF), 1, uint64(block.timestamp + 1 days));
        treasury.approve(actionHash);
        treasury.pause();

        (bool executeOk,) = address(treasury).call(abi.encodeWithSelector(treasury.execute.selector, actionHash));
        _assertTrue(!executeOk, "execution worked while paused");
    }

    function testWithdrawRequiresAllowlistedTokenAndPositiveAmount() external {
        (bool zeroAmountOk,) = address(treasury).call(
            abi.encodeWithSelector(treasury.withdraw.selector, address(token), address(this), uint256(0))
        );
        _assertTrue(!zeroAmountOk, "zero withdrawal allowed");

        treasury.withdraw(address(token), address(this), 10);
        _assertEq(token.balanceOf(address(this)), 10, "withdrawal amount mismatch");
    }

    function testFuzz_DailyLimitEnforced(uint96 rawFirst, uint96 rawSecond) external {
        uint256 firstAmount = (uint256(rawFirst) % 100) + 1;
        uint256 secondAmount = (uint256(rawSecond) % 100) + 1;

        bytes32 first = treasury.propose(AGENT, address(token), address(0xBEEF), firstAmount, uint64(block.timestamp + 1 days));
        treasury.approve(first);
        treasury.execute(first);

        (bool secondOk,) = address(treasury).call(
            abi.encodeWithSelector(
                treasury.propose.selector,
                AGENT,
                address(token),
                address(0xBEEF),
                secondAmount,
                uint64(block.timestamp + 1 days)
            )
        );

        if (firstAmount + secondAmount <= 150) {
            _assertTrue(secondOk, "valid daily spend rejected");
        } else {
            _assertTrue(!secondOk, "daily spend cap bypassed");
        }
    }
}
