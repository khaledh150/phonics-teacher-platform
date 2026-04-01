import React, { useState, useRef, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronLeft, ChevronRight } from 'lucide-react';

/**
 * Glass arrow overlay for horizontally scrollable containers.
 * Listens for swipe on the scroll container itself (no blocking overlay).
 * Arrows appear on scroll and auto-hide after 2.5s.
 *
 * @param {React.RefObject} scrollRef - ref to the scrollable container
 * @param {number} scrollAmount - pixels to scroll per arrow click (default 400)
 */
const ScrollNavOverlay = ({ scrollRef, scrollAmount = 400 }) => {
  const [visible, setVisible] = useState(false);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);
  const hideTimer = useRef(null);

  const checkScroll = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    setCanScrollLeft(el.scrollLeft > 10);
    setCanScrollRight(el.scrollLeft < el.scrollWidth - el.clientWidth - 10);
  }, [scrollRef]);

  const show = useCallback(() => {
    setVisible(true);
    clearTimeout(hideTimer.current);
    hideTimer.current = setTimeout(() => setVisible(false), 2500);
  }, []);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    checkScroll();

    // Show arrows whenever the user scrolls (native swipe or programmatic)
    const onScroll = () => {
      checkScroll();
      show();
    };

    el.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', checkScroll);
    const timer = setTimeout(checkScroll, 500);
    return () => {
      el.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', checkScroll);
      clearTimeout(timer);
    };
  }, [checkScroll, show]);

  useEffect(() => () => clearTimeout(hideTimer.current), []);

  const scroll = (dir) => {
    const el = scrollRef.current;
    if (!el) return;
    el.scrollBy({ left: dir * scrollAmount, behavior: 'smooth' });
    clearTimeout(hideTimer.current);
    hideTimer.current = setTimeout(() => setVisible(false), 2500);
  };

  const arrowStyle = {
    background: 'rgba(255,255,255,0.15)',
    border: '1px solid rgba(255,255,255,0.25)',
  };

  return (
    <>
      <AnimatePresence>
        {visible && canScrollLeft && (
          <motion.button
            key="scroll-left"
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            transition={{ duration: 0.2 }}
            onClick={(e) => { e.stopPropagation(); scroll(-1); }}
            className="absolute left-2 top-1/2 -translate-y-1/2 z-20 p-2.5 md:p-3 rounded-2xl backdrop-blur-md"
            style={arrowStyle}
            whileTap={{ scale: 0.9 }}
          >
            <ChevronLeft className="w-5 h-5 md:w-6 md:h-6 text-white/80" />
          </motion.button>
        )}
      </AnimatePresence>
      <AnimatePresence>
        {visible && canScrollRight && (
          <motion.button
            key="scroll-right"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 20 }}
            transition={{ duration: 0.2 }}
            onClick={(e) => { e.stopPropagation(); scroll(1); }}
            className="absolute right-2 top-1/2 -translate-y-1/2 z-20 p-2.5 md:p-3 rounded-2xl backdrop-blur-md"
            style={arrowStyle}
            whileTap={{ scale: 0.9 }}
          >
            <ChevronRight className="w-5 h-5 md:w-6 md:h-6 text-white/80" />
          </motion.button>
        )}
      </AnimatePresence>
    </>
  );
};

export default ScrollNavOverlay;
