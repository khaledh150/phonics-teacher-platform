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
import { playVO, stopVO, delay, playWordVO, stopWordVO } from '../../../utils/audioPlayer';
import { playLetterSound, stopAllAudio, getDisplaySound } from '../../../utils/letterSounds';
import { triggerCelebration, triggerSmallBurst } from '../../../utils/confetti';
import { playEncouragement } from '../../../utils/encouragement';
import { playCorrectSfx, playWrongSfx } from '../../../utils/sfx';

// ─── Constants ────────────────────────────────────────────────────────────────

// Azure credentials are fetched as a short-lived token from /api/speech-token
// (Vercel serverless function). The actual subscription key never reaches the browser.
let _azureToken = null;
let _azureRegion = null;
let _tokenExpiry = 0;

async function getAzureToken() {
  if (_azureToken && Date.now() < _tokenExpiry) return { token: _azureToken, region: _azureRegion };
  try {
    const res = await fetch('/api/speech-token');
    if (!res.ok) return null;
    const data = await res.json();
    _azureToken = data.token;
    _azureRegion = data.region;
    _tokenExpiry = Date.now() + 8 * 60 * 1000; // tokens last ~10 min, refresh at 8
    return { token: _azureToken, region: _azureRegion };
  } catch {
    return null;
  }
}

const AZURE_AVAILABLE = { current: null };
getAzureToken().then(r => { AZURE_AVAILABLE.current = !!r; });

const WORDS_PER_SESSION = 3;
const PASS_THRESHOLD = 15; // Phonemes score very low — accept any reasonable recognition
const MAX_ATTEMPTS = 3;

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

