'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { MarkdownContent } from '@/components/ai/MarkdownContent';
import { saveSession, getUserSessions } from '@/lib/api/sessions-client';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Send, Bot, User, ChevronDown, Sparkles, Mic, MicOff,
  RotateCcw, Copy, Check, Zap, BookOpen, Code2,
  Search, PenTool, TrendingUp, GraduationCap, Wrench,
  GraduationCap as TeacherIcon, FlaskConical, Baby, Cog, Paperclip, X, Image,
  ShieldCheck, History,
} from 'lucide-react';
import { useAppStore } from '@/lib/store';
import { useAccount } from 'wagmi';
import { useSpeechInput } from '@/lib/hooks/useSpeechInput';
import { useLanguagePreference } from '@/lib/hooks/useLanguagePreference';
import { cn, generateId } from '@/lib/utils';
import toast from 'react-hot-toast';
import type { AIMode, AIMessage, AISession } from '@/types';
import type { PendingFinancialAction } from '@/lib/store';

// ============================================================
// AI Workspace — domain-aware production chat
// ============================================================

type ModeConfig = {
  icon: React.ElementType;
  label: string;
  color: string;
  description: string;
  suggestions: string[];
};

const MODE_CONFIG: Record<AIMode, ModeConfig> = {
  study: {
    icon: BookOpen, label: 'Study', color: 'text-emerald-600 dark:text-emerald-400',
    description: 'Learn and understand concepts deeply',
    suggestions: [
      'Explain {concept} step by step with simple examples',
      'Create a focused study plan for {subject}',
      'Turn these notes into 10 quiz questions',
      'Compare {A} and {B} and show the key differences',
    ],
  },
  build: {
    icon: Code2, label: 'Build', color: 'text-blue-600 dark:text-blue-400',
    description: 'Build software with practical engineering guidance',
    suggestions: [
      'Design the implementation for {feature}',
      'Refactor this code for clarity and maintainability',
      'Write unit tests for this function: {code}',
      'Explain this error and give the safest fix: {error}',
    ],
  },
  analyze: {
    icon: Search, label: 'Analyze', color: 'text-violet-600 dark:text-violet-400',
    description: 'Extract insights, patterns, risks, and decisions',
    suggestions: [
      'Analyze this data and identify the strongest patterns',
      'Find the root causes behind these results: {data}',
      'Compare these two options across the important dimensions',
      'Review this information and flag risks or inconsistencies',
    ],
  },
  research: {
    icon: Search, label: 'Research', color: 'text-cyan-600 dark:text-cyan-400',
    description: 'Turn sources and questions into structured research',
    suggestions: [
      'Create a research brief on {topic}',
      'Compare the strongest arguments for and against {topic}',
      'Extract the key findings from this source: {text}',
      'Identify evidence gaps and unanswered questions about {topic}',
    ],
  },
  generate: {
    icon: PenTool, label: 'Generate', color: 'text-amber-600 dark:text-amber-400',
    description: 'Create clear content, documentation, and communication',
    suggestions: [
      'Write a clear announcement for {topic}',
      'Turn these notes into polished documentation',
      'Create three versions of this explanation for different audiences',
      'Rewrite this draft to be concise and professional',
    ],
  },
  treasury: {
    icon: TrendingUp, label: 'Treasury', color: 'text-emerald-600 dark:text-emerald-400',
    description: 'Treasury intelligence, allocation, and operational analysis',
    suggestions: [
      'Analyze this treasury position and identify concentration risks',
      'Create a cash-flow forecast from these assumptions',
      'Review these transactions for unusual patterns',
      'Build a treasury risk checklist for this scenario',
    ],
  },
  developer: {
    icon: Wrench, label: 'Developer', color: 'text-blue-600 dark:text-blue-400',
    description: 'Web3 engineering, smart contracts, React, and architecture',
    suggestions: [
      'Write a TypeScript function to {task} with strong typing',
      'Audit this Solidity contract for security issues: {code}',
      'Design a clean Next.js architecture for {feature}',
      'Debug this TypeScript or React error and explain the root cause',
    ],
  },
  student: {
    icon: GraduationCap, label: 'Student', color: 'text-violet-600 dark:text-violet-400',
    description: 'Patient tutoring for school and independent learning',
    suggestions: [
      'Explain {topic} like a patient tutor with examples',
      'Help me solve this problem without skipping steps: {problem}',
      'Quiz me on {subject} one question at a time',
      'Create revision notes for {chapter}',
    ],
  },
  teacher: {
    icon: TeacherIcon, label: 'Teacher', color: 'text-amber-600 dark:text-amber-400',
    description: 'Lesson plans, quizzes, rubrics, and curriculum support',
    suggestions: [
      'Create a lesson plan for {topic} and {grade}',
      'Generate 10 assessment questions with an answer key',
      'Create a grading rubric for {assignment}',
      'Design a classroom activity that teaches {concept}',
    ],
  },
  professor: {
    icon: FlaskConical, label: 'Professor', color: 'text-rose-600 dark:text-rose-400',
    description: 'Academic writing, research design, and critical review',
    suggestions: [
      'Structure a literature review on {topic}',
      'Critique the methodology in this research abstract',
      'Turn these findings into a rigorous academic argument',
      'Identify limitations and future research directions',
    ],
  },
  child: {
    icon: Baby, label: 'Kids', color: 'text-pink-600 dark:text-pink-400',
    description: 'Safe, age-appropriate learning and creativity',
    suggestions: [
      'Explain {topic} as a fun story for kids',
      'Make a simple five-question quiz about {topic}',
      'Teach me {subject} with a fun activity',
      'Tell an educational story about {topic}',
    ],
  },
  engineering: {
    icon: Cog, label: 'Engineering', color: 'text-orange-600 dark:text-orange-400',
    description: 'Technical analysis, calculations, diagnostics, and specifications',
    suggestions: [
      'Analyze this system and identify likely failure points',
      'Calculate {value} from these engineering parameters',
      'Write technical specifications for {component}',
      'Create a diagnostic checklist for {system}',
    ],
  },
};

