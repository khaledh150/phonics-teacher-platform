import { Container, Graphics, Text, TextStyle, Sprite as PixiSprite } from 'pixi.js';
import { playLetterSound } from '../../utils/letterSounds';
import { playVO, delay } from '../../utils/audioPlayer';
import { triggerSmallBurst } from '../../utils/confetti';

/**
 * Runs the CatchTheDrop tutorial — demonstrates moving the balloon catcher
 * left/right, then shows drops falling in lanes with the hand guiding
 * the balloon to catch the correct ones.
 *
 * @param {Function} cancelled - Returns true if tutorial should abort
 * @param {Object} ctx - Context object
 * @param {Object} ctx.app - PixiJS Application
 * @param {HTMLElement} ctx.canvasEl - Canvas container element
 * @param {Object} ctx.wagon - PixiJS wagon/balloon container
 * @param {number} ctx.laneCount - Number of drop lanes
 * @param {string} ctx.targetSound - Target sound for this round
 * @param {Function} ctx.getWordsForSound - Returns words starting with sound
 * @param {Function} ctx.getDistractorWords - Returns distractor words
 * @param {Function} ctx.createDropItem - Creates a drop item PixiJS container
 * @param {Array} ctx.itemBubbleTextures - Item bubble textures
 * @param {Function} ctx.setTutorialHand - State setter for tutorial hand
 * @param {Function} ctx.setShowTutorialOverlay - State setter for overlay
 * @param {Function} ctx.setInstructionLock - State setter for instruction lock
 * @param {Function} ctx.playCatchSfx - Play catch sound effect
 * @param {boolean} [options.isHelpReplay] - Whether this is a help replay
 */
