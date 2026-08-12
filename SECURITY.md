# ARCTIS Security Policy

ARCTIS is currently a **testnet-stage application**. The repository should be evaluated as an active engineering project, not as an audited financial system.

## Reporting a vulnerability

Please do **not** publish sensitive vulnerability details in a public GitHub issue.

Use the repository maintainer's private security-reporting channel where available. Include:

- affected route/file;
- clear reproduction steps;
- impact assessment;
- relevant transaction hash or testnet identifier, if applicable;
- a minimal proof of concept where safe.

Do not include real private keys, seed phrases or credentials in a report.

## Security model

The intended transaction boundary is:

```text
User intent
   ↓
Input validation / policy
   ↓
Server coordination and verification
   ↓
User wallet or Circle App Kit signing
   ↓
Onchain transaction
   ↓
Server-side records / history
```

The application must not silently take custody of the user's wallet signing authority.

## Current controls

- Firebase Admin SDK is used for server-side Firestore access.
- Firestore rules are configured to deny direct access to sensitive collections.
- Mutating financial operations perform input validation and onchain verification where implemented.
- Rate limiting is present on sensitive/high-cost routes.
- Contract/network configuration is centralized in `src/lib/contracts.ts`.
- Financial natural-language intent is deliberately deterministic and constrained.
- Agent actions use a mandatory `Propose → Review → Approve → Execute` boundary.
- Agent evaluation is structurally separated from generation where the evaluator path is used.
- Private environment values are excluded from the repository by `.gitignore`.

## Wallet-proof posture

The repository currently has **different authentication strengths across routes**. Do not describe the entire API as SIWE/EIP-191 protected.

The strongest wallet-signature verification is used where explicitly wired through the authentication helpers. Other application routes still rely on wallet-address ownership checks or claimed request values and require further hardening before a mainnet deployment.

This is an intentional documented limitation, not a guarantee of production security.

## Money-specific boundaries

### Transfer

The user wallet signs the transaction.

### Swap

The server verifies the user's inbound transfer before the configured Swap Wallet counterparty leg is dispatched. The Swap Wallet is a separate operational key and must be protected independently.

### Bridge

Bridge execution uses Circle App Kit and configured CCTP routes. Source-chain balance/gas preflight checks are performed before the bridge operation proceeds. Route availability is policy/configuration dependent.

### Agents

Agents do not receive the user's private key. Agent execution is an application workflow with an approval gate. Agents should not be described as autonomous wallet custodians.

## Secrets

Never commit:

- `.env.local` or other populated environment files;
- `OPENROUTER_API_KEY`;
- `SWAP_WALLET_PRIVATE_KEY`;
- Firebase Admin private credentials;
- seed phrases or wallet mnemonics;
- production credentials or deployment tokens.

`NEXT_PUBLIC_*` values are browser-visible by design. A value must not be placed in `NEXT_PUBLIC_*` merely to make it convenient if it is actually secret.

## Testnet limitations

Before any mainnet launch decision, the project should at minimum:

1. enforce cryptographic wallet proof consistently across all mutating routes;
2. complete live bridge end-to-end tests for every intended route;
3. verify Swap Wallet key management and operational limits;
4. validate Firestore rules/indexes in the real deployment;
5. review all mainnet contract addresses and chain configuration;
6. perform an independent security assessment;
7. add monitoring and incident-response procedures.

## Security claims policy

Avoid claiming:

- “audited” without an actual independent audit;
- “production-ready” while the documented mainnet gate is incomplete;
- “fully decentralized” when server-side coordination, Firebase and provider infrastructure are used;
- “autonomous wallet control” for Economic Agents;
- official Arc/Circle partnership or endorsement without formal approval.
