'use client';

import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { AnimatePresence, motion } from 'framer-motion';
import {
  Search, LayoutDashboard, History, Bot, MessageCircle, Zap,
  FolderOpen, BookOpen, ArrowUpRight, ArrowLeftRight, GitMerge,
  Building2, Shield, Coins, Settings, Heart, CornerDownLeft,
} from 'lucide-react';
import { useAppStore } from '@/lib/store';

// ARCTIS Command Palette — mirrors the primary product information architecture.

interface PaletteAction {
  id: string;
  label: string;
  section: string;
  href: string;
  icon: React.ElementType;
  keywords?: string;
}

const ACTIONS: PaletteAction[] = [
  { id: 'dashboard', label: 'Dashboard', section: 'Overview', href: '/dashboard', icon: LayoutDashboard },
  { id: 'history', label: 'History', section: 'Overview', href: '/history', icon: History },
  { id: 'ai', label: 'AI Workspace', section: 'AI OS', href: '/ai', icon: Bot, keywords: 'research chat study analyze generate' },
  { id: 'copilot', label: 'Copilot', section: 'AI OS', href: '/copilot', icon: MessageCircle, keywords: 'help support context' },
  { id: 'agents', label: 'Agents', section: 'AI OS', href: '/agents', icon: Zap, keywords: 'economic agent create new agent' },
  { id: 'workspace', label: 'Workspace', section: 'Knowledge OS', href: '/workspace', icon: FolderOpen, keywords: 'prompts documents' },
  { id: 'knowledge', label: 'Knowledge', section: 'Knowledge OS', href: '/knowledge', icon: BookOpen },
  { id: 'transfer', label: 'Transfer', section: 'DeFi OS', href: '/transfer', icon: ArrowUpRight, keywords: 'send usdc' },
  { id: 'swap', label: 'Swap', section: 'DeFi OS', href: '/swap', icon: ArrowLeftRight, keywords: 'exchange tarc tusdc otc' },
  { id: 'bridge', label: 'Bridge', section: 'DeFi OS', href: '/bridge', icon: GitMerge, keywords: 'cctp cross chain circle app kit' },
  { id: 'treasury', label: 'Treasury', section: 'Finance', href: '/treasury', icon: Building2 },
  { id: 'membership', label: 'Membership', section: 'Finance', href: '/membership', icon: Shield, keywords: 'plan tier entitlement' },
  { id: 'credits', label: 'Credits', section: 'Finance', href: '/credits', icon: Coins, keywords: 'buy purchase package' },
  { id: 'settings', label: 'Settings', section: 'Platform', href: '/settings', icon: Settings },
  { id: 'feedback', label: 'Feedback', section: 'Platform', href: '/feedback', icon: Heart },
];

export default function CommandPalette() {
  const router = useRouter();
  const { commandPaletteOpen: open, setCommandPaletteOpen: setOpen } = useAppStore();
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  const filtered = useMemo(() => {
    if (!query.trim()) return ACTIONS;
    const q = query.toLowerCase();
    return ACTIONS.filter((a) =>
      a.label.toLowerCase().includes(q) ||
      a.section.toLowerCase().includes(q) ||
      a.keywords?.toLowerCase().includes(q)
    );
  }, [query]);

  const close = useCallback(() => {
    setOpen(false);
    setQuery('');
    setSelected(0);
  }, [setOpen]);

  const navigate = useCallback((href: string) => {
    router.push(href);
    close();
  }, [router, close]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setOpen(!open);
      }
      if (e.key === 'Escape') close();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [close, open, setOpen]);

  useEffect(() => {
    if (open) setTimeout(() => inputRef.current?.focus(), 10);
  }, [open]);

  useEffect(() => { setSelected(0); }, [query]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') { e.preventDefault(); setSelected((s) => Math.min(s + 1, filtered.length - 1)); }
    if (e.key === 'ArrowUp') { e.preventDefault(); setSelected((s) => Math.max(s - 1, 0)); }
    if (e.key === 'Enter' && filtered[selected]) { e.preventDefault(); navigate(filtered[selected].href); }
  };

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={close} className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[100]" />
          <motion.div initial={{ opacity: 0, y: -12, scale: 0.98 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: -12, scale: 0.98 }} transition={{ duration: 0.15, ease: [0.22, 1, 0.36, 1] }} className="fixed top-[15vh] left-1/2 -translate-x-1/2 w-[92vw] max-w-lg z-[101]">
            <div className="glass-card overflow-hidden shadow-2xl border border-black/[0.1] dark:border-white/[0.1]">
              <div className="flex items-center gap-3 px-4 py-3.5 border-b border-black/[0.06] dark:border-white/[0.06]">
                <Search className="w-4 h-4 text-surface-500 flex-shrink-0" />
                <input ref={inputRef} value={query} onChange={(e) => setQuery(e.target.value)} onKeyDown={handleKeyDown} placeholder="Search ARCTIS — jump to any page…" aria-label="Search ARCTIS" className="flex-1 bg-transparent outline-none text-surface-950 text-sm placeholder:text-surface-500" />
                <kbd className="text-[10px] text-surface-500 border border-black/[0.08] dark:border-white/[0.08] rounded px-1.5 py-0.5">ESC</kbd>
              </div>
              <div className="max-h-[50vh] overflow-y-auto py-1.5">
                {filtered.length === 0 && <div className="px-4 py-8 text-center text-surface-500 text-sm">No matching ARCTIS destination</div>}
                {filtered.map((action, i) => (
                  <button key={action.id} type="button" onClick={() => navigate(action.href)} onMouseEnter={() => setSelected(i)} className={`w-full flex items-center gap-3 px-4 py-2.5 text-left transition-colors ${i === selected ? 'bg-blue-500/10' : 'hover:bg-black/[0.03] dark:hover:bg-white/[0.03]'}`}>
                    <div className={`w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 ${i === selected ? 'bg-blue-500/20' : 'bg-surface-300/40'}`}>
                      <action.icon className={`w-3.5 h-3.5 ${i === selected ? 'text-blue-600 dark:text-blue-400' : 'text-surface-600'}`} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-surface-950 text-sm font-medium">{action.label}</div>
                      <div className="text-surface-500 text-xs">{action.section}</div>
                    </div>
                    {i === selected && <CornerDownLeft className="w-3.5 h-3.5 text-surface-500 flex-shrink-0" />}
                  </button>
                ))}
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
