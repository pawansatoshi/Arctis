# ARCTIS Security Notes

## Smart Contract Addresses (testnet)
- Arc Native USDC: 0x3600000000000000000000000000000000000000
- tUSDC: 0x28E49B36C1c6fD16ad81aB152488f37C93b3D8CA
- tARC: 0xe66a11cb4b147F208e6d81B7540bfc83E1680c78
- Treasury: 0xb467F683764593316fAEbB0709127E90791Fe47F

## Payment Security
All USDC payments are verified on-chain before granting credits or membership:
- Server calls Arc Testnet RPC with viem
- Verifies: tx status = success, recipient = TREASURY_WALLET
- Parses Transfer event log to verify token + amount
- File: src/lib/chain/verify.ts

## API Security
- AI route: credit pre-check before every call (HTTP 402 if insufficient)
- Membership tier enforced: model requested validated against allowed models
- No wallet signature verification on API routes yet (Phase 2B item)
- All API routes log to Firebase obs_logs

## Admin Access
- Admin panel restricted by wallet address array
- Current admin: 0xb467f683764593316faebb0709127e90791fe47f
- Add wallet addresses to ADMIN_WALLETS in src/app/admin/page.tsx

## Firestore Security Rules (recommended)
```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // Credit balances — read own, write via server only
    match /credit_balances/{wallet} {
      allow read: if request.auth != null && request.auth.uid == wallet;
      allow write: if false; // server-side only
    }
    // Feedback — create only
    match /feedback/{id} {
      allow create: if true;
      allow read, update, delete: if false;
    }
    // All other collections — server-side only
    match /{document=**} {
      allow read, write: if false;
    }
  }
}
```

## Known Security Gaps (to address before mainnet)
1. No wallet signature verification on API calls — add SIWE (Sign-In With Ethereum)
2. Credit deduction is post-AI not pre-AI for streaming — could allow slight over-use
3. Agent execution does not verify caller owns the agent — add wallet check in executor
4. Admin wallet check is client-side only — move to server-side middleware

## Environment Variables
- OPENROUTER_API_KEY — server-side only, never in NEXT_PUBLIC_*
- Firebase API keys — these are public by design but restrict via Firebase rules
- WalletConnect project ID — public, safe to expose
