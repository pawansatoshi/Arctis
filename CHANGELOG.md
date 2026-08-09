# CHANGELOG

All notable changes to ARCTIS are documented here.

Format follows [Keep a Changelog](https://keepachangelog.com/en/1.0.0/).

---

## [1.3.0] — Page-by-Page Premium Redesign, Accessibility & Security Audit

### Fixed — Real bugs found during the page-by-page pass

- **`.btn-secondary` CSS class was never defined** — used in Bridge and the public Passport profile page; those buttons had zero styling. Defined.
- **`handleArchive` in Agents was completely unreachable from the UI** — the function and API worked, but no button anywhere called it. Wired up in the agent detail panel.
- **History's Export dropdown only opened on CSS `:hover`** — never worked on touch devices (phones/tablets) at all. Rebuilt as click-to-toggle.
- **Copilot's conversation-history sidebar was a fixed 240px inline panel** — left ~135px for chat content on a typical phone screen. Rebuilt as a responsive overlay drawer on mobile, inline panel on desktop.
- A third instance of the hover-modifier-loss bug class (`hover:text-{color}-300`, tuned only for dark mode) in 7 places across Dashboard, Agents, the shared dashboard shell, and Transfer.
- The color-contrast script's own output had dropped `hover:`/`group-hover:` modifiers in 23 places across 14 files — those elements showed their "hover" color permanently in dark mode. Fixed with a second, more precise script pass.
- Settings: a fake-clickable "Documentation" row (chevron implied navigation, had no `onClick`/`href`), a hardcoded stale version number, a non-standard Tailwind class silently overridden by an inline style, a mislabeled code comment.
- Onboarding: a factual inaccuracy ("8 specialized AI modes" — the app has 12), and raw emoji icons (🤖⚡💰📊) inconsistent with the rest of the app's icon system — replaced with the same lucide-react icons used everywhere else.
- PassportCard: a hover-lighten button (reduced contrast on hover) and three `text-blue-500` instances without theme pairing.
- Activity Center had its own hand-rolled CSV/JSON export, duplicating (and offering less than) the shared utility History already used. Consolidated to one shared implementation.
- Several silently-swallowed fetch errors (Activity, Passport) now surface a toast.

### Added

- **Markdown rendering for AI chat** — `react-markdown` and `remark-gfm` were already installed as dependencies but never actually used anywhere; messages rendered as raw text with no code blocks, tables, or formatting. Built a shared `MarkdownContent` component (code blocks with copy button + language label, GFM tables, lists, headings, links) and wired it into both AI Workspace and Copilot.
- **Regenerate response** in both AI Workspace and Copilot — reruns the last user message, replacing the last assistant reply, matching the ChatGPT/Claude convention.
- **Conversation history switcher** in AI Workspace — sessions were loading into the store with no way to actually switch between them.
- **Escape-to-stop-generation** keyboard shortcut in both AI chat surfaces.
- **Safe-area-inset support** (`.safe-bottom`/`.safe-top` utilities) for notched phones and gesture-navigation devices, applied to every bottom-anchored input/action area.
- Consistent `focus-visible` treatment on all button variants — previously only form inputs had an explicit focus state.
- `aria-label` on 6 previously-unlabeled icon-only buttons, plus an accessible `label` prop on the shared `Toggle` component.

### Changed

- Every page in the priority list (Dashboard, AI Workspace, Copilot, Agents, Transfer, Swap, Bridge, History, Activity Center, Credits, Passport, Settings, Onboarding) individually reviewed and revised for spacing, typography hierarchy, card treatment, hover/focus states, and mobile responsiveness — not just theme-migrated.
- Message bubbles across both AI surfaces redesigned with asymmetric "speech bubble" corners and refined shadows.

### Verified

- `tsc --noEmit` run at every checkpoint through this entire phase, diffed by error code against the previous checkpoint each time — zero net-new genuine regressions across the full redesign and audit pass. One new error code (`TS7031`, 19 occurrences) appeared, traced entirely to `MarkdownContent.tsx`'s use of `react-markdown`'s component-override API, whose types can't resolve without `node_modules` — same root cause as every pre-existing noise category.
- Full accessibility, responsive, and security audit — see `BUILD_REPORT.md` §"Accessibility, Responsive, and Security Audit" for the complete account.

---

## [1.2.0] — Light Theme Foundation, Premium Visual Pass

### Added

- **Full light/dark theme system.** Light is now the default (Apple/Linear/Notion-inspired soft off-white palette); dark mode is fully preserved, not removed — toggle in Settings and the dashboard header. No new dependency added — a small, self-contained `ThemeProvider` (`src/lib/theme/`) manages a `.dark` class on `<html>`, persisted to `localStorage`, with an inline pre-hydration script to avoid a flash of the wrong theme.
- Surface color scale converted from static hex values to CSS custom properties (`:root` = light, `.dark` = the original dark palette, preserved exactly) — every page re-themes automatically since they all already used the same token names.
- `@layer base` typography rules — headings previously had no consistent baseline weight/tracking at all.
- `.page-container` — was referenced by 5 pages but silently did nothing (never defined). Now provides consistent spacing.

### Fixed

- 132 border/hover-highlight patterns and 265 status-color instances (across 28 files) that were tuned only for a dark background — now theme-aware via a systematic script pass rather than 400+ manual edits.
- **A bug introduced by that same first script pass, caught by a second verification pass:** ~35 `hover:`/`focus:`/`group-hover:` modifiers were dropped from the dark-mode side of a border/background pair, meaning those elements would show a hover-style highlight *permanently* in dark mode instead of only on hover. Corrected.
- RainbowKit wallet modal, toast notifications, and Treasury/Analytics chart tooltips — previously hardcoded to dark-only literal colors (these need real color strings, not Tailwind classes) — now read the current theme at render time.
- Landing page's decorative grid-line background was white-tinted only and invisible against the new light default — made theme-aware.

### Verification

- `tsc --noEmit` run before and after the full overhaul, diffed by error code: only proportional movement in known environment-noise categories; the three categories worth manually tracing (Record-indexing casts, `key`-prop mismatches, one unrelated clipboard handler) are byte-for-byte unchanged — zero new regressions. Full table in `BUILD_REPORT.md`.

### Documentation

- Added a developer section on keeping Circle CLI / Circle Skills current (`circle update`, `circle skill update --tool claude-code`) — documentation only, not part of the app itself.

---

## [1.1.0] — Firestore Migration, Invisible AI Routing, AI Orchestration

### Fixed

- **Root cause of Firestore permission failures identified and fixed.** Every Firestore call in the app — including from server-side API routes — used the client SDK, which is bound by security rules. The rules required Firebase Auth (`request.auth.uid == wallet`) for reads, but the app authenticates via wallet signature, never Firebase Auth — so `request.auth` was always `null` and reads were silently denied everywhere. This looked like "flaky connectivity" but was a rules/architecture mismatch. Fixed by migrating all 14 Firestore-touching lib files to the Firebase Admin SDK (bypasses rules for trusted server code) and locking `firestore.rules` down to deny all direct client access.
- Credit Balance / Credit History showing blank/dash, Activity Center showing nothing, Create Agent silently failing to persist, faucet/transfer records missing — all downstream symptoms of the above, now resolved.
- AI chat/Copilot failing only when a wallet was connected — caused by the credit pre-check hitting the same Firestore permission error; resolved by the same fix.
- Streaming AI replies had no fallback to another model if the primary one failed mid-connection — fixed; the non-streaming path already had this, streaming didn't.
- A stream-error-swallowing bug in the AI Workspace frontend (errors were thrown and caught by the same try/catch that parsed the SSE JSON, so they never surfaced to the user) — fixed.
- Credits page had no loading state for its history list, causing a flash of "No history yet" before real data arrived — fixed.
- Several silently-swallowed fetch/save errors (Credits, Agents pages) now surface a toast instead of failing invisibly.
- One hardcoded paid model (`anthropic/claude-3.5-haiku`) in the agent evaluator — contradicted the free-models-only design — removed.
- One leftover regression from this session's own edits (`setShowModelSelector` referenced after its state was removed) — caught by a `tsc --noEmit` pass and fixed before packaging.

### Added

- **Dynamic AI model registry** (`src/lib/ai/registry/`) — discovers free, chat-capable OpenRouter models live instead of hardcoding IDs; caches with periodic refresh; falls back to the last-known-good list if OpenRouter is unreachable.
- **Health-based routing** — per-model latency/failure/rate-limit tracking, ranks candidates, automatic fail-over for both streaming and non-streaming requests.
- **ARCTIS AI branding — model/provider identity fully hidden from users.** Removed the model-picker dropdown (AI Workspace, Create Agent form), removed raw model names from Credit History, the onboarding pricing table, and the Settings page. Credit cost is now a flat, documented rate instead of a per-model table.
- **Transfer/Swap/Bridge AI orchestration** — natural-language requests like *"bridge 5 USDC"* are parsed deterministically (not by an LLM, to avoid hallucinated amounts/addresses), shown as a confirmation card, and on confirmation hand off to the existing Transfer/Swap/Bridge pages with the form pre-filled. The AI never signs or executes anything — wallet signing remains entirely client-side on the existing pages.
- **Command Palette** (⌘K / Ctrl+K) — Apple/Linear-style global navigation search across every page.
- **History page rebuilt** — previously read only from local browser state (empty on any new device/session); now reads from the same server-aggregated feed as Activity Center, with real pagination and CSV/JSON/Excel/PDF/TXT export.
- **Activity Center** — added Swap and Bridge event types.
- Shared `EmptyState` and `Skeleton` UI components — applied to History, Activity, Credits, Dashboard, Agents for visual consistency; the project's existing shimmer `.skeleton` CSS class is now the single source of truth instead of a competing `animate-pulse` pattern.
- New API routes: `GET/POST/DELETE /api/sessions`, `GET/POST/DELETE /api/prompts` (server-side proxies replacing direct client Firestore access), `GET /api/activity` (unified aggregation feed).

### Changed

- `firebase.json` corrected — was pointing to two oddly-named files (`n`, `y`) instead of `firestore.rules` / `firestore.indexes.json`.
- `firestore.indexes.json` expanded from 3 to 14 composite indexes to cover every query added by the Admin SDK migration.
- Membership-tier model gating removed from AI chat, Copilot, and agent execution — all AI features use only free models, so the gate was dead weight that had been causing outages.

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
