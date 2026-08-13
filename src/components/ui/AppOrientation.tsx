'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { ArrowRight, Bot, FolderOpen, ArrowLeftRight, GitMerge, X, Info, Volume2, VolumeX, Play, CheckCircle2, AlertTriangle, Loader2 } from 'lucide-react';
import { useAccount, useSwitchChain } from 'wagmi';
import { usePathname } from 'next/navigation';
import { useChainSwitch } from '@/lib/hooks/useChainSwitch';
import { isValidAddress } from '@/lib/utils';

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
const TX_PATHS = ['/transfer', '/swap', '/bridge'];
const BRIDGE_CHAINS: Record<string, number> = {
  'Arc Testnet': 5042002,
  'Ethereum Sepolia': 11155111,
  'Base Sepolia': 84532,
  'Arbitrum Sepolia': 421614,
};
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

function describeRecipient(value: string): { state: 'valid' | 'invalid' | 'foreign' | 'empty'; text: string } {
  const valueTrimmed = value.trim();
  if (!valueTrimmed) return { state: 'empty', text: '' };
  if (isValidAddress(valueTrimmed)) return { state: 'valid', text: '✓ Valid Arc/EVM recipient address' };
  if (/^0x/i.test(valueTrimmed)) return { state: 'invalid', text: 'Invalid EVM wallet address. Use a 0x-prefixed 40-hex-character address.' };
  if (/^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(valueTrimmed)) return { state: 'foreign', text: 'This looks like a non-EVM wallet address (for example Solana). Use an Arc/EVM address.' };
  if (/^[a-z0-9_-]{3,20}(\.arc)?$/i.test(valueTrimmed)) return { state: 'invalid', text: 'Checking the ARCTIS Passport…' };
  return { state: 'invalid', text: 'Unsupported recipient format. Use an Arc/EVM address or an available .arc Passport.' };
}

