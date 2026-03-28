/**
 * SkyBackground — Unified sky theme: blue-sky PNG + scrolling DOM clouds + Lottie birds
 *
 * Usage:
 *   import { SkyFullBackground, SkyOverlay, createSkyBackground } from './themes/SkyBackground';
 *
 *   // Full DOM background (sky + clouds + birds) — use behind a transparent PixiJS canvas:
 *   <SkyFullBackground />
 *
 *   // Birds only overlay:
 *   <SkyOverlay />
 *
 *   // Legacy PixiJS-only sky (still available):
 *   const sky = await createSkyBackground(app);
 */
import React, { useEffect, useRef } from 'react';
import Lottie from 'lottie-react';
import { Container, Sprite, Assets } from 'pixi.js';

import blueSkyUrl from '../../assets/backgrounds/sky/blue-sky.webp';
import cloud1Url from '../../assets/backgrounds/sky/cloud-1.webp';
import cloud2Url from '../../assets/backgrounds/sky/cloude-2.webp';
import cloudSmallUrl from '../../assets/backgrounds/sky/cloud-small.webp';

import bird1 from '../../assets/materials/flying-birds/bird-flying-1.json';
import bird2 from '../../assets/materials/flying-birds/bird-flying-2.json';
import bird3 from '../../assets/materials/flying-birds/bird-flying-3.json';
import bird4 from '../../assets/materials/flying-birds/bird-flying-4.json';
import bird5 from '../../assets/materials/flying-birds/bird-flying-5.json';
import bird6 from '../../assets/materials/flying-birds/bird-flying-6.json';

const BIRDS = [bird1, bird2, bird3, bird4, bird5, bird6];

// ─── Cloud definitions for rAF-driven continuous scroll ──────────────────────
// speed = seconds to cross the full screen width (higher = slower)
// startPct = initial x position as fraction of screen width (0-1)

const CLOUD_LANES = [
  // Row 1 (~3-7%)
  { src: 'cloud1', topPct: 3,  speed: 120, widthCss: 'clamp(100px, 18vw, 220px)', opacity: 0.85, startPct: 0.05 },
  { src: 'small',  topPct: 6,  speed: 140, widthCss: 'clamp(65px, 10vw, 130px)',  opacity: 0.6,  startPct: 0.55 },
  // Row 2 (~13-18%)
  { src: 'cloud2', topPct: 13, speed: 130, widthCss: 'clamp(90px, 16vw, 200px)',  opacity: 0.75, startPct: 0.3 },
  { src: 'cloud1', topPct: 17, speed: 150, widthCss: 'clamp(70px, 12vw, 160px)',  opacity: 0.55, startPct: 0.75 },
  // Row 3 (~25-31%)
  { src: 'small',  topPct: 25, speed: 135, widthCss: 'clamp(80px, 14vw, 170px)',  opacity: 0.6,  startPct: 0.15 },
  { src: 'cloud2', topPct: 30, speed: 160, widthCss: 'clamp(95px, 15vw, 190px)',  opacity: 0.5,  startPct: 0.6 },
  // Row 4 (~37-43%)
  { src: 'cloud1', topPct: 37, speed: 145, widthCss: 'clamp(75px, 13vw, 165px)',  opacity: 0.5,  startPct: 0.4 },
  { src: 'small',  topPct: 42, speed: 155, widthCss: 'clamp(60px, 9vw, 120px)',   opacity: 0.4,  startPct: 0.85 },
  // Row 5 (~50-56%)
  { src: 'cloud2', topPct: 50, speed: 140, widthCss: 'clamp(85px, 14vw, 175px)',  opacity: 0.45, startPct: 0.25 },
  { src: 'cloud1', topPct: 55, speed: 165, widthCss: 'clamp(70px, 11vw, 140px)',  opacity: 0.35, startPct: 0.7 },
  // Row 6 (~63-69%)
  { src: 'small',  topPct: 63, speed: 150, widthCss: 'clamp(75px, 12vw, 150px)',  opacity: 0.35, startPct: 0.45 },
  { src: 'cloud2', topPct: 68, speed: 170, widthCss: 'clamp(60px, 9vw, 120px)',   opacity: 0.3,  startPct: 0.1 },
];

const CLOUD_SRC_MAP = { cloud1: cloud1Url, cloud2: cloud2Url, small: cloudSmallUrl };

// ─── Bird lane definitions ───────────────────────────────────────────────────

const BIRD_LANES = [
  { birdIdx: 0, yPct: 6,  speed: 28, size: 65, goRight: true,  startPct: 0.1 },
  { birdIdx: 2, yPct: 22, speed: 35, size: 55, goRight: false, startPct: 0.6 },
  { birdIdx: 4, yPct: 42, speed: 22, size: 70, goRight: true,  startPct: 0.4 },
  { birdIdx: 1, yPct: 14, speed: 40, size: 50, goRight: true,  startPct: 0.75 },
  { birdIdx: 3, yPct: 55, speed: 30, size: 58, goRight: false, startPct: 0.3 },
  { birdIdx: 5, yPct: 68, speed: 26, size: 52, goRight: true,  startPct: 0.8 },
];

