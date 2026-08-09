// ============================================================
// Client-safe session persistence — calls /api/sessions instead of
// touching Firestore directly from the browser. Drop-in replacement
// for the old '@/lib/firebase/sessions' client-side imports.
// ============================================================
import type { AISession } from '@/types';

export async function saveSession(session: AISession): Promise<void> {
  await fetch('/api/sessions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ session }),
  });
}

export async function getUserSessions(
  walletAddress: string,
  limitCount = 30
): Promise<AISession[]> {
  const res = await fetch(`/api/sessions?wallet=${walletAddress}`);
  if (!res.ok) return [];
  const data = await res.json();
  return ((data.sessions ?? []) as AISession[]).slice(0, limitCount);
}

export async function deleteSession(sessionId: string): Promise<void> {
  await fetch(`/api/sessions?id=${sessionId}`, { method: 'DELETE' });
}
