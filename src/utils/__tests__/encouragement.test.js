import { describe, it, expect, beforeEach, vi } from 'vitest';

// Mock audioPlayer before importing encouragement
vi.mock('../audioPlayer', () => ({
  playVO: vi.fn((phrase) => Promise.resolve(phrase)),
}));

import {
  playMatchEncouragement,
  playCompletionEncouragement,
  playEncouragement,
  resetEncouragementCycles,
} from '../encouragement';
import { playVO } from '../audioPlayer';

describe('encouragement cycling', () => {
  beforeEach(() => {
    resetEncouragementCycles();
    vi.clearAllMocks();
  });

  it('cycles through match encouragements without repeating', () => {
    const phrases = [];
    for (let i = 0; i < 6; i++) {
      playMatchEncouragement();
      phrases.push(playVO.mock.calls[i][0]);
    }
    // All 6 should be different (pool has 6 items)
    expect(new Set(phrases).size).toBe(6);
  });

  it('wraps around after exhausting the pool', () => {
    for (let i = 0; i < 6; i++) playMatchEncouragement();
    playMatchEncouragement(); // 7th call wraps to index 0
    expect(playVO).toHaveBeenCalledTimes(7);
    // 7th call should match the 1st call
    expect(playVO.mock.calls[6][0]).toBe(playVO.mock.calls[0][0]);
  });

  it('resets all cycles', () => {
    playMatchEncouragement();
    playCompletionEncouragement();
    playEncouragement();
    resetEncouragementCycles();

    // After reset, should start from the beginning again
    playMatchEncouragement();
    expect(playVO.mock.calls[3][0]).toBe(playVO.mock.calls[0][0]);
  });

  it('keeps separate indices for each pool', () => {
    playMatchEncouragement();
    playCompletionEncouragement();
    playEncouragement();
    // Each should call playVO with different phrases (different pools)
    expect(playVO).toHaveBeenCalledTimes(3);
  });

  it('does not use "Great job!" in cycling pools', () => {
    // Play all items in all pools
    for (let i = 0; i < 20; i++) {
      playMatchEncouragement();
      playCompletionEncouragement();
      playEncouragement();
    }
    const allPhrases = playVO.mock.calls.map(c => c[0]);
    expect(allPhrases).not.toContain('Great job!');
  });
});
