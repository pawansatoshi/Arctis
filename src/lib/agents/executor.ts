// ============================================================
// Agent Executor — runs an agent task via AI router
// Reuses existing OpenRouter infrastructure and credit system
// ============================================================
import { routeAIRequest, routeAIStream } from '@/lib/ai/router';
import { parseFinancialIntent, describeIntent } from '@/lib/ai/intent/parser';
import { getPassportByUsername } from '@/lib/passport/service';
import { getCreditBalance } from '@/lib/credits/engine';
import { OPERATION_COSTS } from '@/lib/memberships/plans';
import { obs } from '@/lib/observability/logger';
import { evaluateAgentOutput } from './evaluator';
import {
  getAgent, checkAgentBudget, recordExecution,
  updateExecution, chargeAgentExecution, saveAgentReport, updateAgent,
} from './service';
import type { Agent, AgentExecution, AgentReport, AgentType } from '@/types';
import type { PendingFinancialAction } from '@/lib/store';

// Per-type system prompts — injected alongside agent instructions
const AGENT_SYSTEM_PROMPTS: Record<AgentType, string> = {
  research: `You are a Research Agent. Your purpose is to research topics thoroughly, analyze information, extract key insights, identify patterns, and produce structured reports. Always cite your reasoning. Structure outputs as: Summary → Key Findings → Analysis → Recommendations.`,

  developer: `You are a Developer Agent. You write production-grade code, conduct security reviews, generate architecture, analyze smart contracts, and produce technical documentation. Default to TypeScript, Next.js, Solidity, and Arc/EVM patterns. Always include error handling, types, and comments.`,

  engineering: `You are an Engineering Agent. You perform technical analysis, calculations, diagnostics, system specifications, and safety assessments. Produce structured technical reports with clear methodology, calculations shown, and actionable recommendations.`,

  treasury: `You are a Treasury Agent. You analyze financial operations, track USDC flows, review membership and credit revenue, assess treasury health, and generate accounting summaries. Be precise, use numbers, flag anomalies.`,

  monitoring: `You are a Monitoring Agent. You analyze system state, wallet activity, RPC health, API responses, and operational metrics. Produce structured alerts and observation logs. Flag anything unusual with severity levels.`,

  document: `You are a Document Agent. You analyze documents, extract structured information, perform OCR interpretation, organize knowledge, and generate summaries. Produce clean, organized output preserving the source structure.`,

  custom: `You are a Custom Agent. Follow your specific instructions exactly. Produce structured, useful output relevant to your assigned goals.`,
};

// ─── Main executor ───────────────────────────────────────────
export interface ExecuteAgentParams {
  agentId: string;
  task: string;
  callerWallet?: string;  // wallet making the request — ownership verification
  onChunk?: (chunk: string) => void;
}

export interface ExecuteAgentResult {
  executionId: string;
  outputSummary: string;
  outputFull: string;
  creditsConsumed: number;
  reportId?: string;
  durationMs: number;
}

