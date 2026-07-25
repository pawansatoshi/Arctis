'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { saveSession, getUserSessions } from '@/lib/firebase/sessions';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Send, Bot, User, ChevronDown, Sparkles, Mic, MicOff,
  RotateCcw, Copy, Check, Zap, BookOpen, Code2,
  Search, PenTool, TrendingUp, GraduationCap, Wrench,
  GraduationCap as TeacherIcon, FlaskConical, Baby, Cog, Paperclip, X, Image,
} from 'lucide-react';
import { useAppStore } from '@/lib/store';
import { useAccount } from 'wagmi';
import { useSpeechInput } from '@/lib/hooks/useSpeechInput';
import { useLanguagePreference } from '@/lib/hooks/useLanguagePreference';
import { cn, generateId } from '@/lib/utils';
import { AI_MODELS } from '@/lib/ai/router';
import toast from 'react-hot-toast';
import type { AIMode, AIMessage, AISession } from '@/types';

// ============================================================
// AI Workspace — Full production chat with streaming
// ============================================================

const MODE_CONFIG: Record<AIMode, { icon: React.ElementType; label: string; color: string; description: string }> = {
  study:    { icon: BookOpen,      label: 'Study',    color: 'text-emerald-400',  description: 'Learn and understand concepts deeply' },
  build:    { icon: Code2,         label: 'Build',    color: 'text-blue-400',     description: 'Write production-grade code' },
  analyze:  { icon: Search,        label: 'Analyze',  color: 'text-violet-400',   description: 'Extract insights from data & text' },
  research: { icon: Search,        label: 'Research', color: 'text-cyan-400',     description: 'Thorough research on any topic' },
  generate: { icon: PenTool,       label: 'Generate', color: 'text-amber-400',    description: 'Create content, copy, documentation' },
  treasury: { icon: TrendingUp,    label: 'Treasury', color: 'text-emerald-400',  description: 'Treasury intelligence & analysis' },
  developer:{ icon: Wrench,        label: 'Developer',color: 'text-blue-400',     description: 'Blockchain & Web3 engineering' },
  student:     { icon: GraduationCap, label: 'Student',    color: 'text-violet-400',  description: 'Patient tutoring for all subjects' },
  teacher:     { icon: TeacherIcon,   label: 'Teacher',    color: 'text-amber-400',   description: 'Lesson plans, quizzes, rubrics & curriculum' },
  professor:   { icon: FlaskConical,  label: 'Professor',  color: 'text-rose-400',    description: 'Academic writing, research & citations' },
  child:       { icon: Baby,          label: 'Child',      color: 'text-pink-400',    description: 'Safe, age-appropriate learning assistant' },
  engineering: { icon: Cog,           label: 'Engineering',color: 'text-orange-400',  description: 'Technical analysis, calcs & specifications' },
};

const MODES = Object.keys(MODE_CONFIG) as AIMode[];

