// ============================================================
// ARCTIS — Global TypeScript Types
// ============================================================

// ─── Wallet / Chain ─────────────────────────────────────────
export type TransactionStatus = 'pending' | 'confirmed' | 'failed' | 'dropped';

export interface TransactionRecord {
  id: string;
  walletAddress: string;
  toAddress: string;
  amount: string;
  amountFormatted: string;
  txHash?: string;
  status: TransactionStatus;
  token: 'USDC' | 'tUSDC' | 'tARC';
  chainId: number;
  networkName?: string;
  explorerUrl?: string;
  createdAt: string;
  updatedAt?: string;
  gasUsed?: string;
  blockNumber?: number;
  note?: string;
  reason?: string;
  type?: 'send' | 'receive' | 'swap' | 'bridge' | 'credit_purchase' | 'membership' | 'refund' | 'treasury' | 'ai_usage';
}

// ─── Membership ──────────────────────────────────────────────
export type MembershipTier = 'free' | 'student' | 'pro' | 'enterprise';

export interface MembershipPlan {
  id: MembershipTier;
  name: string;
  priceUSDC: number;
  credits: number;
  features: string[];
  aiModels: string[];
  workspaces: number;
  maxFilesMB: number;
  maxAgents: number;
}

export interface UserMembership {
  userId?: string;
  walletAddress: string;
  tier: MembershipTier;
  status: 'active' | 'expired' | 'cancelled' | 'trial';
  startDate: string;
  renewalDate: string;
  txHash?: string;
  autoRenew: boolean;
}

// ─── Credits ─────────────────────────────────────────────────
export interface CreditPackage {
  id: string;
  usdcAmount: number;
  credits: number;
  bonus: number;
  label: string;
}

export interface CreditLedgerEntry {
  id: string;
  walletAddress: string;
  type: 'purchase' | 'deduct' | 'refund' | 'bonus' | 'expiry';
  credits: number;
  balanceBefore: number;
  balanceAfter: number;
  description: string;
  aiModel?: string;
  sessionId?: string;
  txHash?: string;
  createdAt: string;
}

export interface CreditBalance {
  total: number;
  used: number;
  remaining: number;
  expiresAt?: string;
}

// ─── AI ──────────────────────────────────────────────────────
export type AIProvider = 'openrouter' | 'groq' | 'gemini';

// All supported AI modes — includes new educational roles
export type AIMode =
  | 'study' | 'build' | 'analyze' | 'research'
  | 'generate' | 'treasury' | 'developer' | 'student'
  | 'teacher' | 'professor' | 'child' | 'engineering';

export interface AIModel {
  id: string;
  name: string;
  provider: AIProvider;
  creditCostPer1k: number;
  contextWindow: number;
  capabilities: ('text' | 'vision' | 'code' | 'reasoning')[];
}

export interface AIMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: string;
  model?: string;
  creditsUsed?: number;
  tokens?: { prompt: number; completion: number };
  attachments?: AIAttachment[];
  actionProposal?: { action: 'transfer' | 'swap' | 'bridge'; amount: string; fromToken?: string; toToken?: string; recipient?: string; sourceChain?: string; sourceChainId?: number; createdAt: number };
  // A financial action still missing a required field — the message content
  // already contains the question; this carries the state to resolve on
  // the user's next reply. Distinct from actionProposal, which is only
  // ever set once every required field is present and validated.
  clarification?: { action: 'transfer' | 'swap' | 'bridge'; amount: string; fromToken?: string; toToken?: string; recipient?: string; sourceChain?: string; sourceChainId?: number; missing: 'recipient' | 'toToken' | 'sourceChain' | 'full'; error?: string; createdAt: number };
}

export interface AIAttachment {
  type: 'image' | 'pdf' | 'file';
  name: string;
  url?: string;
  base64?: string;
  mimeType: string;
}

export interface AISession {
  id: string;
  walletAddress: string;
  mode: AIMode;
  title: string;
  messages: AIMessage[];
  totalCredits: number;
  model: string;
  createdAt: string;
  updatedAt: string;
  workspaceId?: string;
}

// ─── Workspace ───────────────────────────────────────────────
export type WorkspaceDomain =
  | 'student' | 'developer' | 'research' | 'treasury'
  | 'engineering' | 'operations' | 'teacher' | 'professor' | 'child';

export interface Workspace {
  id: string;
  walletAddress: string;
  domain: WorkspaceDomain;
  name: string;
  description?: string;
  savedPrompts: SavedPrompt[];
  memory: string;
  createdAt: string;
  updatedAt: string;
}

export interface SavedPrompt {
  id: string;
  title: string;
  content: string;
  mode: AIMode;
  createdAt: string;
}

// ─── Treasury ────────────────────────────────────────────────
export interface TreasurySnapshot {
  id: string;
  timestamp: string;
  totalUSDC: number;
  membershipRevenue30d: number;
  creditRevenue30d: number;
  aiSpend30d: number;
  netFlow30d: number;
  txCount30d: number;
  activeMembers: number;
}

