// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "../ARCTISAgentEscrow.sol";

/// @title DeployARCTISAgentEscrow
/// @notice Lightweight deployment script for ARCTISAgentEscrow on Arc Mainnet.
///
/// This script uses the Forge cheatcode VM interface directly (no forge-std import)
/// so it compiles cleanly in CI environments where lib/forge-std is not present.
///
/// ─── How to deploy ───────────────────────────────────────────────────────────
///
///   # 1. Set the intended owner of the contract.
///   #    Defaults to the broadcast sender (deployer wallet) if unset.
///   export OWNER_ADDRESS=0xb467F683764593316fAEbB0709127E90791Fe47F
///
///   # 2. Run with forge against Arc Mainnet.
///   forge script contracts/script/DeployARCTISAgentEscrow.s.sol \
///     --rpc-url https://rpc.mainnet.arc.io \
///     --broadcast \
///     --verify \
///     --verifier blockscout \
///     --verifier-url https://explorer.arc.io/api \
///     -vvvv
///
///   # 3. Record the printed contract address, tx hash, and block number
///   #    in README.md and docs/hackathon-submission.md.
///
/// ─── Constructor argument ────────────────────────────────────────────────────
///
///   initialOwner — The address that will own the deployed contract.
///   Set OWNER_ADDRESS in the shell environment; defaults to tx.origin (deployer).
///   The owner can call pause/unpause, resolveDispute, and transferOwnership.
///
/// ─── Arc Mainnet facts (on-chain verified) ───────────────────────────────────
///
///   Chain ID : 5042
///   RPC      : https://rpc.mainnet.arc.io
///   Explorer : https://explorer.arc.io
///   USDC     : 0x3600000000000000000000000000000000000000  (symbol=USDC, decimals=6)
///   Treasury : 0xb467F683764593316fAEbB0709127E90791Fe47F  (active EOA, USDC balance confirmed)
///
/// ─────────────────────────────────────────────────────────────────────────────

interface IVm {
    function envOr(string calldata name, address defaultValue) external view returns (address);
    function startBroadcast() external;
    function stopBroadcast() external;
}

contract DeployARCTISAgentEscrow {
    IVm internal constant vm = IVm(address(uint160(uint256(keccak256("hevm cheat code")))));

    function run() external returns (ARCTISAgentEscrow escrow) {
        address owner = vm.envOr("OWNER_ADDRESS", tx.origin);
        require(owner != address(0), "DeployARCTISAgentEscrow: owner is zero address");

        vm.startBroadcast();
        escrow = new ARCTISAgentEscrow(owner);
        vm.stopBroadcast();
    }
}
