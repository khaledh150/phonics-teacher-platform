/**
 * SkyBackground — Imperative PixiJS parallax sky utility for "World 1: The Sky Kingdom"
 *
 * Usage:
 *   const sky = await createSkyBackground(app);
 *   // sky.container is added to app.stage at z-index 0
 *   // Call sky.destroy() in cleanup
 */
import { Container, Sprite, Assets } from 'pixi.js';

import blueSkyUrl from '../../assets/backgrounds/sky/blue-sky.png';
import cloud1Url from '../../assets/backgrounds/sky/cloud-1.png';
import cloud2Url from '../../assets/backgrounds/sky/cloude-2.png';
import cloudSmallUrl from '../../assets/backgrounds/sky/cloud-small.png';

/**
 * Creates a parallax sky background inside the given PixiJS Application.
 * The container is inserted at index 0 of app.stage so it sits behind everything.
 */
export async function createSkyBackground(app) {
  const W = app.screen.width;
  const H = app.screen.height;

  const root = new Container();
  root.label = 'sky-bg';

  // ── Load textures via Assets.load (PixiJS v8) ─────────────────────
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

  // ── Base layer: blue sky covers screen (center-crop, no stretch) ───
  const sky = new Sprite(texBlueSky);
  const imgW = texBlueSky.width;
  const imgH = texBlueSky.height;
  // "cover" logic: scale to fill, then center-crop
  const coverScale = Math.max(W / imgW, H / imgH);
  sky.width = imgW * coverScale;
  sky.height = imgH * coverScale;
  sky.x = (W - sky.width) / 2;
  sky.y = (H - sky.height) / 2;
  root.addChild(sky);

  // ── Mid layer: scrolling clouds (responsive sizing) ────────────────
  const midLayer = new Container();
  midLayer.label = 'clouds-mid';
  root.addChild(midLayer);

  const cloudPairs = [];

  // Responsive scale factor — clouds should be ~20-30% of screen width
  // On a 400px phone W/1200=0.33, on 1920px desktop W/1200=1.6
  // Clamp so they never get too big or too small
  const baseScale = Math.min(Math.max(W / 2400, 0.15), 0.45);

  const addCloud = (tex, y, speed, scaleMult, alpha, startX) => {
    const s = baseScale * scaleMult;
    const a = new Sprite(tex);
    a.anchor.set(0, 0.5);
    a.y = y;
    a.scale.set(s);
    a.alpha = alpha;
    const aW = tex.width * s;
    const totalW = Math.max(aW, W);

    const b = new Sprite(tex);
    b.anchor.set(0, 0.5);
    b.y = y;
    b.scale.set(s);
    b.alpha = alpha;

    // Place cloud at a natural starting x position spread across the screen
    a.x = startX;
    b.x = a.x + totalW;
    midLayer.addChild(a);
    midLayer.addChild(b);

    cloudPairs.push({ a, b, speed, totalW });
  };

  // Clouds spread naturally across the sky — varied heights, speeds, sizes, and x positions
  // startX values spread clouds across the full width so they don't line up vertically
  addCloud(texCloud1,     H * 0.08, 0.20, 1.0,  0.85, W * 0.05);
  addCloud(texCloud2,     H * 0.22, 0.14, 0.85, 0.75, W * 0.55);
  addCloud(texCloudSmall, H * 0.04, 0.28, 0.65, 0.65, W * 0.30);
  addCloud(texCloud1,     H * 0.38, 0.10, 0.70, 0.55, W * 0.75);
  addCloud(texCloud2,     H * 0.50, 0.16, 0.60, 0.50, W * 0.15);
  addCloud(texCloudSmall, H * 0.14, 0.24, 0.55, 0.60, W * 0.85);
  addCloud(texCloud1,     H * 0.30, 0.12, 0.50, 0.45, W * 0.45);
  addCloud(texCloudSmall, H * 0.45, 0.20, 0.45, 0.40, W * 0.65);

  // ── Ticker callback ────────────────────────────────────────────────
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
