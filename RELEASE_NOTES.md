# Release Notes

## v1.0.0 — Lepton / Encode x Arc Submission

**Network:** Arc Testnet (Chain ID 5042002)
**Status:** Testnet. Not for mainnet use.

### What's in v1.0.0

**Stablecoin OS**
- Transfer: USDC/tUSDC/tARC transfers with full 5-requirement on-chain proof chain
- Swap: Real OTC engine with dedicated Swap Wallet, reserve-checking quote route, dual explorer links
- Bridge: CCTP V2 inbound bridge (Ethereum Sepolia / Base Sepolia / Arbitrum Sepolia → Arc Testnet) via Circle Iris attestation
- All three operations write to: `transactions`, `activity`, and `treasury_logs` collections. Every transaction has a working ArcScan link.

**AI OS**
- 12 AI modes (research, code, explain, summarise, translate, creative, analysis, QA, debug, review, brainstorm, custom)
- Streaming Copilot with dynamic context (pulls from user's sessions, saved prompts, agent reports, recent transactions)
- Voice input via Web Speech API
- Image attachment support

**Knowledge OS**
- AI Workspace with domain-specific prompt templates (9 domains)
- Personal prompt library with save/search/delete
- Session persistence across browser reloads

**Economic Agent OS**
- 7 required agent types (Research, Developer, Engineering, Treasury, Monitoring, Document, Custom)
- 2 additional templates (Market Intelligence, Shopping Advisor) as Custom-type presets
- Agent memory (top-10 relevant facts loaded before inference, facts extracted and saved after)
- Monthly budget enforcement with real-time budget-remaining display
- **Mandatory human approval gate**: every agent task follows Prepare → Review → Approve → Execute. Enforced in the executor, not just the UI.
- **Independent Evaluator Layer**: every execution reviewed by a structurally separate inference pass with no access to the generator's prompt or memory. FAIL triggers one bounded revision attempt.
- Reports: downloadable, ownership-verified

**Identity Layer**
- Passport: claim `username.arc`, edit profile, public profile at `/p/username`
- Strict EIP-191 signature verification on every Passport mutation

**Security**
- Rate limiting (Firestore-backed sliding window) on 5 highest-risk routes
- RPC fallback (3-endpoint fallback transport for all server-side and client-side viem clients)
- Environment validation at startup (`assertEnvOrThrow()`)
- `verifyApiWallet(strict=true)` on Credits, Membership, Swap execute, Bridge execute, Passport create, Passport update

**Transaction Memos**
- Structured metadata attached to Transfer and Bridge operations via Arc Memo contract
- User-toggleable in Settings
- Non-blocking by design — memo failures never surface to the user

**Platform**
- Feedback system with Firestore persistence
- Activity Center with cross-pillar unified feed
- Treasury: real-time Firestore accounting (observer-only, never executes)
- Premium UI across all 16 screens — consistent design system, mobile-first, accessible

### Known Limitations

- QR codes on Passport profiles: placeholder (honest "coming soon"), package install blocked in build environment
- Avatar upload: same reason
- SIWE full enforcement on Chat/Copilot/Activity routes: deferred to post-testnet
- Smart contract registries (Reference/Agent/Passport): off-chain implementations stable; on-chain deployment scheduled post-testnet
- Swap Wallet must be funded with real reserves before swap settlement works in production
- Firestore indexes must be deployed (`firebase deploy --only firestore:indexes`) before compound queries succeed in production

### Built On
- Arc Testnet · Chain ID 5042002
- Arc Native USDC · `0x3600000000000000000000000000000000000000`
- Circle CCTP V2 · Forwarding Service
