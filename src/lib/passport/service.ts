import { doc, getDoc, setDoc, updateDoc, collection, query, where, getDocs, limit, serverTimestamp, type Timestamp } from 'firebase/firestore';
import { getDb } from '@/lib/firebase/config';
import type { Passport } from './types';

const COL = 'passports';

function toIso(ts: unknown): string {
  if (!ts) return new Date().toISOString();
  if (typeof ts === 'string') return ts;
  if (ts instanceof Date) return ts.toISOString();
  if (ts && typeof (ts as Timestamp).toDate === 'function') return (ts as Timestamp).toDate().toISOString();
  return new Date().toISOString();
}

export async function getPassportByUsername(username: string): Promise<Passport | null> {
  try {
    const db = getDb();
    const snap = await getDoc(doc(db, COL, username.toLowerCase()));
    if (!snap.exists()) return null;
    const d = snap.data();
    return { ...d, username: username.toLowerCase(), createdAt: toIso(d.createdAt), updatedAt: d.updatedAt ? toIso(d.updatedAt) : undefined } as Passport;
  } catch { return null; }
}

export async function getPassportByWallet(walletAddress: string): Promise<Passport | null> {
  try {
    const db = getDb();
    const q = query(collection(db, COL), where('walletAddress', '==', walletAddress.toLowerCase()), limit(1));
    const snap = await getDocs(q);
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
  const db = getDb();
  const usernameLower = username.toLowerCase();
  await setDoc(doc(db, COL, usernameLower), {
    username: usernameLower,
    walletAddress: walletAddress.toLowerCase(),
    displayName: displayName?.trim() || undefined,
    verified: false,
    createdAt: serverTimestamp(),
  });
}

export async function updatePassportProfile(
  username: string,
  updates: Partial<Pick<Passport, 'displayName' | 'bio' | 'avatarUrl'>>
): Promise<void> {
  const db = getDb();
  await updateDoc(doc(db, COL, username.toLowerCase()), { ...updates, updatedAt: serverTimestamp() });
}
