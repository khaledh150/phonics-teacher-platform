// Dynamic asset loader for phonics platform
// Folder structure: src/assets/lvl1/group-{N}/sounds-pics/ and sentences-pics/

// Lazy import.meta.glob — modules are NOT loaded at startup.
// Each value is a () => Promise<module> function.
// Assets are resolved per-group via preloadGroup() and cached for sync access.
const wordImageModules = import.meta.glob(
  '../assets/lvl1/group-*/**/*.{webp,png,jpg,jpeg,svg}'
);

const legacyImageModules = import.meta.glob(
  '../assets/images/*.{webp,png,jpg,jpeg,svg}'
);

const videoModules = import.meta.glob(
  '../assets/lvl1/group-*/vids/*.{mp4,webm}'
);

const musicModules = import.meta.glob(
  '../assets/lvl1/group-*/music/*.{mp3,wav,ogg}'
);

// Resolved URL cache: path → URL string
const resolvedCache = {};
// Track which groups have been preloaded
const preloadedGroups = new Set();
let legacyPreloaded = false;

/**
 * Preload all assets for a specific group into cache.
 * Call this when user selects a group — after this, all sync lookups work instantly.
 */
export const preloadGroup = async (groupId) => {
  if (preloadedGroups.has(groupId)) return;

  const groupPrefix = `../assets/lvl1/group-${groupId}/`;
  const promises = [];

  // Preload word/sentence images for this group
  for (const [path, loader] of Object.entries(wordImageModules)) {
    if (!path.startsWith(groupPrefix)) continue;
    if (resolvedCache[path] !== undefined) continue;
    promises.push(loader().then(mod => { resolvedCache[path] = mod.default; }));
  }

  // Preload videos for this group
  for (const [path, loader] of Object.entries(videoModules)) {
    if (!path.startsWith(groupPrefix)) continue;
    if (resolvedCache[path] !== undefined) continue;
    promises.push(loader().then(mod => { resolvedCache[path] = mod.default; }));
  }

  // Preload music for this group
  for (const [path, loader] of Object.entries(musicModules)) {
    if (!path.startsWith(groupPrefix)) continue;
    if (resolvedCache[path] !== undefined) continue;
    promises.push(loader().then(mod => { resolvedCache[path] = mod.default; }));
  }

  // Also preload legacy images (shared across all groups, only once)
  if (!legacyPreloaded) {
    for (const [path, loader] of Object.entries(legacyImageModules)) {
      if (resolvedCache[path] !== undefined) continue;
      promises.push(loader().then(mod => { resolvedCache[path] = mod.default; }));
    }
    legacyPreloaded = true;
  }

  await Promise.all(promises);
  preloadedGroups.add(groupId);
};

// Normalize a filename for matching (lowercase, strip extensions, trailing underscores, trim)
const normalize = (name) =>
  name.toLowerCase().replace(/\.(webp|png|jpe?g|svg|mp4|webm|mp3|wav|ogg)$/i, '').replace(/_+$/, '').trim();


/**
 * Find a word image for a given group and word.
 * Synchronous — requires preloadGroup() to have been called first.
 */
export const getWordImage = (groupId, wordName) => {
  const target = normalize(wordName);
  const groupPrefix = `../assets/lvl1/group-${groupId}/`;

  // Search sounds-pics for this group
  for (const path of Object.keys(wordImageModules)) {
    if (!path.startsWith(groupPrefix)) continue;
    if (path.toLowerCase().includes('sentences-pics')) continue;
    const fileName = normalize(path.split('/').pop());
    if (fileName === target || fileName === `${target}_` || fileName.startsWith(`${target}(`)) {
      return resolvedCache[path] || null;
    }
  }

  // Fallback to legacy images
  for (const path of Object.keys(legacyImageModules)) {
    const fileName = normalize(path.split('/').pop());
    if (fileName === target) {
      return resolvedCache[path] || null;
    }
  }

  return null;
};

/**
 * Find a sentence image for a given group and word.
 */
export const getSentenceImage = (groupId, wordName) => {
  const target = normalize(wordName);
  const groupPrefix = `../assets/lvl1/group-${groupId}/`;

  for (const path of Object.keys(wordImageModules)) {
    if (!path.startsWith(groupPrefix)) continue;
    if (!path.toLowerCase().includes('sentences-pics')) continue;
    const fileName = normalize(path.split('/').pop());
    if (fileName === target || fileName === `${target}_` || fileName.startsWith(`${target}(`)) {
      return resolvedCache[path] || null;
    }
  }

  // Fallback: try the word image from sounds-pics
  return getWordImage(groupId, wordName);
};

