// ============================================================
// ARCTIS — Firebase Admin SDK (SERVER-ONLY)
// ============================================================
// This file must NEVER be imported from a client component ('use client').
// It uses a service account to bypass Firestore security rules entirely.
// Trust boundary: wallet ownership is verified upstream via
// `verifyApiWallet` (src/lib/auth/middleware.ts) before any of these
// functions are called — that verification is what replaces Firestore
// rules-based auth for server-side operations.
// ============================================================
import 'server-only';
import { initializeApp, getApps, cert, type App } from 'firebase-admin/app';
import { getFirestore, type Firestore } from 'firebase-admin/firestore';

let app: App | undefined;
let db: Firestore | undefined;

export function normalizePrivateKey(rawKey: string): string {
  let key = rawKey.trim();

  // Support common secure deployment formats: quoted .env values, literal\n
  // sequences, JSON-escaped newlines, and base64-encoded PEM content.
  if ((key.startsWith('\"') && key.endsWith('\"')) || (key.startsWith("'") && key.endsWith("'"))) {
    key = key.slice(1, -1);
  }

  key = key.replace(/\\r\\n/g, '\n').replace(/\\n/g, '\n').replace(/\r\n/g, '\n');

  if (!key.includes('BEGIN PRIVATE KEY')) {
    try {
      const decoded = Buffer.from(key, 'base64').toString('utf8').trim();
      if (decoded.includes('BEGIN PRIVATE KEY')) key = decoded.replace(/\r\n/g, '\n');
    } catch {
      // Keep original value; cert() will reject invalid material below.
    }
  }

  if (!key.includes('-----BEGIN PRIVATE KEY-----') || !key.includes('-----END PRIVATE KEY-----')) {
    throw new Error('Firebase Admin SDK private key is not a valid PEM. Check FIREBASE_PRIVATE_KEY formatting.');
  }

  return key;
}

function getAdminApp(): App {
  if (app) return app;

  if (getApps().length > 0) {
    app = getApps()[0]!;
    return app;
  }

  const projectId = process.env.FIREBASE_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  const rawKey = process.env.FIREBASE_PRIVATE_KEY;

  if (!projectId || !clientEmail || !rawKey) {
    throw new Error(
      'Firebase Admin SDK not configured — missing FIREBASE_PROJECT_ID, ' +
      'FIREBASE_CLIENT_EMAIL, or FIREBASE_PRIVATE_KEY in environment.'
    );
  }

  const privateKey = normalizePrivateKey(rawKey);

  app = initializeApp({
    credential: cert({ projectId, clientEmail, privateKey }),
  });

  return app;
}

export function getAdminDb(): Firestore {
  if (!db) {
    db = getFirestore(getAdminApp());
  }
  return db;
}
