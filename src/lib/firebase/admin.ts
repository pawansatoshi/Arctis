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

  // .env files store the PEM key with literal "\n" sequences; convert
  // them back into real newlines or the key will fail to parse.
  const privateKey = rawKey.replace(/\\n/g, '\n');

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