// ─── Phoneme → recognizable reference text for Azure ────────────────────────
// Single letters are too short for Azure to detect. Map them to pronounceable forms.
// Comprehensive recognition set — what Azure STT might hear when user says each phoneme correctly.
// Each sound has 5-10 accepted variations. Keys are lowercase phonemes.
const ACCEPTED_RESPONSES = {
  // Single letters — Jolly Phonics sounds
  s: ['s', 'ss', 'sss', 'suh', 'es', 'us', 'ess', 'sa', 'so', 'see'],
  a: ['a', 'ah', 'aa', 'aah', 'uh', 'at', 'as', 'am', 'an', 'add'],
  t: ['t', 'tuh', 'te', 'ti', 'ta', 'to', 'tee', 'the', 'two', 'too'],
  i: ['i', 'ih', 'ee', 'it', 'is', 'in', 'if', 'e', 'eye', 'ick'],
  p: ['p', 'puh', 'pe', 'pa', 'po', 'pee', 'pip', 'pup', 'pi', 'pub'],
  n: ['n', 'nuh', 'en', 'na', 'no', 'ne', 'nn', 'in', 'an', 'un'],
  c: ['c', 'cuh', 'ca', 'co', 'cu', 'k', 'kuh', 'ka', 'ke', 'see'],
  k: ['k', 'kuh', 'ka', 'ke', 'cuh', 'ca', 'c', 'ku', 'key', 'kay'],
  e: ['e', 'eh', 'ee', 'ea', 'air', 'ed', 'em', 'en', 'el', 'ey'],
  h: ['h', 'huh', 'ha', 'he', 'ho', 'hi', 'hah', 'her', 'heh', 'hey'],
  r: ['r', 'ruh', 'ra', 're', 'er', 'ar', 'or', 'rr', 'are', 'rah'],
  m: ['m', 'muh', 'ma', 'me', 'mm', 'em', 'am', 'um', 'mom', 'my'],
  d: ['d', 'duh', 'da', 'de', 'do', 'di', 'dah', 'day', 'dee', 'dud'],
  g: ['g', 'guh', 'ga', 'go', 'ge', 'gi', 'gah', 'got', 'get', 'gee'],
  o: ['o', 'oh', 'aw', 'or', 'oo', 'on', 'of', 'off', 'all', 'ooh'],
  u: ['u', 'uh', 'up', 'us', 'un', 'um', 'a', 'ugh', 'under', 'utter'],
  l: ['l', 'la', 'le', 'lo', 'el', 'll', 'luh', 'all', 'ale', 'elle'],
  f: ['f', 'fuh', 'fa', 'fe', 'ff', 'if', 'of', 'eff', 'fun', 'for'],
  b: ['b', 'buh', 'ba', 'be', 'bo', 'bee', 'bah', 'bay', 'buy', 'bi'],
  j: ['j', 'juh', 'ja', 'je', 'jo', 'jay', 'jee', 'judge', 'ji', 'jah'],
  z: ['z', 'zuh', 'za', 'ze', 'zz', 'zee', 'zoo', 'zip', 'zap', 'zen'],
  w: ['w', 'wuh', 'wa', 'we', 'wo', 'woo', 'why', 'way', 'wow', 'were'],
  v: ['v', 'vuh', 'va', 've', 'vi', 'vee', 'very', 'van', 'view', 'vow'],
  x: ['x', 'ex', 'ks', 'ax', 'ix', 'ox', 'ux', 'ecks', 'extra', 'xray'],
  y: ['y', 'yuh', 'ya', 'ye', 'yo', 'yee', 'yeah', 'yay', 'you', 'yah'],
  q: ['q', 'coo', 'cu', 'que', 'queue', 'cue', 'coup', 'coop', 'cool', 'could'],
  // Digraphs
  ck: ['ck', 'k', 'c', 'cuh', 'kuh', 'ka', 'ca', 'click', 'kick', 'cook'],
  sh: ['sh', 'shh', 'sha', 'she', 'sho', 'shuh', 'shoo', 'shy', 'show', 'ship'],
  ch: ['ch', 'cha', 'che', 'cho', 'chuh', 'choo', 'chi', 'church', 'chat', 'chew'],
  th: ['th', 'tha', 'the', 'tho', 'thuh', 'this', 'that', 'three', 'they', 'thaw'],
  qu: ['qu', 'coo', 'queue', 'cue', 'kw', 'qua', 'quick', 'queen', 'quite', 'quay'],
  ng: ['ng', 'ing', 'ung', 'ang', 'ong', 'ring', 'sing', 'king', 'thing', 'long'],
  ai: ['ai', 'ay', 'a', 'aye', 'eye', 'hey', 'say', 'day', 'may', 'rain'],
  ee: ['ee', 'e', 'ea', 'eee', 'he', 'she', 'we', 'bee', 'see', 'tree'],
  oo: ['oo', 'ooh', 'who', 'do', 'to', 'two', 'too', 'boo', 'moo', 'zoo'],
  ou: ['ou', 'ow', 'ouch', 'out', 'our', 'how', 'now', 'cow', 'wow', 'pow'],
  ow: ['ow', 'oh', 'o', 'owe', 'ooh', 'no', 'go', 'so', 'low', 'show'],
  ew: ['ew', 'you', 'ooh', 'oo', 'new', 'few', 'dew', 'mew', 'pew', 'knew'],
  oi: ['oi', 'oy', 'oil', 'boy', 'joy', 'toy', 'coin', 'join', 'point', 'noise'],
  oy: ['oy', 'oi', 'boy', 'joy', 'toy', 'oil', 'ahoy', 'enjoy', 'royal', 'coin'],
  ar: ['ar', 'are', 'ah', 'r', 'car', 'far', 'star', 'bar', 'jar', 'dark'],
  or: ['or', 'ore', 'aw', 'oar', 'for', 'door', 'more', 'four', 'core', 'born'],
  er: ['er', 'ur', 'ir', 'her', 'fir', 'fur', 'sir', 'stir', 'bird', 'word'],
  ir: ['ir', 'er', 'ur', 'ear', 'fir', 'sir', 'stir', 'bird', 'girl', 'first'],
  ur: ['ur', 'er', 'ir', 'fur', 'blur', 'burn', 'turn', 'hurt', 'nurse', 'church'],
  oa: ['oa', 'oh', 'o', 'oat', 'oak', 'goat', 'boat', 'coat', 'road', 'load'],
  ie: ['ie', 'eye', 'i', 'aye', 'my', 'by', 'fly', 'try', 'pie', 'tie'],
  ue: ['ue', 'you', 'oo', 'ooh', 'blue', 'true', 'clue', 'glue', 'due', 'sue'],
  ay: ['ay', 'a', 'aye', 'hey', 'say', 'day', 'may', 'play', 'way', 'pay'],
  al: ['al', 'all', 'aul', 'awl', 'ball', 'call', 'fall', 'tall', 'wall', 'hall'],
  au: ['au', 'aw', 'or', 'awe', 'saw', 'paw', 'raw', 'law', 'cause', 'sauce'],
  aw: ['aw', 'or', 'awe', 'ah', 'saw', 'paw', 'raw', 'draw', 'law', 'jaw'],
  igh: ['igh', 'eye', 'i', 'aye', 'my', 'high', 'sigh', 'light', 'night', 'right'],
};

