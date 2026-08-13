# ARCTIS Documentation Map

The repository has undergone rapid product development. The current goal is a small, authoritative documentation surface that an external developer, Circle reviewer or hackathon judge can understand without reading historical phase reports.

## Canonical public documents

- `README.md` — public product overview, current capabilities and boundaries.
- `docs/README-EVALUATION.md` — five-minute reviewer/judge walkthrough and architecture explanation.
- `ARCHITECTURE_TRUTH.md` — canonical product/capability truth.
- `SYSTEM_ARCHITECTURE.md` — runtime architecture, state machines and security boundaries.
- `API_REFERENCE.md` — current API inventory.
- `DATABASE.md` — current Firestore/data model.
- `DEPLOYMENT.md` — local/testnet deployment guidance.
- `SECURITY.md` — security posture and limitations.
- `ARC_BRAND_GUIDELINES.md` — Arc relationship/naming rules.
- `CHANGELOG.md` — concise record of material implementation changes.

## Source-of-truth code

When a fact can be derived from runtime configuration, code is authoritative:

| Fact | Source |
|---|---|
| AI personas | `src/config/ai.ts` |
| Billing / credits | `src/config/billing.ts` |
| Arc/native executable assets | `src/config/assets.ts` |
| Network / contracts | `src/lib/contracts.ts` |
| Circle Swap pair logic | `src/lib/swap/circle.ts` |
| Bridge policy | `src/lib/bridge/policy.ts` |
| AI routing | `src/lib/ai/router/` |
| Product context | `src/lib/ai/copilot/product-context.ts` |
| Passport recipient validation | `src/lib/hooks/useRecipientValidation.ts` + Passport resolver route |

## Historical material

Submission reports, patch reports, phase-by-phase build reports and temporary deployment notes are development history, not product truth. They should not be used to describe the current implementation without checking the code.

The root repository should not accumulate timestamped ZIP snapshots or source-code backup copies. Git history and dedicated backup branches are the recovery mechanism.

## Backup policy

Before a substantial documentation/architecture refresh, freeze the current application state in a dedicated Git branch. The 2026-08-13 pre-documentation-refresh application state is identified by commit:

`c103f598be8c8d71e21b8939ae1c011b25eb49a4`

Intended recovery branch:

`backup/pre-documentation-refresh-2026-08-13`

The backup point is an engineering recovery reference, not a second product specification.

## Maintenance rule

When a feature changes:

1. Update the source-of-truth code/configuration.
2. Update `ARCHITECTURE_TRUTH.md` if the capability model changed.
3. Update `SYSTEM_ARCHITECTURE.md` if runtime boundaries/state machines changed.
4. Update API/database docs when their contracts changed.
5. Add one concise entry to `CHANGELOG.md` for meaningful user/developer-facing changes.
6. Update the evaluator guide when a reviewer-facing workflow changes materially.
7. Do not create another snapshot document merely to record the change.

This keeps the repository readable, honest and useful to external reviewers while preserving implementation history in Git.
