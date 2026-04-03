/**
 * PhonicsSpellGame.jsx
 * Jolly Phonics Segmentation & Blending Mini-Game
 *
 * Flow: Show word → segment each phoneme (kid says "sss", "ah", "tuh") → blend ("sat")
 * Uses Azure Pronunciation Assessment for scoring + MAI-Voice-1 for reference sounds.
 * Falls back gracefully when Azure keys are missing (dev mode).
 */

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Mic, Volume2, Star, ArrowRight, Sparkles } from 'lucide-react';
import GameControlBar from '../../shared/GameControlBar';
import GameResultCard from '../../shared/GameResultCard';
import GummyButton from '../../shared/GummyButton';
import GlassHUD from '../../shared/GlassHUD';
import { playVO, stopVO, delay } from '../../../utils/audioPlayer';
import { playLetterSound, stopAllAudio, getDisplaySound } from '../../../utils/letterSounds';
import { triggerCelebration, triggerSmallBurst } from '../../../utils/confetti';
import { playEncouragement } from '../../../utils/encouragement';
import { playCorrectSfx, playWrongSfx } from '../../../utils/sfx';

// ─── Constants ────────────────────────────────────────────────────────────────

// Azure keys loaded at runtime — never baked into the build bundle.
// In production, set these via window.__AZURE_CONFIG__ or fetch from a backend.
// In dev, read from .env via import.meta.env (only available during dev server, not in built output).
const getAzureConfig = () => {
  // Runtime config (for production — set by a script tag or API call)
  if (window.__AZURE_CONFIG__) return window.__AZURE_CONFIG__;
  // Dev mode — Vite injects these only during dev server
  if (import.meta.env.DEV) {
    return {
      key: import.meta.env.VITE_AZURE_SPEECH_KEY || '',
      region: import.meta.env.VITE_AZURE_SPEECH_REGION || 'southeastasia',
      endpoint: import.meta.env.VITE_AZURE_ENDPOINT || '',
    };
  }
  return { key: '', region: 'southeastasia', endpoint: '' };
};

const AZURE = getAzureConfig();
const AZURE_KEY = AZURE.key;
const AZURE_REGION = AZURE.region;
const AZURE_ENDPOINT = AZURE.endpoint;

const WORDS_PER_SESSION = 3;
const PASS_THRESHOLD = 55;
const MAX_ATTEMPTS = 2;

const PHASE = { INTRO: 'intro', SEGMENT: 'segment', BLEND: 'blend', COMPLETE: 'complete' };

// ─── Jolly Phonics Digraphs/Trigraphs (order matters — longest first) ────────

const DIGRAPHS = [
  'igh', 'thr', 'shr', 'sch',
  'th', 'sh', 'ch', 'wh', 'ph', 'ck', 'qu', 'ng',
  'ai', 'ee', 'oo', 'ou', 'ow', 'ew', 'oi', 'oy',
  'ar', 'or', 'er', 'ir', 'ur',
  'oa', 'ie', 'ue', 'ay', 'al', 'au', 'aw',
];

/**
 * Split a word into Jolly Phonics phonemes.
 * "chat" → ["ch", "a", "t"], "ship" → ["sh", "i", "p"], "cat" → ["c", "a", "t"]
 */
function wordToPhonemes(word, groupSounds = []) {
  const w = word.toLowerCase();
  const phonemes = [];
  let i = 0;
  while (i < w.length) {
    let matched = false;
    // Try longest digraph/trigraph first
    for (const dg of DIGRAPHS) {
      if (w.substring(i, i + dg.length) === dg) {
        phonemes.push(dg);
        i += dg.length;
        matched = true;
        break;
      }
    }
    if (!matched) {
      phonemes.push(w[i]);
      i++;
    }
  }
  return phonemes;
}

// ─── Azure Speech SDK (lazy loaded) ──────────────────────────────────────────

let SpeechSDK = null;
let sdkLoadPromise = null;

