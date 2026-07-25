// ============================================================
// useSpeechInput — Phase 13: Voice Layer
// Web Speech API wrapper. No external dependencies.
// Guards against browsers without SpeechRecognition support.
// ============================================================

import { useState, useRef, useCallback, useEffect } from 'react';

export type SpeechState = 'idle' | 'listening' | 'processing' | 'error';

interface SpeechInputOptions {
  /** Called with each interim + final transcript as the user speaks */
  onTranscript?: (text: string, isFinal: boolean) => void;
  /** Called when recognition ends with a final transcript */
  onFinal?: (text: string) => void;
  /** Called on error */
  onError?: (error: string) => void;
  language?: string;
  continuous?: boolean;
}

export function useSpeechInput(options: SpeechInputOptions = {}) {
  const [state, setState] = useState<SpeechState>('idle');
  const [transcript, setTranscript] = useState('');
  const [supported, setSupported] = useState(false);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const recognitionRef = useRef<any>(null);
  const finalRef = useRef('');

  useEffect(() => {
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    setSupported(!!SR);
  }, []);

  const start = useCallback(() => {
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SR) { options.onError?.('Speech recognition not supported in this browser'); return; }

    // Stop any active session first
    recognitionRef.current?.abort();

    const recognition = new SR() as any;
    recognition.lang = options.language ?? 'en-US';
    recognition.continuous = options.continuous ?? false;
    recognition.interimResults = true;
    recognition.maxAlternatives = 1;

    finalRef.current = '';

    recognition.onstart = () => {
      setState('listening');
      setTranscript('');
    };

    recognition.onresult = (event: SpeechRecognitionEvent) => {
      let interim = '';
      let final = '';
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i];
        if (result.isFinal) {
          final += result[0].transcript;
        } else {
          interim += result[0].transcript;
        }
      }
      if (final) {
        finalRef.current += final;
        setTranscript(finalRef.current);
        options.onTranscript?.(finalRef.current, true);
      } else if (interim) {
        setTranscript(finalRef.current + interim);
        options.onTranscript?.(finalRef.current + interim, false);
      }
    };

    recognition.onend = () => {
      setState('idle');
      if (finalRef.current.trim()) {
        options.onFinal?.(finalRef.current.trim());
      }
      setTranscript('');
      finalRef.current = '';
    };

    recognition.onerror = (event: SpeechRecognitionErrorEvent) => {
      const msg = event.error === 'no-speech'
        ? 'No speech detected'
        : event.error === 'not-allowed'
        ? 'Microphone access denied'
        : `Voice error: ${event.error}`;
      setState('error');
      options.onError?.(msg);
      setTimeout(() => setState('idle'), 2000);
    };

    recognitionRef.current = recognition;
    recognition.start();
  }, [options]);

  const stop = useCallback(() => {
    recognitionRef.current?.stop();
    setState('idle');
  }, []);

  const toggle = useCallback(() => {
    if (state === 'listening') stop();
    else start();
  }, [state, start, stop]);

  // Cleanup on unmount
  useEffect(() => () => { recognitionRef.current?.abort(); }, []);

  return { state, transcript, supported, start, stop, toggle };
}
