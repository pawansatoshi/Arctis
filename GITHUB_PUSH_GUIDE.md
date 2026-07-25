# GITHUB_PUSH_GUIDE.md — ARCTIS

## Before First Push

### 1. Verify .gitignore is correct

Confirm the following are excluded (already present in `.gitignore`):
- `.env`, `.env.local`, `.env.development.local`, `.env.test.local`, `.env.production.local`
- `/node_modules`
- `/.next/`
- `/build`

Run this before your first commit to double-check nothing sensitive is staged:

```bash
git status
```

If any `.env*` file (other than `.env.example`) appears in the output, do not commit — check your `.gitignore` first.

### 2. Scan for accidentally hardcoded secrets

```bash
grep -rn "sk-or-\|SWAP_WALLET_PRIVATE_KEY\s*=\s*0x[a-fA-F0-9]" src/ --include="*.ts" --include="*.tsx"
```

This should return nothing. If it returns a match, remove the hardcoded value and replace it with `process.env.VARIABLE_NAME` before committing.

### 3. Confirm .env.example is complete and safe

`.env.example` should contain every environment variable key the app needs, with placeholder values only (e.g. `your_api_key_here`). Never put a real value in `.env.example`.

## Recommended Commit Structure

If this is the first push of the full 19-phase build, consider structuring the initial history as logical commits rather than one giant commit — this makes the repository easier to review for judges, collaborators, or auditors:

```bash
git add src/lib/contracts.ts src/lib/chain/ src/lib/firebase/
git commit -m "Core infrastructure: contracts, chain config, Firebase persistence"

git add src/app/transfer/ src/lib/hooks/useTransfer.ts
git commit -m "Stablecoin OS: Transfer with full proof chain"

git add src/lib/swap/ src/app/swap/ src/app/api/swap/
git commit -m "Stablecoin OS: Swap OTC engine with real settlement"

git add src/lib/bridge/ src/app/bridge/ src/app/api/bridge/
git commit -m "Stablecoin OS: Bridge via CCTP V2"

git add src/lib/passport/ src/app/passport/ src/app/p/ src/app/api/passport/ src/components/passport/
git commit -m "Identity Layer: Passport with strict signature verification"

git add src/lib/memo/
git commit -m "Transaction Memo architecture"

git add src/lib/agents/ src/app/agents/ src/app/api/agents/ src/components/agents/
git commit -m "Economic Agent OS: 7 agent types, Approval Gate, Independent Evaluator Layer"

git add src/lib/ai/copilot/ src/app/copilot/ src/app/api/ai/copilot/ src/lib/hooks/useSpeechInput.ts src/lib/preferences/
git commit -m "AI OS: Copilot with dynamic context, Voice Layer, multi-language preferences"

git add src/lib/security/
git commit -m "Production hardening: rate limiting, RPC fallback, environment validation"

git add *.md firestore.indexes.json
git commit -m "Documentation and deployment configuration"
```

## Repository README Check

Before pushing, confirm `README.md` at the repo root accurately describes the current state of the project (it has been updated as part of Phase 19 — verify it still matches if further changes are made after this point).

## Branch Protection (Recommended for Team Use)

If this repository will have multiple contributors:
- Protect `main` — require pull request review before merge
- Require status checks (build, typecheck) to pass before merge
- Do not allow force-push to `main`

## Final Pre-Push Checklist

- [ ] `.env.local` is not staged
- [ ] No hardcoded API keys or private keys anywhere in `src/`
- [ ] `.env.example` has placeholder values only, and lists every required variable
- [ ] `README.md` is current
- [ ] `npm run build` succeeds locally before pushing
