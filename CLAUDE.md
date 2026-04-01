# Wonder Phonics Platform

## App Versioning (CRITICAL)
- `APP_VERSION` is defined in `src/App.jsx` — controls cache-busting for deployed PWA
- **You MUST increment `APP_VERSION`** whenever you make any code changes that will be deployed (bug fixes, new features, UI changes, game modifications, config changes, etc.)
- **Always bump by patch** (`x.x.+1`) — e.g. `2.7.0` → `2.7.1`. Do NOT bump minor/major unless explicitly asked.
- The version triggers `localStorage` clear + page reload on cached browsers, ensuring users get the latest code
- **Never forget this step** — skipping it means users with cached PWA won't see your changes

## Tech Stack
- **React 19** + **Vite 7** — SPA, no SSR, PWA via `vite-plugin-pwa` (workbox precache limit: 5 MB)
- **Tailwind CSS v4** — utility-first styling with `clamp()` for responsive scaling
- **Framer Motion** — UI animations (transitions, modals, buttons, hover/tap effects)
- **PixiJS v8 + @pixi/react** — Canvas/WebGL rendering for 2D game areas (balloons, future games)
- **canvas-confetti** — High-performance celebration effects (replaces DOM confetti)
- **Lottie (lottie-react)** — Animated stickers, birds, starfish in theme backgrounds

## Hybrid Rendering Architecture (CRITICAL)
This app uses a **hybrid React DOM + PixiJS Canvas** approach:

- **React DOM + Framer Motion** handles: HUD overlays, buttons, modals, countdown overlays, results screens, navigation, and all non-game UI
- **PixiJS Canvas** (transparent `backgroundAlpha: 0`) handles: Game elements that need 60fps animation (balloon floating, bubble spelling, sky catcher, etc.)
- **DOM theme backgrounds** sit behind transparent PixiJS canvas via z-index layering
- **canvas-confetti** handles: All celebration/confetti effects via a self-cleaning canvas

### Rules for the Hybrid Approach
1. **Never use Framer Motion for per-frame game loops** — use PixiJS or `requestAnimationFrame` instead
2. **Never call `setState` inside `requestAnimationFrame`** for game objects — use refs and let PixiJS handle rendering
3. **Keep UI overlays (HUD, modals, buttons) in React DOM** — PixiJS is only for the game canvas area
4. **Wrap `<Stage>` in an ErrorBoundary** — WebGL can fail on some devices
5. **Always clean up** PixiJS tickers, intervals, and textures in `useEffect` cleanup
6. **Use `canvas-confetti`** for all celebration effects — never create 50+ animated `<div>` elements for confetti
7. **Use ResizeObserver** on PixiJS canvas containers to keep renderer resolution matched (prevents stretching)

## Theme Backgrounds
Reusable, self-contained background components in `src/components/themes/`:

- **`SkyBackground.jsx`** — Blue sky + scrolling clouds (rAF-driven) + flying Lottie birds. Exports: `SkyFullBackground` (full bg), `SkyOverlay` (birds only), `createSkyBackground` (legacy PixiJS)
- **`BeachBackground.jsx`** — Sand beach photo + 3-layer parallax sea (rAF tide) + sun shimmers + boats + stickers + Lottie starfish

### Background Rules
- Clouds/sea use `requestAnimationFrame` for continuous scroll — never Framer Motion (causes gaps/reversals)
- Backgrounds are self-contained: one import, one component, all assets bundled
- Games using these backgrounds should set PixiJS canvas to `backgroundAlpha: 0` (transparent)
- Z-index layering: background (z-0) → clouds/sea (z-1-2) → birds/boats (z-3) → canvas (z-10+) → UI (z-30+)

## Audio System
- `src/utils/audioPlayer.js` — VO playback from `/sounds/vo/*.mp3`, returns Promises
- `src/utils/letterSounds.js` — Phoneme MP3s from `src/assets/letter-sounds/`, blending sequences
- `src/utils/speech.js` — Browser TTS with smart voice selection (prefers Natural/Online voices)
- `src/utils/encouragement.js` — Cycling encouraging VO pool (prevents repeating same phrase)
- `src/utils/confetti.js` — canvas-confetti wrappers (`triggerCelebration`, `triggerSmallBurst`, `triggerBurstAt`)

### Audio Rules
- All `playVO()` / `playLetterSound()` calls return Promises — always `await` them for sequencing
- Always call `stopVO()` + `stopAllAudio()` + `window.speechSynthesis.cancel()` when navigating away
- Idle reminders use `setTimeout` refs — always clear them in cleanup

## Component Architecture
- `App.jsx` — Router: curriculum/teaching screens. Contains `APP_VERSION` for cache-busting.
- `CurriculumMap.jsx` — Level + group selection
- `TeachingFlow.jsx` — Orchestrates 7 steps, shows group label on all screens
- Step components: `SoundLearning`, `GroupSong`, `FlashcardViewer`, `SoundBalloons` (PixiJS), `ExerciseMatch`, `BlendingFactory`, `SentenceScramble`

### Games (in `src/components/games/`)
- **`BubbleSpell.jsx`** — PixiJS bubble popping, uses `SkyFullBackground`, ResizeObserver for canvas
- **`CatchTheDrop.jsx`** — PixiJS hot air balloon catcher, uses `SkyFullBackground`, transparent canvas
- **`MagicSandTracing.jsx`** — Canvas2D letter tracing, uses `BeachBackground`, SVG stroke extraction with smart ordering (document order + connectivity chaining fallback)
- **`MagicFlashlight.jsx`**, **`LilyPadHop.jsx`**, **`ScratchDiscover.jsx`** — Additional mini-games

## Primary Target Device
- **Android Tablet (Landscape)** is the primary design target
- All layouts must use `h-screen` and `w-screen` to fill the viewport
- Optimized for **touch targets** (big buttons, fat tap zones) rather than mouse clicks
- Use `landscape:` Tailwind variant for landscape-specific overrides
- In landscape, prefer side-by-side layouts (`landscape:flex-row`) over stacked layouts
- Reduce vertical spacing in landscape (`landscape:mb-1`, `landscape:gap-2`) to prevent overflow
- Use `min(vw, vh)` sizing for elements that must fit both orientations

## Key Conventions
- Responsive design: must work on phone, tablet, AND projector/LED screens
- Use `clamp()`, `min()`, and `lg:`/`xl:` breakpoints for scaling
- Group label (title + icon + color) visible on all teaching screens
- Skip/Back buttons cancel ALL audio (TTS + MP3 + VO) when switching steps
- Finish group → returns to group selection (not level selection)
- Distractor sounds in balloon game come from ALL phonics groups (digraphs, trigraphs, etc.)
- Deploy via GitHub push → Vercel auto-deploy. Always bump `APP_VERSION` before pushing.
