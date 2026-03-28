// Letter Sound MP3 Integration
// Maps phonics sounds to local MP3 files in src/assets/letter-sounds/

const soundModules = import.meta.glob(
  '../assets/letter-sounds/*.mp3',
  { eager: true }
);

const soundMap = {};
Object.entries(soundModules).forEach(([path, mod]) => {
  // Extract key from path: "../assets/letter-sounds/sound_a.mp3" -> "a"
  const match = path.match(/sound_(.+)\.mp3$/);
  if (match) {
    soundMap[match[1]] = mod.default;
  }
});

// Special mappings: group sounds -> file names
// e.g. 'c' and 'k' both map to 'ck', digraphs map directly
const SOUND_TO_FILE = {
  // Single consonants that map directly
  s: 's', a: 'a', t: 't', i: 'i', p: 'p', n: 'n',
  e: 'e', h: 'h', r: 'r', m: 'm', d: 'd',
  g: 'g', o: 'o', u: 'u', l: 'l', f: 'f', b: 'b',
  j: 'j', z: 'z', w: 'w', v: 'v', x: 'x', y: 'y',
  // c and k share the 'ck' sound
  c: 'ck', k: 'k',
  // Digraphs
  ch: 'ch', sh: 'sh', th: 'th', thh: 'thh', ng: 'ng', qu: 'qu',
  // Long vowels
  ai: 'ai', ay: 'ai', 'a-e': 'ai',
  oa: 'oa', ow: 'oa', 'o-e': 'oa',
  ie: 'ie', igh: 'ie', 'i-e': 'ie',
  ee: 'ee', ea: 'ee', 'e-e': 'ee',
  ue: 'ue', ew: 'ue', 'u-e': 'ue',
  oo: 'oo', ooo: 'ooo',
  ou: 'ou', oy: 'oi', oi: 'oi',
  or: 'or', al: 'or', au: 'or', aw: 'or',
  er: 'er', ir: 'er', ur: 'er',
  ar: 'ar',
};

/**
 * Get the MP3 URL for a phonics sound.
 * Returns null if no matching file exists.
 */
export const getLetterSoundUrl = (sound) => {
  const key = SOUND_TO_FILE[sound.toLowerCase()];
  if (key && soundMap[key]) return soundMap[key];
  // Fallback: try direct match
  if (soundMap[sound.toLowerCase()]) return soundMap[sound.toLowerCase()];
  return null;
};

// Track active audio elements so they can be stopped
const activeAudios = new Set();

/**
 * Play a letter sound MP3. Returns a promise that resolves when done.
 */
export const playLetterSound = (sound) => {
  return new Promise((resolve, reject) => {
    const url = getLetterSoundUrl(sound);
    if (!url) {
      reject(new Error(`No sound file for: ${sound}`));
      return;
    }
    const audio = new Audio(url);
    audio.volume = 1.0;
    activeAudios.add(audio);
    audio.onended = () => { activeAudios.delete(audio); resolve(); };
    audio.onerror = () => { activeAudios.delete(audio); reject(); };
    audio.play().catch((e) => { activeAudios.delete(audio); reject(e); });
  });
};

/**
 * Stop all currently playing letter sounds.
 */
export const stopAllAudio = () => {
  activeAudios.forEach((audio) => {
    audio.pause();
    audio.currentTime = 0;
  });
  activeAudios.clear();
};

// Word-to-phonemes mapping for blending
// Maps common phonics patterns to their constituent sounds
const DIGRAPHS = ['th', 'sh', 'ch', 'ng', 'qu', 'ck', 'ai', 'ay', 'ee', 'ea', 'oa', 'ow', 'oo', 'ou', 'oi', 'oy', 'ie', 'ue', 'ew', 'ar', 'er', 'ir', 'ur', 'or', 'al', 'au', 'aw'];
const TRIGRAPHS = ['igh', 'ooo', 'thh'];

/**
 * Detect split digraph (magic e) pattern in a word.
 * Returns { sound, vowelPos, ePos } or null.
 * Only detects if groupSounds contains a matching split digraph (e.g. "a-e").
 * If groupSounds is empty/omitted, detects any valid VCe pattern.
 */
const detectSplitDigraph = (w, groupSounds) => {
  if (w.length < 3 || w[w.length - 1] !== 'e') return null;
  const consonant = w[w.length - 2];
  const vowel = w[w.length - 3];
  if ('aeiou'.includes(consonant) || !'aeiou'.includes(vowel)) return null;
  const candidate = vowel + '-e';
  // If groupSounds provided, only match if group has this split digraph
  if (groupSounds && groupSounds.length > 0) {
    if (!groupSounds.some(s => s.toLowerCase() === candidate)) return null;
  }
  return { sound: candidate, vowelPos: w.length - 3, ePos: w.length - 1 };
};

/**
 * Split a word into phonemes for blending.
 * e.g. "cat" -> ["c", "a", "t"]
 * e.g. "rain" -> ["r", "ai", "n"]
 * e.g. "ship" -> ["sh", "i", "p"]
 * e.g. "bake" (with groupSounds including "a-e") -> ["b", "a-e", "k"]
 *
 * @param {string} word
 * @param {string[]} [groupSounds] - Optional group sounds to enable split digraph detection
 */
