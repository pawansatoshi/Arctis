// Re-export from the central preferences module.
// Existing import paths (@/lib/hooks/useLanguagePreference) continue to work.
export {
  useLanguagePreference,
  useUserPreferences,
  getLanguageInstruction,
  SUPPORTED_LANGUAGES,
  LANGUAGE_PREF_KEY,
  DEFAULT_PREFERENCES,
} from '@/lib/preferences';
export type { UserPreferences, LanguageOption } from '@/lib/preferences';
