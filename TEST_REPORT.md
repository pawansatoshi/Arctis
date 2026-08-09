# TEST_REPORT.md — ARCTIS

Covers the Phase 20 implementation cycle (Firebase Admin migration, invisible AI routing, Transfer/Swap/Bridge orchestration, Command Palette, UI/UX pass).

## Important Scope Note

**This report documents static verification only — no user journey below was executed in a real browser against a running server.** The working environment for this cycle had no network access (`node_modules` was never installed, no dev server could run, no wallet could connect). Every row below reflects one of:

- **Code-path traced** — the relevant files were read end-to-end and the logic manually verified to be internally consistent (correct function calls, correct data shapes, no dead ends)
- **Statically verified** — confirmed via `tsc --noEmit`, import/export cross-referencing, or brace/paren balance checking
- **Requires manual test** — cannot be confirmed without actually running the app; listed explicitly rather than assumed

Anything marked "requires manual test" must be checked in the real Codespace before this cycle is considered production-verified. This is the same honest standard applied throughout this cycle — every prior handoff in this conversation was verified this way, not by claiming an untested build was clean.

## Static Verification Summary

| Check | Result |
|-------|--------|
| `tsc --noEmit` (full repo) | 3,143 diagnostics; 99.9% confirmed environment-only (missing `node_modules`); 1 genuine regression found and fixed (`setShowModelSelector` dangling reference); remainder confirmed pre-existing/out-of-scope |
| Brace/paren balance, all 47 touched files | All balanced |
| `@/...` import resolution, full repo | All resolve to an existing file |
| Named import → export cross-check, full repo | All imports match an actual export |
| Server-only boundary (`server-only` package) | No server-only module imported by a client component |
| Frontend `fetch('/api/...')` → route existence | Every call matches an existing route |
| `AIMode` / `MODE_PROMPTS` / `MODE_CONFIG` completeness | Enforced by TypeScript (`Record<AIMode, ...>`); confirmed complete for all 12 modes |

## User Journeys

| Journey | Status | Notes |
|---------|--------|-------|
| Wallet connection | Not re-tested this cycle | No code touched this path |
| Dashboard loads | Code-path traced | Balance skeleton now uses shared `Skeleton` component; no logic changed |
| Package purchase | Code-path traced | `addCredits()` now Admin SDK; ledger write shape unchanged |
| Credits update correctly | Code-path traced | `getCreditBalance`/`deductCredits` now Admin SDK; flat rate (1 credit/1k tokens), confirmed no per-model cost logic remains |
| Credits history updates | Code-path traced | Loading-state bug fixed (was flashing "No history" before data arrived) |
| AI Workspace chat | Code-path traced — **requires manual test** | Model selection is now fully automatic; requires a real OpenRouter key and network access to confirm the registry fetch + health ranking behave as designed under real conditions |
| AI Workspace — financial intent detection | Code-path traced — **requires manual test** | Regex patterns for "send/transfer X to 0x...", "swap X for Y", "bridge X" verified by inspection against the parser; not exercised against real user phrasing variety |
| ARCTIS Copilot | Code-path traced | Dead credit-deduction code removed; confirmed unreachable before removal |
| Create Agent | Code-path traced | Firestore write now via Admin SDK; model dropdown removed from form; `agent.model` defaults to `''` (automatic) |
| Agent execution | Code-path traced — **requires manual test** | Membership-tier model gate removed from `executor.ts`; requires a real run to confirm the router's automatic model selection behaves correctly end-to-end for an agent task |
| Activity Center | Code-path traced | Added Swap/Bridge event types; confirmed `meta.model` never included in the API response |
| History page | Code-path traced | Rebuilt to use `/api/activity` instead of local-only state; pagination logic reviewed but not exercised against real data volume |
| Transfer / Swap / Bridge (direct) | Not touched this cycle except pre-fill | Existing execution flow (wallet signing, on-chain calls) untouched; only the `pendingAction` pre-fill `useEffect` is new — **requires manual test** to confirm prefill + toast fire correctly on navigation from a confirmed AI proposal |
| Command Palette | Code-path traced — **requires manual test** | Keyboard shortcut, arrow-key navigation, and route list verified by inspection; never actually pressed in a browser |
| Mobile responsiveness | Partially reviewed | Transfer/Swap/Bridge confirmed to use a single-column `max-w-lg` layout (inherently mobile-safe); other pages not individually audited at every breakpoint this cycle |
| Sidebar | Code-path traced | Collapsed-state labels added in an earlier cycle; not re-touched this cycle |
| Theme toggle (Light/Dark) | Code-path traced — **requires manual test** | Toggle logic, localStorage persistence, and flash-prevention script verified by inspection; the actual rendered appearance in both modes across all 13 reviewed pages has not been visually confirmed in a real browser — this is the single most important thing to check manually after this ZIP is applied |

## What This Report Is Not

This is not a substitute for running the app. It is a rigorous account of what a static, non-runtime review can and cannot confirm, so that the manual testing effort after this ZIP is applied can focus precisely on the rows above marked "requires manual test" rather than re-checking everything from scratch.

## Final Re-Verification

A final `tsc --noEmit` pass was run after all documentation was written and diffed against the prior run: identical output, confirming the documentation phase introduced no code changes and no regressions.
