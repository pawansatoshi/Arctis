# ARCTIS Documentation Map

The repository has accumulated documentation during several months of rapid development. The goal now is to keep the root concise, current and useful to an external developer.

## Canonical

These documents describe the current product and should be maintained with the code:

- `README.md` — public product overview and current status.
- `ARCHITECTURE_TRUTH.md` — canonical product/capability truth.
- `SYSTEM_ARCHITECTURE.md` — detailed runtime architecture and boundaries.
- `API_REFERENCE.md` — current API inventory.
- `DATABASE.md` — current Firestore/data model.
- `DEPLOYMENT.md` — local and testnet deployment guidance.
- `SECURITY.md` — security posture and limitations.
- `ARC_BRAND_GUIDELINES.md` — Arc relationship/naming rules used by ARCTIS.
- `CHANGELOG.md` — concise record of material implementation changes.

## Source-of-truth code

When a fact can be derived from runtime configuration, code is authoritative:

| Fact | Source |
|---|---|
| AI personas | `src/config/ai.ts` |
| Billing / credits | `src/config/billing.ts` |
| Executable assets | `src/config/assets.ts` |
| Network / contracts | `src/lib/contracts.ts` |
| Bridge policy | `src/lib/bridge/policy.ts` |
| AI routing | `src/lib/ai/router/` |
| Product context | `src/lib/ai/copilot/product-context.ts` |

## Historical material

Submission reports, patch reports, phase-by-phase build reports and temporary deployment notes are development history, not product truth. They should not be used to describe the current implementation without checking the code.

The root repository should not accumulate timestamped ZIP snapshots or source-code backup copies. Git history already preserves earlier versions.

## Maintenance rule

When a feature changes:

1. Update the source-of-truth code/configuration.
2. Update `ARCHITECTURE_TRUTH.md` if the capability model changed.
3. Update `SYSTEM_ARCHITECTURE.md` if runtime boundaries changed.
4. Update API/database docs when their contracts changed.
5. Add one concise entry to `CHANGELOG.md` for meaningful user/developer-facing changes.
6. Do not create another snapshot document merely to record the change.

This keeps the repository readable months later and prevents historical implementation notes from becoming accidental specifications.
