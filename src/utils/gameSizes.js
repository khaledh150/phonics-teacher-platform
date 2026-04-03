// Global game element sizes — single source of truth for all games.
// Both tutorials and gameplay use these so sizes always match.

// Balloon size (SoundBalloons game + tutorial)
export const getBalloonSize = (stageW) => {
  const isPC = stageW >= 1024;
  const isPhone = stageW < 950;
  if (isPC) return Math.min(Math.max(50, stageW * 0.12), 140);
  if (isPhone) return Math.min(Math.max(61, stageW * 0.115), 99);
  return Math.min(Math.max(80, stageW * 0.15), 130);
};

// Bubble radius (BubbleSpell + CatchTheDrop)
export const getBubbleRadius = (stageW, stageH) => {
  const isPC = stageW >= 1024;
  const isPhone = stageW < 950;
  const minDim = Math.min(stageW, stageH);
  if (isPC) return minDim * 0.08;
  if (isPhone) return Math.min(Math.max(22, minDim * 0.065), 33);
  return Math.min(Math.max(25, minDim * 0.07), 38);
};

// Drop item size (CatchTheDrop)
export const getDropItemSize = (stageW) => {
  const isPC = stageW >= 1024;
  const isPhone = stageW < 950;
  if (isPC) return Math.min(180, stageW * 0.25);
  if (isPhone) return Math.max(95, Math.min(150, stageW * 0.2));
  return Math.max(110, Math.min(180, stageW * 0.25));
};