// ─── DOM Birds (requestAnimationFrame driven) ───────────────────────────────

const SkyBirdsInner = ({ zIndex = 11 }) => {
  const birdsRef = useRef(BIRD_LANES.map(lane => ({ ...lane, x: 0 })));
  const containerRef = useRef(null);
  const birdEls = useRef([]);
  const rafRef = useRef(null);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    let running = true;

    const W = el.offsetWidth || window.innerWidth;
    birdsRef.current.forEach(b => {
      b.x = b.goRight
        ? -b.size + b.startPct * (W + b.size * 2)
        : W + b.size - b.startPct * (W + b.size * 2);
    });

    let lastTime = performance.now();
    const tick = (now) => {
      if (!running) return;
      const dt = Math.min((now - lastTime) / 1000, 0.1);
      lastTime = now;
      const cW = el.offsetWidth || window.innerWidth;

      birdsRef.current.forEach((b, i) => {
        const pxPerSec = cW / b.speed;
        b.x += b.goRight ? pxPerSec * dt : -pxPerSec * dt;
        if (b.goRight && b.x > cW + b.size * 2) b.x = -b.size * 2;
        if (!b.goRight && b.x < -b.size * 2) b.x = cW + b.size * 2;

        const dom = birdEls.current[i];
        if (dom) {
          dom.style.transform = `translate3d(${b.x}px, 0, 0) scaleX(${b.goRight ? 1 : -1})`;
        }
      });
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);

    return () => { running = false; cancelAnimationFrame(rafRef.current); };
  }, []);

  return (
    <div ref={containerRef} className="absolute inset-0 pointer-events-none overflow-hidden" style={{ zIndex }}>
      {BIRD_LANES.map((lane, i) => (
        <div
          key={i}
          ref={el => { birdEls.current[i] = el; }}
          className="absolute"
          style={{ top: `${lane.yPct}%`, width: lane.size, height: lane.size, willChange: 'transform' }}
        >
          <Lottie
            animationData={BIRDS[lane.birdIdx % BIRDS.length]}
            loop autoplay
            style={{ width: '100%', height: '100%' }}
          />
        </div>
      ))}
    </div>
  );
};

/**
 * SkyOverlay — Birds-only DOM overlay. Use when you already have a sky background.
 */
export const SkyOverlay = React.memo(SkyBirdsInner);

// ─── DOM Scrolling Clouds (rAF-driven, continuous wrap-around) ───────────────

const SkyCloudsInner = ({ zIndex = 2 }) => {
  const cloudsRef = useRef(CLOUD_LANES.map(lane => ({ ...lane, x: 0, elWidth: 150 })));
  const containerRef = useRef(null);
  const cloudEls = useRef([]);
  const rafRef = useRef(null);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    let running = true;

    // Measure each cloud element's rendered width, then set starting positions
    requestAnimationFrame(() => {
      const W = el.offsetWidth || window.innerWidth;
      cloudsRef.current.forEach((c, i) => {
        const dom = cloudEls.current[i];
        c.elWidth = dom ? dom.offsetWidth : 150;
        // Start at a spread-out position across the screen
        c.x = c.startPct * (W + c.elWidth);
      });
    });

    let lastTime = performance.now();
    const tick = (now) => {
      if (!running) return;
      const dt = Math.min((now - lastTime) / 1000, 0.1);
      lastTime = now;
      const W = el.offsetWidth || window.innerWidth;

      cloudsRef.current.forEach((c, i) => {
        const pxPerSec = W / c.speed; // cross full screen in `speed` seconds
        c.x -= pxPerSec * dt; // drift left

        // Wrap: when fully off left edge, reappear on right
        if (c.x < -c.elWidth) {
          c.x = W + Math.random() * 40; // slight randomness on re-entry
        }

        const dom = cloudEls.current[i];
        if (dom) {
          dom.style.transform = `translate3d(${c.x}px, 0, 0)`;
        }
      });
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);

    return () => { running = false; cancelAnimationFrame(rafRef.current); };
  }, []);

  return (
    <div ref={containerRef} className="absolute inset-0 pointer-events-none overflow-hidden" style={{ zIndex }}>
      {CLOUD_LANES.map((lane, i) => (
        <img
          key={i}
          ref={el => { cloudEls.current[i] = el; }}
          src={CLOUD_SRC_MAP[lane.src]}
          alt=""
          draggable={false}
          className="absolute select-none"
          style={{
            top: `${lane.topPct}%`,
            width: lane.widthCss,
            opacity: lane.opacity,
            willChange: 'transform',
          }}
        />
      ))}
    </div>
  );
};

const SkyClouds = React.memo(SkyCloudsInner);

