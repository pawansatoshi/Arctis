// ============================================================
// Client-safe saved-prompt persistence — calls /api/prompts instead
// of touching Firestore directly from the browser. Drop-in
// replacement for the old '@/lib/firebase/prompts' client imports.
// ============================================================
import type { SavedPrompt } from '@/types';

export async function savePrompt(walletAddress: string, prompt: SavedPrompt): Promise<void> {
  await fetch('/api/prompts', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ walletAddress, prompt }),
  });
}

export async function getUserPrompts(walletAddress: string): Promise<SavedPrompt[]> {
  const res = await fetch(`/api/prompts?wallet=${walletAddress}`);
  if (!res.ok) return [];
  const data = await res.json();
  return (data.prompts ?? []) as SavedPrompt[];
}

export async function deletePrompt(promptId: string): Promise<void> {
  await fetch(`/api/prompts?id=${promptId}`, { method: 'DELETE' });
}