export const wordToPhonemes = (word, groupSounds) => {
  const w = word.toLowerCase();
  const phonemes = [];
  let i = 0;

  // Detect split digraph if group supports it
  const sd = detectSplitDigraph(w, groupSounds);

  while (i < w.length) {
    // Split digraph vowel position — emit the split digraph sound
    if (sd && i === sd.vowelPos) {
      phonemes.push(sd.sound);
      i++;
      continue;
    }
    // Split digraph final e — skip (already part of the split digraph)
    if (sd && i === sd.ePos) {
      i++;
      continue;
    }

    // Check trigraphs first
    if (i + 3 <= w.length) {
      const tri = w.slice(i, i + 3);
      if (TRIGRAPHS.includes(tri)) {
        phonemes.push(tri);
        i += 3;
        continue;
      }
    }
    // Check digraphs
    if (i + 2 <= w.length) {
      const di = w.slice(i, i + 2);
      if (DIGRAPHS.includes(di)) {
        phonemes.push(di);
        i += 2;
        continue;
      }
    }
    // Skip silent 'e' at end after consonant (fallback for words without groupSounds)
    if (!sd && w[i] === 'e' && i === w.length - 1 && i >= 2) {
      const prev = w[i - 1];
      const prevPrev = w[i - 2];
      if (!'aeiou'.includes(prev) && 'aeiou'.includes(prevPrev)) {
        i++;
        continue;
      }
    }
    // Single letter
    phonemes.push(w[i]);
    i++;
  }

  return phonemes;
};

/**
 * Build a per-character phoneme index map for a word.
 * Handles split digraphs: the vowel and final 'e' share the same phoneme index.
 * Returns { phonemes: string[], charMap: number[] } where charMap[i] = phoneme index for char i.
 *
 * @param {string} word
 * @param {string[]} [groupSounds]
 */
export const wordToCharPhonemeMap = (word, groupSounds) => {
  const w = word.toLowerCase();
  const phonemes = [];
  const charMap = new Array(w.length).fill(-1);
  let phonemeIdx = 0;
  let i = 0;

  const sd = detectSplitDigraph(w, groupSounds);

  while (i < w.length) {
    if (sd && i === sd.vowelPos) {
      phonemes.push(sd.sound);
      charMap[sd.vowelPos] = phonemeIdx;
      charMap[sd.ePos] = phonemeIdx; // link final e to same phoneme
      phonemeIdx++;
      i++;
      continue;
    }
    if (sd && i === sd.ePos) {
      i++;
      continue;
    }

    if (i + 3 <= w.length) {
      const tri = w.slice(i, i + 3);
      if (TRIGRAPHS.includes(tri)) {
        phonemes.push(tri);
        for (let j = i; j < i + 3; j++) charMap[j] = phonemeIdx;
        phonemeIdx++;
        i += 3;
        continue;
      }
    }
    if (i + 2 <= w.length) {
      const di = w.slice(i, i + 2);
      if (DIGRAPHS.includes(di)) {
        phonemes.push(di);
        charMap[i] = phonemeIdx;
        charMap[i + 1] = phonemeIdx;
        phonemeIdx++;
        i += 2;
        continue;
      }
    }
    if (!sd && w[i] === 'e' && i === w.length - 1 && i >= 2) {
      const prev = w[i - 1];
      const prevPrev = w[i - 2];
      if (!'aeiou'.includes(prev) && 'aeiou'.includes(prevPrev)) {
        charMap[i] = -2; // silent e
        i++;
        continue;
      }
    }
    phonemes.push(w[i]);
    charMap[i] = phonemeIdx;
    phonemeIdx++;
    i++;
  }

  return { phonemes, charMap };
};

/**
 * Play blending sequence for a word: each phoneme sound, then the full word via TTS.
 * @param {string} word - The word to blend
 * @param {function} speakFullWord - Callback to speak the full word via TTS
 * @param {function} [onPhoneme] - Optional callback(phonemeIndex) called before each phoneme plays, -1 for full word
 * @param {string[]} [groupSounds] - Optional group sounds to enable split digraph detection
 * Returns a promise that resolves when the full sequence is done.
 */
export const playBlendingSequence = async (word, speakFullWord, onPhoneme, groupSounds) => {
  const phonemes = wordToPhonemes(word, groupSounds);

  for (let idx = 0; idx < phonemes.length; idx++) {
    if (onPhoneme) onPhoneme(idx);
    try {
      await playLetterSound(phonemes[idx]);
      // Small pause between sounds
      await new Promise((r) => setTimeout(r, 250));
    } catch {
      // If no MP3, skip this phoneme
      await new Promise((r) => setTimeout(r, 300));
    }
  }

  // Pause before full word
  await new Promise((r) => setTimeout(r, 400));

  // Signal full word is about to play
  if (onPhoneme) onPhoneme(-1);

  // Speak the full word via TTS
  if (speakFullWord) {
    speakFullWord(word);
  }
};