// ─── Full Sky Background (sky + clouds + birds) ─────────────────────────────

/**
 * SkyFullBackground — Drop-in full sky background for any sky-themed game.
 * Renders blue-sky.webp (z-0), scrolling clouds (z-2), and flying birds (z-3).
 * Place behind a transparent PixiJS canvas (z-10+) so game elements sit on top.
 */
const SkyFullBackgroundInner = () => (
  <>
    {/* Layer 0: Blue sky photograph */}
    <img
      src={blueSkyUrl}
      alt=""
      draggable={false}
      className="absolute inset-0 w-full h-full select-none pointer-events-none"
      style={{ objectFit: 'cover', objectPosition: 'center center', zIndex: 0 }}
    />
    {/* Layer 2: Scrolling clouds */}
    <SkyClouds zIndex={2} />
    {/* Layer 3: Flying birds */}
    <SkyBirdsInner zIndex={3} />
  </>
);

export const SkyFullBackground = React.memo(SkyFullBackgroundInner);

// ─── Legacy: Imperative PixiJS parallax sky ──────────────────────────────────

/**
 * Creates a parallax sky background inside the given PixiJS Application.
 * The container is inserted at index 0 of app.stage so it sits behind everything.
 * @deprecated Prefer SkyFullBackground DOM component with transparent canvas instead.
 */
export async function createSkyBackground(app) {
  const W = app.screen.width;
  const H = app.screen.height;

  const root = new Container();
  root.label = 'sky-bg';

  let texBlueSky, texCloud1, texCloud2, texCloudSmall;
  try {
    [texBlueSky, texCloud1, texCloud2, texCloudSmall] =
      await Promise.all([
        Assets.load(blueSkyUrl),
        Assets.load(cloud1Url),
        Assets.load(cloud2Url),
        Assets.load(cloudSmallUrl),
      ]);
  } catch (e) {
    console.warn('SkyBackground: texture load failed', e);
    app.stage.addChildAt(root, 0);
    return { container: root, destroy() { try { root.destroy({ children: true }); } catch(e) {} } };
  }

  const sky = new Sprite(texBlueSky);
  const imgW = texBlueSky.width;
  const imgH = texBlueSky.height;
  const coverScale = Math.max(W / imgW, H / imgH);
  sky.width = imgW * coverScale;
  sky.height = imgH * coverScale;
  sky.x = (W - sky.width) / 2;
  sky.y = (H - sky.height) / 2;
  root.addChild(sky);

  const midLayer = new Container();
  midLayer.label = 'clouds-mid';
  root.addChild(midLayer);

  const cloudPairs = [];
  const baseScale = Math.min(Math.max(W / 2400, 0.15), 0.45);

  const addCloud = (tex, y, speed, scaleMult, alpha, startX) => {
    const s = baseScale * scaleMult;
    const a = new Sprite(tex); a.anchor.set(0, 0.5); a.y = y; a.scale.set(s); a.alpha = alpha;
    const aW = tex.width * s;
    const totalW = Math.max(aW, W);
    const b = new Sprite(tex); b.anchor.set(0, 0.5); b.y = y; b.scale.set(s); b.alpha = alpha;
    a.x = startX; b.x = a.x + totalW;
    midLayer.addChild(a); midLayer.addChild(b);
    cloudPairs.push({ a, b, speed, totalW });
  };

  addCloud(texCloud1,     H * 0.08, 0.20, 1.0,  0.85, W * 0.05);
  addCloud(texCloud2,     H * 0.22, 0.14, 0.85, 0.75, W * 0.55);
  addCloud(texCloudSmall, H * 0.04, 0.28, 0.65, 0.65, W * 0.30);
  addCloud(texCloud1,     H * 0.38, 0.10, 0.70, 0.55, W * 0.75);
  addCloud(texCloud2,     H * 0.50, 0.16, 0.60, 0.50, W * 0.15);
  addCloud(texCloudSmall, H * 0.14, 0.24, 0.55, 0.60, W * 0.85);
  addCloud(texCloud1,     H * 0.30, 0.12, 0.50, 0.45, W * 0.45);
  addCloud(texCloudSmall, H * 0.45, 0.20, 0.45, 0.40, W * 0.65);

  const tickerFn = (ticker) => {
    const dt = ticker.deltaTime;
    for (const cp of cloudPairs) {
      cp.a.x -= cp.speed * dt;
      cp.b.x -= cp.speed * dt;
      if (cp.a.x + cp.totalW < 0) cp.a.x = cp.b.x + cp.totalW;
      if (cp.b.x + cp.totalW < 0) cp.b.x = cp.a.x + cp.totalW;
    }
  };

  app.ticker.add(tickerFn);
  app.stage.addChildAt(root, 0);

  return {
    container: root,
    destroy() {
      try { app.ticker.remove(tickerFn); } catch(e) {}
      try { root.destroy({ children: true }); } catch(e) {}
    },
  };
}
