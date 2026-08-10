// ============================================================
// Agent Service — Firestore backed (Admin SDK, server-only)
// Handles CRUD, execution, budget management, ledger
// ============================================================
import 'server-only';
import { FieldValue, type Transaction, type QueryDocumentSnapshot } from 'firebase-admin/firestore';
import { getAdminDb } from '@/lib/firebase/admin';
import { deductCredits } from '@/lib/credits/engine';
import { obs } from '@/lib/observability/logger';
import type { Agent, AgentExecution, AgentLedgerEntry, AgentReport, AgentType } from '@/types';

const AGENTS_COL     = 'agents';
const EXECUTIONS_COL = 'agent_executions';
const LEDGER_COL     = 'agent_ledger';
const REPORTS_COL    = 'agent_reports';

// ─── Helper ─────────────────────────────────────────────────
export function stripUndefined<T extends Record<string, unknown>>(value: T): Partial<T> {
  return Object.fromEntries(Object.entries(value).filter(([, v]) => v !== undefined)) as Partial<T>;
}

function toIso(ts: unknown): string {
  if (ts && typeof (ts as { toDate?: () => Date }).toDate === 'function') {
    return (ts as { toDate: () => Date }).toDate().toISOString();
  }
  return new Date().toISOString();
}

// ─── Agent CRUD ─────────────────────────────────────────────
export async function createAgent(
  ownerWallet: string,
  data: Pick<Agent, 'name' | 'type' | 'description' | 'goals' | 'instructions' | 'model' | 'monthlyBudgetCredits' | 'maxCreditsPerExecution' | 'tags'>
): Promise<Agent> {
  const db = getAdminDb();
  const id = `agent_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;

  const now = new Date();
  const resetDate = new Date(now.getFullYear(), now.getMonth() + 1, 1);

  const agent: Agent = {
    id,
    ownerWallet: ownerWallet.toLowerCase(),
    name: data.name,
    type: data.type,
    description: data.description,
    goals: data.goals,
    instructions: data.instructions,
    model: data.model,
    status: 'idle',
    monthlyBudgetCredits: data.monthlyBudgetCredits,
    maxCreditsPerExecution: data.maxCreditsPerExecution,
    creditsUsedThisMonth: 0,
    budgetResetDate: resetDate.toISOString(),
    createdAt: now.toISOString(),
    lastActiveAt: null,
    executionCount: 0,
    totalCreditsConsumed: 0,
    reportIds: [],
    tags: data.tags,
  };

  await db.collection(AGENTS_COL).doc(id).set({
    ...agent,
    createdAt: FieldValue.serverTimestamp(),
  });

  // Ledger: agent created
  await writeAgentLedger(id, ownerWallet, {
    type: 'created',
    creditsAmount: 0,
    balanceBefore: 0,
    balanceAfter: 0,
    description: `Agent "${data.name}" created`,
  });

  void obs.info('ai', 'Agent created', { agentId: id, type: data.type }, ownerWallet);
  return agent;
}

export async function getAgent(agentId: string): Promise<Agent | null> {
  const db = getAdminDb();
  const snap = await db.collection(AGENTS_COL).doc(agentId).get();
  if (!snap.exists) return null;
  const d = snap.data()!;
  return { ...d, id: snap.id, createdAt: toIso(d.createdAt), lastActiveAt: d.lastActiveAt ? toIso(d.lastActiveAt) : null } as Agent;
}

export async function getUserAgents(ownerWallet: string): Promise<Agent[]> {
  const db = getAdminDb();
  const snap = await db.collection(AGENTS_COL)
    .where('ownerWallet', '==', ownerWallet.toLowerCase())
    .where('status', '!=', 'archived')
    .orderBy('status')
    .orderBy('createdAt', 'desc')
    .get();

  return snap.docs.map((d: QueryDocumentSnapshot) => {
    const data = d.data();
    return { ...data, id: d.id, createdAt: toIso(data.createdAt), lastActiveAt: data.lastActiveAt ? toIso(data.lastActiveAt) : null } as Agent;
  });
}

export async function updateAgent(agentId: string, updates: Partial<Pick<Agent, 'name' | 'description' | 'goals' | 'instructions' | 'model' | 'monthlyBudgetCredits' | 'maxCreditsPerExecution' | 'status' | 'tags'>>): Promise<void> {
  const db = getAdminDb();
  await db.collection(AGENTS_COL).doc(agentId).update(stripUndefined({ ...(updates as Record<string, unknown>), updatedAt: FieldValue.serverTimestamp() }));
}

export async function archiveAgent(agentId: string): Promise<void> {
  await updateAgent(agentId, { status: 'archived' });
  void obs.info('ai', 'Agent archived', { agentId });
}

// ─── Budget check ────────────────────────────────────────────
export async function checkAgentBudget(agent: Agent, estimatedCredits: number): Promise<{ ok: boolean; reason?: string }> {
  // Check monthly budget remaining
  const remaining = agent.monthlyBudgetCredits - agent.creditsUsedThisMonth;
  if (estimatedCredits > remaining) {
    return { ok: false, reason: `Monthly budget exceeded. Remaining: ${remaining} credits, needed: ${estimatedCredits}` };
  }
  if (estimatedCredits > agent.maxCreditsPerExecution) {
    return { ok: false, reason: `Exceeds per-execution limit of ${agent.maxCreditsPerExecution} credits` };
  }
  return { ok: true };
}

// ─── Execution ───────────────────────────────────────────────
export async function recordExecution(execution: AgentExecution): Promise<void> {
  const db = getAdminDb();
  await db.collection(EXECUTIONS_COL).doc(execution.id).set({
    ...execution,
    startedAt: FieldValue.serverTimestamp(),
    completedAt: execution.completedAt ? new Date(execution.completedAt) : null,
  });
}

export async function updateExecution(
  executionId: string,
  updates: Partial<Pick<AgentExecution, 'status' | 'outputSummary' | 'outputFull' | 'creditsConsumed' | 'completedAt' | 'durationMs' | 'errorMessage' | 'reportId' | 'evaluationVerdict' | 'evaluationReasons' | 'evaluationSuggestions' | 'revisionCount'>>
): Promise<void> {
  const db = getAdminDb();
  await db.collection(EXECUTIONS_COL).doc(executionId).update(stripUndefined(updates as Record<string, unknown>));
}

export async function getAgentExecutions(agentId: string, limitCount = 20): Promise<AgentExecution[]> {
  const db = getAdminDb();
  const snap = await db.collection(EXECUTIONS_COL)
    .where('agentId', '==', agentId)
    .orderBy('startedAt', 'desc')
    .limit(limitCount)
    .get();
  return snap.docs.map((d: QueryDocumentSnapshot) => ({ ...d.data(), id: d.id, startedAt: toIso(d.data().startedAt) }) as AgentExecution);
}

export async function getOwnerExecutions(ownerWallet: string, limitCount = 50): Promise<AgentExecution[]> {
  const db = getAdminDb();
  const snap = await db.collection(EXECUTIONS_COL)
    .where('ownerWallet', '==', ownerWallet.toLowerCase())
    .orderBy('startedAt', 'desc')
    .limit(limitCount)
    .get();
  return snap.docs.map((d: QueryDocumentSnapshot) => ({ ...d.data(), id: d.id, startedAt: toIso(d.data().startedAt) }) as AgentExecution);
}

// ─── Credit accounting after execution ───────────────────────
export async function chargeAgentExecution(
  agent: Agent,
  executionId: string,
  creditsConsumed: number
): Promise<void> {
  const db = getAdminDb();

  await db.runTransaction(async (tx: Transaction) => {
    const agentRef = db.collection(AGENTS_COL).doc(agent.id);
    const agentSnap = await tx.get(agentRef);
    if (!agentSnap.exists) throw new Error('Agent not found');
    const current = agentSnap.data()!;

    const newUsedThisMonth = (current.creditsUsedThisMonth ?? 0) + creditsConsumed;
    const newTotal         = (current.totalCreditsConsumed ?? 0) + creditsConsumed;
    const newCount         = (current.executionCount ?? 0) + 1;

    tx.update(agentRef, {
      creditsUsedThisMonth: newUsedThisMonth,
      totalCreditsConsumed: newTotal,
      executionCount: newCount,
      lastActiveAt: FieldValue.serverTimestamp(),
      status: 'idle',
    });

    // Agent ledger entry
    const ledgerRef = db.collection(LEDGER_COL).doc();
    tx.set(ledgerRef, {
      agentId: agent.id,
      ownerWallet: agent.ownerWallet,
      type: 'execution',
      creditsAmount: -creditsConsumed,
      balanceBefore: agent.monthlyBudgetCredits - (current.creditsUsedThisMonth ?? 0),
      balanceAfter:  agent.monthlyBudgetCredits - newUsedThisMonth,
      description: `Execution: ${agent.name}`,
      executionId,
      createdAt: FieldValue.serverTimestamp(),
    });
  });

  // Also deduct from the owner's global credit balance
  await deductCredits(
    agent.ownerWallet,
    creditsConsumed,
    `Agent: ${agent.name} execution`,
    agent.model,
    executionId
  );
}

// ─── Reports ─────────────────────────────────────────────────
export async function saveAgentReport(report: AgentReport): Promise<void> {
  const db = getAdminDb();
  await db.collection(REPORTS_COL).doc(report.id).set({
    ...report,
    createdAt: FieldValue.serverTimestamp(),
  });
  // Link report to agent
  const agentRef = db.collection(AGENTS_COL).doc(report.agentId);
  const agentSnap = await agentRef.get();
  if (agentSnap.exists) {
    const existing = agentSnap.data()!.reportIds ?? [];
    await agentRef.update({ reportIds: [...existing, report.id] });
  }
}

export async function getAgentReports(agentId: string): Promise<AgentReport[]> {
  const db = getAdminDb();
  const snap = await db.collection(REPORTS_COL)
    .where('agentId', '==', agentId)
    .orderBy('createdAt', 'desc')
    .get();
  return snap.docs.map((d: QueryDocumentSnapshot) => ({ ...d.data(), id: d.id, createdAt: toIso(d.data().createdAt) }) as AgentReport);
}

export async function getOwnerReports(ownerWallet: string, limitCount = 30): Promise<AgentReport[]> {
  const db = getAdminDb();
  const snap = await db.collection(REPORTS_COL)
    .where('ownerWallet', '==', ownerWallet.toLowerCase())
    .orderBy('createdAt', 'desc')
    .limit(limitCount)
    .get();
  return snap.docs.map((d: QueryDocumentSnapshot) => ({ ...d.data(), id: d.id, createdAt: toIso(d.data().createdAt) }) as AgentReport);
}

// ─── Ledger helper ───────────────────────────────────────────
async function writeAgentLedger(
  agentId: string,
  ownerWallet: string,
  entry: Omit<AgentLedgerEntry, 'id' | 'agentId' | 'ownerWallet' | 'createdAt'>
): Promise<void> {
  const db = getAdminDb();
  await db.collection(LEDGER_COL).doc().set({
    agentId,
    ownerWallet: ownerWallet.toLowerCase(),
    ...entry,
    createdAt: FieldValue.serverTimestamp(),
  });
}

export async function getAgentLedger(agentId: string): Promise<AgentLedgerEntry[]> {
  const db = getAdminDb();
  const snap = await db.collection(LEDGER_COL)
    .where('agentId', '==', agentId)
    .orderBy('createdAt', 'desc')
    .limit(50)
    .get();
  return snap.docs.map((d: QueryDocumentSnapshot) => ({ ...d.data(), id: d.id, createdAt: toIso(d.data().createdAt) }) as AgentLedgerEntry);
}

// ─── Agent limit check (per membership tier) ─────────────────
export async function countUserAgents(ownerWallet: string): Promise<number> {
  const db = getAdminDb();
  const snap = await db.collection(AGENTS_COL)
    .where('ownerWallet', '==', ownerWallet.toLowerCase())
    .where('status', '!=', 'archived')
    .get();
  return snap.size;
}
