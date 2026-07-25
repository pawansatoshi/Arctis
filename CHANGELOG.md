# CHANGELOG

All notable changes to ARCTIS are documented here.

Format follows [Keep a Changelog](https://keepachangelog.com/en/1.0.0/).

---

## [1.0.0] — Encode × Arc Hackathon Submission

### Added

**Stablecoin OS**
- Transfer: USDC/tUSDC/tARC with full 5-requirement on-chain proof chain
- Swap: Real OTC engine (dedicated Swap Wallet, reserve-checking quote, dual ArcScan links)
- Bridge: CCTP V2 inbound bridge via Circle Iris attestation (Ethereum/Base/Arbitrum Sepolia → Arc)
- Credits: Purchase with on-chain USDC payment verification + full proof chain
- Membership: Tier activation with on-chain payment verification + full proof chain

**AI OS**
- 12 AI modes with streaming output
- Dynamic-context Copilot (personalised from sessions, prompts, agent reports)
- Voice input via Web Speech API
- Image attachment support
- Multi-model routing via OpenRouter

**Knowledge OS**
- 9 domain workspaces with AI prompt templates
- Personal prompt library (save, search, delete)
- Session persistence across browser reloads

**Economic Agent OS**
- 7 required agent types (Research, Developer, Engineering, Treasury, Monitoring, Document, Custom)
- 2 Custom-type templates (Market Intelligence, Shopping Advisor)
- Agent memory (top-10 relevant facts, loaded before inference, extracted and saved after)
- Mandatory human approval gate: Prepare → Review → Approve → Execute (enforced in executor)
- Independent Evaluator Layer: structurally separate review pass, bounded single revision
- Monthly budget caps with real-time display
- Report generation with ownership-verified download
- Execution history with evaluation verdict badges

**Identity Layer**
- Passport: claim `username.arc`, edit profile, public profile at `/p/username`
- EIP-191 strict signature verification on all Passport mutations

**Transaction Memos**
- Structured metadata via Arc Memo contract on Transfer and Bridge
- User-toggleable in Settings, non-blocking by design

**Platform**
- Feedback system with Firestore persistence
- Activity Center (cross-pillar unified feed)
- Transaction history with search and filter
- Treasury: real-time Firestore accounting (observer-only)
- Settings: language preference, memo toggle, AI controls

**Security**
- `verifyApiWallet(strict=true)` on 6 routes (Credits, Membership, Swap execute, Bridge execute, Passport create, Passport update)
- Firestore-backed rate limiting (sliding window) on 5 highest-risk routes
- RPC fallback transport (3-endpoint chain for all server-side viem clients)
- Environment validation at startup with fail-fast in production
- Agent approval gate enforced at the executor level

**UI/UX**
- Premium dashboard redesign: Command Center with OS Overview, Action Required section
- OS-grouped navigation with pending-proposal badge on Agents
- Consistent premium design system across all 16 screens
- Mobile-first responsive layout
- Branded unconnected state with OS pillar preview
- Landing page with correct "Web3 Operating System" positioning

**Arc Brand Compliance**
- Metadata updated to "The Web3 Operating System" (removed incorrect "Institutional" framing)
- All Arc references follow approved language ("Built on Arc", "Arc Native USDC", "Arc Testnet")
- `ARC_BRAND_GUIDELINES.md` created as permanent reference

**Documentation**
- `README.md`: complete project documentation
- `SYSTEM_ARCHITECTURE.md`: full technical architecture
- `DATABASE.md`: Firestore schema and index documentation
- `SECURITY.md`: security policy and known limitations
- `RELEASE_NOTES.md`: v1.0.0 feature list
- `RELEASE_CHECKLIST.md`: pre-deployment verification checklist
- `DEPLOYMENT_ENV_TEMPLATE.md`: complete environment variable reference
- `ENCODE_ARC_SUBMISSION.md`: hackathon judge documentation
- `DEPLOYMENT_CHECKLIST.md`: operational deployment steps
- `GITHUB_PUSH_GUIDE.md`: repository hygiene and push checklist
- `ARC_BRAND_GUIDELINES.md`: Arc brand compliance reference

### Architecture Decisions

- Treasury is observer-only by design — never executes, never gates operations
- OTC Swap uses a dedicated EOA Swap Wallet as the counterparty — no AMM, no simulated liquidity
- Bridge uses CCTP V2 Forwarding Service — Circle Iris attestation is trusted as Circle-signed
- Agent Approval Gate enforced in `executor.ts`, not just UI — proposals without approval never reach the AI
- Independent Evaluator makes a structurally separate inference call with no access to generator's memory
- All Stablecoin OS operations satisfy the 5-requirement proof standard before being considered complete

### Known Limitations

- QR codes on Passport profiles: placeholder ("coming soon") — package install blocked in build environment
- Avatar upload: same reason
- SIWE full enforcement on Chat/Copilot/Activity routes: deferred to post-testnet
- Smart contract registries (Reference/Agent/Passport): off-chain implementations stable; on-chain deployment post-testnet
- Swap Wallet requires manual funding before OTC settlement works in production
- Firestore indexes require `firebase deploy --only firestore:indexes` before compound queries succeed
