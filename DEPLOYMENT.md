# ARCTIS Deployment Guide

## Prerequisites
- Node.js 18+
- WalletConnect Project ID (cloud.walletconnect.com)
- Firebase project with Firestore enabled
- OpenRouter API key (openrouter.ai)

## 1. Install dependencies
```bash
npm install
```

## 2. Environment variables
```bash
cp .env.example .env.local
```
Fill in all values in `.env.local` — never commit this file.

Required:
- `NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID`
- `OPENROUTER_API_KEY`
- `NEXT_PUBLIC_FIREBASE_API_KEY`
- `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN`
- `NEXT_PUBLIC_FIREBASE_PROJECT_ID`
- `NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET`
- `NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID`
- `NEXT_PUBLIC_FIREBASE_APP_ID`

## 3. Set Treasury Wallet
Before deployment, set your real treasury wallet in `src/lib/contracts.ts`:
```ts
treasury: '0xb467F683764593316fAEbB0709127E90791Fe47F', // testnet
```

## 4. Firebase Setup
1. Create Firestore database in production mode
2. Add Firestore security rules (see SECURITY_NOTES.md)
3. Enable Analytics (optional)

## 5. Firestore Collections Created Automatically
- `transactions` — wallet transfers
- `credit_balances` — per-wallet credit balances
- `credit_ledger` — credit purchase/deduction history
- `memberships` — active membership records
- `ai_sessions` — persisted AI conversations
- `saved_prompts` — user prompt library
- `treasury_logs` — revenue accounting
- `agents` — economic agent definitions
- `agent_executions` — agent run history
- `agent_ledger` — agent credit accounting
- `agent_reports` — generated reports
- `feedback` — user feedback submissions
- `obs_logs` — system observability logs

## 6. Vercel Deployment
```bash
npx vercel --prod
```
Add all environment variables in Vercel Dashboard → Settings → Environment Variables.

## 7. Arc Testnet RPC
No configuration needed — RPC is set in `src/lib/contracts.ts`:
- RPC: https://rpc.testnet.arc.network
- Chain ID: 5042002
- Explorer: https://testnet.arcscan.app

## 8. Get testnet funds
- USDC: https://faucet.circle.com/
- Sepolia ETH: https://cloud.google.com/application/web3/faucet/ethereum/sepolia
