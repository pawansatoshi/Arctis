# CI verification contract

ARCTIS CI is the source-of-truth verification gate for the repository.

The `CI` workflow validates, in order:

1. Node dependency installation
2. Foundry availability and version
3. Solidity compilation
4. Solidity unit and fuzz tests
5. TypeScript type checking
6. Regression tests
7. Architecture truth validation
8. ESLint
9. Production build

The workflow uses a read-only repository token and installs Node dependencies without lifecycle scripts for deterministic CI execution.

A production deployment is not considered verified from CI alone; the deployed commit must also be confirmed by the hosting provider and live health checks.