// Get the best reference text for Azure to recognize
const getRecognitionText = (phoneme) => {
  const key = phoneme.toLowerCase();
  const refs = ACCEPTED_RESPONSES[key];
  // Use the second entry as reference (first is too short for Azure)
  return refs ? (refs[1] || refs[0]) : phoneme;
};

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

// Speak word using Azure TTS via short-lived auth token
async function speakWord(text) {
  const sdk = await loadSpeechSDK();
  const azure = await getAzureToken();
  if (sdk && azure) {
    try {
      return await new Promise((resolve) => {
        const config = sdk.SpeechConfig.fromAuthorizationToken(azure.token, azure.region);
        config.speechSynthesisVoiceName = 'en-US-AnaNeural';
        const synth = new sdk.SpeechSynthesizer(config);
        const timer = setTimeout(() => { try { synth.close(); } catch(_){} resolve(); }, 5000);
        synth.speakTextAsync(text,
          () => { clearTimeout(timer); try { synth.close(); } catch(_){} resolve(); },
          (err) => { clearTimeout(timer); try { synth.close(); } catch(_){} console.warn('[TTS] Azure failed:', err); resolve(); }
        );
      });
    } catch (e) { console.warn('[PhonicsSpellGame] Azure TTS failed:', e); }
  }
  // Fallback to pre-recorded VO
  return playWordVO(text);
}

// ─── Azure Speech Recognition + Match ───────────────────────────────────────
// Uses speech-to-text then checks if what was said matches the expected sound.
// This validates the USER SAID THE RIGHT THING, not just pronunciation quality.

// Check if recognized text matches expected phoneme/word
const matchesExpected = (recognized, originalPhoneme) => {
  const r = recognized.toLowerCase().replace(/[^a-z]/g, '');
  if (!r) return false;
  const orig = originalPhoneme.toLowerCase();
  // Check against the full accepted response set
  const accepted = ACCEPTED_RESPONSES[orig];
  if (accepted) {
    for (const variant of accepted) {
      const v = variant.toLowerCase();
      if (r === v || r.startsWith(v) || v.startsWith(r)) return true;
    }
  }
  // Direct match
  if (r === orig || r.startsWith(orig) || orig.startsWith(r)) return true;
  // Contains the phoneme
  if (r.includes(orig) && orig.length >= 1) return true;
  // For full words (3+ chars), allow 1 char difference
  if (orig.length >= 3) {
    let diff = 0;
    const maxLen = Math.max(r.length, orig.length);
    for (let i = 0; i < maxLen; i++) { if (r[i] !== orig[i]) diff++; }
    if (diff <= 1 && r.length >= orig.length - 1) return true;
  }
  return false;
};

