# Component Reorganization Plan

> **PLANNING DOCUMENT ONLY** — No files should be moved, renamed, or deleted until explicitly requested. This document exists to map out every change before execution.

---

## Goal

Reorganize `src/components/` from a flat structure into a domain-grouped hierarchy, and remove dead code (unused legacy files). The result is a clearer separation between curriculum navigation, teaching flow steps, playground games, shared UI, and theme backgrounds.

---

## Phase 0: Delete Dead Code

Remove unused legacy files before reorganizing. This reduces the number of files to move and eliminates confusion.

| File to Delete | Reason |
|---|---|
| `src/components/HomeScreen.js` | Unused React Native component |
| `src/components/GameMenuScreen.js` | Unused React Native component |
| `src/components/LearnScreen.jsx` | Unused legacy component |
| `src/components/PhonicsGame.jsx` | Unused legacy component |
| `src/components/games/tracinggame/` (entire directory, 4 files) | Unused legacy tracing game |
| `src/components/themes/AnimatedSeaBackground.jsx` | Unused legacy background |

**Verification step:** After deleting, run `npm run build` to confirm nothing references these files. If the build fails, a file is not actually dead code and must be restored.

---

## Phase 1: Create Directory Structure

Create the following new directories (all under `src/components/`):

```
src/components/curriculum/
src/components/teaching/
src/components/teaching/steps/
src/components/playground/
src/components/playground/games/
src/components/playground/tutorials/
src/components/shared/
```

The existing `src/components/themes/` directory stays in place.

---

## Phase 2: Move Files (Group by Group)

### Group A: Curriculum

| Old Path | New Path |
|---|---|
| `src/components/CurriculumMap.jsx` | `src/components/curriculum/CurriculumMap.jsx` |

**Importers to update after this move:**
- `src/App.jsx` — change import from `./components/CurriculumMap` to `./components/curriculum/CurriculumMap`

**Internal imports to update inside the moved file:**
- Any `../utils/` imports remain `../../utils/` (file moved one level deeper)
- Any `../assets/` imports become `../../assets/`
- Any sibling component imports (if any) must point to their new locations

**Verify:** `npm run build`

---

### Group B: Teaching Flow + Steps

| Old Path | New Path |
|---|---|
| `src/components/TeachingFlow.jsx` | `src/components/teaching/TeachingFlow.jsx` |
| `src/components/SoundLearning.jsx` | `src/components/teaching/steps/SoundLearning.jsx` |
| `src/components/GroupSong.jsx` | `src/components/teaching/steps/GroupSong.jsx` |
| `src/components/FlashcardViewer.jsx` | `src/components/teaching/steps/FlashcardViewer.jsx` |
| `src/components/SoundBalloons.jsx` | `src/components/teaching/steps/SoundBalloons.jsx` |
| `src/components/ExerciseMatch.jsx` | `src/components/teaching/steps/ExerciseMatch.jsx` |
| `src/components/BlendingFactory.jsx` | `src/components/teaching/steps/BlendingFactory.jsx` |
| `src/components/SentenceScramble.jsx` | `src/components/teaching/steps/SentenceScramble.jsx` |

**Importers to update after this move:**

1. **`src/App.jsx`** — change import:
   - `./components/TeachingFlow` to `./components/teaching/TeachingFlow`

2. **`src/components/teaching/TeachingFlow.jsx`** (the moved file itself) — change imports of all 7 steps:
   - `./SoundLearning` to `./steps/SoundLearning`
   - `./GroupSong` to `./steps/GroupSong`
   - `./FlashcardViewer` to `./steps/FlashcardViewer`
   - `./SoundBalloons` to `./steps/SoundBalloons`
   - `./ExerciseMatch` to `./steps/ExerciseMatch`
   - `./BlendingFactory` to `./steps/BlendingFactory`
   - `./SentenceScramble` to `./steps/SentenceScramble`
   - `./SummaryPop` to `../shared/SummaryPop` (SummaryPop will move in Group D, so either move SummaryPop first or do this import update in Group D)

