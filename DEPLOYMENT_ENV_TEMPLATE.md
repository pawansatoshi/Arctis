# DEPLOYMENT_ENV_TEMPLATE.md — ARCTIS

Complete environment variable reference. Copy `.env.example` to `.env.local` and fill in real values.

**Never commit `.env.local`.**

---

## Required Variables

### Firebase (Client SDK — intentionally public)

These are public by design. Firebase security rules enforce access control server-side.

```env
NEXT_PUBLIC_FIREBASE_API_KEY=your_firebase_api_key
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=your_project.firebaseapp.com
NEXT_PUBLIC_FIREBASE_PROJECT_ID=your_project_id
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=your_project.appspot.com
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=your_sender_id
NEXT_PUBLIC_FIREBASE_APP_ID=your_app_id
```

**How to get:** Firebase Console → Project Settings → Your apps → Web app → SDK setup

---

### AI Provider (Server-side only)

```env
OPENROUTER_API_KEY=sk-or-v1-your_key_here
```

⚠️ **Must NEVER be in a `NEXT_PUBLIC_*` variable.** Server-side only.

**How to get:** https://openrouter.ai/keys

**Used by:** All AI routes (`/api/ai/chat`, `/api/ai/copilot`, agent executor, evaluator)

---

### Wallet Connection

```env
NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID=your_walletconnect_project_id
```

**How to get:** https://cloud.walletconnect.com/ → Create project

**Used by:** RainbowKit wallet connection (MetaMask, Coinbase Wallet, WalletConnect QR)

---

### Swap Wallet (Server-side only)

```env
SWAP_WALLET_PRIVATE_KEY=0x_your_dedicated_swap_wallet_private_key
NEXT_PUBLIC_SWAP_WALLET_ADDRESS=0x_your_dedicated_swap_wallet_address
```

⚠️ `SWAP_WALLET_PRIVATE_KEY` must NEVER be in a `NEXT_PUBLIC_*` variable.

This is a **dedicated EOA wallet** used exclusively for OTC swap settlement. It is NOT the Treasury Wallet. It must be funded with testnet USDC, tUSDC, and tARC before swaps can settle.

**How to generate:**
```bash
# Using cast (Foundry)
cast wallet new

# Or using ethers.js
node -e "const {Wallet} = require('ethers'); const w = Wallet.createRandom(); console.log('Address:', w.address); console.log('Private Key:', w.privateKey)"
```

**Used by:** `/api/swap/execute` — dispatches outbound token transfer from this wallet to the user

---

### App Config

```env
NEXT_PUBLIC_APP_URL=https://your-deployment-url.vercel.app
NEXT_PUBLIC_APP_NAME=ARCTIS
NEXT_PUBLIC_APP_VERSION=1.0.0
```

---

## Optional Variables

```env
# Analytics (PostHog)
NEXT_PUBLIC_POSTHOG_KEY=phc_your_key_here
NEXT_PUBLIC_POSTHOG_HOST=https://app.posthog.com

# AI Feature Flag (set to 'true' to enable — defaults to false if not set)
NEXT_PUBLIC_AI_ENABLED=true
```

---

## Vercel Deployment

Set all variables in: Vercel Dashboard → Project → Settings → Environment Variables

**Important:** Mark `OPENROUTER_API_KEY` and `SWAP_WALLET_PRIVATE_KEY` as **Production only** and ensure they are not exposed to Preview deployments unless intentional.

---

## GitHub Codespaces

Create a `.devcontainer/devcontainer.json` with `secrets` or set the variables as GitHub Codespace secrets:

GitHub → Settings → Secrets and variables → Codespaces → New repository secret

Add each variable listed in the Required section above.

---

## Local Development Checklist

1. Copy template: `cp .env.example .env.local`
2. Fill in all Required variables
3. Optional: set `NEXT_PUBLIC_AI_ENABLED=true` to test AI features
4. Run: `npm install`
5. Run: `npm run dev`
6. Open: `http://localhost:3000`
7. Connect MetaMask to Arc Testnet (Chain ID 5042002)

---

## Arc Testnet Network Config

Add this to MetaMask manually or use the "Switch Network" prompt in ARCTIS:

| Field | Value |
|-------|-------|
| Network Name | Arc Testnet |
| RPC URL | https://rpc.testnet.arc.network |
| Chain ID | 5042002 |
| Currency Symbol | ARC |
| Block Explorer | https://testnet.arcscan.app |

---

## Dependency Services

| Service | Required | Purpose | Free Tier |
|---------|---------|---------|----------|
| Firebase (Firestore) | ✅ Required | All persistence | Yes (Spark plan) |
| OpenRouter | ✅ Required | AI inference | Pay-per-use |
| WalletConnect Cloud | ✅ Required | Wallet connection | Yes |
| Arc Testnet RPC | ✅ Required (free) | Chain interaction | Public RPC free |
| PostHog | ❌ Optional | Analytics | Yes |
| Vercel | ❌ Optional | Hosting | Yes (Hobby) |