const MODES = Object.keys(MODE_CONFIG) as AIMode[];

const ACTION_ROUTE: Record<'transfer' | 'swap' | 'bridge', string> = {
  transfer: '/transfer', swap: '/swap', bridge: '/bridge',
};
const ACTION_LABEL: Record<'transfer' | 'swap' | 'bridge', string> = {
  transfer: 'Transfer', swap: 'Swap', bridge: 'Bridge',
};

function ActionProposalCard({ proposal }: { proposal: NonNullable<AIMessage['actionProposal']> }) {
  const router = useRouter();
  const setPendingAction = useAppStore((s) => s.setPendingAction);
  const [dismissed, setDismissed] = useState(false);

  if (dismissed) return null;

  const handleConfirm = () => {
    setPendingAction(proposal);
    router.push(ACTION_ROUTE[proposal.action]);
  };

  return (
    <div className="mt-3 rounded-xl border border-amber-500/25 bg-amber-500/[0.07] dark:bg-amber-500/[0.08] p-4 space-y-3">
      <div className="flex items-center gap-2">
        <div className="w-6 h-6 rounded-lg bg-amber-500/15 flex items-center justify-center flex-shrink-0">
          <ShieldCheck className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
        </div>
        <span className="text-amber-700 dark:text-amber-400 text-xs font-semibold uppercase tracking-wide">Confirmation required</span>
      </div>
      <div className="space-y-1.5 text-sm bg-surface-0/60 dark:bg-black/10 rounded-lg p-3">
        <div className="flex justify-between"><span className="text-surface-600">Action</span><span className="text-surface-950 font-medium">{ACTION_LABEL[proposal.action]}</span></div>
        <div className="flex justify-between"><span className="text-surface-600">Amount</span><span className="text-surface-950 font-mono">{proposal.amount} {proposal.fromToken}</span></div>
        {proposal.toToken && <div className="flex justify-between"><span className="text-surface-600">To</span><span className="text-surface-950 font-mono">{proposal.toToken}</span></div>}
        {proposal.recipient && <div className="flex justify-between"><span className="text-surface-600">Recipient</span><span className="text-surface-950 font-mono text-xs">{proposal.recipient.slice(0, 8)}…{proposal.recipient.slice(-6)}</span></div>}
      </div>
      <p className="text-surface-600 text-xs leading-relaxed">
        Nothing happens yet. Confirming takes you to the {ACTION_LABEL[proposal.action]} page, pre-filled — you still sign with your own wallet there.
      </p>
      <div className="flex gap-2 pt-0.5">
        <button onClick={handleConfirm} className="btn-primary text-xs px-3 py-2 flex-1">Confirm & Continue</button>
        <button onClick={() => setDismissed(true)} className="btn-ghost text-xs px-3 py-2">Dismiss</button>
      </div>
    </div>
  );
}

