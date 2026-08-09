import { NextRequest, NextResponse } from 'next/server';
import { saveSession, getUserSessions, deleteSession } from '@/lib/firebase/sessions';
import { isValidEthAddress } from '@/lib/auth/middleware';
import { obs } from '@/lib/observability/logger';
import type { AISession } from '@/types';

// ============================================================
// /api/sessions — AI Workspace chat session persistence
// Proxies Firestore access through the server (Admin SDK) so the
// browser never touches Firestore directly.
// ============================================================

export async function POST(req: NextRequest) {
  try {
    const { session } = await req.json() as { session: AISession };

    if (!session?.id || !session.walletAddress) {
      return NextResponse.json({ error: 'session.id and session.walletAddress required' }, { status: 400 });
    }

    await saveSession(session);
    return NextResponse.json({ success: true });
  } catch (err) {
    const e = err as Error;
    void obs.error('sessions', 'Save session failed', { error: e.message });
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

export async function GET(req: NextRequest) {
  try {
    const wallet = req.nextUrl.searchParams.get('wallet');
    if (!wallet || !isValidEthAddress(wallet)) {
      return NextResponse.json({ error: 'valid wallet query param required' }, { status: 400 });
    }

    const sessions = await getUserSessions(wallet);
    return NextResponse.json({ sessions });
  } catch (err) {
    const e = err as Error;
    void obs.error('sessions', 'Get sessions failed', { error: e.message });
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const sessionId = req.nextUrl.searchParams.get('id');
    if (!sessionId) {
      return NextResponse.json({ error: 'id query param required' }, { status: 400 });
    }

    await deleteSession(sessionId);
    return NextResponse.json({ success: true });
  } catch (err) {
    const e = err as Error;
    void obs.error('sessions', 'Delete session failed', { error: e.message });
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