async function loadSpeechSDK() {
  if (SpeechSDK) return SpeechSDK;
  if (sdkLoadPromise) return sdkLoadPromise;
  sdkLoadPromise = import('microsoft-cognitiveservices-speech-sdk').then((mod) => {
    SpeechSDK = mod;
    return mod;
  }).catch((e) => {
    console.warn('Azure Speech SDK not available:', e);
    return null;
  });
  return sdkLoadPromise;
}

// ─── MAI-Voice-1 TTS via Azure Speech SDK ────────────────────────────────────

async function speakWithMAI(text) {
  if (!AZURE_KEY || !AZURE_ENDPOINT) {
    // Dev fallback: use browser TTS
    return new Promise((resolve) => {
      const utter = new SpeechSynthesisUtterance(text);
      utter.rate = 0.7;
      utter.onend = resolve;
      utter.onerror = resolve;
      window.speechSynthesis.speak(utter);
    });
  }

  const sdk = await loadSpeechSDK();
  if (!sdk) {
    // SDK failed to load, use browser TTS
    return new Promise((resolve) => {
      const utter = new SpeechSynthesisUtterance(text);
      utter.rate = 0.7;
      utter.onend = resolve;
      utter.onerror = resolve;
      window.speechSynthesis.speak(utter);
    });
  }

  return new Promise((resolve) => {
    const speechConfig = sdk.SpeechConfig.fromEndpoint(new URL(AZURE_ENDPOINT), AZURE_KEY);
    speechConfig.speechSynthesisVoiceName = 'en-US-Grant:MAI-Voice-1';
    const synthesizer = new sdk.SpeechSynthesizer(speechConfig);

    synthesizer.speakTextAsync(
      text,
      (result) => {
        synthesizer.close();
        resolve();
      },
      (error) => {
        console.warn('MAI-Voice-1 error, falling back to browser TTS:', error);
        synthesizer.close();
        const utter = new SpeechSynthesisUtterance(text);
        utter.rate = 0.7;
        utter.onend = resolve;
        utter.onerror = resolve;
        window.speechSynthesis.speak(utter);
      }
    );
  });
}

// ─── Azure Pronunciation Assessment ──────────────────────────────────────────

async function assessPronunciation(expectedText, timeoutMs = 6000) {
  if (!AZURE_KEY) {
    // Dev mode: simulate passing score after delay
    await delay(1200);
    return { score: 75 + Math.random() * 20, passed: true, phonemeResults: [] };
  }

  const sdk = await loadSpeechSDK();
  if (!sdk) {
    await delay(1000);
    return { score: 80, passed: true, phonemeResults: [] };
  }

  return new Promise((resolve) => {
    const speechConfig = sdk.SpeechConfig.fromSubscription(AZURE_KEY, AZURE_REGION);
    speechConfig.speechRecognitionLanguage = 'en-US';
    const audioConfig = sdk.AudioConfig.fromDefaultMicrophoneInput();

    const pronConfig = new sdk.PronunciationAssessmentConfig(
      expectedText,
      sdk.PronunciationAssessmentGradingSystem.HundredMark,
      sdk.PronunciationAssessmentGranularity.Phoneme,
      false
    );

    const recognizer = new sdk.SpeechRecognizer(speechConfig, audioConfig);
    pronConfig.applyTo(recognizer);

    const timer = setTimeout(() => {
      try { recognizer.stopContinuousRecognitionAsync(); } catch (e) {}
      resolve({ score: 0, passed: false, phonemeResults: [], timedOut: true });
    }, timeoutMs);

    recognizer.recognizeOnceAsync(
      (result) => {
        clearTimeout(timer);
        recognizer.close();
        if (result.reason === sdk.ResultReason.RecognizedSpeech) {
          const pronResult = sdk.PronunciationAssessmentResult.fromResult(result);
          const score = pronResult.accuracyScore ?? 0;
          let phonemeResults = [];
          try {
            const json = JSON.parse(
              result.properties.getProperty(sdk.PropertyId.SpeechServiceResponse_JsonResult)
            );
            phonemeResults = json?.NBest?.[0]?.Words?.[0]?.Phonemes ?? [];
          } catch (_) {}
          resolve({ score, passed: score >= PASS_THRESHOLD, phonemeResults });
        } else {
          resolve({ score: 0, passed: false, phonemeResults: [], noSpeech: true });
        }
      },
      (error) => {
        clearTimeout(timer);
        try { recognizer.close(); } catch (_) {}
        resolve({ score: 0, passed: false, phonemeResults: [], error: true });
      }
    );
  });
}

