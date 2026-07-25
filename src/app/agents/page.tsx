'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Bot, Plus, Play, Pause, Archive, FileText, Zap,
  ChevronRight, Clock, CheckCircle2, XCircle, Loader2,
  BarChart3, Coins, Settings, AlertCircle, BookOpen,
  Code2, TrendingUp, Wrench, Eye, Database, Cpu, ShoppingBag,
} from 'lucide-react';
import { useAccount } from 'wagmi';
import { useAppStore } from '@/lib/store';
import { AI_MODELS } from '@/lib/ai/router';
import { cn, formatRelative, generateId } from '@/lib/utils';
import toast from 'react-hot-toast';
import type { Agent, AgentType, AgentExecution, AgentReport } from '@/types';
import { AgentProposalCard, type ProposalSummary } from '@/components/agents/AgentProposalCard';

// ─── Agent type configs ──────────────────────────────────────
const AGENT_TYPES: Record<AgentType, {
  icon: React.ElementType;
  label: string;
  color: string;
  bg: string;
  description: string;
  defaultGoals: string[];
  defaultInstructions: string;
}> = {
  research: {
    icon: BookOpen, label: 'Research', color: 'text-cyan-400', bg: 'bg-cyan-500/10',
    description: 'Research topics, analyze data, generate findings reports',
    defaultGoals: ['Collect and analyze information', 'Identify key patterns and insights', 'Produce structured reports'],
    defaultInstructions: 'Always cite your reasoning. Structure reports as: Summary → Key Findings → Analysis → Recommendations.',
  },
  developer: {
    icon: Code2, label: 'Developer', color: 'text-blue-400', bg: 'bg-blue-500/10',
    description: 'Code generation, audits, architecture, smart contract analysis',
    defaultGoals: ['Write production-grade code', 'Conduct security reviews', 'Generate technical documentation'],
    defaultInstructions: 'Default to TypeScript and Arc/EVM patterns. Always include error handling and types.',
  },
  engineering: {
    icon: Wrench, label: 'Engineering', color: 'text-amber-400', bg: 'bg-amber-500/10',
    description: 'Technical analysis, calculations, diagnostics, specifications',
    defaultGoals: ['Perform technical analysis', 'Generate engineering specifications', 'Identify system issues'],
    defaultInstructions: 'Show methodology and calculations. Include safety considerations.',
  },
  treasury: {
    icon: TrendingUp, label: 'Treasury', color: 'text-emerald-400', bg: 'bg-emerald-500/10',
    description: 'Track treasury activity, revenue analysis, financial summaries',
    defaultGoals: ['Monitor USDC flows', 'Analyze revenue streams', 'Flag financial anomalies'],
    defaultInstructions: 'Be precise with numbers. Flag anomalies immediately. Use tables for financial data.',
  },
  monitoring: {
    icon: Eye, label: 'Monitoring', color: 'text-violet-400', bg: 'bg-violet-500/10',
    description: 'Monitor wallets, APIs, RPC health, generate alerts',
    defaultGoals: ['Detect anomalies', 'Monitor system health', 'Generate actionable alerts'],
    defaultInstructions: 'Use severity levels: CRITICAL, WARNING, INFO. Always recommend remediation.',
  },
  document: {
    icon: FileText, label: 'Document', color: 'text-rose-400', bg: 'bg-rose-500/10',
    description: 'PDF analysis, OCR, document extraction, knowledge organization',
    defaultGoals: ['Extract structured information', 'Organize document content', 'Generate summaries'],
    defaultInstructions: 'Preserve source structure. Highlight key information. Create actionable summaries.',
  },
  custom: {
    icon: Cpu, label: 'Custom', color: 'text-surface-700', bg: 'bg-surface-300/30',
    description: 'Custom agent with your own goals and instructions',
    defaultGoals: [],
    defaultInstructions: '',
  },
};

// ─── Custom agent templates (Phase 17) ────────────────────────
// Market Intelligence and Shopping Advisor are NOT new AgentType
// values — the locked Economic Agent architecture defines exactly
// 7 required types. These are pre-filled configurations of the
// existing 'custom' type, following the same goals/instructions
// extension point every custom agent already uses. This adds the
// capability without touching the locked type system.
interface CustomTemplate {
  id: string;
  icon: React.ElementType;
  label: string;
  color: string;
  bg: string;
  description: string;
  defaultGoals: string[];
  defaultInstructions: string;
}

