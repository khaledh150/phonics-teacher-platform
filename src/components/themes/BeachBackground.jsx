/**
 * BeachBackground — Self-contained beach theme background.
 *
 * Layers (bottom to top):
 *   0. Sand beach + sidewalk photograph (object-fit: cover, crops to fit)
 *   1. 3-layer parallax sea with gentle tide animation
 *   2. Sun shimmer sparkles over water
 *   3. Floating boats with bobbing animation
 *   4. Beach stickers (surfboard, shells, beach ball)
 *   5. Animated Lottie starfish
 *
 * Usage:
 *   import BeachBackground from './themes/BeachBackground';
 *   <BeachBackground />
 */
import React, { useEffect, useRef, useMemo } from 'react';
import { motion } from 'framer-motion';
import Lottie from 'lottie-react';

// Beach layers
import sandBeachImg from '../../assets/backgrounds/beach/sand-beach-sidewalk.webp';
import boat1Img from '../../assets/backgrounds/beach/boat-1.webp';
import boat2Img from '../../assets/backgrounds/beach/boat-2.webp';

// Sea layers (3-layer parallax tide)
import seaLayer1 from '../../assets/backgrounds/beach/sea-layers/sea-layer-1.webp';
import seaLayer2 from '../../assets/backgrounds/beach/sea-layers/sea-layer-2.webp';
import seaLayer3 from '../../assets/backgrounds/beach/sea-layers/sea-layer-3.webp';

// Summer stickers
import surfingBoardImg from '../../assets/materials/summer-sticker-collection/surfing-board.webp';
import shellImg from '../../assets/materials/summer-sticker-collection/shell.webp';
import sticker2Img from '../../assets/materials/summer-sticker-collection/sticker-2.webp';
import beachBallImg from '../../assets/materials/summer-sticker-collection/beach-ball.webp';
import starfishData from '../../assets/materials/summer-sticker-collection/star-fish.json';

// ─── Sticker placements ──────────────────────────────────────────────────────

const PLACED_STICKERS = [
  { img: surfingBoardImg, x: 2, y: 40, rotate: -15, size: 'clamp(40px, 7vw, 80px)' },
  { img: shellImg, x: 5, y: 60, rotate: -8, size: 'clamp(45px, 8vw, 90px)' },
  { img: shellImg, x: 88, y: 68, rotate: 15, size: 'clamp(40px, 7vw, 85px)' },
  { img: sticker2Img, x: 83, y: 28, rotate: 10, size: 'clamp(100px, 18vw, 200px)' },
  { img: beachBallImg, x: 90, y: 42, rotate: 5, size: 'clamp(55px, 10vw, 110px)' },
];

// ─── Sea wave animation (rAF-driven, no Framer for per-frame work) ──────────

const SeaLayers = () => {
  const layer1Ref = useRef(null);
  const layer2Ref = useRef(null);
  const layer3Ref = useRef(null);
  const rafRef = useRef(null);

  useEffect(() => {
    let running = true;
    const startTime = performance.now();

    const tick = (now) => {
      if (!running) return;
      const t = (now - startTime) / 1000;

      // Gentle sinusoidal bobbing — each layer at different frequency/amplitude
      const y1 = Math.sin(t * (2 * Math.PI / 5)) * 10;           // 5s period, 10px
      const y2 = Math.sin(t * (2 * Math.PI / 6) + 0.8) * 14;     // 6s period, 14px
      const y3 = Math.sin(t * (2 * Math.PI / 4.5) + 1.6) * 7;    // 4.5s period, 7px

      if (layer1Ref.current) layer1Ref.current.style.transform = `translate3d(0, ${y1}px, 0)`;
      if (layer2Ref.current) layer2Ref.current.style.transform = `translate3d(0, ${y2}px, 0)`;
      if (layer3Ref.current) layer3Ref.current.style.transform = `translate3d(0, ${y3}px, 0)`;

      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);

    return () => { running = false; cancelAnimationFrame(rafRef.current); };
  }, []);

  const layerStyle = {
    position: 'absolute',
    top: 0,
    left: 0,
    width: '100%',
    height: 'auto',
    maxHeight: 'clamp(80px, 30vh, 280px)',
    willChange: 'transform',
    userSelect: 'none',
  };

  return (
    <div
      className="absolute w-full pointer-events-none overflow-hidden"
      style={{
        top: 0,
        left: 0,
        height: 'clamp(80px, 30vh, 280px)',
        zIndex: 1,
        transform: 'scale(1.3)',
        transformOrigin: 'top left',
      }}
    >
      <img ref={layer1Ref} src={seaLayer1} alt="" draggable={false} style={{ ...layerStyle, zIndex: 10 }} />
      <img ref={layer2Ref} src={seaLayer2} alt="" draggable={false} style={{ ...layerStyle, zIndex: 20 }} />
      <img ref={layer3Ref} src={seaLayer3} alt="" draggable={false} style={{ ...layerStyle, zIndex: 30 }} />
    </div>
  );
};