// ─── Microphone Permission ───────────────────────────────────────────────────

async function requestMicPermission() {
  try {
    if (!navigator.mediaDevices?.getUserMedia) {
      // No mic API (HTTP or unsupported browser) — allow dev mode to proceed
      console.warn('MediaDevices API not available (need HTTPS). Proceeding in dev mode.');
      return true;
    }
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    stream.getTracks().forEach((t) => t.stop());
    return true;
  } catch (e) {
    console.warn('Mic permission denied:', e);
    return false;
  }
}

// ─── Letter Bubble Component ─────────────────────────────────────────────────

const BUBBLE_COLORS = {
  waiting: { bg: 'rgba(255,255,255,0.2)', border: 'rgba(255,255,255,0.3)', text: 'rgba(255,255,255,0.5)' },
  active: { bg: 'linear-gradient(180deg, #FFE55C 0%, #FFD000 100%)', border: '#FFF', text: 'var(--text-dark)' },
  recording: { bg: 'linear-gradient(180deg, #FF6B9D 0%, #E60023 100%)', border: '#FFF', text: '#FFF' },
  pass: { bg: 'linear-gradient(180deg, #34D399 0%, #22C55E 100%)', border: '#FFF', text: '#FFF' },
  fail: { bg: 'linear-gradient(180deg, #FCA5A5 0%, #EF4444 100%)', border: '#FFF', text: '#FFF' },
};

const LetterBubble = ({ letter, phoneme, state, index }) => {
  const colors = BUBBLE_COLORS[state] || BUBBLE_COLORS.waiting;
  return (
    <motion.div
      initial={{ scale: 0, y: 20 }}
      animate={{ scale: 1, y: 0 }}
      transition={{ delay: index * 0.1, type: 'spring', bounce: 0.6 }}
      className="flex flex-col items-center gap-1"
    >
      <motion.div
        className="flex items-center justify-center relative overflow-hidden"
        animate={
          state === 'recording' ? { scale: [1, 1.08, 1] } :
          state === 'pass' ? { scale: [1, 1.12, 1] } :
          state === 'active' ? { scale: [1, 1.04, 1] } : {}
        }
        transition={
          state === 'recording' ? { duration: 0.6, repeat: Infinity } :
          state === 'pass' ? { duration: 0.4 } :
          state === 'active' ? { duration: 2, repeat: Infinity, ease: 'easeInOut' } : {}
        }
        style={{
          width: 'clamp(52px, 12vh, 80px)',
          height: 'clamp(52px, 12vh, 80px)',
          borderRadius: 'clamp(1rem, 3vh, 1.6rem)',
          background: colors.bg,
          border: `clamp(2px, 0.5vh, 4px) solid ${colors.border}`,
          boxShadow: state === 'active'
            ? '0 clamp(3px, 1vh, 6px) 0 #D4A000, 0 clamp(4px, 1.5vh, 10px) rgba(0,0,0,0.2)'
            : state === 'pass'
            ? '0 clamp(3px, 1vh, 6px) 0 #16A34A, 0 clamp(4px, 1.5vh, 10px) rgba(0,0,0,0.2)'
            : '0 clamp(2px, 0.5vh, 4px) 0 rgba(0,0,0,0.15)',
          color: colors.text,
          fontFamily: 'Fredoka, sans-serif',
          fontWeight: 900,
          fontSize: 'clamp(1.5rem, 5vh, 2.5rem)',
          textTransform: 'lowercase',
        }}
      >
        {state !== 'waiting' && (
          <div className="absolute top-0 left-[15%] right-[15%] h-[25%] bg-white/30 rounded-full pointer-events-none" />
        )}
        {letter}
      </motion.div>
      {/* Phoneme label */}
      <AnimatePresence>
        {(state === 'active' || state === 'recording' || state === 'pass') && (
          <motion.span
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="font-bold text-white/80"
            style={{ fontSize: 'clamp(0.6rem, 2vh, 0.85rem)' }}
          >
            {state === 'pass' && '✓ '}{getDisplaySound(phoneme)}
          </motion.span>
        )}
      </AnimatePresence>
    </motion.div>
  );
};