export interface TreasuryLog {
  id: string;
  type: 'membership_payment' | 'credit_purchase' | 'ai_spend' | 'transfer' | 'refund'
      | 'swap_inflow' | 'swap_outflow' | 'swap_fee_revenue'
      | 'bridge_inbound_activity' | 'agent_spend';
  amount: number;
  description: string;
  walletAddress?: string;
  txHash?: string;
  explorerUrl?: string;
  networkName?: string;
  chainId?: number;
  blockNumber?: string;
  gasUsed?: string;
  createdAt: string;
}

// ─── Observability ───────────────────────────────────────────
export interface ObsLog {
  id: string;
  level: 'info' | 'warn' | 'error' | 'debug';
  category: 'ai' | 'wallet' | 'credits' | 'treasury' | 'swap' | 'bridge' | 'auth' | 'perf';
  message: string;
  data?: Record<string, unknown>;
  walletAddress?: string;
  createdAt: string;
}

// ─── Swap / Bridge ───────────────────────────────────────────
export type SwapProvider = 'lifi' | 'socket' | 'relay' | 'across' | 'debridge';
export type SwapStatus = 'unsupported' | 'available' | 'pending' | 'confirmed' | 'failed';

export interface SwapRoute {
  provider: SwapProvider;
  fromToken: string;
  toToken: string;
  fromAmount: string;
  toAmount: string;
  estimatedGas: string;
  priceImpact: number;
  steps: { type: string; protocol: string; description: string }[];
}

// ─── Admin ───────────────────────────────────────────────────
export interface AdminUser {
  walletAddress: string;
  membership: MembershipTier;
  credits: number;
  totalSpentUSDC: number;
  joinedAt: string;
  lastActive: string;
  status: 'active' | 'suspended' | 'banned';
}

export interface FeatureFlag {
  id: string;
  name: string;
  enabled: boolean;
  description: string;
  rolloutPercent: number;
}

// ─── Feedback ────────────────────────────────────────────────
export type FeedbackCategory = 'bug_report' | 'feature_request' | 'improvement' | 'general';

export interface FeedbackEntry {
  id: string;
  name: string;
  country: string;
  email?: string;
  category: FeedbackCategory;
  message: string;
  walletAddress?: string;
  timestamp: string;
  status: 'new' | 'reviewed' | 'resolved';
}

export interface NavItem {
  label: string;
  href: string;
  icon: string;
  badge?: string | number;
  group?: string;
}

// ─── Economic Agent Layer (Lepton) ──────────────────────────

export type AgentType =
  | 'research'
  | 'developer'
  | 'engineering'
  | 'treasury'
  | 'monitoring'
  | 'document'
  | 'custom';

export type AgentStatus = 'idle' | 'running' | 'paused' | 'error' | 'archived';

export interface Agent {
  id: string;
  ownerWallet: string;
  name: string;
  type: AgentType;
  description: string;
  goals: string[];           // what the agent is trying to accomplish
  instructions: string;      // system-level instructions for this agent
  model: string;             // preferred AI model
  status: AgentStatus;
  // Budget management
  monthlyBudgetCredits: number;
  maxCreditsPerExecution: number;
  creditsUsedThisMonth: number;
  budgetResetDate: string;   // ISO date — first of next month
  // Metadata
  createdAt: string;
  lastActiveAt: string | null;
  executionCount: number;
  totalCreditsConsumed: number;
  // Associated content
  reportIds: string[];
  tags: string[];
}

export type AgentExecutionStatus =
  | 'proposed'    // created, awaiting human review — Prepare phase complete
  | 'approved'    // human approved, queued for execution
  | 'rejected'    // human rejected, will not run, zero credits consumed
  | 'pending'
  | 'running'
  | 'completed'
  | 'failed'
  | 'cancelled';

export interface AgentExecution {
  id: string;
  agentId: string;
  agentName: string;
  agentType: AgentType;
  ownerWallet: string;
  // Task
  task: string;              // human-readable task description
  input: string;             // full input sent to AI
  outputSummary: string;     // summary of what was produced
  outputFull?: string;       // full output (may be large)
  // Economy
  creditsConsumed: number;
  model: string;
  // Timing
  status: AgentExecutionStatus;
  startedAt: string;
  completedAt: string | null;
  durationMs: number | null;
  // References
  reportId?: string;         // if a report was generated
  relatedTxHashes: string[];
  errorMessage?: string;
  // Evaluation (Phase 16 — Independent Evaluator Layer, additive, optional)
  evaluationVerdict?: 'PASS' | 'FAIL';
  evaluationReasons?: string[];
  evaluationSuggestions?: string;
  revisionCount?: number;    // how many times the generator revised after a FAIL
}

export interface AgentLedgerEntry {
  id: string;
  agentId: string;
  ownerWallet: string;
  type: 'execution' | 'budget_allocated' | 'budget_reset' | 'created' | 'archived';
  creditsAmount: number;     // negative = consumed, positive = allocated
  balanceBefore: number;
  balanceAfter: number;
  description: string;
  executionId?: string;
  createdAt: string;
}

export interface AgentReport {
  id: string;
  agentId: string;
  agentName: string;
  ownerWallet: string;
  title: string;
  type: AgentType;
  content: string;           // full markdown report
  summary: string;           // 2-3 sentence summary
  executionId: string;
  createdAt: string;
  tags: string[];
}
