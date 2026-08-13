# ARCTIS — Architecture Truth

**Status:** current implementation baseline on `main` as of 2026-08-13.

This is the canonical product/capability reference. When documentation conflicts with runtime configuration, the code/configuration wins and the documentation must be corrected.

## 1. Product model

ARCTIS is a programmable-money operating environment built on Arc Testnet. It combines four product pillars:

1. **AI OS** — AI Workspace, Copilot and task-oriented personas with automatic backend model routing.
2. **Knowledge OS** — workspaces, saved prompts, sessions, agents and bounded report context.
3. **DeFi OS** — user-controlled transfers, ARCTIS OTC swaps and configured cross-chain USDC bridge flows.
4. **Economic Agent OS** — budgeted agents, proposals, live quotes, human approval, execution history, reports and evaluation.

Passport, Membership, Credits and Treasury support these pillars as platform/finance surfaces.

The primary dashboard navigation groups **Agents under AI OS** and money movement under **DeFi OS**. This is information architecture; it does not remove Economic Agent OS as a safety/product pillar.

The dashboard also exposes an **Explore ARCTIS** discovery layer so first-time users can reach Membership, Passport, Move USDC, Economic Agents, Treasury, Knowledge and Copilot without first opening the navigation drawer.

The intended product story is:

`Identity → Membership → Money → Knowledge → Agents → controlled economic action`

## 2. AI OS truth

### Current personas

The current persona registry contains 12 modes:

- Study
- Build
- Analyze
- Research
- Generate
- Treasury
- Developer
- Student
- Teacher
- Professor
- Child
- Engineering

Source: `src/config/ai.ts`.

### Model routing

Users select a persona, not a backend model. The server-side router discovers the configured model pool, ranks candidates using health/latency state and fails over when appropriate.

Current limitation: model health and registry cache are process-local and reset on restart.

### Financial intent

Transfer/Swap/Bridge natural-language intent is parsed into a structured proposal/prefill path. It does not sign or silently submit a transaction.

The intended financial pipeline is:

`intent → deterministic parse → proposal → route/recipient validation → live quote/preflight → human review → wallet approval → execution → confirmation → history/proof`

Source: `src/lib/ai/intent/` and the relevant route/page handlers.

## 3. Knowledge OS truth

Implemented context sources include:

- AI sessions
- saved prompts
- user-owned agents
- recent agent reports / bounded contextual data

This is **not yet** a full PDF/OCR/vector-RAG platform. Do not claim autonomous persistent memory extraction or a dedicated cross-session memory system unless the implementation is added and this file is updated.

## 4. DeFi OS truth

### Transfer

The user's wallet signs the transaction. Server routes coordinate/verify/record operations where required but do not hold the user's signing authority.

Passport recipients can be resolved using the canonical Passport resolver. Manual Transfer and Economic Agent recipient entry share the same validation path.

Transaction UX distinguishes wallet approval from blockchain confirmation. After wallet submission, the user should see a persistent animated **Processing/Confirming** state until the transaction receipt is resolved; final green success is reserved for confirmed execution.

### Swap

ARCTIS has two configured swap surfaces:

1. **ARCTIS OTC:** USDC ↔ tUSDC ↔ tARC using a counterparty settlement wallet. This is not an AMM or DEX pool.
2. **Circle rail:** Circle-supported pair handling in the Swap UI, including **EURC**. EURC is deliberately the last asset in the ARCTIS dropdown.

Circle quote handling is live and route-dependent. If the Circle route is unavailable, the UI surfaces the failure and does not start a wallet transaction.

The Swap UI explicitly displays:

- input amount;
- fee where applicable;
- estimated receive amount;
- route/rail;
- route-unavailable state.

`cirBTC` is not currently exposed in the ARCTIS Swap UI by product choice, even though Arc Testnet/Circle may support it at the infrastructure level.

Transaction lifecycle target: `wallet approval → submitted → processing/confirming → receipt → success/failed`.

Source: `src/app/swap/page.tsx`, `src/lib/swap/circle.ts`, `src/app/api/swap/`.

