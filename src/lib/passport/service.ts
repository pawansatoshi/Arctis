import 'server-only';
import { FieldValue } from 'firebase-admin/firestore';
import { getAdminDb } from '@/lib/firebase/admin';
import type { Passport } from './types';

const COL = 'passports';

function toIso(ts: unknown): string {
  if (!ts) return new Date().toISOString();
  if (typeof ts === 'string') return ts;
  if (ts instanceof Date) return ts.toISOString();
  if (ts && typeof (ts as { toDate?: () => Date }).toDate === 'function') return (ts as { toDate: () => Date }).toDate().toISOString();
  return new Date().toISOString();
}

export async function getPassportByUsername(username: string): Promise<Passport | null> {
  try {
    const db = getAdminDb();
    const snap = await db.collection(COL).doc(username.toLowerCase()).get();
    if (!snap.exists) return null;
    const d = snap.data()!;
    return { ...d, username: username.toLowerCase(), createdAt: toIso(d.createdAt), updatedAt: d.updatedAt ? toIso(d.updatedAt) : undefined } as Passport;
  } catch { return null; }
}

export async function getPassportByWallet(walletAddress: string): Promise<Passport | null> {
  try {
    const db = getAdminDb();
    const snap = await db.collection(COL).where('walletAddress', '==', walletAddress.toLowerCase()).limit(1).get();
    if (snap.empty) return null;
    const d = snap.docs[0];
    const data = d.data();
    return { ...data, username: d.id, createdAt: toIso(data.createdAt), updatedAt: data.updatedAt ? toIso(data.updatedAt) : undefined } as Passport;
  } catch { return null; }
}

export async function isUsernameTaken(username: string): Promise<boolean> {
  return (await getPassportByUsername(username)) !== null;
}

export async function createPassport(username: string, walletAddress: string, displayName?: string): Promise<void> {
  const db = getAdminDb();
  const usernameLower = username.toLowerCase();
  await db.collection(COL).doc(usernameLower).set({
    username: usernameLower,
    walletAddress: walletAddress.toLowerCase(),
    displayName: displayName?.trim() || undefined,
    verified: false,
    createdAt: FieldValue.serverTimestamp(),
  });
}

export async function updatePassportProfile(
  username: string,
  updates: Partial<Pick<Passport, 'displayName' | 'bio' | 'avatarUrl'>>
): Promise<void> {
  const db = getAdminDb();
  await db.collection(COL).doc(username.toLowerCase()).update({ ...updates, updatedAt: FieldValue.serverTimestamp() });
}
