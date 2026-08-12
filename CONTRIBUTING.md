# Contributing to ARCTIS

ARCTIS is an active testnet project. Contributions should preserve the product's safety boundaries and keep documentation aligned with the implementation.

## Before changing code

Read:

1. `README.md`
2. `ARCHITECTURE_TRUTH.md`
3. `SYSTEM_ARCHITECTURE.md`
4. `SECURITY.md`

If the change affects a product fact, update the canonical source/configuration first.

## Development

```bash
npm ci
npm run type-check
npm run architecture-truth
npm run lint
npm run dev
```

For a release/deployment candidate, also run:

```bash
npm run build
```

## Architecture rules

- Do not duplicate contract addresses outside `src/lib/contracts.ts`.
- Do not duplicate billing values outside `src/config/billing.ts`.
- Do not duplicate AI persona definitions outside `src/config/ai.ts`.
- Do not bypass the agent `Propose → Review → Approve → Execute` boundary.
- Do not introduce server-side signing of a user's wallet transaction.
- Do not add an LLM dependency to deterministic financial amount/address parsing without a security review.
- Keep Firestore access behind the intended server-side persistence boundary.
- Keep Arc references descriptive and accurate; do not imply an unapproved partnership or endorsement.

## UI and product language

Use the current information architecture:

```text
AI OS
  Copilot
  Agents

DeFi OS
  Transfer
  Swap
  Bridge

Knowledge OS
  Workspace
  Knowledge
```

History is the canonical user-facing historical surface. Activity remains an internal aggregation concept/API.

## Pull requests

A useful PR should explain:

- what changed;
- why it changed;
- which architecture boundary is affected;
- how it was verified;
- any testnet-only or deployment dependency.

Do not describe untested functionality as production-ready.

## Security

Do not include secrets, private keys, seed phrases or populated environment files in commits. For vulnerabilities, follow `SECURITY.md` rather than opening a public issue with sensitive details.
