import { collection, addDoc, query, orderBy, limit, getDocs, where, serverTimestamp, type Timestamp, type QueryConstraint } from 'firebase/firestore';
import { getDb } from '@/lib/firebase/config';
import type { ObsLog } from '@/types';

const LOGS_COL = 'obs_logs';

// ============================================================
// Observability Logger
// ============================================================

type LogLevel = 'info' | 'warn' | 'error' | 'debug';
type LogCategory = 'ai' | 'wallet' | 'credits' | 'treasury' | 'swap' | 'bridge' | 'auth' | 'perf';

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

  // Persist to Firebase (non-blocking)
  try {
    const db = getDb();
    await addDoc(collection(db, LOGS_COL), {
      level,
      category,
      message,
      data: data ?? null,
      walletAddress: walletAddress?.toLowerCase() ?? null,
      createdAt: serverTimestamp(),
    });
  } catch { /* non-critical */ }
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
  const db = getDb();
  const constraints: QueryConstraint[] = [orderBy('createdAt', 'desc'), limit(limitCount)];
  if (category) constraints.unshift(where('category', '==', category));

  const q = query(collection(db, LOGS_COL), ...constraints);
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({
    id: d.id,
    ...d.data(),
    createdAt: (d.data().createdAt as Timestamp)?.toDate().toISOString() ?? new Date().toISOString(),
  })) as ObsLog[];
}
