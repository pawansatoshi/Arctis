'use client';

import { type ReactNode, useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import dynamic from 'next/dynamic';
import {
  LayoutDashboard, ArrowUpRight, History,
  Settings, ChevronLeft,
  Building2, ArrowLeftRight, GitMerge, Shield,
  Coins, Menu, X, FolderOpen, Activity,
  MessageCircle, Heart, Zap, BookOpen,
  ChevronRight, Search,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import CommandPalette from '@/components/ui/CommandPalette';
import { useAppStore } from '@/lib/store';
import { useUSDCBalance } from '@/lib/hooks/useUSDCBalance';
import { useChainSwitch } from '@/lib/hooks/useChainSwitch';
import { useAccount } from 'wagmi';

const ConnectButton = dynamic(
  () => import('@rainbow-me/rainbowkit').then((m) => ({ default: m.ConnectButton })),
  { ssr: false }
);

/* ── Navigation groups — mirrors the four ARCTIS operating systems ── */
const NAV_GROUPS = [
  {
    label: 'Overview',
    items: [
      { label: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
      { label: 'Activity',  href: '/activity',  icon: Activity },
      { label: 'History',   href: '/history',   icon: History },
    ],
  },
  {
    label: 'AI OS',
    items: [
      { label: 'Copilot', href: '/copilot', icon: MessageCircle },
    ],
  },
  {
    label: 'Stablecoin OS',
    items: [
      { label: 'Transfer', href: '/transfer', icon: ArrowUpRight },
      { label: 'Swap',     href: '/swap',     icon: ArrowLeftRight },
      { label: 'Bridge',   href: '/bridge',   icon: GitMerge },
    ],
  },
  {
    label: 'Knowledge OS',
    items: [
      { label: 'Workspace', href: '/workspace', icon: FolderOpen },
      { label: 'Knowledge', href: '/knowledge', icon: BookOpen },
    ],
  },
  {
    label: 'Economic Agent OS',
    items: [
      { label: 'Agents', href: '/agents', icon: Zap },
    ],
  },
  {
    label: 'Finance',
    items: [
      { label: 'Treasury', href: '/treasury', icon: Building2 },
      { label: 'Credits',  href: '/credits',  icon: Coins },
    ],
  },
  {
    label: 'Platform',
    items: [
      { label: 'Settings', href: '/settings', icon: Settings },
      { label: 'Feedback', href: '/feedback', icon: Heart },
      { label: 'Admin',    href: '/admin',    icon: Shield },
    ],
  },
] as const;

export default function DashboardLayout({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const { sidebarCollapsed, toggleSidebar, creditBalance, setCommandPaletteOpen } = useAppStore();
  const { formatted: balance } = useUSDCBalance();
  const { isCorrectChain, switchToArc } = useChainSwitch();
  const { isConnected } = useAccount();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [pendingCount, setPendingCount] = useState(0);
  const { address } = useAccount();

  useEffect(() => { setMobileOpen(false); }, [pathname]);

  useEffect(() => {
    if (!address) {
      setPendingCount(0);
      return;
    }
    fetch(`/api/agents/proposals?wallet=${address}`)
      .then((r) => r.json())
      .then((d) => setPendingCount((d.proposals ?? []).length))
      .catch(() => setPendingCount(0));
  }, [address]);

  const isActive = (href: string) =>
    href === '/dashboard' ? pathname === href : pathname.startsWith(href);

  const currentLabel = (() => {
    for (const group of NAV_GROUPS) {
      for (const item of group.items) {
        if (isActive(item.href)) return item.label;
      }
    }
    return 'ARCTIS';
  })();

  const SidebarContent = () => (
    <div className="flex flex-col h-full">
      <div className={cn(
        'flex items-center gap-3 border-b border-black/[0.06] dark:border-white/[0.06] flex-shrink-0 transition-all duration-300',
        sidebarCollapsed ? 'px-3 py-4 justify-center' : 'px-4 py-4',
      )}>
        <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-blue-500/30 to-violet-500/20 border border-black/[0.1] dark:border-white/[0.1] flex items-center justify-center flex-shrink-0 shadow-lg shadow-blue-500/10">
          <span className="text-blue-600 dark:text-blue-400 font-black text-sm tracking-tighter">A</span>
        </div>
        {!sidebarCollapsed && (
          <div>
            <div className="text-surface-950 font-bold tracking-tight text-sm leading-none">ARCTIS</div>
            <div className="text-surface-600 text-[10px] mt-0.5 font-medium">Operating System</div>
          </div>
        )}
      </div>

      {isConnected && !isCorrectChain && (
        <button
          onClick={switchToArc}
          className={cn(
            'm-2.5 rounded-xl bg-amber-500/10 border border-amber-500/25 text-amber-600 dark:text-amber-400 text-xs hover:bg-amber-500/15 transition-colors',
            sidebarCollapsed ? 'p-2 flex items-center justify-center' : 'p-3 text-left',
          )}
        >
          {sidebarCollapsed ? (
            <span className="text-base">⚠</span>
          ) : (
            <>
              <div className="font-semibold mb-0.5">Wrong Network</div>
              <div className="text-amber-500/70 text-[10px]">Tap to switch to Arc</div>
            </>
          )}
        </button>
      )}

      <nav aria-label="ARCTIS navigation" className="flex-1 overflow-y-auto px-2 py-3 space-y-4">
        {NAV_GROUPS.map((group) => (
          <div key={group.label}>
            {!sidebarCollapsed && (
              <div className="px-3 mb-1 text-surface-600 text-[10px] font-semibold uppercase tracking-widest">
                {group.label}
              </div>
            )}
            <div className="space-y-0.5">
              {group.items.map((item) => {
                const active = isActive(item.href);
                const badge = item.href === '/agents' && pendingCount > 0 ? pendingCount : 0;
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    title={sidebarCollapsed ? item.label : undefined}
                    className={cn(
                      'flex rounded-xl text-sm font-medium transition-all duration-150 relative',
                      sidebarCollapsed
                        ? 'flex-col items-center justify-center gap-0.5 px-1 py-2'
                        : 'flex-row items-center gap-3 px-3 py-2',
                      active
                        ? 'bg-blue-500/12 text-blue-600 dark:text-blue-400 border border-blue-500/20'
                        : 'text-surface-600 hover:text-surface-950 hover:bg-black/[0.04] dark:hover:bg-white/[0.04]',
                    )}
                  >
                    <div className="relative flex-shrink-0">
                      <item.icon className="w-4 h-4" />
                      {badge > 0 && (
                        <span className="absolute -top-1.5 -right-1.5 w-3.5 h-3.5 rounded-full bg-amber-400 border border-surface-100 flex items-center justify-center text-[8px] font-bold text-surface-950">
                          {badge > 9 ? '9+' : badge}
                        </span>
                      )}
                    </div>
                    {sidebarCollapsed ? (
                      <span className="text-[9px] leading-none font-medium truncate max-w-[56px] text-center">
                        {item.label}
                      </span>
                    ) : (
                      <>
                        <span className="flex-1 truncate">{item.label}</span>
                        {badge > 0 && (
                          <span className="px-1.5 py-0.5 rounded-full bg-amber-500/15 text-amber-600 dark:text-amber-400 text-[10px] font-semibold">
                            {badge}
                          </span>
                        )}
                      </>
                    )}
                  </Link>
                );
              })}
            </div>
          </div>
        ))}
      </nav>

      {!sidebarCollapsed && isConnected && (
        <div className="mx-3 mb-3 p-3.5 glass-card space-y-2.5">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-surface-500 text-[10px] uppercase tracking-wider font-medium mb-0.5">USDC</div>
              <div className="text-surface-950 font-mono font-bold text-sm">{balance}</div>
            </div>
            <div className="w-6 h-6 rounded-lg bg-blue-500/15 flex items-center justify-center">
              <span className="text-blue-600 dark:text-blue-400 text-[10px] font-bold">$</span>
            </div>
          </div>
          {creditBalance && (
            <div className="flex items-center justify-between pt-2 border-t border-black/[0.06] dark:border-white/[0.06]">
              <div className="flex items-center gap-1.5 text-surface-600 text-xs">
                <Coins className="w-3 h-3" />
                <span>{creditBalance.remaining.toLocaleString()} credits</span>
              </div>
              <Link href="/credits" className="text-blue-600 dark:text-blue-400 text-[10px] hover:text-blue-700 dark:hover:text-blue-300 transition-colors">
                Top up →
              </Link>
            </div>
          )}
          <div className="flex items-center gap-1.5 text-[10px]">
            <span className={cn('status-dot flex-shrink-0', isCorrectChain ? 'status-dot-online' : 'status-dot-offline')} />
            <span className="text-surface-600">{isCorrectChain ? 'Arc Testnet · Connected' : 'Wrong chain'}</span>
          </div>
        </div>
      )}

      <button
        onClick={toggleSidebar}
        aria-label={sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        className="hidden md:flex items-center justify-center h-10 flex-shrink-0 border-t border-black/[0.06] dark:border-white/[0.06] text-surface-600 hover:text-surface-950 hover:bg-black/[0.04] dark:hover:bg-white/[0.04] transition-all"
      >
        <ChevronLeft className={cn('w-4 h-4 transition-transform duration-300', sidebarCollapsed && 'rotate-180')} />
      </button>
    </div>
  );

  return (
    <div className="min-h-screen bg-surface-50 flex">
      <CommandPalette />

      <aside className={cn(
        'hidden md:flex fixed left-0 top-0 h-full z-40 flex-col bg-surface-100 border-r border-black/[0.06] dark:border-white/[0.06] transition-all duration-300',
        sidebarCollapsed ? 'w-[60px]' : 'w-[220px]',
      )}>
        <SidebarContent />
      </aside>

      {mobileOpen && (
        <div className="md:hidden fixed inset-0 z-50 flex">
          <div
            className="absolute inset-0 bg-black/70 backdrop-blur-sm"
            onClick={() => setMobileOpen(false)}
          />
          <aside className="relative z-10 w-[240px] h-full flex flex-col bg-surface-100 border-r border-black/[0.06] dark:border-white/[0.06] shadow-2xl">
            <button
              onClick={() => setMobileOpen(false)}
              aria-label="Close menu"
              className="absolute top-4 right-3 p-1.5 rounded-lg text-surface-600 hover:text-surface-950 hover:bg-black/[0.06] dark:hover:bg-white/[0.06] transition-all"
            >
              <X className="w-4 h-4" />
            </button>
            <SidebarContent />
          </aside>
        </div>
      )}

      <div className={cn(
        'flex-1 flex flex-col transition-all duration-300',
        sidebarCollapsed ? 'md:ml-[60px]' : 'md:ml-[220px]',
      )}>
        <header className="sticky top-0 z-30 flex items-center gap-4 px-4 sm:px-6 h-14 bg-surface-50/90 backdrop-blur-xl border-b border-black/[0.06] dark:border-white/[0.06]">
          <button
            onClick={() => setMobileOpen(true)}
            aria-label="Open navigation"
            className="md:hidden p-2 -ml-1 rounded-xl text-surface-600 hover:text-surface-950 hover:bg-black/[0.06] dark:hover:bg-white/[0.06] transition-all"
          >
            <Menu className="w-5 h-5" />
          </button>

          <div className="hidden sm:flex items-center gap-1.5 text-sm text-surface-600">
            <span className="text-surface-500 text-xs font-semibold">ARCTIS</span>
            <ChevronRight className="w-3 h-3 text-surface-700" />
            <span className="text-surface-950 font-medium text-sm">{currentLabel}</span>
          </div>
          <div className="sm:hidden text-surface-950 font-semibold text-sm">{currentLabel}</div>

          <button
            onClick={() => setCommandPaletteOpen(true)}
            aria-label="Open command palette"
            className="hidden sm:flex items-center gap-2 ml-4 px-2.5 py-1.5 rounded-lg text-surface-500 hover:text-surface-950 hover:bg-black/[0.04] dark:hover:bg-white/[0.04] border border-black/[0.06] dark:border-white/[0.06] text-xs transition-colors"
          >
            <Search className="w-3.5 h-3.5" />
            <span>Search</span>
            <kbd className="text-[10px] border border-black/[0.1] dark:border-white/[0.1] rounded px-1 py-0.5 ml-1">⌘K</kbd>
          </button>

          <div className="flex items-center gap-2 ml-auto">
            {isConnected && (
              <div
                className={cn(
                  'hidden sm:flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-colors',
                  isCorrectChain
                    ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20'
                    : 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20 cursor-pointer hover:bg-amber-500/15',
                )}
                onClick={!isCorrectChain ? switchToArc : undefined}
                role={!isCorrectChain ? 'button' : undefined}
              >
                <span className={cn('w-1.5 h-1.5 rounded-full', isCorrectChain ? 'bg-emerald-400' : 'bg-amber-400 animate-pulse')} />
                {isCorrectChain ? 'Arc Testnet' : 'Switch Network'}
              </div>
            )}
            <ConnectButton accountStatus="avatar" chainStatus="none" showBalance={false} />
          </div>
        </header>

        <main className="flex-1 p-4 sm:p-6 lg:p-8">{children}</main>
      </div>
    </div>
  );
}