/**
 * Build a map of all sentence-pic filenames available for a group.
 */
export const getSentencePicMap = (groupId) => {
  const groupPrefix = `../assets/lvl1/group-${groupId}/`;
  const map = {};
  for (const path of Object.keys(wordImageModules)) {
    if (!path.startsWith(groupPrefix)) continue;
    if (!path.toLowerCase().includes('sentences-pics')) continue;
    const fileName = normalize(path.split('/').pop());
    if (resolvedCache[path]) map[fileName] = resolvedCache[path];
  }
  return map;
};

// Strip all punctuation for lenient sentence matching
const stripPunctuation = (s) =>
  s.replace(/[^a-z0-9\s]/gi, '').replace(/\s+/g, ' ').trim().toLowerCase();

/**
 * Find a sentence image by matching pic filenames against words in the sentence.
 */
export const findSentenceImage = (groupId, keyword, sentenceText) => {
  const groupPrefix = `../assets/lvl1/group-${groupId}/`;
  const normalizedKeyword = normalize(keyword);
  const sentenceClean = sentenceText ? stripPunctuation(sentenceText) : '';

  for (const path of Object.keys(wordImageModules)) {
    if (!path.startsWith(groupPrefix)) continue;
    if (!path.toLowerCase().includes('sentences-pics')) continue;
    const fileName = normalize(path.split('/').pop());

    if (fileName === normalizedKeyword || fileName === `${normalizedKeyword}_`) {
      return resolvedCache[path] || null;
    }

    if (sentenceClean && stripPunctuation(fileName) === sentenceClean) {
      return resolvedCache[path] || null;
    }
  }

  return null;
};

/**
 * Build the list of word names available in a group's sounds-pics folder.
 * Synchronous — only scans paths, doesn't need resolved URLs.
 */
export const getGroupWordNames = (groupId) => {
  const groupPrefix = `../assets/lvl1/group-${groupId}/`;
  const words = new Set();
  for (const path of Object.keys(wordImageModules)) {
    if (!path.startsWith(groupPrefix)) continue;
    if (path.toLowerCase().includes('sentences-pics')) continue;
    const raw = normalize(path.split('/').pop());
    if (!raw || raw.includes('untitled') || raw.includes('design')) continue;
    const clean = raw.replace(/\(\d+\)$/, '').replace(/_+$/, '').trim();
    if (clean) words.add(clean);
  }
  return [...words].sort();
};

/**
 * Get all sentence pics for a group with their sentence text derived from filename.
 * Works without preloading — sentence text comes from paths, URLs from cache (if available).
 */
export const getGroupSentencePics = (groupId) => {
  const groupPrefix = `../assets/lvl1/group-${groupId}/`;
  const results = [];
  for (const path of Object.keys(wordImageModules)) {
    if (!path.startsWith(groupPrefix)) continue;
    if (!path.toLowerCase().includes('sentences-pics')) continue;
    const raw = path.split('/').pop();
    const sentence = raw
      .replace(/\.(webp|png|jpe?g|svg)$/i, '')
      .replace(/\.\w{2,4}$/, '')
      .replace(/_+$/, '')
      .trim();
    if (!sentence || sentence.toLowerCase().includes('untitled')) continue;
    results.push({ sentence, url: resolvedCache[path] || null });
  }
  return results;
};

/**
 * YouTube video IDs for letter sounds.
 */
const YOUTUBE_VIDEOS = {
  '1-s': 'uSVzk2pqWB4',
};

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

export const getSoundYouTube = (groupId, soundName) => {
  const snd = soundName.toLowerCase();
  const groupKey = `${groupId}-${snd}`;
  if (YOUTUBE_VIDEOS[groupKey]) {
    return `https://www.youtube.com/embed/${YOUTUBE_VIDEOS[groupKey]}`;
  }
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

  for (const path of Object.keys(videoModules)) {
    if (!path.startsWith(groupPrefix)) continue;
    const fileName = normalize(path.split('/').pop());
    if (fileName === target) return resolvedCache[path] || null;
  }
  return null;
};

/**
 * Get music/audio for a sound in a group.
 */
export const getSoundMusic = (groupId, soundName) => {
  const target = normalize(soundName);
  const groupPrefix = `../assets/lvl1/group-${groupId}/`;

  for (const path of Object.keys(musicModules)) {
    if (!path.startsWith(groupPrefix)) continue;
    const fileName = normalize(path.split('/').pop());
    if (fileName === target) return resolvedCache[path] || null;
  }
  return null;
};
