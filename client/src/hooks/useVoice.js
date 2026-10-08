import { useCallback, useEffect, useRef, useState } from 'react';

// Browser Web Speech API wrapper for the voice call simulator (feature 1).
// speechSynthesis (customer voice) + SpeechRecognition (agent mic).
// Supported on Chrome/Edge desktop; everything else falls back to Text mode.

const SpeechRecognition = typeof window !== 'undefined' && (window.SpeechRecognition || window.webkitSpeechRecognition);
const hasTTS = typeof window !== 'undefined' && 'speechSynthesis' in window;
const hasSTT = !!SpeechRecognition;

// Customer delivery by mood: [rate, pitch].
export const MOOD_PRESETS = {
  calm: { rate: 1.0, pitch: 1.0 },
  confused: { rate: 0.9, pitch: 1.0 },
  frustrated: { rate: 1.1, pitch: 1.05 },
  irate: { rate: 1.2, pitch: 1.1 },
};

const PRIMARY_LANG = 'en-PH';
const FALLBACK_LANG = 'en-US';

export default function useVoice() {
  const isSupported = hasTTS && hasSTT;

  const [listening, setListening] = useState(false);
  const [speaking, setSpeaking] = useState(false);
  const [interimText, setInterimText] = useState('');
  const [finalText, setFinalText] = useState('');
  const [error, setError] = useState(null); // 'not-allowed' | 'no-speech' | 'network' | 'aborted' | ...

  const recognitionRef = useRef(null);
  const utteranceRef = useRef(null);
  const voicesRef = useRef([]);

  // Keep the available TTS voices up to date (they load asynchronously).
  useEffect(() => {
    if (!hasTTS) return undefined;
    const load = () => {
      voicesRef.current = window.speechSynthesis.getVoices() || [];
    };
    load();
    window.speechSynthesis.addEventListener?.('voiceschanged', load);
    return () => window.speechSynthesis.removeEventListener?.('voiceschanged', load);
  }, []);

  // Prefer an English voice; favour "Female" or "Philippines" when offered.
  const pickVoice = useCallback(() => {
    const voices = voicesRef.current || [];
    const en = voices.filter((v) => /^en/i.test(v.lang));
    return (
      en.find((v) => /philippines|filipino|\ben-ph\b/i.test(`${v.name} ${v.lang}`)) ||
      en.find((v) => /female/i.test(v.name)) ||
      en.find((v) => /en-US/i.test(v.lang)) ||
      en[0] ||
      voices[0] ||
      null
    );
  }, []);

  // Speak a line. Resolves when the voice finishes (or errors). Never rejects.
  const speak = useCallback(
    (text, { mood, rate, pitch, lang } = {}) =>
      new Promise((resolve) => {
        if (!hasTTS || !text) {
          resolve();
          return;
        }
        window.speechSynthesis.cancel(); // stop anything currently speaking
        const preset = (mood && MOOD_PRESETS[mood]) || {};
        const u = new SpeechSynthesisUtterance(String(text));
        u.rate = rate ?? preset.rate ?? 1.0;
        u.pitch = pitch ?? preset.pitch ?? 1.0;
        u.lang = lang || PRIMARY_LANG;
        const v = pickVoice();
        if (v) u.voice = v;
        u.onend = () => {
          setSpeaking(false);
          resolve();
        };
        u.onerror = () => {
          setSpeaking(false);
          resolve();
        };
        utteranceRef.current = u;
        setSpeaking(true);
        window.speechSynthesis.speak(u);
      }),
    [pickVoice]
  );

  const cancel = useCallback(() => {
    if (hasTTS) window.speechSynthesis.cancel();
    setSpeaking(false);
  }, []);

  const reset = useCallback(() => {
    setInterimText('');
    setFinalText('');
    setError(null);
  }, []);

  const startListening = useCallback(() => {
    if (!hasSTT) {
      setError('not-supported');
      return;
    }
    // Abort any previous session before starting a new one.
    if (recognitionRef.current) {
      try {
        recognitionRef.current.abort();
      } catch {
        /* ignore */
      }
    }
    const rec = new SpeechRecognition();
    rec.lang = PRIMARY_LANG;
    rec.continuous = false;
    rec.interimResults = true;
    rec.maxAlternatives = 1;

    rec.onstart = () => {
      setError(null);
      setInterimText('');
      setListening(true);
    };
    rec.onresult = (event) => {
      let interim = '';
      let final = '';
      for (let i = event.resultIndex; i < event.results.length; i += 1) {
        const chunk = event.results[i][0].transcript;
        if (event.results[i].isFinal) final += chunk;
        else interim += chunk;
      }
      if (interim) setInterimText(interim);
      if (final) {
        setFinalText((prev) => (prev ? `${prev} ${final}`.trim() : final.trim()));
        setInterimText('');
      }
    };
    rec.onerror = (event) => {
      // If en-PH isn't supported, retry once in en-US.
      if (event.error === 'language-not-supported' && rec.lang !== FALLBACK_LANG) {
        rec.lang = FALLBACK_LANG;
        try {
          rec.start();
          return;
        } catch {
          /* fall through */
        }
      }
      setError(event.error || 'unknown');
      setListening(false);
    };
    rec.onend = () => setListening(false);

    recognitionRef.current = rec;
    try {
      rec.start();
    } catch (err) {
      setError(err?.message || 'start-failed');
      setListening(false);
    }
  }, []);

  const stopListening = useCallback(() => {
    try {
      recognitionRef.current?.stop();
    } catch {
      /* ignore */
    }
  }, []);

  // Cleanup: stop all speech and recognition when the component unmounts.
  useEffect(
    () => () => {
      if (hasTTS) window.speechSynthesis.cancel();
      if (recognitionRef.current) {
        try {
          recognitionRef.current.abort();
        } catch {
          /* ignore */
        }
      }
    },
    []
  );

  return {
    isSupported,
    supports: { tts: hasTTS, stt: hasSTT },
    speak,
    cancel,
    startListening,
    stopListening,
    reset,
    listening,
    speaking,
    interimText,
    finalText,
    error,
    MOOD_PRESETS,
  };
}
