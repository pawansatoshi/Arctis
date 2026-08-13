<div align="center">
  <img src="./public/icons/logo.svg" alt="ARCTIS" width="84" height="84" />
  <h1>ARCTIS</h1>
  <p><strong>Programmable money for humans and AI agents.</strong></p>
  <p>AI · Knowledge · Stablecoins · Economic Agents · Identity · Membership</p>
  <p><strong>Built on Arc Testnet</strong> · wallet-controlled · live public testnet build</p>
</div>

---

## What is ARCTIS?

ARCTIS is an **AI operating environment for programmable money** built on Arc Testnet. It combines AI assistance, bounded knowledge context, stablecoin operations, human-readable identity, membership and Economic Agents in one product.

The core thesis is not "AI with a wallet". It is a controlled execution pipeline:

```text
Natural-language intent
        ↓
Deterministic interpretation / policy
        ↓
Proposal
        ↓
Live quote + preflight
        ↓
Human review
        ↓
Wallet approval
        ↓
Transaction submitted
        ↓
Processing / confirmation
        ↓
Onchain execution
        ↓
History / proof / accounting
```

> **ARCTIS is the application layer. Arc is the settlement infrastructure.**

### Live product

- **Demo:** https://arctis-zeta.vercel.app
- **Repository:** https://github.com/pawansatoshi/Arctis
- **Network:** Arc Testnet (`5042002`)
- **Primary payment/gas asset:** Arc Native USDC

For a Circle reviewer or hackathon judge, start with [`docs/README-EVALUATION.md`](./docs/README-EVALUATION.md).

---

## Product architecture

ARCTIS has four connected operating-system pillars:

### AI OS

AI Workspace, Copilot and 12 task-oriented personas with server-side model routing and health-aware failover.

### Knowledge OS

Workspaces, sessions, saved prompts, user-owned agents and bounded report context. The current implementation is **not** presented as a full PDF/OCR/vector-RAG platform.

### DeFi OS

User-controlled Transfer, ARCTIS OTC Swap and Circle App Kit/CCTP Bridge. Quote, route, fee, balance and gas states are surfaced before execution.

### Economic Agent OS

Agents can interpret financial intent, create a proposal, validate the recipient/route, obtain a live quote, show expected output, wait for human approval, execute through the existing wallet flow and persist the result.

The safety boundary is:

`Propose → Review → Approve → Execute → Confirm`

Agents do not receive a hidden user private key and do not silently sign user-wallet transactions.

### Supporting platform surfaces

**Passport** provides wallet-linked identity and `.arc` profiles. **Membership** provides account entitlements and credits. **Treasury** provides financial/accounting visibility. These are not isolated utilities; they support the broader ARCTIS economic workflow.

The dashboard now exposes these capabilities directly through an **Explore ARCTIS** discovery layer so new users can understand the product without opening the navigation drawer.

The intended product story is:

**Identity → Membership → Money → Knowledge → Agents → controlled economic action**

---

## Architecture diagram

<p align="center">
  <img src="./docs/architecture-flow.svg" alt="Animated ARCTIS system architecture" width="100%" />
</p>

The diagram is a self-contained SVG/CSS animation. **Animated dashed paths represent control/data flow; pulsing nodes represent active hand-off points.** The layers map product pillars → orchestration/policy → persistence, AI routing and Arc/Circle rails. It requires no external animation service and remains understandable as a static GitHub image.

Detailed reviewer walkthrough: [`docs/README-EVALUATION.md`](./docs/README-EVALUATION.md).

---

## Current capabilities

### AI

- 12 personas: Study, Build, Analyze, Research, Generate, Treasury, Developer, Student, Teacher, Professor, Child and Engineering.
- Automatic backend model discovery and health-ranked failover.
- Streaming/non-streaming responses, sessions and saved prompts.
- Deterministic financial intent parsing for Transfer, Swap and Bridge proposals.

### Transfer

