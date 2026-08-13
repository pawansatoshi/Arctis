import 'server-only';
import { FieldValue } from 'firebase-admin/firestore';
import { getAdminDb } from '@/lib/firebase/admin';
import type { Passport } from './types';

const COL = 'passports';
const WALLET_INDEX_COL = 'passport_wallets';

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

export async function createPassport(username: string, walletAddress: string, displayName?: string, avatarUrl?: string): Promise<void> {
  const db = getAdminDb();
  const usernameLower = username.toLowerCase();
  const walletLower = walletAddress.toLowerCase();
  const passportRef = db.collection(COL).doc(usernameLower);
  const walletRef = db.collection(WALLET_INDEX_COL).doc(walletLower);

  await db.runTransaction(async (tx) => {
    const [passportSnap, walletSnap] = await Promise.all([tx.get(passportRef), tx.get(walletRef)]);

    if (passportSnap.exists) throw new Error('Username already taken');
    if (walletSnap.exists) {
      const existingUsername = walletSnap.data()?.username;
      throw new Error(existingUsername ? `This wallet already has a Passport: ${existingUsername}` : 'This wallet already has a Passport');
    }

    tx.create(passportRef, {
      username: usernameLower,
      walletAddress: walletLower,
      displayName: displayName?.trim() || null,
      avatarUrl: avatarUrl?.trim() || null,
      verified: false,
      createdAt: FieldValue.serverTimestamp(),
    });
    tx.create(walletRef, {
      username: usernameLower,
      walletAddress: walletLower,
      createdAt: FieldValue.serverTimestamp(),
    });
  });
}

export async function updatePassportProfile(
  username: string,
  updates: Partial<Pick<Passport, 'displayName' | 'bio' | 'avatarUrl'>>
): Promise<void> {
  const db = getAdminDb();
  await db.collection(COL).doc(username.toLowerCase()).update({ ...updates, updatedAt: FieldValue.serverTimestamp() });
}
