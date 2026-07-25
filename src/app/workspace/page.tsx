'use client';

import { useState, useCallback, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  BookOpen, Code2, Search, TrendingUp, Wrench, GraduationCap,
  Plus, Star, Copy, ChevronRight, Trash2, Save, Check,
  Users, FlaskConical, Cpu,
} from 'lucide-react';
import { useAccount } from 'wagmi';
import { cn, generateId, copyToClipboard } from '@/lib/utils';
import { useRouter } from 'next/navigation';
import { useAppStore } from '@/lib/store';
import { savePrompt, getUserPrompts, deletePrompt } from '@/lib/firebase/prompts';
import type { WorkspaceDomain, AIMode, SavedPrompt } from '@/types';
import toast from 'react-hot-toast';

const WORKSPACE_DOMAINS: Record<WorkspaceDomain, {
  icon: React.ElementType; label: string; color: string; bg: string;
  mode: AIMode; description: string; templates: string[];
}> = {
  student: {
    icon: GraduationCap, label: 'Student', color: 'text-violet-400', bg: 'bg-violet-500/10', mode: 'student',
    description: 'Homework, notes, OCR, PDF summaries, study plans, exam prep',
    templates: [
      'Explain {concept} in simple terms with 3 examples',
      'Create a study plan for {subject} over {days} days',
      'Summarize this chapter and generate 5 quiz questions: {text}',
      'Help me understand the difference between {A} and {B}',
      'Create flashcards for these key terms: {terms}',
    ],
  },
  teacher: {
    icon: Users, label: 'Teacher', color: 'text-emerald-400', bg: 'bg-emerald-500/10', mode: 'teacher',
    description: 'Lesson plans, assignments, MCQs, answer keys, chapter summaries',
    templates: [
      'Create a lesson plan for {topic} (Grade {grade}, Duration: {time})',
      'Generate 10 multiple choice questions on {topic} with answer key',
      'Write an assignment rubric for {assignment}',
      'Create a chapter summary for {chapter} that students can use to study',
      'Design a group activity for teaching {concept} to {grade} students',
    ],
  },
  professor: {
    icon: FlaskConical, label: 'Professor', color: 'text-cyan-400', bg: 'bg-cyan-500/10', mode: 'professor',
    description: 'Research papers, academic writing, citations, paper analysis',
    templates: [
      'Write an academic literature review on {topic}',
      'Analyze this research paper and identify methodology gaps: {abstract}',
      'Help me structure a research proposal for {topic}',
      'Convert these bullet points into academic prose: {notes}',
      'Check this paragraph for logical consistency and academic tone: {text}',
    ],
  },
  research: {
    icon: Search, label: 'Research', color: 'text-blue-400', bg: 'bg-blue-500/10', mode: 'research',
    description: 'Deep research, source analysis, findings extraction, reports',
    templates: [
      'Research the current state of {topic} and summarize key developments',
      'Compare and contrast {A} vs {B} approaches across these dimensions: {dimensions}',
      'Extract key findings from this document: {document}',
      'What are the strongest arguments for and against {position}?',
      'Create a comprehensive research brief on {subject}',
    ],
  },
  developer: {
    icon: Code2, label: 'Developer', color: 'text-blue-400', bg: 'bg-blue-500/10', mode: 'developer',
    description: 'Smart contracts, Arc dev, React, Next.js, security audits, architecture',
    templates: [
      'Write a TypeScript function to {task} using viem and wagmi v2',
      'Audit this Solidity contract for security vulnerabilities: {code}',
      'Create a Next.js App Router API route that {description}',
      'Design the architecture for a system that {requirements}',
      'Debug this TypeScript error and explain the fix: {error}',
    ],
  },
  engineering: {
    icon: Wrench, label: 'Engineering', color: 'text-amber-400', bg: 'bg-amber-500/10', mode: 'engineering',
    description: 'Technical analysis, calculations, diagnostics, specifications',
    templates: [
      'Perform a technical analysis of {system} and identify failure points',
      'Calculate {calculation} given these parameters: {parameters}',
      'Write technical specifications for {component}',
      'Create a diagnostic checklist for {system} issues',
      'Generate a maintenance workflow for {equipment}',
    ],
  },
  treasury: {
    icon: TrendingUp, label: 'Treasury', color: 'text-emerald-400', bg: 'bg-emerald-500/10', mode: 'treasury',
    description: 'USDC treasury analysis, cash flow, stablecoin operations',
    templates: [
      'Analyze this USDC treasury position and identify risks',
      'Create a cash flow forecast for {scenario}',
      'Review this transaction history for anomalies: {data}',
      'What is the optimal treasury allocation strategy for {context}?',
      'Generate a monthly treasury report summary from: {data}',
    ],
  },
  child: {
    icon: BookOpen, label: 'Kids', color: 'text-rose-400', bg: 'bg-rose-500/10', mode: 'child',
    description: 'Age-appropriate learning, fun explanations, safe content',
    templates: [
      'Explain {concept} using a fun story a child would enjoy',
      'Create 5 simple quiz questions about {topic} for kids',
      'What is {concept}? Explain it like I\'m 8 years old',
      'Make learning {subject} fun with a creative activity',
      'Tell me an educational story about {topic}',
    ],
  },
  operations: {
    icon: Cpu, label: 'Operations', color: 'text-surface-700', bg: 'bg-surface-300/30', mode: 'analyze',
    description: 'Runbooks, SOPs, incident management, operational docs',
    templates: [
      'Write a runbook for {process}',
      'Create an incident response template for {scenario}',
      'Draft an SOP for {operation}',
      'Analyze this log output for issues: {logs}',
      'Generate a post-mortem template for {incident}',
    ],
  },
};

