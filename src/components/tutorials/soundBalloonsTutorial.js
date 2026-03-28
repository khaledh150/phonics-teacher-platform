import { Container, Graphics, Text, TextStyle, Sprite as PixiSprite } from 'pixi.js';
import { playLetterSound } from '../../utils/letterSounds';
import { playVO, delay } from '../../utils/audioPlayer';
import { triggerSmallBurst, triggerBurstAt } from '../../utils/confetti';

// All phonics sounds for distractor pool
const ALL_SOUNDS = [
  'a','b','c','d','e','f','g','h','i','j','k','l','m','n','o','p','q','r','s','t','u','v','w','x','y','z',
  'ck','sh','ch','th','qu','ai','ee','oo','ow','oi','ew','er','ar','or',
];

/**
 * Runs the SoundBalloons tutorial — spawns floating balloons with sounds,
 * hand pops 2 target balloons to demonstrate.
 *
 * @param {Function} isCancelled - Returns true if tutorial should abort
 * @param {Object} ctx - Context object with refs and callbacks
 * @param {Object} ctx.app - PixiJS Application
 * @param {HTMLElement} ctx.canvasEl - Canvas container element
 * @param {string} ctx.targetSound - The target phonics sound
 * @param {Array} ctx.balloonTextures - Array of PixiJS balloon textures
 * @param {Function} ctx.setTutorialHand - State setter for tutorial hand
 * @param {Function} ctx.setShowTutorialOverlay - State setter for overlay
 * @param {Function} ctx.playPopSound - Function to play pop SFX
 */
