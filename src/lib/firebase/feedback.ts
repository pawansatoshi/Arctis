import 'server-only';
import { FieldValue } from 'firebase-admin/firestore';
import { getAdminDb } from '@/lib/firebase/admin';
import type { FeedbackEntry } from '@/types';

const COL = 'feedback';

export async function saveFeedback(entry: Omit<FeedbackEntry, 'id' | 'timestamp' | 'status'>): Promise<string> {
  const db = getAdminDb();
  const id = `fb_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
  await db.collection(COL).doc(id).set({
    ...entry,
    status: 'new',
    email: entry.email || null,
    walletAddress: entry.walletAddress?.toLowerCase() || null,
    timestamp: FieldValue.serverTimestamp(),
  });
  return id;
}

export async function getAllFeedback(limitCount = 100): Promise<FeedbackEntry[]> {
  const db = getAdminDb();
  const snap = await db.collection(COL).orderBy('timestamp', 'desc').limit(limitCount).get();
  return snap.docs.map((d) => {
    const data = d.data();
    return {
      id: d.id,
      ...data,
      timestamp: data.timestamp?.toDate?.().toISOString() ?? new Date().toISOString(),
    };
  }) as FeedbackEntry[];
}
