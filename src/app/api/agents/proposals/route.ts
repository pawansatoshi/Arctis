import { NextRequest, NextResponse } from 'next/server';
import { getAdminDb } from '@/lib/firebase/admin';
import type { QueryDocumentSnapshot } from 'firebase-admin/firestore';
import type { AgentExecution } from '@/types';

export async function GET(req: NextRequest) {
  const wallet = req.nextUrl.searchParams.get('wallet');
  if (!wallet) return NextResponse.json({ error: 'wallet required' }, { status: 400 });

  try {
    const db = getAdminDb();
    const snap = await db.collection('agent_executions')
      .where('ownerWallet', '==', wallet.toLowerCase())
      .where('status', '==', 'proposed')
      .orderBy('startedAt', 'desc')
      .limit(20)
      .get();
    const proposals = snap.docs.map((d: QueryDocumentSnapshot) => d.data() as AgentExecution);
    return NextResponse.json({ proposals });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}
