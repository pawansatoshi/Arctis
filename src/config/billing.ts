import type { CreditPackage, MembershipPlan } from '@/types';

/** ARCTIS billing source of truth. */
export const MEMBERSHIP_PLANS: MembershipPlan[] = [
  { id: 'free', name: 'Free', priceUSDC: 0, credits: 100, features: ['100 AI credits/month', '1 workspace', '1 agent', 'Basic transfers', 'Tx history'], aiModels: ['automatic'], workspaces: 1, maxFilesMB: 5, maxAgents: 1 },
  { id: 'student', name: 'Student', priceUSDC: 9, credits: 1000, features: ['1,000 AI credits/month', '3 workspaces', '3 agents', 'All AI modes', 'File uploads', 'Priority support'], aiModels: ['automatic'], workspaces: 3, maxFilesMB: 50, maxAgents: 3 },
  { id: 'pro', name: 'Pro', priceUSDC: 29, credits: 5000, features: ['5,000 AI credits/month', 'Unlimited workspaces', '10 agents', 'All AI modes', 'Treasury module', 'Analytics'], aiModels: ['automatic'], workspaces: 999, maxFilesMB: 500, maxAgents: 10 },
  { id: 'enterprise', name: 'Enterprise', priceUSDC: 99, credits: 25000, features: ['25,000 AI credits/month', 'Custom deployment options', 'Unlimited agents', 'Admin panel', 'Priority SLA'], aiModels: ['automatic'], workspaces: 999, maxFilesMB: 5000, maxAgents: 999 },
];

/** Paid top-up packages. Total grant = credits + bonus. */
export const CREDIT_PACKAGES: CreditPackage[] = [
  { id: 'starter', usdcAmount: 10, credits: 100, bonus: 0, label: '' },
  { id: 'value', usdcAmount: 50, credits: 600, bonus: 100, label: 'Popular' },
  { id: 'power', usdcAmount: 100, credits: 1400, bonus: 400, label: 'Best Value' },
  { id: 'pro', usdcAmount: 250, credits: 4000, bonus: 1500, label: 'Pro Pack' },
];

/** Flat text-generation rate. Backend model identity never changes user pricing. */
export const CREDITS_PER_1K_TOKENS = 1;

export const OPERATION_COSTS = {
  imageAnalysis: 5,
  pdfPage: 2,
  voicePerMinute: 3,
  agentExecution: 5,
} as const;

export function totalCreditsForPackage(pkg: CreditPackage): number { return pkg.credits + pkg.bonus; }
export function getCreditPackage(packageId: string): CreditPackage | undefined { return CREDIT_PACKAGES.find((pkg) => pkg.id === packageId); }
export function formatCreditPackage(pkg: CreditPackage): string { return `${pkg.usdcAmount} USDC → ${(pkg.credits + pkg.bonus).toLocaleString()} credits`; }
