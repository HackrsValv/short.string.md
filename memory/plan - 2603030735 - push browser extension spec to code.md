---
tldr: Implementation plan for browser extension — phased from site-side API through full extension with swarming
status: active
---

# Plan: Push Browser Extension Spec to Code

## Context

- Spec: [[spec - browser extension - thin wrapper with optional swarming]]
- Push doc: [[push - 2603030735 - implement browser extension spec]]

## Phases

### Phase 1 - Site-side postMessage API - status: done

Prerequisite for the thin wrapper. Add a message listener to index.html so the extension's offscreen iframe can call into the site's existing compression/alias/P2P logic.

1. [x] Add postMessage listener to index.html
   - Listen for `message` events on `window`
   - Validate origin (allow same-origin + extension origins)
   - Handle `{ type: "shorten", url, mode, alias? }` → call compressURL or createNostrAlias → respond with result
   - Handle `{ type: "resolve", hash }` → call decompressURL or resolveAlias → respond with result
   - Handle `{ type: "swarm-status" }` → respond with peer count and connection state
   - Use `event.source.postMessage()` to reply
   - => Added `_ext` flag to filter extension messages from other postMessage traffic
   - => Added `_id` field for correlating requests with responses
   - => Handles alias collision checking before creation
2. [ ] Test postMessage API manually
   - Open index.html, run postMessage from devtools console to verify round-trip

### Phase 2 - Extension scaffold - status: done

Create the extension directory structure and manifest.

1. [x] Create `extension/` directory with initial structure
   - `extension/manifest.json` — MV3, permissions: storage, contextMenus, offscreen, activeTab
   - `extension/popup.html` — skeleton
   - `extension/popup.js` — skeleton
   - `extension/background.js` — skeleton service worker
   - `extension/offscreen.html` — loads short.string.md in iframe
   - `extension/offscreen.js` — bridges postMessage ↔ chrome.runtime
   - `extension/icons/` — placeholder icons (16, 48, 128)
   - => All files created as full implementations, not just skeletons
   - => Placeholder PNG icons generated via Python script (dark bg, blue "S")
   - => Also created icons/generate.sh for regeneration
2. [x] Declare keyboard shortcut in manifest
   - `_execute_action`: Ctrl+Shift+S (Cmd+Shift+S on Mac)
   - => Done in manifest.json commands section

### Phase 3 - Service worker + offscreen document - status: done

The message routing backbone — service worker manages offscreen doc lifecycle and routes requests.

1. [x] Implement offscreen document
   - `offscreen.html` loads short.string.md in an iframe
   - `offscreen.js` listens for chrome.runtime messages, forwards to iframe via postMessage, returns results
   - Handle iframe load failures gracefully
   - => 10s timeout fallback if iframe doesn't load
   - => Message ID correlation between requests and responses
   - => Different timeouts for compress (8s) vs alias (15s, involves relay queries)
2. [x] Implement service worker core
   - Create/recreate offscreen document on demand
   - Register context menu item on install
   - Handle context menu clicks: get link URL, send shorten request to offscreen doc, open popup with result
   - Route messages from popup to offscreen doc and back
   - => Context menu stores result in chrome.storage.session for popup to pick up
   - => Messages from popup tagged with `_fromPopup` to distinguish from offscreen messages
   - => History entries saved automatically on successful shorten, capped at 500
3. [x] Implement badge updates
   - Poll swarm-status from offscreen doc periodically (or on events)
   - Update badge text with peer count when swarming is active
   - Clear badge when swarming is off
   - => 30s polling interval
   - => Listens to storage changes for swarm_enabled toggle
   - => Green badge when peers connected, grey otherwise

### Phase 4 - Popup UI - status: done

The user-facing interface — matching the site's dark GitHub theme.

1. [x] Build popup HTML/CSS
   - Dark theme matching site's CSS variables
   - Current URL display (pre-filled from active tab)
   - Mode toggle: Compressed / Alias
   - Custom alias name input (visible in alias mode)
   - Shorten button
   - Result area with copy button
   - History list (scrollable)
   - Swarm section: toggle switch, peer count, status indicator
   - => 360px wide popup, max 560px tall
   - => Consent overlay dialog for first-time swarm enable
   - => Toast notifications for copy feedback
2. [x] Implement popup.js
   - On open: query active tab URL, pre-fill
   - Shorten button: send request to service worker → display result
   - Copy button: write to clipboard
   - History: load from chrome.storage.local, render list, click-to-copy
   - Swarm toggle: read/write swarm_enabled in storage, show consent dialog on first enable
   - => Uses safe DOM methods (textContent, createElement) — no innerHTML (security hook caught this)
   - => Checks for pending context menu results on open
   - => Skips chrome:// URLs when pre-filling
3. [x] Implement history storage
   - On successful shorten: append to history array in chrome.storage.local
   - Cap history at reasonable size (e.g. 500 entries)
   - History entries: { url, short, mode, created }
   - => History managed in service worker, displayed in popup (shows top 50)

### Phase 5 - Firefox/Zen native - status: done

Converted extension to Zen/Firefox-native rather than maintaining two builds.

1. [x] Convert to MV2 with background page
   - => Switched from Chrome MV3 + offscreen API to MV2 persistent background page
   - => background.html contains the iframe directly (Firefox bg pages have DOM access)
   - => Merged service worker + offscreen logic into single background.js
   - => Added browser_specific_settings with gecko ID
   - => browser/chrome API compat shim (`const api = typeof browser !== 'undefined' ? browser : chrome`)
   - => Replaced storage.session with storage.local (MV2 compat)
   - => Removed offscreen.html/offscreen.js (Chrome-only)
2. [ ] Test in Zen
   - Load as temporary add-on in Zen
   - Verify shortening and swarming work

## Verification

- Install Chrome extension, right-click a link → context menu → shortening produces valid short.string.md URL
- Click icon → popup shows current URL → shorten → result displays → copy works
- Keyboard shortcut opens popup with URL pre-filled
- Enable swarming → consent dialog → badge shows peer count → disable → badge clears
- History persists across popup opens
- Firefox variant loads and shortens URLs
- postMessage API in index.html responds correctly from devtools console

## Adjustments

- 2603030735: Phases 1-4 implemented together in a single pass rather than sequential phases. The implementations were cohesive enough to build as a unit.
- 2603030735: Phase 5 pivoted from "cross-browser build" to "Zen-native". User is on Zen, so converted directly to MV2 background page instead of maintaining Chrome + Firefox builds.

## Progress Log

- 2603030735: Phase 1 — Added postMessage API to index.html (commit a754e18)
- 2603030735: Phases 2-4 — Created full extension scaffold with service worker, offscreen doc, and popup UI (commit ffd96e5)
- 2603030735: Phase 5 — Converted to Firefox/Zen MV2 with background page (commit e80bef6)
- Next: Test in Zen browser
