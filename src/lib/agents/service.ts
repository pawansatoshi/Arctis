// ============================================================
// Agent Service — Firestore backed
// Handles CRUD, execution, budget management, ledger
// ============================================================
import {
  collection, doc, setDoc, getDoc, getDocs, updateDoc,
  query, where, orderBy, limit, runTransaction,
  serverTimestamp, deleteDoc,
  type Timestamp, type QueryDocumentSnapshot, type Transaction,
} from 'firebase/firestore';
import { getDb } from '@/lib/firebase/config';
import { deductCredits } from '@/lib/credits/engine';
import { obs } from '@/lib/observability/logger';
import type { Agent, AgentExecution, AgentLedgerEntry, AgentReport, AgentType } from '@/types';

const AGENTS_COL     = 'agents';
const EXECUTIONS_COL = 'agent_executions';
const LEDGER_COL     = 'agent_ledger';
const REPORTS_COL    = 'agent_reports';

// ─── Helper ─────────────────────────────────────────────────
function toIso(ts: unknown): string {
  if (ts && typeof (ts as Timestamp).toDate === 'function') {
    return (ts as Timestamp).toDate().toISOString();
  }
  return new Date().toISOString();
}

// ─── Agent CRUD ─────────────────────────────────────────────
export async function createAgent(
  ownerWallet: string,
  data: Pick<Agent, 'name' | 'type' | 'description' | 'goals' | 'instructions' | 'model' | 'monthlyBudgetCredits' | 'maxCreditsPerExecution' | 'tags'>
): Promise<Agent> {
  const db = getDb();
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

  await setDoc(doc(db, AGENTS_COL, id), {
    ...agent,
    createdAt: serverTimestamp(),
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
  const db = getDb();
  const snap = await getDoc(doc(db, AGENTS_COL, agentId));
  if (!snap.exists()) return null;
  const d = snap.data();
  return { ...d, id: snap.id, createdAt: toIso(d.createdAt), lastActiveAt: d.lastActiveAt ? toIso(d.lastActiveAt) : null } as Agent;
}

export async function getUserAgents(ownerWallet: string): Promise<Agent[]> {
  const db = getDb();
  const q = query(
    collection(db, AGENTS_COL),
    where('ownerWallet', '==', ownerWallet.toLowerCase()),
    where('status', '!=', 'archived'),
    orderBy('status'),
    orderBy('createdAt', 'desc')
  );
  const snap = await getDocs(q);
  return snap.docs.map((d: QueryDocumentSnapshot) => {
    const data = d.data();
    return { ...data, id: d.id, createdAt: toIso(data.createdAt), lastActiveAt: data.lastActiveAt ? toIso(data.lastActiveAt) : null } as Agent;
  });
}

export async function updateAgent(agentId: string, updates: Partial<Pick<Agent, 'name' | 'description' | 'goals' | 'instructions' | 'model' | 'monthlyBudgetCredits' | 'maxCreditsPerExecution' | 'status' | 'tags'>>): Promise<void> {
  const db = getDb();
  await updateDoc(doc(db, AGENTS_COL, agentId), { ...updates, updatedAt: serverTimestamp() });
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
  const db = getDb();
  await setDoc(doc(db, EXECUTIONS_COL, execution.id), {
    ...execution,
    startedAt: serverTimestamp(),
    completedAt: execution.completedAt ? new Date(execution.completedAt) : null,
  });
}

export async function updateExecution(
  executionId: string,
  updates: Partial<Pick<AgentExecution, 'status' | 'outputSummary' | 'outputFull' | 'creditsConsumed' | 'completedAt' | 'durationMs' | 'errorMessage' | 'reportId' | 'evaluationVerdict' | 'evaluationReasons' | 'evaluationSuggestions' | 'revisionCount'>>
): Promise<void> {
  const db = getDb();
  await updateDoc(doc(db, EXECUTIONS_COL, executionId), updates);
}

export async function getAgentExecutions(agentId: string, limitCount = 20): Promise<AgentExecution[]> {
  const db = getDb();
  const q = query(
    collection(db, EXECUTIONS_COL),
    where('agentId', '==', agentId),
    orderBy('startedAt', 'desc'),
    limit(limitCount)
  );
  const snap = await getDocs(q);
  return snap.docs.map((d: QueryDocumentSnapshot) => ({ ...d.data(), id: d.id, startedAt: toIso(d.data().startedAt) }) as AgentExecution);
}

export async function getOwnerExecutions(ownerWallet: string, limitCount = 50): Promise<AgentExecution[]> {
  const db = getDb();
  const q = query(
    collection(db, EXECUTIONS_COL),
    where('ownerWallet', '==', ownerWallet.toLowerCase()),
    orderBy('startedAt', 'desc'),
    limit(limitCount)
  );
  const snap = await getDocs(q);
  return snap.docs.map((d: QueryDocumentSnapshot) => ({ ...d.data(), id: d.id, startedAt: toIso(d.data().startedAt) }) as AgentExecution);
}

// ─── Credit accounting after execution ───────────────────────
export async function chargeAgentExecution(
  agent: Agent,
  executionId: string,
  creditsConsumed: number
): Promise<void> {
  const db = getDb();

  await runTransaction(db, async (tx: Transaction) => {
    const agentRef = doc(db, AGENTS_COL, agent.id);
    const agentSnap = await tx.get(agentRef);
    if (!agentSnap.exists()) throw new Error('Agent not found');
    const current = agentSnap.data();

    const newUsedThisMonth = (current.creditsUsedThisMonth ?? 0) + creditsConsumed;
    const newTotal         = (current.totalCreditsConsumed ?? 0) + creditsConsumed;
    const newCount         = (current.executionCount ?? 0) + 1;

    tx.update(agentRef, {
      creditsUsedThisMonth: newUsedThisMonth,
      totalCreditsConsumed: newTotal,
      executionCount: newCount,
      lastActiveAt: serverTimestamp(),
      status: 'idle',
    });

    // Agent ledger entry
    const ledgerRef = doc(collection(db, LEDGER_COL));
    tx.set(ledgerRef, {
      agentId: agent.id,
      ownerWallet: agent.ownerWallet,
      type: 'execution',
      creditsAmount: -creditsConsumed,
      balanceBefore: agent.monthlyBudgetCredits - (current.creditsUsedThisMonth ?? 0),
      balanceAfter:  agent.monthlyBudgetCredits - newUsedThisMonth,
      description: `Execution: ${agent.name}`,
      executionId,
      createdAt: serverTimestamp(),
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
  const db = getDb();
  await setDoc(doc(db, REPORTS_COL, report.id), {
    ...report,
    createdAt: serverTimestamp(),
  });
  // Link report to agent
  const agentRef = doc(db, AGENTS_COL, report.agentId);
  const agentSnap = await getDoc(agentRef);
  if (agentSnap.exists()) {
    const existing = agentSnap.data().reportIds ?? [];
    await updateDoc(agentRef, { reportIds: [...existing, report.id] });
  }
}

export async function getAgentReports(agentId: string): Promise<AgentReport[]> {
  const db = getDb();
  const q = query(
    collection(db, REPORTS_COL),
    where('agentId', '==', agentId),
    orderBy('createdAt', 'desc')
  );
  const snap = await getDocs(q);
  return snap.docs.map((d: QueryDocumentSnapshot) => ({ ...d.data(), id: d.id, createdAt: toIso(d.data().createdAt) }) as AgentReport);
}

export async function getOwnerReports(ownerWallet: string, limitCount = 30): Promise<AgentReport[]> {
  const db = getDb();
  const q = query(
    collection(db, REPORTS_COL),
    where('ownerWallet', '==', ownerWallet.toLowerCase()),
    orderBy('createdAt', 'desc'),
    limit(limitCount)
  );
  const snap = await getDocs(q);
  return snap.docs.map((d: QueryDocumentSnapshot) => ({ ...d.data(), id: d.id, createdAt: toIso(d.data().createdAt) }) as AgentReport);
}

// ─── Ledger helper ───────────────────────────────────────────
async function writeAgentLedger(
  agentId: string,
  ownerWallet: string,
  entry: Omit<AgentLedgerEntry, 'id' | 'agentId' | 'ownerWallet' | 'createdAt'>
): Promise<void> {
  const db = getDb();
  await setDoc(doc(collection(db, LEDGER_COL)), {
    agentId,
    ownerWallet: ownerWallet.toLowerCase(),
    ...entry,
    createdAt: serverTimestamp(),
  });
}

export async function getAgentLedger(agentId: string): Promise<AgentLedgerEntry[]> {
  const db = getDb();
  const q = query(
    collection(db, LEDGER_COL),
    where('agentId', '==', agentId),
    orderBy('createdAt', 'desc'),
    limit(50)
  );
  const snap = await getDocs(q);
  return snap.docs.map((d: QueryDocumentSnapshot) => ({ ...d.data(), id: d.id, createdAt: toIso(d.data().createdAt) }) as AgentLedgerEntry);
}

// ─── Agent limit check (per membership tier) ─────────────────
export async function countUserAgents(ownerWallet: string): Promise<number> {
  const db = getDb();
  const q = query(
    collection(db, AGENTS_COL),
    where('ownerWallet', '==', ownerWallet.toLowerCase()),
    where('status', '!=', 'archived')
  );
  const snap = await getDocs(q);
  return snap.size;
}
