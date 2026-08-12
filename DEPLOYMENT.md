# ARCTIS — Deployment Guide

ARCTIS is currently a **testnet-stage application**. This guide covers local/Codespaces setup and deployment to a configured testnet environment. It does not imply mainnet readiness.

## 1. Requirements

- Node.js 22 recommended.
- npm.
- Firebase project with Firestore enabled.
- WalletConnect project ID.
- OpenRouter API key for AI routes.
- A testnet wallet with the assets/gas required for the flows you intend to test.
- For bridge testing: a supported configured source chain with testnet USDC and native gas.

## 2. Install

```bash
npm install
```

## 3. Environment

```bash
cp .env.example .env.local
```

Populate the values in `.env.local`. Never commit it.

### Client configuration

- `NEXT_PUBLIC_FIREBASE_API_KEY`
- `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN`
- `NEXT_PUBLIC_FIREBASE_PROJECT_ID`
- `NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET`
- `NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID`
- `NEXT_PUBLIC_FIREBASE_APP_ID`
- `NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID` (optional)
- `NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID`
- `NEXT_PUBLIC_NETWORK_ENV`
- `NEXT_PUBLIC_APP_URL`

### Server-only configuration

- `FIREBASE_PROJECT_ID`
- `FIREBASE_CLIENT_EMAIL`
- `FIREBASE_PRIVATE_KEY`
- `OPENROUTER_API_KEY`
- `SWAP_WALLET_PRIVATE_KEY`
- `NEXT_PUBLIC_SWAP_WALLET_ADDRESS`

Never place private keys or provider secrets in `NEXT_PUBLIC_*` variables.

## 4. Local verification

```bash
npm run type-check
npm run architecture-truth
npm run build
```

Then:

```bash
npm run dev
```

Open `http://localhost:3000`.

## 5. Firebase

1. Create/select the Firebase project.
2. Enable Firestore.
3. Deploy the repository rules and indexes after reviewing them:

```bash
firebase deploy --only firestore:rules,firestore:indexes
```

4. Ensure the server has a valid Firebase Admin credential set.

The browser should not directly write sensitive Firestore collections. ARCTIS uses the Firebase Admin SDK from server-side routes.

## 6. Arc Testnet

The network and contract registry is centralized in:

`src/lib/contracts.ts`

Current testnet configuration:

- Chain ID: `5042002`
- Network: `Arc Testnet`
- Native payment/gas asset: Arc Native USDC
- Explorer: ArcScan testnet

Do not edit contract addresses in individual pages. Update the central registry and then run the architecture check.

## 7. Swap operational setup

The OTC swap layer uses a dedicated Swap Wallet as the counterparty.

Before testing swaps:

1. Configure `SWAP_WALLET_PRIVATE_KEY` securely.
2. Configure the corresponding public address.
3. Fund the wallet with the configured test assets.
4. Verify quote/reserve behavior.
5. Run a small test transaction before larger testnet demonstrations.

The Swap Wallet is not the user's wallet and must never be described as such.

## 8. Bridge operational setup

The bridge uses Circle App Kit and the repository's configured CCTP route metadata.

Before an end-to-end bridge test:

1. Fund the source wallet with the required testnet USDC.
2. Fund the source chain with its native gas asset.
3. Confirm the source/destination route is enabled by the current bridge policy.
4. Run a small bridge amount.
5. Verify both the source transaction and destination result.
6. Confirm history persistence and explorer references.

The code contains testnet route metadata for Arc Testnet, Ethereum Sepolia, Base Sepolia and Arbitrum Sepolia. Availability is still determined by current route/policy configuration.

## 9. Vercel

ARCTIS is compatible with Vercel/Next.js deployment.

Connect the repository to the desired Vercel project and configure the same environment variables for the target environment. Do not paste private keys into source files or commit deployment credentials.

For a CLI deployment in an already authenticated environment:

```bash
npx vercel --prod
```

## 10. Production/mainnet gate

Do not treat a successful Vercel build as a production readiness signal. Before any mainnet decision, at minimum:

- extend cryptographic wallet proof to remaining mutating routes;
- complete live end-to-end bridge testing;
- verify Swap Wallet operational controls and reserves;
- deploy and verify Firestore indexes/rules in the real environment;
- validate all mainnet contract/network configuration;
- perform an independent security review;
- verify monitoring, rollback and incident procedures;
- remove/disable testnet-only assumptions.

See [`SECURITY.md`](./SECURITY.md) and [`ARCHITECTURE_TRUTH.md`](./ARCHITECTURE_TRUTH.md).
