// Canvas-confetti utility for high-performance celebrations
// Replaces DOM-based confetti with a single self-cleaning canvas
import confetti from 'canvas-confetti';

const CELEBRATION_COLORS = ['#4d79ff', '#ae90fd', '#ffd700', '#60a5fa', '#FF6B9D', '#22c55e', '#FF6600', '#E60023'];

/**
 * Trigger a big confetti celebration (group complete, perfect score, etc.)
 */
export const triggerCelebration = () => {
  // First burst
  confetti({
    particleCount: 150,
    spread: 80,
    origin: { y: 0.6 },
    colors: CELEBRATION_COLORS,
  });
  // Second burst slightly delayed for fullness
  setTimeout(() => {
    confetti({
      particleCount: 80,
      spread: 100,
      origin: { y: 0.5, x: 0.3 },
      colors: CELEBRATION_COLORS,
    });
    confetti({
      particleCount: 80,
      spread: 100,
      origin: { y: 0.5, x: 0.7 },
      colors: CELEBRATION_COLORS,
    });
  }, 300);
};

/**
 * Trigger a small confetti burst (single word complete, match, etc.)
 */
export const triggerSmallBurst = () => {
  confetti({
    particleCount: 40,
    spread: 60,
    origin: { y: 0.65 },
    colors: CELEBRATION_COLORS,
    scalar: 0.8,
  });
};

/**
 * Trigger confetti from a specific point (e.g., where a balloon popped)
 * @param {number} x - normalized x (0-1)
 * @param {number} y - normalized y (0-1)
 */
export const triggerBurstAt = (x, y) => {
  confetti({
    particleCount: 30,
    spread: 50,
    origin: { x, y },
    colors: CELEBRATION_COLORS,
    scalar: 0.7,
  });
};