// ─── Star Score Component ────────────────────────────────────────────────────

const StarScore = ({ score }) => {
  const stars = score >= 90 ? 3 : score >= 70 ? 2 : score >= PASS_THRESHOLD ? 1 : 0;
  return (
    <div className="flex gap-1">
      {[1, 2, 3].map((i) => (
        <motion.div key={i}
          initial={{ scale: 0 }}
          animate={{ scale: i <= stars ? 1 : 0.5 }}
          transition={{ delay: i * 0.15, type: 'spring', stiffness: 300 }}
          style={{ opacity: i <= stars ? 1 : 0.2 }}
        >
          <Star className="text-[#FFD000]" style={{ width: 'clamp(20px, 4vh, 32px)', height: 'clamp(20px, 4vh, 32px)' }} fill={i <= stars ? '#FFD000' : 'none'} />
        </motion.div>
      ))}
    </div>
  );
};

// ─── Main Game Component ─────────────────────────────────────────────────────

const PhonicsSpellGameInner = ({ group, onBack, onPlayAgain }) => {
  // Build session words with phoneme data
  const [sessionWords] = useState(() => {
    if (!group?.words?.length) return [];
    const wordsWithPhonemes = group.words
      .filter((w) => w.word && w.word.length > 0)
      .map((w) => ({
        ...w,
        phonemes: wordToPhonemes(w.word, group.sounds),
        letters: wordToPhonemes(w.word, group.sounds),
      }));
    const shuffled = [...wordsWithPhonemes].sort(() => Math.random() - 0.5);
    return shuffled.slice(0, WORDS_PER_SESSION);
  });

  const [wordIndex, setWordIndex] = useState(0);
  const [phase, setPhase] = useState(PHASE.INTRO);
  const [phonemeIndex, setPhonemeIndex] = useState(0);
  const [letterStates, setLetterStates] = useState([]);
  const [listening, setListening] = useState(false);
  const [micAllowed, setMicAllowed] = useState(null); // null = unknown
  const [currentWordScores, setCurrentWordScores] = useState([]);
  const [blendScore, setBlendScore] = useState(null);
  const [feedback, setFeedback] = useState(null);
  const [sessionResults, setSessionResults] = useState([]);
  const [attempts, setAttempts] = useState(0);
  const [gameComplete, setGameComplete] = useState(false);

  const mountedRef = useRef(true);
  const currentWord = sessionWords[wordIndex];

  useEffect(() => {
    mountedRef.current = true;
    // Preload SDK in background
    loadSpeechSDK();
    return () => {
      mountedRef.current = false;
      window.speechSynthesis.cancel();
      stopAllAudio();
      stopVO();
    };
  }, []);

  // Init letter states when word changes
  useEffect(() => {
    if (!currentWord) return;
    setLetterStates(currentWord.phonemes.map(() => 'waiting'));
    setPhonemeIndex(0);
    setCurrentWordScores([]);
    setBlendScore(null);
    setFeedback(null);
    setAttempts(0);
  }, [wordIndex, currentWord]);

  // Activate first letter when segment phase starts
  useEffect(() => {
    if (phase !== PHASE.SEGMENT || !currentWord) return;
    setLetterStates((prev) => {
      const next = [...prev];
      next[0] = 'active';
      return next;
    });
    // Play the phoneme sound as demo
    const timer = setTimeout(() => {
      playLetterSound(currentWord.phonemes[0]);
    }, 500);
    return () => clearTimeout(timer);
  }, [phase, wordIndex]); // eslint-disable-line react-hooks/exhaustive-deps

  const updateLetterState = useCallback((idx, state) => {
    setLetterStates((prev) => {
      const next = [...prev];
      next[idx] = state;
      return next;
    });
  }, []);

  const showFeedbackMsg = useCallback((text, type = 'info') => {
    setFeedback({ text, type });
    setTimeout(() => { if (mountedRef.current) setFeedback(null); }, 2500);
  }, []);

  // ── Start game (request mic if needed) ──
  const handleStart = useCallback(async () => {
    const allowed = await requestMicPermission();
    setMicAllowed(allowed);
    // Always proceed to segment phase — dev mode works without mic
    setPhase(PHASE.SEGMENT);
    if (!allowed && AZURE_KEY) {
      showFeedbackMsg('Microphone access needed for scoring.', 'warn');
    }
  }, [showFeedbackMsg]);

  // ── Record a phoneme ──
  const handleRecordPhoneme = useCallback(async () => {
    if (listening || !currentWord) return;
    const expected = currentWord.phonemes[phonemeIndex];
    setListening(true);
    updateLetterState(phonemeIndex, 'recording');

    const result = await assessPronunciation(expected, 6000);
    if (!mountedRef.current) return;
    setListening(false);

    if (result.timedOut || result.noSpeech) {
      updateLetterState(phonemeIndex, 'active');
      showFeedbackMsg("I didn't hear you! Try again.", 'warn');
      return;
    }

    setCurrentWordScores((prev) => [...prev, result.score]);

    if (result.passed) {
      updateLetterState(phonemeIndex, 'pass');
      playCorrectSfx();
      showFeedbackMsg(result.score >= 90 ? 'Amazing!' : 'Good job!', 'success');
      setAttempts(0);

      const nextIdx = phonemeIndex + 1;
      if (nextIdx >= currentWord.phonemes.length) {
        // All phonemes done → blend phase
        setTimeout(() => {
          if (!mountedRef.current) return;
          setPhase(PHASE.BLEND);
          speakWithMAI(currentWord.word);
        }, 800);
      } else {
        setTimeout(() => {
          if (!mountedRef.current) return;
          setPhonemeIndex(nextIdx);
          updateLetterState(nextIdx, 'active');
          playLetterSound(currentWord.phonemes[nextIdx]);
        }, 700);
      }
    } else {
      const newAttempts = attempts + 1;
      setAttempts(newAttempts);
      updateLetterState(phonemeIndex, 'fail');
      playWrongSfx();

      if (newAttempts >= MAX_ATTEMPTS) {
        // After max fails, give hint and move on
        showFeedbackMsg(`Listen to the sound!`, 'hint');
        await playLetterSound(expected);
        if (!mountedRef.current) return;
        updateLetterState(phonemeIndex, 'pass');
        setAttempts(0);
        const nextIdx = phonemeIndex + 1;
        if (nextIdx >= currentWord.phonemes.length) {
          setTimeout(() => { if (mountedRef.current) setPhase(PHASE.BLEND); }, 1000);
        } else {
          setTimeout(() => {
            if (!mountedRef.current) return;
            setPhonemeIndex(nextIdx);
            updateLetterState(nextIdx, 'active');
            playLetterSound(currentWord.phonemes[nextIdx]);
          }, 1000);
        }
      } else {
        showFeedbackMsg('Try again!', 'retry');
        setTimeout(() => { if (mountedRef.current) updateLetterState(phonemeIndex, 'active'); }, 1200);
      }
    }
  }, [listening, currentWord, phonemeIndex, attempts, updateLetterState, showFeedbackMsg]);

  // ── Record the blend ──
  const handleRecordBlend = useCallback(async () => {
    if (listening || !currentWord) return;
    setListening(true);
    const result = await assessPronunciation(currentWord.word, 6000);
    if (!mountedRef.current) return;
    setListening(false);

    if (result.timedOut || result.noSpeech) {
      showFeedbackMsg("I didn't hear you! Try again.", 'warn');
      return;
    }

    setBlendScore(result.score);

    if (result.passed) {
      triggerSmallBurst();
      playCorrectSfx();
      showFeedbackMsg(result.score >= 90 ? 'Perfect blend!' : 'You blended it!', 'success');
      await playEncouragement();

      const wordResult = {
        word: currentWord.word,
        phonemeScores: currentWordScores,
        blendScore: result.score,
        avgScore: Math.round(
          ([...currentWordScores, result.score].reduce((a, b) => a + b, 0)) / (currentWordScores.length + 1)
        ),
      };
      const newResults = [...sessionResults, wordResult];
      setSessionResults(newResults);

      setTimeout(() => {
        if (!mountedRef.current) return;
        if (wordIndex + 1 < WORDS_PER_SESSION && wordIndex + 1 < sessionWords.length) {
          setWordIndex((i) => i + 1);
          setPhase(PHASE.SEGMENT);
        } else {
          triggerCelebration();
          setGameComplete(true);
        }
      }, 1800);
    } else {
      playWrongSfx();
      showFeedbackMsg(`Almost! Say the whole word: "${currentWord.word}"`, 'retry');
    }
  }, [listening, currentWord, currentWordScores, sessionResults, wordIndex, sessionWords.length, showFeedbackMsg]);

  const handleBack = () => {
    window.speechSynthesis.cancel();
    stopAllAudio();
    stopVO();
    onBack();
  };

  // ── Render ──

  if (gameComplete) {
    return (
      <div className="h-screen w-screen overflow-hidden relative" style={{ background: 'linear-gradient(135deg, #1e1252 0%, #3a2287 100%)' }}>
        <GameControlBar onBack={handleBack} />
        <GameResultCard
          title="Phonics Star!"
          subtitle={`You spelled ${sessionResults.length} words!`}
          accentColor="#8B5CF6"
          icon={Sparkles}
          onPlayAgain={onPlayAgain}
          onBack={handleBack}
        >
          {/* Per-word summary */}
          <div className="flex flex-col gap-2 w-full mt-3">
            {sessionResults.map((r, i) => (
              <motion.div key={i}
                initial={{ x: -20, opacity: 0 }}
                animate={{ x: 0, opacity: 1 }}
                transition={{ delay: i * 0.15 }}
                className="flex items-center justify-between rounded-xl px-3 py-2"
                style={{ background: 'rgba(0,0,0,0.05)' }}
              >
                <span className="font-bold text-[var(--text-dark)] uppercase" style={{ fontSize: 'clamp(0.9rem, 3vh, 1.2rem)' }}>
                  {r.word}
                </span>
                <div className="flex items-center gap-2">
                  <StarScore score={r.avgScore} />
                  <span className="font-bold rounded-lg px-2 py-0.5"
                    style={{
                      fontSize: 'clamp(0.65rem, 2vh, 0.85rem)',
                      color: r.avgScore >= PASS_THRESHOLD ? '#22C55E' : '#EF4444',
                      background: r.avgScore >= PASS_THRESHOLD ? '#22C55E15' : '#EF444415',
                    }}>
                    {Math.round(r.avgScore)}%
                  </span>
                </div>
              </motion.div>
            ))}
          </div>
        </GameResultCard>
      </div>
    );
  }

  return (
    <div className="h-screen w-screen overflow-hidden relative flex items-center justify-center"
      style={{ background: 'linear-gradient(135deg, #1e1252 0%, #3a2287 100%)' }}>

      <GameControlBar onBack={handleBack} />

      {/* Progress dots */}
      <div className="fixed top-3 right-3 z-[60]">
        <GlassHUD variant="pill" className="flex items-center gap-2">
          {sessionWords.map((_, i) => (
            <div key={i} className="rounded-full transition-all"
              style={{
                width: i === wordIndex ? 'clamp(20px, 4vh, 28px)' : 'clamp(8px, 2vh, 12px)',
                height: 'clamp(8px, 2vh, 12px)',
                borderRadius: '999px',
                background: i < wordIndex ? '#22C55E' : i === wordIndex ? '#FFD000' : 'rgba(255,255,255,0.3)',
              }} />
          ))}
        </GlassHUD>
      </div>

      {/* ── Phases ── */}
      <AnimatePresence mode="wait">

        {/* INTRO */}
        {phase === PHASE.INTRO && (
          <motion.div key="intro"
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.8, opacity: 0 }}
            className="flex flex-col items-center gap-6 z-10"
          >
            <motion.div
              animate={{ y: [-4, 4, -4], rotate: [-3, 3, -3] }}
              transition={{ duration: 4, repeat: Infinity, ease: 'easeInOut' }}
              className="flex items-center justify-center rounded-full"
              style={{
                width: 'clamp(70px, 15vh, 110px)', height: 'clamp(70px, 15vh, 110px)',
                background: 'rgba(139,92,246,0.2)', border: '3px solid rgba(139,92,246,0.3)',
              }}
            >
              <Mic className="text-[#A78BFA]" style={{ width: '50%', height: '50%' }} />
            </motion.div>

            <h1 className="font-black text-white text-center" style={{ fontSize: 'clamp(1.5rem, 6vh, 2.5rem)' }}>
              Say the Sounds!
            </h1>
            <p className="text-white/60 font-semibold text-center max-w-md" style={{ fontSize: 'clamp(0.8rem, 2.5vh, 1.1rem)' }}>
              Say each letter sound one by one, then blend them into the word!
            </p>

            <GummyButton variant="yellow" onClick={handleStart}>
              <Mic style={{ width: 20, height: 20 }} className="mr-2" />
              Let's Go!
            </GummyButton>

            {micAllowed === false && (
              <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                className="text-red-400 font-bold text-sm text-center">
                Microphone access required. Please allow it in your browser settings.
              </motion.p>
            )}
          </motion.div>
        )}

        {/* SEGMENT */}
        {phase === PHASE.SEGMENT && currentWord && (
          <motion.div key={`segment-${wordIndex}`}
            initial={{ x: 60, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: -60, opacity: 0 }}
            transition={{ type: 'spring', stiffness: 260, damping: 22 }}
            className="flex flex-row items-center gap-8 z-10 w-full max-w-4xl px-6"
          >
            {/* Left: instruction + letters */}
            <div className="flex flex-col items-center gap-4 flex-1">
              <GlassHUD variant="pill">
                <p className="text-white font-bold text-center" style={{ fontSize: 'clamp(0.7rem, 2.5vh, 1rem)' }}>
                  Tap the letter, then say its sound!
                </p>
              </GlassHUD>

              {/* Letter bubbles */}
              <div className="flex gap-3 items-end flex-wrap justify-center">
                {currentWord.phonemes.map((phoneme, i) => (
                  <div key={i} onClick={() => {
                    if (letterStates[i] === 'active' && !listening) handleRecordPhoneme();
                  }} style={{ cursor: letterStates[i] === 'active' ? 'pointer' : 'default' }}>
                    <LetterBubble
                      letter={phoneme}
                      phoneme={phoneme}
                      state={letterStates[i] || 'waiting'}
                      index={i}
                    />
                  </div>
                ))}
              </div>
            </div>

            {/* Right: mic controls */}
            <div className="flex flex-col items-center gap-3">
              {letterStates[phonemeIndex] === 'active' && (
                <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                  className="text-white/70 font-bold text-center" style={{ fontSize: 'clamp(0.7rem, 2.5vh, 0.95rem)' }}>
                  Say: <span className="text-[#FFD000]">"{getDisplaySound(currentWord.phonemes[phonemeIndex])}"</span>
                </motion.p>
              )}

              {/* Mic button */}
              <GummyButton
                variant={listening ? 'purple' : 'yellow'}
                shape="circle"
                size="clamp(56px, 14vh, 80px)"
                onClick={handleRecordPhoneme}
                disabled={!letterStates.includes('active') || listening}
              >
                <Mic style={{ width: '45%', height: '45%' }} />
              </GummyButton>

              {/* Hear sound button */}
              <GummyButton
                variant="ghost"
                shape="circle"
                size="clamp(40px, 9vh, 56px)"
                onClick={() => playLetterSound(currentWord.phonemes[phonemeIndex])}
                disabled={listening}
              >
                <Volume2 style={{ width: '45%', height: '45%' }} className="text-white" />
              </GummyButton>
            </div>
          </motion.div>
        )}

        {/* BLEND */}
        {phase === PHASE.BLEND && currentWord && (
          <motion.div key={`blend-${wordIndex}`}
            initial={{ scale: 0.85, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.85, opacity: 0 }}
            transition={{ type: 'spring', stiffness: 240, damping: 20 }}
            className="flex flex-col items-center gap-5 z-10"
          >
            <GlassHUD variant="pill">
              <p className="text-white font-bold" style={{ fontSize: 'clamp(0.7rem, 2.5vh, 1rem)' }}>
                Now blend it all together!
              </p>
            </GlassHUD>

            <p className="text-white/50 font-bold" style={{ fontSize: 'clamp(0.7rem, 2vh, 0.9rem)' }}>
              {currentWord.phonemes.map((p) => getDisplaySound(p)).join(' - ')} = ?
            </p>

            {/* Big word display */}
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ type: 'spring', stiffness: 300, delay: 0.2 }}
              className="relative overflow-hidden"
              style={{
                background: 'linear-gradient(145deg, rgba(255,255,255,1) 0%, rgba(245,245,255,1) 100%)',
                borderRadius: 'clamp(1.2rem, 4vh, 2.5rem)',
                border: 'clamp(3px, 0.8vh, 5px) solid #8B5CF6',
                padding: 'clamp(12px, 3vh, 24px) clamp(28px, 7vh, 56px)',
                boxShadow: '0 clamp(4px, 1.5vh, 8px) 0 #5B21B6, 0 clamp(6px, 2vh, 15px) rgba(0,0,0,0.2), inset 0 2px 0 rgba(255,255,255,0.9)',
              }}
            >
              <div className="absolute top-0 left-[15%] right-[15%] h-[20%] bg-white/50 rounded-full pointer-events-none" />
              <span className="font-black text-[var(--text-dark)] uppercase" style={{ fontSize: 'clamp(2.5rem, 10vh, 4.5rem)', letterSpacing: 6 }}>
                {currentWord.word}
              </span>
            </motion.div>

            {/* Controls row */}
            <div className="flex items-center gap-4">
              <GummyButton
                variant={listening ? 'purple' : 'green'}
                shape="circle"
                size="clamp(56px, 14vh, 80px)"
                onClick={handleRecordBlend}
                disabled={listening}
              >
                <Mic style={{ width: '45%', height: '45%' }} />
              </GummyButton>

              <GummyButton
                variant="ghost"
                shape="circle"
                size="clamp(40px, 9vh, 56px)"
                onClick={() => speakWithMAI(currentWord.word)}
                disabled={listening}
              >
                <Volume2 style={{ width: '45%', height: '45%' }} className="text-white" />
              </GummyButton>
            </div>

            {blendScore !== null && (
              <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} className="flex flex-col items-center gap-1">
                <StarScore score={blendScore} />
                <span className="text-white/60 font-bold" style={{ fontSize: 'clamp(0.65rem, 2vh, 0.85rem)' }}>
                  Score: {Math.round(blendScore)}
                </span>
              </motion.div>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Floating feedback toast */}
      <AnimatePresence>
        {feedback && (
          <motion.div key="feedback"
            initial={{ y: 40, opacity: 0, scale: 0.9 }}
            animate={{ y: 0, opacity: 1, scale: 1 }}
            exit={{ y: -20, opacity: 0, scale: 0.9 }}
            className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[100]"
          >
            <GlassHUD variant="pill" style={{
              background: feedback.type === 'success' ? 'rgba(34,197,94,0.9)'
                : feedback.type === 'error' ? 'rgba(239,68,68,0.9)'
                : feedback.type === 'hint' ? 'rgba(139,92,246,0.9)'
                : 'rgba(255,255,255,0.2)',
              border: 'none',
            }}>
              <span className="text-white font-bold whitespace-nowrap" style={{ fontSize: 'clamp(0.8rem, 2.5vh, 1rem)' }}>
                {feedback.text}
              </span>
            </GlassHUD>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

// ── Wrapper with gameKey for replay ──
const PhonicsSpellGame = ({ group, onBack }) => {
  const [gameKey, setGameKey] = useState(0);
  return (
    <PhonicsSpellGameInner
      key={gameKey}
      group={group}
      onBack={onBack}
      onPlayAgain={() => setGameKey((k) => k + 1)}
    />
  );
};

export default PhonicsSpellGame;
