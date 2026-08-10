# Apply ARCTIS Economic Agent Execution Fix

From the root of the ARCTIS repository:

```bash
git status
git apply --check CHANGES.diff
git apply CHANGES.diff
```

Then verify:

```bash
npx tsc --noEmit
npm run build
```

Run the application:

```bash
npm run dev
```

Manual runtime test:

```text
/transfer
  Manual | Economic Agent
  → send 1 USDC to a valid testnet address
  → Review & Execute
  → wallet signature
  → transaction result

/swap
  Manual | Economic Agent
  → swap a supported amount/pair
  → Review & Execute
  → wallet signature
  → existing swap lifecycle

/bridge
  Manual | Economic Agent
  → bridge a supported amount/source chain
  → Review & Execute
  → wallet switch if required
  → approve
  → CCTP depositForBurn
  → attestation
  → completion
```

Do not replace the existing manual flow.

Do not use the old `pendingAction` copy commands to overwrite these files after applying this patch.
