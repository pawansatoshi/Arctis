# Security Policy

## Supported Versions

ARCTIS is currently in testnet development (Lepton/Encode submission). Production mainnet is not yet launched.

| Version | Supported |
|---------|-----------|
| 1.0.x (testnet) | ✅ |
| < 1.0 | ❌ |

## Reporting a Vulnerability

**Do not open a public GitHub issue for security vulnerabilities.**

Report privately via Discord or direct message before public disclosure.

Response commitment: within 72 hours for critical issues.

## Security Architecture

**What is cryptographically verified:**
- Passport create/update: EIP-191 wallet signature required on every request
- Credits purchase: on-chain payment verified via `verifyUSDCPayment()` before credits granted
- Membership activation: on-chain payment verified before tier change
- Swap execution: on-chain inbound transfer verified before outbound dispatch
- Bridge execution: Circle Iris attestation verified before completion recorded
- Agent proposals: wallet ownership verified against stored agent record before execution

**Known limitations (testnet stage, pre-mainnet):**
- Remaining API routes (Chat, Copilot, Activity queries) accept `walletAddress` as a claimed value without cryptographic proof. SIWE (Sign-In With Ethereum) full enforcement is scheduled for post-testnet hardening.
- Agent execution does not verify caller via on-chain transaction — it relies on application-layer ownership check against Firestore record.
- Admin panel wallet check is application-layer only.

See `SECURITY_NOTES.md` for the full known-gap register.

## Environment Variables

**Server-side only (must NEVER be in NEXT_PUBLIC_* variables):**
- `OPENROUTER_API_KEY`
- `SWAP_WALLET_PRIVATE_KEY`

**Public but scope-restricted (Firebase rules enforce access control):**
- All `NEXT_PUBLIC_FIREBASE_*` variables are intentionally public; Firestore security rules enforce server-side-only write access to sensitive collections.

## What Should Never Be Committed

- `.env.local` — contains real API keys and the Swap Wallet private key
- `SWAP_WALLET_PRIVATE_KEY` in any file
- Any file containing a real private key or mnemonic

The `.gitignore` correctly excludes all `.env*` files except `.env.example`.
