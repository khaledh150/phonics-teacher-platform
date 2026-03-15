# Wonder Phonics Platform

## Tech Stack
- **React 19** + **Vite 7** — SPA, no SSR
- **Tailwind CSS v4** — utility-first styling with `clamp()` for responsive scaling
- **Framer Motion** — UI animations (transitions, modals, buttons, hover/tap effects)
- **PixiJS v8 + @pixi/react** — Canvas/WebGL rendering for 2D game areas (balloons, future games)
- **canvas-confetti** — High-performance celebration effects (replaces DOM confetti)

## Hybrid Rendering Architecture (CRITICAL)
This app uses a **hybrid React DOM + PixiJS Canvas** approach:

- **React DOM + Framer Motion** handles: HUD overlays, buttons, modals, countdown overlays, results screens, navigation, and all non-game UI
- **PixiJS `<Stage>`** handles: Game elements that need 60fps animation (balloon floating, future 2D games)
- **canvas-confetti** handles: All celebration/confetti effects via a self-cleaning canvas

### Rules for the Hybrid Approach
1. **Never use Framer Motion for per-frame game loops** — use PixiJS or `requestAnimationFrame` instead
2. **Never call `setState` inside `requestAnimationFrame`** for game objects — use refs and let PixiJS handle rendering
3. **Keep UI overlays (HUD, modals, buttons) in React DOM** — PixiJS is only for the game canvas area
4. **Wrap `<Stage>` in an ErrorBoundary** — WebGL can fail on some devices
5. **Always clean up** PixiJS tickers, intervals, and textures in `useEffect` cleanup
6. **Use `canvas-confetti`** for all celebration effects — never create 50+ animated `<div>` elements for confetti

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
- `App.jsx` — Router: curriculum/teaching screens
- `CurriculumMap.jsx` — Level + group selection
- `TeachingFlow.jsx` — Orchestrates 7 steps, shows group label on all screens
- Step components: `SoundLearning`, `GroupSong`, `FlashcardViewer`, `SoundBalloons` (PixiJS), `ExerciseMatch`, `BlendingFactory`, `SentenceScramble`

## Key Conventions
- Responsive design: must work on phone, tablet, AND projector/LED screens
- Use `clamp()`, `min()`, and `lg:`/`xl:` breakpoints for scaling
- Group label (title + icon + color) visible on all teaching screens
- Skip/Back buttons cancel ALL audio (TTS + MP3 + VO) when switching steps
- Finish group → returns to group selection (not level selection)
- Distractor sounds in balloon game come from ALL phonics groups (digraphs, trigraphs, etc.)
