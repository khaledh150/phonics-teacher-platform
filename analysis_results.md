# Wonder Phonics Platform - Architecture & Codebase Analysis

> **Analysis Date:** April 2026
> **Stack:** React 19 + Vite 7 + Tailwind CSS v4 + PixiJS 8

## Executive Summary
The Wonder Phonics Platform is currently a solid, single-level prototype. The codebase demonstrates high-quality architectural decisions, specifically the hybrid rendering approach and the recent feature-first directory reorganization. However, to scale beyond the initial level and serve thousands of users effectively, structural changes are needed in asset management, routing, and persistent state tracking.

---

## 🌟 Strengths

1. **Hybrid Rendering Architecture:** 
   The separation of UI (React DOM) and high-performance game loops (PixiJS Canvas) is a professional-grade pattern. Using `canvas-confetti` instead of heavy DOM nodes ensures smooth animations on lower-end tablets.
2. **Feature-First Component Structure:**
   The codebase has been successfully reorganized into `curriculum`, `teaching`, `playground`, `shared`, and `themes`. This keeps the directory tree shallow and highly maintainable when adding new games.
3. **Data Layer Isolation:** 
   Centralizing curriculum data (`data/phonicsData.js`) away from the UI components allows content updates without risking regressions in component logic.
4. **Self-Contained Themes:** 
   Module designs like `SkyBackground` and `BeachBackground` bundle their own assets and animations, making them easily reusable across new games.
5. **Clean Utility Layer:**
   Audio playback, text-to-speech, and asset loaders are modularized neatly in `src/utils`, adhering to the single responsibility principle.

---

## ⚠️ Weaknesses & High-Priority Issues

> [!WARNING]
> Asset Bundling Bottleneck
> Currently, ~37MB of assets (images, audio, Lottie files) reside in `src/assets`. Because they are inside `src/`, Vite builds them into the main bundle. This breaks the Workbox PWA precache limits (typically 5MB) and drastically slows down initial load time. As levels and groups expand, this approach will not scale.

> [!IMPORTANT]
> Manual Routing System
> `App.jsx` handles all navigation via `useState` and conditional rendering. 
> - The browser "Back" button does not work.
> - Deep linking to specific games or learning groups is impossible.
> - Lazy loading (Code Splitting) routes is difficult due to the monolithic approach.

> [!NOTE]
> No Persistent State Management
> The app relies entirely on ephemeral React state. If a user refreshes the page or closes their browser, all progress (e.g., completed levels or games played) is instantly lost.

> [!CAUTION]
> Testing Deficit
> There are currently no component unit tests (Vitest) or end-to-end user-flow tests (Playwright), which makes updating audio sequencing and game loop logic prone to regressions.

---

## 🛠️ Recommended Action Plan

Here is the exact roadmap of what needs to be improved, enhanced, updated, and added. **If you would like me to begin executing any of these phases, just let me know.**

### **Phase 1: Asset Relocation (Critical for Scaling)**
1. **Move Media to Public:** Migrate level/group-specific assets (sounds, pictures, videos) from `src/assets/lvl1/*` to `public/content/lvl1/*`.
2. **Dynamic Asset Fetching:** Update `utils/assetHelpers.js` to construct static URLs rather than relying on Vite's `import.meta.glob`. 
3. **Scale Setup:** Prepare the app to serve assets from a CDN (Cloudflare or S3) in the future to keep the PWA installation size small.

### **Phase 2: Implement React Router (Architecture Overhaul)**
1. **Install Router:** Introduce `react-router-dom`.
2. **Define Routes:** Break `App.jsx` into specific routes:
   - `/` (Curriculum Map)
   - `/teach/:groupId` (Teaching Flow)
   - `/play/:groupId/:gameId` (Games & Playground)
3. **Enable Code Splitting:** Wrap heavy game components with `React.lazy` to keep the initial load lightweight.

### **Phase 3: Persistent State & Progress Tracking (Enhancement)**
1. **Global State Store:** Implement `zustand` to manage user progress (e.g., tracking which phonics groups have been finished).
2. **LocalStorage Syncing:** Hook the store to `localStorage` so a child's progress remains upon closing the app.

### **Phase 4: Testing & Stability (Updating & Fixing)**
1. **Unit Tests:** Roll out Vitest to test the audio sequencer (`utils/audioPlayer.js`).
2. **E2E Tests:** Implement Playwright to automate tests going through the entire "Teaching Flow" pipeline, ensuring the 7 steps execute correctly on both Desktop and Mobile views.

### **Phase 5: Environment Config & Styling Refinement (Minor Adds)**
1. **Environment Variables:** Establish `.env` patterns (`VITE_ASSET_URL`, etc.).
2. **CSS Module Adoption:** Empty the monolithic `App.css` file by moving styles directly to Tailwind v4 utility paths where possible.
