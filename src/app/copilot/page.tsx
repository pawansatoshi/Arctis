'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  MessageCircle, Send, User, Sparkles, Loader2,
  Plus, History, X, Coins, Mic, MicOff, Copy, Check, RotateCcw,
} from 'lucide-react';
import { cn, generateId, formatRelative } from '@/lib/utils';
import { useAccount } from 'wagmi';
import { useSpeechInput } from '@/lib/hooks/useSpeechInput';
import { useLanguagePreference } from '@/lib/hooks/useLanguagePreference';
import { saveSession, getUserSessions } from '@/lib/api/sessions-client';
import { MarkdownContent } from '@/components/ai/MarkdownContent';
import { SkeletonList } from '@/components/ui/Skeleton';
import type { AISession } from '@/types';

// ============================================================
// ARCTIS Copilot — Phase 12: AI Copilot Expansion
// Dynamic user context injected server-side via /api/ai/copilot.
// Session persistence, history sidebar, credit tracking.
// ============================================================

const QUICK_QUESTIONS = [
  'How does ARCTIS work?',
  'How do credits work?',
  'What is a Research Agent?',
  'How do memberships work?',
  'How do swaps and bridges work?',
  'What is Arc Native USDC?',
  'How do workspaces differ from agents?',
  'How are payments verified?',
];

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
  creditsUsed?: number;
}

function CopyMessageButton({ content }: { content: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      onClick={() => { navigator.clipboard.writeText(content); setCopied(true); setTimeout(() => setCopied(false), 1500); }}
      aria-label="Copy message"
      className="p-1 rounded-md text-surface-500 hover:text-surface-950 hover:bg-black/[0.06] dark:hover:bg-white/[0.06] transition-all"
    >
      {copied ? <Check className="w-3 h-3 text-emerald-600 dark:text-emerald-400" /> : <Copy className="w-3 h-3" />}
    </button>
  );
}

