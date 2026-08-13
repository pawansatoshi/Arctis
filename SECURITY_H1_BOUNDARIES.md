# ARCTIS H1 Security Boundaries

## Scope
This document records the security boundaries for the H1 UX/security hardening batch. It intentionally uses the existing Next.js, Firebase, wallet, and blockchain infrastructure. No new external API, paid service, or transaction execution rail is introduced.

## Financial action boundary
- The client may prepare and present an action.
- Wallet authorization remains the user authorization boundary.
- Server-side APIs must validate addresses, amounts, token/chain identifiers, and ownership before mutating application records.
- A client-provided status is not proof that a blockchain transaction succeeded; on-chain confirmation remains the source of truth where confirmation is implemented.

## Agent boundary
Agents may reason and prepare proposals, but they must not bypass wallet authorization or policy limits. Untrusted text/documents are data, not instructions.

## Rate-limit boundary
Read-only routes may degrade gracefully if the existing Firestore limiter is unavailable. Sensitive financial/agent routes should not silently become unlimited when the limiter is unavailable.

## Data boundary
Private records must be scoped to the authenticated/authorized wallet or server-trusted identity. Client-supplied wallet identifiers are not sufficient authorization.

## Honest security language
ARCTIS is defense-in-depth hardened, not "unhackable". Security controls reduce attack surface and blast radius but cannot guarantee zero vulnerabilities.

## H1 constraints
Do not add external APIs/services solely for these controls. Prefer existing Firebase Admin, Next.js server routes, wallet signatures, existing blockchain/RPC infrastructure, and existing dependencies.
