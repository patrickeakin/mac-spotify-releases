# NUMU Rebuild Plan

## Overview

Make NUMU **local-first**: your release data lives in a real file on disk, the app opens directly to your data with no "Import" cold-start, and everything works offline. Then fix the secondary issues — replace the slow MusicBrainz scan with a fast Spotify one, add refresh tokens so you don't re-login hourly, modernize the tooling, and (optionally) add the desktop niceties like notifications and a menu-bar icon.

This is a slice-based rebuild, not a from-scratch rewrite. Each slice is independently mergeable; we can stop after any of them. Done in this repo on a feature branch.

## Guiding principles

- **Local-first, offline-capable.** Data lives in `~/Library/Application Support/NUMU/`, not in renderer `localStorage`. App opens to your data, no button click required, no network needed.
- **Spotify primary, MusicBrainz secondary.** Replace fuzzy name-matching against MB with `GET /v1/artists/{id}/albums`. MB only runs as background enrichment for things Spotify can't give us.
- **Same Client ID, same brand.** Existing `REACT_APP_SPOTIFY_CLIENT_ID` stays; that's where grandfathering lives. NUMU name and logo stay.
- **One slice at a time.** Each slice has its own acceptance criteria and a manual checkpoint where Patrick clicks through one thing. No slice depends on a future slice.
- **Don't rewrite what works.** Electron security baseline, PKCE, custom protocol callback, AbortController on fetches — kept as-is.

## Constraints

- macOS only (universal DMG).
- Single user, single Spotify account.
- Grandfathered for `/me/following` and `/artists/{id}/albums` — must keep using the existing app's Client ID.
- Patrick verifies anything that requires real Spotify auth or visual UI judgment.

---

## Slice 0 — Persistent local data, app opens to your data

### Goal
Fix the actual pain point: opening NUMU should show your data immediately, work offline, and never lose state from browser eviction. Move all cached state from renderer `localStorage` to a real JSON file in Electron's `userData/` directory, and hydrate it into React state on app open — so the "Import Followed Artists" cold-start screen disappears whenever cached data exists.

### Why this is slice 0
This is the user's primary complaint and it's largely independent of the Spotify rewrite. It can land first and fix the day-to-day experience immediately, even before any other slice.

### Changes
- **Use the existing `SimpleStore`** in `public/electron.js` as the canonical home for `followedArtists` and `releases`. Lives at `~/Library/Application Support/NUMU/store.json`. The IPC plumbing is already wired (`store-get`/`store-set`/`store-delete`/`store-clear`) and exposed through `preload.js`.
- **Wire up `src/services/electron-storage.ts`**, which is currently scaffolded but unused. Make it the only path the renderer uses to read/write release data.
- **Migrate `cache-manager.ts`** to write through `electron-storage.ts` instead of `localStorage`. Keep a `localStorage` fallback for the dev/browser mode (`npm start` without electron) so the dev loop stays simple.
- **Drop the cache TTLs.** No 30-day expiry, no 24-hour artist-list TTL. Data is yours and persists until you explicitly refresh. (Refreshes still update the timestamp so we can show "last updated.")
- **Hydrate on app open** in `src/App.tsx`:
  - On mount, read `followedArtists` and `releases` from the store and put them into state immediately.
  - If cached releases exist, render the feed directly. Skip the "Import Followed Artists" button entirely.
  - The button only appears for genuine first-run (no cache, no data).
- **Add a "Last updated: X ago" indicator** in the sidebar near the existing "Refresh Artists" button.
- **Reword "Refresh Artists"** to something less ambiguous (it currently clears the cache and refetches — call it "Refresh" or "Sync now").

### Files affected
- `src/App.tsx` (hydrate on mount, skip cold-start when cache exists)
- `src/services/cache-manager.ts` (storage backend → electron-storage)
- `src/services/electron-storage.ts` (finally wired up)
- `electron/preload.js` (verify all `store-*` IPC methods are exposed; should already be)
- `public/electron.js` (probably no changes; `SimpleStore` already does what we need)

