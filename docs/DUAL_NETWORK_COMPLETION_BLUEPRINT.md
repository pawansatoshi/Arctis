# ARCTIS Dual-Network Completion Blueprint

**Goal:** complete ARCTIS for Arc Testnet and Arc Mainnet without regressing the existing working Testnet product.

**Non-negotiable:** Testnet is the protected baseline. Prefer additive network-scoped Mainnet changes. Every shared-code change must include regression evidence. Never silently fall back from Mainnet to Testnet, invent protocol addresses/liquidity, fake receipts, or claim unverified completion.

## Completion definitions
- **Implemented:** code exists; runtime may remain unverified.
- **Verified:** required automated checks passed with evidence.
- **Live verified:** an end-to-end smoke test succeeded on the intended network.
- **Blocked:** external protocol support, liquidity, credentials, independent audit or explicit owner authorization is missing.

## Target architecture
The selected network must determine wallet chain, RPC, clients, official token/contract and decimals, balance/gas preflight, transaction submission/receipt, server verification, persisted chain metadata, history/activity, explorer links and supported feature flags. Server routes must validate explicit network context and derive chain-sensitive facts from trusted profiles. Client-supplied chain IDs, token addresses, recipient, amount, receipt status and explorer URLs are not trusted without verification. All failures fail closed.

## Phase 0 — Protect and baseline Testnet
- Record known-good Testnet baseline and current production commit.
- Inventory user-facing features, API routes, contracts, environment variables and external protocols.
- Capture Testnet behavior before shared-code changes; cover wallet, switching, balances, transfers, agents, history, membership, credits, settings, swap, bridge and contracts where present.
- Preserve rollback and use focused branches/PRs.
- **Exit:** baseline tests pass before and after changes; any Testnet regression blocks merge.

## Phase 1 — Network boundary and security
- Centralize typed network profiles; keep chain ID, RPC, explorer, native currency and token/contract metadata network-specific.
- Treat browser selection as user intent, not server authority. Require explicit validated network context in chain-sensitive APIs.
- Reject unknown networks, invalid chain IDs, wrong-chain hashes, mismatched token contracts and cross-network replay/recording attempts.
- Audit authentication, replay protection, validation, rate limits and idempotency for financial routes.
- **Exit:** negative tests prove wrong-chain and contract-mismatch requests fail closed; Mainnet cannot use Testnet RPC/assets.

## Phase 2 — Wallet, assets, transfer and receipts
- Verify official Arc network and native USDC/gas semantics against authoritative docs; independently verify production ERC-20 USDC address/decimals.
- Bind reads, gas estimates and writes to selected chain; validate recipient, amount precision, token balance and gas before wallet approval.
- Track submitted/pending/confirmed/failed; never show success before a verified successful receipt. Verify receipt chain, hash, status, sender, destination, asset and amount as applicable.
- Test rejection, insufficient funds, RPC failure, revert and chain change during pending action.
- **Exit:** Testnet flow remains unchanged; controlled Mainnet smoke test is explicitly authorized and explorer-verified. CI never submits live-money transactions.

## Phase 3 — History, APIs and product surfaces
- Audit membership, credits, activity, treasury logs, memos/proofs, onboarding, settings and history for hardcoded network assumptions.
- Bind payment verification to the actual transaction network, not just deployment-level defaults. Derive explorer links from trusted profiles and prevent cross-network record attribution.
- Update labels, faucet links, unsupported-feature messages and docs.
- **Exit:** a transaction on one chain cannot grant entitlement/credits on the other; history and activity show the correct network. Testnet records remain intact.

## Phase 4 — Agent workflows
- Trace intent → proposal → preflight → review → wallet approval → submission → receipt → history.
- Bind and revalidate network, recipient, amount and asset immediately before execution. Agent text is never authorization; wallet approval remains required.
- Test duplicate/stale proposals, chain switching, rejection, timeout, revert and recovery. Keep production custody execution disabled until its security gate passes.
- **Exit:** no bypass of approval/network guards; failed or unconfirmed transactions never report success; Testnet demos pass.

## Phase 5 — Swap and bridge
- Preserve supported Testnet routes. Verify Mainnet protocol support, official identifiers/addresses, token support, fees, route availability, actual liquidity and settlement.
- Validate quote freshness, slippage, minimum received, deadline, chain and token pair. For bridges verify source transaction, message/attestation, destination execution, finality and recovery.
- **Exit:** enable only real production routes with verified settlement. Otherwise show exact blocker and keep disabled; never reuse Testnet routes on Mainnet.

## Phase 6 — Treasury, escrow and custody
- Review access control, authorization, reentrancy, upgradeability, emergency controls, token handling, accounting and recovery. Run unit/integration/fuzz/invariant/static analysis as applicable.
- Obtain independent security review before custody. Deploy only with secured deployer and explicit owner authorization. Verify source/bytecode, initialization and roles on official explorer; record addresses only after on-chain confirmation.
- **Exit:** no unaudited/unverified contract handles Mainnet funds. Treasury/Escrow remain disabled if any gate is incomplete; preserve Testnet tests.

## Phase 7 — CI, deployment and operations
- Run actual TypeScript/type checks, lint, unit/integration, network regression, Solidity tests, architecture checks and production build.
- Test invalid chain IDs, switching, wrong contracts, cross-network API attacks, failed receipts and history consistency.
- Review focused PRs; verify preview, deployed commit SHA and environment configuration. Run independent Testnet and Mainnet smoke tests. Document limitations, monitoring and rollback.
- **Exit:** required checks pass on exact merge commit; production serves reviewed commit; separate smoke evidence exists for both networks. Vercel READY alone is insufficient.

## Feature acceptance matrix
| Feature | Testnet acceptance | Mainnet acceptance |
|---|---|---|
| Selector/wallet | Existing flow/switch tests pass | Correct chain verified before reads/writes |
| Balances/gas | Existing behavior preserved | Production asset metadata and live reads verified |
| Manual transfer | Baseline passes | Correct asset/chain, receipt and history smoke test |
| History/activity | Existing records valid | Network-specific records and explorer verified |
| Membership/credits | Existing payment checks pass | Actual chain/payment verified before entitlement |
| Agent | Existing demo paths pass | Proposal, revalidation, approval, execution and receipt verified |
| Swap | Supported Testnet routes pass | Real route/liquidity/settlement verified or disabled |
| Bridge | Supported Testnet routes pass | Production protocol/destination settlement verified or disabled |
| Treasury/escrow | Existing tests preserved | Independent review and verified lifecycle or disabled |
| Settings/onboarding | No regression | Accurate capabilities, links and errors |

## PR and release discipline
- Keep PRs focused; record scope, threat addressed, tests/results and blockers.
- Do not merge with required checks pending/failing. Never store private keys or seed phrases in GitHub/source/logs/browser-exposed variables.
- No live-money transfers, custody deployments or production secret changes without explicit authorization.
- Finish safe code/tests despite external blockers; document the blocker rather than faking completion.

## Current state
This is the target plan, not proof that phases passed. Keep status checkboxes unchecked until evidence exists. Update MAINNET_ROADMAP_STATUS.md as phases are verified.
