// Cycling encouraging VO utility
// Cycles through encouraging phrases instead of repeating the same one
// NOTE: "Great job!" is RESERVED for game completion only — never in cycling pools
import { playVO } from './audioPlayer';

const MATCH_ENCOURAGEMENTS = [
  'You found one!',
  'Amazing',
  'Super',
  'Nice',
  'Wow',
  'Amazing job!',
];

const COMPLETION_ENCOURAGEMENTS = [
  'Amazing job!',
  'Super',
  'Wow',
  'Amazing',
  'Nice',
];

const ENCOURAGEMENTS = [
  'Amazing',
  'Amazing job!',
  'Super',
  'Nice',
  'Wow',
  'You found one!',
];

let matchIndex = 0;
let completionIndex = 0;
let generalIndex = 0;

export const playMatchEncouragement = () => {
  const vo = MATCH_ENCOURAGEMENTS[matchIndex % MATCH_ENCOURAGEMENTS.length];
  matchIndex++;
  return playVO(vo);
};

export const playCompletionEncouragement = () => {
  const vo = COMPLETION_ENCOURAGEMENTS[completionIndex % COMPLETION_ENCOURAGEMENTS.length];
  completionIndex++;
  return playVO(vo);
};

export const playEncouragement = () => {
  const vo = ENCOURAGEMENTS[generalIndex % ENCOURAGEMENTS.length];
  generalIndex++;
  return playVO(vo);
};

export const resetEncouragementCycles = () => {
  matchIndex = 0;
  completionIndex = 0;
  generalIndex = 0;
};