export async function executeAgent(
  params: ExecuteAgentParams
): Promise<ExecuteAgentResult> {
  const start = Date.now();
  const agent = await getAgent(params.agentId);
  if (!agent) throw new Error('Agent not found');
  if (agent.status === 'archived') throw new Error('Agent is archived');

  // ── Ownership verification ──────────────────────────────
  if (params.callerWallet) {
    const caller = params.callerWallet.toLowerCase();
    const owner  = agent.ownerWallet.toLowerCase();
    if (caller !== owner) {
      void obs.warn('ai', 'Unauthorized agent execution attempt', { agentId: agent.id, caller, owner });
      throw new Error('Unauthorized: you do not own this agent');
    }
  }

  const executionId = `exec_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;

  // ── Global credit check ─────────────────────────────────
  const globalBalance = await getCreditBalance(agent.ownerWallet);
  const estimatedCredits = OPERATION_COSTS.agentExecution;
  if (globalBalance.remaining < estimatedCredits) {
    throw new Error(`Insufficient credits. You have ${globalBalance.remaining} credits, need at least ${estimatedCredits}.`);
  }

  // ── Agent budget check ──────────────────────────────────
  const budgetCheck = await checkAgentBudget(agent, estimatedCredits);
  if (!budgetCheck.ok) throw new Error(budgetCheck.reason);

  const model = agent.model;

  // ── Mark agent as running ───────────────────────────────
  await updateAgent(agent.id, { status: 'running' });

  // ── Build system prompt ─────────────────────────────────
  const systemPrompt = [
    AGENT_SYSTEM_PROMPTS[agent.type],
    `\n\n## Agent Identity\nName: ${agent.name}`,
    agent.description ? `Description: ${agent.description}` : '',
    agent.goals.length > 0 ? `Goals:\n${agent.goals.map((g) => `- ${g}`).join('\n')}` : '',
    agent.instructions ? `\n## Custom Instructions\n${agent.instructions}` : '',
    `\n## Current Task\n${params.task}`,
    `\nProduce a complete, structured response. If generating a report, format it in Markdown.`,
  ].filter(Boolean).join('\n');

  // ── Record execution start ──────────────────────────────
  const executionRecord: AgentExecution = {
    id: executionId,
    agentId: agent.id,
    agentName: agent.name,
    agentType: agent.type,
    ownerWallet: agent.ownerWallet,
    task: params.task,
    input: params.task,
    outputSummary: '',
    status: 'running',
    creditsConsumed: 0,
    model,
    startedAt: new Date().toISOString(),
    completedAt: null,
    durationMs: null,
    relatedTxHashes: [],
  };

  await recordExecution(executionRecord);
  void obs.info('ai', 'Agent execution started', { agentId: agent.id, executionId, model }, agent.ownerWallet);

  try {
    let outputFull = '';

    if (params.onChunk) {
      // Streaming mode
      const result = await routeAIStream(
        {
          messages: [{ role: 'user', content: params.task }],
          model,
          systemPrompt,
        },
        (chunk) => {
          outputFull += chunk;
          params.onChunk!(chunk);
        }
      );
      outputFull = result.content || outputFull;

      // ── Independent Evaluator Layer (Phase 16) ──────────────
      // Streaming has already rendered to the user in real time,
      // so we evaluate post-hoc and record the verdict for the
      // audit trail rather than blindly re-streaming a revision.
      const evaluation = await evaluateAgentOutput(agent.type, params.task, outputFull);
      if (evaluation.verdict === 'FAIL') {
        void obs.warn('ai', 'Evaluator flagged streamed output (post-hoc, not revised)', { executionId, reasons: evaluation.reasons }, agent.ownerWallet);
      }

      const creditsConsumed = Math.max(estimatedCredits, result.creditsUsed);
      const durationMs = Date.now() - start;
      const outputSummary = outputFull.slice(0, 300) + (outputFull.length > 300 ? '…' : '');

      // Save report if output is substantial
      let reportId: string | undefined;
      if (outputFull.length > 200) {
        reportId = await saveReport(agent, executionId, params.task, outputFull);
      }

      await updateExecution(executionId, {
        status: 'completed',
        outputSummary,
        outputFull,
        creditsConsumed,
        completedAt: new Date().toISOString(),
        durationMs,
        reportId,
        evaluationVerdict: evaluation.verdict,
        evaluationReasons: evaluation.reasons,
        evaluationSuggestions: evaluation.suggestions,
        revisionCount: 0,
      });

      await chargeAgentExecution(agent, executionId, creditsConsumed);
      void obs.info('ai', 'Agent execution completed (stream)', { executionId, creditsConsumed, durationMs, evaluationVerdict: evaluation.verdict }, agent.ownerWallet);

      return { executionId, outputSummary, outputFull, creditsConsumed, reportId, durationMs };

    } else {
      // Non-streaming mode
      let result = await routeAIRequest({
        messages: [{ role: 'user', content: params.task }],
        model,
        systemPrompt,
      });

      outputFull = result.content;

      // ── Independent Evaluator Layer (Phase 16) ──────────────
      // Structurally separate pass — reviews adversarially, no
      // access to the generator's system prompt or memory.
      let evaluation = await evaluateAgentOutput(agent.type, params.task, outputFull);
      let revisionCount = 0;

      if (evaluation.verdict === 'FAIL') {
        void obs.warn('ai', 'Evaluator flagged output — attempting one revision', { executionId, reasons: evaluation.reasons }, agent.ownerWallet);

        const revisionPrompt = `${systemPrompt}\n\n## Revision Required\nYour previous output was reviewed and flagged with these issues:\n${evaluation.reasons.map((r) => `- ${r}`).join('\n')}\n${evaluation.suggestions ? `\nSuggestion: ${evaluation.suggestions}` : ''}\n\nProduce a corrected, complete response addressing these issues.`;

        const revised = await routeAIRequest({
          messages: [{ role: 'user', content: params.task }],
          model,
          systemPrompt: revisionPrompt,
        });

        outputFull = revised.content;
        result = { ...result, creditsUsed: result.creditsUsed + revised.creditsUsed };
        revisionCount = 1;

        // Re-evaluate once after revision — result is recorded either way,
        // we do not loop further to bound cost and latency.
        evaluation = await evaluateAgentOutput(agent.type, params.task, outputFull);
      }

      const creditsConsumed = Math.max(estimatedCredits, result.creditsUsed);
      const durationMs = Date.now() - start;
      const outputSummary = outputFull.slice(0, 300) + (outputFull.length > 300 ? '…' : '');

      let reportId: string | undefined;
      if (outputFull.length > 200) {
        reportId = await saveReport(agent, executionId, params.task, outputFull);
      }

      await updateExecution(executionId, {
        status: 'completed',
        outputSummary,
        outputFull,
        creditsConsumed,
        completedAt: new Date().toISOString(),
        durationMs,
        reportId,
        evaluationVerdict: evaluation.verdict,
        evaluationReasons: evaluation.reasons,
        evaluationSuggestions: evaluation.suggestions,
        revisionCount,
      });

      await chargeAgentExecution(agent, executionId, creditsConsumed);
      void obs.info('ai', 'Agent execution completed', { executionId, creditsConsumed, durationMs, evaluationVerdict: evaluation.verdict, revisionCount }, agent.ownerWallet);

      return { executionId, outputSummary, outputFull, creditsConsumed, reportId, durationMs };
    }

  } catch (err) {
    const e = err as Error;
    await updateAgent(agent.id, { status: 'error' });
    await updateExecution(executionId, {
      status: 'failed',
      errorMessage: e.message,
      completedAt: new Date().toISOString(),
      durationMs: Date.now() - start,
    });
    void obs.error('ai', 'Agent execution failed', { executionId, error: e.message }, agent.ownerWallet);
    throw e;
  }
}

