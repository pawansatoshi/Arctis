import { NextRequest, NextResponse } from 'next/server';
import { getUserAgents, createAgent, countUserAgents } from '@/lib/agents/service';
import { getMembership } from '@/lib/memberships/service';
import { MEMBERSHIP_PLANS } from '@/lib/memberships/plans';
import { obs } from '@/lib/observability/logger';
import { verifyApiWallet } from '@/lib/auth/middleware';
import type { AgentType } from '@/types';

export async function GET(req: NextRequest) {
  const wallet = req.nextUrl.searchParams.get('wallet');
  if (!wallet) return NextResponse.json({ error: 'wallet required' }, { status: 400 });
  try {
    return NextResponse.json({ agents: await getUserAgents(wallet) });
  } catch (err) {
    const e = err as Error;
    return NextResponse.json({ error: e.message, agents: [] }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json() as {
      walletAddress: string; name: string; type: AgentType; description?: string;
      goals?: string[]; instructions?: string; model?: string;
      monthlyBudgetCredits?: number; maxCreditsPerExecution?: number; tags?: string[];
    };

    if (!body.walletAddress || !body.name || !body.type) {
      return NextResponse.json({ error: 'walletAddress, name, type required' }, { status: 400 });
    }

    const auth = await verifyApiWallet(req, body.walletAddress, true);
    if (!auth.ok) return NextResponse.json({ error: auth.reason ?? 'Wallet signature required' }, { status: 401 });
    const ownerWallet = auth.walletAddress;

    const [currentCount, membership] = await Promise.all([
      countUserAgents(ownerWallet),
      getMembership(ownerWallet),
    ]);
    const tier = membership?.tier ?? 'free';
    const plan = MEMBERSHIP_PLANS.find((p) => p.id === tier);
    const maxAgents = plan?.maxAgents ?? 1;
    if (currentCount >= maxAgents) {
      return NextResponse.json({
        error: `Agent limit reached. Your ${tier} plan allows ${maxAgents} agent${maxAgents === 1 ? '' : 's'}. Upgrade to create more.`,
        limitReached: true, currentCount, maxAgents,
      }, { status: 403 });
    }

    // Persist the field only for compatibility. Runtime routing ignores it
    // and always uses the current automatic model registry.
    const agent = await createAgent(ownerWallet, {
      name: body.name,
      type: body.type,
      description: body.description || '',
      goals: body.goals || [],
      instructions: body.instructions || '',
      model: 'automatic',
      monthlyBudgetCredits: Math.max(10, body.monthlyBudgetCredits || 100),
      maxCreditsPerExecution: Math.max(5, body.maxCreditsPerExecution || 20),
      tags: body.tags || [],
    });

    void obs.info('ai', 'Agent created via API', { agentId: agent.id, type: agent.type }, ownerWallet);
    return NextResponse.json({ agent });
  } catch (err) {
    const e = err as Error;
    void obs.error('ai', 'Agent creation failed', { error: e.message });
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const { agentId, ...updates } = await req.json() as { agentId: string; [key: string]: unknown };
    if (!agentId) return NextResponse.json({ error: 'agentId required' }, { status: 400 });
    const { updateAgent } = await import('@/lib/agents/service');
    await updateAgent(agentId, updates as Parameters<typeof updateAgent>[1]);
    return NextResponse.json({ success: true });
  } catch (err) {
    const e = err as Error;
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
