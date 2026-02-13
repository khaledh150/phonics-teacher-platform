// ============================================
// SHARED HIGH-QUALITY VOICE SELECTION
// Single source of truth for all speech across the app
// ============================================

let cachedVoice = null;
let voicesReady = false;

// Known robotic/low-quality local Windows voices to avoid
const ROBOTIC_VOICE_NAMES = [
  'microsoft david',
  'microsoft zira',
  'microsoft mark',
  'microsoft hazel',
  'microsoft george',
  'microsoft susan',
  'microsoft heera',
  'microsoft ravi',
];

/**
 * Score a voice for quality. Higher = better.
 * Prioritizes Online Natural voices (Edge), then Google (Chrome),
 * and penalizes known low-quality local voices.
 */
const scoreVoice = (voice) => {
  const name = voice.name.toLowerCase();
  const lang = voice.lang || '';
  let score = 0;

  // Must be English
  if (!lang.startsWith('en')) return -1000;

  // Prefer en-US slightly over other English variants
  if (lang.startsWith('en-US') || lang.startsWith('en_US')) score += 5;

  // Best: Microsoft Online Natural voices (Edge on Windows 11)
  // Names like "Microsoft Aria Online (Natural) - English (United States)"
  if (name.includes('online') && name.includes('natural')) score += 200;

  // Very good: any voice with "Natural" in name
  else if (name.includes('natural')) score += 150;

  // Good: Microsoft Online voices (without "Natural")
  else if (name.includes('online')) score += 120;

  // Good: Google voices (Chrome)
  else if (name.includes('google')) score += 100;

  // Decent: Neural / Enhanced voices
  else if (name.includes('neural')) score += 80;
  else if (name.includes('enhanced')) score += 70;

  // Penalty: known robotic local Windows voices
  if (ROBOTIC_VOICE_NAMES.some((bad) => name.includes(bad))) {
    score -= 500;
  }

  // Small bonus for remote/non-local voices (localService = false means cloud voice)
  if (voice.localService === false) score += 30;

  return score;
};

/**
 * Select the best available high-quality English voice.
 * Uses scoring system to always pick the highest quality option.
 * Logs the selected voice to console for debugging.
 */
export const getBestVoice = () => {
  const voices = window.speechSynthesis.getVoices();
  if (!voices || voices.length === 0) return cachedVoice;

  // Score all voices and sort by score descending
  const scored = voices
    .map((v) => ({ voice: v, score: scoreVoice(v) }))
    .filter((v) => v.score > -1000)
    .sort((a, b) => b.score - a.score);

  if (scored.length === 0) {
    // No English voices at all, just use first available
    cachedVoice = voices[0];
    return cachedVoice;
  }

  const best = scored[0].voice;

  // Log on first selection or when voice changes
  if (!cachedVoice || cachedVoice.name !== best.name) {
    console.log(
      `[Speech] Selected voice: "${best.name}" (lang=${best.lang}, local=${best.localService}, score=${scored[0].score})`
    );
    if (scored.length > 1) {
      console.log(
        `[Speech] Runner-up: "${scored[1].voice.name}" (score=${scored[1].score})`
      );
    }
  }

  cachedVoice = best;
  voicesReady = true;
  return best;
};

/**
 * Initialize voice loading. Call this once per component mount.
 * Returns a cleanup function.
 */
export const initVoices = (onVoiceReady) => {
  const loadVoices = () => {
    const voice = getBestVoice();
    if (onVoiceReady) onVoiceReady(voice);
  };

  loadVoices();
  window.speechSynthesis.onvoiceschanged = loadVoices;

  return () => {
    // No cleanup needed for onvoiceschanged as it's a singleton
  };
};

/**
 * Speak text with high-quality voice.
 * Always gets a FRESH voice reference to avoid stale voice objects.
 * Handles cancel-before-speak pattern to prevent browser audio stall.
 */
export const speakWithVoice = (text, { rate = 0.85, onStart, onEnd, onError } = {}) => {
  // Cancel any ongoing speech to prevent overlap/stall
  if (window.speechSynthesis.speaking) {
    window.speechSynthesis.cancel();
  }

  // Always get fresh voice - never use stale cached references
  const selectedVoice = getBestVoice();

  const utterance = new SpeechSynthesisUtterance(text);
  utterance.voice = selectedVoice;
  utterance.lang = 'en-US';
  utterance.rate = rate;
  utterance.pitch = 1;
  utterance.volume = 1;

  if (onStart) utterance.onstart = onStart;
  if (onEnd) utterance.onend = onEnd;
  if (onError) utterance.onerror = onError;

  // Cancel immediately before speak to prevent stall bug
  window.speechSynthesis.cancel();
  window.speechSynthesis.speak(utterance);

  return utterance;
};