export async function runCatchTheDropTutorial(cancelled, ctx, { isHelpReplay = false } = {}) {
  const {
    app, canvasEl, wagon, laneCount, targetSound,
    getWordsForSound, getDistractorWords, createDropItem,
    setTutorialHand, setShowTutorialOverlay, setInstructionLock,
    playCatchSfx,
  } = ctx;

  if (!app || !canvasEl || !wagon) return;

  if (!isHelpReplay) {
    setInstructionLock(true);
  }

  const screenW = app.screen.width;
  const screenH = app.screen.height;
  const lanes = laneCount;
  const laneW = screenW / lanes;
  const centerX = screenW / 2;
  const swayRange = screenW * 0.3;

  const correctWords = getWordsForSound(targetSound);
  const distractorWords = getDistractorWords(targetSound);
  if (correctWords.length === 0) return;

  setShowTutorialOverlay(true);

  // --- Phase 1: Sway balloon left and right to show movement ---
  const rect = canvasEl.getBoundingClientRect();

  // Show hand at balloon position
  const handBalloonX = rect.left + rect.width * 0.5;
  const handBalloonY = rect.top + rect.height * 0.8;
  setTutorialHand({ x: handBalloonX, y: handBalloonY, visible: true, catching: false });

  // Sway left
  await new Promise((resolve) => {
    const targetLeft = centerX - swayRange;
    const swayTick = (ticker) => {
      if (cancelled()) { app.ticker.remove(swayTick); resolve(); return; }
      wagon.x += (targetLeft - wagon.x) * 0.06 * ticker.deltaTime;
      // Update hand position to follow balloon
      const bx = rect.left + (wagon.x / screenW) * rect.width;
      setTutorialHand({ x: bx, y: handBalloonY, visible: true, catching: false });
      if (Math.abs(wagon.x - targetLeft) < 3) {
        wagon.x = targetLeft;
        app.ticker.remove(swayTick);
        resolve();
      }
    };
    app.ticker.add(swayTick);
  });
  if (cancelled()) { wagon.x = centerX; setTutorialHand(null); setShowTutorialOverlay(false); return; }
  await delay(200);

  // Sway right
  await new Promise((resolve) => {
    const targetRight = centerX + swayRange;
    const swayTick = (ticker) => {
      if (cancelled()) { app.ticker.remove(swayTick); resolve(); return; }
      wagon.x += (targetRight - wagon.x) * 0.06 * ticker.deltaTime;
      const bx = rect.left + (wagon.x / screenW) * rect.width;
      setTutorialHand({ x: bx, y: handBalloonY, visible: true, catching: false });
      if (Math.abs(wagon.x - targetRight) < 3) {
        wagon.x = targetRight;
        app.ticker.remove(swayTick);
        resolve();
      }
    };
    app.ticker.add(swayTick);
  });
  if (cancelled()) { wagon.x = centerX; setTutorialHand(null); setShowTutorialOverlay(false); return; }
  await delay(200);

  // Return to center
  await new Promise((resolve) => {
    const swayTick = (ticker) => {
      if (cancelled()) { app.ticker.remove(swayTick); resolve(); return; }
      wagon.x += (centerX - wagon.x) * 0.06 * ticker.deltaTime;
      const bx = rect.left + (wagon.x / screenW) * rect.width;
      setTutorialHand({ x: bx, y: handBalloonY, visible: true, catching: false });
      if (Math.abs(wagon.x - centerX) < 3) {
        wagon.x = centerX;
        app.ticker.remove(swayTick);
        resolve();
      }
    };
    app.ticker.add(swayTick);
  });
  if (cancelled()) { wagon.x = centerX; setTutorialHand(null); setShowTutorialOverlay(false); return; }
  setTutorialHand(null);
  await delay(300);

  // --- Phase 2: Demo drops falling, hand moves balloon to catch correct ones ---
  // Build demo queue
  const demoQueue = [];
  demoQueue.push({ word: distractorWords[0] || 'no', isCorrect: false, lane: 0 });
  demoQueue.push({ word: correctWords[0], isCorrect: true, lane: 1 });
  demoQueue.push({ word: correctWords[Math.min(1, correctWords.length - 1)], isCorrect: true, lane: 2 % lanes });
  demoQueue.push({ word: distractorWords[1] || distractorWords[0] || 'no', isCorrect: false, lane: (lanes > 3 ? 3 : 0) });

  // Spawn all demo items at staggered heights above screen
  const demoItems = [];
  for (let i = 0; i < demoQueue.length; i++) {
    const entry = demoQueue[i];
    const { itemContainer, itemSize } = createDropItem(entry.word, screenW);
    const spawnX = laneW * entry.lane + laneW / 2;
    itemContainer.x = spawnX;
    itemContainer.y = -(itemSize / 2) - i * (screenH * 0.25);
    app.stage.addChild(itemContainer);
    demoItems.push({
      container: itemContainer,
      laneX: spawnX,
      isCorrect: entry.isCorrect,
      speed: 1.8,
      caught: false,
      frozen: false,
    });
  }

  // Ticker: move demo items down
  const tutTicker = (ticker) => {
    if (cancelled()) return;
    const dt = ticker.deltaTime;
    for (const d of demoItems) {
      if (d.caught || d.frozen) continue;
      d.container.y += d.speed * dt;
      if (!d.isCorrect && d.container.y > screenH + 60) {
        d.caught = true;
        d.container.alpha = 0.2;
      }
    }
  };
  app.ticker.add(tutTicker);

  const cleanup = () => {
    app.ticker.remove(tutTicker);
    demoItems.forEach(d => {
      try { if (d.container.parent) app.stage.removeChild(d.container); d.container.destroy({ children: true }); } catch(e){}
    });
  };

  // Play VO while drops are falling
  await playVO('Catch the items that start with the sound...');
  if (cancelled()) { cleanup(); setShowTutorialOverlay(false); return; }
  await delay(200);
  if (cancelled()) { cleanup(); setShowTutorialOverlay(false); return; }
  await playLetterSound(targetSound).catch(() => {});
  if (cancelled()) { cleanup(); setShowTutorialOverlay(false); return; }
  await delay(400);
  if (cancelled()) { cleanup(); setShowTutorialOverlay(false); return; }

  // For each correct item, freeze it, show hand moving balloon
  for (const d of demoItems) {
    if (!d.isCorrect) continue;
    if (cancelled()) break;

    // Wait until item reaches ~35% of screen
    await new Promise((resolve) => {
      const waitTick = (ticker) => {
        if (cancelled() || d.container.y >= screenH * 0.35) {
          app.ticker.remove(waitTick);
          resolve();
        }
      };
      app.ticker.add(waitTick);
    });
    if (cancelled()) break;

    d.frozen = true;

    // Hand appears at bottom center, moves to indicate lane
    const handStartX = rect.left + rect.width * 0.5;
    const handStartY = rect.top + rect.height * 0.85;
    setTutorialHand({ x: handStartX, y: handStartY, visible: true, catching: false });
    await delay(350);
    if (cancelled()) break;

    const targetScreenX = rect.left + (d.laneX / screenW) * rect.width;
    const targetScreenY = rect.top + rect.height * 0.75;
    setTutorialHand({ x: targetScreenX, y: targetScreenY, visible: true, catching: false });

    // Move wagon to the lane
    await new Promise((resolve) => {
      const moveTick = (ticker) => {
        if (cancelled()) { app.ticker.remove(moveTick); resolve(); return; }
        wagon.x += (d.laneX - wagon.x) * 0.08 * ticker.deltaTime;
        if (Math.abs(wagon.x - d.laneX) < 3) {
          wagon.x = d.laneX;
          app.ticker.remove(moveTick);
          resolve();
        }
      };
      app.ticker.add(moveTick);
    });
    if (cancelled()) break;

    // Unfreeze and catch
    d.frozen = false;
    setTutorialHand({ x: targetScreenX, y: targetScreenY, visible: true, catching: true });

    await new Promise((resolve) => {
      const catchTick = (ticker) => {
        if (cancelled() || d.container.y >= wagon.y - 50) {
          app.ticker.remove(catchTick);
          resolve();
        }
      };
      app.ticker.add(catchTick);
    });
    if (cancelled()) break;

    // Catch!
    d.caught = true;
    d.container.alpha = 0;
    playCatchSfx();
    triggerSmallBurst();
    await delay(500);
    setTutorialHand(null);
    await delay(300);
  }
  setTutorialHand(null);
  if (cancelled()) { cleanup(); setShowTutorialOverlay(false); return; }

  await playVO('Move the balloon to catch them!');
  if (cancelled()) { cleanup(); setShowTutorialOverlay(false); return; }
  await delay(600);

  // Fade out demo items
  app.ticker.remove(tutTicker);
  await new Promise((resolve) => {
    let t = 0;
    const fadeTicker = (ticker) => {
      if (cancelled()) { app.ticker.remove(fadeTicker); resolve(); return; }
      t += ticker.deltaTime;
      for (const d of demoItems) d.container.alpha = Math.max(0, d.container.alpha - 0.06 * ticker.deltaTime);
      if (t > 20) { app.ticker.remove(fadeTicker); resolve(); }
    };
    app.ticker.add(fadeTicker);
  });
  demoItems.forEach(d => {
    try { if (d.container.parent) app.stage.removeChild(d.container); d.container.destroy({ children: true }); } catch(e){}
  });
  if (cancelled()) { setShowTutorialOverlay(false); return; }

  wagon.x = centerX;
  setShowTutorialOverlay(false);
}
