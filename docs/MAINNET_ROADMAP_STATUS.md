# ARCTIS Dual-Network Roadmap Status

**Goal:** complete ARCTIS for Arc Testnet and Arc Mainnet without regressing the existing working Testnet product.

**Blueprint:** [DUAL_NETWORK_COMPLETION_BLUEPRINT.md](./DUAL_NETWORK_COMPLETION_BLUEPRINT.md)

Status meanings: **Implemented** = source exists; **Verified** = automated checks passed with evidence; **Live verified** = end-to-end smoke test succeeded on intended network; **Blocked** = external support, liquidity, credentials, audit or owner authorization is missing. Do not mark complete based only on UI presence or successful build.

## Phase 0 — Testnet baseline and protection
- [ ] Record known-good Testnet baseline and current production commit.
- [ ] Inventory features, APIs, contracts, environment variables and external integrations.
- [ ] Run and record existing Testnet regression suite before Mainnet changes.
- [ ] Confirm rollback procedure and focused PR workflow.
- [ ] Re-run Testnet regression after every shared/network-sensitive change.

## Phase 1 — Network isolation and security
- [x] Arc Testnet chain profile exists (5042002; https://rpc.testnet.arc.io).
- [x] Arc Mainnet chain profile exists (5042; https://rpc.mainnet.arc.io).
- [x] Independent wallet chain definitions/transports exist in source.
- [ ] Verify selector, wallet chain, RPC, assets and feature flags align at runtime.
- [ ] Enforce explicit network context and server-side chain/contract verification for money-sensitive APIs.
- [ ] Test invalid chain IDs, wrong-chain hashes, incorrect token contracts and cross-network API attacks.

## Phase 2 — Wallet, assets, transfers and receipts
- [x] Network-aware transfer path exists in source.
- [x] Recipient/amount preflight, balance reads and gas estimation exist in source.
- [ ] Independently verify official production asset addresses and decimals/gas semantics.
- [ ] Test submitted/pending/confirmed/failed states and failed receipts on both networks.
- [ ] Complete explicitly authorized, controlled Mainnet transfer smoke test.
- [ ] Verify receipt and history on official explorer.

## Phase 3 — History, payment APIs and product surfaces
- [ ] Audit membership, credits, activity, treasury logs, memos, history, settings and onboarding for hardcoded network assumptions.
- [ ] Bind payment verification to actual transaction chain and verified asset/recipient/amount.
- [ ] Test a transaction from one chain cannot grant entitlements or credits on the other.
- [ ] Verify labels, explorer links, faucet links and unsupported-feature errors.
- [ ] Confirm Testnet records and workflows remain intact.

## Phase 4 — Agent workflows
- [ ] Test intent → proposal → preflight → wallet approval → submission → receipt → history.
- [ ] Revalidate network, recipient, amount and asset immediately before execution.
- [ ] Test chain switching, rejected approvals, stale proposals, duplicates and failures.
- [ ] Keep production custody/treasury execution disabled until Phase 6 gates pass.

## Phase 5 — Swap and bridge
- [x] Existing Testnet-oriented routes are gated from Mainnet in source.
- [ ] Verify official production protocol support, identifiers, routes and liquidity.
- [ ] Verify quotes, slippage, fees, source transaction and destination settlement.
- [ ] Enable only real verified integrations; otherwise document blocker and keep disabled.

## Phase 6 — Treasury and escrow
- [x] Contract source/test scaffolding is preserved.
- [x] Unverified Treasury/Escrow is not assumed production-ready.
- [ ] Complete contract threat model and automated security tests.
- [ ] Obtain independent review before production custody.
- [ ] Deploy using secured deployer only with explicit authorization.
- [ ] Verify source, address, roles and lifecycle on-chain.
- [ ] Enable flags only after all checks pass.

## Phase 7 — CI, release and deployment
- [ ] Type checks, lint, unit/integration, network regression, Solidity tests and production build pass on exact candidate commit.
- [ ] Review and merge focused PRs only after required checks pass.
- [ ] Verify Vercel preview READY and tied to reviewed commit.
- [ ] Verify production commit SHA and environment configuration.
- [ ] Record independent Testnet and Mainnet smoke-test evidence.
- [ ] Publish final feature matrix and unavoidable external blockers.

## Known external / owner-dependent gates
- Mainnet swap requires verified production routes and actual liquidity/settlement.
- Mainnet bridge requires verified protocol support, official identifiers and end-to-end settlement.
- Treasury/escrow production use requires independent security review, secured deployment and explicit authorization.
- A live-money transfer requires explicit authorization; it must never be automated by CI.

## Release rule
Testnet is the protected baseline. Any regression blocks the PR. Mainnet features fail closed when configuration, contracts, route support or receipts cannot be verified. No feature is complete without evidence.
