// ============================================================
// Copilot Context Builder — Phase 12: AI Copilot Expansion
// Fetches dynamic per-user context from Firestore and serialises
// it for injection into the Copilot system prompt.
// Runs server-side only. Fail-safe: partial failures are silently
// omitted rather than blocking the Copilot response.
// ============================================================

import { getUserSessions } from '@/lib/firebase/sessions';
import { getUserPrompts } from '@/lib/firebase/prompts';
import { getUserAgents, getOwnerReports } from '@/lib/agents/service';
import type { AISession, SavedPrompt, AgentReport, Agent } from '@/types';

export interface CopilotContext {
  recentSessions: AISession[];
  savedPrompts: SavedPrompt[];
  agents: Agent[];
  recentReports: AgentReport[];
}

const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;

function isRecent(dateStr: string): boolean {
  try {
    return Date.now() - new Date(dateStr).getTime() < THIRTY_DAYS_MS;
  } catch { return false; }
}

export async function buildCopilotContext(walletAddress: string): Promise<CopilotContext> {
  const [sessions, prompts, agents, reports] = await Promise.allSettled([
    getUserSessions(walletAddress, 10),
    getUserPrompts(walletAddress),
    getUserAgents(walletAddress),
    getOwnerReports(walletAddress, 5),
  ]);

  const recentSessions = sessions.status === 'fulfilled'
    ? sessions.value.filter((s: AISession) => isRecent(s.updatedAt)).slice(0, 5)
    : [];

  const recentReports = reports.status === 'fulfilled'
    ? reports.value.filter((r: AgentReport) => isRecent(r.createdAt)).slice(0, 3)
    : [];

  return {
    recentSessions,
    savedPrompts: prompts.status === 'fulfilled' ? prompts.value.slice(0, 8) : [],
    agents: agents.status === 'fulfilled' ? agents.value : [],
    recentReports,
  };
}

const MAX_CONTEXT_CHARS = 3000;

export function serializeCopilotContext(ctx: CopilotContext): string {
  const parts: string[] = [];

  if (ctx.agents.length > 0) {
    const lines = ctx.agents.slice(0, 5).map(
      (a) => `- ${a.name} (${a.type}): ${a.status}, budget ${a.monthlyBudgetCredits} cr/mo`
    ).join('\n');
    parts.push(`## Your Agents\n${lines}`);
  }

  if (ctx.savedPrompts.length > 0) {
    const lines = ctx.savedPrompts.slice(0, 6).map(
      (p: SavedPrompt) => `- [${p.mode ?? 'general'}] ${p.title}: "${p.content.slice(0, 80)}${p.content.length > 80 ? '…' : ''}"`
    ).join('\n');
    parts.push(`## Your Saved Prompts\n${lines}`);
  }

  if (ctx.recentSessions.length > 0) {
    const lines = ctx.recentSessions.slice(0, 3).map((s) => {
      const last = s.messages?.[s.messages.length - 1];
      const preview = last?.content?.slice(0, 100) ?? '';
      return `- [${s.mode}] "${s.title}": ${preview}${preview.length >= 100 ? '…' : ''}`;
    }).join('\n');
    parts.push(`## Recent Sessions\n${lines}`);
  }

  if (ctx.recentReports.length > 0) {
    const lines = ctx.recentReports.slice(0, 3).map(
      (r) => `- ${r.agentName} (${r.type}): "${r.title}" — ${r.summary?.slice(0, 100) ?? ''}`
    ).join('\n');
    parts.push(`## Recent Agent Reports\n${lines}`);
  }

  if (parts.length === 0) return '';

  const full = `\n\n---\n## Your Context\n${parts.join('\n\n')}`;
  // Hard cap to prevent context overflow
  return full.length > MAX_CONTEXT_CHARS ? full.slice(0, MAX_CONTEXT_CHARS) + '\n…' : full;
}
