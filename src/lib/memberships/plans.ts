import type { MembershipPlan, CreditPackage } from '@/types';

// ============================================================
// Membership Plans — USDC denominated
// Extended with Agent limits (Lepton layer)
// ============================================================
export const MEMBERSHIP_PLANS: MembershipPlan[] = [
  {
    id: 'free',
    name: 'Free',
    priceUSDC: 0,
    credits: 100,
    features: ['100 AI credits/month', '1 workspace', '1 agent', 'Basic transfers', 'Tx history'],
    aiModels: ['kimi-k1-5-32k'],
    workspaces: 1,
    maxFilesMB: 5,
    maxAgents: 1,
  },
  {
    id: 'student',
    name: 'Student',
    priceUSDC: 9,
    credits: 1000,
    features: ['1,000 AI credits/month', '3 workspaces', '3 agents', 'All AI modes', 'File uploads', 'Priority support'],
    aiModels: ['kimi-k1-5-32k', 'deepseek-chat', 'gemma-3-27b-it'],
    workspaces: 3,
    maxFilesMB: 50,
    maxAgents: 3,
  },
  {
    id: 'pro',
    name: 'Pro',
    priceUSDC: 29,
    credits: 5000,
    features: ['5,000 AI credits/month', 'Unlimited workspaces', '10 agents', 'All models', 'Treasury module', 'Analytics'],
    aiModels: ['kimi-k1-5-32k', 'deepseek-chat', 'qwen-2.5-72b-instruct', 'gpt-4o-mini', 'gemma-3-27b-it'],
    workspaces: 999,
    maxFilesMB: 500,
    maxAgents: 10,
  },
  {
    id: 'enterprise',
    name: 'Enterprise',
    priceUSDC: 99,
    credits: 25000,
    features: ['25,000 AI credits/month', 'Custom models', 'Unlimited agents', 'Admin panel', 'Priority SLA'],
    aiModels: ['all'],
    workspaces: 999,
    maxFilesMB: 5000,
    maxAgents: 999,
  },
];

// Credit packages
export const CREDIT_PACKAGES: CreditPackage[] = [
  { id: 'starter', usdcAmount: 10,  credits: 100,  bonus: 0,    label: '' },
  { id: 'value',   usdcAmount: 50,  credits: 600,  bonus: 100,  label: 'Popular' },
  { id: 'power',   usdcAmount: 100, credits: 1400, bonus: 400,  label: 'Best Value' },
  { id: 'pro',     usdcAmount: 250, credits: 4000, bonus: 1500, label: 'Pro Pack' },
];

// Credit costs per AI model (per 1k tokens)
export const CREDIT_COSTS: Record<string, number> = {
  'kimi-k1-5-32k':          1,
  'deepseek-chat':          1,
  'gemma-3-27b-it':         1,
  'qwen-2.5-72b-instruct':  2,
  'gpt-4o-mini':            2,
  'gpt-4o':                 10,
  'claude-3-haiku':         2,
  'claude-3-5-sonnet':      10,
};

export const OPERATION_COSTS = {
  imageAnalysis: 5,
  pdfPage: 2,
  voicePerMinute: 3,
  agentExecution: 5, // base cost per agent execution (+ model token cost)
};