### Bridge

The bridge uses Circle App Kit with a Viem adapter and configured CCTP testnet metadata.

Configured metadata covers:

- Arc Testnet
- Ethereum Sepolia
- Base Sepolia
- Arbitrum Sepolia

Actual availability is determined by bridge policy and the current route/environment.

Before wallet approval the bridge obtains a live quote and surfaces:

- amount sent;
- provider fee;
- forwarding fee;
- gas fee where returned;
- **estimated receive**.

Bridge UX must distinguish source submission from final bridge completion; processing remains visible while the relevant operation is awaiting confirmation/completion.

Source: `src/app/bridge/page.tsx`, `src/lib/contracts.ts`, `src/lib/bridge/`, `src/app/api/bridge/`.

## 5. Economic Agent OS truth

The mandatory safety boundary is:

```text
Agent intent
   ↓
Proposal
   ↓
Recipient / route validation
   ↓
Live quote + preflight
   ↓
Expected receive shown
   ↓
Human review
   ↓
Wallet approval
   ↓
Transaction submitted
   ↓
Processing / confirmation
   ↓
Confirmed / failed
   ↓
Persist execution / report / ledger
```

The approval boundary is enforced in the agent/service/execution path, not only as a UI convention.

Economic Agent recipient entry uses `useRecipientValidation`, the same canonical validation path used by Manual Transfer. `.arc` Passport identifiers therefore resolve/validate while typing.

Agents do not receive a hidden user private key and do not silently sign user-wallet Transfer/Swap/Bridge transactions.

The Economic Agent **Running/Processing** state is intended to remain active until the underlying transaction confirmation boundary is reached. Once confirmed, the existing green success presentation and transaction hash remain the terminal success state.

## 6. Passport identity truth

Passport is a wallet-linked identity/profile layer with:

- `.arc` username creation and public resolution;
- owner profile editing;
- profile photo add during creation;
- profile photo add/change/remove after creation;
- owner navigation back to ARCTIS Home;
- wallet-linked public profile surface.

Photo handling is a profile feature, not a transaction authorization mechanism.

## 7. Membership, credits and finance

Canonical billing source: `src/config/billing.ts`.

Membership entitlements and credit balances are persisted separately. Treasury is an observer/accounting surface and is not a hidden transaction executor.

Membership is intentionally surfaced in the dashboard discovery layer as a core product capability rather than being discoverable only through the navigation drawer.

## 8. Asset truth

### Arc/native and ARCTIS assets

| Asset | Role | Status |
|---|---|---|
| USDC | Arc Native USDC; primary payment/gas asset | Executable |
| tUSDC | ARCTIS OTC test asset | Executable |
| tARC | ARCTIS OTC test asset; not an official Arc token | Executable |

### Circle Swap surface

| Asset | ARCTIS UI status | Note |
|---|---|---|
| EURC | Exposed | Last Circle asset in dropdown; live route/quote availability is environment-dependent |
| cirBTC | Intentionally hidden | Not part of current ARCTIS Swap product surface |

The Circle rail is maintained separately from the canonical OTC asset registry because Circle asset execution depends on the active Circle/App Kit integration and current Arc Testnet conditions.

## 9. Data architecture

The browser does not directly operate on sensitive Firestore collections. Server-side API routes use Firebase Admin SDK for persistence.

Primary collections include:

- `transactions`
- `activity`
- `treasury_logs`
- `bridge_pending`
- `swap_records`
- `passports`
- `agents`
- `agent_executions`
- `agent_reports`
- `agent_ledger`
- `credit_balances`
- `credit_ledger`
- `memberships`
- `ai_sessions`
- `saved_prompts`
- `obs_logs`
- `rate_limits`

See `DATABASE.md` for schema/index details.

## 10. Activity and History truth

`/api/activity` is the shared aggregation source for user-facing activity data. **History** is the canonical user-facing historical surface.

Transaction UI state and History are separate concerns: the live confirmation state communicates the current operation, while History provides the durable historical record.

Do not introduce competing transaction/history stores without an explicit architecture decision.

