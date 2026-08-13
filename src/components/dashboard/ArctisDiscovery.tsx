import Link from 'next/link';
import { ArrowLeftRight, Bot, ChevronRight, CreditCard, Fingerprint, FolderOpen, Landmark, Sparkles } from 'lucide-react';

const FEATURES = [
  { href: '/membership', label: 'Membership', title: 'Join the ARCTIS economy', text: 'See membership, access and credits.', icon: CreditCard },
  { href: '/passport', label: 'Passport', title: 'Build your onchain identity', text: 'Claim and manage your .arc identity.', icon: Fingerprint },
  { href: '/transfer', label: 'Stablecoin OS', title: 'Move USDC', text: 'Transfer, swap and bridge on Arc.', icon: ArrowLeftRight },
  { href: '/agents', label: 'Economic Agents', title: 'Let agents act with approval', text: 'Prepare actions and review before signing.', icon: Bot },
  { href: '/treasury', label: 'Treasury', title: 'See programmable money', text: 'Review balances and treasury activity.', icon: Landmark },
  { href: '/workspace', label: 'Knowledge OS', title: 'Work with context', text: 'Research, prompts and reusable knowledge.', icon: FolderOpen },
] as const;

export default function ArctisDiscovery() {
  return (
    <section className="rounded-3xl border border-surface-200/70 dark:border-white/[0.08] bg-surface-50/80 dark:bg-white/[0.025] p-4 sm:p-5 shadow-sm">
      <div className="flex items-start justify-between gap-4 mb-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Sparkles className="w-4 h-4 text-blue-500" />
            <span className="text-[11px] uppercase tracking-[0.16em] font-semibold text-blue-600 dark:text-blue-400">Explore ARCTIS</span>
          </div>
          <h2 className="text-lg sm:text-xl font-semibold text-surface-950 tracking-tight">One operating system. Multiple capabilities.</h2>
          <p className="text-xs sm:text-sm text-surface-600 mt-1 max-w-2xl">Start with identity and membership, then move assets, work with knowledge, or let an agent act under your approval.</p>
        </div>
        <Link href="/membership" className="hidden sm:inline-flex items-center gap-1.5 text-xs font-medium text-surface-700 hover:text-blue-600 whitespace-nowrap">View membership <ChevronRight className="w-3.5 h-3.5" /></Link>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
        {FEATURES.map((feature) => {
          const Icon = feature.icon;
          return (
            <Link key={feature.href} href={feature.href} className="group rounded-2xl border border-surface-200/70 dark:border-white/[0.08] bg-white/70 dark:bg-white/[0.02] p-3.5 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md">
              <div className="flex items-start gap-3">
                <div className="w-9 h-9 shrink-0 rounded-xl flex items-center justify-center bg-blue-500/10 text-blue-600 dark:text-blue-400"><Icon className="w-4 h-4" /></div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[10px] uppercase tracking-wider font-semibold text-surface-500">{feature.label}</span>
                    <ChevronRight className="w-3.5 h-3.5 text-surface-400 group-hover:translate-x-0.5 transition-transform" />
                  </div>
                  <h3 className="text-sm font-semibold text-surface-900 mt-0.5">{feature.title}</h3>
                  <p className="text-[11px] leading-relaxed text-surface-600 mt-1">{feature.text}</p>
                </div>
              </div>
            </Link>
          );
        })}
      </div>
      <Link href="/membership" className="sm:hidden mt-3 w-full inline-flex items-center justify-center gap-1.5 rounded-xl border border-surface-200 dark:border-white/[0.08] py-2.5 text-xs font-medium text-surface-700">Explore Membership <ChevronRight className="w-3.5 h-3.5" /></Link>
    </section>
  );
}