function MessageBubble({ msg, isLast }: { msg: AIMessage; isLast: boolean }) {
  const [copied, setCopied] = useState(false);
  const isUser = msg.role === 'user';

  const handleCopy = () => {
    navigator.clipboard.writeText(msg.content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
      className={cn('flex gap-3 group', isUser && 'flex-row-reverse')}
    >
      {/* Avatar */}
      <div className={cn(
        'w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0 mt-0.5 border',
        isUser
          ? 'bg-blue-500/20 border-blue-500/20'
          : 'bg-gradient-to-br from-violet-500/20 to-blue-500/10 border-violet-500/20',
      )}>
        {isUser
          ? <User className="w-3.5 h-3.5 text-blue-400" />
          : <Bot className="w-3.5 h-3.5 text-violet-400" />
        }
      </div>

      <div className={cn('flex-1 max-w-[85%] sm:max-w-2xl', isUser && 'flex flex-col items-end')}>
        {/* Bubble */}
        <div className={cn(
          'rounded-2xl px-4 py-3 text-sm leading-relaxed',
          isUser
            ? 'bg-blue-500/12 border border-blue-500/20 text-surface-950'
            : 'bg-surface-200/70 border border-white/[0.07] text-surface-950',
        )}>
          <div className="whitespace-pre-wrap break-words">{msg.content}</div>
        </div>

        {/* Meta row */}
        <div className={cn(
          'flex items-center gap-2 mt-1.5 opacity-0 group-hover:opacity-100 transition-opacity duration-200',
          isUser && 'flex-row-reverse',
        )}>
          {msg.creditsUsed !== undefined && (
            <span className="text-surface-500 text-[10px] flex items-center gap-1">
              <Zap className="w-2.5 h-2.5" />{msg.creditsUsed}cr
            </span>
          )}
          {msg.model && (
            <span className="text-surface-600 text-[10px] font-mono">
              {msg.model.split('/').pop()?.split(':')[0]}
            </span>
          )}
          <button
            onClick={handleCopy}
            aria-label="Copy message"
            className="p-1 rounded-md text-surface-500 hover:text-surface-950 hover:bg-white/[0.06] transition-all"
          >
            {copied ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
          </button>
        </div>
      </div>
    </motion.div>
  );
}

export default function AIWorkspacePage() {
  const { address } = useAccount();
  const { languageInstruction } = useLanguagePreference();
  const { state: voiceState, supported: voiceSupported, toggle: toggleVoice } = useSpeechInput({
    onFinal: (text) => setInput((prev: string) => (prev ? prev + ' ' + text : text).trim()),
    onTranscript: (text: string, isFinal: boolean) => { if (!isFinal) setInput(text); },
    onError: () => {},
  });
  const { aiMode, setAIMode, aiModel, setAIModel, currentSession, setCurrentSession, updateCurrentSession, addAISession } = useAppStore();
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [streamContent, setStreamContent] = useState('');
  const [showModeSelector, setShowModeSelector] = useState(false);
  const [showModelSelector, setShowModelSelector] = useState(false);
  const [imageAttachment, setImageAttachment] = useState<{ base64: string; mimeType: string; name: string } | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const abortRef = useRef<AbortController | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleImageAttach = useCallback(async (file: File) => {
    if (!file.type.startsWith('image/')) {
      toast.error('Only image files supported');
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      toast.error('Image must be under 5MB');
      return;
    }
    const reader = new FileReader();
    reader.onload = (e) => {
      const result = e.target?.result as string;
      // result is data:image/jpeg;base64,....
      const base64 = result.split(',')[1];
      setImageAttachment({ base64, mimeType: file.type, name: file.name });
    };
    reader.readAsDataURL(file);
  }, []);

  const messages: AIMessage[] = currentSession?.messages ?? [];

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, streamContent]);

  const startNewSession = useCallback(() => {
    const session: AISession = {
      id: generateId(),
      walletAddress: address ?? 'anonymous',
      mode: aiMode,
      title: 'New conversation',
      messages: [],
      totalCredits: 0,
      model: aiModel,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    setCurrentSession(session);
    addAISession(session);
    // Persist to Firebase (non-blocking)
    if (address) { void saveSession(session); }
  }, [address, aiMode, aiModel, setCurrentSession, addAISession]);

  // Load sessions from Firebase on wallet connect
  useEffect(() => {
    if (!address) return;
    getUserSessions(address, 30)
      .then((sessions) => {
        if (sessions.length > 0) {
          sessions.forEach((s) => addAISession(s));
        }
      })
      .catch(() => {});
  }, [address]);

  useEffect(() => {
    if (!currentSession) startNewSession();
    // Pick up prefill from workspace page
    if (typeof window !== 'undefined') {
      const prefill = sessionStorage.getItem('arctis_prefill_prompt');
      if (prefill) {
        setInput(prefill);
        sessionStorage.removeItem('arctis_prefill_prompt');
        textareaRef.current?.focus();
      }
    }
  }, []);

  const handleSend = useCallback(async () => {
    const content = input.trim();
    if (!content || isLoading) return;

    if (!currentSession) startNewSession();

    const userMsg: AIMessage = {
      id: generateId(),
      role: 'user',
      content,
      timestamp: new Date().toISOString(),
      attachments: imageAttachment ? [{
        type: 'image',
        name: imageAttachment.name,
        base64: imageAttachment.base64,
        mimeType: imageAttachment.mimeType,
      }] : undefined,
    };

    setInput('');
    setImageAttachment(null);
    setIsLoading(true);
    setStreamContent('');

    updateCurrentSession({
      messages: [...(currentSession?.messages ?? []), userMsg],
      updatedAt: new Date().toISOString(),
    });

    abortRef.current = new AbortController();

    try {
      const res = await fetch('/api/ai/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: abortRef.current.signal,
        body: JSON.stringify({
          messages: [...(currentSession?.messages ?? []), userMsg].map((m) => ({
            role: m.role,
            content: m.attachments?.length
              ? [
                  { type: 'text', text: m.content },
                  ...m.attachments.filter((a) => a.type === 'image' && a.base64).map((a) => ({
                    type: 'image_url',
                    image_url: { url: `data:${a.mimeType};base64,${a.base64}` },
                  })),
                ]
              : m.content,
          })),
          model: aiModel,
          mode: aiMode,
          walletAddress: address,
          sessionId: currentSession?.id,
          stream: true,
          languageInstruction: languageInstruction || undefined,
        }),
      });

      if (!res.ok) throw new Error(`HTTP ${res.status}`);

      const reader = res.body?.getReader();
      const decoder = new TextDecoder();
      let fullContent = '';
      let creditsUsed = 0;
      let finalModel = aiModel;

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
              if (data.done) { creditsUsed = data.creditsUsed ?? 0; finalModel = data.model ?? aiModel; }
              if (data.error) throw new Error(data.error);
            } catch { /* skip */ }
          }
        }
      }

      const assistantMsg: AIMessage = {
        id: generateId(),
        role: 'assistant',
        content: fullContent,
        timestamp: new Date().toISOString(),
        model: finalModel,
        creditsUsed,
      };

      const updatedSession = {
        ...currentSession!,
        messages: [...(currentSession?.messages ?? []), userMsg, assistantMsg],
        totalCredits: (currentSession?.totalCredits ?? 0) + creditsUsed,
        updatedAt: new Date().toISOString(),
        title: currentSession?.title === 'New conversation' ? content.slice(0, 50) : (currentSession?.title ?? 'Session'),
      };

      updateCurrentSession(updatedSession);

      // Persist to Firebase (non-blocking)
      if (address && updatedSession.id) {
        void saveSession(updatedSession);
      }
    } catch (err) {
      const e = err as Error;
      if (e.name !== 'AbortError') {
        const errMsg: AIMessage = {
          id: generateId(),
          role: 'assistant',
          content: `Error: ${e.message}. Please try again.`,
          timestamp: new Date().toISOString(),
        };
        updateCurrentSession({ messages: [...(currentSession?.messages ?? []), userMsg, errMsg] });
      }
    } finally {
      setIsLoading(false);
      setStreamContent('');
      abortRef.current = null;
    }
  }, [input, isLoading, currentSession, aiModel, aiMode, address, updateCurrentSession, startNewSession]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); }
  };

  const currentMode = MODE_CONFIG[aiMode];

  return (
    <div className="flex flex-col h-[calc(100vh-3.5rem)] max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between py-4 border-b border-white/[0.06] flex-shrink-0">
        <div className="flex items-center gap-3">
          {/* Mode selector */}
          <div className="relative">
            <button
              onClick={() => { setShowModeSelector(!showModeSelector); setShowModelSelector(false); }}
              className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-surface-200/60 border border-white/[0.08] text-sm hover:bg-surface-200 transition-colors"
            >
              <currentMode.icon className={cn('w-4 h-4', currentMode.color)} />
              <span className="text-surface-950 font-medium">{currentMode.label}</span>
              <ChevronDown className="w-3 h-3 text-surface-600" />
            </button>
            <AnimatePresence>
              {showModeSelector && (
                <motion.div
                  initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -4 }}
                  className="absolute top-full mt-2 left-0 w-72 glass-card p-1.5 z-50"
                >
                  {MODES.map((m) => {
                    const cfg = MODE_CONFIG[m];
                    return (
                      <button
                        key={m}
                        onClick={() => { setAIMode(m); setShowModeSelector(false); }}
                        className={cn(
                          'w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-left transition-colors',
                          aiMode === m ? 'bg-blue-500/10' : 'hover:bg-white/[0.04]'
                        )}
                      >
                        <cfg.icon className={cn('w-4 h-4 flex-shrink-0', cfg.color)} />
                        <div>
                          <div className="text-surface-950 text-sm font-medium">{cfg.label}</div>
                          <div className="text-surface-500 text-xs">{cfg.description}</div>
                        </div>
                      </button>
                    );
                  })}
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Model selector */}
          <div className="relative">
            <button
              onClick={() => { setShowModelSelector(!showModelSelector); setShowModeSelector(false); }}
              className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-surface-200/60 border border-white/[0.08] text-sm hover:bg-surface-200 transition-colors"
            >
              <Sparkles className="w-3.5 h-3.5 text-violet-400" />
              <span className="text-surface-700 text-xs">{aiModel.split('/').pop()?.split(':')[0]}</span>
              <ChevronDown className="w-3 h-3 text-surface-600" />
            </button>
            <AnimatePresence>
              {showModelSelector && (
                <motion.div
                  initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -4 }}
                  className="absolute top-full mt-2 left-0 w-64 glass-card p-1.5 z-50"
                >
                  {AI_MODELS.map((m) => (
                    <button
                      key={m.id}
                      onClick={() => { setAIModel(m.id); setShowModelSelector(false); }}
                      className={cn(
                        'w-full flex items-center justify-between px-3 py-2 rounded-lg text-left transition-colors',
                        aiModel === m.id ? 'bg-blue-500/10' : 'hover:bg-white/[0.04]'
                      )}
                    >
                      <div>
                        <div className="text-surface-950 text-sm">{m.name}</div>
                        <div className="text-surface-500 text-xs">{m.provider}</div>
                      </div>
                      <div className="flex items-center gap-1 text-surface-500 text-xs">
                        <Zap className="w-3 h-3" />{m.creditCost}/1k
                      </div>
                    </button>
                  ))}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {currentSession && (
            <div className="text-surface-500 text-xs flex items-center gap-1">
              <Zap className="w-3 h-3" />
              {currentSession.totalCredits} credits used
            </div>
          )}
          <button
            onClick={startNewSession}
            className="btn-ghost text-xs py-1.5"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            New chat
          </button>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto py-6 space-y-6">
        {messages.length === 0 && (
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
            className="flex flex-col items-center justify-center h-full text-center px-6"
          >
            <div className={cn(
              'w-16 h-16 rounded-2xl border flex items-center justify-center mb-5 shadow-lg',
              'bg-gradient-to-br from-violet-500/20 to-blue-500/10 border-violet-500/20',
            )}>
              <currentMode.icon className={cn('w-7 h-7', currentMode.color)} />
            </div>
            <h2 className="text-surface-950 font-bold text-xl mb-1.5 tracking-tight">{currentMode.label}</h2>
            <p className="text-surface-600 text-sm max-w-xs leading-relaxed mb-8">{currentMode.description}</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-w-lg w-full">
              {[
                'Explain how USDC transfers work on Arc',
                'Write a Solidity ERC-20 transfer function',
                'How does CCTP V2 attestation work?',
                'Review this smart contract for security issues',
              ].map((prompt) => (
                <button
                  key={prompt}
                  onClick={() => { setInput(prompt); textareaRef.current?.focus(); }}
                  className="text-left px-4 py-3 rounded-xl glass-card-hover text-surface-700 text-xs hover:text-surface-950 group transition-all duration-200"
                >
                  <span className="group-hover:text-blue-400 transition-colors">{prompt}</span>
                </button>
              ))}
            </div>
          </motion.div>
        )}

        {messages.map((msg, i) => (
          <MessageBubble key={msg.id} msg={msg} isLast={i === messages.length - 1} />
        ))}

        {/* Streaming */}
        {isLoading && streamContent && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex gap-3">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-violet-500/20 to-blue-500/10 border border-violet-500/20 flex items-center justify-center flex-shrink-0 mt-0.5">
              <Bot className="w-3.5 h-3.5 text-violet-400" />
            </div>
            <div className="flex-1 max-w-[85%] sm:max-w-2xl rounded-2xl px-4 py-3 bg-surface-200/70 border border-white/[0.07] text-sm text-surface-950 whitespace-pre-wrap leading-relaxed">
              {streamContent}
              <span className="inline-block w-1.5 h-[1.1em] bg-violet-400 ml-0.5 animate-pulse rounded-sm align-text-bottom" />
            </div>
          </motion.div>
        )}

        {isLoading && !streamContent && (
          <div className="flex gap-3">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-violet-500/20 to-blue-500/10 border border-violet-500/20 flex items-center justify-center flex-shrink-0 mt-0.5">
              <Bot className="w-3.5 h-3.5 text-violet-400" />
            </div>
            <div className="flex items-center gap-2.5 px-4 py-3 rounded-2xl bg-surface-200/70 border border-white/[0.07]">
              <div className="flex gap-1">
                {[0, 1, 2].map((i) => (
                  <div key={i} className="w-1.5 h-1.5 rounded-full bg-violet-400/60 animate-bounce"
                    style={{ animationDelay: `${i * 0.15}s` }} />
                ))}
              </div>
              <span className="text-surface-600 text-sm">Thinking</span>
            </div>
          </div>
        )}

        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div className="flex-shrink-0 pb-4">
        {/* Image attachment preview */}
        {imageAttachment && (
          <motion.div
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex items-center gap-2 mb-2 px-1"
          >
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-blue-500/10 border border-blue-500/20 text-sm text-blue-400">
              <Image className="w-4 h-4" />
              <span className="max-w-[200px] truncate">{imageAttachment.name}</span>
              <button
                onClick={() => setImageAttachment(null)}
                className="ml-1 text-blue-400/60 hover:text-blue-400 transition-colors"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          </motion.div>
        )}

        {/* Hidden file input */}
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) handleImageAttach(file);
            e.target.value = '';
          }}
        />

        <div className="relative glass-card p-1">
          <textarea
            ref={textareaRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={`Ask ARCTIS ${currentMode.label} anything...`}
            rows={1}
            className="w-full bg-transparent px-4 py-3 pr-24 text-sm text-surface-950 placeholder:text-surface-600 focus:outline-none resize-none"
            style={{ maxHeight: '200px' }}
            onInput={(e) => {
              const t = e.target as HTMLTextAreaElement;
              t.style.height = 'auto';
              t.style.height = Math.min(t.scrollHeight, 200) + 'px';
            }}
            onPaste={(e) => {
              // Support paste image from clipboard
              const items = e.clipboardData?.items;
              if (!items) return;
              for (const item of Array.from(items)) {
                if (item.type.startsWith('image/')) {
                  e.preventDefault();
                  const file = item.getAsFile();
                  if (file) handleImageAttach(file);
                  break;
                }
              }
            }}
          />
          <div className="absolute right-3 bottom-3 flex items-center gap-2">
            {/* Attach image button */}
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={isLoading}
              title="Attach image"
              className="w-8 h-8 rounded-lg text-surface-500 hover:text-surface-950 hover:bg-white/[0.06] flex items-center justify-center transition-colors disabled:opacity-40"
            >
              <Paperclip className="w-3.5 h-3.5" />
            </button>
            {isLoading && (
              <button
                onClick={() => abortRef.current?.abort()}
                className="p-1.5 rounded-lg bg-rose-500/10 text-rose-400 text-xs"
              >
                Stop
              </button>
            )}
            {voiceSupported && (
              <button
                onClick={toggleVoice}
                type="button"
                className={voiceState === 'listening'
                  ? 'p-1.5 rounded-lg bg-rose-500/10 text-rose-400 animate-pulse'
                  : 'p-1.5 rounded-lg hover:bg-white/[0.06] text-surface-500 hover:text-surface-700 transition-colors'}
              >
                {voiceState === 'listening'
                  ? <MicOff className="w-3.5 h-3.5" />
                  : <Mic className="w-3.5 h-3.5" />}
              </button>
            )}
            <button
              onClick={handleSend}
              disabled={!input.trim() || isLoading}
              className="w-8 h-8 rounded-lg bg-blue-500 hover:bg-blue-400 text-white flex items-center justify-center transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <Send className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
        <div className="text-center text-surface-600 text-[10px] mt-1.5 flex items-center justify-center gap-2">
          <span>↵ Send</span>
          <span className="text-surface-700">·</span>
          <span>⇧↵ New line</span>
          <span className="text-surface-700">·</span>
          <span>📎 Images supported</span>
        </div>
      </div>
    </div>
  );
}