const CUSTOM_TEMPLATES: CustomTemplate[] = [
  {
    id: 'market-intelligence',
    icon: TrendingUp,
    label: 'Market Intelligence',
    color: 'text-violet-400',
    bg: 'bg-violet-500/10',
    description: 'Tracks stablecoin markets, Arc ecosystem news, and competitive positioning',
    defaultGoals: [
      'Monitor stablecoin market trends and rate movements',
      'Track Arc ecosystem developments and competitor activity',
      'Summarize relevant regulatory or infrastructure changes',
    ],
    defaultInstructions:
      'You are a Market Intelligence agent. Analyze stablecoin markets, Arc ecosystem developments, and adjacent Layer-1 activity. When given a task, research current context, identify what has changed recently, and assess relevance to ARCTIS. Always distinguish verified facts from speculation. Do not present unverified claims as fact — flag uncertainty explicitly. Structure output as: Summary → Key Developments → Relevance to ARCTIS → Recommendations.',
  },
  {
    id: 'shopping-advisor',
    icon: ShoppingBag,
    label: 'Shopping Advisor',
    color: 'text-pink-400',
    bg: 'bg-pink-500/10',
    description: 'Compares products, prices, and value using USDC as the reference currency',
    defaultGoals: [
      'Compare product options against user-specified criteria',
      'Express all prices and value comparisons in USDC terms',
      'Identify the best value option with clear reasoning',
    ],
    defaultInstructions:
      'You are a Shopping Advisor agent. Given a product category or specific comparison request, analyze options against the criteria provided (price, quality, features, reviews). Express recommendations clearly with a stated confidence level. Never fabricate specific prices or availability you cannot verify — state when information should be confirmed by the user directly. Structure output as: Summary → Options Compared → Recommendation → Confidence Level.',
  },
];


function AgentStatusDot({ status }: { status: Agent['status'] }) {
  if (status === 'running')  return <span className="w-2 h-2 rounded-full bg-blue-400 animate-pulse" />;
  if (status === 'idle')     return <span className="w-2 h-2 rounded-full bg-emerald-400" />;
  if (status === 'error')    return <span className="w-2 h-2 rounded-full bg-rose-400" />;
  if (status === 'paused')   return <span className="w-2 h-2 rounded-full bg-amber-400" />;
  return <span className="w-2 h-2 rounded-full bg-surface-500" />;
}