- User wallet remains the signing authority.
- `.arc` Passport recipients resolve to wallet addresses.
- Manual and Economic Agent recipient entry share the same live Passport validation path.
- Balance/gas preflight before execution.
- After wallet submission, the user-facing lifecycle distinguishes **Processing/Confirming** from final confirmation.

### Swap

- ARCTIS OTC settlement for `USDC`, `tUSDC` and `tARC`.
- Circle Swap surface includes **EURC as the last asset** in the ARCTIS dropdown.
- Live quote before wallet approval.
- Explicit **Estimated receive** amount.
- Explicit route-unavailable state; no wallet transaction is started when a Circle route cannot be obtained.
- `cirBTC` is intentionally not exposed in the ARCTIS Swap UI.
- Transaction lifecycle is designed as wallet approval → submitted → processing/confirming → receipt → success/failed.

### Bridge

- Circle App Kit + Viem adapter.
- Configured Arc Testnet, Ethereum Sepolia, Base Sepolia and Arbitrum Sepolia metadata, subject to current policy/routes.
- Source balance/native-gas preflight.
- Live Circle quote before approval.
- Provider, forwarding and gas fee display where returned.
- Explicit **Estimated receive** amount.
- Agent Bridge uses quote → review → wallet approval rather than automatic approval after proposal creation.
- Processing remains visible while the relevant bridge operation is awaiting confirmation/completion.

### Economic Agent transaction UX

The same human-approval and confirmation semantics apply to Manual and Economic Agent flows:

```text
Proposal
   ↓
Quote / preflight
   ↓
Human approval
   ↓
Wallet confirmation
   ↓
Transaction submitted
   ↓
⟳ Processing / Confirming
   ↓
✓ Confirmed
   ↓
Transaction hash / explorer details
```

A submitted transaction hash is not treated as final success. The green terminal state is reserved for confirmed execution.

### Passport

- Wallet-linked `.arc` identity and public username resolution.
- Profile photo can be added during creation.
- Existing Passports can later add/change/remove the photo.
- Owner Passport view has a direct return path to ARCTIS Home.

### Membership & Finance

- Membership and Credits are first-class product surfaces.
- Membership is directly discoverable from the dashboard instead of being hidden only in navigation.
- Treasury provides finance/accounting visibility and does not silently execute wallet transactions.

### Dashboard discovery

The dashboard provides direct entry points for:

1. **Membership** — account access and entitlements.
2. **Passport** — onchain identity/profile.
3. **Move USDC** — Transfer, Swap and Bridge.
4. **Economic Agents** — controlled agent execution with human approval.
5. **Treasury** — programmable-money/accounting visibility.
6. **Knowledge** — workspaces and bounded context.
7. **Copilot** — understand and operate ARCTIS.

This is deliberately designed as a product-discovery layer rather than a collection of promotional buttons.

---

## Current network and assets

**Stage: Arc Testnet.**

| Asset / rail | Role | Status |
|---|---|---|
| Arc Native USDC | Primary payment + gas asset | Active |
| tUSDC | ARCTIS OTC test asset | Active |
| tARC | ARCTIS OTC test asset; not an official Arc token | Active |
| EURC | Circle Swap surface | Route/quote availability depends on live Circle/Arc Testnet conditions |
| cirBTC | Circle-supported infrastructure asset | Intentionally not exposed by ARCTIS UI |
| CCTP | Cross-chain USDC bridge rail | Configured testnet routes |

Canonical configuration:

- Assets: `src/config/assets.ts` and `src/lib/swap/circle.ts`
- Network/contracts: `src/lib/contracts.ts`
- Bridge policy: `src/lib/bridge/policy.ts`

### Arc Testnet contract references

- **Arc Native USDC:** `0x3600000000000000000000000000000000000000`
- **tUSDC:** `0x28E49B36C1c6fD16ad81aB152488f37C93b3D8CA`
- **tARC:** `0xe66a11cb4b147F208e6d81B7540bfc83E1680c78`
- **ARCTIS Memo:** `0x5294E9927c3306DcBaDb03fe70b92e01cCede505`

