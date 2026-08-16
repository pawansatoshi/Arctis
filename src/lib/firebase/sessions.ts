import 'server-only';
import { FieldValue } from 'firebase-admin/firestore';
import { getAdminDb } from '@/lib/firebase/admin';
import type { AISession } from '@/types';

const COL = 'ai_sessions';

type FirestoreValue = string | number | boolean | null | FirestoreValue[] | { [key: string]: FirestoreValue };

function toFirestoreValue(value: unknown): FirestoreValue | undefined {
  if (value === undefined || typeof value === 'function' || typeof value === 'symbol') return undefined;
  if (value === null || typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') return value;
  if (value instanceof Date) return value.toISOString();
  if (Array.isArray(value)) return value.map(toFirestoreValue).filter((v): v is FirestoreValue => v !== undefined);
  if (typeof value === 'object') {
    const out: Record<string, FirestoreValue> = {};
    for (const [key, child] of Object.entries(value as Record<string, unknown>)) {
      const normalized = toFirestoreValue(child);
      if (normalized !== undefined) out[key] = normalized;
    }
    return out;
  }
  return undefined;
}

export async function saveSession(session: AISession): Promise<void> {
  const db = getAdminDb();
  const normalized = toFirestoreValue(session) as Record<string, FirestoreValue>;
  await db.collection(COL).doc(session.id).set({
    ...normalized,
    messages: session.messages.map((m) => ({
      id: m.id,
      role: m.role,
      content: m.content,
      timestamp: m.timestamp,
      ...(m.model !== undefined ? { model: m.model } : {}),
      creditsUsed: m.creditsUsed ?? 0,
      ...(m.tokens ? { tokens: toFirestoreValue(m.tokens) } : {}),
      ...(m.attachments ? { attachments: toFirestoreValue(m.attachments) } : {}),
      ...(m.actionProposal ? { actionProposal: toFirestoreValue(m.actionProposal) } : {}),
      ...(m.clarification ? { clarification: toFirestoreValue(m.clarification) } : {}),
    })),
    updatedAt: FieldValue.serverTimestamp(),
  }, { merge: true });
}

export async function getUserSessions(
  walletAddress: string,
  limitCount = 30
): Promise<AISession[]> {
  const db = getAdminDb();
  const snap = await db.collection(COL)
    .where('walletAddress', '==', walletAddress.toLowerCase())
    .orderBy('updatedAt', 'desc')
    .limit(limitCount)
    .get();

  return snap.docs.map((d) => {
    const data = d.data();
    return {
      ...data,
      id: d.id,
      updatedAt: data.updatedAt?.toDate?.().toISOString() ?? new Date().toISOString(),
      createdAt: data.createdAt ?? new Date().toISOString(),
    } as AISession;
  });
}

export async function deleteSession(sessionId: string): Promise<void> {
  const db = getAdminDb();
  await db.collection(COL).doc(sessionId).delete();
}