**Internal imports to update inside moved files:**
- TeachingFlow: `../utils/` becomes `../../utils/`, `../assets/` becomes `../../assets/`
- Each step file: `../utils/` becomes `../../../utils/`, `../assets/` becomes `../../../assets/`
- SoundBalloons: `./games/` tutorial import becomes — wait, it imports from tutorials. Old: `../components/tutorials/soundBalloonsTutorial` or similar. Needs to point to `../../playground/tutorials/soundBalloonsTutorial` (after tutorials move in Group C)

**Cross-group dependency (SoundBalloons -> tutorials):** SoundBalloons imports `soundBalloonsTutorial`. After both moves:
- Old: likely `./tutorials/soundBalloonsTutorial` or similar relative path
- New: `../../playground/tutorials/soundBalloonsTutorial`

**Verify:** `npm run build`

---

### Group C: Playground + Games + Tutorials

| Old Path | New Path |
|---|---|
| `src/components/PlaygroundHub.jsx` | `src/components/playground/PlaygroundHub.jsx` |
| `src/components/games/BubbleSpell.jsx` | `src/components/playground/games/BubbleSpell.jsx` |
| `src/components/games/CatchTheDrop.jsx` | `src/components/playground/games/CatchTheDrop.jsx` |
| `src/components/games/MagicSandTracing.jsx` | `src/components/playground/games/MagicSandTracing.jsx` |
| `src/components/games/MagicFlashlight.jsx` | `src/components/playground/games/MagicFlashlight.jsx` |
| `src/components/games/LilyPadHop.jsx` | `src/components/playground/games/LilyPadHop.jsx` |
| `src/components/games/ScratchDiscover.jsx` | `src/components/playground/games/ScratchDiscover.jsx` |
| `src/components/games/BouncyMemory.jsx` | `src/components/playground/games/BouncyMemory.jsx` |
| `src/components/games/CarnivalWheel.jsx` | `src/components/playground/games/CarnivalWheel.jsx` |
| `src/components/games/MonsterFeeder.jsx` | `src/components/playground/games/MonsterFeeder.jsx` |
| `src/components/games/ShadowMatch.jsx` | `src/components/playground/games/ShadowMatch.jsx` |
| `src/components/games/WhackASound.jsx` | `src/components/playground/games/WhackASound.jsx` |
| `src/components/games/HungryFrogs.jsx` | `src/components/playground/games/HungryFrogs.jsx` |
| `src/components/games/CrabCompanion.jsx` | `src/components/playground/games/CrabCompanion.jsx` |
| `src/components/tutorials/bubbleSpellTutorial.js` | `src/components/playground/tutorials/bubbleSpellTutorial.js` |
| `src/components/tutorials/catchTheDropTutorial.js` | `src/components/playground/tutorials/catchTheDropTutorial.js` |
| `src/components/tutorials/soundBalloonsTutorial.js` | `src/components/playground/tutorials/soundBalloonsTutorial.js` |

**Importers to update after this move:**

1. **`src/App.jsx`** — change imports for all 11+ games and PlaygroundHub:
   - `./components/PlaygroundHub` to `./components/playground/PlaygroundHub`
   - `./components/games/BubbleSpell` to `./components/playground/games/BubbleSpell`
   - `./components/games/CatchTheDrop` to `./components/playground/games/CatchTheDrop`
   - `./components/games/MagicSandTracing` to `./components/playground/games/MagicSandTracing`
   - `./components/games/MagicFlashlight` to `./components/playground/games/MagicFlashlight`
   - `./components/games/LilyPadHop` to `./components/playground/games/LilyPadHop`
   - `./components/games/ScratchDiscover` to `./components/playground/games/ScratchDiscover`
   - `./components/games/BouncyMemory` to `./components/playground/games/BouncyMemory`
   - `./components/games/CarnivalWheel` to `./components/playground/games/CarnivalWheel`
   - `./components/games/MonsterFeeder` to `./components/playground/games/MonsterFeeder`
   - `./components/games/ShadowMatch` to `./components/playground/games/ShadowMatch`
   - `./components/games/WhackASound` to `./components/playground/games/WhackASound`
   - `./components/games/HungryFrogs` to `./components/playground/games/HungryFrogs`

2. **`src/components/playground/games/MagicSandTracing.jsx`** (moved file) — update:
   - CrabCompanion import: was `./CrabCompanion`, stays `./CrabCompanion` (both in same directory, no change)
   - BeachBackground import: was `../themes/BeachBackground`, becomes `../../themes/BeachBackground`

