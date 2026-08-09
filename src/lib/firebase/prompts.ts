import 'server-only';
import { FieldValue } from 'firebase-admin/firestore';
import { getAdminDb } from '@/lib/firebase/admin';
import type { SavedPrompt } from '@/types';

const COL = 'saved_prompts';

export async function savePrompt(walletAddress: string, prompt: SavedPrompt): Promise<void> {
  const db = getAdminDb();
  await db.collection(COL).doc(prompt.id).set({
    ...prompt,
    walletAddress: walletAddress.toLowerCase(),
    createdAt: FieldValue.serverTimestamp(),
  });
}

export async function getUserPrompts(walletAddress: string): Promise<SavedPrompt[]> {
  const db = getAdminDb();
  const snap = await db.collection(COL)
    .where('walletAddress', '==', walletAddress.toLowerCase())
    .orderBy('createdAt', 'desc')
    .get();

  return snap.docs.map((d) => {
    const data = d.data();
    return {
      ...data,
      id: d.id,
      createdAt: data.createdAt?.toDate?.().toISOString() ?? new Date().toISOString(),
    };
  }) as SavedPrompt[];
}

export async function deletePrompt(promptId: string): Promise<void> {
  const db = getAdminDb();
  await db.collection(COL).doc(promptId).delete();
}
