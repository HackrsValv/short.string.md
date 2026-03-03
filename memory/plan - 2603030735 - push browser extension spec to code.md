---
tldr: Implementation plan for browser extension — phased from site-side API through full extension with swarming
status: active
---

# Plan: Push Browser Extension Spec to Code

## Context

- Spec: [[spec - browser extension - thin wrapper with optional swarming]]
- Push doc: [[push - 2603030735 - implement browser extension spec]]

## Phases

### Phase 1 - Site-side postMessage API - status: open

Prerequisite for the thin wrapper. Add a message listener to index.html so the extension's offscreen iframe can call into the site's existing compression/alias/P2P logic.

1. [ ] Add postMessage listener to index.html
   - Listen for `message` events on `window`
   - Validate origin (allow same-origin + extension origins)
   - Handle `{ type: "shorten", url, mode, alias? }` → call compressURL or createNostrAlias → respond with result
   - Handle `{ type: "resolve", hash }` → call decompressURL or resolveAlias → respond with result
   - Handle `{ type: "swarm-status" }` → respond with peer count and connection state
   - Use `event.source.postMessage()` to reply
2. [ ] Test postMessage API manually
   - Open index.html, run postMessage from devtools console to verify round-trip

### Phase 2 - Extension scaffold - status: open

Create the extension directory structure and manifest.

1. [ ] Create `extension/` directory with initial structure
   - `extension/manifest.json` — MV3, permissions: storage, contextMenus, offscreen, activeTab
   - `extension/popup.html` — skeleton
   - `extension/popup.js` — skeleton
   - `extension/background.js` — skeleton service worker
   - `extension/offscreen.html` — loads short.string.md in iframe
   - `extension/offscreen.js` — bridges postMessage ↔ chrome.runtime
   - `extension/icons/` — placeholder icons (16, 48, 128)
2. [ ] Declare keyboard shortcut in manifest
   - `_execute_action`: Ctrl+Shift+S (Cmd+Shift+S on Mac)

### Phase 3 - Service worker + offscreen document - status: open

The message routing backbone — service worker manages offscreen doc lifecycle and routes requests.

1. [ ] Implement offscreen document
   - `offscreen.html` loads short.string.md in an iframe
   - `offscreen.js` listens for chrome.runtime messages, forwards to iframe via postMessage, returns results
   - Handle iframe load failures gracefully
2. [ ] Implement service worker core
   - Create/recreate offscreen document on demand
   - Register context menu item on install
   - Handle context menu clicks: get link URL, send shorten request to offscreen doc, open popup with result
   - Route messages from popup to offscreen doc and back
3. [ ] Implement badge updates
   - Poll swarm-status from offscreen doc periodically (or on events)
   - Update badge text with peer count when swarming is active
   - Clear badge when swarming is off

### Phase 4 - Popup UI - status: open

The user-facing interface — matching the site's dark GitHub theme.

1. [ ] Build popup HTML/CSS
   - Dark theme matching site's CSS variables
   - Current URL display (pre-filled from active tab)
   - Mode toggle: Compressed / Alias
   - Custom alias name input (visible in alias mode)
   - Shorten button
   - Result area with copy button
   - History list (scrollable)
   - Swarm section: toggle switch, peer count, status indicator
2. [ ] Implement popup.js
   - On open: query active tab URL, pre-fill
   - Shorten button: send request to service worker → display result
   - Copy button: write to clipboard
   - History: load from chrome.storage.local, render list, click-to-copy
   - Swarm toggle: read/write swarm_enabled in storage, show consent dialog on first enable
3. [ ] Implement history storage
   - On successful shorten: append to history array in chrome.storage.local
   - Cap history at reasonable size (e.g. 500 entries)
   - History entries: { url, short, mode, created }

### Phase 5 - Cross-browser build - status: open

Produce Firefox/Zen variant from the same codebase.

1. [ ] Create build script
   - Copy extension/ to build/chrome/ and build/firefox/
   - Chrome: manifest v3 as-is (offscreen API)
   - Firefox: modify manifest for browser_specific_settings, replace offscreen with background page + iframe approach
   - Simple shell script or node script
2. [ ] Test Firefox variant
   - Load in Firefox/Zen as temporary add-on
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

(none yet)

## Progress Log

(none yet)
