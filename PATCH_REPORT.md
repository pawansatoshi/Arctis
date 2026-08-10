# ARCTIS Economic Agent Execution Handoff Fix

## Purpose

Fix the confirmed UX bug where **Economic Agent → Review & Approve** switched the user into the Manual tab and only pre-filled the transaction form.

The corrected architecture is:

Economic Agent → Understand → Clarify → Propose → Human Approval → existing financial execution path → wallet signing → transaction lifecycle.

Manual execution remains available and is not replaced.

## Changed files

1. `src/components/agent/EconomicAgentPanel.tsx`
   - Removes the `pendingAction` → Manual-tab execution handoff.
   - Adds an `onExecute` callback.
   - Keeps the Agent panel visible during execution.
   - Displays execution state, error and transaction hash.
   - Changes the action CTA to `Review & Execute`.
   - Keeps wallet approval as the final authorization boundary.

2. `src/app/transfer/page.tsx`
   - Adds an Agent execution state.
   - Uses the existing `useTransfer()` hook for Agent execution.
   - Automatically switches to Arc Testnet when required.
   - Does not navigate to Manual mode.
   - Agent status is driven by the existing transfer transaction state.

3. `src/app/swap/page.tsx`
   - Adds an Agent execution state.
   - Reuses the existing swap page transaction logic and existing quote/route validation.
   - Agent approval populates the execution state and invokes the same existing `handleSwap()` path.
   - Existing inbound confirmation and `/api/swap/execute` lifecycle remain intact.
   - Does not navigate to Manual mode.

4. `src/app/bridge/page.tsx`
   - Adds an Agent execution state.
   - Resolves the requested source chain against the existing `/api/bridge` route registry.
   - Uses the existing wallet chain switch.
   - Reuses the existing approve → CCTP `depositForBurn` → attestation/status lifecycle.
   - Does not navigate to Manual mode.

## Important separation

The existing `pendingAction` mechanism remains untouched for the separate AI Workspace → Manual pre-fill workflow.

Economic Agent execution no longer uses `pendingAction`.

Therefore:

- AI Workspace → Manual pre-fill remains supported.
- Transfer/Swap/Bridge → Economic Agent executes directly through the existing financial flow.

## Safety

The Economic Agent never receives or stores private keys and never signs a transaction server-side.

The existing wallet transaction functions remain the execution boundary.

No mock transaction hashes or fake blockchain success states were added.

## Verification

- `git apply --check CHANGES.diff`: PASS
- Patch applied to a fresh copy of the supplied repository: PASS
- Changed files byte-match the patched working copy: PASS
- Full `npm ci`: BLOCKED in this environment because the configured package registry returned a 404 for `zwitch@2.0.4`.
- Full `npx tsc --noEmit`: NOT claimed as passed because dependencies could not be installed. A global TypeScript parse/check was run, but missing project dependencies produce unrelated module/type noise.
- `npm run build`: NOT run to completion because project dependencies are unavailable in this environment.

## Codespace verification required

After applying the patch in Codespace, run:

```bash
git apply --check CHANGES.diff
git apply CHANGES.diff
npx tsc --noEmit
npm run build
npm run dev
```

Then manually verify:

1. Transfer → Economic Agent → proposal → Review & Execute → wallet prompt → real transaction.
2. Swap → Economic Agent → proposal → Review & Execute → existing swap flow.
3. Bridge → Economic Agent → proposal → Review & Execute → source-chain switch → approval → CCTP burn → attestation → completion.
4. Manual mode still works independently for all three.
5. Economic Agent never redirects to Manual after approval.

A real transaction hash can only be verified with an interactive wallet and actual testnet funds in the Codespace/browser environment.
