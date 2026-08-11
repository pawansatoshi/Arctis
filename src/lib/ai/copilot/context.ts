import { getUserSessions } from '@/lib/firebase/sessions';
import { getUserPrompts } from '@/lib/firebase/prompts';
import { getUserAgents, getOwnerReports } from '@/lib/agents/service';
import type { AISession, SavedPrompt, AgentReport, Agent } from '@/types';

// ============================================================
// Copilot Context Builder
// Current Knowledge OS context = sessions + prompts + agents + reports.
// This is a contextual snapshot, not a full document/RAG memory system.
// ============================================================

export interface CopilotContext {
  recentSessions: AISession[];
  savedPrompts: SavedPrompt[];
  agents: Agent[];
  recentReports: AgentReport[];
}

const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;
const MAX_CONTEXT_CHARS = 5000;

function timestamp(value: string): number {
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function isRecent(dateStr: string): boolean {
  const time = timestamp(dateStr);
  return time > 0 && Date.now() - time < THIRTY_DAYS_MS;
}

export async function buildCopilotContext(walletAddress: string): Promise<CopilotContext> {
  const [sessions, prompts, agents, reports] = await Promise.allSettled([
    getUserSessions(walletAddress, 20),
    getUserPrompts(walletAddress),
    getUserAgents(walletAddress),
    getOwnerReports(walletAddress, 10),
  ]);

  const recentSessions = sessions.status === 'fulfilled'
    ? sessions.value.filter((s: AISession) => isRecent(s.updatedAt)).sort((a, b) => timestamp(b.updatedAt) - timestamp(a.updatedAt)).slice(0, 5)
    : [];

  const recentReports = reports.status === 'fulfilled'
    ? reports.value.filter((r: AgentReport) => isRecent(r.createdAt)).sort((a, b) => timestamp(b.createdAt) - timestamp(a.createdAt)).slice(0, 3)
    : [];

  return {
    recentSessions,
    savedPrompts: prompts.status === 'fulfilled' ? prompts.value.slice(0, 8) : [],
    agents: agents.status === 'fulfilled' ? agents.value.slice(0, 8) : [],
    recentReports,
  };
}

function cleanPreview(value: string, max: number): string {
  return value.replace(/\s+/g, ' ').replace(/[\u0000-\u001f]/g, '').slice(0, max);
}

export function serializeCopilotContext(ctx: CopilotContext): string {
  const parts: string[] = [];

  if (ctx.agents.length > 0) {
    const lines = ctx.agents.slice(0, 5).map(
      (a) => `- [agent:${a.id}] ${cleanPreview(a.name, 60)} (${a.type}): ${a.status}, budget ${a.monthlyBudgetCredits} cr/mo`
    ).join('\n');
    parts.push(`## Your Agents\n${lines}`);
  }

  if (ctx.savedPrompts.length > 0) {
    const lines = ctx.savedPrompts.slice(0, 6).map(
      (p: SavedPrompt) => `- [prompt:${p.id}] [${p.mode}] ${cleanPreview(p.title, 60)}: "${cleanPreview(p.content, 100)}${p.content.length > 100 ? '…' : ''}"`
    ).join('\n');
    parts.push(`## Your Saved Prompts\n${lines}`);
  }

  if (ctx.recentSessions.length > 0) {
    const lines = ctx.recentSessions.slice(0, 3).map((s) => {
      const last = s.messages?.[s.messages.length - 1];
      const preview = cleanPreview(last?.content ?? '', 120);
      return `- [session:${s.id}] [${s.mode}] "${cleanPreview(s.title, 60)}" updated ${s.updatedAt}: ${preview}${preview.length >= 120 ? '…' : ''}`;
    }).join('\n');
    parts.push(`## Recent Sessions\n${lines}`);
  }

  if (ctx.recentReports.length > 0) {
    const lines = ctx.recentReports.slice(0, 3).map(
      (r) => `- [report:${r.id}] ${cleanPreview(r.agentName, 50)} (${r.type}): "${cleanPreview(r.title, 60)}" — ${cleanPreview(r.summary ?? '', 120)}`
    ).join('\n');
    parts.push(`## Recent Agent Reports\n${lines}`);
  }

  if (parts.length === 0) return '';
  const full = `\n\n---\n## Your Context\n${parts.join('\n\n')}`;
  return full.length > MAX_CONTEXT_CHARS ? full.slice(0, MAX_CONTEXT_CHARS) + '\n…' : full;
}