// ─── Create Agent Modal ──────────────────────────────────────
function CreateAgentModal({
  onClose,
  onCreate,
}: {
  onClose: () => void;
  onCreate: (data: Partial<Agent>) => Promise<void>;
}) {
  const [step, setStep] = useState<'type' | 'template' | 'config'>('type');
  const [selectedType, setSelectedType] = useState<AgentType | null>(null);
  const [selectedTemplateId, setSelectedTemplateId] = useState<string | null>(null);
  const [form, setForm] = useState({
    name: '',
    description: '',
    goals: [''],
    instructions: '',
    model: 'moonshot/kimi-k1-5-32k',
    monthlyBudgetCredits: 100,
    maxCreditsPerExecution: 20,
    tags: [] as string[],
  });
  const [creating, setCreating] = useState(false);

  const setType = (type: AgentType) => {
    setSelectedType(type);
    if (type === 'custom') {
      // Custom type offers pre-filled templates (Market Intelligence, Shopping
      // Advisor, or a blank custom agent) before reaching the config step —
      // no new AgentType values, this is entirely within the 'custom' type.
      setStep('template');
      return;
    }
    const cfg = AGENT_TYPES[type];
    setForm((f: typeof form) => ({
      ...f,
      goals: cfg.defaultGoals.length > 0 ? cfg.defaultGoals : [''],
      instructions: cfg.defaultInstructions,
    }));
    setStep('config');
  };

  const setCustomTemplate = (template: CustomTemplate | null) => {
    setSelectedTemplateId(template?.id ?? null);
    setForm((f: typeof form) => ({
      ...f,
      name: template ? `My ${template.label} Agent` : f.name,
      description: template?.description ?? '',
      goals: template ? template.defaultGoals : [''],
      instructions: template?.defaultInstructions ?? '',
      tags: template ? [template.id] : [],
    }));
    setStep('config');
  };

  const handleCreate = async () => {
    if (!selectedType || !form.name.trim()) return;
    setCreating(true);
    try {
      await onCreate({
        type: selectedType,
        name: form.name,
        description: form.description,
        goals: form.goals.filter((g: string) => g.trim()),
        instructions: form.instructions,
        model: form.model,
        monthlyBudgetCredits: form.monthlyBudgetCredits,
        maxCreditsPerExecution: form.maxCreditsPerExecution,
        tags: form.tags,
      });
      onClose();
    } catch {
      setCreating(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <motion.div
        initial={{ scale: 0.96, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.96, opacity: 0 }}
        className="glass-card p-6 w-full max-w-xl max-h-[90vh] overflow-y-auto"
        onClick={(e: React.MouseEvent) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-surface-950 font-semibold text-lg">
            {step === 'type' ? 'Choose Agent Type' : step === 'template' ? 'Choose a Template' : 'Configure Agent'}
          </h2>
          <button onClick={onClose} className="text-surface-600 hover:text-surface-950 text-xl leading-none">×</button>
        </div>

        {step === 'type' && (
          <div className="grid grid-cols-2 gap-3">
            {(Object.entries(AGENT_TYPES) as [AgentType, typeof AGENT_TYPES[AgentType]][]).map(([type, cfg]) => (
              <button
                key={type}
                onClick={() => setType(type)}
                className="glass-card-hover p-4 text-left flex flex-col gap-2"
              >
                <div className={cn('w-9 h-9 rounded-xl flex items-center justify-center', cfg.bg)}>
                  <cfg.icon className={cn('w-4.5 h-4.5', cfg.color)} />
                </div>
                <div className="text-surface-950 font-medium text-sm">{cfg.label}</div>
                <div className="text-surface-600 text-xs leading-relaxed">{cfg.description}</div>
              </button>
            ))}
          </div>
        )}

        {step === 'template' && (
          <div className="space-y-3">
            <button onClick={() => setStep('type')} className="text-surface-600 text-sm hover:text-surface-950 flex items-center gap-1">
              ← Back
            </button>
            <p className="text-surface-600 text-xs">Start from a template or build from scratch. All templates are Custom-type agents you can fully edit.</p>
            <div className="grid grid-cols-1 gap-2">
              {CUSTOM_TEMPLATES.map((tpl) => (
                <button key={tpl.id} onClick={() => setCustomTemplate(tpl)} className="glass-card-hover p-4 text-left flex items-start gap-3">
                  <div className={cn('w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0', tpl.bg)}>
                    <tpl.icon className={cn('w-4.5 h-4.5', tpl.color)} />
                  </div>
                  <div>
                    <div className="text-surface-950 font-medium text-sm">{tpl.label}</div>
                    <div className="text-surface-600 text-xs leading-relaxed mt-0.5">{tpl.description}</div>
                  </div>
                </button>
              ))}
              <button onClick={() => setCustomTemplate(null)} className="glass-card-hover p-4 text-left flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 bg-surface-300/30">
                  <Cpu className="w-4.5 h-4.5 text-surface-700" />
                </div>
                <div className="text-surface-950 font-medium text-sm">Blank Custom Agent</div>
              </button>
            </div>
          </div>
        )}

        {step === 'config' && selectedType && (
          <div className="space-y-4">
            <button onClick={() => setStep(selectedType === 'custom' ? 'template' : 'type')} className="text-surface-600 text-sm hover:text-surface-950 flex items-center gap-1">
              ← Back
            </button>

            <div className="flex items-center gap-3 p-3 rounded-xl bg-surface-200/40">
              {(() => {
                const currentType: AgentType = selectedType;
                const activeTemplate = currentType === 'custom' ? CUSTOM_TEMPLATES.find((t) => t.id === selectedTemplateId) : null;
                const cfg = activeTemplate ?? AGENT_TYPES[currentType];
                return (
                  <>
                    <div className={cn('w-8 h-8 rounded-lg flex items-center justify-center', cfg.bg)}>
                      <cfg.icon className={cn('w-4 h-4', cfg.color)} />
                    </div>
                    <span className="text-surface-950 font-medium text-sm">{cfg.label} Agent</span>
                  </>
                );
              })()}
            </div>

            {/* Name */}
            <div>
              <label className="text-surface-700 text-xs font-medium block mb-1.5">Agent Name *</label>
              <input
                type="text" value={form.name} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setForm({ ...form, name: e.target.value })}
                placeholder={`My ${AGENT_TYPES[selectedType as AgentType].label} Agent`}
                className="input-base" maxLength={60}
              />
            </div>

            {/* Description */}
            <div>
              <label className="text-surface-700 text-xs font-medium block mb-1.5">Description</label>
              <input
                type="text" value={form.description} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setForm({ ...form, description: e.target.value })}
                placeholder="What does this agent do?" className="input-base" maxLength={200}
              />
            </div>

            {/* Goals */}
            <div>
              <label className="text-surface-700 text-xs font-medium block mb-1.5">Goals</label>
              <div className="space-y-2">
                {form.goals.map((goal: string, i: number) => (
                  <div key={i} className="flex gap-2">
                    <input
                      type="text" value={goal}
                      onChange={(e: React.ChangeEvent<HTMLInputElement>) => { const g = [...form.goals]; g[i] = e.target.value; setForm({ ...form, goals: g }); }}
                      placeholder={`Goal ${i + 1}`} className="input-base"
                    />
                    {form.goals.length > 1 && (
                      <button onClick={() => setForm({ ...form, goals: form.goals.filter((_: string, j: number) => j !== i) })}
                        className="text-surface-500 hover:text-rose-400 transition-colors px-2">×</button>
                    )}
                  </div>
                ))}
                <button
                  onClick={() => setForm({ ...form, goals: [...form.goals, ''] })}
                  className="text-blue-400 text-xs hover:text-blue-300 transition-colors"
                >
                  + Add goal
                </button>
              </div>
            </div>

            {/* Instructions */}
            <div>
              <label className="text-surface-700 text-xs font-medium block mb-1.5">Custom Instructions</label>
              <textarea
                value={form.instructions}
                onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setForm({ ...form, instructions: e.target.value })}
                placeholder="Additional instructions for this agent..."
                className="input-base resize-none" rows={3}
              />
            </div>

            {/* Model */}
            <div>
              <label className="text-surface-700 text-xs font-medium block mb-1.5">AI Model</label>
              <select
                value={form.model}
                onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setForm({ ...form, model: e.target.value })}
                className="input-base"
              >
                {AI_MODELS.map((m) => (
                  <option key={m.id} value={m.id}>{m.name} — {m.creditCost} cr/1k tokens</option>
                ))}
              </select>
            </div>

            {/* Budget */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-surface-700 text-xs font-medium block mb-1.5">Monthly Budget (credits)</label>
                <input
                  type="number" value={form.monthlyBudgetCredits} min={10} max={10000}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => setForm({ ...form, monthlyBudgetCredits: parseInt(e.target.value) || 100 })}
                  className="input-base"
                />
              </div>
              <div>
                <label className="text-surface-700 text-xs font-medium block mb-1.5">Max per Execution</label>
                <input
                  type="number" value={form.maxCreditsPerExecution} min={5} max={500}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => setForm({ ...form, maxCreditsPerExecution: parseInt(e.target.value) || 20 })}
                  className="input-base"
                />
              </div>
            </div>

            <button
              onClick={handleCreate}
              disabled={!form.name.trim() || creating}
              className="btn-primary w-full py-3"
            >
              {creating ? <><Loader2 className="w-4 h-4 animate-spin" /> Creating Agent…</> : <><Bot className="w-4 h-4" /> Create Agent</>}
            </button>
          </div>
        )}
      </motion.div>
    </div>
  );
}