export default function WorkspacePage() {
  const router = useRouter();
  const { address } = useAccount();
  const { setAIMode } = useAppStore();
  const [activeDomain, setActiveDomain] = useState<WorkspaceDomain>('developer');
  const [activeTab, setActiveTab] = useState<'templates' | 'library'>('templates');
  const [savedPrompts, setSavedPrompts] = useState<SavedPrompt[]>([]);
  const [loadingPrompts, setLoadingPrompts] = useState(false);
  const [saveModal, setSaveModal] = useState(false);
  const [pendingPrompt, setPendingPrompt] = useState('');
  const [promptTitle, setPromptTitle] = useState('');
  const [copiedIdx, setCopiedIdx] = useState<number | null>(null);

  const domain = WORKSPACE_DOMAINS[activeDomain];

  // Load saved prompts from Firebase
  useEffect(() => {
    if (!address) return;
    setLoadingPrompts(true);
    getUserPrompts(address)
      .then(setSavedPrompts)
      .catch(() => {})
      .finally(() => setLoadingPrompts(false));
  }, [address]);

  const handleUseTemplate = useCallback((template: string) => {
    setAIMode(domain.mode);
    if (typeof window !== 'undefined') {
      sessionStorage.setItem('arctis_prefill_prompt', template);
    }
    router.push('/ai');
  }, [domain.mode, setAIMode, router]);

  const handleCopy = useCallback(async (template: string, idx: number) => {
    await copyToClipboard(template);
    setCopiedIdx(idx);
    setTimeout(() => setCopiedIdx(null), 1500);
  }, []);

  const handleSavePrompt = useCallback((content: string) => {
    setPendingPrompt(content);
    setPromptTitle(content.slice(0, 50));
    setSaveModal(true);
  }, []);

  const confirmSave = useCallback(async () => {
    if (!promptTitle.trim() || !address) return;
    const newPrompt: SavedPrompt = {
      id: generateId(),
      title: promptTitle.trim(),
      content: pendingPrompt,
      mode: domain.mode,
      createdAt: new Date().toISOString(),
    };
    try {
      await savePrompt(address, newPrompt);
      setSavedPrompts((prev) => [newPrompt, ...prev]);
      toast.success('Saved to prompt library');
    } catch {
      toast.error('Failed to save prompt');
    }
    setSaveModal(false);
    setPromptTitle('');
    setPendingPrompt('');
  }, [promptTitle, pendingPrompt, domain.mode, address]);

  const handleDeletePrompt = useCallback(async (promptId: string) => {
    try {
      await deletePrompt(promptId);
      setSavedPrompts((prev) => prev.filter((p) => p.id !== promptId));
      toast.success('Removed');
    } catch {
      toast.error('Failed to delete');
    }
  }, []);

  const handleUsePrompt = useCallback((prompt: SavedPrompt) => {
    setAIMode(prompt.mode);
    if (typeof window !== 'undefined') {
      sessionStorage.setItem('arctis_prefill_prompt', prompt.content);
    }
    router.push('/ai');
  }, [setAIMode, router]);

  return (
    <div className="max-w-5xl space-y-6">
      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
        className="flex items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <div className="flex items-center gap-2 mb-1">
              <span className="text-surface-500 text-xs font-semibold uppercase tracking-widest">Knowledge OS</span>
            </div>
          </div>
          <h1 className="text-2xl font-bold text-surface-950 tracking-tight">Workspaces</h1>
          <p className="text-surface-600 text-sm mt-1">Domain-specific AI templates and your personal prompt library</p>
        </div>
        <button onClick={() => router.push('/ai')} className="btn-primary flex-shrink-0 shadow-lg shadow-blue-500/20">
          Open AI <ChevronRight className="w-4 h-4" />
        </button>
      </motion.div>

      {/* Domain grid */}
      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.05, duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
        className="grid grid-cols-3 sm:grid-cols-5 lg:grid-cols-9 gap-2">
        {(Object.entries(WORKSPACE_DOMAINS) as [WorkspaceDomain, typeof WORKSPACE_DOMAINS[WorkspaceDomain]][]).map(([key, d]) => (
          <button key={key} onClick={() => setActiveDomain(key)} title={d.description}
            className={cn(
              'flex flex-col items-center gap-2 p-3 rounded-xl border transition-all duration-200 text-center group',
              activeDomain === key
                ? 'border-blue-500/30 bg-blue-500/10 shadow-sm shadow-blue-500/10'
                : 'border-white/[0.06] bg-surface-200/40 hover:bg-surface-200/80 hover:border-white/[0.1]'
            )}>
            <div className={cn(
              'w-8 h-8 rounded-lg flex items-center justify-center transition-transform duration-200 group-hover:scale-105',
              d.bg,
            )}>
              <d.icon className={cn('w-4 h-4', d.color)} />
            </div>
            <span className={cn('text-xs font-medium leading-tight',
              activeDomain === key ? 'text-blue-400' : 'text-surface-700'
            )}>
              {d.label}
            </span>
          </button>
        ))}
      </motion.div>

      {/* Active workspace */}
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} key={activeDomain}>
        <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
          <div className="flex items-center gap-3">
            <div className={cn('w-9 h-9 rounded-xl flex items-center justify-center', domain.bg)}>
              <domain.icon className={cn('w-4.5 h-4.5', domain.color)} />
            </div>
            <div>
              <h2 className="text-surface-950 font-semibold">{domain.label} Workspace</h2>
              <p className="text-surface-600 text-xs">{domain.description}</p>
            </div>
          </div>
          <div className="flex gap-1 p-1 bg-surface-200/50 rounded-lg border border-white/[0.06]">
            {(['templates', 'library'] as const).map((tab) => (
              <button key={tab} onClick={() => setActiveTab(tab)}
                className={cn('px-3 py-1 rounded-md text-xs font-medium capitalize transition-all',
                  activeTab === tab ? 'bg-blue-500/20 text-blue-400' : 'text-surface-600 hover:text-surface-950'
                )}>
                {tab === 'library' ? `Library${savedPrompts.length > 0 ? ` (${savedPrompts.length})` : ''}` : 'Templates'}
              </button>
            ))}
          </div>
        </div>

        {activeTab === 'templates' && (
          <div className="space-y-2">
            {domain.templates.map((template, i) => (
              <div key={i} className="group glass-card-hover p-4 flex items-start justify-between gap-4">
                <p className="text-surface-700 text-sm leading-relaxed flex-1 font-mono">{template}</p>
                <div className="flex items-center gap-1.5 opacity-0 group-hover:opacity-100 transition-all duration-200 flex-shrink-0 mt-0.5">
                  <button onClick={() => handleCopy(template, i)} aria-label="Copy template"
                    className="p-1.5 rounded-lg text-surface-500 hover:text-surface-950 hover:bg-white/[0.07] transition-all">
                    {copiedIdx === i ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                  </button>
                  <button onClick={() => handleSavePrompt(template)} aria-label="Save to library"
                    className="p-1.5 rounded-lg text-surface-500 hover:text-amber-400 hover:bg-amber-500/10 transition-all">
                    <Star className="w-3.5 h-3.5" />
                  </button>
                  <button onClick={() => handleUseTemplate(template)} aria-label="Use in AI Workspace"
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-500/15 text-blue-400 hover:bg-blue-500/25 text-xs font-medium transition-all">
                    Use <ChevronRight className="w-3 h-3" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {activeTab === 'library' && (
          <div className="space-y-2">
            {!address && (
              <div className="glass-card p-8 text-center text-surface-600 text-sm">Connect wallet to see saved prompts</div>
            )}
            {address && loadingPrompts && (
              <div className="glass-card p-8 text-center text-surface-600 text-sm">Loading…</div>
            )}
            {address && !loadingPrompts && savedPrompts.length === 0 && (
              <div className="glass-card p-10 text-center">
                <div className="w-12 h-12 rounded-2xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center mx-auto mb-4">
                  <Star className="w-5 h-5 text-amber-400 opacity-60" />
                </div>
                <p className="text-surface-700 font-medium text-sm mb-1">No saved prompts yet</p>
                <p className="text-surface-500 text-xs leading-relaxed max-w-xs mx-auto">
                  Save templates you use often by clicking the ★ on any template card
                </p>
              </div>
            )}
            {savedPrompts.map((prompt) => (
              <div key={prompt.id} className="group glass-card-hover p-4 flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <div className="text-surface-950 text-sm font-medium">{prompt.title}</div>
                  <div className="text-surface-600 text-xs font-mono truncate mt-0.5">{prompt.content}</div>
                  <div className="text-surface-500 text-xs mt-1 capitalize">{prompt.mode} mode</div>
                </div>
                <div className="flex items-center gap-1 flex-shrink-0">
                  <button onClick={() => handleUsePrompt(prompt)}
                    className="p-1.5 rounded-lg text-surface-600 hover:text-blue-400 hover:bg-blue-500/10 transition-all">
                    <ChevronRight className="w-3.5 h-3.5" />
                  </button>
                  <button onClick={() => handleDeletePrompt(prompt.id)}
                    className="p-1.5 rounded-lg text-surface-600 hover:text-rose-400 hover:bg-rose-500/10 opacity-0 group-hover:opacity-100 transition-all">
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </motion.div>

      {/* Save modal */}
      <AnimatePresence>
        {saveModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={() => setSaveModal(false)}>
            <motion.div initial={{ scale: 0.96, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
              className="glass-card p-6 w-full max-w-md" onClick={(e) => e.stopPropagation()}>
              <h3 className="text-surface-950 font-semibold mb-4">Save to Prompt Library</h3>
              <label className="text-surface-700 text-xs font-medium block mb-1.5">Title</label>
              <input type="text" value={promptTitle} onChange={(e) => setPromptTitle(e.target.value)}
                className="input-base mb-3" placeholder="Name this prompt…" autoFocus maxLength={60}
                onKeyDown={(e) => { if (e.key === 'Enter') confirmSave(); }}
              />
              <div className="p-3 rounded-xl bg-surface-200/30 text-surface-600 text-xs font-mono mb-4">{pendingPrompt}</div>
              <div className="flex gap-3">
                <button onClick={() => setSaveModal(false)} className="btn-ghost flex-1">Cancel</button>
                <button onClick={confirmSave} disabled={!promptTitle.trim()} className="btn-primary flex-1">
                  <Save className="w-3.5 h-3.5" /> Save
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
