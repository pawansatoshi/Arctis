import 'server-only';
import { FieldValue } from 'firebase-admin/firestore';
import { getAdminDb } from '@/lib/firebase/admin';
import type { AISession } from '@/types';

const COL = 'ai_sessions';

export async function saveSession(session: AISession): Promise<void> {
  const db = getAdminDb();
  await db.collection(COL).doc(session.id).set({
    ...session,
    messages: session.messages.map((m) => ({
      ...m,
      // Ensure no undefined fields stored
      model: m.model ?? null,
      creditsUsed: m.creditsUsed ?? 0,
      attachments: m.attachments ?? null,
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