// ─── Agent Detail Panel ──────────────────────────────────────
function AgentDetail({
  agent, walletAddress, onClose, onExecute,
}: {
  agent: Agent;
  walletAddress: string;
  onClose: () => void;
  onExecute: (agentId: string, task: string) => Promise<void>;
}) {
  const [task, setTask] = useState('');
  const [executions, setExecutions] = useState<AgentExecution[]>([]);
  const [reports, setReports]       = useState<AgentReport[]>([]);
  const [running, setRunning]       = useState(false);
  const [output, setOutput]         = useState('');
  const [activeTab, setActiveTab]   = useState<'run' | 'history' | 'reports'>('run');
  const [pendingProposal, setPendingProposal] = useState<ProposalSummary | null>(null);
  const [proposing, setProposing]   = useState(false);
  const cfg = AGENT_TYPES[agent.type];

  useEffect(() => {
    // Load executions and reports
    Promise.all([
      fetch(`/api/agents/reports?agentId=${agent.id}`).then((r) => r.json()),
      fetch(`/api/agents/executions?agentId=${agent.id}`).then((r) => r.json()),
    ]).then(([reportData, executionData]) => {
      setReports(reportData.reports ?? []);
      setExecutions(executionData.executions ?? []);
    }).catch(() => {});
  }, [agent.id]);

  // ── Phase 1: Prepare — submit proposal for review ───────────────
  const handlePropose = async () => {
    if (!task.trim() || proposing || running) return;
    if (!walletAddress) { toast.error('Connect your wallet first'); return; }
    setProposing(true);
    const currentTask = task;
    try {
      const res = await fetch('/api/agents/propose', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ agentId: agent.id, task: currentTask, walletAddress }),
      });
      const data = await res.json();
      if (!res.ok) { toast.error(data.error ?? 'Failed to create proposal'); return; }
      setTask('');
      setPendingProposal(data as ProposalSummary);
    } catch (err) { toast.error((err as Error).message); }
    finally { setProposing(false); }
  };

  // ── Phase 3 (approve callback): show output, refresh reports ────
  const handleApproveResult = (result: { outputSummary: string; executionId: string }) => {
    setPendingProposal(null);
    setOutput(result.outputSummary);
    Promise.all([
      fetch(`/api/agents/reports?agentId=${agent.id}`).then((r) => r.json()),
      fetch(`/api/agents/executions?agentId=${agent.id}`).then((r) => r.json()),
    ]).then(([reportData, executionData]) => {
      if (reportData.reports) setReports(reportData.reports);
      if (executionData.executions) setExecutions(executionData.executions);
    }).catch(() => {});
  };

  const budgetUsedPct = Math.round((agent.creditsUsedThisMonth / Math.max(agent.monthlyBudgetCredits, 1)) * 100);

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 p-4">
      <motion.div
        initial={{ y: 40, opacity: 0 }} animate={{ y: 0, opacity: 1 }}
        className="glass-card w-full max-w-2xl max-h-[90vh] flex flex-col"
      >
        {/* Header */}
        <div className="flex items-center gap-3 px-6 py-4 border-b border-white/[0.06]">
          <div className={cn('w-9 h-9 rounded-xl flex items-center justify-center', cfg.bg)}>
            <cfg.icon className={cn('w-4.5 h-4.5', cfg.color)} />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <h3 className="text-surface-950 font-semibold truncate">{agent.name}</h3>
              <AgentStatusDot status={agent.status} />
            </div>
            <div className="text-surface-600 text-xs capitalize">{agent.type} agent · {agent.executionCount} executions</div>
          </div>
          <button onClick={onClose} className="text-surface-600 hover:text-surface-950 text-xl leading-none">×</button>
        </div>

        {/* Budget bar */}
        <div className="px-6 py-3 border-b border-white/[0.06]">
          <div className="flex justify-between text-xs mb-1.5">
            <span className="text-surface-600">Monthly budget</span>
            <span className="text-surface-950 font-mono">{agent.creditsUsedThisMonth} / {agent.monthlyBudgetCredits} credits</span>
          </div>
          <div className="h-1.5 bg-surface-300 rounded-full overflow-hidden">
            <div
              className={cn('h-full rounded-full', budgetUsedPct > 80 ? 'bg-rose-500' : 'bg-blue-500')}
              style={{ width: `${Math.min(100, budgetUsedPct)}%` }}
            />
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 px-6 pt-3 pb-2">
          {(['run', 'history', 'reports'] as const).map((tab) => (
            <button key={tab} onClick={() => setActiveTab(tab)}
              className={cn('px-3 py-1.5 rounded-lg text-xs font-medium capitalize transition-all',
                activeTab === tab ? 'bg-blue-500/20 text-blue-400' : 'text-surface-600 hover:text-surface-950'
              )}>
              {tab} {tab === 'reports' && reports.length > 0 && `(${reports.length})`}
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-6 pb-6">
          {/* Run tab */}
          {activeTab === 'run' && (
            <div className="space-y-3 pt-2">
              <textarea
                value={task}
                onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setTask(e.target.value)}
                onKeyDown={(e: React.KeyboardEvent) => { if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) handlePropose(); }}
                placeholder={`Give ${agent.name} a task…\ne.g. "${agent.type === 'research' ? 'Research the latest developments in Arc stablecoin infrastructure' : agent.type === 'developer' ? 'Review this smart contract for security vulnerabilities' : 'Analyze the current treasury position'}"`}
                rows={3}
                className="input-base resize-none"
              />
              <div className="flex items-center justify-between">
                <span className="text-surface-500 text-xs">⌘+Enter to propose · Max {agent.maxCreditsPerExecution} credits</span>
                <button onClick={handlePropose} disabled={!task.trim() || proposing || running || !!pendingProposal}
                  className="btn-primary text-sm py-2 px-5 disabled:opacity-40">
                  {proposing ? <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Preparing…</> : <><Play className="w-3.5 h-3.5" /> Propose Task</>}
                </button>
              </div>

              {/* Phase 2: Review — proposal card */}
              <AnimatePresence>
                {pendingProposal && (
                  <AgentProposalCard proposal={pendingProposal} walletAddress={walletAddress}
                    onApproved={handleApproveResult} onRejected={() => setPendingProposal(null)} />
                )}
              </AnimatePresence>

              {(running || output) && (
                <div className="glass-card p-4 min-h-24 max-h-80 overflow-y-auto">
                  <div className="text-surface-600 text-xs mb-2 flex items-center gap-1.5">
                    <cfg.icon className={cn('w-3.5 h-3.5', cfg.color)} />
                    {agent.name} output
                    {running && <Loader2 className="w-3 h-3 animate-spin ml-1 text-blue-400" />}
                  </div>
                  <div className="text-surface-950 text-sm whitespace-pre-wrap leading-relaxed font-mono">
                    {output}
                    {running && !output && <span className="text-surface-500">Thinking…</span>}
                    {running && output && <span className="inline-block w-1.5 h-4 bg-blue-400 ml-0.5 animate-pulse rounded-sm" />}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* History tab */}
          {activeTab === 'history' && (
            <div className="pt-2 space-y-2">
              {executions.length === 0 ? (
                <div className="py-8 text-center text-surface-600 text-sm">
                  No executions yet — run the agent to see history here
                </div>
              ) : executions.map((ex: AgentExecution) => (
                <div key={ex.id} className="glass-card p-4">
                  <div className="flex items-start justify-between gap-3 mb-2">
                    <div className="text-surface-950 text-sm font-medium truncate">{ex.task}</div>
                    <span className={cn('text-xs px-2 py-0.5 rounded-full flex-shrink-0',
                      ex.status === 'completed' ? 'badge-success' :
                      ex.status === 'failed'    ? 'badge-error' :
                      ex.status === 'proposed'  ? 'badge-pending' :
                      ex.status === 'rejected'  ? 'badge-error' : 'badge-pending'
                    )}>{ex.status}</span>
                  </div>
                  <div className="text-surface-600 text-xs">{ex.outputSummary}</div>
                  <div className="flex items-center gap-3 mt-2 text-xs text-surface-500">
                    <span className="flex items-center gap-1"><Zap className="w-3 h-3" />{ex.creditsConsumed}</span>
                    {ex.durationMs && <span>{(ex.durationMs / 1000).toFixed(1)}s</span>}
                    <span>{formatRelative(ex.startedAt)}</span>
                    {ex.evaluationVerdict && (
                      <span className={cn('flex items-center gap-1 ml-auto px-1.5 py-0.5 rounded-full text-[10px]',
                        ex.evaluationVerdict === 'PASS' ? 'bg-emerald-500/10 text-emerald-400' : 'bg-amber-500/10 text-amber-400')}>
                        {ex.evaluationVerdict === 'PASS' ? '✓ Reviewed' : '⚠ Flagged'}
                        {ex.revisionCount ? ` (revised)` : ''}
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Reports tab */}
          {activeTab === 'reports' && (
            <div className="pt-2 space-y-2">
              {reports.length === 0 ? (
                <div className="py-8 text-center text-surface-600 text-sm">
                  No reports yet — run the agent to generate reports
                </div>
              ) : reports.map((report: AgentReport) => (
                <details key={report.id} className="glass-card group">
                  <summary className="px-4 py-3 cursor-pointer flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <FileText className="w-3.5 h-3.5 text-surface-600" />
                      <span className="text-surface-950 text-sm font-medium truncate">{report.title}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-surface-500 text-xs">{formatRelative(report.createdAt)}</span>
                      <ChevronRight className="w-3.5 h-3.5 text-surface-600 group-open:rotate-90 transition-transform" />
                    </div>
                  </summary>
                  <div className="px-4 pb-4 text-surface-950 text-sm whitespace-pre-wrap leading-relaxed border-t border-white/[0.05] pt-3 font-mono text-xs max-h-64 overflow-y-auto">
                    {report.content}
                  </div>
                </details>
              ))}
            </div>
          )}
        </div>
      </motion.div>
    </div>
  );
}

// ─── Main Page ───────────────────────────────────────────────
export default function AgentsPage() {
  const { address, isConnected } = useAccount();
  const { membership, creditBalance } = useAppStore();
  const [agents, setAgents]               = useState<Agent[]>([]);
  const [loading, setLoading]             = useState(true);
  const [showCreate, setShowCreate]       = useState(false);
  const [selectedAgent, setSelectedAgent] = useState<Agent | null>(null);

  const fetchAgents = useCallback(async () => {
    if (!address) return;
    try {
      const res  = await fetch(`/api/agents?wallet=${address}`);
      const data = await res.json();
      setAgents(data.agents ?? []);
    } catch {}
    setLoading(false);
  }, [address]);

  useEffect(() => { fetchAgents(); }, [fetchAgents]);

  const handleCreate = useCallback(async (data: Partial<Agent>) => {
    if (!address) return;
    const res = await fetch('/api/agents', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ walletAddress: address, ...data }),
    });
    const json = await res.json();
    if (!res.ok) throw new Error(json.error ?? 'Failed to create agent');
    toast.success(`${json.agent.name} created`);
    await fetchAgents();
  }, [address, fetchAgents]);

  const handleExecute = useCallback(async (agentId: string, task: string) => {
    // Handled inside AgentDetail via streaming
  }, []);

  const handleArchive = useCallback(async (agentId: string, name: string) => {
    try {
      await fetch('/api/agents', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ agentId, status: 'archived' }),
      });
      toast.success(`${name} archived`);
      await fetchAgents();
    } catch {}
  }, [fetchAgents]);

  const tier = membership?.tier ?? 'free';
  const maxAgents = tier === 'enterprise' ? 999 : tier === 'pro' ? 10 : tier === 'student' ? 3 : 1;
  const totalCreditsUsed = agents.reduce((s: number, a: Agent) => s + a.creditsUsedThisMonth, 0);

  return (
    <div className="max-w-5xl space-y-6">
      {/* Header */}
      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
        className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-surface-950">Agents</h1>
          <p className="text-surface-600 text-sm mt-1">Economic agents that work, spend credits, and generate outputs</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="text-surface-600 text-xs hidden sm:block">
            {agents.length} / {maxAgents === 999 ? '∞' : maxAgents} agents
          </div>
          <button
            onClick={() => setShowCreate(true)}
            disabled={!isConnected || agents.length >= maxAgents}
            className="btn-primary"
          >
            <Plus className="w-4 h-4" /> New Agent
          </button>
        </div>
      </motion.div>

      {/* Stats row */}
      {isConnected && agents.length > 0 && (
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.05 }} className="grid grid-cols-3 gap-4">
          <div className="metric-card">
            <div className="text-surface-600 text-xs uppercase tracking-wider">Active Agents</div>
            <div className="text-2xl font-bold text-surface-950 font-mono">
              {agents.filter((a: Agent) => a.status !== 'archived').length}
            </div>
          </div>
          <div className="metric-card">
            <div className="text-surface-600 text-xs uppercase tracking-wider">Credits This Month</div>
            <div className="text-2xl font-bold text-surface-950 font-mono">{totalCreditsUsed.toLocaleString()}</div>
          </div>
          <div className="metric-card">
            <div className="text-surface-600 text-xs uppercase tracking-wider">Total Executions</div>
            <div className="text-2xl font-bold text-surface-950 font-mono">
              {agents.reduce((s: number, a: Agent) => s + a.executionCount, 0)}
            </div>
          </div>
        </motion.div>
      )}

      {/* Not connected */}
      {!isConnected && (
        <div className="glass-card p-12 text-center">
          <Bot className="w-12 h-12 text-surface-600 mx-auto mb-3 opacity-40" />
          <h3 className="text-surface-950 font-semibold mb-2">Connect Your Wallet</h3>
          <p className="text-surface-600 text-sm">Connect to create and manage economic agents</p>
        </div>
      )}

      {/* Loading */}
      {isConnected && loading && (
        <div className="glass-card p-12 text-center">
          <Loader2 className="w-8 h-8 text-blue-400 mx-auto animate-spin" />
        </div>
      )}

      {/* Empty state */}
      {isConnected && !loading && agents.length === 0 && (
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }} className="glass-card p-12 text-center">
          <div className="w-16 h-16 rounded-2xl bg-blue-500/10 flex items-center justify-center mx-auto mb-5">
            <Bot className="w-8 h-8 text-blue-400" />
          </div>
          <h3 className="text-surface-950 font-semibold text-lg mb-2">No agents yet</h3>
          <p className="text-surface-600 text-sm mb-6 max-w-sm mx-auto">
            Create your first economic agent. Agents perform work, maintain memory, consume credits, and generate reports.
          </p>
          <button onClick={() => setShowCreate(true)} className="btn-primary mx-auto">
            <Plus className="w-4 h-4" /> Create First Agent
          </button>
        </motion.div>
      )}

      {/* Agent grid */}
      {isConnected && !loading && agents.length > 0 && (
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }} className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {agents.map((agent: Agent) => {
            const cfg = AGENT_TYPES[agent.type];
            const budgetPct = Math.round((agent.creditsUsedThisMonth / Math.max(agent.monthlyBudgetCredits, 1)) * 100);
            return (
              <div
                key={agent.id}
                onClick={() => setSelectedAgent(agent)}
                className="glass-card-hover p-5 cursor-pointer flex flex-col gap-3"
              >
                <div className="flex items-start justify-between">
                  <div className={cn('w-10 h-10 rounded-xl flex items-center justify-center', cfg.bg)}>
                    <cfg.icon className={cn('w-5 h-5', cfg.color)} />
                  </div>
                  <AgentStatusDot status={agent.status} />
                </div>
                <div>
                  <div className="text-surface-950 font-semibold text-sm">{agent.name}</div>
                  <div className="text-surface-600 text-xs capitalize mt-0.5">{cfg.label} Agent</div>
                </div>
                {agent.description && (
                  <div className="text-surface-600 text-xs leading-relaxed line-clamp-2">{agent.description}</div>
                )}
                {/* Budget */}
                <div>
                  <div className="flex justify-between text-xs mb-1 text-surface-500">
                    <span>Budget</span>
                    <span>{agent.creditsUsedThisMonth}/{agent.monthlyBudgetCredits} cr</span>
                  </div>
                  <div className="h-1 bg-surface-300 rounded-full overflow-hidden">
                    <div
                      className={cn('h-full rounded-full', budgetPct > 80 ? 'bg-rose-500' : 'bg-blue-500')}
                      style={{ width: `${Math.min(100, budgetPct)}%` }}
                    />
                  </div>
                </div>
                <div className="flex items-center justify-between text-xs text-surface-500">
                  <span className="flex items-center gap-1">
                    <BarChart3 className="w-3 h-3" />{agent.executionCount} runs
                  </span>
                  <span className="flex items-center gap-1">
                    <Zap className="w-3 h-3" />{agent.totalCreditsConsumed.toLocaleString()} total
                  </span>
                </div>
              </div>
            );
          })}
        </motion.div>
      )}

      {/* Modals */}
      <AnimatePresence>
        {showCreate && (
          <CreateAgentModal onClose={() => setShowCreate(false)} onCreate={handleCreate} />
        )}
        {selectedAgent && (
          <AgentDetail
            agent={selectedAgent}
            walletAddress={address ?? ''}
            onClose={() => { setSelectedAgent(null); fetchAgents(); }}
            onExecute={handleExecute}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