### Acceptance criteria
- Open app while offline → see your last-cached releases, no errors.
- Quit (Cmd+Q) and reopen → feed renders immediately, no "Import" button.
- "Refresh" still works and updates the cache.
- Cache survives Cmd+Q, app crashes, and system reboots.
- File at `~/Library/Application Support/NUMU/store.json` contains the release data after a fetch.
- Browser dev mode (`npm start`) still works (uses `localStorage` fallback).

### Patrick checkpoint
1. Pull branch, run `npm run electron:dev`, fetch data once.
2. Quit, reopen → confirm releases appear immediately, no Import button.
3. Disable wifi, reopen → confirm everything still renders.
4. `cat ~/Library/Application\ Support/NUMU/store.json` and confirm release data is there.

---

## Slice 1 — Spotify-primary release fetching

### Goal
Replace the MusicBrainz primary path with Spotify. Manual refresh goes from ~30 minutes to ~1–2 minutes, release links go to real albums (not search URLs), cover art becomes reliable, silent wrong-artist matches go away. With slice 0 already done, the user only sees this latency on explicit refresh — never on app open.

### Changes
- Add `getArtistAlbums(artistId, accessToken)` to `src/services/spotify-client.ts`.
  - `GET /v1/artists/{id}/albums?include_groups=album,single,compilation&limit=50&market=<from /me>`
  - Paginate `next` until exhausted (most artists return one page).
  - Handle 429 with `Retry-After` header; small inter-request delay (~50 ms).
- Add `getNewReleasesFromSpotify(accessToken, onProgress)` in a new `src/services/spotify-releases.ts`.
  - For each followed artist, call `getArtistAlbums`, filter to last 180 days.
  - Dedupe by Spotify album ID (no fuzzy matching needed).
  - Map Spotify album shape to `FormattedRelease`:
    - `id` = album ID, `spotifyUrl` = album external URL, `image` = `images[0].url`, `type` = `album_type`, `releaseDate` = `release_date` (handle `release_date_precision`: `year`, `month`, `day`).
  - Mark `source: 'spotify'`.
- Update `getNewReleasesUnified` in `unified-api.ts` to delegate to the Spotify path. The cache shape from slice 0 stays — we just write Spotify-derived `FormattedRelease` objects into it instead of MB-derived ones.
- Drop the resume-on-incomplete logic; a Spotify scan is fast enough to just rerun on cancellation.
- Leave `musicbrainz-client.ts` and `release-formatter.ts` in place but unused. Slice 3 cleanup decides whether to delete them or repurpose for enrichment.
- Update the "MB" badge in `App.tsx` (line ~446) — remove it, or change to a Spotify indicator.

### Files affected
- `src/services/spotify-client.ts` (additions)
- `src/services/spotify-releases.ts` (new)
- `src/services/unified-api.ts` (delegate to Spotify path)
- `src/services/types.ts` (Spotify album types)
- `src/App.tsx` (badge tweak)

### Acceptance criteria
- Full scan of all followed artists completes in under 3 minutes.
- Release cards open the actual Spotify album page, not a search URL.
- Every release card has cover art (assuming Spotify has it for that release).
- No 429 cascades; if rate limited, scan pauses and resumes correctly.
- Existing filters (today / 7d / 90d / 6m) and sort (recent / artist) still work.
- Logout still clears the cache.

### Patrick checkpoint
1. Pull branch, run `npm run electron:dev`, click Refresh.
2. Confirm scan finishes in ~1–2 min.
3. Spot-check 5 release cards: do the Spotify links open the correct album?
4. Compare release count to your gut sense — does it look roughly right?

---

## Slice 2 — Refresh tokens and `safeStorage`

### Goal
Stop the hourly re-login. Move the access/refresh tokens off `localStorage` (XSS-exposed, plaintext on disk) into Electron's `safeStorage` (OS-keychain–backed encryption). Note: this is for **token storage only**. Release data continues to live in the slice-0 JSON file — they have different security needs.

