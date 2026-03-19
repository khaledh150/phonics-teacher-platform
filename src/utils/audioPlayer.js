// Professional voiceover (VO) player utility
// Plays MP3 files from /sounds/vo/ directory
// All play functions return Promises for async/await sequencing

let currentVO = null;
let currentResolve = null;

// Global VO mute flag — controlled by MuteContext via setVOMuted()
let voMuted = false;
export const setVOMuted = (muted) => { voMuted = muted; };
export const isVOMuted = () => voMuted;

/**
 * Promise-based delay helper.
 * @param {number} ms - milliseconds to wait
 */
export const delay = (ms) => new Promise((r) => setTimeout(r, ms));

/**
 * Play a voiceover MP3 file. Returns a Promise that resolves when playback ends.
 * Stops any currently playing VO before starting a new one.
 * @param {string} fileName - The filename without .mp3 extension
 * @returns {Promise<void>}
 */
export const playVO = (fileName) => {
  return new Promise((resolve) => {
    // If VO is muted, resolve immediately (skip playback)
    if (voMuted) { resolve(); return; }

    // Stop any currently playing VO (also resolves its pending promise)
    stopVO();

    currentResolve = resolve;
    const audio = new Audio(`/sounds/vo/${fileName}.mp3`);
    audio.volume = 1.0;
    currentVO = audio;

    audio.addEventListener('ended', () => {
      if (currentVO === audio) {
        currentVO = null;
        currentResolve = null;
      }
      resolve();
    }, { once: true });

    audio.addEventListener('error', () => {
      if (currentVO === audio) {
        currentVO = null;
        currentResolve = null;
      }
      resolve(); // resolve (not reject) so chains don't break
    }, { once: true });

    audio.play().catch(() => {
      if (currentVO === audio) {
        currentVO = null;
        currentResolve = null;
      }
      resolve();
    });
  });
};

/**
 * Play a letter name VO from /sounds/vo-letters/ (e.g. "s" → S.mp3).
 * @param {string} letter - The letter (will be uppercased)
 * @returns {Promise<void>}
 */
export const playLetterVO = (letter) => {
  return new Promise((resolve) => {
    stopVO();
    currentResolve = resolve;
    const audio = new Audio(`/sounds/vo-letters/${letter.toUpperCase()}.mp3`);
    audio.volume = 1.0;
    currentVO = audio;
    audio.addEventListener('ended', () => {
      if (currentVO === audio) { currentVO = null; currentResolve = null; }
      resolve();
    }, { once: true });
    audio.addEventListener('error', () => {
      if (currentVO === audio) { currentVO = null; currentResolve = null; }
      resolve();
    }, { once: true });
    audio.play().catch(() => {
      if (currentVO === audio) { currentVO = null; currentResolve = null; }
      resolve();
    });
  });
};

/**
 * Stop the currently playing VO and resolve any pending promise.
 */
export const stopVO = () => {
  if (currentVO) {
    currentVO.pause();
    currentVO.currentTime = 0;
    currentVO = null;
  }
  // Resolve any pending playVO promise so await chains don't hang
  if (currentResolve) {
    const r = currentResolve;
    currentResolve = null;
    r();
  }
};
