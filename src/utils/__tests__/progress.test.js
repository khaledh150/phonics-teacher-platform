import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  trackGroupCompleted,
  trackGroupStep,
  trackGamePlayed,
  isGroupCompleted,
  getCompletedGroupCount,
  getProgressSnapshot,
} from '../progress';

describe('progress tracking', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('starts with empty progress', () => {
    const snap = getProgressSnapshot();
    expect(snap.version).toBe(1);
    expect(snap.groups).toEqual({});
    expect(snap.games).toEqual({});
    expect(snap.stats.totalGroupsCompleted).toBe(0);
    expect(snap.stats.totalGamesPlayed).toBe(0);
    expect(snap.stats.firstSessionAt).toBeDefined();
  });

  it('tracks group completion', () => {
    expect(isGroupCompleted(1)).toBe(false);
    trackGroupCompleted(1);
    expect(isGroupCompleted(1)).toBe(true);
    expect(getCompletedGroupCount()).toBe(1);
  });

  it('increments timesCompleted on repeated completion', () => {
    trackGroupCompleted(3);
    trackGroupCompleted(3);
    const snap = getProgressSnapshot();
    expect(snap.groups[3].timesCompleted).toBe(2);
    // Still just 1 unique group
    expect(snap.stats.totalGroupsCompleted).toBe(1);
  });

  it('tracks multiple groups independently', () => {
    trackGroupCompleted(1);
    trackGroupCompleted(5);
    expect(getCompletedGroupCount()).toBe(2);
    expect(isGroupCompleted(1)).toBe(true);
    expect(isGroupCompleted(5)).toBe(true);
    expect(isGroupCompleted(3)).toBe(false);
  });

  it('tracks group step progress', () => {
    trackGroupStep(2, 3);
    const snap = getProgressSnapshot();
    expect(snap.groups[2].lastStep).toBe(3);
  });

  it('only advances step forward, never backward', () => {
    trackGroupStep(2, 5);
    trackGroupStep(2, 3); // should be ignored
    const snap = getProgressSnapshot();
    expect(snap.groups[2].lastStep).toBe(5);
  });

  it('tracks game play counts', () => {
    trackGamePlayed(1, 'flashlight');
    trackGamePlayed(1, 'flashlight');
    trackGamePlayed(1, 'bubble-spell');
    const snap = getProgressSnapshot();
    expect(snap.games['1-flashlight'].playCount).toBe(2);
    expect(snap.games['1-bubble-spell'].playCount).toBe(1);
    expect(snap.stats.totalGamesPlayed).toBe(3);
  });

  it('persists to localStorage', () => {
    trackGroupCompleted(1);
    trackGamePlayed(1, 'flashlight');

    // Read raw localStorage
    const raw = JSON.parse(localStorage.getItem('wp_progress'));
    expect(raw.version).toBe(1);
    expect(raw.groups[1].timesCompleted).toBe(1);
    expect(raw.games['1-flashlight'].playCount).toBe(1);
  });

  it('handles corrupted localStorage gracefully', () => {
    localStorage.setItem('wp_progress', 'not-json');
    const snap = getProgressSnapshot();
    expect(snap.version).toBe(1);
    expect(snap.groups).toEqual({});
  });

  it('resets on version mismatch', () => {
    localStorage.setItem('wp_progress', JSON.stringify({ version: 99, groups: { 1: {} } }));
    const snap = getProgressSnapshot();
    expect(snap.version).toBe(1);
    expect(snap.groups).toEqual({});
  });

  it('handles localStorage being unavailable', () => {
    const origSet = localStorage.setItem;
    localStorage.setItem = () => { throw new Error('QuotaExceeded'); };
    // Should not throw
    expect(() => trackGroupCompleted(1)).not.toThrow();
    localStorage.setItem = origSet;
  });
});
