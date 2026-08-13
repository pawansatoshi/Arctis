# ARCTIS Changelog

This changelog records meaningful product and architecture changes. Git history remains the detailed implementation history.

## 2026-08-13 — Transaction UX, Agent safety and Passport hardening

### Economic Agent

- Added live Passport recipient validation while typing in Economic Agent flows, using the same canonical validation path as Manual Transfer.
- Tightened the agent financial state machine to prevent wallet approval from appearing before the required quote/preflight stage.
- Added explicit live quote state before agent Swap/Bridge approval.
- Added expected receive amounts to Swap and Bridge quote surfaces so users can review the outcome before signing.
- Preserved the human approval boundary: proposal ≠ authorization and quote completion ≠ wallet approval.

### Swap

- Restored/retained **EURC** in the Circle Swap product surface.
- Ordered the Swap dropdown as `USDC → tUSDC → tARC → EURC`, keeping EURC last as the requested Circle asset.
- Added explicit Circle route-unavailable handling so no wallet transaction starts when a live route cannot be obtained.
- Kept `cirBTC` out of the ARCTIS Swap UI by product choice.
- Added visible `Estimated receive` output to quote cards.

### Bridge

- Added live quote gating before Agent Bridge approval.
- Added provider, forwarding and gas fee presentation where returned.
- Added explicit `Estimated receive` amount before wallet approval.
- Kept source-chain balance/native-gas preflight and Circle App Kit execution boundaries intact.

### Passport

- Added profile-photo support during Passport creation.
- Added later photo add/change/remove support for existing Passports.
- Added owner navigation back to ARCTIS Home from Passport.

## 2026-08-13 — Repository evaluator refresh

- Rebuilt the public README around the current programmable-money + agentic-finance product thesis.
- Updated `ARCHITECTURE_TRUTH.md` and `SYSTEM_ARCHITECTURE.md` to match current Swap, Bridge, Agent and Passport behavior.
- Added `docs/README-EVALUATION.md` as a concise reviewer/judge walkthrough.
- Documented the animated architecture diagram and what its moving paths/nodes represent.
- Added a Git recovery marker for the pre-documentation-refresh application state.

## 2026-08-12 — Product architecture and repository polish

- Refined the primary navigation around the current product model.
- Moved Agents under AI OS in the primary navigation while retaining Economic Agent OS as a product architecture pillar.
- Renamed the money-movement navigation group to DeFi OS.
- Removed Activity from primary navigation; History is the canonical user-facing historical surface.
- Added the current ARCTIS logo treatment and compliant “Built on Arc” relationship language.
- Rebuilt the public README around the current implementation instead of historical phase claims.
- Added an animated, self-contained architecture diagram for repository visitors.
- Consolidated documentation authority around current architecture/configuration sources.
- Refreshed API, database, deployment and security documentation to match the current code direction.
- Marked testnet limitations and remaining mainnet hardening work explicitly instead of using production-readiness language.

## 2026-08-10 — App Kit + global language support

- Reworked the browser bridge execution path around Circle App Kit with the Viem EIP-1193 adapter.
- Removed the bridge page's previous direct CCTP transaction orchestration and legacy browser polling path.
- Added Circle App Kit preflight/result lifecycle handling.
- Added a Codespaces configuration using Node.js 22 and automatic dependency installation.
- Added a one-button language selector with English, Hindi, Spanish, Portuguese, Chinese, Korean, Vietnamese, French, Swahili and Arabic.
- Added persisted locale selection and RTL handling for Arabic.
- Added a local bridge-history fallback so successful App Kit bridge results remain visible when legacy server history is unavailable.

## Earlier development

The repository has undergone several architecture, persistence, AI-routing, agent-safety, accessibility, responsive-design and visual-design iterations over the preceding months. Those changes remain available in Git history; current product facts belong in `ARCHITECTURE_TRUTH.md` rather than in a growing collection of phase reports.
