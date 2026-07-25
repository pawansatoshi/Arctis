'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAccount } from 'wagmi';
import dynamic from 'next/dynamic';
import { useRouter } from 'next/navigation';
import {
  CheckCircle2, ArrowRight, Wallet, Zap, Bot, Sparkles,
  ExternalLink, Copy, Check, ChevronRight,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAppStore } from '@/lib/store';
import toast from 'react-hot-toast';

const ConnectButton = dynamic(
  () => import('@rainbow-me/rainbowkit').then((m) => ({ default: m.ConnectButton })),
  { ssr: false }
);

// ============================================================
// Onboarding Wizard — 4 steps
// 1. Connect Wallet
// 2. Add Arc Testnet + Fund Wallet
// 3. Get Credits
// 4. First AI Message
// ============================================================

const STEPS = [
  { id: 'connect',  label: 'Connect',  icon: Wallet },
  { id: 'fund',     label: 'Fund',     icon: Zap },
  { id: 'credits',  label: 'Credits',  icon: Sparkles },
  { id: 'explore',  label: 'Explore',  icon: Bot },
] as const;

type StepId = typeof STEPS[number]['id'];

function StepIndicator({ current }: { current: number }) {
  return (
    <div className="flex items-center gap-2 justify-center mb-10">
      {STEPS.map((step, i) => {
        const done = i < current;
        const active = i === current;
        return (
          <div key={step.id} className="flex items-center gap-2">
            <div className={cn(
              'w-8 h-8 rounded-full flex items-center justify-center text-xs font-semibold transition-all duration-300',
              done  && 'bg-emerald-500 text-white',
              active && 'bg-blue-500 text-white ring-2 ring-blue-500/40 ring-offset-2 ring-offset-surface-50',
              !done && !active && 'bg-surface-200 text-surface-500',
            )}>
              {done ? <CheckCircle2 className="w-4 h-4" /> : i + 1}
            </div>
            <span className={cn(
              'text-xs font-medium hidden sm:block',
              active ? 'text-surface-950' : 'text-surface-500',
            )}>
              {step.label}
            </span>
            {i < STEPS.length - 1 && (
              <div className={cn(
                'w-8 h-px transition-colors duration-500',
                done ? 'bg-emerald-500' : 'bg-surface-300',
              )} />
            )}
          </div>
        );
      })}
    </div>
  );
}