// ─── Sun shimmer sparkles ────────────────────────────────────────────────────

const SHIMMER_COUNT = 14;

const SunShimmers = React.memo(() => {
  const shimmers = useMemo(() => {
    return Array.from({ length: SHIMMER_COUNT }, (_, i) => ({
      left: 3 + (i / SHIMMER_COUNT) * 94 + Math.sin(i * 1.7) * 5,
      top: 2 + Math.sin(i * 2.3) * 6 + Math.cos(i * 0.9) * 3,
      size: 3 + (i % 3) * 1.5,
      delay: (i * 0.6) % 3.5,
      dur: 2.5 + (i % 4) * 0.6,
    }));
  }, []);

  return (
    <>
      {shimmers.map((s, i) => (
        <motion.div
          key={`shimmer-${i}`}
          className="absolute rounded-full"
          style={{
            left: `${s.left}%`,
            top: `${s.top}%`,
            width: s.size,
            height: s.size,
            zIndex: 2,
            background: 'radial-gradient(circle, rgba(255,255,220,0.9) 0%, rgba(255,255,200,0) 70%)',
            filter: 'blur(1px)',
          }}
          animate={{ opacity: [0, 0.8, 0], scale: [0.8, 1.2, 0.8] }}
          transition={{ duration: s.dur, delay: s.delay, repeat: Infinity, ease: 'easeInOut' }}
        />
      ))}
    </>
  );
});

// ─── Main BeachBackground ────────────────────────────────────────────────────

const BeachBackground = () => (
  <div
    className="absolute inset-0 z-0 pointer-events-none overflow-hidden"
    style={{ maxHeight: '100vh', maxWidth: '100vw' }}
  >
    {/* Layer 0: Sand beach + sidewalk — zoomed in slightly via scale */}
    <img
      src={sandBeachImg}
      alt=""
      draggable={false}
      className="absolute w-full h-full select-none"
      style={{
        inset: 0,
        objectFit: 'cover',
        objectPosition: 'center 55%',
        transform: 'scale(1.08)',
        transformOrigin: 'center center',
      }}
    />

    {/* Layer 1: 3-layer parallax sea (rAF-driven tide animation) */}
    <SeaLayers />

    {/* Layer 2: Sun shimmer sparkles */}
    <SunShimmers />

    {/* Layer 3: Floating boats — capped sizes */}
    <motion.img
      src={boat1Img}
      alt=""
      className="absolute select-none"
      style={{
        top: '2%', left: '5%',
        width: 'clamp(80px, 14vw, 180px)',
        zIndex: 3,
      }}
      animate={{ y: [-3, 5, -2, 4, -3], rotate: [-2, 3, -1, 2, -2] }}
      transition={{ duration: 8, repeat: Infinity, ease: 'easeInOut' }}
      draggable={false}
    />
    <motion.img
      src={boat2Img}
      alt=""
      className="absolute select-none md:hidden"
      style={{
        top: '5%', right: '10%',
        width: 'clamp(70px, 12vw, 150px)',
        zIndex: 3,
      }}
      animate={{ y: [4, -4, 3, -5, 4], rotate: [2, -2, 3, -1, 2] }}
      transition={{ duration: 9, delay: 2, repeat: Infinity, ease: 'easeInOut' }}
      draggable={false}
    />

    {/* Layer 4: Beach stickers */}
    {PLACED_STICKERS.map((s, i) => (
      <img
        key={`sticker-${i}`}
        src={s.img}
        alt=""
        className="absolute select-none opacity-85"
        style={{
          left: `${s.x}%`,
          top: `${s.y}%`,
          width: s.size,
          zIndex: 4,
          transform: `rotate(${s.rotate}deg)`,
          transformOrigin: 'center center',
        }}
        draggable={false}
      />
    ))}

    {/* Layer 5: Animated Lottie starfish */}
    <motion.div
      className="absolute"
      style={{
        bottom: '22%', left: '3%',
        width: 'clamp(65px, 11vw, 130px)',
        zIndex: 5,
      }}
      animate={{ scale: [1, 1.06, 1] }}
      transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}
    >
      <Lottie animationData={starfishData} loop autoplay style={{ width: '100%', height: '100%' }} />
    </motion.div>
  </div>
);

export default React.memo(BeachBackground);
