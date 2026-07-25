import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/firebase/config';
import { collection, query, where, orderBy, limit, getDocs, type QueryDocumentSnapshot } from 'firebase/firestore';
import type { AgentExecution } from '@/types';

export async function GET(req: NextRequest) {
  const wallet = req.nextUrl.searchParams.get('wallet');
  if (!wallet) return NextResponse.json({ error: 'wallet required' }, { status: 400 });

  try {
    const db = getDb();
    const q = query(
      collection(db, 'agent_executions'),
      where('ownerWallet', '==', wallet.toLowerCase()),
      where('status', '==', 'proposed'),
      orderBy('startedAt', 'desc'),
      limit(20)
    );
    const snap = await getDocs(q);
    const proposals = snap.docs.map((d: QueryDocumentSnapshot) => d.data() as AgentExecution);
    return NextResponse.json({ proposals });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}
