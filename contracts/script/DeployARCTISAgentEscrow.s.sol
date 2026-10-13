// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "forge-std/Script.sol";
import "../ARCTISAgentEscrow.sol";

/// @notice Deployment script for ARCTISAgentEscrow on Arc Mainnet (chain ID 5042).
///
/// Usage:
///   forge script contracts/script/DeployARCTISAgentEscrow.s.sol \
///     --rpc-url https://rpc.mainnet.arc.io \
///     --broadcast \
///     --verify \
///     --verifier blockscout \
///     --verifier-url https://explorer.arc.io/api \
///     -vvvv
///
/// Constructor argument:
///   initialOwner — the wallet address that will own the contract after deployment.
///   Set DEPLOYER_ADDRESS in your environment; it defaults to the broadcast sender.
///
/// The deployment address is deterministic given the deployer nonce. Record the
/// printed contract address, transaction hash and block number in AGENTS.md and
/// the hackathon submission notes.
contract DeployARCTISAgentEscrow is Script {
    function run() external returns (ARCTISAgentEscrow escrow) {
        // Owner defaults to the broadcast sender (deployer wallet).
        // Override by setting OWNER_ADDRESS env var.
        address owner = vm.envOr("OWNER_ADDRESS", msg.sender);
        require(owner != address(0), "DeployARCTISAgentEscrow: owner is zero address");

        vm.startBroadcast();
        escrow = new ARCTISAgentEscrow(owner);
        vm.stopBroadcast();

        console2.log("=== ARCTISAgentEscrow deployed ===");
        console2.log("Address :", address(escrow));
        console2.log("Owner   :", escrow.owner());
        console2.log("ARC USDC:", escrow.ARC_USDC());
        console2.log("Chain ID:", block.chainid);
        console2.log("Explorer: https://explorer.arc.io/address/%s", address(escrow));
    }
}
