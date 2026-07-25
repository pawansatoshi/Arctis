// ============================================================
// User Preferences — Phase 14
// Central store for user preferences persisted to localStorage.
// Language is the first preference. Future preferences (theme,
// voice speed, accessibility, AI defaults) extend UserPreferences
// without changing the storage key or hook API contract.
// ============================================================

import { useState, useEffect, useCallback } from 'react';

const PREFS_KEY = 'arctis:preferences:v1';

// ── Preference schema ─────────────────────────────────────────
// Add future preferences here as optional fields with sensible defaults.
export interface UserPreferences {
  language: string;           // BCP-47 code, default 'en'
  // Future additions (examples — not yet implemented):
  // theme?: 'system' | 'dark' | 'light';
  // voiceSpeed?: number;
  // reducedMotion?: boolean;
  // aiDefaultModel?: string;
}

export const DEFAULT_PREFERENCES: UserPreferences = {
  language: 'en',
};

// ── Language options (used by Settings UI) ───────────────────
export interface LanguageOption {
  code: string;
  label: string;
}

export const SUPPORTED_LANGUAGES: LanguageOption[] = [
  { code: 'en', label: 'English' },
  { code: 'es', label: 'Español' },
  { code: 'zh', label: '中文' },
  { code: 'fr', label: 'Français' },
  { code: 'de', label: 'Deutsch' },
  { code: 'ja', label: '日本語' },
  { code: 'ko', label: '한국어' },
  { code: 'pt', label: 'Português' },
  { code: 'ar', label: 'العربية' },
  { code: 'hi', label: 'हिन्दी' },
];

// ── Storage helpers ───────────────────────────────────────────

function readPreferences(): UserPreferences {
  if (typeof window === 'undefined') return DEFAULT_PREFERENCES;
  try {
    const raw = localStorage.getItem(PREFS_KEY);
    if (!raw) return DEFAULT_PREFERENCES;
    return { ...DEFAULT_PREFERENCES, ...JSON.parse(raw) };
  } catch {
    return DEFAULT_PREFERENCES;
  }
}

function writePreferences(prefs: UserPreferences): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(PREFS_KEY, JSON.stringify(prefs));
  } catch { /* ignore storage errors */ }
}

// ── Primary hook ──────────────────────────────────────────────

export function useUserPreferences() {
  const [prefs, setPrefsState] = useState<UserPreferences>(DEFAULT_PREFERENCES);

  useEffect(() => {
    setPrefsState(readPreferences());
  }, []);

  const setPreferences = useCallback((updates: Partial<UserPreferences>) => {
    setPrefsState((prev: UserPreferences) => {
      const next = { ...prev, ...updates };
      writePreferences(next);
      return next;
    });
  }, []);

  // Convenience setter for a single key
  const setPref = useCallback(<K extends keyof UserPreferences>(
    key: K,
    value: UserPreferences[K]
  ) => {
    setPreferences({ [key]: value } as Partial<UserPreferences>);
  }, [setPreferences]);

  return { prefs, setPreferences, setPref };
}

// ── Backward-compatible language-specific hook ────────────────
// Keeps existing call sites working without changes.
// This is a thin wrapper — no logic duplication.

export const LANGUAGE_PREF_KEY = PREFS_KEY; // alias for documentation clarity

export function getLanguageInstruction(code: string): string {
  if (!code || code === 'en') return '';
  const lang = SUPPORTED_LANGUAGES.find((l) => l.code === code);
  const name = lang?.label ?? code;
  return `Respond in ${name} (${code}). All output must be in ${name}.`;
}

export function useLanguagePreference() {
  const { prefs, setPref } = useUserPreferences();
  const language = prefs.language;
  const setLanguage = useCallback((code: string) => setPref('language', code), [setPref]);
  const languageInstruction = getLanguageInstruction(language);
  return { language, setLanguage, languageInstruction };
}
