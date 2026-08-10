# ARCTIS Codex Final Fix

- Added centralized undefined stripping for Firestore agent updates.
- Constrained deterministic financial intent parsing to executable transfer/swap/bridge routes and added structured clarification responses.
- Registered CCTP source chains in wagmi and pinned Arc token reads to Arc Testnet.
- Lowered bridge application minimum to the ERC-20/CCTP unit floor and improved bridge source-chain handoff and wallet-switch error messaging.

## 2026-08-10 — App Kit + Global Language Fix

- Replaced the browser bridge execution path with Circle App Kit + the Viem EIP-1193 adapter.
- Removed the bridge page's direct CCTP `approve` / `depositForBurn` / Iris polling orchestration.
- Added Circle App Kit pre-flight estimation and result lifecycle handling.
- Added GitHub Codespaces configuration using Node.js 22 and automatic `npm install`.
- Added a global one-button language selector with English, Hindi, Spanish, Portuguese, Chinese, Korean, Vietnamese, French, Swahili, and Arabic.
- Added persistent locale selection and RTL support for Arabic.
- Added local bridge history fallback so successful App Kit bridges remain visible even when the legacy server history collection is unavailable.
