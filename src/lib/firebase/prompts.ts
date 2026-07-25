import {
  collection, doc, setDoc, deleteDoc, query, where,
  orderBy, getDocs, serverTimestamp, type Timestamp,
} from 'firebase/firestore';
import { getDb } from './config';
import type { SavedPrompt } from '@/types';

const COL = 'saved_prompts';

export async function savePrompt(walletAddress: string, prompt: SavedPrompt): Promise<void> {
  const db = getDb();
  await setDoc(doc(db, COL, prompt.id), {
    ...prompt,
    walletAddress: walletAddress.toLowerCase(),
    createdAt: serverTimestamp(),
  });
}

export async function getUserPrompts(walletAddress: string): Promise<SavedPrompt[]> {
  const db = getDb();
  const q = query(
    collection(db, COL),
    where('walletAddress', '==', walletAddress.toLowerCase()),
    orderBy('createdAt', 'desc')
  );
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({
    ...d.data(),
    id: d.id,
    createdAt: (d.data().createdAt as Timestamp)?.toDate().toISOString() ?? new Date().toISOString(),
  })) as SavedPrompt[];
}

export async function deletePrompt(promptId: string): Promise<void> {
  const db = getDb();
  await deleteDoc(doc(db, COL, promptId));
}
