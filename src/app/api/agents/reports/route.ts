import { NextRequest, NextResponse } from 'next/server';
import { getOwnerReports, getAgentReports } from '@/lib/agents/service';

// GET /api/agents/reports?wallet=0x... OR ?agentId=...
export async function GET(req: NextRequest) {
  const wallet  = req.nextUrl.searchParams.get('wallet');
  const agentId = req.nextUrl.searchParams.get('agentId');

  if (agentId) {
    const reports = await getAgentReports(agentId);
    return NextResponse.json({ reports });
  }
  if (wallet) {
    const reports = await getOwnerReports(wallet);
    return NextResponse.json({ reports });
  }
  return NextResponse.json({ error: 'wallet or agentId required' }, { status: 400 });
}