3. **`src/components/playground/games/BubbleSpell.jsx`** (moved file) — update:
   - SkyBackground import: was `../themes/SkyBackground`, becomes `../../themes/BeachBackground`... no, becomes `../../themes/SkyBackground`

4. **`src/components/playground/games/CatchTheDrop.jsx`** (moved file) — update:
   - SkyBackground import: was `../themes/SkyBackground`, becomes `../../themes/SkyBackground`

5. **All game files** — update utility imports:
   - `../../utils/` becomes `../../../utils/`
   - `../../assets/` becomes `../../../assets/`

6. **Tutorial imports from games:**
   - BubbleSpell importing bubbleSpellTutorial: was `../tutorials/bubbleSpellTutorial`, becomes `../tutorials/bubbleSpellTutorial` (tutorials move alongside games into playground, relative path stays the same)
   - CatchTheDrop importing catchTheDropTutorial: same pattern, no change
   - SoundBalloons (in `teaching/steps/`) importing soundBalloonsTutorial: was likely `./tutorials/soundBalloonsTutorial` or `../tutorials/soundBalloonsTutorial`, becomes `../../playground/tutorials/soundBalloonsTutorial`

**Verify:** `npm run build`

---

### Group D: Shared UI Components

| Old Path | New Path |
|---|---|
| `src/components/InAppBrowserGuard.jsx` | `src/components/shared/InAppBrowserGuard.jsx` |
| `src/components/LandscapePrompt.jsx` | `src/components/shared/LandscapePrompt.jsx` |
| `src/components/Preloader.jsx` | `src/components/shared/Preloader.jsx` |
| `src/components/SummaryPop.jsx` | `src/components/shared/SummaryPop.jsx` |
| `src/components/PrintableView.jsx` | `src/components/shared/PrintableView.jsx` |
| `src/components/SettingsView.jsx` | `src/components/shared/SettingsView.jsx` |

**Importers to update after this move:**

1. **`src/App.jsx`** — change imports:
   - `./components/LandscapePrompt` to `./components/shared/LandscapePrompt`
   - `./components/InAppBrowserGuard` to `./components/shared/InAppBrowserGuard` (if imported)
   - `./components/Preloader` to `./components/shared/Preloader` (if imported)
   - `./components/PrintableView` to `./components/shared/PrintableView` (if imported)
   - `./components/SettingsView` to `./components/shared/SettingsView` (if imported)

2. **`src/components/teaching/TeachingFlow.jsx`** — change import:
   - `./SummaryPop` (already broken from Group B move) to `../shared/SummaryPop`

**Internal imports to update inside moved files:**
- `../utils/` becomes `../../utils/`
- `../assets/` becomes `../../assets/`

**Verify:** `npm run build`

---

### Group E: Themes (No Move)

The `src/components/themes/` directory stays where it is. Only the dead file `AnimatedSeaBackground.jsx` was removed in Phase 0.

No import updates needed for theme files themselves. Theme importers were already updated in Groups B and C.

---

## Phase 3: Clean Up Empty Directories

After all moves are complete, delete the now-empty directories and verify:

- `src/components/games/` (all files moved to `playground/games/`)
- `src/components/tutorials/` (all files moved to `playground/tutorials/`)

---

## Complete File Movement Summary

