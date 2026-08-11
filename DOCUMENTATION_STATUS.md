# Documentation Authority Map

ARCTIS has accumulated several architecture and submission documents during development. They are not all equally authoritative.

## Canonical

- `ARCHITECTURE_TRUTH.md` — current product and architecture truth.
- `src/config/billing.ts` — current pricing and credit grants.
- `src/config/ai.ts` — current AI persona definitions.
- `src/config/assets.ts` — current executable asset registry.
- `src/lib/contracts.ts` — current chain/contract configuration.
- `src/lib/ai/copilot/product-context.ts` — Copilot's generated product facts.

## Technical references

- `SYSTEM_ARCHITECTURE.md` — detailed implementation architecture; reconcile against `ARCHITECTURE_TRUTH.md` when changes occur.
- `API_REFERENCE.md` — API inventory; update when routes change.
- `DATABASE.md` — Firestore/data reference; update when collections or fields change.

## Historical / submission snapshots

The following can intentionally describe a particular submission or development phase and should not be treated as the live product source without verification:

- `LEPTON_SUBMISSION.md`
- `ENCODE_ARC_SUBMISSION.md`
- `FINAL_PROJECT_STATUS.md`
- `BUILD_REPORT.md`
- `RELEASE_NOTES.md`
- `PROJECT_SPEC.md`
- `README.md`

### Rule

When a historical or submission document conflicts with runtime configuration, do not change runtime behavior to match the document. Update the document or explicitly label it as a historical snapshot.
