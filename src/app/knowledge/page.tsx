'use client';

import { motion } from 'framer-motion';
import { BookOpen, FileText, Search, Sparkles, StickyNote, Library, ArrowRight } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useAppStore } from '@/lib/store';
import { cn } from '@/lib/utils';

const KNOWLEDGE_AREAS = [
  {
    title: 'Documents',
    description: 'Bring documents into your knowledge workflow and ask AI to analyze them.',
    icon: FileText,
    color: 'text-blue-600 dark:text-blue-400',
    bg: 'bg-blue-500/10',
    prompts: ['Summarize this document', 'Extract the key findings', 'Find contradictions or missing details'],
  },
  {
    title: 'Research',
    description: 'Turn source material into structured briefs, comparisons, and evidence maps.',
    icon: Search,
    color: 'text-cyan-600 dark:text-cyan-400',
    bg: 'bg-cyan-500/10',
    prompts: ['Build a research brief', 'Compare the strongest sources', 'Identify unanswered questions'],
  },
  {
    title: 'Notes',
    description: 'Keep working notes, ideas, and decisions organized for later AI-assisted recall.',
    icon: StickyNote,
    color: 'text-amber-600 dark:text-amber-400',
    bg: 'bg-amber-500/10',
    prompts: ['Turn these notes into an outline', 'Find the main decisions', 'Convert notes into action items'],
  },
  {
    title: 'References',
    description: 'Build a reusable reference layer for projects, specifications, and recurring work.',
    icon: Library,
    color: 'text-violet-600 dark:text-violet-400',
    bg: 'bg-violet-500/10',
    prompts: ['Create a reference summary', 'Explain this reference simply', 'Compare two references'],
  },
];

export default function KnowledgePage() {
  const router = useRouter();
  const { setAIMode } = useAppStore();

  const askAI = (prompt: string) => {
    setAIMode('research');
    if (typeof window !== 'undefined') sessionStorage.setItem('arctis_prefill_prompt', prompt);
    router.push('/ai');
  };

  return (
    <div className="max-w-5xl space-y-7">
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35 }}
        className="flex items-start justify-between gap-4"
      >
        <div>
          <span className="text-surface-500 text-xs font-semibold uppercase tracking-widest">Knowledge OS</span>
          <h1 className="text-2xl font-bold text-surface-950 tracking-tight mt-1">Knowledge</h1>
          <p className="text-surface-600 text-sm mt-1 max-w-xl">
            Your source layer for documents, notes, research, and reusable references. Keep knowledge separate from prompt workspaces.
          </p>
        </div>
        <button onClick={() => router.push('/ai')} className="btn-primary flex-shrink-0 shadow-lg shadow-blue-500/20">
          <Sparkles className="w-4 h-4" /> Ask AI
        </button>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.05, duration: 0.35 }}
        className="glass-card p-5"
      >
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-xl bg-violet-500/10 flex items-center justify-center flex-shrink-0">
            <BookOpen className="w-5 h-5 text-violet-600 dark:text-violet-400" />
          </div>
          <div>
            <h2 className="text-surface-950 font-semibold">Knowledge base</h2>
            <p className="text-surface-600 text-xs mt-1 leading-relaxed">
              This area is intentionally different from Workspaces: Workspaces organize how you ask AI; Knowledge organizes what your AI work is based on.
            </p>
          </div>
        </div>
      </motion.div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {KNOWLEDGE_AREAS.map((area, index) => (
          <motion.section
            key={area.title}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.08 + index * 0.04, duration: 0.3 }}
            className="glass-card-hover p-5"
          >
            <div className="flex items-center gap-3 mb-3">
              <div className={cn('w-9 h-9 rounded-xl flex items-center justify-center', area.bg)}>
                <area.icon className={cn('w-4.5 h-4.5', area.color)} />
              </div>
              <h2 className="text-surface-950 font-semibold">{area.title}</h2>
            </div>
            <p className="text-surface-600 text-xs leading-relaxed mb-4">{area.description}</p>
            <div className="space-y-1.5">
              {area.prompts.map((prompt) => (
                <button
                  key={prompt}
                  onClick={() => askAI(prompt)}
                  className="w-full flex items-center justify-between gap-3 text-left px-3 py-2.5 rounded-lg bg-surface-200/40 hover:bg-blue-500/10 text-surface-700 hover:text-blue-600 dark:hover:text-blue-400 text-xs transition-colors"
                >
                  <span>{prompt}</span>
                  <ArrowRight className="w-3.5 h-3.5 flex-shrink-0" />
                </button>
              ))}
            </div>
          </motion.section>
        ))}
      </div>
    </div>
  );
}
