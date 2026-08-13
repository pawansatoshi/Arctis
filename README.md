<div align="center">
  <img src="./public/icons/logo.svg" alt="ARCTIS" width="84" height="84" />
  <h1>ARCTIS</h1>
  <p><strong>Programmable money for humans and AI agents.</strong></p>
  <p>AI · Knowledge · Stablecoins · Economic Agents · Identity</p>
  <p><strong>Built on Arc Testnet</strong> · wallet-controlled · live public testnet build</p>
</div>

---

## What is ARCTIS?

ARCTIS is an **AI operating environment for programmable money** built on Arc Testnet. It combines AI assistance, bounded knowledge context, stablecoin operations, human-readable identity and Economic Agents in one product.

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

`Propose → Review → Approve → Execute`

Agents do not receive a hidden user private key and do not silently sign user-wallet transactions.

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

### Swap

- ARCTIS OTC settlement for `USDC`, `tUSDC` and `tARC`.
- Circle Swap surface includes **EURC as the last asset** in the ARCTIS dropdown.
- Live quote before wallet approval.
- Explicit **Estimated receive** amount.
- Explicit route-unavailable state; no wallet transaction is started when a Circle route cannot be obtained.
- `cirBTC` is intentionally not exposed in the ARCTIS Swap UI.

### Bridge

- Circle App Kit + Viem adapter.
- Configured Arc Testnet, Ethereum Sepolia, Base Sepolia and Arbitrum Sepolia metadata, subject to current policy/routes.
- Source balance/native-gas preflight.
- Live Circle quote before approval.
- Provider, forwarding and gas fee display where returned.
- Explicit **Estimated receive** amount.
- Agent Bridge uses quote → review → wallet approval rather than automatic approval after proposal creation.

### Passport

- Wallet-linked `.arc` identity and public username resolution.
- Profile photo can be added during creation.
- Existing Passports can later add/change/remove the photo.
- Owner Passport view has a direct return path to ARCTIS Home.

### Platform

- Dashboard, History, AI OS, DeFi OS, Knowledge OS, Finance and Platform navigation.
- Membership, Credits and Treasury surfaces.
- Command palette and first-run orientation.
- Responsive/mobile UX and accessibility improvements.
- 10-language locale selector with Arabic RTL support.

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
Persistence / explorer / history
```

Financial intent parsing is deliberately deterministic. The LLM is not trusted to invent a transaction amount, token pair, destination or signing operation.

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

These boundaries are documented deliberately so reviewers can distinguish implemented capability from route-dependent infrastructure and future hardening.

---

## Tech stack

Next.js 14 · React 18 · TypeScript strict · Tailwind CSS · Framer Motion · Zustand · Wagmi · Viem · RainbowKit · Circle App Kit · Firebase/Firestore · OpenRouter · Recharts · Resend · Arc Testnet.

## Repository guide

```text
src/app/                 product pages + API routes
src/components/          reusable UI + agent components
src/config/              AI, assets, billing configuration
src/lib/                 auth, AI, chain, bridge, swap, persistence

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

A successful static build is not a substitute for live Arc Testnet verification.

## Arc relationship

ARCTIS is built on Arc Testnet and uses configured Arc/Circle tooling. This repository does **not** imply an official Circle partnership, endorsement or ownership relationship unless separately confirmed by Circle.

## License

No license file is currently included. Do not assume permission to reuse the code until a license is explicitly added.
