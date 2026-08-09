import { NextRequest, NextResponse } from 'next/server';
import { savePrompt, getUserPrompts, deletePrompt } from '@/lib/firebase/prompts';
import { isValidEthAddress } from '@/lib/auth/middleware';
import { obs } from '@/lib/observability/logger';
import type { SavedPrompt } from '@/types';

// ============================================================
// /api/prompts — Workspace saved-prompt persistence
// Proxies Firestore access through the server (Admin SDK) so the
// browser never touches Firestore directly.
// ============================================================

export async function POST(req: NextRequest) {
  try {
    const { walletAddress, prompt } = await req.json() as {
      walletAddress: string; prompt: SavedPrompt;
    };

    if (!walletAddress || !isValidEthAddress(walletAddress) || !prompt?.id) {
      return NextResponse.json({ error: 'valid walletAddress and prompt.id required' }, { status: 400 });
    }

    await savePrompt(walletAddress, prompt);
    return NextResponse.json({ success: true });
  } catch (err) {
    const e = err as Error;
    void obs.error('prompts', 'Save prompt failed', { error: e.message });
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

export async function GET(req: NextRequest) {
  try {
    const wallet = req.nextUrl.searchParams.get('wallet');
    if (!wallet || !isValidEthAddress(wallet)) {
      return NextResponse.json({ error: 'valid wallet query param required' }, { status: 400 });
    }

    const prompts = await getUserPrompts(wallet);
    return NextResponse.json({ prompts });
  } catch (err) {
    const e = err as Error;
    void obs.error('prompts', 'Get prompts failed', { error: e.message });
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const promptId = req.nextUrl.searchParams.get('id');
    if (!promptId) {
      return NextResponse.json({ error: 'id query param required' }, { status: 400 });
    }

    await deletePrompt(promptId);
    return NextResponse.json({ success: true });
  } catch (err) {
    const e = err as Error;
    void obs.error('prompts', 'Delete prompt failed', { error: e.message });
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
