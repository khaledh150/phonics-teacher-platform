import { Container, Graphics, Text, TextStyle, Sprite as PixiSprite } from 'pixi.js';
import { playLetterSound } from '../../utils/letterSounds';
import { playVO, delay } from '../../utils/audioPlayer';
import { speakAsync } from '../../utils/speech';
import { triggerCelebration, triggerBurstAt } from '../../utils/confetti';

/**
 * Runs the BubbleSpell tutorial — spawns floating letter bubbles,
 * hand pops them in order to spell a tutorial word.
 *
 * @param {Function} cancelled - Returns true if tutorial should abort
 * @param {Object} ctx - Context object
 * @param {Object} ctx.app - PixiJS Application
 * @param {HTMLElement} ctx.canvasEl - Canvas container element
 * @param {Object} ctx.tutWord - Tutorial word object { word: string }
 * @param {Array} ctx.groupSounds - Group sounds for distractor pool
 * @param {Array} ctx.bubbleTextures - Array of PixiJS bubble textures
 * @param {number} ctx.bubbleRadius - Radius for bubbles
 * @param {Function} ctx.setTutorialHand - State setter for tutorial hand
 * @param {Function} ctx.setShowTutorialOverlay - State setter for overlay
 * @param {Function} ctx.setTutorialSpelled - State setter for spelled letters
 * @param {Function} ctx.setTutorialWord - State setter for tutorial word display
 * @param {Function} ctx.playPopSfx - Function to play pop SFX
 * @param {boolean} [options.isHelpReplay] - Whether this is a help replay
 */