async function assessPronunciation(expectedText, timeoutMs = 3000, originalPhoneme = null) {
  // Small delay to let previous recognizer fully close (prevents SDK null reject crash)
  await delay(100);
  const azure = await getAzureToken();
  if (!azure) {
    await delay(1200);
    return { score: 75 + Math.random() * 20, passed: true, phonemeResults: [], recognized: '' };
  }

  const sdk = await loadSpeechSDK();
  if (!sdk) {
    await delay(1000);
    return { score: 80, passed: true, phonemeResults: [], recognized: '' };
  }

  return new Promise((resolve) => {
    const speechConfig = sdk.SpeechConfig.fromAuthorizationToken(azure.token, azure.region);
    speechConfig.speechRecognitionLanguage = 'en-US';

    let audioConfig;
    let recognizer;
    try {
      audioConfig = sdk.AudioConfig.fromDefaultMicrophoneInput();
      recognizer = new sdk.SpeechRecognizer(speechConfig, audioConfig);
    } catch (e) {
      console.error('[PhonicsSpellGame] Recognizer setup failed:', e);
      resolve({ score: 0, passed: false, phonemeResults: [], error: true });
      return;
    }

    const orig = originalPhoneme || expectedText;
    console.log('[PhonicsSpellGame] Listening for:', orig, '(ref:', expectedText, ')');

    let resolved = false;
    const safeResolve = (val) => { if (!resolved) { resolved = true; resolve(val); } };

    const timer = setTimeout(() => {
      console.warn('[PhonicsSpellGame] Recognition timed out');
      try { recognizer.stopContinuousRecognitionAsync(); } catch (e) {}
      setTimeout(() => safeResolve({ score: 0, passed: false, phonemeResults: [], timedOut: true }), 1500);
    }, timeoutMs);

    recognizer.recognizeOnceAsync(
      (result) => {
        clearTimeout(timer);
        try { recognizer.close(); } catch (_) {}
        if (result.reason === sdk.ResultReason.RecognizedSpeech) {
          const recognized = (result.text || '').replace(/\.$/, '');
          const passed = matchesExpected(recognized, orig);
          const score = passed ? 100 : 0;
          console.log('[PhonicsSpellGame] Heard:', recognized, 'expected:', orig, 'passed:', passed);
          safeResolve({ score, passed, phonemeResults: [], recognized });
        } else {
          console.warn('[PhonicsSpellGame] No speech recognized, reason:', result.reason);
          safeResolve({ score: 0, passed: false, phonemeResults: [], noSpeech: true });
        }
      },
      (error) => {
        clearTimeout(timer);
        console.error('[PhonicsSpellGame] Recognition error:', error);
        try { recognizer.close(); } catch (_) {}
        safeResolve({ score: 0, passed: false, phonemeResults: [], error: true });
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
  const isActive = state === 'active' || state === 'recording';
  const isPassed = state === 'pass';
  // Active = huge, Pass = big green, waiting/fail = small
  const size = isActive ? 'clamp(90px, 24vh, 150px)'
    : isPassed ? 'clamp(65px, 16vh, 110px)'
    : 'clamp(40px, 10vh, 65px)';
  const font = isActive ? 'clamp(2.5rem, 9vh, 4.5rem)'
    : isPassed ? 'clamp(1.8rem, 6vh, 3rem)'
    : 'clamp(1rem, 3.5vh, 1.6rem)';
  return (
    <motion.div
      initial={{ scale: 0, y: 20 }}
      animate={{ scale: 1, y: 0 }}
      transition={{ delay: index * 0.1, type: 'spring', bounce: 0.6 }}
      className="flex flex-col items-center"
      layout
    >
      <motion.div
        className="flex items-center justify-center relative overflow-hidden"
        animate={
          state === 'recording' ? { scale: [1, 1.05, 1] } :
          state === 'active' ? { scale: [1, 1.03, 1] } : {}
        }
        transition={
          state === 'recording' ? { duration: 0.6, repeat: Infinity } :
          state === 'active' ? { duration: 2, repeat: Infinity, ease: 'easeInOut' } : {}
        }
        style={{
          width: size,
          height: size,
          borderRadius: 'clamp(1rem, 3vh, 1.8rem)',
          background: colors.bg,
          border: `clamp(2px, 0.5vh, 4px) solid ${colors.border}`,
          boxShadow: isActive
            ? '0 clamp(4px, 1.5vh, 8px) 0 #D4A000, 0 clamp(6px, 2vh, 15px) rgba(0,0,0,0.3)'
            : isPassed
            ? '0 clamp(3px, 1vh, 6px) 0 #16A34A, 0 clamp(4px, 1.5vh, 10px) rgba(0,0,0,0.2)'
            : '0 clamp(2px, 0.5vh, 3px) 0 rgba(0,0,0,0.15)',
          color: colors.text,
          fontFamily: 'Fredoka, sans-serif',
          fontWeight: 900,
          fontSize: font,
          textTransform: 'lowercase',
          transition: 'width 0.3s, height 0.3s, font-size 0.3s, box-shadow 0.3s',
        }}
      >
        {(isActive || isPassed) && (
          <div className="absolute top-0 left-[15%] right-[15%] h-[25%] bg-white/30 rounded-full pointer-events-none" />
        )}
        {letter}
      </motion.div>
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
      stopWordVO();
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
    if (!allowed && AZURE_AVAILABLE.current) {
      showFeedbackMsg('Microphone access needed for scoring.', 'warn');
    }
  }, [showFeedbackMsg]);

  // ── Record a phoneme ──
  const handleRecordPhoneme = useCallback(async () => {
    if (listening || !currentWord) return;
    const expected = currentWord.phonemes[phonemeIndex];
    setListening(true);
    updateLetterState(phonemeIndex, 'recording');

    const recognitionText = getRecognitionText(expected);
    const result = await assessPronunciation(recognitionText, 3000, expected);
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
          speakWord(currentWord.word);
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
    const result = await assessPronunciation(currentWord.word, 3000);
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
    stopWordVO();
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

            <h1 className="font-black text-white text-center" style={{ fontSize: 'clamp(2rem, 8vh, 3.5rem)' }}>
              Say the Sounds!
            </h1>
            <p className="text-white/60 font-semibold text-center max-w-md" style={{ fontSize: 'clamp(1rem, 3.5vh, 1.5rem)' }}>
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

        {/* SEGMENT — landscape: left = letters + active, right = mic */}
        {phase === PHASE.SEGMENT && currentWord && (
          <motion.div key={`segment-${wordIndex}`}
            initial={{ x: 60, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: -60, opacity: 0 }}
            transition={{ type: 'spring', stiffness: 260, damping: 22 }}
            className="flex flex-row items-center justify-center z-10 w-full h-full px-6 gap-6"
          >
            {/* LEFT: letter bubbles + active letter */}
            <div className="flex flex-col items-center gap-4 flex-1">
              {/* Progress bubbles */}
              <div className="flex gap-2 items-center justify-center flex-wrap">
                {currentWord.phonemes.map((phoneme, i) => (
                  <LetterBubble key={i} letter={phoneme} phoneme={phoneme} state={letterStates[i] || 'waiting'} index={i} />
                ))}
              </div>

              {listening && (
                <motion.p
                  animate={{ opacity: [0.5, 1, 0.5] }}
                  transition={{ duration: 1.5, repeat: Infinity }}
                  className="text-[#22c55e] font-bold"
                  style={{ fontSize: 'clamp(1rem, 3vh, 1.4rem)' }}
                >
                  Listening...
                </motion.p>
              )}
            </div>

            {/* RIGHT: speaker on top, mic below */}
            <div className="flex flex-col items-center gap-3">
              <span className="text-white/50 font-bold" style={{ fontSize: 'clamp(1.1rem, 3.5vh, 1.6rem)' }}>
                Say: <span className="text-[#FFD000]">"{getDisplaySound(currentWord.phonemes[phonemeIndex])}"</span>
              </span>

              {/* Speaker button — top, static */}
              <GummyButton
                variant="purple"
                shape="circle"
                size="clamp(50px, 12vh, 70px)"
                onClick={() => playLetterSound(currentWord.phonemes[phonemeIndex])}
                disabled={listening}
              >
                <Volume2 className="text-white" style={{ width: 'clamp(22px, 5vh, 32px)', height: 'clamp(22px, 5vh, 32px)' }} />
              </GummyButton>

              {/* Mic button — below, BIG attention-grabbing bounce */}
              <motion.div
                animate={!listening ? {
                  scale: [1, 1.15, 1, 1.15, 1],
                  rotate: [0, -5, 5, -5, 0],
                  y: [0, -6, 0, -6, 0],
                } : { scale: [1, 1.05, 1] }}
                transition={!listening ? { duration: 1.5, repeat: Infinity, ease: 'easeInOut' } : { duration: 0.6, repeat: Infinity }}
              >
                <GummyButton
                  variant={listening ? 'green' : 'red'}
                  shape="circle"
                  size="clamp(80px, 22vh, 120px)"
                  onClick={handleRecordPhoneme}
                  disabled={!letterStates.includes('active') || listening}
                >
                  <Mic style={{ width: '45%', height: '45%' }} />
                </GummyButton>
              </motion.div>
              <span className="text-white/40 font-bold" style={{ fontSize: 'clamp(0.7rem, 2vh, 0.9rem)' }}>
                {listening ? 'Speak now!' : 'Tap to speak'}
              </span>
            </div>
          </motion.div>
        )}

        {/* BLEND — landscape: left = word card, right = mic */}
        {phase === PHASE.BLEND && currentWord && (
          <motion.div key={`blend-${wordIndex}`}
            initial={{ scale: 0.85, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.85, opacity: 0 }}
            transition={{ type: 'spring', stiffness: 240, damping: 20 }}
            className="flex flex-row items-center justify-center z-10 w-full h-full px-6 gap-8"
          >
            {/* LEFT: word card */}
            <div className="flex flex-col items-center gap-3 flex-1">
              <p className="text-white/40 font-bold" style={{ fontSize: 'clamp(1rem, 3vh, 1.4rem)' }}>
                {currentWord.phonemes.map((p) => getDisplaySound(p)).join(' + ')}
              </p>

              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ type: 'spring', stiffness: 300, delay: 0.2 }}
                className="relative overflow-hidden"
                style={{
                  background: 'linear-gradient(145deg, rgba(255,255,255,1) 0%, rgba(245,245,255,1) 100%)',
                  borderRadius: 'clamp(1.2rem, 4vh, 2.5rem)',
                  border: 'clamp(3px, 0.8vh, 5px) solid #8B5CF6',
                  padding: 'clamp(14px, 4vh, 30px) clamp(28px, 8vh, 56px)',
                  boxShadow: '0 clamp(4px, 1.5vh, 8px) 0 #5B21B6, 0 clamp(5px, 2vh, 12px) rgba(0,0,0,0.2)',
                }}
              >
                <span className="font-black text-[var(--text-dark)] uppercase" style={{ fontSize: 'clamp(3.5rem, 14vh, 7rem)', letterSpacing: 6 }}>
                  {currentWord.word}
                </span>
              </motion.div>
            </div>

            {/* RIGHT: speaker on top, mic below */}
            <div className="flex flex-col items-center gap-3">
              <span className="text-white/50 font-bold" style={{ fontSize: 'clamp(1.1rem, 3.5vh, 1.6rem)' }}>
                Say the word!
              </span>

              {/* Speaker button — top, static */}
              <GummyButton
                variant="purple"
                shape="circle"
                size="clamp(50px, 12vh, 70px)"
                onClick={() => speakWord(currentWord.word)}
                disabled={listening}
              >
                <Volume2 className="text-white" style={{ width: 'clamp(22px, 5vh, 32px)', height: 'clamp(22px, 5vh, 32px)' }} />
              </GummyButton>

              {/* Mic button — below, BIG attention-grabbing bounce */}
              <motion.div
                animate={!listening ? {
                  scale: [1, 1.15, 1, 1.15, 1],
                  rotate: [0, -5, 5, -5, 0],
                  y: [0, -6, 0, -6, 0],
                } : { scale: [1, 1.05, 1] }}
                transition={!listening ? { duration: 1.5, repeat: Infinity, ease: 'easeInOut' } : { duration: 0.6, repeat: Infinity }}
              >
                <GummyButton
                  variant={listening ? 'green' : 'red'}
                  shape="circle"
                  size="clamp(80px, 22vh, 120px)"
                  onClick={handleRecordBlend}
                  disabled={listening}
                >
                  <Mic style={{ width: '45%', height: '45%' }} />
                </GummyButton>
              </motion.div>
              <span className="text-white/40 font-bold" style={{ fontSize: 'clamp(0.7rem, 2vh, 0.9rem)' }}>
                {listening ? 'Speak now!' : 'Tap to speak'}
              </span>
            </div>
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