export default function CopilotPage() {
  const { address } = useAccount();

  const [messages, setMessages]               = useState<Message[]>([]);
  const [input, setInput]                     = useState('');
  const [loading, setLoading]                 = useState(false);
  const [streamContent, setStreamContent]     = useState('');
  const [totalCreditsUsed, setTotalCreditsUsed] = useState(0);
  const [showHistory, setShowHistory]         = useState(false);
  const [history, setHistory]                 = useState<AISession[]>([]);
  const [historyLoading, setHistoryLoading]   = useState(false);

  const bottomRef    = useRef<HTMLDivElement>(null);
  const abortRef     = useRef<AbortController | null>(null);
  const textareaRef  = useRef<HTMLTextAreaElement>(null);
  const sessionIdRef = useRef<string>(generateId());

  const { languageInstruction } = useLanguagePreference();
  const { state: voiceState, supported: voiceSupported, toggle: toggleVoice } = useSpeechInput({
    onFinal: (text) => {
      setInput((prev: string) => (prev ? prev + ' ' + text : text).trim());
    },
    onTranscript: (text, isFinal) => {
      if (!isFinal) setInput(text);
    },
    onError: (err) => { /* silently ignore non-critical voice errors */ void err; },
  });

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, streamContent]);

  // Load history when panel opens
  useEffect(() => {
    if (!showHistory || !address) return;
    setHistoryLoading(true);
    getUserSessions(address, 20)
      .then(setHistory)
      .catch(() => {})
      .finally(() => setHistoryLoading(false));
  }, [showHistory, address]);

  // Escape stops an in-flight generation
  useEffect(() => {
    if (!loading) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') abortRef.current?.abort();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [loading]);

  const handleNewChat = useCallback(() => {
    abortRef.current?.abort();
    sessionIdRef.current = generateId();
    setMessages([]);
    setInput('');
    setTotalCreditsUsed(0);
    setStreamContent('');
    setShowHistory(false);
    textareaRef.current?.focus();
  }, []);

  const loadSession = useCallback((session: AISession) => {
    sessionIdRef.current = session.id;
    setMessages(session.messages.map((m) => ({
      id: m.id,
      role: m.role as 'user' | 'assistant',
      content: m.content,
      timestamp: m.timestamp,
      creditsUsed: m.creditsUsed,
    })));
    setTotalCreditsUsed(session.totalCredits ?? 0);
    setShowHistory(false);
  }, []);

  const runCompletion = useCallback(async (requestMessages: Message[]) => {
    setLoading(true);
    setStreamContent('');
    abortRef.current = new AbortController();
    let creditsUsed = 0;

    try {
      const res = await fetch('/api/ai/copilot', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: abortRef.current.signal,
        body: JSON.stringify({
          messages: requestMessages.map((m) => ({ role: m.role, content: m.content })),
          stream: true,
          walletAddress: address,
          sessionId: sessionIdRef.current,
          languageInstruction: languageInstruction || undefined,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error ?? 'Request failed');
      }

      const reader = res.body?.getReader();
      const decoder = new TextDecoder();
      let full = '';

      if (reader) {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          const lines = decoder.decode(value).split('\n').filter((l) => l.startsWith('data: '));
          for (const line of lines) {
            try {
              const data = JSON.parse(line.slice(6));
              if (data.chunk) { full += data.chunk; setStreamContent(full); }
              if (data.done && data.creditsUsed) { creditsUsed = data.creditsUsed; }
              if (data.error) throw new Error(data.error);
            } catch { /* skip parse errors */ }
          }
        }
      }

      const assistantMsg: Message = {
        id: generateId(), role: 'assistant',
        content: full, timestamp: new Date().toISOString(), creditsUsed,
      };

      setMessages(() => {
        const updated = [...requestMessages, assistantMsg];
        setTotalCreditsUsed((s: number) => s + creditsUsed);

        // Persist session to Firestore
        if (address && full) {
          void saveSession({
            id: sessionIdRef.current,
            walletAddress: address.toLowerCase(),
            mode: 'study',
            title: requestMessages.find((m) => m.role === 'user')?.content.slice(0, 60) ?? 'Copilot session',
            messages: updated.map((m) => ({
              id: m.id, role: m.role, content: m.content,
              timestamp: m.timestamp, creditsUsed: m.creditsUsed ?? 0,
            })),
            totalCredits: updated.reduce((s, m) => s + (m.creditsUsed ?? 0), 0),
            model: 'arctis-ai', // internal marker only — never rendered; actual backend model is chosen automatically per-request
            createdAt: updated[0]?.timestamp ?? new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          });
        }
        return updated;
      });
    } catch (err) {
      const e = err as Error;
      if (e.name !== 'AbortError') {
        setMessages((prev: Message[]) => [...prev, {
          id: generateId(), role: 'assistant' as const,
          content: `Sorry, I couldn't respond right now. ${e.message}`,
          timestamp: new Date().toISOString(),
        }]);
      }
    } finally {
      setLoading(false);
      setStreamContent('');
    }
  }, [address, languageInstruction]);

  const sendMessage = useCallback(async (content: string) => {
    if (!content.trim() || loading) return;

    const userMsg: Message = {
      id: generateId(), role: 'user',
      content, timestamp: new Date().toISOString(),
    };
    const nextMessages = [...messages, userMsg];
    setMessages(nextMessages);
    setInput('');

    await runCompletion(nextMessages);
  }, [loading, messages, runCompletion]);

  // Regenerate — reruns the last user message, replacing the last
  // assistant reply. Only offered on the most recent response.
  const handleRegenerate = useCallback(async () => {
    if (loading) return;
    const lastUserIdx = [...messages].reverse().findIndex((m) => m.role === 'user');
    if (lastUserIdx === -1) return;
    const actualIdx = messages.length - 1 - lastUserIdx;
    const truncated = messages.slice(0, actualIdx + 1);
    setMessages(truncated);
    await runCompletion(truncated);
  }, [loading, messages, runCompletion]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(input); }
  };

  return (
    <div className="max-w-3xl mx-auto flex flex-col h-[calc(100vh-3.5rem)]">

      {/* Header */}
      <div className="flex items-center gap-3 py-4 border-b border-black/[0.06] dark:border-white/[0.06] flex-shrink-0">
        <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-blue-500/20 to-violet-500/10 border border-blue-500/20 flex items-center justify-center shadow-sm">
          <MessageCircle className="w-4.5 h-4.5 text-blue-600 dark:text-blue-400" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <h1 className="text-surface-950 font-bold tracking-tight truncate">ARCTIS Copilot</h1>
            <span className="text-[10px] bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20 px-1.5 py-0.5 rounded-full font-medium flex-shrink-0">AI OS</span>
          </div>
          <p className="text-surface-600 text-xs truncate hidden xs:block">
            {address ? 'Personalised with your sessions and agents' : 'Connect wallet for personalised responses'}
          </p>
        </div>
        <div className="ml-auto flex items-center gap-1.5 flex-shrink-0">
          {totalCreditsUsed > 0 && (
            <div className="hidden sm:flex items-center gap-1 text-surface-500 text-xs">
              <Coins className="w-3 h-3" />{totalCreditsUsed} cr
            </div>
          )}
          <button onClick={() => setShowHistory((s: boolean) => !s)}
            className={cn('btn-ghost p-2', showHistory && 'bg-blue-500/10 text-blue-600 dark:text-blue-400')}>
            <History className="w-4 h-4" />
          </button>
          <button onClick={handleNewChat} className="btn-ghost p-2" title="New chat">
            <Plus className="w-4 h-4" />
          </button>
        </div>
      </div>

      <div className="flex flex-1 overflow-hidden relative">

        {/* History sidebar — overlay drawer on mobile, inline panel on desktop */}
        <AnimatePresence>
          {showHistory && (
            <>
              <motion.div
                initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                onClick={() => setShowHistory(false)}
                className="sm:hidden fixed inset-0 bg-black/40 backdrop-blur-sm z-40"
              />
              <motion.div
                initial={{ x: -280, opacity: 0 }} animate={{ x: 0, opacity: 1 }} exit={{ x: -280, opacity: 0 }}
                transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
                className="fixed sm:relative inset-y-0 left-0 sm:inset-auto w-[85vw] max-w-[280px] sm:w-60 sm:max-w-none
                           flex-shrink-0 border-r border-black/[0.06] dark:border-white/[0.06] overflow-y-auto z-50
                           bg-surface-50 sm:bg-transparent safe-bottom"
              >
                <div className="p-3 space-y-1">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-surface-600 text-xs uppercase tracking-wider font-medium">History</span>
                    <button onClick={() => setShowHistory(false)} className="btn-ghost p-1">
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                  {historyLoading ? (
                    <SkeletonList count={4} />
                  ) : history.length === 0 ? (
                    <p className="text-surface-500 text-xs text-center py-6">No sessions yet</p>
                  ) : history.map((s: AISession) => (
                    <button key={s.id} onClick={() => loadSession(s)}
                      className={cn(
                        'w-full text-left p-2.5 rounded-xl hover:bg-black/[0.06] dark:hover:bg-white/[0.06] transition-colors',
                        s.id === sessionIdRef.current && 'bg-blue-500/10'
                      )}>
                      <p className="text-surface-900 text-xs font-medium truncate">{s.title || 'Untitled'}</p>
                      <p className="text-surface-500 text-[10px] mt-0.5">
                        {formatRelative(s.updatedAt)} · {s.totalCredits ?? 0} cr
                      </p>
                    </button>
                  ))}
                </div>
              </motion.div>
            </>
          )}
        </AnimatePresence>

        {/* Chat area */}
        <div className="flex-1 flex flex-col overflow-hidden">
          <div className="flex-1 overflow-y-auto py-4 space-y-4">

            {messages.length === 0 && (
              <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
                className="py-10 text-center">
                <div className="w-12 h-12 rounded-2xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center mx-auto mb-4 shadow-sm">
                  <Sparkles className="w-6 h-6 text-blue-600 dark:text-blue-400" />
                </div>
                <h2 className="text-surface-950 font-semibold text-lg mb-1.5">How can I help?</h2>
                <p className="text-surface-500 text-sm mb-8 max-w-xs mx-auto leading-relaxed">
                  Ask about ARCTIS, your agents, transactions, or anything else
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 max-w-lg mx-auto">
                  {QUICK_QUESTIONS.map((q) => (
                    <button key={q} onClick={() => sendMessage(q)}
                      className="text-left p-3.5 rounded-xl glass-card-hover text-surface-700 text-xs leading-relaxed transition-all duration-200">
                      {q}
                    </button>
                  ))}
                </div>
              </motion.div>
            )}

            {messages.map((msg: Message, i: number) => {
              const isUser = msg.role === 'user';
              const isLastAssistant = !isUser && i === messages.length - 1;
              return (
                <motion.div key={msg.id} initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }}
                  className={cn('flex gap-3 group', isUser && 'flex-row-reverse')}>
                  <div className={cn(
                    'w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5 border shadow-sm',
                    isUser ? 'bg-blue-500/15 border-blue-500/20' : 'bg-gradient-to-br from-blue-500/15 to-violet-500/10 border-blue-500/20'
                  )}>
                    {isUser
                      ? <User className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
                      : <MessageCircle className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />}
                  </div>
                  <div className={cn('flex flex-col max-w-2xl', isUser && 'items-end')}>
                    <div className={cn(
                      'px-4 py-3 text-sm leading-relaxed shadow-sm',
                      isUser
                        ? 'bg-blue-600 text-white rounded-2xl rounded-tr-md'
                        : 'bg-surface-0 dark:bg-surface-200/70 border border-black/[0.06] dark:border-white/[0.06] text-surface-950 rounded-2xl rounded-tl-md'
                    )}>
                      {isUser ? <div className="whitespace-pre-wrap break-words">{msg.content}</div> : <MarkdownContent content={msg.content} />}
                      {msg.creditsUsed !== undefined && msg.creditsUsed > 0 && (
                        <p className={cn('text-[10px] mt-2 flex items-center gap-1', isUser ? 'text-blue-100' : 'text-surface-500')}>
                          <Coins className="w-2.5 h-2.5" />{msg.creditsUsed} credits
                        </p>
                      )}
                    </div>
                    <div className="flex items-center gap-1 mt-1 px-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      {isLastAssistant && (
                        <button onClick={handleRegenerate} title="Regenerate response"
                          className="p-1 rounded-md text-surface-500 hover:text-surface-950 hover:bg-black/[0.06] dark:hover:bg-white/[0.06] transition-all">
                          <RotateCcw className="w-3 h-3" />
                        </button>
                      )}
                      <CopyMessageButton content={msg.content} />
                    </div>
                  </div>
                </motion.div>
              );
            })}

            {loading && streamContent && (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex gap-3">
                <div className="w-7 h-7 rounded-full bg-gradient-to-br from-blue-500/15 to-violet-500/10 border border-blue-500/20 flex items-center justify-center flex-shrink-0 mt-0.5 shadow-sm">
                  <MessageCircle className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
                </div>
                <div className="max-w-2xl bg-surface-0 dark:bg-surface-200/70 border border-black/[0.06] dark:border-white/[0.06] rounded-2xl rounded-tl-md px-4 py-3 text-sm text-surface-950 leading-relaxed shadow-sm">
                  <MarkdownContent content={streamContent} />
                  <span className="inline-block w-1.5 h-4 bg-blue-500 ml-0.5 animate-pulse rounded-sm" />
                </div>
              </motion.div>
            )}

            {loading && !streamContent && (
              <motion.div initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} className="flex gap-3">
                <div className="w-7 h-7 rounded-full bg-gradient-to-br from-blue-500/15 to-violet-500/10 border border-blue-500/20 flex items-center justify-center flex-shrink-0 mt-0.5 shadow-sm">
                  <MessageCircle className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
                </div>
                <div className="flex items-center gap-2.5 px-4 py-3 rounded-2xl rounded-tl-md bg-surface-0 dark:bg-surface-200/70 border border-black/[0.06] dark:border-white/[0.06] shadow-sm">
                  <div className="flex gap-1">
                    {[0, 1, 2].map((i) => (
                      <div key={i} className="w-1.5 h-1.5 rounded-full bg-blue-500/70 animate-bounce" style={{ animationDelay: `${i * 0.15}s` }} />
                    ))}
                  </div>
                  <span className="text-surface-600 text-sm">Thinking</span>
                </div>
              </motion.div>
            )}

            <div ref={bottomRef} />
          </div>

          {/* Input */}
          <div className="flex-shrink-0 pb-4 safe-bottom">
            <div className="relative glass-card p-1 transition-shadow duration-200 focus-within:shadow-card-hover focus-within:border-blue-500/30">
              <textarea
                ref={textareaRef}
                value={input}
                onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Ask the Copilot…"
                rows={1}
                disabled={loading}
                className="w-full bg-transparent text-surface-950 placeholder-surface-500 text-sm px-3 py-2.5 resize-none outline-none min-h-[44px] max-h-36"
                style={{ height: 'auto' }}
                onInput={(e: React.FormEvent<HTMLTextAreaElement>) => {
                  const t = e.target as HTMLTextAreaElement;
                  t.style.height = 'auto';
                  t.style.height = `${t.scrollHeight}px`;
                }}
              />
              <div className="flex items-center justify-between px-2 pb-1.5">
                <span className="text-surface-500 text-xs">Enter to send · Shift+Enter for new line</span>
                <div className="flex items-center gap-2">
                  {voiceSupported && (
                    <button onClick={toggleVoice} type="button"
                      className={cn(
                        'transition-colors',
                        voiceState === 'listening'
                          ? 'text-rose-600 dark:text-rose-400 animate-pulse'
                          : 'text-surface-500 hover:text-surface-700'
                      )}>
                      {voiceState === 'listening'
                        ? <MicOff className="w-4 h-4" />
                        : <Mic className="w-4 h-4" />}
                    </button>
                  )}
                  {loading && (
                    <button onClick={() => abortRef.current?.abort()}
                      className="text-surface-500 hover:text-rose-600 dark:hover:text-rose-400 transition-colors">
                      <X className="w-4 h-4" />
                    </button>
                  )}
                  <button onClick={() => sendMessage(input)}
                    disabled={!input.trim() || loading}
                    className="btn-primary px-3 py-1.5 text-sm disabled:opacity-40">
                    <Send className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