export async function runBubbleSpellTutorial(cancelled, ctx, { isHelpReplay = false } = {}) {
  const {
    app, canvasEl, tutWord, groupSounds, bubbleTextures,
    bubbleRadius, setTutorialHand, setShowTutorialOverlay,
    setTutorialSpelled, setTutorialWord, playPopSfx,
    setInstructionLock,
  } = ctx;

  if (!app || !canvasEl) return;

  if (!isHelpReplay) {
    setInstructionLock(true);
  }

  const stageW = app.screen.width;
  const stageH = app.screen.height;
  const R = bubbleRadius;
  const textures = bubbleTextures || [];

  const tutLetters = tutWord.word.split('');
  setTutorialWord(tutWord.word);
  setShowTutorialOverlay(true);
  setTutorialSpelled([]);

  // Spawn tutorial bubbles
  const allTutLetters = [...tutLetters];
  const distractorPool = groupSounds.filter(s => s.length === 1 && !tutLetters.includes(s));
  const fallbackPool = 'abcdefghijklmnopqrstuvwxyz'.split('').filter(c => !tutLetters.includes(c));
  const pool = [...distractorPool, ...fallbackPool.filter(c => !distractorPool.includes(c))];
  const numDistractors = Math.max(6, tutLetters.length * 2);
  for (let d = 0; d < numDistractors; d++) allTutLetters.push(pool[d % pool.length]);
  for (let i = allTutLetters.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [allTutLetters[i], allTutLetters[j]] = [allTutLetters[j], allTutLetters[i]];
  }

  const tutBubbles = [];
  for (let i = 0; i < allTutLetters.length; i++) {
    const container = new Container();
    let sprite = null;
    if (textures.length > 0) {
      const tex = textures[i % textures.length];
      sprite = new PixiSprite(tex);
      sprite.anchor.set(0.5);
      sprite.width = R * 2;
      sprite.height = R * 2;
      container.addChild(sprite);
    } else {
      const circle = new Graphics();
      circle.circle(0, 0, R);
      circle.fill({ color: 0x4ECDC4, alpha: 0.7 });
      container.addChild(circle);
    }
    const txt = new Text({
      text: allTutLetters[i].toLowerCase(),
      style: new TextStyle({
        fontFamily: '"Fredoka", "Segoe UI", -apple-system, BlinkMacSystemFont, sans-serif',
        fontSize: Math.max(R * 0.85, 24),
        fontWeight: '900',
        fill: '#3e366b',
        stroke: { color: '#ffffff', width: 3 },
      }),
    });
    txt.anchor.set(0.5);
    container.addChild(txt);

    const startX = stageW * 0.1 + Math.random() * (stageW * 0.8);
    const startY = stageH * 0.78 + Math.random() * (stageH * 0.05);
    container.x = startX;
    container.y = startY;
    app.stage.addChild(container);
    tutBubbles.push({
      letter: allTutLetters[i],
      container,
      sprite,
      x: startX,
      y: startY,
      vx: (Math.random() - 0.5) * 1.4,
      vy: -(0.35 + Math.random() * 0.5),
      shimmerPhase: Math.random() * Math.PI * 2,
      popped: false,
      popScale: 1,
    });
  }

  // Ticker: move tutorial bubbles
  const tutTicker = (ticker) => {
    if (cancelled()) return;
    const dt = ticker.deltaTime;
    for (const b of tutBubbles) {
      if (b.popped) {
        b.popScale -= 0.08 * dt;
        if (b.popScale <= 0) { b.container.alpha = 0; continue; }
        b.container.scale.set(b.popScale);
        b.container.alpha = b.popScale;
        continue;
      }
      b.x += b.vx * dt;
      b.y += b.vy * dt;
      if (b.x < R) { b.x = R; b.vx = Math.abs(b.vx); }
      if (b.x > stageW - R) { b.x = stageW - R; b.vx = -Math.abs(b.vx); }
      if (b.y < -R * 2) { b.y = stageH * 0.78 + Math.random() * (stageH * 0.05); b.x = stageW * 0.1 + Math.random() * (stageW * 0.8); b.vy = -(0.35 + Math.random() * 0.5); }
      b.shimmerPhase += 0.025 * dt;
      b.container.x = b.x;
      b.container.y = b.y;
    }
  };
  app.ticker.add(tutTicker);

  const cleanup = () => {
    app.ticker.remove(tutTicker);
    tutBubbles.forEach(b => { try { app.stage.removeChild(b.container); b.container.destroy({ children: true }); } catch(e){} });
  };

  // VO while bubbles rise
  await playVO('Pop the bubbles to spell the word!');
  if (cancelled()) { cleanup(); return; }
  await delay(200);
  if (cancelled()) { cleanup(); return; }
  await speakAsync(tutWord.word, { rate: 0.75 });
  if (cancelled()) { cleanup(); return; }
  await delay(400);
  if (cancelled()) { cleanup(); return; }

  // Hand pops each letter to spell
  let spelledSoFar = [];
  for (let li = 0; li < tutLetters.length; li++) {
    if (cancelled()) break;
    const targetLetter = tutLetters[li];

    let bestBubble = null;
    let bestDist = Infinity;
    for (const b of tutBubbles) {
      if (b.popped || b.letter !== targetLetter) continue;
      if (b.container.y > stageH * 0.7 || b.container.y < R) continue;
      const distFromCenter = Math.abs(b.container.x - stageW / 2) + Math.abs(b.container.y - stageH * 0.4);
      if (distFromCenter < bestDist) { bestDist = distFromCenter; bestBubble = b; }
    }
    if (!bestBubble) continue;

    const savedVx = bestBubble.vx;
    const savedVy = bestBubble.vy;
    bestBubble.vx = 0;
    bestBubble.vy = 0;

    const rect = canvasEl.getBoundingClientRect();
    const startX = rect.left + rect.width * 0.5;
    const startY = rect.top + rect.height + 80;

    setTutorialHand({ x: startX, y: startY, visible: true, popping: false });
    await delay(300);
    if (cancelled()) { bestBubble.vx = savedVx; bestBubble.vy = savedVy; break; }

    const bubbleScreenX = rect.left + (bestBubble.container.x / stageW) * rect.width - (R * 0.35 * rect.width / stageW);
    const bubbleScreenY = rect.top + (bestBubble.container.y / stageH) * rect.height + (R * 0.2 * rect.height / stageH);
    setTutorialHand({ x: bubbleScreenX, y: bubbleScreenY, visible: true, popping: false });
    await delay(500);
    if (cancelled()) { bestBubble.vx = savedVx; bestBubble.vy = savedVy; break; }

    // Pop!
    setTutorialHand({ x: bubbleScreenX, y: bubbleScreenY, visible: true, popping: true });
    playPopSfx();
    bestBubble.popped = true;
    bestBubble.popScale = 1;
    triggerBurstAt(bestBubble.container.x / stageW, bestBubble.container.y / stageH);
    await playLetterSound(bestBubble.letter).catch(() => {});

    spelledSoFar = [...spelledSoFar, bestBubble.letter];
    setTutorialSpelled([...spelledSoFar]);

    await delay(400);
    if (cancelled()) break;
    setTutorialHand(null);
    await delay(300);
  }
  setTutorialHand(null);
  if (cancelled()) { cleanup(); return; }

  // Celebration for completed word
  if (spelledSoFar.length === tutLetters.length) {
    triggerCelebration();
    await speakAsync(tutWord.word, { rate: 0.85 });
    if (cancelled()) { cleanup(); return; }
    await delay(1000);
  }

  // Fade out
  app.ticker.remove(tutTicker);
  await new Promise((resolve) => {
    let t = 0;
    const fadeTicker = (ticker) => {
      if (cancelled()) { app.ticker.remove(fadeTicker); resolve(); return; }
      t += ticker.deltaTime;
      for (const b of tutBubbles) b.container.alpha = Math.max(0, b.container.alpha - 0.06 * ticker.deltaTime);
      if (t > 20) { app.ticker.remove(fadeTicker); resolve(); }
    };
    app.ticker.add(fadeTicker);
  });
  tutBubbles.forEach(b => { try { app.stage.removeChild(b.container); b.container.destroy({ children: true }); } catch(e){} });
  if (cancelled()) return;

  setShowTutorialOverlay(false);
  setTutorialSpelled([]);
  setTutorialWord('');
}
