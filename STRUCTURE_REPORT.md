# Wonder Phonics Platform - Structure Report

> Prepared: 2026-03-31 | Stack: React 19 + Vite 7 + Tailwind v4 + PixiJS 8

## Current Folder Structure

```
src/
  App.jsx                    # Root router + version cache-busting
  App.css                    # Global styles
  index.jsx                  # Entry point
  index.css                  # Tailwind directives

  assets/
    backgrounds/             # Theme background images (sky, beach, etc.)
    characters/              # Character sprites (crab, frogs)
    images/                  # Word flashcard images (~200+ webp files)
    letter-sounds/           # 43 phoneme MP3 files
    lvl1/group-{1..20}/      # Per-group content: sounds-pics/, sentences-pics/, music/, vids/
    materials/               # Lottie animations (birds, stickers), balloon sprites

  components/
    CurriculumMap.jsx        # Level + group selection screen
    TeachingFlow.jsx         # Teaching step orchestrator
    SoundLearning.jsx        # Step 1: Letter intro
    GroupSong.jsx            # Step 2: Sing-along
    FlashcardViewer.jsx      # Step 3: Word cards
    SoundBalloons.jsx        # Step 4: Balloon pop (PixiJS)
    ExerciseMatch.jsx        # Step 5: Picture-word matching
    BlendingFactory.jsx      # Step 6: Drag letters
    SentenceScramble.jsx     # Step 7: Build sentences
    PlaygroundHub.jsx        # Game selection screen
    InAppBrowserGuard.jsx    # In-app browser detection
    LandscapePrompt.jsx      # Orientation warning
    Preloader.jsx            # Asset preloader
    PrintableView.jsx        # Print worksheet
    SettingsView.jsx         # Settings panel
    SummaryPop.jsx           # Completion summary
    HomeScreen.js            # (unused React Native reference)
    GameMenuScreen.js        # (unused React Native reference)
    LearnScreen.jsx          # (unused legacy)
    PhonicsGame.jsx          # (unused legacy)

    games/
      BubbleSpell.jsx        # Bubble popping game
      CatchTheDrop.jsx       # Sky catcher game
      MagicSandTracing.jsx   # Letter tracing game
      MagicFlashlight.jsx    # Flashlight reveal game
      LilyPadHop.jsx         # Frog jumping game
      ScratchDiscover.jsx    # Scratch card game
      BouncyMemory.jsx       # Memory card game
      CarnivalWheel.jsx      # Spinning wheel game
      MonsterFeeder.jsx      # Monster feeding game
      ShadowMatch.jsx        # Shadow matching game
      WhackASound.jsx        # Whack-a-mole game
      HungryFrogs.jsx        # Hungry frogs feeding game
      CrabCompanion.jsx      # Crab companion NPC
      tracinggame/           # Legacy tracing game files (4 files)

    themes/
      SkyBackground.jsx      # Sky + clouds + birds
      BeachBackground.jsx    # Beach + sea + boats
      AnimatedSeaBackground.jsx  # (unused legacy)

    tutorials/
      bubbleSpellTutorial.js
      catchTheDropTutorial.js
      soundBalloonsTutorial.js

  contexts/
    MuteContext.jsx           # Global mute state

  data/
    phonicsData.js            # All phonics groups, words, sentences
    questions.js              # Quiz question data
    sets.js                   # Sound set definitions
    tracingSkeleton.json      # Tracing path data

  utils/
    assetHelpers.js           # Dynamic import.meta.glob asset loading
    audioPlayer.js            # VO playback engine
    letterSounds.js           # Phoneme sound playback + blending
    speech.js                 # Browser TTS wrapper
    encouragement.js          # Cycling encouragement VO
    confetti.js               # canvas-confetti wrappers

public/
  sounds/vo/                  # 73 voice-over MP3 files
  vids/                       # Video content
  manifest.json               # PWA manifest
  site.webmanifest
  Various icon sizes (webp)
```

**Totals:** 883 files in `src/` (821 are assets), 62 source code files, ~37 MB assets

---

## What Is Good

