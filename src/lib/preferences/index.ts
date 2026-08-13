// ============================================================
// User Preferences — Phase 14
// ============================================================
import { useState, useEffect, useCallback } from 'react';
const PREFS_KEY = 'arctis:preferences:v1';
export interface UserPreferences { language: string; voiceEnabled: boolean; }
export const DEFAULT_PREFERENCES: UserPreferences = { language: 'en', voiceEnabled: true };
export interface LanguageOption { code: string; label: string; }
export const SUPPORTED_LANGUAGES: LanguageOption[] = [
  {code:'en',label:'English'},{code:'es',label:'Español'},{code:'zh',label:'中文'},{code:'fr',label:'Français'},{code:'de',label:'Deutsch'},{code:'ja',label:'日本語'},{code:'ko',label:'한국어'},{code:'pt',label:'Português'},{code:'ar',label:'العربية'},{code:'hi',label:'हिन्दी'},{code:'vi',label:'Tiếng Việt'},{code:'sw',label:'Kiswahili'},
];
function readPreferences(): UserPreferences { if(typeof window==='undefined') return DEFAULT_PREFERENCES; try{const raw=localStorage.getItem(PREFS_KEY);if(!raw)return DEFAULT_PREFERENCES;return {...DEFAULT_PREFERENCES,...JSON.parse(raw)};}catch{return DEFAULT_PREFERENCES;} }
function writePreferences(prefs:UserPreferences){if(typeof window==='undefined')return;try{localStorage.setItem(PREFS_KEY,JSON.stringify(prefs));}catch{}}
export function useUserPreferences(){const[prefs,setPrefsState]=useState<UserPreferences>(DEFAULT_PREFERENCES);useEffect(()=>setPrefsState(readPreferences()),[]);const setPreferences=useCallback((updates:Partial<UserPreferences>)=>setPrefsState(prev=>{const next={...prev,...updates};writePreferences(next);return next;}),[]);const setPref=useCallback(<K extends keyof UserPreferences>(key:K,value:UserPreferences[K])=>setPreferences({[key]:value} as Partial<UserPreferences>),[setPreferences]);return{prefs,setPreferences,setPref};}
export const LANGUAGE_PREF_KEY=PREFS_KEY;
export function getLanguageInstruction(code:string){if(!code||code==='en')return '';const lang=SUPPORTED_LANGUAGES.find(l=>l.code===code);return `Respond in ${lang?.label??code} (${code}). All output must be in ${lang?.label??code}.`;}
export function useLanguagePreference(){const{prefs,setPref}=useUserPreferences();const language=prefs.language;const setLanguage=useCallback((code:string)=>setPref('language',code),[setPref]);return{language,setLanguage,languageInstruction:getLanguageInstruction(language)};}