### Changes
- Update PKCE token exchange (`exchangeCodeForToken`) to capture `refresh_token` and `expires_in` alongside `access_token`.
- Add `refreshAccessToken(refreshToken)` to `spotify-client.ts`.
- Add main-process IPC handlers `safe-storage-get` / `safe-storage-set` / `safe-storage-delete` using `electron.safeStorage`. Fall back to plain JSON if `safeStorage.isEncryptionAvailable()` is false (rare on macOS).
- Wire `electron-storage.ts` to use `safeStorage` for the token specifically (the existing `SimpleStore` JSON file is fine for everything else).
- Add `src/services/auth-manager.ts`:
  - On startup: load token + expiry from `safeStorage`.
  - Proactively refresh ~5 min before expiry.
  - On 401 from Spotify: refresh and retry once.
- Migrate any remaining `localStorage.getItem('spotify_access_token')` callers to the new manager.
- Logout clears refresh token too.

### Files affected
- `src/services/spotify-client.ts`
- `src/services/electron-storage.ts`
- `src/services/auth-manager.ts` (new)
- `public/electron.js` (safeStorage IPC handlers)
- `electron/preload.js` (expose safeStorage methods)
- `src/App.tsx` (use auth-manager instead of localStorage directly)

### Acceptance criteria
- Patrick stays logged in across app restarts.
- Patrick stays logged in for >1 hour without re-auth prompt.
- Hitting Spotify with an expired token automatically refreshes and retries.
- `~/Library/Application Support/NUMU/store.json` no longer contains the plaintext token.

### Patrick checkpoint
1. Login, close the app, reopen — still logged in.
2. Use the app for >1 hour (or wait it out) — no re-login.
3. Logout, confirm a fresh login flow is required next time.

---

## Slice 3 — Vite, TanStack Query, component split

### Goal
Modernize the build, replace hand-rolled cache logic with TanStack Query (persisted to the same JSON file slice 0 set up), break up `App.tsx`. Mostly invisible to the user; large internal quality win.

### Changes
- **Build migration: CRA → Vite**
  - Add `vite`, `@vitejs/plugin-react`, `vite-plugin-electron-renderer` (or equivalent).
  - Rename env vars from `REACT_APP_*` to `VITE_*`. Update `.env`.
  - New `vite.config.ts`. Output to `dist-renderer/` (or keep `build/` for electron-builder compatibility).
  - Update `package.json` scripts: `start` → `vite`, `build` → `vite build`.
  - Verify `electron:dev` and `electron:dist` still work end to end.
- **TanStack Query**
  - Add `@tanstack/react-query` + `@tanstack/query-async-storage-persister`.
  - Wrap renderer in `QueryClientProvider`. Persist via the **same `userData/store.json` from slice 0** (so we don't fragment storage).
  - Replace `cache-manager.ts` and `unified-api.ts` with hooks:
    - `useFollowedArtists()` — `staleTime: Infinity`, refetch only on user action.
    - `useReleases()` — same, persisted to disk.
  - Cache hydration on app open is handled automatically by the persister, replacing slice 0's manual hydration code (slice 0's IPC plumbing stays; only the React-level wiring moves).
- **Component split**
  - `src/components/LoginScreen.tsx`
  - `src/components/Sidebar.tsx`
  - `src/components/ReleaseList.tsx`
  - `src/components/ReleaseCard.tsx`
  - `src/hooks/useAuth.ts`, `useReleases.ts`, `useArtists.ts`, `useSettings.ts`
  - `App.tsx` shrinks to a router-ish shell picking login vs. main view.
- **Tests**
  - Add Vitest + Testing Library. Move `setupTests.ts` to Vitest config.
  - Cover: date filter logic, dedup logic, refresh-token retry path, sort order.
- **Cleanup that fits naturally here**
  - Delete `unified-api.ts.bak`.
  - Decide: delete `musicbrainz-client.ts` + `release-formatter.ts`, or move to `services/musicbrainz/` for future enrichment. (See Open Decisions.)
  - Remove fake `isDigitalRelease` heuristic.
  - Remove truncated `btoa` artist-list "hash" — not needed once TanStack Query keys handle this.
  - Stop auto-opening DevTools in production (`public/electron.js:93`).
  - Replace `alert()` calls with an inline error toast/banner.

