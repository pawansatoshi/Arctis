import {
  collection, doc, setDoc, getDocs, query,
  orderBy, limit, serverTimestamp, type Timestamp,
} from 'firebase/firestore';
import { getDb } from './config';
import type { FeedbackEntry } from '@/types';

const COL = 'feedback';

export async function saveFeedback(entry: Omit<FeedbackEntry, 'id' | 'timestamp' | 'status'>): Promise<string> {
  const db = getDb();
  const id = `fb_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
  await setDoc(doc(db, COL, id), {
    ...entry,
    status: 'new',
    email: entry.email || null,
    walletAddress: entry.walletAddress?.toLowerCase() || null,
    timestamp: serverTimestamp(),
  });
  return id;
}

export async function getAllFeedback(limitCount = 100): Promise<FeedbackEntry[]> {
  const db = getDb();
  const q = query(collection(db, COL), orderBy('timestamp', 'desc'), limit(limitCount));
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({
    id: d.id,
    ...d.data(),
    timestamp: (d.data().timestamp as Timestamp)?.toDate().toISOString() ?? new Date().toISOString(),
  })) as FeedbackEntry[];
}