async function saveReport(
  agent: Agent,
  executionId: string,
  task: string,
  content: string
): Promise<string> {
  const reportId = `report_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
  const report: AgentReport = {
    id: reportId,
    agentId: agent.id,
    agentName: agent.name,
    ownerWallet: agent.ownerWallet,
    title: task.slice(0, 80),
    type: agent.type,
    content,
    summary: content.slice(0, 250) + (content.length > 250 ? '…' : ''),
    executionId,
    createdAt: new Date().toISOString(),
    tags: agent.tags,
  };
  await saveAgentReport(report);
  return reportId;
}

// ============================================================
// AGENT ACTION APPROVAL GATE — Phase 15 (locked architecture)
// Prepare → Review → Approve → Execute
// No agent runs without explicit human approval.
// ============================================================

export interface ProposeAgentParams {
  agentId: string;
  task: string;
  callerWallet: string; // required — no anonymous proposals
}

export interface AgentProposal {
  proposalId: string;
  agentId: string;
  agentName: string;
  agentType: AgentType;
  task: string;
  estimatedCredits: number;
  currentCreditBalance: number;
  budgetRemaining: number;
  model: string;
  status: 'proposed';
  createdAt: string;
  actionProposal?: PendingFinancialAction;
  requiresWalletAction?: boolean;
}

/**
 * Phase 1: Prepare. Runs all preflight checks (ownership, credits,
 * budget, membership/model) and creates an execution record with
 * status='proposed'. Does NOT call the AI. Returns a proposal
 * summary for human review. The human must call approveProposal()
 * to proceed to execution, or rejectProposal() to discard it.
 */
export async function proposeAgent(params: ProposeAgentParams): Promise<AgentProposal> {
  const { agentId, task, callerWallet } = params;

  const agent = await getAgent(agentId);
  if (!agent) throw new Error('Agent not found');
  if (agent.status === 'archived') throw new Error('Agent is archived');

  const caller = callerWallet.toLowerCase();
  const owner = agent.ownerWallet.toLowerCase();
  if (caller !== owner) {
    void obs.warn('ai', 'Unauthorized proposal attempt', { agentId, caller, owner });
    throw new Error('Unauthorized: you do not own this agent');
  }

  // A `missing`-flagged intent is a clarification in progress, not an
  // actionable proposal — the agent executor has no clarification loop,
  // so treat it the same as no financial intent at all rather than
  // proposing an incomplete action.
  const rawFinancialIntent = parseFinancialIntent(task);
  let financialIntent = rawFinancialIntent && !rawFinancialIntent.missing
    ? rawFinancialIntent
    : null;

  // Resolve ARCTIS Passport recipients before creating the proposal.
  // Direct 0x addresses continue unchanged.
  if (
    financialIntent?.action === 'transfer' &&
    financialIntent.recipient &&
    !/^0x[a-fA-F0-9]{40}$/.test(financialIntent.recipient)
  ) {
    const username = financialIntent.recipient
      .trim()
      .toLowerCase()
      .replace(/^@/, '')
      .replace(/\\.arc$/, '');

    const passport = await getPassportByUsername(username);

    if (!passport) {
      throw new Error(`Passport not found: ${username}`);
    }

    financialIntent = {
      ...financialIntent,
      recipient: passport.walletAddress,
      missing: undefined,
    };
  }
  const estimatedCredits = financialIntent ? 0 : OPERATION_COSTS.agentExecution;

  const globalBalance = await getCreditBalance(owner);
  if (globalBalance.remaining < estimatedCredits) {
    throw new Error(`Insufficient credits. You have ${globalBalance.remaining} credits, need at least ${estimatedCredits}.`);
  }

  const budgetCheck = await checkAgentBudget(agent, estimatedCredits);
  if (!budgetCheck.ok) throw new Error(budgetCheck.reason);

  const model = agent.model;

  const proposalId = `prop_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
  const proposal: AgentExecution = {
    id: proposalId,
    agentId: agent.id,
    agentName: agent.name,
    agentType: agent.type,
    ownerWallet: owner,
    task,
    input: task,
    outputSummary: '',
    creditsConsumed: 0,
    model,
    status: 'proposed',
    startedAt: new Date().toISOString(),
    completedAt: null,
    durationMs: null,
    relatedTxHashes: [],
    ...(financialIntent ? { outputSummary: describeIntent(financialIntent), actionProposal: financialIntent, requiresWalletAction: true } : {}),
  } as AgentExecution & { actionProposal?: PendingFinancialAction; requiresWalletAction?: boolean };

  await recordExecution(proposal);
  void obs.info('ai', 'Agent proposal created — awaiting approval', { proposalId, agentId }, owner);

  return {
    proposalId,
    agentId: agent.id,
    agentName: agent.name,
    agentType: agent.type,
    task,
    estimatedCredits,
    currentCreditBalance: globalBalance.remaining,
    budgetRemaining: agent.monthlyBudgetCredits
      ? agent.monthlyBudgetCredits - (agent.creditsUsedThisMonth ?? 0)
      : Infinity,
    model,
    status: 'proposed',
    createdAt: proposal.startedAt,
    ...(financialIntent ? { actionProposal: financialIntent, requiresWalletAction: true } : {}),
  };
}

