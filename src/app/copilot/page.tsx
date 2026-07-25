'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  MessageCircle, Send, Bot, User, Sparkles, Loader2,
  Plus, History, X, Coins, Mic, MicOff,
} from 'lucide-react';
import { cn, generateId, formatRelative } from '@/lib/utils';
import { useAccount } from 'wagmi';
import { useSpeechInput } from '@/lib/hooks/useSpeechInput';
import { useLanguagePreference } from '@/lib/hooks/useLanguagePreference';
import { saveSession, getUserSessions } from '@/lib/firebase/sessions';
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

  const sendMessage = useCallback(async (content: string) => {
    if (!content.trim() || loading) return;

    const userMsg: Message = {
      id: generateId(), role: 'user',
      content, timestamp: new Date().toISOString(),
    };
    const nextMessages = [...messages, userMsg];
    setMessages(nextMessages);
    setInput('');
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
          messages: nextMessages.map((m) => ({ role: m.role, content: m.content })),
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

      setMessages((prev: Message[]) => {
        const updated = [...prev, assistantMsg];
        setTotalCreditsUsed((s: number) => s + creditsUsed);

        // Persist session to Firestore
        if (address && full) {
          void saveSession({
            id: sessionIdRef.current,
            walletAddress: address.toLowerCase(),
            mode: 'study',
            title: nextMessages.find((m) => m.role === 'user')?.content.slice(0, 60) ?? 'Copilot session',
            messages: updated.map((m) => ({
              id: m.id, role: m.role, content: m.content,
              timestamp: m.timestamp, creditsUsed: m.creditsUsed ?? 0,
            })),
            totalCredits: updated.reduce((s, m) => s + (m.creditsUsed ?? 0), 0),
            model: 'moonshot/kimi-k1-5-32k',
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
          content: e.message.includes('credits')
            ? 'You need more credits to use the Copilot. Top up in the Credits section.'
            : `Sorry, I couldn't respond right now. ${e.message}`,
          timestamp: new Date().toISOString(),
        }]);
      }
    } finally {
      setLoading(false);
      setStreamContent('');
    }
  }, [loading, messages, address]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(input); }
  };

  return (
    <div className="max-w-3xl mx-auto flex flex-col h-[calc(100vh-3.5rem)]">

      {/* Header */}
      <div className="flex items-center gap-3 py-4 border-b border-white/[0.06] flex-shrink-0">
        <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-blue-500/20 to-violet-500/10 border border-blue-500/20 flex items-center justify-center shadow-sm">
          <MessageCircle className="w-4.5 h-4.5 text-blue-400" />
        </div>
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-surface-950 font-bold tracking-tight">ARCTIS Copilot</h1>
            <span className="text-[10px] bg-blue-500/10 text-blue-400 border border-blue-500/20 px-1.5 py-0.5 rounded-full font-medium">AI OS</span>
          </div>
          <p className="text-surface-600 text-xs">
            {address ? 'Personalised with your sessions and agents' : 'Connect wallet for personalised responses'}
          </p>
        </div>
        <div className="ml-auto flex items-center gap-2">
          {totalCreditsUsed > 0 && (
            <div className="flex items-center gap-1 text-surface-500 text-xs">
              <Coins className="w-3 h-3" />{totalCreditsUsed} cr
            </div>
          )}
          <button onClick={() => setShowHistory((s: boolean) => !s)}
            className={cn('btn-ghost p-2', showHistory && 'bg-white/[0.08]')}>
            <History className="w-4 h-4" />
          </button>
          <button onClick={handleNewChat} className="btn-ghost p-2" title="New chat">
            <Plus className="w-4 h-4" />
          </button>
        </div>
      </div>

      <div className="flex flex-1 overflow-hidden">

        {/* History sidebar */}
        <AnimatePresence>
          {showHistory && (
            <motion.div initial={{ width: 0, opacity: 0 }} animate={{ width: 240, opacity: 1 }}
              exit={{ width: 0, opacity: 0 }} transition={{ duration: 0.2 }}
              className="flex-shrink-0 border-r border-white/[0.06] overflow-y-auto">
              <div className="p-3 space-y-1">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-surface-600 text-xs uppercase tracking-wider">History</span>
                  <button onClick={() => setShowHistory(false)} className="btn-ghost p-1">
                    <X className="w-3 h-3" />
                  </button>
                </div>
                {historyLoading ? (
                  <div className="flex justify-center py-4">
                    <Loader2 className="w-4 h-4 text-surface-500 animate-spin" />
                  </div>
                ) : history.length === 0 ? (
                  <p className="text-surface-500 text-xs text-center py-4">No sessions yet</p>
                ) : history.map((s: AISession) => (
                  <button key={s.id} onClick={() => loadSession(s)}
                    className={cn(
                      'w-full text-left p-2.5 rounded-xl hover:bg-white/[0.06] transition-colors',
                      s.id === sessionIdRef.current && 'bg-white/[0.06]'
                    )}>
                    <p className="text-surface-900 text-xs font-medium truncate">{s.title || 'Untitled'}</p>
                    <p className="text-surface-500 text-[10px] mt-0.5">
                      {formatRelative(s.updatedAt)} · {s.totalCredits ?? 0} cr
                    </p>
                  </button>
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Chat area */}
        <div className="flex-1 flex flex-col overflow-hidden">
          <div className="flex-1 overflow-y-auto py-4 space-y-4">

            {messages.length === 0 && (
              <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
                className="py-8 text-center space-y-6">
                <div className="space-y-1">
                  <div className="w-12 h-12 rounded-2xl bg-blue-500/10 flex items-center justify-center mx-auto">
                    <Sparkles className="w-6 h-6 text-blue-400" />
                  </div>
                  <h2 className="text-surface-950 font-semibold">How can I help?</h2>
                  <p className="text-surface-500 text-sm">
                    Ask about ARCTIS, your agents, transactions, or anything else
                  </p>
                </div>
                <div className="grid grid-cols-2 gap-2 max-w-lg mx-auto">
                  {QUICK_QUESTIONS.map((q) => (
                    <button key={q} onClick={() => sendMessage(q)}
                      className="text-left p-3 rounded-xl glass-card hover:bg-white/[0.07] transition-colors text-surface-700 text-xs">
                      {q}
                    </button>
                  ))}
                </div>
              </motion.div>
            )}

            {messages.map((msg: Message) => (
              <motion.div key={msg.id} initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }}
                className={cn('flex gap-3', msg.role === 'user' && 'flex-row-reverse')}>
                <div className={cn(
                  'w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 mt-1',
                  msg.role === 'user' ? 'bg-blue-500/20' : 'bg-surface-300'
                )}>
                  {msg.role === 'user'
                    ? <User className="w-3.5 h-3.5 text-blue-400" />
                    : <Bot className="w-3.5 h-3.5 text-surface-600" />}
                </div>
                <div className={cn(
                  'max-w-2xl rounded-2xl px-4 py-3 text-sm leading-relaxed whitespace-pre-wrap',
                  msg.role === 'user'
                    ? 'bg-blue-500/10 border border-blue-500/20 text-surface-950'
                    : 'bg-surface-200/60 border border-white/[0.06] text-surface-950'
                )}>
                  {msg.content}
                  {msg.creditsUsed && msg.creditsUsed > 0 && (
                    <p className="text-surface-500 text-[10px] mt-2 flex items-center gap-1">
                      <Coins className="w-2.5 h-2.5" />{msg.creditsUsed} credits
                    </p>
                  )}
                </div>
              </motion.div>
            ))}

            {loading && streamContent && (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex gap-3">
                <div className="w-7 h-7 rounded-full bg-surface-300 flex items-center justify-center flex-shrink-0 mt-1">
                  <Bot className="w-3.5 h-3.5 text-surface-600" />
                </div>
                <div className="max-w-2xl bg-surface-200/60 border border-white/[0.06] rounded-2xl px-4 py-3 text-sm text-surface-950 whitespace-pre-wrap leading-relaxed">
                  {streamContent}
                  <span className="inline-block w-1.5 h-4 bg-blue-400 ml-0.5 animate-pulse rounded-sm" />
                </div>
              </motion.div>
            )}

            {loading && !streamContent && (
              <div className="flex gap-3">
                <div className="w-7 h-7 rounded-full bg-surface-300 flex items-center justify-center flex-shrink-0 mt-1">
                  <Bot className="w-3.5 h-3.5 text-surface-600" />
                </div>
                <div className="flex items-center gap-2 text-surface-600 text-sm px-4 py-3">
                  <Loader2 className="w-4 h-4 animate-spin" />Thinking…
                </div>
              </div>
            )}

            <div ref={bottomRef} />
          </div>

          {/* Input */}
          <div className="flex-shrink-0 pb-4">
            <div className="relative glass-card p-1">
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
                          ? 'text-rose-400 animate-pulse'
                          : 'text-surface-500 hover:text-surface-700'
                      )}>
                      {voiceState === 'listening'
                        ? <MicOff className="w-4 h-4" />
                        : <Mic className="w-4 h-4" />}
                    </button>
                  )}
                  {loading && (
                    <button onClick={() => abortRef.current?.abort()}
                      className="text-surface-500 hover:text-rose-400 transition-colors">
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
