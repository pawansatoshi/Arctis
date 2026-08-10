'use client';

import { useState } from 'react';
import { Languages, Check, ChevronDown } from 'lucide-react';
import { LANGUAGES, useI18n, type Locale } from '@/lib/i18n';
import { cn } from '@/lib/utils';

export default function LanguageSwitcher() {
  const { locale, setLocale } = useI18n();
  const [open, setOpen] = useState(false);
  const current = LANGUAGES.find((l) => l.code === locale) ?? LANGUAGES[0];

  return (
    <div className="fixed top-3 right-3 sm:top-4 sm:right-4 z-[100]">
      <button
        onClick={() => setOpen((v) => !v)}
        aria-label="Change language"
        aria-expanded={open}
        className="flex items-center gap-1.5 rounded-xl border border-black/[0.08] dark:border-white/[0.10] bg-white/90 dark:bg-surface-900/90 backdrop-blur-xl shadow-lg px-2.5 py-2 text-xs font-semibold text-surface-800 dark:text-surface-100 hover:bg-white dark:hover:bg-surface-900 transition-colors"
      >
        <Languages className="w-3.5 h-3.5" />
        <span>{current.flag}</span>
        <ChevronDown className={cn('w-3 h-3 transition-transform', open && 'rotate-180')} />
      </button>
      {open && (
        <div className="absolute right-0 mt-2 w-48 max-h-[70vh] overflow-auto rounded-2xl border border-black/[0.08] dark:border-white/[0.10] bg-white/95 dark:bg-surface-900/95 backdrop-blur-xl shadow-2xl p-1.5">
          {LANGUAGES.map((lang) => (
            <button
              key={lang.code}
              onClick={() => { setLocale(lang.code as Locale); setOpen(false); }}
              className="w-full flex items-center justify-between gap-3 px-3 py-2.5 rounded-xl text-left text-sm text-surface-700 dark:text-surface-200 hover:bg-black/[0.05] dark:hover:bg-white/[0.06]"
            >
              <span className="flex items-center gap-2"><span className="w-6 text-[10px] font-bold text-surface-500">{lang.flag}</span><span>{lang.native}</span></span>
              {locale === lang.code && <Check className="w-4 h-4 text-blue-500" />}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
