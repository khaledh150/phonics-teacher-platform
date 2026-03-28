// Dynamic asset loader for phonics platform
// Folder structure: src/assets/lvl1/group-{N}/sounds-pics/ and sentences-pics/

// Import all images from lvl1 asset folders using Vite glob
// Matches: group-1/sounds-pics/*.webp, group-1/sentences-pics/*.webp, etc.
const wordImageModules = import.meta.glob(
  '../assets/lvl1/group-*/**/*.{webp,png,jpg,jpeg,svg}',
  { eager: true }
);

// Also import from the legacy flat images folder
const legacyImageModules = import.meta.glob(
  '../assets/images/*.{webp,png,jpg,jpeg,svg}',
  { eager: true }
);

// Import videos
const videoModules = import.meta.glob(
  '../assets/lvl1/group-*/vids/*.{mp4,webm}',
  { eager: true }
);

// Import music/audio
const musicModules = import.meta.glob(
  '../assets/lvl1/group-*/music/*.{mp3,wav,ogg}',
  { eager: true }
);

// Build lookup maps
const buildLookup = (modules) => {
  const map = {};
  Object.entries(modules).forEach(([path, mod]) => {
    map[path] = mod.default;
  });
  return map;
};

const allWordImages = buildLookup(wordImageModules);
const allLegacyImages = buildLookup(legacyImageModules);
const allVideos = buildLookup(videoModules);
const allMusic = buildLookup(musicModules);

// Normalize a filename for matching (lowercase, strip extensions, trailing underscores, trim)
const normalize = (name) =>
  name.toLowerCase().replace(/\.(webp|png|jpe?g|svg|mp4|webm|mp3|wav|ogg)$/i, '').replace(/_+$/, '').trim();


/**
 * Find a word image for a given group and word.
 * Searches in: group-{N}/sounds-pics/ subfolder, then legacy images folder.
 * Used by: FlashcardViewer (step 3), ExerciseMatch (step 5), BlendingFactory (step 6)
 */
export const getWordImage = (groupId, wordName) => {
  const target = normalize(wordName);
  const groupPrefix = `../assets/lvl1/group-${groupId}/`;

  // Search sounds-pics for this group
  for (const [path, url] of Object.entries(allWordImages)) {
    if (!path.startsWith(groupPrefix)) continue;
    if (path.toLowerCase().includes('sentences-pics')) continue;
    const fileName = normalize(path.split('/').pop());
    if (fileName === target || fileName === `${target}_` || fileName.startsWith(`${target}(`)) {
      return url;
    }
  }

  // Fallback to legacy images
  for (const [path, url] of Object.entries(allLegacyImages)) {
    const fileName = normalize(path.split('/').pop());
    if (fileName === target) return url;
  }

  return null;
};

/**
 * Find a sentence image for a given group and word.
 * Searches in: group-{N}/sentences-pics/
 * Used by: SentenceScramble (step 7)
 */
export const getSentenceImage = (groupId, wordName) => {
  const target = normalize(wordName);
  const groupPrefix = `../assets/lvl1/group-${groupId}/`;

  for (const [path, url] of Object.entries(allWordImages)) {
    if (!path.startsWith(groupPrefix)) continue;
    if (!path.toLowerCase().includes('sentences-pics')) continue;
    const fileName = normalize(path.split('/').pop());
    if (fileName === target || fileName === `${target}_` || fileName.startsWith(`${target}(`)) {
      return url;
    }
  }

  // Fallback: try the word image from sounds-pics
  return getWordImage(groupId, wordName);
};

/**
 * Build a map of all sentence-pic filenames available for a group.
 * Returns { picName: url, ... } e.g. { "cat": "/assets/cat-abc.webp", "dip": "..." }
 */
export const getSentencePicMap = (groupId) => {
  const groupPrefix = `../assets/lvl1/group-${groupId}/`;
  const map = {};
  for (const [path, url] of Object.entries(allWordImages)) {
    if (!path.startsWith(groupPrefix)) continue;
    if (!path.toLowerCase().includes('sentences-pics')) continue;
    const fileName = normalize(path.split('/').pop());
    map[fileName] = url;
  }
  return map;
};

/**
 * Find a sentence image by matching pic filenames against words in the sentence.
 * First tries exact keyword match, then scans sentence words for any matching pic.
 */
// Strip all punctuation for lenient sentence matching
const stripPunctuation = (s) =>
  s.replace(/[^a-z0-9\s]/gi, '').replace(/\s+/g, ' ').trim().toLowerCase();

export const findSentenceImage = (groupId, keyword, sentenceText) => {
  // Only use images from sentences-pics — never fall back to word images
  const groupPrefix = `../assets/lvl1/group-${groupId}/`;
  const normalizedKeyword = normalize(keyword);
  const sentenceClean = sentenceText ? stripPunctuation(sentenceText) : '';

  for (const [path, url] of Object.entries(allWordImages)) {
    if (!path.startsWith(groupPrefix)) continue;
    if (!path.toLowerCase().includes('sentences-pics')) continue;
    const fileName = normalize(path.split('/').pop());

    // Try keyword match (old-style: "man.webp")
    if (fileName === normalizedKeyword || fileName === `${normalizedKeyword}_`) {
      return url;
    }

    // Try full sentence match (new-style: "He is a tall man.webp")
    if (sentenceClean && stripPunctuation(fileName) === sentenceClean) {
      return url;
    }
  }

  return null;
};

