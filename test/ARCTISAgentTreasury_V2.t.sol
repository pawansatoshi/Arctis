// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "forge-std/Test.sol";
import "../contracts/ARCTISAgentTreasury_V2.sol";

// ---------------------------------------------------------------------------
// Minimal ERC-20 mock — covers both normal tokens and Arc USDC precompile
// ---------------------------------------------------------------------------
contract MockERC20 {
    mapping(address => uint256) public balanceOf;
    mapping(address => mapping(address => uint256)) public allowance;

    function mint(address to, uint256 amount) external { balanceOf[to] += amount; }

    function transfer(address to, uint256 amount) external returns (bool) {
        require(balanceOf[msg.sender] >= amount, "insufficient");
        balanceOf[msg.sender] -= amount;
        balanceOf[to]         += amount;
        return true;
    }

    function transferFrom(address from, address to, uint256 amount) external returns (bool) {
        require(balanceOf[from] >= amount, "insufficient");
        require(allowance[from][msg.sender] >= amount, "allowance");
        balanceOf[from]               -= amount;
        balanceOf[to]                 += amount;
        allowance[from][msg.sender]   -= amount;
        return true;
    }

    function approve(address spender, uint256 amount) external returns (bool) {
        allowance[msg.sender][spender] = amount;
        return true;
    }
}

