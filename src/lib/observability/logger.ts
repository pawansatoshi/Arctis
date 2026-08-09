import 'server-only';
import { FieldValue } from 'firebase-admin/firestore';
import { getAdminDb } from '@/lib/firebase/admin';
import type { ObsLog } from '@/types';

const LOGS_COL = 'obs_logs';

// ============================================================
// Observability Logger
// ============================================================

type LogLevel = 'info' | 'warn' | 'error' | 'debug';
type LogCategory = 'ai' | 'wallet' | 'credits' | 'treasury' | 'swap' | 'bridge' | 'auth' | 'perf' | 'sessions' | 'prompts';

async function writeLog(
  level: LogLevel,
  category: LogCategory,
  message: string,
  data?: Record<string, unknown>,
  walletAddress?: string
): Promise<void> {
  // Always log to console
  const fn = level === 'error' ? console.error : level === 'warn' ? console.warn : console.log;
  fn(`[ARCTIS:${category.toUpperCase()}] ${message}`, data ?? '');

  // Persist to Firestore (non-blocking)
  try {
    const db = getAdminDb();
    await db.collection(LOGS_COL).add({
      level,
      category,
      message,
      data: data ?? null,
      walletAddress: walletAddress?.toLowerCase() ?? null,
      createdAt: FieldValue.serverTimestamp(),
    });
  } catch (err) {
    console.error('[obs] failed to persist log:', (err as Error).message);
  }
}

export const obs = {
  info:  (cat: LogCategory, msg: string, data?: Record<string, unknown>, addr?: string) => writeLog('info', cat, msg, data, addr),
  warn:  (cat: LogCategory, msg: string, data?: Record<string, unknown>, addr?: string) => writeLog('warn', cat, msg, data, addr),
  error: (cat: LogCategory, msg: string, data?: Record<string, unknown>, addr?: string) => writeLog('error', cat, msg, data, addr),
  debug: (cat: LogCategory, msg: string, data?: Record<string, unknown>, addr?: string) => writeLog('debug', cat, msg, data, addr),
};

export async function getRecentLogs(
  category?: LogCategory,
  limitCount = 100
): Promise<ObsLog[]> {
  const db = getAdminDb();
  let q = db.collection(LOGS_COL).orderBy('createdAt', 'desc').limit(limitCount) as FirebaseFirestore.Query;
  if (category) q = db.collection(LOGS_COL).where('category', '==', category).orderBy('createdAt', 'desc').limit(limitCount);

  const snap = await q.get();
  return snap.docs.map((d) => {
    const data = d.data();
    return {
      id: d.id,
      ...data,
      createdAt: data.createdAt?.toDate?.().toISOString() ?? new Date().toISOString(),
    };
  }) as ObsLog[];
}