/**
 * Build the list of word names available in a group's sounds-pics folder.
 * Images are the source of truth — if a pic exists, the word exists.
 * Skips files named "untitled" or similar non-word filenames.
 * Returns a sorted array of normalized word names, e.g. ["cat", "hat", "mat"]
 */
export const getGroupWordNames = (groupId) => {
  // NOTE: groupPrefix includes trailing '/' to prevent group-1 matching group-10
  const groupPrefix = `../assets/lvl1/group-${groupId}/`;
  const words = new Set();
  for (const path of Object.keys(allWordImages)) {
    if (!path.startsWith(groupPrefix)) continue;
    if (path.toLowerCase().includes('sentences-pics')) continue;
    const raw = normalize(path.split('/').pop());
    // Skip non-word filenames (e.g. "untitled design", empty)
    if (!raw || raw.includes('untitled') || raw.includes('design')) continue;
    // Strip trailing parenthetical duplicates like "beef(1)" → "beef"
    const clean = raw.replace(/\(\d+\)$/, '').replace(/_+$/, '').trim();
    if (clean) words.add(clean);
  }
  return [...words].sort();
};

/**
 * Get all sentence pics for a group with their sentence text derived from filename.
 * For groups with sentence-titled pics (e.g. "He is a tall man.webp"), the filename IS the sentence.
 * Returns: [{ sentence: "He is a tall man", url: "..." }, ...]
 */
export const getGroupSentencePics = (groupId) => {
  // NOTE: groupPrefix includes trailing '/' to prevent group-1 matching group-10
  const groupPrefix = `../assets/lvl1/group-${groupId}/`;
  const results = [];
  for (const [path, url] of Object.entries(allWordImages)) {
    if (!path.startsWith(groupPrefix)) continue;
    if (!path.toLowerCase().includes('sentences-pics')) continue;
    const raw = path.split('/').pop();
    // Strip image extension — must not leak .webp/.jpg etc. into sentence text
    const sentence = raw
      .replace(/\.(webp|png|jpe?g|svg)$/i, '')  // strip known image extensions
      .replace(/\.\w{2,4}$/, '')                 // fallback: strip any remaining .ext
      .replace(/_+$/, '')
      .trim();
    if (!sentence || sentence.toLowerCase().includes('untitled')) continue;
    results.push({ sentence, url });
  }
  return results;
};

/**
 * YouTube video IDs for letter sounds.
 * Group-specific keys ("groupId-sound") override general keys ("sound").
 */
const YOUTUBE_VIDEOS = {
  '1-s': 'uSVzk2pqWB4',
};

/**
 * General letter song video IDs (apply to any group containing that sound).
 */
const LETTER_SONG_VIDEOS = {
  a: 'gsb999VSvh8',
  b: 'kzzXROKd-i0',
  c: '1dhzPuT6jm0',
  d: 'nb8DqaQmNWg',
  e: 'beaUUPPUT2Y',
  f: 'gVJQL1E7BFQ',
  g: '0KXtxIiQ7gk',
  h: 'NtUSMBzacQ0',
  i: 'P56hZEhqFCw',
  j: '6KXX6fCKWes',
  k: 'OGVbUgqp7LQ',
  l: 'qEXMoeYe47c',
  m: 'Nvn9QvV7Aqk',
  n: 'qE5HEeoVGb0',
  o: 'oWbY5EKys60',
  p: '-v1fg2Hp63s',
  q: 'NKAookrRV4s',
  qu: 'NKAookrRV4s',
  r: 'gUSJeivdEH8',
  t: 'HHEqOLZ0hr4',
  u: 'nPJRhEV-kF8',
  v: 'PA47cP88ySw',
  w: 'MbUIYnDZZ-M',
  x: 'RX9Pm9qj_QY',
  y: 'L8PdL8ydI28',
  z: 'HysVxhemAe4',
};

/**
 * Get YouTube embed URL for a sound in a group, or null if none.
 * Checks group-specific override first, then general letter song.
 */
export const getSoundYouTube = (groupId, soundName) => {
  const snd = soundName.toLowerCase();
  // Group-specific override
  const groupKey = `${groupId}-${snd}`;
  if (YOUTUBE_VIDEOS[groupKey]) {
    return `https://www.youtube.com/embed/${YOUTUBE_VIDEOS[groupKey]}`;
  }
  // General letter song
  if (LETTER_SONG_VIDEOS[snd]) {
    return `https://www.youtube.com/embed/${LETTER_SONG_VIDEOS[snd]}`;
  }
  return null;
};

/**
 * Get video for a sound in a group.
 */
export const getSoundVideo = (groupId, soundName) => {
  const target = normalize(soundName);
  const groupPrefix = `../assets/lvl1/group-${groupId}/`;

  for (const [path, url] of Object.entries(allVideos)) {
    if (!path.startsWith(groupPrefix)) continue;
    const fileName = normalize(path.split('/').pop());
    if (fileName === target) return url;
  }
  return null;
};

/**
 * Get music/audio for a sound in a group.
 */
export const getSoundMusic = (groupId, soundName) => {
  const target = normalize(soundName);
  const groupPrefix = `../assets/lvl1/group-${groupId}/`;

  for (const [path, url] of Object.entries(allMusic)) {
    if (!path.startsWith(groupPrefix)) continue;
    const fileName = normalize(path.split('/').pop());
    if (fileName === target) return url;
  }
  return null;
};