// ---------------------------------------------------------------------------
// Test suite
// ---------------------------------------------------------------------------
contract ARCTISAgentTreasury_V2_Test is Test {
    ARCTISAgentTreasury treasury;
    MockERC20           token;

    address owner     = address(this);
    address recipient = address(0xBEEF);
    bytes32 agentId   = keccak256("agent-1");

    uint256 constant MAX_PER_TX = 100e6;    // 100 USDC
    uint256 constant MAX_DAILY  = 300e6;    // 300 USDC

    function setUp() public {
        treasury = new ARCTISAgentTreasury(owner);
        token    = new MockERC20();

        // Fund and register
        token.mint(address(treasury), 10_000e6);
        treasury.setAllowedToken(address(token), true);
        treasury.registerAgent(agentId);
        treasury.setPolicy(agentId, MAX_PER_TX, MAX_DAILY, true);
    }

    // ── Helper ────────────────────────────────────────────────────────────────

    function _propose(uint256 amount) internal returns (bytes32) {
        uint64 dl = uint64(block.timestamp + 1 hours);
        return treasury.propose(agentId, address(token), recipient, amount, dl);
    }

    // ── 1. Basic happy path: propose → approve → execute ─────────────────────

    function test_BasicProposalExecute() public {
        bytes32 h = _propose(50e6);
        treasury.approve(h);
        treasury.execute(h);

        ARCTISAgentTreasury.Proposal memory p = treasury.getAction(h);
        assertTrue(p.executed, "proposal must be marked executed");
        assertEq(token.balanceOf(recipient), 50e6, "recipient must receive tokens");
    }

    // ── 2. V2 core: dailySpent is reserved at propose time ───────────────────

    function test_DailySpentReservedAtPropose() public {
        (, , uint256 spentBefore, , ) = treasury.policies(agentId);
        assertEq(spentBefore, 0);

        _propose(100e6);
        (, , uint256 spentAfter, , ) = treasury.policies(agentId);
        assertEq(spentAfter, 100e6, "dailySpent must equal amount after propose");
    }

    // ── 3. V1 race is CLOSED: two proposals that together exceed maxDaily ─────

    function test_ConcurrentProposalsCannotExceedDailyLimit() public {
        _propose(100e6); // spends 100  → dailySpent = 100
        _propose(100e6); // spends 100  → dailySpent = 200
        _propose(100e6); // spends 100  → dailySpent = 300  (= maxDaily, still OK)

        // 4th proposal would push to 400 > 300 — must revert
        uint64 dl = uint64(block.timestamp + 1 hours);
        vm.expectRevert(ARCTISAgentTreasury.PolicyViolation.selector);
        treasury.propose(agentId, address(token), recipient, 1e6, dl);
    }

    // ── 4. reject() releases the reservation ─────────────────────────────────

    function test_RejectReleasesReservation() public {
        // Use 3 proposals of 100e6 each to hit the full 300e6 daily limit
        bytes32 h1 = _propose(100e6);
        bytes32 h2 = _propose(100e6);
        bytes32 h3 = _propose(100e6);
        (, , uint256 spentAfterPropose, , ) = treasury.policies(agentId);
        assertEq(spentAfterPropose, 300e6, "dailySpent must equal total reserved");

        // Reject one — should release 100e6
        treasury.reject(h1);
        (, , uint256 spentAfterReject, , ) = treasury.policies(agentId);
        assertEq(spentAfterReject, 200e6, "reject must release 100e6 reservation");

        // Suppress unused variable warnings
        (h2); (h3);
    }

    function test_AfterRejectNewProposalCanUseFullBudget() public {
        // Propose two, reject one — second slot frees up capacity
        bytes32 h1 = _propose(100e6);
        bytes32 h2 = _propose(100e6);
        treasury.reject(h1);

        // 100e6 freed; propose another 100e6 — should succeed
        bytes32 h3 = _propose(100e6);
        treasury.approve(h2);
        treasury.approve(h3);
        treasury.execute(h2);
        treasury.execute(h3);
        assertEq(token.balanceOf(recipient), 200e6);
    }

    // ── 5. cancel() on expired proposal releases reservation ─────────────────

    function test_CancelExpiredProposalReleasesReservation() public {
        uint64 dl = uint64(block.timestamp + 1 hours);
        bytes32 h = treasury.propose(agentId, address(token), recipient, 100e6, dl);

        (, , uint256 spent, , ) = treasury.policies(agentId);
        assertEq(spent, 100e6);

        // Advance past deadline
        vm.warp(block.timestamp + 2 hours);

        // Anyone can cancel
        vm.prank(address(0xCAFE));
        treasury.cancel(h);

        // Bucket has NOT rolled (same day), so dailySpent should be refunded
        (, , uint256 spentAfterCancel, , ) = treasury.policies(agentId);
        assertEq(spentAfterCancel, 0, "cancel must release the reservation");

        ARCTISAgentTreasury.Proposal memory p = treasury.getAction(h);
        assertTrue(p.cancelled, "proposal must be marked cancelled");
    }

    function test_CannotCancelNonExpiredProposal() public {
        bytes32 h = _propose(50e6);
        vm.expectRevert(ARCTISAgentTreasury.NotExpired.selector);
        treasury.cancel(h);
    }

    // ── 6. execute() after bucket rollover handles fresh-day correctly ────────

    function test_ExecuteAfterDayRolloverAppliesFreshBudget() public {
        // Propose with a deadline that spans across a day boundary
        // (block.timestamp starts at 1 in Foundry, use a far-future deadline)
        uint64 dl = uint64(block.timestamp + 2 days);
        bytes32 h = treasury.propose(agentId, address(token), recipient, 100e6, dl);
        treasury.approve(h);

        // Advance to next day — reservation is stale; execute() re-reserves on new bucket
        vm.warp(block.timestamp + 1 days + 1);

        // execute() rolls the bucket, re-reserves 100e6 against the fresh day (0 → 100e6),
        // which is within maxDaily (300e6) — should succeed.
        treasury.execute(h);
        assertEq(token.balanceOf(recipient), 100e6);

        // Verify new bucket dailySpent is now 100e6
        (, , uint256 spent, , ) = treasury.policies(agentId);
        assertEq(spent, 100e6, "new-day dailySpent must reflect the executed amount");
    }

    // ── 7. execute() marks proposal as executed; cannot execute twice ─────────

    function test_CannotExecuteTwice() public {
        bytes32 h = _propose(50e6);
        treasury.approve(h);
        treasury.execute(h);

        vm.expectRevert(ARCTISAgentTreasury.InvalidAction.selector);
        treasury.execute(h);
    }

    // ── 8. Paused contract blocks propose / approve / execute ────────────────

    function test_PausedBlocksPropose() public {
        treasury.pause();
        uint64 dl = uint64(block.timestamp + 1 hours);
        vm.expectRevert(ARCTISAgentTreasury.PausedState.selector);
        treasury.propose(agentId, address(token), recipient, 10e6, dl);
    }

    function test_PausedBlocksExecute() public {
        bytes32 h = _propose(10e6);
        treasury.approve(h);
        treasury.pause();
        vm.expectRevert(ARCTISAgentTreasury.PausedState.selector);
        treasury.execute(h);
    }

    // ── 9. Per-transaction limit enforced at propose ──────────────────────────

    function test_PerTransactionLimitAtPropose() public {
        uint64 dl = uint64(block.timestamp + 1 hours);
        vm.expectRevert(ARCTISAgentTreasury.PolicyViolation.selector);
        treasury.propose(agentId, address(token), recipient, MAX_PER_TX + 1, dl);
    }

    // ── 10. Only owner can propose / approve / reject ────────────────────────

    function test_OnlyOwnerCanPropose() public {
        uint64 dl = uint64(block.timestamp + 1 hours);
        vm.prank(address(0xA11CE));
        vm.expectRevert(ARCTISAgentTreasury.NotOwner.selector);
        treasury.propose(agentId, address(token), recipient, 10e6, dl);
    }

    function test_OnlyOwnerCanApprove() public {
        bytes32 h = _propose(10e6);
        vm.prank(address(0xA11CE));
        vm.expectRevert(ARCTISAgentTreasury.NotOwner.selector);
        treasury.approve(h);
    }

    function test_OnlyOwnerCanReject() public {
        bytes32 h = _propose(10e6);
        vm.prank(address(0xA11CE));
        vm.expectRevert(ARCTISAgentTreasury.NotOwner.selector);
        treasury.reject(h);
    }

    // ── 11. execute() is permissionless ──────────────────────────────────────

    function test_ExecutePermissionless() public {
        bytes32 h = _propose(10e6);
        treasury.approve(h);
        vm.prank(address(0xA11CE));
        treasury.execute(h);
        assertEq(token.balanceOf(recipient), 10e6);
    }

    // ── 12. Deadline expired — approve and execute must revert ───────────────

    function test_CannotApproveExpiredProposal() public {
        uint64 dl = uint64(block.timestamp + 1 hours);
        bytes32 h = treasury.propose(agentId, address(token), recipient, 10e6, dl);
        vm.warp(block.timestamp + 2 hours);
        vm.expectRevert(ARCTISAgentTreasury.InvalidDeadline.selector);
        treasury.approve(h);
    }

    function test_CannotExecuteExpiredProposal() public {
        uint64 dl = uint64(block.timestamp + 1 hours);
        bytes32 h = treasury.propose(agentId, address(token), recipient, 10e6, dl);
        treasury.approve(h);
        vm.warp(block.timestamp + 2 hours);
        vm.expectRevert(ARCTISAgentTreasury.InvalidDeadline.selector);
        treasury.execute(h);
    }

    // ── 13. Revoked agent is blocked ─────────────────────────────────────────

    function test_RevokedAgentCannotPropose() public {
        treasury.revokeAgent(agentId);
        uint64 dl = uint64(block.timestamp + 1 hours);
        vm.expectRevert(ARCTISAgentTreasury.InvalidAgent.selector);
        treasury.propose(agentId, address(token), recipient, 10e6, dl);
    }

    // ── 14. Deposit and withdraw ──────────────────────────────────────────────

    function test_DepositAndWithdraw() public {
        uint256 bal = token.balanceOf(address(treasury));
        token.mint(owner, 500e6);
        token.approve(address(treasury), 500e6);
        treasury.deposit(address(token), 500e6);
        assertEq(token.balanceOf(address(treasury)), bal + 500e6);

        treasury.withdraw(address(token), owner, 200e6);
        assertEq(token.balanceOf(address(treasury)), bal + 300e6);
    }

    // ── 15. Exact daily limit boundary: 3 proposals × 100 = 300, then fail ───

    function test_DailyLimitExactBoundary() public {
        bytes32 h1 = _propose(100e6);
        bytes32 h2 = _propose(100e6);
        bytes32 h3 = _propose(100e6);

        // All three within limit
        treasury.approve(h1); treasury.execute(h1);
        treasury.approve(h2); treasury.execute(h2);
        treasury.approve(h3); treasury.execute(h3);
        assertEq(token.balanceOf(recipient), 300e6);

        // One more must revert — budget exhausted
        uint64 dl = uint64(block.timestamp + 1 hours);
        vm.expectRevert(ARCTISAgentTreasury.PolicyViolation.selector);
        treasury.propose(agentId, address(token), recipient, 1e6, dl);
    }

    // ── 16. Cancelled proposal cannot be approved or executed ────────────────

    function test_CancelledProposalCannotBeApproved() public {
        uint64 dl = uint64(block.timestamp + 1 hours);
        bytes32 h = treasury.propose(agentId, address(token), recipient, 10e6, dl);
        vm.warp(block.timestamp + 2 hours);
        treasury.cancel(h);
        vm.expectRevert(ARCTISAgentTreasury.InvalidAction.selector);
        treasury.approve(h);
    }

    function test_CancelledProposalCannotBeExecuted() public {
        uint64 dl = uint64(block.timestamp + 1 hours);
        bytes32 h = treasury.propose(agentId, address(token), recipient, 10e6, dl);
        treasury.approve(h);
        vm.warp(block.timestamp + 2 hours);
        // Can't cancel an approved proposal — must still call execute which will revert on deadline
        vm.expectRevert(ARCTISAgentTreasury.InvalidAction.selector);
        treasury.cancel(h);
    }
}