## 11. Navigation truth

Primary navigation:

```text
Overview
  Dashboard
  History

AI OS
  Copilot
  Agents

DeFi OS
  Transfer
  Swap
  Bridge

Knowledge OS
  Workspace
  Knowledge

Finance
  Treasury
  Membership
  Credits

Platform
  Settings
  Feedback
```

Dashboard discovery additionally surfaces Membership, Passport, Move USDC, Economic Agents, Treasury, Knowledge and Copilot as direct entry points.

Command Palette and secondary navigation should use the same terminology.

## 12. Internationalization truth

The product has one persisted locale selector with:

English, Hindi, Spanish, Portuguese, Chinese, Korean, Vietnamese, French, Swahili and Arabic.

Arabic includes RTL handling.

## 13. Security boundary

The intended money-control boundary is:

```text
User intent
   ↓
Validation / policy
   ↓
Server coordination + verification
   ↓
User wallet / Circle App Kit signing
   ↓
Onchain settlement
   ↓
Receipt confirmation
   ↓
Persistence / explorer / history
```

No ARCTIS server component should be described as possessing the user's wallet signing authority.

Important testnet limitation: not every mutating API route currently has the same cryptographic wallet-proof level. See `SECURITY.md` for route-level posture and remaining hardening work.

## 14. Animation and interaction truth

Framer Motion is used for product transitions and interaction feedback. Animation communicates state/hierarchy rather than decorative motion.

Transaction processing animation is functional state feedback: a subtle pulse/spinner communicates that an onchain operation has been submitted and is awaiting confirmation. It must not imply success before a receipt is confirmed. Reduced-motion preferences should be respected.

The repository architecture illustration (`docs/architecture-flow.svg`) is a self-contained SVG/CSS animation. Dashed animated paths represent control/data flow; pulsing nodes represent active hand-offs; the layers show product pillars → orchestration/policy → persistence/AI routing/Arc + Circle rails.

The animation is intentionally dependency-free so GitHub visitors can understand the architecture without executing the application.

## 15. Onchain application-layer foundation

The repository includes an initial Solidity foundation for future ARCTIS Economic Agent capabilities:

- `ARCTISAgentTreasury.sol` — bounded application-layer treasury design for agent-controlled actions under explicit policy/authorization.
- `ARCTISAgentEscrow.sol` — application-layer escrow design for controlled economic jobs/payment flows.

These are **ARCTIS-owned application contracts**, distinct from Arc/Circle infrastructure contracts such as USDC/CCTP.

Current documentation status is intentionally conservative:

- scaffold/design: documented;
- deployment: **not claimed until verified on Arc Testnet**;
- audit: **not performed**;
- production integration: **not claimed**.

The existing Transfer/Swap/Bridge rails remain the canonical live transaction surfaces until these contracts pass compile, tests, deployment and verification gates.

## 16. Configuration sources of truth

- AI personas → `src/config/ai.ts`
- Billing → `src/config/billing.ts`
- Arc/native executable assets → `src/config/assets.ts`
- Network/contracts → `src/lib/contracts.ts`
- Circle Swap pair logic → `src/lib/swap/circle.ts`
- Bridge policy → `src/lib/bridge/policy.ts`
- AI routing → `src/lib/ai/router/`
- Product context → `src/lib/ai/copilot/product-context.ts`

Never duplicate mutable configuration values in documentation or UI when they can be derived from code.

## 17. Product claims policy

ARCTIS should use precise language:

- **Built on Arc** — yes.
- **Arc Testnet** — yes for the configured network.
- **Uses Circle tooling** — yes where the repository actually integrates Circle App Kit/CCTP.
- **Official Circle/Arc partner** — do not claim unless formally approved.
- **Production-ready/mainnet** — do not claim while the product remains testnet-stage.
- **Autonomous wallet custody** — do not claim.
- **Official tARC token** — do not claim.
- **Treasury/Escrow deployed** — do not claim until the contracts are actually deployed and verified.

The repository is intentionally explicit about the difference between implemented, configured, route-dependent, scaffolded and future capabilities.