### Files affected
- Most of `src/`. Largest single slice.

### Acceptance criteria
- Everything from slices 0, 1, 2 still works after the migration.
- `npm run electron:dev` and `npm run electron:dist` both succeed.
- Vitest suite passes.
- `App.tsx` < 100 lines.
- DevTools no longer opens automatically.

### Patrick checkpoint
1. Full smoke test: login → refresh → filters → sort → logout → restart-still-logged-in → offline-still-renders.
2. Run a packaged build (`npm run electron:dist`), confirm the DMG installs and the app boots with cached data intact.

---

## Slice 4 — Background sync, native notifications, menu bar (now optional)

### Goal
With slice 0 done, opening the app already shows your latest data. Slice 4 only matters if you want **passive freshness** — data updating itself in the background and notifying you about new releases without you having to open the app. Skip this slice entirely if "I'll refresh when I open it" is fine.

### Changes
- **Background sync**
  - Main-process `setInterval` (default 3h, configurable) that calls a renderer-exposed sync IPC.
  - Persist `lastSyncAt` and `lastSeenReleaseIds` in the same `userData/store.json`.
  - On wake / network reconnect, trigger a sync.
- **Native notifications**
  - Use `electron.Notification` from the main process.
  - On detecting N new releases since last sync: one summary notification ("3 new releases from artists you follow").
  - Click → focuses the app and applies a "new" filter.
- **Menu-bar icon** (`Tray`)
  - Template-style monochrome icon sourced from existing logo.
  - Badge with unread count (or just a dot).
  - Right-click menu: "Show NUMU," "Sync now," "Quit."
  - Click → toggle main window.
- **Settings panel** (small, sidebar or modal)
  - Toggle notifications.
  - Sync interval picker.
  - Show last-sync timestamp.

### Files affected
- `public/electron.js` (Tray, Notification, sync interval)
- `electron/preload.js` (sync trigger, settings IPC)
- `src/components/Settings.tsx` (new)
- `src/hooks/useSettings.ts` (new)
- `build-resources/` (template-style tray icon)

### Acceptance criteria
- Menu-bar icon appears at app launch and persists.
- "Sync now" from the tray menu updates the feed without opening the window.
- After a sync that finds new releases, a notification fires.
- Clicking the notification focuses the window.
- Quitting from the tray menu fully terminates the process.

### Patrick checkpoint
1. Launch app, confirm tray icon appears.
2. Trigger "Sync now" from the tray, confirm feed updates.
3. Wait or fake the clock to confirm scheduled sync fires.
4. Confirm a notification arrives and clicking it focuses the app.

---

## Cross-cutting cleanup (folded into the slices above)

Listed once for visibility:

- Delete `src/unified-api.ts.bak` (slice 3).
- Stop auto-opening DevTools in production (slice 3).
- Remove fake `isDigitalRelease` heuristic (slice 3).
- Replace truncated `btoa` artist-list hash (slice 3).
- Replace `alert()` error states with inline UI (slice 3).
- Remove or repurpose the "MB" badge (slice 1).
- Drop cache TTLs (slice 0).

## Out of scope (for now)

- Multi-service aggregation (Bandcamp, SoundCloud, Apple Music).
- AllMusic / Discogs.
- Per-artist mute, custom date ranges, release-type filters — easy to add later.
- Cross-device sync.
- Auto-update / Sparkle integration.

## Open decisions

These are choices Patrick should make before or during the slice they affect:

1. **What counts as "new"?** Last 7d default? Or "since last opened" / "since last marked read"?
2. **MusicBrainz enrichment — keep or drop?** If we don't use it for genre/external links in the near term, slice 3 should delete it instead of relocating it.
3. **Stale-while-revalidate on app open?** Render cached data immediately (always), and *also* silently kick off a background refresh? Or strictly "refresh only when I click"?
4. **Notification granularity (slice 4 only):** one summary per sync, or one per release (capped)?
5. **Default sync interval (slice 4 only):** 1h, 3h, 6h?
6. **Menu-bar-only mode (slice 4 only):** should NUMU run with no dock icon (LSUIElement), or always show in dock?
