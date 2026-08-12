'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { ArrowRight, Bot, FolderOpen, ArrowLeftRight, GitMerge, X } from 'lucide-react';
import { useAccount } from 'wagmi';

const STEPS = [
  { label: 'Meet Copilot', href: '/copilot', icon: Bot, text: 'Ask questions and understand ARCTIS.' },
  { label: 'Choose a Workspace', href: '/workspace', icon: FolderOpen, text: 'Pick a domain and start from a template.' },
  { label: 'Move USDC', href: '/transfer', icon: ArrowLeftRight, text: 'Transfer, swap, or bridge on Arc.' },
  { label: 'Use an Agent', href: '/agents', icon: GitMerge, text: 'Automate with a human approval gate.' },
] as const;

export default function AppOrientation() {
  const { isConnected } = useAccount();
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (!isConnected) return;
    try {
      setVisible(localStorage.getItem('arctis-orientation-seen') !== '1');
    } catch {
      setVisible(true);
    }
  }, [isConnected]);

  const dismiss = () => {
    setVisible(false);
    try { localStorage.setItem('arctis-orientation-seen', '1'); } catch {}
  };

  if (!visible) return null;

  return (
    <section className="mb-6 rounded-2xl border border-blue-500/15 bg-blue-500/[0.035] dark:bg-blue-500/[0.06] p-4 sm:p-5" aria-label="ARCTIS quick start">
      <div className="flex items-start justify-between gap-4 mb-4">
        <div>
          <div className="text-surface-950 font-semibold text-sm">New to ARCTIS? Start here</div>
          <p className="text-surface-600 text-xs mt-1">Four simple entry points — then use the operating system however you need.</p>
        </div>
        <button type="button" onClick={dismiss} aria-label="Dismiss quick start" className="p-1.5 rounded-lg text-surface-500 hover:text-surface-950 hover:bg-black/[0.05] dark:hover:bg-white/[0.06]">
          <X className="w-4 h-4" />
        </button>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2">
        {STEPS.map((step, index) => (
          <Link key={step.href} href={step.href} className="group flex items-start gap-3 rounded-xl bg-surface-0/70 dark:bg-surface-100/40 border border-black/[0.05] dark:border-white/[0.06] p-3 hover:border-blue-500/25 hover:bg-surface-0 dark:hover:bg-surface-100/60 transition-all">
            <div className="w-7 h-7 rounded-lg bg-blue-500/10 text-blue-600 dark:text-blue-400 flex items-center justify-center flex-shrink-0">
              <step.icon className="w-3.5 h-3.5" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-1 text-xs font-semibold text-surface-950">
                <span className="text-surface-500">{index + 1}.</span>{step.label}
                <ArrowRight className="w-3 h-3 text-surface-400 group-hover:translate-x-0.5 transition-transform" />
              </div>
              <div className="text-[10px] text-surface-600 leading-relaxed mt-0.5">{step.text}</div>
            </div>
          </Link>
        ))}
      </div>
    </section>
  );
}
