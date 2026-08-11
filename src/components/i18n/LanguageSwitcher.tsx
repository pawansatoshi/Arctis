'use client';

import { useState } from 'react';
import { Globe2, Check, ChevronDown } from 'lucide-react';
import { usePathname } from 'next/navigation';
import { LANGUAGES, useI18n, type Locale } from '@/lib/i18n';
import { cn } from '@/lib/utils';

interface LanguageSwitcherProps {
  inline?: boolean;
}

export default function LanguageSwitcher({ inline = false }: LanguageSwitcherProps) {
  const pathname = usePathname();
  const { locale, setLocale } = useI18n();
  const [open, setOpen] = useState(false);
  const current = LANGUAGES.find((l) => l.code === locale) ?? LANGUAGES[0];

  // The landing page supplies an inline header instance. The global provider
  // instance stays hidden there so it cannot float over wallet/actions.
  if (pathname === '/' && !inline) return null;

  return (
    <div
      className={cn(
        inline
          ? 'relative shrink-0'
          : 'fixed top-16 right-3 md:top-1.5 md:right-[190px] z-[100]'
      )}
    >
      <button
        onClick={() => setOpen((v) => !v)}
        aria-label={`Change language. Current language: ${current.native}`}
        aria-expanded={open}
        aria-haspopup="menu"
        className="group flex min-h-11 items-center gap-2 rounded-full border border-blue-500/15 dark:border-white/[0.10] bg-white/92 dark:bg-surface-900/92 backdrop-blur-xl shadow-lg shadow-blue-500/10 px-3.5 py-2 text-xs font-semibold text-surface-800 dark:text-surface-100 hover:border-blue-500/30 hover:bg-white dark:hover:bg-surface-900 transition-all"
      >
        <span className="flex h-7 w-7 items-center justify-center rounded-full bg-blue-500/10 text-blue-600 dark:text-blue-400 ring-1 ring-blue-500/10">
          <Globe2 className="h-4 w-4" aria-hidden="true" />
        </span>
        <span className="tracking-wide">{current.code.toUpperCase()}</span>
        <ChevronDown className={cn('h-3.5 w-3.5 text-surface-500 transition-transform', open && 'rotate-180')} aria-hidden="true" />
      </button>

      {open && (
        <div
          role="menu"
          aria-label="Choose language"
          className={cn(
            'absolute right-0 mt-2 w-56 max-h-[70vh] overflow-auto rounded-2xl border border-black/[0.08] dark:border-white/[0.10] bg-white/95 dark:bg-surface-900/95 backdrop-blur-xl shadow-2xl shadow-black/10 p-1.5',
            inline && 'z-[110]'
          )}
        >
          <div className="px-3 py-2 text-[10px] font-bold uppercase tracking-[0.16em] text-surface-400">
            Language
          </div>
          {LANGUAGES.map((lang) => (
            <button
              key={lang.code}
              role="menuitem"
              onClick={() => {
                setLocale(lang.code as Locale);
                setOpen(false);
              }}
              className="w-full flex items-center justify-between gap-3 px-3 py-2.5 rounded-xl text-left text-sm text-surface-700 dark:text-surface-200 hover:bg-blue-500/[0.07] dark:hover:bg-white/[0.06] transition-colors"
            >
              <span className="flex items-center gap-2.5">
                <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-surface-100 dark:bg-white/[0.06] text-xs">
                  {lang.flag}
                </span>
                <span>{lang.native}</span>
              </span>
              {locale === lang.code && <Check className="w-4 h-4 text-blue-500" />}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