These are testnet/application addresses, not mainnet deployments or official Arc-issued tokens.

### ARCTIS application-contract foundation

The repository also contains an initial Solidity foundation for future Economic Agent capabilities:

- `ARCTISAgentTreasury.sol`
- `ARCTISAgentEscrow.sol`

These are **ARCTIS application-layer contracts**, not Circle/Arc infrastructure contracts. They are currently documented as design/scaffold work and are **not claimed as deployed, audited or production-connected** until the compile → test → Arc Testnet deploy → ArcScan verification gates are completed.

---

## Data and security model

Firestore is accessed through Firebase Admin SDK from server-side routes. Core domains include transactions, activity, bridge records, swap records, Passports, agents, agent executions/reports/ledger, memberships, credits, AI sessions and observability.

The intended money boundary is:

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

Financial intent parsing is deliberately deterministic. The LLM is not trusted to invent a transaction amount, token pair, destination or signing operation.

### Transaction-state principle

ARCTIS distinguishes:

- **Wallet approval** — the user authorizes/signs the transaction.
- **Submitted** — a transaction hash exists.
- **Processing/Confirming** — the hash exists but final receipt/operation completion has not yet been established.
- **Confirmed** — successful receipt/operation completion has been established.
- **Failed** — the transaction or relevant operation failed.

The processing animation is functional feedback, not a success indicator. Reduced-motion preferences should be respected.

---

## Honest limitations

ARCTIS is a **testnet-stage build**.

- Not independently security audited.
- Not presented as mainnet-ready.
- Some mutating routes still need stronger cryptographic wallet-proof enforcement before mainnet.
- AI model health/registry state is process-local.
- Knowledge OS is not full document ingestion/vector RAG.
- Bridge and Circle Swap availability depends on live testnet routes/liquidity/policy.
- OTC Swap requires a funded counterparty wallet for meaningful end-to-end settlement.
- tARC is an ARCTIS test asset, not an official Arc token.
- Treasury/Escrow Solidity contracts are scaffolded application-layer work until independently compiled, tested, deployed and verified.
- Vercel production deployment is dependent on the current account/build-rate environment; a deployment marked `READY` is required before claiming that the latest Git commit is live in production.

These boundaries are documented deliberately so reviewers can distinguish implemented capability from route-dependent infrastructure, scaffolded work and future hardening.

---

## Tech stack

Next.js 14 · React 18 · TypeScript strict · Tailwind CSS · Framer Motion · Zustand · Wagmi · Viem · RainbowKit · Circle App Kit · Firebase/Firestore · OpenRouter · Recharts · Resend · Arc Testnet.

## Repository guide

```text
src/app/                 product pages + API routes
src/components/          reusable UI + agent components
src/config/              AI, assets, billing configuration
src/lib/                 auth, AI, chain, bridge, swap, persistence
contracts/               ARCTIS application-layer Solidity foundation

docs/architecture-flow.svg     animated architecture overview
docs/README-EVALUATION.md      reviewer / judge walkthrough

ARCHITECTURE_TRUTH.md           canonical capability truth
SYSTEM_ARCHITECTURE.md          runtime architecture + boundaries
API_REFERENCE.md                API inventory
DATABASE.md                     persistence model
DEPLOYMENT.md                   setup/deployment
SECURITY.md                     security posture
CHANGELOG.md                    material product changes
```

## Local verification

```bash
npm install
cp .env.example .env.local
npm run type-check
npm run architecture-truth
npm run build
npm run dev
```

For the Solidity application foundation, use the documented contract-specific toolchain/instructions under `contracts/` before any testnet deployment.

A successful static build is not a substitute for live Arc Testnet verification.

## Arc relationship

ARCTIS is built on Arc Testnet and uses configured Arc/Circle tooling. This repository does **not** imply an official Circle partnership, endorsement or ownership relationship unless separately confirmed by Circle.

## License

No license file is currently included. Do not assume permission to reuse the code until a license is explicitly added.
