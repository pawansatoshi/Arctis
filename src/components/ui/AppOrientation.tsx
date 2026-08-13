'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { ArrowRight, Bot, FolderOpen, ArrowLeftRight, GitMerge, X, Info, Volume2, VolumeX, Play } from 'lucide-react';
import { useAccount } from 'wagmi';
import { usePathname } from 'next/navigation';
import { useChainSwitch } from '@/lib/hooks/useChainSwitch';

const STEPS = [
  { label: 'Meet Copilot', href: '/copilot', icon: Bot, text: 'Ask questions and understand ARCTIS.' },
  { label: 'Choose a Workspace', href: '/workspace', icon: FolderOpen, text: 'Pick a domain and start from a template.' },
  { label: 'Move USDC', href: '/transfer', icon: ArrowLeftRight, text: 'Transfer, swap, or bridge on Arc.' },
  { label: 'Use an Agent', href: '/agents', icon: GitMerge, text: 'Automate with a human approval gate.' },
] as const;

const HELP: Record<string, { title: string; text: string }> = {
  '/dashboard': { title: 'Dashboard', text: 'Your ARCTIS home. See balances, activity, pending agent proposals, and your main actions.' },
  '/ai': { title: 'AI Workspace', text: 'Choose a mode, ask a question, attach supported images, or prepare a financial action. Financial actions still require wallet approval.' },
  '/copilot': { title: 'Copilot', text: 'Use Copilot for guided ARCTIS tasks. When a financial action is prepared, review it before signing in your wallet.' },
  '/workspace': { title: 'Workspace', text: 'Choose a work domain and start from templates. Your prompts are sent to the AI workspace for the selected mode.' },
  '/knowledge': { title: 'Knowledge', text: 'Organize documents, notes, research, and references. Use Ask AI to turn your knowledge into an explainable AI session.' },
  '/agents': { title: 'Agents', text: 'Agents can prepare economic actions, but wallet authorization remains with you. Review proposals before execution.' },
  '/transfer': { title: 'Transfer', text: 'Send USDC on Arc Testnet. Confirm the recipient and amount, then approve the transaction in your wallet.' },
  '/swap': { title: 'Swap', text: 'Choose the tokens, enter an amount, review the live quote and fees, then approve the swap in your wallet.' },
  '/bridge': { title: 'Bridge', text: 'Move supported USDC between configured test networks. Review source, destination, fees and the Circle route before approval.' },
  '/treasury': { title: 'Treasury', text: 'Review treasury balances and activity. Financial actions remain subject to wallet authorization and configured controls.' },
  '/history': { title: 'History', text: 'Search and filter your ARCTIS activity. Transaction records are informational; use the explorer link to independently verify on-chain state.' },
};

const AI_PATHS = ['/ai', '/copilot', '/workspace', '/knowledge', '/agents'];
const SUCCESS_PHRASES = [
  'Transfer Confirmed',
  'Transfer confirmed',
  'Circle Swap complete',
  'Swap complete',
  'Bridge Submitted',
  'successfully bridged',
  'successfully swapped',
  'sent successfully',
];

function matchesPath(pathname: string, base: string) {
  return pathname === base || pathname.startsWith(`${base}/`);
}

function speak(text: string) {
  if (typeof window === 'undefined' || !('speechSynthesis' in window)) return false;
  window.speechSynthesis.cancel();
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.rate = 0.96;
  utterance.pitch = 1;
  window.speechSynthesis.speak(utterance);
  return true;
}

