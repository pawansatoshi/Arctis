# ARCTIS Changelog

This changelog records meaningful product and architecture changes. Git history remains the detailed implementation history.

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

## 2026-08-12 — Membership and UX hardening

- Redesigned membership activation and entitlement management.
- Added membership entitlement dates and credit-source tracking.
- Surfaced membership and credit entitlements in Passport.
- Derived expired membership state from entitlement expiry.
- Added first-run ARCTIS product orientation.
- Added accessible global/back-to-top navigation aids for long pages.
- Optimized nested scroll detection.
- Removed admin from primary navigation.

## Earlier development

The repository has undergone several architecture, persistence, AI-routing, agent-safety, accessibility, responsive-design and visual-design iterations over the preceding months. Those changes remain available in Git history; current product facts belong in `ARCHITECTURE_TRUTH.md` rather than in a growing collection of phase reports.