### 1. Clear Separation of UI vs Game Rendering
The hybrid architecture (React DOM for UI, PixiJS for games, canvas-confetti for effects) is well-executed. Each rendering layer has a clear responsibility. This is professional-grade for an ed-tech PWA.

### 2. Utility Layer Is Clean
The `utils/` directory is focused and small: audio, speech, confetti, asset helpers. Each file has a single responsibility. No "utils grab bag" anti-pattern.

### 3. Data Layer Is Separate
`data/phonicsData.js`, `questions.js`, and `sets.js` centralize curriculum content away from components. This makes it easy to update content without touching UI code.

### 4. Theme Backgrounds Are Self-Contained
`themes/SkyBackground.jsx` and `BeachBackground.jsx` bundle their own assets and animation logic. Drop-in reusable across any game or screen.

### 5. Asset Organization by Group
`src/assets/lvl1/group-{N}/` with sub-folders for `sounds-pics/`, `sentences-pics/`, `music/`, `vids/` is logical and scalable within a single level. The dynamic `import.meta.glob` loader in `assetHelpers.js` handles this well.

### 6. PWA Setup Is Solid
Service worker, manifest, cache-busting via `APP_VERSION`, in-app browser detection, landscape prompt — all production-ready patterns.

### 7. Context Is Minimal
Only one context (`MuteContext`). No over-engineered state management. For a content-driven app with simple routing, this is appropriate.

---

## What Needs to Change

### CRITICAL: Asset Bundling Will Not Scale

**Problem:** All 37 MB of assets are in `src/assets/`, meaning Vite bundles them into the build. With 6 levels x 20 groups = 120 groups planned, assets could reach 200+ MB. The Workbox precache limit is already 5 MB.

**Recommendation:**
- Move group-specific assets (images, videos, music) to `public/content/lvl{N}/group-{N}/` so they are served statically, not bundled
- Use a CDN (Cloudflare R2, AWS S3 + CloudFront) for media assets
- Implement lazy loading: only fetch assets for the active group
- Keep only shared UI assets (logos, backgrounds, Lottie files) in `src/assets/`

**Priority:** HIGH — this blocks scaling beyond Level 1

---

### HIGH: Flat Component Directory

**Problem:** `src/components/` has 20+ files at the root level mixing teaching steps, UI widgets, screens, and legacy files. As games grow (12 already), this becomes hard to navigate.

**Current:**
```
components/
  CurriculumMap.jsx
  TeachingFlow.jsx
  SoundLearning.jsx
  BlendingFactory.jsx
  ... (15 more)
  games/
  themes/
  tutorials/
```

**Recommended (Feature-First):**
```
components/
  curriculum/
    CurriculumMap.jsx
  teaching/
    TeachingFlow.jsx
    steps/
      SoundLearning.jsx
      GroupSong.jsx
      FlashcardViewer.jsx
      SoundBalloons.jsx
      ExerciseMatch.jsx
      BlendingFactory.jsx
      SentenceScramble.jsx
  playground/
    PlaygroundHub.jsx
    games/
      BubbleSpell.jsx
      CatchTheDrop.jsx
      ... (10 more)
    tutorials/
      bubbleSpellTutorial.js
      ...
  shared/
    InAppBrowserGuard.jsx
    LandscapePrompt.jsx
    Preloader.jsx
    SummaryPop.jsx
  themes/
    SkyBackground.jsx
    BeachBackground.jsx
```

This groups files by feature (curriculum, teaching, playground) rather than by type. Each feature folder is self-contained and can be worked on independently.

**Priority:** HIGH — do this before adding Level 2

---

### HIGH: No Router

**Problem:** Navigation is managed via `useState('curriculum' | 'teaching' | 'playground')` in `App.jsx` with conditional rendering. This works for 3 screens but breaks down as you add:
- User profiles / login
- Teacher dashboard
- Progress tracking
- Settings page
- Multiple levels with deep linking