| # | Old Path | New Path |
|---|---|---|
| 1 | `components/CurriculumMap.jsx` | `components/curriculum/CurriculumMap.jsx` |
| 2 | `components/TeachingFlow.jsx` | `components/teaching/TeachingFlow.jsx` |
| 3 | `components/SoundLearning.jsx` | `components/teaching/steps/SoundLearning.jsx` |
| 4 | `components/GroupSong.jsx` | `components/teaching/steps/GroupSong.jsx` |
| 5 | `components/FlashcardViewer.jsx` | `components/teaching/steps/FlashcardViewer.jsx` |
| 6 | `components/SoundBalloons.jsx` | `components/teaching/steps/SoundBalloons.jsx` |
| 7 | `components/ExerciseMatch.jsx` | `components/teaching/steps/ExerciseMatch.jsx` |
| 8 | `components/BlendingFactory.jsx` | `components/teaching/steps/BlendingFactory.jsx` |
| 9 | `components/SentenceScramble.jsx` | `components/teaching/steps/SentenceScramble.jsx` |
| 10 | `components/PlaygroundHub.jsx` | `components/playground/PlaygroundHub.jsx` |
| 11 | `components/games/BubbleSpell.jsx` | `components/playground/games/BubbleSpell.jsx` |
| 12 | `components/games/CatchTheDrop.jsx` | `components/playground/games/CatchTheDrop.jsx` |
| 13 | `components/games/MagicSandTracing.jsx` | `components/playground/games/MagicSandTracing.jsx` |
| 14 | `components/games/MagicFlashlight.jsx` | `components/playground/games/MagicFlashlight.jsx` |
| 15 | `components/games/LilyPadHop.jsx` | `components/playground/games/LilyPadHop.jsx` |
| 16 | `components/games/ScratchDiscover.jsx` | `components/playground/games/ScratchDiscover.jsx` |
| 17 | `components/games/BouncyMemory.jsx` | `components/playground/games/BouncyMemory.jsx` |
| 18 | `components/games/CarnivalWheel.jsx` | `components/playground/games/CarnivalWheel.jsx` |
| 19 | `components/games/MonsterFeeder.jsx` | `components/playground/games/MonsterFeeder.jsx` |
| 20 | `components/games/ShadowMatch.jsx` | `components/playground/games/ShadowMatch.jsx` |
| 21 | `components/games/WhackASound.jsx` | `components/playground/games/WhackASound.jsx` |
| 22 | `components/games/HungryFrogs.jsx` | `components/playground/games/HungryFrogs.jsx` |
| 23 | `components/games/CrabCompanion.jsx` | `components/playground/games/CrabCompanion.jsx` |
| 24 | `components/tutorials/bubbleSpellTutorial.js` | `components/playground/tutorials/bubbleSpellTutorial.js` |
| 25 | `components/tutorials/catchTheDropTutorial.js` | `components/playground/tutorials/catchTheDropTutorial.js` |
| 26 | `components/tutorials/soundBalloonsTutorial.js` | `components/playground/tutorials/soundBalloonsTutorial.js` |
| 27 | `components/InAppBrowserGuard.jsx` | `components/shared/InAppBrowserGuard.jsx` |
| 28 | `components/LandscapePrompt.jsx` | `components/shared/LandscapePrompt.jsx` |
| 29 | `components/Preloader.jsx` | `components/shared/Preloader.jsx` |
| 30 | `components/SummaryPop.jsx` | `components/shared/SummaryPop.jsx` |
| 31 | `components/PrintableView.jsx` | `components/shared/PrintableView.jsx` |
| 32 | `components/SettingsView.jsx` | `components/shared/SettingsView.jsx` |

All paths above are relative to `src/`. Total: 32 files moved.

---

## Import Update Strategy

### Approach

For each group of moves (A through D), follow this sequence:

1. **Move the files** using `git mv` (preserves git history)
2. **Update imports inside the moved files** — relative paths to `utils/`, `assets/`, `themes/`, and sibling components all change based on new directory depth
3. **Update imports in files that reference the moved files** — primarily `App.jsx` and `TeachingFlow.jsx`
4. **Run `npm run build`** to verify no broken imports
5. **Proceed to next group only after a clean build**

### Path Depth Changes

| File Category | Old Depth (from src/) | New Depth (from src/) | utils/ path change |
|---|---|---|---|
| CurriculumMap | `components/` (1 deep) | `components/curriculum/` (2 deep) | `../utils/` to `../../utils/` |
| TeachingFlow | `components/` (1 deep) | `components/teaching/` (2 deep) | `../utils/` to `../../utils/` |
| Step components | `components/` (1 deep) | `components/teaching/steps/` (3 deep) | `../utils/` to `../../../utils/` |
| PlaygroundHub | `components/` (1 deep) | `components/playground/` (2 deep) | `../utils/` to `../../utils/` |
| Game components | `components/games/` (2 deep) | `components/playground/games/` (3 deep) | `../../utils/` to `../../../utils/` |
| Tutorial files | `components/tutorials/` (2 deep) | `components/playground/tutorials/` (3 deep) | `../../utils/` to `../../../utils/` |
| Shared components | `components/` (1 deep) | `components/shared/` (2 deep) | `../utils/` to `../../utils/` |
| Theme components | `components/themes/` (2 deep) | `components/themes/` (2 deep) | No change |