/**
 * Phase 3 (approve path): Human reviewed and approved. Re-verifies
 * ownership against the stored proposal (not just the request),
 * then delegates to executeAgent() for the actual run.
 */
export async function approveProposal(
  proposalId: string,
  callerWallet: string
): Promise<ExecuteAgentResult | { executionId: string; outputSummary: string; outputFull: string; creditsConsumed: number; durationMs: number; requiresWalletAction: true; actionProposal: PendingFinancialAction }> {
  const { getAdminDb } = await import('@/lib/firebase/admin');
  const db = getAdminDb();
  const snap = await db.collection('agent_executions').doc(proposalId).get();

  if (!snap.exists) throw new Error('Proposal not found');
  const proposal = snap.data() as AgentExecution;

  if (proposal.status !== 'proposed') {
    throw new Error(`Cannot approve: proposal is already in status '${proposal.status}'`);
  }
  if (proposal.ownerWallet.toLowerCase() !== callerWallet.toLowerCase()) {
    void obs.warn('ai', 'Unauthorized approval attempt', { proposalId, callerWallet });
    throw new Error('Unauthorized: you do not own this proposal');
  }

  const actionProposal = (proposal as AgentExecution & { actionProposal?: PendingFinancialAction }).actionProposal;
  if (actionProposal) {
    await updateExecution(proposalId, {
      status: 'approved',
      outputSummary: `Approved wallet action: ${describeIntent(actionProposal)}`,
      outputFull: 'Human approved this agent-proposed financial action. Final wallet confirmation and execution continue in the existing Transfer/Swap/Bridge module.',
      creditsConsumed: 0,
      completedAt: new Date().toISOString(),
      durationMs: 0,
    });
    return {
      executionId: proposalId,
      outputSummary: `Approved wallet action: ${describeIntent(actionProposal)}`,
      outputFull: 'Continue to the existing financial module to review and confirm in your wallet.',
      creditsConsumed: 0,
      durationMs: 0,
      requiresWalletAction: true,
      actionProposal,
    };
  }

  await updateExecution(proposalId, { status: 'approved' });

  // Hand off to the real executor — it creates its own execution
  // record with a fresh executionId; the proposal record remains
  // as a permanent, immutable audit trail of the approval decision.
  return executeAgent({ agentId: proposal.agentId, task: proposal.task, callerWallet });
}

/**
 * Phase 3 (reject path): Human reviewed and rejected. No AI call,
 * no credit spend. Proposal record is preserved for audit purposes.
 */
export async function rejectProposal(
  proposalId: string,
  callerWallet: string,
  reason?: string
): Promise<void> {
  const { getAdminDb } = await import('@/lib/firebase/admin');
  const db = getAdminDb();
  const snap = await db.collection('agent_executions').doc(proposalId).get();

  if (!snap.exists) throw new Error('Proposal not found');
  const proposal = snap.data() as AgentExecution;

  if (proposal.status !== 'proposed') {
    throw new Error(`Cannot reject: proposal status is '${proposal.status}'`);
  }
  if (proposal.ownerWallet.toLowerCase() !== callerWallet.toLowerCase()) {
    throw new Error('Unauthorized: you do not own this proposal');
  }

  await updateExecution(proposalId, {
    status: 'rejected',
    errorMessage: reason ?? 'Rejected by owner',
    completedAt: new Date().toISOString(),
    durationMs: 0,
  });

  void obs.info('ai', 'Agent proposal rejected', { proposalId, reason }, callerWallet);
}