**Recommendation:**
- Add `react-router-dom` (or TanStack Router) with route-based code splitting
- Routes like `/`, `/teach/:levelId/:groupId`, `/play/:levelId/:groupId/:gameId`
- Enables browser back button, deep linking, and `React.lazy()` code splitting

**Priority:** HIGH — needed before adding user accounts

---

### MEDIUM: No State Management Beyond useState

**Problem:** Game progress, scores, and completion state are ephemeral. When the user navigates away, all progress is lost. For "thousands of users" you need:
- Persistent progress tracking (which groups completed, scores)
- User profiles (even anonymous local-first)
- Sync to a backend when online

**Recommendation:**
- Add a lightweight state manager: Zustand (recommended for this app size) or Redux Toolkit
- Persist to `localStorage` via middleware (Zustand's `persist`)
- Later: sync to Supabase/Firebase for cross-device progress

**Priority:** MEDIUM — not blocking for single-device use

---

### MEDIUM: Dead Code / Legacy Files

**Problem:** Several files appear unused or are from a React Native version:
- `HomeScreen.js` — React Native import (`react-native`)
- `GameMenuScreen.js` — React Native import
- `LearnScreen.jsx` — legacy teaching screen
- `PhonicsGame.jsx` — legacy game component
- `AnimatedSeaBackground.jsx` — replaced by `BeachBackground.jsx`
- `tracinggame/` — legacy tracing game (4 files), replaced by `MagicSandTracing.jsx`

**Recommendation:** Delete all unused files. They add confusion and increase bundle size.

**Priority:** MEDIUM

---

### MEDIUM: No Testing Infrastructure

**Problem:** `App.test.js` exists but there are no component or integration tests. For a production app serving thousands of users:
- Audio sequencing bugs are hard to catch manually
- PixiJS game logic needs unit tests
- Data integrity (phonicsData.js has hundreds of entries) needs validation

**Recommendation:**
- Add Vitest (Vite-native) for unit tests
- Test `phonicsData.js` for completeness (every group has sounds, words, sentences, images)
- Test audio sequencing logic in utils
- Add Playwright for E2E testing of critical flows

**Priority:** MEDIUM — essential before scaling

---

### LOW: Single CSS File

**Problem:** `App.css` (458 lines) contains all global styles. As the app grows, this becomes a maintenance burden.

**Recommendation:** Since you use Tailwind v4, most styles should be utility classes. Move remaining custom CSS into co-located CSS modules or Tailwind `@layer` blocks. Keep `App.css` for only truly global styles (scrollbar, print).

**Priority:** LOW — Tailwind handles most styling already

---

### LOW: No Environment Configuration

**Problem:** No `.env` files, no environment-specific config. Hardcoded values for audio paths, asset paths, etc.

**Recommendation:**
- Add `.env` with `VITE_CDN_URL`, `VITE_API_URL` etc.
- Use `import.meta.env.VITE_CDN_URL` for asset URLs
- Enables staging vs production environments

**Priority:** LOW — needed when adding a backend

---

## Scaling Roadmap Summary

| Phase | Action | Impact |
|-------|--------|--------|
| **Now** | Delete dead files, move assets to `public/` | Unblocks build scaling |
| **Before Level 2** | Feature-first folder restructure | Developer velocity |
| **Before Level 2** | Add react-router with code splitting | Performance + UX |
| **Before Users** | Add Zustand + localStorage persist | Progress tracking |
| **Before 1000 Users** | CDN for media assets | Load times |
| **Before 1000 Users** | Add Vitest + Playwright tests | Reliability |
| **Before 10000 Users** | Backend (Supabase/Firebase) + auth | Multi-device sync |
| **Before 10000 Users** | Environment config (.env) | DevOps |

---

## Verdict

**Current state:** Solid for a single-developer, single-level prototype. The code quality is good, the architecture decisions (hybrid rendering, utility separation, data layer) are sound.

**Gap to "professional 2026 standards":** The main gaps are (1) asset bundling strategy, (2) flat file organization, and (3) no router. These are structural changes best done before adding Level 2 content, not after. The good news is that the codebase is small enough (~62 source files) that restructuring is a weekend task, not a month-long refactor.