### Cross-Domain Import Changes

These are the trickiest imports because they cross group boundaries:

| From (new location) | Importing | Old import path | New import path |
|---|---|---|---|
| `teaching/steps/SoundBalloons.jsx` | soundBalloonsTutorial | `../tutorials/soundBalloonsTutorial` (approx) | `../../playground/tutorials/soundBalloonsTutorial` |
| `teaching/TeachingFlow.jsx` | SummaryPop | `./SummaryPop` | `../shared/SummaryPop` |
| `playground/games/BubbleSpell.jsx` | SkyBackground | `../themes/SkyBackground` | `../../themes/SkyBackground` |
| `playground/games/CatchTheDrop.jsx` | SkyBackground | `../themes/SkyBackground` | `../../themes/SkyBackground` |
| `playground/games/MagicSandTracing.jsx` | BeachBackground | `../themes/BeachBackground` | `../../themes/BeachBackground` |
| `playground/games/MagicSandTracing.jsx` | CrabCompanion | `./CrabCompanion` | `./CrabCompanion` (no change) |

---

## Files to Delete (Dead Code)

| File | Reason |
|---|---|
| `src/components/HomeScreen.js` | React Native leftover, not used in web app |
| `src/components/GameMenuScreen.js` | React Native leftover, not used in web app |
| `src/components/LearnScreen.jsx` | Legacy component, no imports reference it |
| `src/components/PhonicsGame.jsx` | Legacy component, no imports reference it |
| `src/components/games/tracinggame/` (entire directory) | Legacy tracing game, replaced by MagicSandTracing |
| `src/components/themes/AnimatedSeaBackground.jsx` | Legacy background, not imported anywhere |

Total: 4 files + 1 directory (containing ~4 files) + 1 theme file = ~9 files deleted.

---

## Order of Operations (Execution Checklist)

When ready to execute, follow this exact order:

- [ ] **Phase 0:** Delete dead code (6 items listed above)
- [ ] **Phase 0 verify:** `npm run build` passes
- [ ] **Phase 1:** Create new directory structure (mkdir)
- [ ] **Phase 2A:** Move CurriculumMap, update imports, `npm run build`
- [ ] **Phase 2B:** Move TeachingFlow + 7 steps, update imports, `npm run build`
- [ ] **Phase 2C:** Move PlaygroundHub + 13 games + 3 tutorials, update imports, `npm run build`
- [ ] **Phase 2D:** Move 6 shared components, update imports, `npm run build`
- [ ] **Phase 3:** Delete empty `games/` and `tutorials/` directories
- [ ] **Final verify:** `npm run build` passes, `npm run dev` works, test app in browser
- [ ] **Bump `APP_VERSION`** in `src/App.jsx` (per project rules)
- [ ] **Commit** with message describing the reorganization

---

## Risks and Mitigations

| Risk | Mitigation |
|---|---|
| Missed import causes runtime crash | Build after every group; test in browser after all moves |
| Dynamic imports (lazy/import()) break | Search for `import(` and `lazy(` in codebase before starting |
| Asset paths in CSS/Tailwind break | Asset paths use `src/assets/` which is unaffected by component moves |
| Git history lost | Use `git mv` for all moves to preserve rename tracking |
| PWA cache serves old paths | Bump `APP_VERSION` after reorganization to force cache clear |
| Vite alias paths exist | Check `vite.config.js` for `resolve.alias` — if `@/` alias exists, some paths may not need changing |

---

## Notes

- The `src/utils/` and `src/assets/` directories are **not** being reorganized in this plan. Only `src/components/` is affected.
- The `src/components/themes/` directory stays at its current location. It is already well-organized.
- This plan does **not** introduce barrel files (`index.js` re-exports). That can be considered as a separate follow-up if desired.
- Before executing, verify the exact current import paths by reading each file. The paths listed above are best estimates based on the structure report. Actual relative paths should be confirmed during execution.
