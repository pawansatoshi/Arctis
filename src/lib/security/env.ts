// ============================================================
// Environment Validation — Phase 18: Production Hardening
// Validates required environment variables are present without
// ever logging or exposing their values. Call validateEnv() at
// app startup (e.g. in a root layout or instrumentation file).
// ============================================================

interface EnvCheck {
  key: string;
  required: boolean;
  context: string;
}

const ENV_CHECKS: EnvCheck[] = [
  { key: 'NEXT_PUBLIC_FIREBASE_API_KEY',        required: true,  context: 'Firebase — required for all persistence' },
  { key: 'NEXT_PUBLIC_FIREBASE_PROJECT_ID',     required: true,  context: 'Firebase — required for all persistence' },
  { key: 'OPENROUTER_API_KEY',                  required: true,  context: 'AI OS — required for all AI/agent inference' },
  { key: 'NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID',required: true,  context: 'Wallet connection — required for RainbowKit' },
  { key: 'SWAP_WALLET_PRIVATE_KEY',             required: false, context: 'Swap OTC settlement — swaps will fail without this, but app still boots' },
  { key: 'NEXT_PUBLIC_SWAP_WALLET_ADDRESS',     required: false, context: 'Swap OTC settlement — public counterpart to the above' },
];

export interface EnvValidationResult {
  ok: boolean;
  missing: { key: string; context: string }[];
  warnings: { key: string; context: string }[];
}

/**
 * Validates environment variables are present. Never logs or
 * returns actual values — only key names and whether they're set.
 */
export function validateEnv(): EnvValidationResult {
  const missing: { key: string; context: string }[] = [];
  const warnings: { key: string; context: string }[] = [];

  for (const check of ENV_CHECKS) {
    const value = process.env[check.key];
    const isSet = !!value && value.trim().length > 0 && !value.includes('your_') && !value.includes('_here');

    if (!isSet) {
      if (check.required) missing.push({ key: check.key, context: check.context });
      else warnings.push({ key: check.key, context: check.context });
    }
  }

  return { ok: missing.length === 0, missing, warnings };
}

/**
 * Call at startup. Throws in production if required vars are
 * missing (fail fast rather than serve a broken app). Logs
 * warnings for optional-but-recommended vars without throwing.
 */
export function assertEnvOrThrow(): void {
  const result = validateEnv();

  if (result.warnings.length > 0) {
    for (const w of result.warnings) {
      // eslint-disable-next-line no-console
      console.warn(`[ENV WARNING] ${w.key} not set — ${w.context}`);
    }
  }

  if (!result.ok) {
    const list = result.missing.map((m) => `  - ${m.key} (${m.context})`).join('\n');
    const message = `Missing required environment variables:\n${list}`;
    if (process.env.NODE_ENV === 'production') {
      throw new Error(message);
    } else {
      // eslint-disable-next-line no-console
      console.error(`[ENV ERROR — non-fatal in dev]\n${message}`);
    }
  }
}