function MessageBubble({ msg, isLast, onRegenerate }: { msg: AIMessage; isLast: boolean; onRegenerate?: () => void }) {
  const [copied, setCopied] = useState(false);
  const isUser = msg.role === 'user';

  const handleCopy = () => {
    navigator.clipboard.writeText(msg.content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }} className={cn('flex gap-3 group', isUser && 'flex-row-reverse')}>
      <div className={cn(
        'w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5 border shadow-sm',
        isUser ? 'bg-blue-500/15 border-blue-500/20' : 'bg-gradient-to-br from-violet-500/15 to-blue-500/10 border-violet-500/20',
      )}>
        {isUser ? <User className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" /> : <Bot className="w-3.5 h-3.5 text-violet-600 dark:text-violet-400" />}
      </div>
      <div className={cn('flex-1 max-w-[85%] sm:max-w-2xl', isUser && 'flex flex-col items-end')}>
        <div className={cn(
          'px-4 py-3 text-sm leading-relaxed shadow-sm',
          isUser ? 'bg-blue-600 text-white rounded-2xl rounded-tr-md' : 'bg-surface-0 border border-black/[0.06] dark:border-white/[0.07] dark:bg-surface-200/70 text-surface-950 rounded-2xl rounded-tl-md',
        )}>
          <div className="whitespace-pre-wrap break-words">{isUser ? msg.content : <MarkdownContent content={msg.content} />}</div>
          {msg.actionProposal && <ActionProposalCard proposal={msg.actionProposal} />}
        </div>
        <div className={cn('flex items-center gap-2 mt-1.5 opacity-0 group-hover:opacity-100 transition-opacity duration-200', isUser && 'flex-row-reverse')}>
          {msg.creditsUsed !== undefined && <span className="text-surface-500 text-[10px] flex items-center gap-1"><Zap className="w-2.5 h-2.5" />{msg.creditsUsed}cr</span>}
          {!isUser && isLast && onRegenerate && (
            <button onClick={onRegenerate} aria-label="Regenerate response" className="p-1 rounded-md text-surface-500 hover:text-surface-950 hover:bg-black/[0.06] dark:hover:bg-white/[0.06] transition-all"><RotateCcw className="w-3 h-3" /></button>
          )}
          <button onClick={handleCopy} aria-label="Copy message" className="p-1 rounded-md text-surface-500 hover:text-surface-950 hover:bg-black/[0.06] dark:hover:bg-white/[0.06] transition-all">
            {copied ? <Check className="w-3 h-3 text-emerald-600 dark:text-emerald-400" /> : <Copy className="w-3 h-3" />}
          </button>
        </div>
      </div>
    </motion.div>
  );
}