export default function AppOrientation() {
  const pathname = usePathname();
  const { isConnected } = useAccount();
  const { switchChainAsync, isPending: isChainSwitching } = useSwitchChain();
  const { isCorrectChain, switchToArc, isSwitching } = useChainSwitch();
  const [visible, setVisible] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);
  const [voiceEnabled, setVoiceEnabled] = useState(false);
  const [voiceSupported, setVoiceSupported] = useState(false);
  const [voiceHint, setVoiceHint] = useState('Voice confirmations are off until you enable them.');
  const [bridgeTarget, setBridgeTarget] = useState<{ name: string; chainId: number } | null>(null);
  const [bridgeSwitchError, setBridgeSwitchError] = useState<string | null>(null);
  const [txModal, setTxModal] = useState<{ kind: 'success' | 'pending' | 'failed'; title: string; message: string } | null>(null);
  const [recipientStatus, setRecipientStatus] = useState<{ input: HTMLInputElement; text: string; state: 'valid' | 'invalid' | 'foreign' } | null>(null);
  const seenStateRef = useRef(new Set<string>());
  const seenRecipientLookupRef = useRef('');
  const lastBridgeTargetRef = useRef<string | null>(null);

  const help = useMemo(() => {
    const key = Object.keys(HELP).find((candidate) => matchesPath(pathname, candidate));
    return key ? HELP[key] : { title: 'ARCTIS', text: 'Use the information button for a short explanation of the current page. Financial actions always require your wallet authorization.' };
  }, [pathname]);

  useEffect(() => {
    document.body.classList.remove('arctis-page-knowledge');
    if (pathname === '/knowledge') document.body.classList.add('arctis-page-knowledge');
    return () => document.body.classList.remove('arctis-page-knowledge');
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
  useEffect(() => {
    if (!isConnected || isCorrectChain || isSwitching) return;
    const isAISurface = AI_PATHS.some((path) => matchesPath(pathname, path));
    if (!isAISurface) return;
    void switchToArc();
  }, [isConnected, isCorrectChain, isSwitching, pathname, switchToArc]);

  // Bridge source-chain guard: use the existing configured wagmi chains and prompt
  // the wallet to switch to the selected source chain automatically.
  useEffect(() => {
    if (!isConnected || pathname !== '/bridge' || typeof document === 'undefined') return;
    const scan = () => {
      const bodyText = document.body.innerText;
      const match = bodyText.match(/Switch to (Arc Testnet|Ethereum Sepolia|Base Sepolia|Arbitrum Sepolia) to get a live Circle quote and execute/i);
      if (!match) {
        setBridgeTarget(null);
        setBridgeSwitchError(null);
        return;
      }
      const name = match[1];
      const chainId = BRIDGE_CHAINS[name];
      setBridgeTarget({ name, chainId });
      if (lastBridgeTargetRef.current === `${name}:${chainId}`) return;
      lastBridgeTargetRef.current = `${name}:${chainId}`;
      void switchChainAsync({ chainId }).then(() => {
        setBridgeSwitchError(null);
        speak(`Switching your wallet to ${name}. Please approve the network change in your wallet.`);
      }).catch((error) => {
        setBridgeSwitchError(error instanceof Error ? error.message : 'Wallet network switch was not completed.');
        speak(`Your wallet is on the wrong network. Please switch to ${name} to continue.`);
      });
    };
    const observer = new MutationObserver(scan);
    observer.observe(document.body, { subtree: true, childList: true, characterData: true });
    scan();
    return () => observer.disconnect();
  }, [isConnected, pathname, switchChainAsync]);

  // Recipient guard for Transfer manual + Economic Agent inputs. It reuses the
  // existing Passport resolver; no new backend is introduced.
  useEffect(() => {
    if (pathname !== '/transfer' || typeof document === 'undefined') return;
    const decorate = async (input: HTMLInputElement) => {
      const parent = input.parentElement;
      if (!parent || input.type === 'number' || input.placeholder === 'Payment note...') return;
      const value = input.value.trim();
      const base = describeRecipient(value);
      if (base.state === 'empty') {
        input.style.removeProperty('border-color');
        const existing = parent.querySelector('[data-arctis-recipient-status]');
        existing?.remove();
        return;
      }
      if (/^[a-z0-9_-]{3,20}(\.arc)?$/i.test(value) && !isValidAddress(value)) {
        const username = value.toLowerCase().replace(/^@/, '').replace(/\.arc$/, '');
        if (seenRecipientLookupRef.current !== username) {
          seenRecipientLookupRef.current = username;
          try {
            const response = await fetch(`/api/passport/resolve?username=${encodeURIComponent(username)}`);
            const data = await response.json() as { walletAddress?: string; error?: string };
            if (data.walletAddress && isValidAddress(data.walletAddress)) {
              input.style.borderColor = 'rgb(16 185 129 / 0.65)';
              setRecipientStatus({ input, text: '✓ Passport available and resolves to a valid Arc/EVM wallet', state: 'valid' });
              return;
            }
            input.style.borderColor = 'rgb(244 63 94 / 0.65)';
            setRecipientStatus({ input, text: data.error || 'Passport is not available. Enter a valid recipient before continuing.', state: 'invalid' });
            return;
          } catch {
            input.style.borderColor = 'rgb(244 63 94 / 0.65)';
            setRecipientStatus({ input, text: 'Passport could not be verified. Please use a valid Arc/EVM address.', state: 'invalid' });
            return;
          }
        }
      }
      input.style.borderColor = base.state === 'valid' ? 'rgb(16 185 129 / 0.65)' : 'rgb(244 63 94 / 0.65)';
      if (base.state !== 'valid') setRecipientStatus({ input, text: base.text, state: base.state === 'foreign' ? 'foreign' : 'invalid' });
      else setRecipientStatus({ input, text: base.text, state: 'valid' });
    };

    const bind = () => {
      const inputs = Array.from(document.querySelectorAll('input[type="text"], input:not([type])')) as HTMLInputElement[];
      inputs.filter((input) => input.placeholder === '0x... or Passport ID' || input.closest('.glass-card')?.textContent?.includes('Who should receive USDC')).forEach((input) => {
        const handler = () => { void decorate(input); };
        input.addEventListener('input', handler);
        input.addEventListener('blur', handler);
        void decorate(input);
        (input as HTMLInputElement & { __arctisRecipientHandler?: EventListener }).__arctisRecipientHandler = handler;
      });
    };
    bind();
    const observer = new MutationObserver(bind);
    observer.observe(document.body, { subtree: true, childList: true });
    return () => {
      observer.disconnect();
      document.querySelectorAll('input[type="text"], input:not([type])').forEach((node) => {
        const input = node as HTMLInputElement & { __arctisRecipientHandler?: EventListener };
        if (input.__arctisRecipientHandler) input.removeEventListener('input', input.__arctisRecipientHandler);
        input.style.removeProperty('border-color');
      });
      setRecipientStatus(null);
      seenRecipientLookupRef.current = '';
    };
  }, [pathname]);

  useEffect(() => {
    if (!voiceEnabled || !voiceSupported || !TX_PATHS.some((path) => matchesPath(pathname, path))) return;
    const scan = () => {
      const bodyText = document.body.innerText;
      let key = '';
      let phrase = '';
      let modal: { kind: 'success' | 'pending' | 'failed'; title: string; message: string } | null = null;
      if (bodyText.includes('Transfer Confirmed')) { key = 'transfer-success'; phrase = 'Transfer successful. Your transaction has been confirmed on Arc Testnet.'; modal = { kind: 'success', title: 'Transfer Confirmed', message: 'Your transfer was confirmed on-chain.' }; }
      else if (bodyText.includes('Circle Swap complete') || bodyText.includes('Swap complete')) { key = 'swap-success'; phrase = 'Swap successful. Your transaction has been confirmed.'; modal = { kind: 'success', title: 'Swap Complete', message: 'Your swap was completed successfully.' }; }
      else if (bodyText.includes('Bridge Submitted') || bodyText.includes('successfully bridged')) { key = 'bridge-success'; phrase = 'Bridge submitted successfully. Circle Forwarding is handling the destination mint.'; modal = { kind: 'success', title: 'Bridge Submitted', message: 'Your bridge request was submitted successfully.' }; }
      else if (bodyText.includes('Confirm in wallet…') || bodyText.includes('Review & Execute')) { key = `${pathname}:wallet`; phrase = 'Your transaction is ready. Please review and approve it in your wallet.'; }
      else if (bodyText.includes('Confirming on Arc…')) { key = `${pathname}:confirming`; phrase = 'Your transaction was submitted. Waiting for blockchain confirmation.'; modal = { kind: 'pending', title: 'Processing', message: 'Your transaction is being confirmed on-chain. Do not submit it again.' }; }
      else if (bodyText.match(/Switching network…|Switch to .* to get a live Circle quote/i)) { key = `${pathname}:network`; phrase = 'Your wallet is on the wrong network. Please approve the requested network switch to continue.'; }
      else if (bodyText.match(/Invalid (EVM )?wallet address|Enter a valid wallet address|Unsupported recipient format|Passport is not available/i)) { key = `${pathname}:recipient`; phrase = 'The recipient is not valid or available. Please enter a valid Arc or EVM wallet address before continuing.'; }
      else if (bodyText.match(/Insufficient (USDC|ARC|ETH)|insufficient balance/i)) { key = `${pathname}:balance`; phrase = 'The transaction cannot continue because your available balance is insufficient. Add the required funds and try again.'; }
      else if (bodyText.match(/rejected|revert|failed/i) && !bodyText.includes('no new transaction')) { key = `${pathname}:failed`; phrase = 'The transaction could not be completed. Review the error details and follow the suggested fix before trying again.'; modal = { kind: 'failed', title: 'Transaction Not Completed', message: 'Review the error details before trying again. ARCTIS will not ask you to resubmit blindly.' }; }
      if (!key || seenStateRef.current.has(key)) return;
      seenStateRef.current.add(key);
      if (phrase) speak(phrase);
      if (modal) setTxModal(modal);
      if (seenStateRef.current.size > 60) seenStateRef.current.clear();
    };
    const observer = new MutationObserver(scan);
    observer.observe(document.body, { subtree: true, childList: true, characterData: true });
    scan();
    return () => observer.disconnect();
  }, [voiceEnabled, voiceSupported, pathname]);

  // Visual transaction-state overlay works independently of voice, so users
  // get the same confirmation even when browser speech is unavailable.
  useEffect(() => {
    if (!TX_PATHS.some((path) => matchesPath(pathname, path))) return;
    const scan = () => {
      const bodyText = document.body.innerText;
      if (bodyText.includes('Transfer Confirmed') && !txModal) setTxModal({ kind: 'success', title: 'Transfer Confirmed', message: 'Your transfer was confirmed on-chain.' });
      else if ((bodyText.includes('Circle Swap complete') || bodyText.includes('Swap complete')) && !txModal) setTxModal({ kind: 'success', title: 'Swap Complete', message: 'Your swap was completed successfully.' });
      else if ((bodyText.includes('Bridge Submitted') || bodyText.includes('successfully bridged')) && !txModal) setTxModal({ kind: 'success', title: 'Bridge Submitted', message: 'Your bridge request was submitted successfully.' });
    };
    const observer = new MutationObserver(scan);
    observer.observe(document.body, { subtree: true, childList: true, characterData: true });
    scan();
    return () => observer.disconnect();
  }, [pathname, txModal]);

  const dismiss = () => {
    setVisible(false);
    try { localStorage.setItem('arctis-orientation-seen', '1'); } catch {}
  };

  const toggleVoice = () => {
    if (!voiceSupported) { setVoiceHint('Voice is not supported by this browser.'); return; }
    const next = !voiceEnabled;
    setVoiceEnabled(next);
    try { localStorage.setItem('arctis-voice-confirmations', next ? '1' : '0'); } catch {}
    if (next) {
      const ok = speak('Voice confirmations enabled. ARCTIS will announce transaction status and explain supported next steps.');
      setVoiceHint(ok ? 'Enabled. ARCTIS will announce transaction progress, confirmations and known fixes.' : 'Enabled, but the browser blocked speech.');
    } else { window.speechSynthesis.cancel(); setVoiceHint('Voice confirmations are off.'); }
  };

  const startNewTransaction = () => {
    const mode = document.body.innerText.includes('Economic Agent') ? 'agent' : 'manual';
    const suffix = `?mode=${mode}&new=${Date.now()}`;
    window.location.href = `${pathname}${suffix}`;
  };

  return (
    <>
      {visible && (
        <section className="mb-6 rounded-2xl border border-blue-500/15 bg-blue-500/[0.035] dark:bg-blue-500/[0.06] p-4 sm:p-5" aria-label="ARCTIS quick start">
          <div className="flex items-start justify-between gap-4 mb-4">
            <div><div className="text-surface-950 font-semibold text-sm">New to ARCTIS? Start here</div><p className="text-surface-600 text-xs mt-1">Four simple entry points — then use the operating system however you need.</p></div>
            <button type="button" onClick={dismiss} aria-label="Dismiss quick start" className="p-1.5 rounded-lg text-surface-500 hover:text-surface-950 hover:bg-black/[0.05] dark:hover:bg-white/[0.06]"><X className="w-4 h-4" /></button>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2">
            {STEPS.map((step, index) => (<Link key={step.href} href={step.href} className="group flex items-start gap-3 rounded-xl bg-surface-0/70 dark:bg-surface-100/40 border border-black/[0.05] dark:border-white/[0.06] p-3 hover:border-blue-500/25 hover:bg-surface-0 dark:hover:bg-surface-100/60 transition-all"><div className="w-7 h-7 rounded-lg bg-blue-500/10 text-blue-600 dark:text-blue-400 flex items-center justify-center flex-shrink-0"><step.icon className="w-3.5 h-3.5" /></div><div className="min-w-0"><div className="flex items-center gap-1 text-xs font-semibold text-surface-950"><span className="text-surface-500">{index + 1}.</span>{step.label}<ArrowRight className="w-3 h-3 text-surface-400 group-hover:translate-x-0.5 transition-transform" /></div><div className="text-[10px] text-surface-600 leading-relaxed mt-0.5">{step.text}</div></div></Link>))}
          </div>
        </section>
      )}

      {bridgeTarget && pathname === '/bridge' && (
        <div className="fixed left-1/2 -translate-x-1/2 bottom-20 z-[72] w-[min(32rem,calc(100vw-2rem))] rounded-2xl border border-amber-500/25 bg-white/95 dark:bg-surface-100/95 backdrop-blur-xl shadow-2xl p-4">
          <div className="flex items-start gap-3"><div className="w-9 h-9 rounded-xl bg-amber-500/10 text-amber-700 flex items-center justify-center"><AlertTriangle className="w-4 h-4" /></div><div className="flex-1"><div className="text-sm font-semibold text-surface-950">Network switch required</div><p className="text-xs text-surface-600 mt-1">Bridge starts on <strong>{bridgeTarget.name}</strong>. ARCTIS can request the switch now.</p>{bridgeSwitchError&&<p className="text-xs text-rose-600 mt-2">{bridgeSwitchError}</p>}<div className="mt-3 flex gap-2"><button onClick={()=>{setBridgeSwitchError(null);void switchChainAsync({chainId:bridgeTarget.chainId}).catch((e)=>setBridgeSwitchError(e instanceof Error?e.message:'Network switch rejected.'));}} disabled={isChainSwitching} className="btn-primary text-xs px-4 py-2">{isChainSwitching?<><Loader2 className="w-3.5 h-3.5 animate-spin"/> Switching…</>:`Switch to ${bridgeTarget.name}`}</button><button onClick={()=>setBridgeTarget(null)} className="btn-ghost text-xs px-3 py-2">Not now</button></div></div></div>
        </div>
      )}

      {recipientStatus && pathname === '/transfer' && (
        <div className="fixed left-1/2 -translate-x-1/2 bottom-20 z-[72] w-[min(34rem,calc(100vw-2rem))] rounded-2xl border border-black/[.08] dark:border-white/[.08] bg-white/95 dark:bg-surface-100/95 backdrop-blur-xl shadow-2xl p-3" aria-live="polite">
          <div className="flex items-center gap-2 text-xs"><span className={recipientStatus.state === 'valid' ? 'text-emerald-600' : 'text-rose-600'}>{recipientStatus.state === 'valid' ? <CheckCircle2 className="w-4 h-4"/> : <AlertTriangle className="w-4 h-4"/>}</span><span className="text-surface-700 dark:text-surface-300">{recipientStatus.text}</span></div>
        </div>
      )}

      {txModal && TX_PATHS.some((path) => matchesPath(pathname, path)) && (
        <div className="fixed inset-0 z-[96] flex items-center justify-center p-4">
          <button aria-label="Close transaction confirmation" onClick={()=>setTxModal(null)} className="absolute inset-0 bg-black/35 backdrop-blur-sm" />
          <div role="dialog" aria-modal="true" className="relative w-full max-w-md rounded-3xl border border-black/[.08] dark:border-white/[.08] bg-white/95 dark:bg-surface-100/95 backdrop-blur-xl shadow-2xl p-6">
            <button aria-label="Close" onClick={()=>setTxModal(null)} className="absolute right-4 top-4 p-2 rounded-xl text-surface-500 hover:bg-black/[.05]"><X className="w-4 h-4"/></button>
            <div className="w-14 h-14 rounded-2xl flex items-center justify-center mx-auto mb-4 bg-emerald-500/10 text-emerald-600"><CheckCircle2 className="w-7 h-7"/></div>
            <h2 className="text-xl font-bold text-center text-surface-950">{txModal.title}</h2>
            <p className="text-sm text-center text-surface-600 mt-2">{txModal.message}</p>
            <div className="mt-5 grid grid-cols-1 sm:grid-cols-2 gap-2"><button onClick={startNewTransaction} className="btn-primary justify-center">New transaction</button><button onClick={()=>setTxModal(null)} className="btn-ghost justify-center">Close</button></div>
          </div>
        </div>
      )}

      <div className="fixed bottom-4 right-4 z-[70] flex flex-col items-end gap-2">
        {helpOpen && (
          <div className="w-[min(22rem,calc(100vw-2rem))] rounded-2xl border border-black/[0.08] dark:border-white/[0.08] bg-white/95 dark:bg-surface-100/95 backdrop-blur-xl shadow-2xl p-4">
            <div className="flex items-start justify-between gap-3"><div className="flex items-center gap-2"><div className="w-8 h-8 rounded-xl bg-blue-500/10 text-blue-600 flex items-center justify-center"><Info className="w-4 h-4" /></div><div><div className="text-sm font-semibold text-surface-950">{help.title}</div><div className="text-[10px] text-surface-500">Quick guide</div></div></div><button onClick={() => setHelpOpen(false)} className="p-1.5 text-surface-500" aria-label="Close guide"><X className="w-4 h-4" /></button></div>
            <p className="text-xs leading-relaxed text-surface-700 dark:text-surface-300 mt-3">{help.text}</p>
            <div className="mt-4 flex flex-wrap gap-2"><button onClick={() => speak(help.text)} disabled={!voiceSupported} className="btn-ghost text-xs gap-1.5"><Play className="w-3 h-3" /> Listen</button><button onClick={toggleVoice} disabled={!voiceSupported} className="btn-ghost text-xs gap-1.5"><span className="inline-flex items-center gap-1">{voiceEnabled ? <Volume2 className="w-3 h-3" /> : <VolumeX className="w-3 h-3" />} Voice confirmations {voiceEnabled ? 'On' : 'Off'}</span></button></div>
            <div className="text-[10px] text-surface-500 mt-2">{voiceHint}</div>
            {isConnected && !isCorrectChain && AI_PATHS.some((path) => matchesPath(pathname, path)) && <div className="mt-3 rounded-lg bg-amber-500/10 border border-amber-500/20 p-2 text-[10px] text-amber-700 dark:text-amber-300">Wrong network detected. ARCTIS will switch to Arc automatically.</div>}
          </div>
        )}
        <button onClick={() => setHelpOpen((v) => !v)} aria-label="Open ARCTIS page guide" title="Page guide" className="w-11 h-11 rounded-full bg-surface-950 text-white shadow-xl flex items-center justify-center border border-white/10 hover:scale-105 transition-transform"><Info className="w-5 h-5" /></button>
      </div>

      <style jsx global>{`
        body.arctis-page-knowledge .max-w-5xl { padding-left: 1rem; padding-right: 1rem; }
        @media (min-width: 768px) { body.arctis-page-knowledge .max-w-5xl { padding-left: 0; padding-right: 0; } }
      `}</style>
    </>
  );
}
