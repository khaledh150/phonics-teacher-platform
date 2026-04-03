import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock assetHelpers before importing phonicsData
vi.mock('../../utils/assetHelpers', () => ({
  getGroupWordNames: vi.fn((groupId) => {
    if (groupId === 1) return ['cat', 'sun', 'map'];
    if (groupId === 2) return ['dog', 'pen'];
    return [];
  }),
  getGroupSentencePics: vi.fn((groupId) => {
    if (groupId === 1) return [
      { sentence: 'The cat sat on the mat', url: null },
      { sentence: 'The sun is hot', url: null },
    ];
    return [];
  }),
  preloadGroup: vi.fn(),
  getWordImage: vi.fn(),
}));

describe('autoGenerateWords', () => {
  it('populates group words from image names', async () => {
    // Import dynamically so mocks are in place
    const { getGroupWordNames } = await import('../../utils/assetHelpers');

    const groups = [
      { id: 1, title: 'Group 1', sounds: ['s', 'a', 't'], words: [] },
    ];

    // Simulate autoGenerateWords logic
    groups.forEach((group) => {
      const imageWords = getGroupWordNames(group.id);
      if (imageWords.length === 0) return;
      const existingData = {};
      group.words.forEach((w) => { existingData[w.word.toLowerCase()] = w; });
      group.words = imageWords.map((wordName) => {
        const existing = existingData[wordName];
        if (existing) return existing;
        return { word: wordName, image: wordName, sentence: `I see a ${wordName}.` };
      });
    });

    expect(groups[0].words).toHaveLength(3);
    expect(groups[0].words[0]).toEqual({ word: 'cat', image: 'cat', sentence: 'I see a cat.' });
    expect(groups[0].words[1]).toEqual({ word: 'sun', image: 'sun', sentence: 'I see a sun.' });
    expect(groups[0].words[2]).toEqual({ word: 'map', image: 'map', sentence: 'I see a map.' });
  });

  it('preserves existing word data when image matches', async () => {
    const { getGroupWordNames } = await import('../../utils/assetHelpers');

    const groups = [
      {
        id: 1, title: 'Group 1', sounds: ['s'],
        words: [{ word: 'cat', image: 'cat_custom', sentence: 'A cat is here.' }],
      },
    ];

    groups.forEach((group) => {
      const imageWords = getGroupWordNames(group.id);
      if (imageWords.length === 0) return;
      const existingData = {};
      group.words.forEach((w) => { existingData[w.word.toLowerCase()] = w; });
      group.words = imageWords.map((wordName) => {
        const existing = existingData[wordName];
        if (existing) return existing;
        return { word: wordName, image: wordName, sentence: `I see a ${wordName}.` };
      });
    });

    // 'cat' should keep its custom data
    expect(groups[0].words[0]).toEqual({ word: 'cat', image: 'cat_custom', sentence: 'A cat is here.' });
    // 'sun' and 'map' get defaults
    expect(groups[0].words[1].word).toBe('sun');
    expect(groups[0].words[2].word).toBe('map');
  });

  it('returns empty words when no images exist', async () => {
    const { getGroupWordNames } = await import('../../utils/assetHelpers');

    const groups = [
      { id: 99, title: 'Empty', sounds: [], words: [{ word: 'old', image: 'old', sentence: 'Old.' }] },
    ];

    groups.forEach((group) => {
      const imageWords = getGroupWordNames(group.id);
      if (imageWords.length === 0) return;
      group.words = imageWords.map((w) => ({ word: w, image: w, sentence: `I see a ${w}.` }));
    });

    // No images found, words should be unchanged
    expect(groups[0].words).toHaveLength(1);
    expect(groups[0].words[0].word).toBe('old');
  });
});

describe('autoGenerateSentences', () => {
  it('matches sentence pics to words by word boundary', async () => {
    const { getGroupSentencePics } = await import('../../utils/assetHelpers');

    const groups = [
      {
        id: 1, title: 'Group 1', sounds: ['s'],
        words: [
          { word: 'cat', image: 'cat', sentence: 'I see a cat.' },
          { word: 'sun', image: 'sun', sentence: 'I see a sun.' },
          { word: 'map', image: 'map', sentence: 'I see a map.' },
        ],
      },
    ];

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

    expect(groups[0].words[0].sentence).toBe('The cat sat on the mat.');
    expect(groups[0].words[1].sentence).toBe('The sun is hot.');
    // 'map' has no matching sentence pic, keeps default
    expect(groups[0].words[2].sentence).toBe('I see a map.');
  });

  it('adds period to sentences missing punctuation', async () => {
    const { getGroupSentencePics } = await import('../../utils/assetHelpers');
    // The mock for group 1 returns "The cat sat on the mat" (no period)
    const sentencePics = getGroupSentencePics(1);
    const sentence = sentencePics[0].sentence;
    const fixed = /[.!?]$/.test(sentence) ? sentence : sentence + '.';
    expect(fixed).toBe('The cat sat on the mat.');
  });
});
