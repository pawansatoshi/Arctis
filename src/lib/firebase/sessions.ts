import {
  collection, doc, setDoc, getDoc, query, where,
  orderBy, limit, getDocs, serverTimestamp, type Timestamp,
} from 'firebase/firestore';
import { getDb } from './config';
import type { AISession } from '@/types';

const COL = 'ai_sessions';

export async function saveSession(session: AISession): Promise<void> {
  const db = getDb();
  await setDoc(doc(db, COL, session.id), {
    ...session,
    messages: session.messages.map((m) => ({
      ...m,
      // Ensure no undefined fields stored
      model: m.model ?? null,
      creditsUsed: m.creditsUsed ?? 0,
      attachments: m.attachments ?? null,
    })),
    updatedAt: serverTimestamp(),
  }, { merge: true });
}

export async function getUserSessions(
  walletAddress: string,
  limitCount = 30
): Promise<AISession[]> {
  const db = getDb();
  const q = query(
    collection(db, COL),
    where('walletAddress', '==', walletAddress.toLowerCase()),
    orderBy('updatedAt', 'desc'),
    limit(limitCount)
  );
  const snap = await getDocs(q);
  return snap.docs.map((d) => {
    const data = d.data();
    return {
      ...data,
      id: d.id,
      updatedAt: (data.updatedAt as Timestamp)?.toDate().toISOString() ?? new Date().toISOString(),
      createdAt: data.createdAt ?? new Date().toISOString(),
    } as AISession;
  });
}

export async function deleteSession(sessionId: string): Promise<void> {
  const { deleteDoc } = await import('firebase/firestore');
  const db = getDb();
  await deleteDoc(doc(db, COL, sessionId));
}
