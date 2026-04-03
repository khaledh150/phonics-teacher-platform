/**
 * Responsive Scaling System for Wonder Phonics
 *
 * Design target: 1280x720 (landscape tablet)
 * One scale factor fits all screens — phone to tablet.
 *
 * Usage:
 *   import { useScale } from '../utils/responsive';
 *   const s = useScale();
 *   style={{ width: s(120), height: s(80), fontSize: s(24) }}
 *
 * s(designPx) returns the scaled pixel value as a number.
 * For CSS strings: `${s(24)}px`
 */

import { useState, useEffect, useCallback } from 'react';

// Design dimensions — the "ideal" tablet landscape viewport
const DESIGN_W = 1280;
const DESIGN_H = 720;

// Min/max scale bounds to prevent extremes
const MIN_SCALE = 0.4;  // ~320px phone won't go below 40%
const MAX_SCALE = 1.3;  // large tablets won't go above 130%

function computeScale() {
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  // Use the smaller ratio so nothing overflows
  const raw = Math.min(vw / DESIGN_W, vh / DESIGN_H);
  return Math.max(MIN_SCALE, Math.min(MAX_SCALE, raw));
}

/**
 * React hook that returns a scaling function.
 * Automatically updates on window resize.
 *
 * @returns {Function} s(designPixels) → scaled pixels (number)
 */
export function useScale() {
  const [scale, setScale] = useState(computeScale);

  useEffect(() => {
    const onResize = () => setScale(computeScale());
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  return useCallback((designPx) => Math.round(designPx * scale), [scale]);
}

/**
 * Get current scale factor (non-hook, for use outside React).
 */
export function getScale() {
  return computeScale();
}

/**
 * Shorthand: returns scaled px as CSS string.
 * Usage: sp(24) → "19px" on a small phone
 */
export function sp(designPx) {
  return `${Math.round(designPx * computeScale())}px`;
}
