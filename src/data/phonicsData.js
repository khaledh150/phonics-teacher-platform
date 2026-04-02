// Phonics Data Loader
// Imports level data files and applies auto-generation from asset images.
// When Level 2 is added, create data/level2.js and import it here.

import { getGroupWordNames, getGroupSentencePics } from '../utils/assetHelpers';
import LEVEL1_GROUPS from './levels/phonics-level1';

// ─── Auto-generate words from images ──────────────────────────────────────────
// Images are the source of truth — adding/removing a pic auto-updates the word list.
const autoGenerateWords = (groups) => {
  groups.forEach((group) => {
    const imageWords = getGroupWordNames(group.id);
    if (imageWords.length === 0) return;

    const existingData = {};
    group.words.forEach((w) => {
      existingData[w.word.toLowerCase()] = w;
    });

    group.words = imageWords.map((wordName) => {
      const existing = existingData[wordName];
      if (existing) return existing;
      return {
        word: wordName,
        image: wordName,
        sentence: `I see a ${wordName}.`,
      };
    });
  });
};

// ─── Auto-generate sentences from sentence-pics filenames ─────────────────────
const autoGenerateSentences = (groups) => {
  groups.forEach((group) => {
    const sentencePics = getGroupSentencePics(group.id);
    if (sentencePics.length === 0) return;

    group.words.forEach((w) => {
      const wordLower = w.word.toLowerCase();
      const escaped = wordLower.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const match = sentencePics.find((sp) =>
        new RegExp(`\\b${escaped}\\b`, 'i').test(sp.sentence)
      );
      if (match) {
        let sentence = match.sentence;
        if (!/[.!?]$/.test(sentence)) sentence += '.';
        w.sentence = sentence;
      }
    });
  });
};

// Apply auto-generation to Level 1
autoGenerateWords(LEVEL1_GROUPS);
autoGenerateSentences(LEVEL1_GROUPS);

// ─── Main export: all active groups ───────────────────────────────────────────
// When Level 2 is ready, import LEVEL2_GROUPS and spread here:
// export const PHONICS_GROUPS = [...LEVEL1_GROUPS, ...LEVEL2_GROUPS];
export const PHONICS_GROUPS = [...LEVEL1_GROUPS];

export default PHONICS_GROUPS;
export const phonicsGroups = PHONICS_GROUPS;

// ─── Level 2 (from separate file) ────────────────────────────────────────────
export { default as LEVEL2_GROUPS } from './levels/phonics-level2';

// ─── Shared constants (used across all levels) ───────────────────────────────
export const LETTER_PATHS = {
  a: "M50 150 Q100 50 150 150 M50 100 H150",
  b: "M50 50 V150 M50 50 Q100 50 100 100 Q100 150 50 150",
  c: "M150 75 Q100 50 75 75 Q50 100 75 125 Q100 150 150 125",
  d: "M150 50 V150 M150 50 Q100 50 100 100 Q100 150 150 150",
  e: "M50 100 H150 M150 75 Q100 50 75 75 Q50 100 75 125 Q100 150 150 125",
  f: "M100 50 Q75 50 75 75 V150 M50 100 H125",
  g: "M150 75 Q100 50 75 75 Q50 100 75 125 Q100 150 150 125 V175 Q150 200 100 200",
  h: "M50 50 V150 M50 100 Q100 75 150 100 V150",
  i: "M100 75 V150 M100 50 A5 5 0 1 0 100 60",
  j: "M125 75 V175 Q125 200 75 200 M125 50 A5 5 0 1 0 125 60",
  k: "M50 50 V150 M50 100 L150 50 M50 100 L150 150",
  l: "M75 50 V150 H125",
  m: "M50 150 V75 L100 125 L150 75 V150",
  n: "M50 150 V75 Q100 50 150 75 V150",
  o: "M100 50 Q50 50 50 100 Q50 150 100 150 Q150 150 150 100 Q150 50 100 50",
  p: "M50 75 V200 M50 75 Q100 50 100 100 Q100 150 50 150",
  q: "M150 75 V200 M150 75 Q100 50 100 100 Q100 150 150 150",
  r: "M50 75 V150 M50 100 Q100 75 100 75",
  s: "M125 75 Q100 50 75 75 Q50 85 75 100 Q125 115 125 125 Q125 150 75 150",
  t: "M100 50 V150 M75 75 H125",
  u: "M50 75 V125 Q50 150 100 150 Q150 150 150 125 V75",
  v: "M50 75 L100 150 L150 75",
  w: "M50 75 L75 150 L100 100 L125 150 L150 75",
  x: "M50 75 L150 150 M150 75 L50 150",
  y: "M50 75 L100 125 M150 75 L100 125 V200",
  z: "M50 75 H150 L50 150 H150",
};

export const GAME_TYPES = {
  TRACE_LETTER: 'trace_letter',
  WORD_MATCH: 'word_match',
  FILL_BLANK: 'fill_blank',
  SOUND_IDENTIFY: 'sound_identify',
  PICTURE_SPELL: 'picture_spell',
  MEMORY_CARDS: 'memory_cards',
  WORD_BUILD: 'word_build',
  SENTENCE_READ: 'sentence_read',
};
