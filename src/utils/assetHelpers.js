// Dynamic asset loader for phonics platform
// Folder structure: src/assets/lvl1/group-{N}/sounds-pics/ and sentences-pics/

// Import all images from lvl1 asset folders using Vite glob
// Matches: group-1/sounds-pics/*.png, group-1/sentences-pics/*.png, etc.
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
  const groupPrefix = `../assets/lvl1/group-${groupId}`;

  // Search sounds-pics for this group
  for (const [path, url] of Object.entries(allWordImages)) {
    if (!path.startsWith(groupPrefix)) continue;
    // Only match from sounds-pics (skip sentences-pics)
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
  const groupPrefix = `../assets/lvl1/group-${groupId}`;

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
 * Returns { picName: url, ... } e.g. { "cat": "/assets/cat-abc.png", "dip": "..." }
 */
export const getSentencePicMap = (groupId) => {
  const groupPrefix = `../assets/lvl1/group-${groupId}`;
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
export const findSentenceImage = (groupId, keyword, sentenceText) => {
  // First try direct keyword match from sentences-pics
  const groupPrefix = `../assets/lvl1/group-${groupId}`;
  const normalizedKeyword = normalize(keyword);

  for (const [path, url] of Object.entries(allWordImages)) {
    if (!path.startsWith(groupPrefix)) continue;
    if (!path.toLowerCase().includes('sentences-pics')) continue;
    const fileName = normalize(path.split('/').pop());
    if (fileName === normalizedKeyword || fileName === `${normalizedKeyword}_`) {
      return url;
    }
  }

  // Get all available sentence pics for this group
  const picMap = getSentencePicMap(groupId);

  // Try matching any word in the sentence to a pic filename
  const sentenceWords = sentenceText.toLowerCase().replace(/[^a-z\s]/g, '').split(/\s+/);
  for (const w of sentenceWords) {
    if (picMap[w]) return picMap[w];
  }

  // Fallback: word image from sounds-pics
  return getWordImage(groupId, keyword);
};

/**
 * Get video for a sound in a group.
 */
export const getSoundVideo = (groupId, soundName) => {
  const target = normalize(soundName);
  const groupPrefix = `../assets/lvl1/group-${groupId}`;

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
  const groupPrefix = `../assets/lvl1/group-${groupId}`;

  for (const [path, url] of Object.entries(allMusic)) {
    if (!path.startsWith(groupPrefix)) continue;
    const fileName = normalize(path.split('/').pop());
    if (fileName === target) return url;
  }
  return null;
};
