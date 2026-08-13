import { MEMBERSHIP_PLANS, CREDIT_PACKAGES, CREDITS_PER_1K_TOKENS } from '@/config/billing';
import { AI_MODES } from '@/config/ai';
import { ARCTIS_ASSETS } from '@/config/assets';
import { CHAIN_ID, EXPLORER_URL, TREASURY_WALLET, NETWORK_NAME } from '@/lib/contracts';

/**
 * Product facts are generated from runtime configuration so Copilot cannot
 * silently drift from pricing, modes, assets or network configuration.
 */
export function buildCanonicalProductContext(): string {
  const memberships = MEMBERSHIP_PLANS
    .map((plan) => `${plan.name}: ${plan.priceUSDC} USDC, ${plan.credits.toLocaleString()} credits/month`)
    .join(' · ');

  const packages = CREDIT_PACKAGES
    .map((pkg) => `${pkg.id}: ${pkg.usdcAmount} USDC → ${(pkg.credits + pkg.bonus).toLocaleString()} credits`)
    .join(' · ');

  const assets = Object.values(ARCTIS_ASSETS)
    .map((asset) => `${asset.symbol} (${asset.rail}${asset.executable ? ', executable' : ''})`)
    .join(' · ');

  const modes = AI_MODES.map((mode) => mode.label).join(', ');

  return `
## Canonical ARCTIS Product Context
- Network: ${NETWORK_NAME} · Chain ID ${CHAIN_ID} · Explorer ${EXPLORER_URL}
- Primary asset: Arc Native USDC; it is the primary payment/gas asset in the current ARCTIS testnet configuration.
- Treasury: ${TREASURY_WALLET}
- Executable ARCTIS assets: ${assets}
- Circle-rail assets are only described when their active contract/route configuration is present; do not invent unsupported assets or routes.
- AI personas: ${modes} (${AI_MODES.length} total). Backend model selection is automatic; never expose or promise a particular model.
- Text usage pricing: ${CREDITS_PER_1K_TOKENS} credit per 1,000 tokens. Non-text operation costs are defined in @/config/billing.
- Memberships: ${memberships}
- Credit top-ups: ${packages}
- Knowledge OS currently provides workspace domains, sessions, saved prompts and agent/report context. It should not claim document retrieval or persistent cross-session memory unless those capabilities are explicitly implemented.
- Economic Agent OS uses Propose → Review → Approve → Execute. Agents do not autonomously sign user wallet transactions.
- Stablecoin actions: Transfer, ARCTIS OTC Swap where configured, and CCTP V2 Bridge/Forwarding where configured. Do not invent unsupported token routes.
`;
}
