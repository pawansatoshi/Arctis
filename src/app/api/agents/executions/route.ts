import { NextRequest, NextResponse } from 'next/server';
import { getAgentExecutions } from '@/lib/agents/service';

export async function GET(req: NextRequest) {
  const agentId = req.nextUrl.searchParams.get('agentId');
  if (!agentId) return NextResponse.json({ error: 'agentId required' }, { status: 400 });
  const executions = await getAgentExecutions(agentId, 30);
  return NextResponse.json({ executions });
}
