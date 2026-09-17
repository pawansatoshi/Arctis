<div align="center">
  <img src="./public/icons/logo.svg" alt="ARCTIS" width="84" height="84" />
  <h1>ARCTIS</h1>
  <p><strong>Programmable money for humans and AI agents.</strong></p>
  <p>AI · Knowledge · Stablecoins · Economic Agents · Identity · Membership</p>
  <p><strong>Built for Arc</strong> · environment-aware · wallet-controlled · USDC-native</p>
  <p><strong>🌐 Website:</strong> <a href="https://arctis-zeta.vercel.app">https://arctis-zeta.vercel.app</a></p>
</div>

---

## What is ARCTIS?

ARCTIS is an **AI operating environment for programmable money** built for Arc. It combines AI assistance, bounded knowledge context, stablecoin operations, human-readable identity, membership and Economic Agents in one product.

The core thesis is not "AI with a wallet". It is a controlled execution pipeline:

```text
Natural-language intent
        ↓
Deterministic interpretation / policy
        ↓
Proposal
        ↓
Live quote + preflight
        ↓
Human review
        ↓
Wallet approval
        ↓
Transaction submitted
        ↓
Processing / confirmation
        ↓
Onchain execution
        ↓
History / proof / accounting
```

> **ARCTIS is the application layer. Arc is the settlement infrastructure.**

### Arc Mainnet core

The mainnet-compatible transaction path uses Arc Mainnet chain ID `5042`, Arc Mainnet RPC `https://rpc.mainnet.arc.io`, Arc Explorer `https://explorer.arc.io`, and Arc's USDC interfaces. The application remains environment-aware so testnet-only routes and contracts are not silently treated as mainnet infrastructure.

See [`docs/ARC_MAINNET_MIGRATION.md`](./docs/ARC_MAINNET_MIGRATION.md) and [`docs/MAINNET_ROADMAP_STATUS.md`](./docs/MAINNET_ROADMAP_STATUS.md) for the release gates and current deployment state.