export async function runSoundBalloonsTutorial(isCancelled, ctx) {
  const {
    app, canvasEl, targetSound, balloonTextures,
    setTutorialHand, setShowTutorialOverlay, playPopSound,
  } = ctx;

  if (!app || !canvasEl) return;

  const stageW = app.screen.width;
  const stageH = app.screen.height;
  const balloonSize = Math.min(Math.max(110, stageW * 0.22), 180);
  const bSize = balloonSize * 1.05;
  const textures = balloonTextures || [];

  setShowTutorialOverlay(true);

  // Build demo sounds: 3 targets + 6 distractors
  const distractorList = ALL_SOUNDS.filter(s => s !== targetSound && s.length === targetSound.length);
  const demoSounds = [targetSound, targetSound, targetSound];
  for (let i = 0; i < 6 && distractorList.length > 0; i++) {
    const idx = Math.floor(Math.random() * distractorList.length);
    demoSounds.push(distractorList.splice(idx, 1)[0]);
  }
  // Shuffle
  for (let i = demoSounds.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [demoSounds[i], demoSounds[j]] = [demoSounds[j], demoSounds[i]];
  }

  // Spawn tutorial balloons — staggered across width
  const demoBalloons = [];
  const margin = balloonSize * 0.6;
  const usableWidth = stageW - margin * 2;
  const slotWidth = usableWidth / demoSounds.length;

  for (let i = 0; i < demoSounds.length; i++) {
    const container = new Container();
    if (textures.length > 0) {
      const tex = textures[Math.floor(Math.random() * textures.length)];
      const spr = new PixiSprite(tex);
      spr.anchor.set(0.5);
      const aspect = tex.height / tex.width;
      spr.width = bSize;
      spr.height = bSize * aspect;
      container.addChild(spr);
    } else {
      const gfx = new Graphics();
      gfx.ellipse(0, 0, bSize * 0.45, bSize * 0.5);
      gfx.fill({ color: 0xFF1E56, alpha: 0.92 });
      container.addChild(gfx);
    }
    const txt = new Text({
      text: demoSounds[i].toLowerCase(),
      style: new TextStyle({
        fontFamily: '"Fredoka", "Segoe UI", -apple-system, BlinkMacSystemFont, sans-serif',
        fontSize: Math.max(bSize * 0.55, 36),
        fontWeight: '900',
        fill: '#3e366b',
        stroke: { color: '#ffffff', width: 3 },
        dropShadow: { color: 0xffffff, alpha: 0.5, blur: 3, distance: 0 },
      }),
    });
    txt.anchor.set(0.5, 0.5);
    txt.y = -bSize * 0.5;
    container.addChild(txt);

    const bx = margin + slotWidth * i + slotWidth * 0.5 + (Math.random() - 0.5) * slotWidth * 0.6;
    const by = stageH + 50 + i * 40;
    container.x = bx;
    container.y = by;
    app.stage.addChild(container);
    demoBalloons.push({
      sound: demoSounds[i],
      container,
      x: bx,
      y: by,
      currentX: bx,
      speed: 1.2 + Math.random() * 0.6,
      swayOffset: Math.random() * Math.PI * 2,
      swayAmp: 18 + Math.random() * 25,
      popped: false,
      popScale: 1,
    });
  }

  // Ticker: float tutorial balloons
  const tutTicker = (ticker) => {
    if (isCancelled()) return;
    const dt = Math.min(ticker.deltaTime, 4);
    const elapsed = performance.now() / 1000;
    for (const b of demoBalloons) {
      if (b.popped) {
        b.popScale -= dt * 0.08;
        if (b.container) {
          b.container.scale.set(Math.max(b.popScale, 0));
          b.container.alpha = Math.max(b.popScale, 0);
        }
        continue;
      }
      b.y -= b.speed * dt;
      const sway = Math.sin(elapsed + b.swayOffset) * b.swayAmp;
      b.currentX = b.x + sway;
      b.container.x = b.currentX;
      b.container.y = b.y;
      if (b.y < -balloonSize * 1.5) {
        b.y = stageH + 50;
        const rSlot = Math.floor(Math.random() * demoSounds.length);
        b.x = margin + slotWidth * rSlot + slotWidth * 0.5 + (Math.random() - 0.5) * slotWidth * 0.6;
      }
    }
  };
  app.ticker.add(tutTicker);

  const cleanup = () => {
    app.ticker.remove(tutTicker);
    demoBalloons.forEach(db => { try { app.stage.removeChild(db.container); db.container.destroy({ children: true }); } catch(e){} });
  };

  // VO while balloons rise
  await playVO('Pop the balloons that make the sound...');
  if (isCancelled()) { cleanup(); return; }
  await playLetterSound(targetSound).catch(() => {});
  if (isCancelled()) { cleanup(); return; }
  await delay(600);
  if (isCancelled()) { cleanup(); return; }

  // Hand pops 2 target balloons
  let popsRemaining = 2;
  for (let pi = 0; pi < 10 && popsRemaining > 0; pi++) {
    if (isCancelled()) break;
    let bestBalloon = null;
    for (const b of demoBalloons) {
      if (b.popped || b.sound !== targetSound) continue;
      if (b.container.y > stageH * 0.65 || b.container.y < stageH * 0.2) continue;
      bestBalloon = b;
      break;
    }
    if (!bestBalloon) { await delay(400); continue; }

    const savedSpeed = bestBalloon.speed;
    bestBalloon.speed = 0;

    const rect = canvasEl.getBoundingClientRect();
    const startX = rect.left + rect.width * 0.5;
    const startY = rect.top + rect.height + 100;

    setTutorialHand({ x: startX, y: startY, visible: true, popping: false });
    await delay(300);
    if (isCancelled()) { bestBalloon.speed = savedSpeed; break; }

    const endX = rect.left + (bestBalloon.currentX / stageW) * rect.width - (balloonSize * 0.15 * rect.width / stageW);
    const endY = rect.top + (bestBalloon.container.y / stageH) * rect.height + (balloonSize * 0.1 * rect.height / stageH);
    setTutorialHand({ x: endX, y: endY, visible: true, popping: false });
    await delay(500);
    if (isCancelled()) { bestBalloon.speed = savedSpeed; break; }

    // Pop!
    setTutorialHand({ x: endX, y: endY, visible: true, popping: true });
    playPopSound();
    bestBalloon.popped = true;
    bestBalloon.popScale = 1;
    triggerBurstAt(bestBalloon.currentX / stageW, bestBalloon.container.y / stageH);
    await playLetterSound(targetSound).catch(() => {});
    popsRemaining--;

    await delay(400);
    if (isCancelled()) break;
    setTutorialHand(null);
    await delay(300);
  }
  setTutorialHand(null);
  if (isCancelled()) { cleanup(); return; }

  // Brief celebration
  triggerSmallBurst();
  await delay(800);
  if (isCancelled()) { cleanup(); return; }

  // Fade out
  app.ticker.remove(tutTicker);
  await new Promise((resolve) => {
    let t = 0;
    const fadeTicker = (ticker) => {
      if (isCancelled()) { app.ticker.remove(fadeTicker); resolve(); return; }
      t += ticker.deltaTime;
      for (const db of demoBalloons) db.container.alpha = Math.max(0, db.container.alpha - 0.04 * ticker.deltaTime);
      if (t > 30) { app.ticker.remove(fadeTicker); resolve(); }
    };
    app.ticker.add(fadeTicker);
  });
  demoBalloons.forEach(db => { try { app.stage.removeChild(db.container); db.container.destroy({ children: true }); } catch(e){} });
  if (isCancelled()) return;

  setShowTutorialOverlay(false);
}