export default function AppOrientation() {
  const pathname = usePathname();
  const { isConnected } = useAccount();
  const { isCorrectChain, switchToArc, isSwitching } = useChainSwitch();
  const [visible, setVisible] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);
  const [voiceEnabled, setVoiceEnabled] = useState(false);
  const [voiceSupported, setVoiceSupported] = useState(false);
  const [voiceHint, setVoiceHint] = useState('Voice confirmations are off until you enable them.');
  const seenSuccessRef = useRef(new Set<string>());

  const help = useMemo(() => {
    const key = Object.keys(HELP).find((candidate) => matchesPath(pathname, candidate));
    return key ? HELP[key] : { title: 'ARCTIS', text: 'Use the information button for a short explanation of the current page. Financial actions always require your wallet authorization.' };
  }, [pathname]);

  useEffect(() => {
    if (!isConnected) return;
    try {
      setVisible(localStorage.getItem('arctis-orientation-seen') !== '1');
      setVoiceEnabled(localStorage.getItem('arctis-voice-confirmations') === '1');
    } catch {
      setVisible(true);
    }
    setVoiceSupported(typeof window !== 'undefined' && 'speechSynthesis' in window && 'SpeechSynthesisUtterance' in window);
  }, [isConnected]);

  // AI surfaces should use the Arc network automatically when a wallet is connected.
  // This uses the existing wallet chain-switch capability; no new API or RPC is introduced.
  useEffect(() => {
    if (!isConnected || isCorrectChain || isSwitching) return;
    const isAISurface = AI_PATHS.some((path) => matchesPath(pathname, path));
    if (!isAISurface) return;
    void switchToArc();
  }, [isConnected, isCorrectChain, isSwitching, pathname, switchToArc]);

  // Browser-native voice confirmations. We deliberately require a user gesture
  // to enable voice because mobile browsers may block unsolicited speech.
  useEffect(() => {
    if (!voiceEnabled || !voiceSupported) return;
    const scan = () => {
      const bodyText = document.body.innerText;
      for (const phrase of SUCCESS_PHRASES) {
        if (!bodyText.includes(phrase)) continue;
        const key = `${location.pathname}:${phrase}:${bodyText.slice(Math.max(0, bodyText.indexOf(phrase) - 80), bodyText.indexOf(phrase) + 180)}`;
        if (seenSuccessRef.current.has(key)) continue;
        seenSuccessRef.current.add(key);
        speak(phrase.replace('Submitted', 'submitted successfully'));
        break;
      }
      if (seenSuccessRef.current.size > 40) seenSuccessRef.current.clear();
    };
    const observer = new MutationObserver(scan);
    observer.observe(document.body, { subtree: true, childList: true, characterData: true });
    scan();
    return () => observer.disconnect();
  }, [voiceEnabled, voiceSupported, pathname]);

  const dismiss = () => {
    setVisible(false);
    try { localStorage.setItem('arctis-orientation-seen', '1'); } catch {}
  };

  const toggleVoice = () => {
    if (!voiceSupported) {
      setVoiceHint('Voice is not supported by this browser.');
      return;
    }
    const next = !voiceEnabled;
    setVoiceEnabled(next);
    try { localStorage.setItem('arctis-voice-confirmations', next ? '1' : '0'); } catch {}
    if (next) {
      const ok = speak('Voice confirmations enabled. ARCTIS will announce supported transaction confirmations.');
      setVoiceHint(ok ? 'Enabled. Keep this on for transaction confirmations.' : 'Enabled, but the browser blocked speech.');
    } else {
      window.speechSynthesis.cancel();
      setVoiceHint('Voice confirmations are off.');
    }
  };

  return (
    <>
      {visible && (
        <section className="mb-6 rounded-2xl border border-blue-500/15 bg-blue-500/[0.035] dark:bg-blue-500/[0.06] p-4 sm:p-5" aria-label="ARCTIS quick start">
          <div className="flex items-start justify-between gap-4 mb-4">
            <div>
              <div className="text-surface-950 font-semibold text-sm">New to ARCTIS? Start here</div>
              <p className="text-surface-600 text-xs mt-1">Four simple entry points — then use the operating system however you need.</p>
            </div>
            <button type="button" onClick={dismiss} aria-label="Dismiss quick start" className="p-1.5 rounded-lg text-surface-500 hover:text-surface-950 hover:bg-black/[0.05] dark:hover:bg-white/[0.06]"><X className="w-4 h-4" /></button>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2">
            {STEPS.map((step, index) => (
              <Link key={step.href} href={step.href} className="group flex items-start gap-3 rounded-xl bg-surface-0/70 dark:bg-surface-100/40 border border-black/[0.05] dark:border-white/[0.06] p-3 hover:border-blue-500/25 hover:bg-surface-0 dark:hover:bg-surface-100/60 transition-all">
                <div className="w-7 h-7 rounded-lg bg-blue-500/10 text-blue-600 dark:text-blue-400 flex items-center justify-center flex-shrink-0"><step.icon className="w-3.5 h-3.5" /></div>
                <div className="min-w-0">
                  <div className="flex items-center gap-1 text-xs font-semibold text-surface-950"><span className="text-surface-500">{index + 1}.</span>{step.label}<ArrowRight className="w-3 h-3 text-surface-400 group-hover:translate-x-0.5 transition-transform" /></div>
                  <div className="text-[10px] text-surface-600 leading-relaxed mt-0.5">{step.text}</div>
                </div>
              </Link>
            ))}
          </div>
        </section>
      )}

      <div className="fixed bottom-4 right-4 z-[70] flex flex-col items-end gap-2">
        {helpOpen && (
          <div className="w-[min(22rem,calc(100vw-2rem))] rounded-2xl border border-black/[0.08] dark:border-white/[0.08] bg-white/95 dark:bg-surface-100/95 backdrop-blur-xl shadow-2xl p-4">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-2"><div className="w-8 h-8 rounded-xl bg-blue-500/10 text-blue-600 flex items-center justify-center"><Info className="w-4 h-4" /></div><div><div className="text-sm font-semibold text-surface-950">{help.title}</div><div className="text-[10px] text-surface-500">Quick guide</div></div></div>
              <button onClick={() => setHelpOpen(false)} className="p-1.5 text-surface-500" aria-label="Close guide"><X className="w-4 h-4" /></button>
            </div>
            <p className="text-xs leading-relaxed text-surface-700 dark:text-surface-300 mt-3">{help.text}</p>
            <div className="mt-4 flex flex-wrap gap-2">
              <button onClick={() => speak(help.text)} disabled={!voiceSupported} className="btn-ghost text-xs gap-1.5"><Play className="w-3 h-3" /> Listen</button>
              <button onClick={toggleVoice} disabled={!voiceSupported} className="btn-ghost text-xs gap-1.5"><span className="inline-flex items-center gap-1">{voiceEnabled ? <Volume2 className="w-3 h-3" /> : <VolumeX className="w-3 h-3" />} Voice confirmations {voiceEnabled ? 'On' : 'Off'}</span></button>
            </div>
            <div className="text-[10px] text-surface-500 mt-2">{voiceHint}</div>
            {isConnected && !isCorrectChain && AI_PATHS.some((path) => matchesPath(pathname, path)) && <div className="mt-3 rounded-lg bg-amber-500/10 border border-amber-500/20 p-2 text-[10px] text-amber-700 dark:text-amber-300">Wrong network detected. ARCTIS will switch to Arc automatically.</div>}
          </div>
        )}
        <button onClick={() => setHelpOpen((v) => !v)} aria-label="Open ARCTIS page guide" title="Page guide" className="w-11 h-11 rounded-full bg-surface-950 text-white shadow-xl flex items-center justify-center border border-white/10 hover:scale-105 transition-transform"><Info className="w-5 h-5" /></button>
      </div>
    </>
  );
}