export default function AIWorkspacePage() {
  const router = useRouter();
  const { address } = useAccount();
  const { languageInstruction } = useLanguagePreference();
  const { state: voiceState, supported: voiceSupported, toggle: toggleVoice } = useSpeechInput({
    onFinal: (text) => setInput((prev: string) => (prev ? prev + ' ' + text : text).trim()),
    onTranscript: (text: string, isFinal: boolean) => { if (!isFinal) setInput(text); },
    onError: () => {},
  });
  const { aiMode, setAIMode, currentSession, setCurrentSession, updateCurrentSession, addAISession, aiSessions } = useAppStore();
  const [input, setInput] = useState('');
  const [pendingClarification, setPendingClarification] = useState<PendingFinancialAction | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [streamContent, setStreamContent] = useState('');
  const [showModeSelector, setShowModeSelector] = useState(false);
  const [showHistoryPanel, setShowHistoryPanel] = useState(false);
  const [imageAttachment, setImageAttachment] = useState<{ base64: string; mimeType: string; name: string } | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const abortRef = useRef<AbortController | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleImageAttach = useCallback(async (file: File) => {
    if (!file.type.startsWith('image/')) { toast.error('Only image files supported'); return; }
    if (file.size > 5 * 1024 * 1024) { toast.error('Image must be under 5MB'); return; }
    const reader = new FileReader();
    reader.onload = (e) => {
      const result = e.target?.result as string;
      const base64 = result.split(',')[1];
      setImageAttachment({ base64, mimeType: file.type, name: file.name });
    };
    reader.readAsDataURL(file);
  }, []);

  const messages: AIMessage[] = currentSession?.messages ?? [];

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages, streamContent]);

  const startNewSession = useCallback(() => {
    setPendingClarification(null);
    const session: AISession = {
      id: generateId(), walletAddress: address ?? 'anonymous', mode: aiMode,
      title: 'New conversation', messages: [], totalCredits: 0, model: 'arctis-ai',
      createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
    };
    setCurrentSession(session);
    addAISession(session);
    if (address) void saveSession(session);
  }, [address, aiMode, setCurrentSession, addAISession]);

  const handleModeChange = useCallback((mode: AIMode) => {
    if (mode === aiMode) { setShowModeSelector(false); return; }
    setAIMode(mode);
    setShowModeSelector(false);
    setPendingClarification(null);
    setInput('');
    const session: AISession = {
      id: generateId(), walletAddress: address ?? 'anonymous', mode,
      title: 'New conversation', messages: [], totalCredits: 0, model: 'arctis-ai',
      createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
    };
    setCurrentSession(session);
    addAISession(session);
    if (address) void saveSession(session);
  }, [aiMode, setAIMode, address, setCurrentSession, addAISession]);

  useEffect(() => {
    if (!address) return;
    getUserSessions(address, 30).then((sessions) => {
      sessions.forEach((s) => addAISession(s));
    }).catch(() => {});
  }, [address, addAISession]);

  useEffect(() => {
    if (!currentSession) startNewSession();
    if (typeof window !== 'undefined') {
      const prefill = sessionStorage.getItem('arctis_prefill_prompt');
      if (prefill) {
        setInput(prefill);
        sessionStorage.removeItem('arctis_prefill_prompt');
        textareaRef.current?.focus();
      }
    }
  }, []);

  useEffect(() => {
    if (!isLoading) return;
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') abortRef.current?.abort(); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [isLoading]);

  const runCompletion = useCallback(async (
    historyBefore: AIMessage[], userMsg: AIMessage, pendingOverride?: PendingFinancialAction | null,
  ) => {
    abortRef.current = new AbortController();
    const pendingToSend = pendingOverride !== undefined ? pendingOverride : pendingClarification;
    try {
      const res = await fetch('/api/ai/chat', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, signal: abortRef.current.signal,
        body: JSON.stringify({
          pendingAction: pendingToSend ?? undefined,
          messages: [...historyBefore, userMsg].map((m) => ({
            role: m.role,
            content: m.attachments?.length
              ? [{ type: 'text', text: m.content }, ...m.attachments.filter((a) => a.type === 'image' && a.base64).map((a) => ({ type: 'image_url', image_url: { url: `data:${a.mimeType};base64,${a.base64}` } }))]
              : m.content,
          })),
          mode: aiMode, walletAddress: address, sessionId: currentSession?.id,
          stream: true, languageInstruction: languageInstruction || undefined,
        }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const reader = res.body?.getReader();
      const decoder = new TextDecoder();
      let fullContent = '';
      let creditsUsed = 0;
      let actionProposal: AIMessage['actionProposal'];
      let clarification: AIMessage['clarification'];
      let streamError: string | null = null;
      if (reader) {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          const text = decoder.decode(value);
          const lines = text.split('\n').filter((l) => l.startsWith('data: '));
          for (const line of lines) {
            try {
              const data = JSON.parse(line.slice(6));
              if (data.chunk) { fullContent += data.chunk; setStreamContent(fullContent); }
              if (data.actionProposal) actionProposal = data.actionProposal;
              if (data.clarification) clarification = data.clarification;
              if (data.done) creditsUsed = data.creditsUsed ?? 0;
              if (data.error) streamError = data.error;
            } catch { /* ignore malformed SSE chunks */ }
          }
        }
      }
      if (streamError) throw new Error(streamError);
      setPendingClarification(clarification ?? null);
      const assistantMsg: AIMessage = {
        id: generateId(), role: 'assistant', content: fullContent, timestamp: new Date().toISOString(),
        creditsUsed, actionProposal, clarification,
      };
      const updatedSession = {
        ...currentSession!, messages: [...historyBefore, userMsg, assistantMsg],
        totalCredits: (currentSession?.totalCredits ?? 0) + creditsUsed,
        updatedAt: new Date().toISOString(),
        title: currentSession?.title === 'New conversation' ? userMsg.content.slice(0, 50) : (currentSession?.title ?? 'Session'),
      };
      updateCurrentSession(updatedSession);
      if (address && updatedSession.id) void saveSession(updatedSession);
    } catch (err) {
      const e = err as Error;
      if (e.name !== 'AbortError') {
        updateCurrentSession({ messages: [...historyBefore, userMsg, { id: generateId(), role: 'assistant', content: `Error: ${e.message}. Please try again.`, timestamp: new Date().toISOString() }] });
      }
    } finally {
      setIsLoading(false); setStreamContent(''); abortRef.current = null;
    }
  }, [currentSession, aiMode, address, updateCurrentSession, languageInstruction, pendingClarification]);

  const handleSend = useCallback(async () => {
    const content = input.trim();
    if (!content || isLoading) return;
    if (!currentSession) startNewSession();
    const userMsg: AIMessage = {
      id: generateId(), role: 'user', content, timestamp: new Date().toISOString(),
      attachments: imageAttachment ? [{ type: 'image', name: imageAttachment.name, base64: imageAttachment.base64, mimeType: imageAttachment.mimeType }] : undefined,
    };
    setInput(''); setImageAttachment(null); setIsLoading(true); setStreamContent('');
    const historyBefore = currentSession?.messages ?? [];
    updateCurrentSession({ messages: [...historyBefore, userMsg], updatedAt: new Date().toISOString() });
    await runCompletion(historyBefore, userMsg);
  }, [input, isLoading, currentSession, imageAttachment, startNewSession, updateCurrentSession, runCompletion]);

  const handleRegenerate = useCallback(async () => {
    if (isLoading || !currentSession) return;
    const msgs = currentSession.messages;
    const lastUserIdx = [...msgs].reverse().findIndex((m) => m.role === 'user');
    if (lastUserIdx === -1) return;
    const actualIdx = msgs.length - 1 - lastUserIdx;
    const lastUserMsg = msgs[actualIdx];
    const historyBefore = msgs.slice(0, actualIdx);
    setIsLoading(true); setStreamContent(''); updateCurrentSession({ messages: [...historyBefore, lastUserMsg] });
    await runCompletion(historyBefore, lastUserMsg);
  }, [isLoading, currentSession, updateCurrentSession, runCompletion]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); void handleSend(); }
  };

  const currentMode = MODE_CONFIG[aiMode];

  return (
    <div className="flex flex-col h-[calc(100vh-3.5rem)] max-w-5xl mx-auto">
      <div className="flex items-center justify-between gap-2 py-4 border-b border-black/[0.06] dark:border-white/[0.06] flex-shrink-0">
        <div className="flex items-center gap-2 min-w-0">
          <div className="relative flex-shrink-0">
            <button onClick={() => setShowModeSelector(!showModeSelector)} className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-surface-200/60 border border-black/[0.08] dark:border-white/[0.08] text-sm hover:bg-surface-200 transition-all">
              <currentMode.icon className={cn('w-4 h-4 flex-shrink-0', currentMode.color)} />
              <span className="text-surface-950 font-medium hidden xs:inline">{currentMode.label}</span>
              <ChevronDown className={cn('w-3 h-3 text-surface-600 transition-transform', showModeSelector && 'rotate-180')} />
            </button>
            <AnimatePresence>
              {showModeSelector && (
                <motion.div initial={{ opacity: 0, y: -6, scale: 0.98 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: -6, scale: 0.98 }} className="absolute top-full mt-2 left-0 w-72 glass-card p-1.5 z-50 max-h-[70vh] overflow-y-auto">
                  {MODES.map((m) => {
                    const cfg = MODE_CONFIG[m];
                    return (
                      <button key={m} onClick={() => handleModeChange(m)} className={cn('w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-left transition-colors', aiMode === m ? 'bg-blue-500/10' : 'hover:bg-black/[0.04] dark:hover:bg-white/[0.04]')}>
                        <cfg.icon className={cn('w-4 h-4 flex-shrink-0', cfg.color)} />
                        <div className="min-w-0"><div className="text-surface-950 text-sm font-medium">{cfg.label}</div><div className="text-surface-500 text-xs truncate">{cfg.description}</div></div>
                      </button>
                    );
                  })}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
          <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-lg bg-surface-200/60 border border-black/[0.08] dark:border-white/[0.08] text-sm flex-shrink-0">
            <Sparkles className="w-3.5 h-3.5 text-violet-600 dark:text-violet-400" />
            <span className="text-surface-700 text-xs font-medium">ARCTIS AI</span>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-shrink-0">
          {currentSession && currentSession.totalCredits > 0 && <div className="hidden sm:flex text-surface-500 text-xs items-center gap-1"><Zap className="w-3 h-3" />{currentSession.totalCredits} credits</div>}
          <div className="relative">
            <button onClick={() => setShowHistoryPanel(!showHistoryPanel)} aria-label="Conversation history" className="btn-ghost text-xs py-1.5"><History className="w-3.5 h-3.5" /><span className="hidden xs:inline">History</span></button>
            <AnimatePresence>
              {showHistoryPanel && (
                <>
                  <div className="fixed inset-0 z-40" onClick={() => setShowHistoryPanel(false)} />
                  <motion.div initial={{ opacity: 0, y: -6, scale: 0.98 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: -6, scale: 0.98 }} className="absolute top-full mt-2 right-0 w-72 glass-card p-1.5 z-50 max-h-[60vh] overflow-y-auto">
                    {aiSessions.length === 0 && <div className="px-3 py-6 text-center text-surface-500 text-xs">No past conversations yet</div>}
                    {aiSessions.map((s) => (
                      <button key={s.id} onClick={() => { setAIMode(s.mode); setCurrentSession(s); setShowHistoryPanel(false); }} className={cn('w-full flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-left transition-colors', currentSession?.id === s.id ? 'bg-blue-500/10' : 'hover:bg-black/[0.04] dark:hover:bg-white/[0.04]')}>
                        {MODE_CONFIG[s.mode] && <div className="w-6 h-6 rounded-md flex items-center justify-center flex-shrink-0 bg-surface-200/60">{(() => { const Icon = MODE_CONFIG[s.mode].icon; return <Icon className={cn('w-3 h-3', MODE_CONFIG[s.mode].color)} />; })()}</div>}
                        <div className="min-w-0 flex-1"><div className="text-surface-950 text-xs font-medium truncate">{s.title || 'New conversation'}</div><div className="text-surface-500 text-[10px]">{MODE_CONFIG[s.mode]?.label ?? 'AI'} · {s.messages.length} messages</div></div>
                      </button>
                    ))}
                  </motion.div>
                </>
              )}
            </AnimatePresence>
          </div>
          <button onClick={startNewSession} className="btn-ghost text-xs py-1.5"><RotateCcw className="w-3.5 h-3.5" /><span className="hidden xs:inline">New chat</span></button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto py-8 space-y-7 scroll-smooth">
        {messages.length === 0 && (
          <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }} className="flex flex-col items-center justify-center h-full text-center px-6">
            <div className="w-16 h-16 rounded-2xl border flex items-center justify-center mb-5 shadow-md bg-gradient-to-br from-violet-500/15 to-blue-500/10 border-violet-500/20">
              <currentMode.icon className={cn('w-7 h-7', currentMode.color)} />
            </div>
            <h2 className="text-surface-950 font-semibold text-2xl mb-2 tracking-tight">{currentMode.label}</h2>
            <p className="text-surface-600 text-sm max-w-xs leading-relaxed mb-7">{currentMode.description}</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 max-w-lg w-full">
              {currentMode.suggestions.map((prompt) => (
                <button key={prompt} onClick={() => { setInput(prompt); textareaRef.current?.focus(); }} className="text-left px-4 py-3.5 rounded-xl glass-card-hover text-surface-700 text-xs leading-relaxed hover:text-surface-950 group transition-all duration-200">
                  <span className="group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">{prompt}</span>
                </button>
              ))}
            </div>
          </motion.div>
        )}

        {messages.map((msg, i) => <MessageBubble key={msg.id} msg={msg} isLast={i === messages.length - 1} onRegenerate={!isLoading ? handleRegenerate : undefined} />)}

        {isLoading && streamContent && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex gap-3">
            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-violet-500/15 to-blue-500/10 border border-violet-500/20 flex items-center justify-center flex-shrink-0 mt-0.5 shadow-sm"><Bot className="w-3.5 h-3.5 text-violet-600 dark:text-violet-400" /></div>
            <div className="flex-1 max-w-[85%] sm:max-w-2xl rounded-2xl rounded-tl-md px-4 py-3 bg-surface-0 dark:bg-surface-200/70 border border-black/[0.06] dark:border-white/[0.07] text-sm text-surface-950 leading-relaxed shadow-sm"><MarkdownContent content={streamContent} /><span className="inline-block w-1.5 h-[1.1em] bg-violet-500 ml-0.5 animate-pulse rounded-sm align-text-bottom" /></div>
          </motion.div>
        )}

        {isLoading && !streamContent && (
          <motion.div initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} className="flex gap-3">
            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-violet-500/15 to-blue-500/10 border border-violet-500/20 flex items-center justify-center flex-shrink-0 mt-0.5 shadow-sm"><Bot className="w-3.5 h-3.5 text-violet-600 dark:text-violet-400" /></div>
            <div className="flex items-center gap-2.5 px-4 py-3 rounded-2xl rounded-tl-md bg-surface-0 dark:bg-surface-200/70 border border-black/[0.06] dark:border-white/[0.07] shadow-sm"><div className="flex gap-1">{[0, 1, 2].map((i) => <div key={i} className="w-1.5 h-1.5 rounded-full bg-violet-500/70 animate-bounce" style={{ animationDelay: `${i * 0.15}s` }} />)}</div><span className="text-surface-600 text-sm">ARCTIS is thinking</span></div>
          </motion.div>
        )}
        <div ref={bottomRef} />
      </div>

      <div className="flex-shrink-0 pb-4 safe-bottom">
        {imageAttachment && (
          <motion.div initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} className="flex items-center gap-2 mb-2 px-1">
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-blue-500/10 border border-blue-500/20 text-sm text-blue-600 dark:text-blue-400">
              <Image className="w-4 h-4" /><span className="max-w-[200px] truncate">{imageAttachment.name}</span>
              <button onClick={() => setImageAttachment(null)} className="ml-1 text-blue-600 dark:text-blue-400/60 hover:text-blue-800 dark:hover:text-blue-400 transition-colors"><X className="w-3.5 h-3.5" /></button>
            </div>
          </motion.div>
        )}
        <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={(e) => { const file = e.target.files?.[0]; if (file) void handleImageAttach(file); e.target.value = ''; }} />
        <div className="relative glass-card p-1 transition-shadow duration-200 focus-within:shadow-card-hover focus-within:border-blue-500/30">
          <textarea
            ref={textareaRef} value={input} onChange={(e) => setInput(e.target.value)} onKeyDown={handleKeyDown}
            placeholder={`Ask ARCTIS ${currentMode.label} anything...`} rows={1}
            className="w-full bg-transparent px-4 py-3 pr-24 text-sm text-surface-950 placeholder:text-surface-600 focus:outline-none resize-none"
            style={{ maxHeight: '200px' }}
            onInput={(e) => { const t = e.target as HTMLTextAreaElement; t.style.height = 'auto'; t.style.height = Math.min(t.scrollHeight, 200) + 'px'; }}
            onPaste={(e) => { const items = e.clipboardData?.items; if (!items) return; for (const item of Array.from(items)) { if (item.type.startsWith('image/')) { e.preventDefault(); const file = item.getAsFile(); if (file) void handleImageAttach(file); break; } } }}
          />
          <div className="absolute right-3 bottom-3 flex items-center gap-2">
            <button onClick={() => fileInputRef.current?.click()} disabled={isLoading} title="Attach image" className="w-8 h-8 rounded-lg text-surface-500 hover:text-surface-950 hover:bg-black/[0.06] dark:hover:bg-white/[0.06] flex items-center justify-center transition-colors disabled:opacity-40"><Paperclip className="w-3.5 h-3.5" /></button>
            {isLoading && <button onClick={() => abortRef.current?.abort()} className="p-1.5 rounded-lg bg-rose-500/10 text-rose-600 dark:text-rose-400 text-xs">Stop</button>}
            {voiceSupported && <button onClick={toggleVoice} type="button" className={voiceState === 'listening' ? 'p-1.5 rounded-lg bg-rose-500/10 text-rose-600 dark:text-rose-400 animate-pulse' : 'p-1.5 rounded-lg hover:bg-black/[0.06] dark:hover:bg-white/[0.06] text-surface-500 hover:text-surface-700 transition-colors'}>{voiceState === 'listening' ? <MicOff className="w-3.5 h-3.5" /> : <Mic className="w-3.5 h-3.5" />}</button>}
            <button onClick={() => void handleSend()} disabled={!input.trim() || isLoading} className="w-9 h-9 rounded-xl bg-blue-600 hover:bg-blue-700 text-white flex items-center justify-center transition-all disabled:opacity-40 disabled:cursor-not-allowed shadow-sm hover:shadow active:scale-95"><Send className="w-3.5 h-3.5" /></button>
          </div>
        </div>
        <div className="text-center text-surface-600 text-[10px] mt-1.5 flex items-center justify-center gap-2"><span>↵ Send</span><span className="text-surface-700">·</span><span>⇧↵ New line</span><span className="text-surface-700">·</span><span>📎 Images supported</span></div>
      </div>
    </div>
  );
}
