/**
 * Progress tracking utility — persists to localStorage.
 * Tracks: completed teaching groups, games played, timestamps.
 * Silent tracking only — no UI reads this yet.
 *
 * Storage key: 'wp_progress'
 * Schema: {
 *   version: 1,
 *   groups: { [groupId]: { completedAt, timesCompleted, lastStep } },
 *   games:  { [groupId-gameId]: { playCount, lastPlayedAt } },
 *   stats:  { totalGroupsCompleted, totalGamesPlayed, firstSessionAt }
 * }
 */

const STORAGE_KEY = 'wp_progress';

const defaultData = () => ({
  version: 1,
  groups: {},
  games: {},
  stats: {
    totalGroupsCompleted: 0,
    totalGamesPlayed: 0,
    firstSessionAt: new Date().toISOString(),
  },
});

const load = () => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return defaultData();
    const data = JSON.parse(raw);
    if (data.version !== 1) return defaultData();
    return data;
  } catch {
    return defaultData();
  }
};

const save = (data) => {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch {
    // Storage full or unavailable — silently ignore
  }
};

/**
 * Record that a teaching group was completed (all 7 steps finished).
 */
export const trackGroupCompleted = (groupId) => {
  const data = load();
  const prev = data.groups[groupId];
  data.groups[groupId] = {
    completedAt: new Date().toISOString(),
    timesCompleted: (prev?.timesCompleted || 0) + 1,
    lastStep: 7,
  };
  data.stats.totalGroupsCompleted = Object.keys(data.groups).filter(
    (id) => data.groups[id].timesCompleted > 0
  ).length;
  save(data);
};

/**
 * Record progress through a teaching group (which step the user reached).
 * Called when user exits mid-flow or advances steps.
 */
export const trackGroupStep = (groupId, stepIndex) => {
  const data = load();
  const prev = data.groups[groupId] || {};
  // Only update lastStep if it's higher than what we've tracked (don't go backwards)
  if (stepIndex > (prev.lastStep || 0) || !prev.lastStep) {
    data.groups[groupId] = {
      ...prev,
      lastStep: stepIndex,
      timesCompleted: prev.timesCompleted || 0,
    };
    save(data);
  }
};

/**
 * Record that a playground game was played (completed or exited).
 */
export const trackGamePlayed = (groupId, gameId) => {
  const data = load();
  const key = `${groupId}-${gameId}`;
  const prev = data.games[key];
  data.games[key] = {
    playCount: (prev?.playCount || 0) + 1,
    lastPlayedAt: new Date().toISOString(),
  };
  data.stats.totalGamesPlayed = Object.values(data.games).reduce(
    (sum, g) => sum + g.playCount, 0
  );
  save(data);
};

/**
 * Check if a group has been completed at least once.
 */
export const isGroupCompleted = (groupId) => {
  const data = load();
  return (data.groups[groupId]?.timesCompleted || 0) > 0;
};

/**
 * Get count of unique groups completed.
 */
export const getCompletedGroupCount = () => {
  const data = load();
  return data.stats.totalGroupsCompleted;
};

/**
 * Get full progress snapshot (for future UI display).
 */
export const getProgressSnapshot = () => load();