// ─── Step 1: Connect ─────────────────────────────────────────
function StepConnect({ onNext }: { onNext: () => void }) {
  const { isConnected, address } = useAccount();

  useEffect(() => {
    if (isConnected) {
      const t = setTimeout(onNext, 700);
      return () => clearTimeout(t);
    }
  }, [isConnected, onNext]);

  return (
    <div className="text-center space-y-8">
      <div>
        <div className="w-16 h-16 rounded-2xl bg-blue-500/10 flex items-center justify-center mx-auto mb-6">
          <Wallet className="w-8 h-8 text-blue-400" />
        </div>
        <h2 className="text-2xl font-bold text-surface-950 mb-3">Connect Your Wallet</h2>
        <p className="text-surface-600 max-w-sm mx-auto">
          ARCTIS uses your wallet for identity and USDC payments.
          No accounts, no passwords — your keys, your control.
        </p>
      </div>

      <div className="flex flex-col items-center gap-4">
        <ConnectButton />

        {isConnected && address && (
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="flex items-center gap-2 px-4 py-2 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-sm"
          >
            <CheckCircle2 className="w-4 h-4" />
            Connected — moving you forward…
          </motion.div>
        )}
      </div>

      <div className="glass-card p-4 text-left text-sm space-y-2 max-w-sm mx-auto">
        <p className="text-surface-700 font-medium text-xs uppercase tracking-wide mb-3">Supported Wallets</p>
        {['MetaMask', 'OKX Wallet', 'Coinbase Wallet', 'Bitget', 'Trust Wallet'].map((w) => (
          <div key={w} className="flex items-center gap-2 text-surface-600">
            <CheckCircle2 className="w-3 h-3 text-emerald-400 flex-shrink-0" />
            {w}
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Step 2: Fund ─────────────────────────────────────────────
function StepFund({ onNext }: { onNext: () => void }) {
  const [copied, setCopied] = useState<string | null>(null);

  const copy = (text: string, key: string) => {
    navigator.clipboard.writeText(text);
    setCopied(key);
    setTimeout(() => setCopied(null), 2000);
  };

  const networkDetails = [
    { label: 'Network Name', value: 'Arc Testnet' },
    { label: 'RPC URL',      value: 'https://rpc.testnet.arc.network' },
    { label: 'Chain ID',     value: '5042002' },
    { label: 'Symbol',       value: 'USDC' },
    { label: 'Explorer',     value: 'https://testnet.arcscan.app' },
  ];

  return (
    <div className="space-y-8">
      <div className="text-center">
        <div className="w-16 h-16 rounded-2xl bg-emerald-500/10 flex items-center justify-center mx-auto mb-6">
          <Zap className="w-8 h-8 text-emerald-400" />
        </div>
        <h2 className="text-2xl font-bold text-surface-950 mb-3">Add Arc Testnet & Fund</h2>
        <p className="text-surface-600 max-w-sm mx-auto">
          Add Arc Testnet to your wallet, then get free testnet USDC from the Circle faucet.
        </p>
      </div>

      {/* Network details */}
      <div className="glass-card p-4 space-y-2 max-w-sm mx-auto">
        <p className="text-surface-600 text-xs uppercase tracking-wide font-medium mb-3">Network Details</p>
        {networkDetails.map(({ label, value }) => (
          <div key={label} className="flex items-center justify-between gap-3">
            <span className="text-surface-500 text-sm">{label}</span>
            <div className="flex items-center gap-1.5">
              <span className="text-surface-950 text-sm font-mono truncate max-w-[180px]">{value}</span>
              <button
                onClick={() => copy(value, label)}
                className="p-1 text-surface-500 hover:text-surface-950 transition-colors"
              >
                {copied === label
                  ? <Check className="w-3 h-3 text-emerald-400" />
                  : <Copy className="w-3 h-3" />}
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* Actions */}
      <div className="flex flex-col sm:flex-row gap-3 max-w-sm mx-auto">
        <a
          href="https://faucet.circle.com/"
          target="_blank"
          rel="noopener noreferrer"
          className="btn-primary flex-1 justify-center"
        >
          Get Testnet USDC <ExternalLink className="w-4 h-4" />
        </a>
        <a
          href="https://testnet.arcscan.app"
          target="_blank"
          rel="noopener noreferrer"
          className="btn-ghost flex-1 justify-center border border-white/[0.08]"
        >
          ArcScan Explorer <ExternalLink className="w-4 h-4" />
        </a>
      </div>

      <div className="text-center">
        <button onClick={onNext} className="btn-ghost text-surface-600 text-sm">
          I already have funds — skip <ChevronRight className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}

// ─── Step 3: Credits ──────────────────────────────────────────
function StepCredits({ onNext }: { onNext: () => void }) {
  const plans = [
    { name: 'Free Plan',    credits: 100,  price: 0,  highlight: false, note: 'Start here' },
    { name: 'Starter Pack', credits: 100,  price: 10, highlight: false, note: '10 USDC' },
    { name: 'Value Pack',   credits: 700,  price: 50, highlight: true,  note: '50 USDC — Popular' },
    { name: 'Power Pack',   credits: 1800, price: 100,highlight: false, note: '100 USDC — Best Value' },
  ];

  return (
    <div className="space-y-8">
      <div className="text-center">
        <div className="w-16 h-16 rounded-2xl bg-violet-500/10 flex items-center justify-center mx-auto mb-6">
          <Sparkles className="w-8 h-8 text-violet-400" />
        </div>
        <h2 className="text-2xl font-bold text-surface-950 mb-3">Get AI Credits</h2>
        <p className="text-surface-600 max-w-sm mx-auto">
          Credits power AI models, agent executions, and analysis. Purchase with USDC — verified on-chain.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3 max-w-sm mx-auto">
        {plans.map((plan) => (
          <div key={plan.name} className={cn(
            'glass-card p-4 text-center relative',
            plan.highlight && 'border-blue-500/30 bg-blue-500/5',
          )}>
            {plan.highlight && (
              <div className="absolute -top-2.5 left-1/2 -translate-x-1/2">
                <span className="bg-blue-500 text-white text-xs px-2 py-0.5 rounded-full font-medium">Popular</span>
              </div>
            )}
            <div className="text-2xl font-bold text-surface-950">{plan.credits.toLocaleString()}</div>
            <div className="text-surface-600 text-xs mb-1">credits</div>
            <div className="text-surface-500 text-xs">{plan.note}</div>
          </div>
        ))}
      </div>

      <div className="glass-card p-4 max-w-sm mx-auto">
        <p className="text-surface-600 text-xs uppercase tracking-wide font-medium mb-3">Credit Costs</p>
        <div className="space-y-2 text-sm">
          {[
            { model: 'Kimi K1.5, DeepSeek, Gemma', cost: '1 credit / 1k tokens' },
            { model: 'GPT-4o Mini, Claude Haiku',   cost: '2 credits / 1k tokens' },
            { model: 'GPT-4o, Claude 3.5 Sonnet',  cost: '10 credits / 1k tokens' },
          ].map(({ model, cost }) => (
            <div key={model} className="flex justify-between gap-3">
              <span className="text-surface-600">{model}</span>
              <span className="text-surface-950 font-mono whitespace-nowrap">{cost}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="flex flex-col gap-3 max-w-sm mx-auto">
        <a href="/credits" className="btn-primary justify-center">
          Purchase Credits <ArrowRight className="w-4 h-4" />
        </a>
        <button onClick={onNext} className="btn-ghost text-surface-600 text-sm">
          Start with free credits <ChevronRight className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}

// ─── Step 4: Explore ──────────────────────────────────────────
function StepExplore({ onFinish }: { onFinish: () => void }) {
  const features = [
    { icon: '🤖', label: 'AI Workspace',    href: '/ai',       desc: 'Chat with 8 specialized AI modes' },
    { icon: '⚡', label: 'Economic Agents', href: '/agents',   desc: 'Deploy autonomous worker agents' },
    { icon: '💰', label: 'Treasury',         href: '/treasury', desc: 'Track USDC flows and revenue' },
    { icon: '📊', label: 'Analytics',        href: '/analytics',desc: 'Charts and insights' },
  ];

  return (
    <div className="space-y-8">
      <div className="text-center">
        <div className="w-16 h-16 rounded-2xl bg-amber-500/10 flex items-center justify-center mx-auto mb-6">
          <Bot className="w-8 h-8 text-amber-400" />
        </div>
        <h2 className="text-2xl font-bold text-surface-950 mb-3">You&apos;re Ready!</h2>
        <p className="text-surface-600 max-w-sm mx-auto">
          Explore ARCTIS — the AI + Stablecoin Operating System built on Arc.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3 max-w-sm mx-auto">
        {features.map((f) => (
          <a
            key={f.label}
            href={f.href}
            onClick={onFinish}
            className="glass-card-hover p-4 text-left group"
          >
            <div className="text-2xl mb-2">{f.icon}</div>
            <div className="text-surface-950 font-semibold text-sm">{f.label}</div>
            <div className="text-surface-500 text-xs mt-1">{f.desc}</div>
          </a>
        ))}
      </div>

      <div className="text-center">
        <button onClick={onFinish} className="btn-primary">
          Go to Dashboard <ArrowRight className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}

// ─── Main Onboarding Page ─────────────────────────────────────
export default function OnboardingPage() {
  const [step, setStep] = useState(0);
  const { isConnected } = useAccount();
  const { onboardingComplete, setOnboardingComplete } = useAppStore();
  const router = useRouter();

  // If already onboarded, redirect
  useEffect(() => {
    if (onboardingComplete) {
      router.replace('/dashboard');
    }
  }, [onboardingComplete, router]);

  const finish = () => {
    setOnboardingComplete(true);
    router.push('/dashboard');
  };

  const next = () => setStep((s) => Math.min(s + 1, STEPS.length - 1));

  return (
    <div className="min-h-screen bg-surface-50 flex items-center justify-center px-4">
      {/* Background */}
      <div className="fixed inset-0 pointer-events-none">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[600px] h-[300px] bg-arc-glow opacity-40" />
      </div>

      <div className="relative z-10 w-full max-w-lg">
        {/* Header */}
        <div className="text-center mb-10">
          <div className="flex items-center justify-center gap-2 mb-2">
            <div className="w-8 h-8 rounded-lg bg-arc-gradient flex items-center justify-center">
              <span className="text-white font-bold text-sm">A</span>
            </div>
            <span className="text-surface-950 font-bold text-xl">ARCTIS</span>
          </div>
          <p className="text-surface-600 text-sm">Setup — takes about 2 minutes</p>
        </div>

        <StepIndicator current={step} />

        <div className="glass-card p-8">
          <AnimatePresence mode="wait">
            <motion.div
              key={step}
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.25, ease: [0.4, 0, 0.2, 1] }}
            >
              {step === 0 && <StepConnect onNext={next} />}
              {step === 1 && <StepFund onNext={next} />}
              {step === 2 && <StepCredits onNext={next} />}
              {step === 3 && <StepExplore onFinish={finish} />}
            </motion.div>
          </AnimatePresence>
        </div>

        {/* Skip */}
        {step > 0 && step < 3 && (
          <div className="text-center mt-4">
            <button
              onClick={() => setStep((s) => s + 1)}
              className="text-surface-500 text-sm hover:text-surface-700 transition-colors"
            >
              Skip this step
            </button>
          </div>
        )}

        {/* Skip all */}
        <div className="text-center mt-4">
          <button onClick={finish} className="text-surface-400 text-xs hover:text-surface-600 transition-colors">
            Skip setup — go to dashboard
          </button>
        </div>
      </div>
    </div>
  );
}
