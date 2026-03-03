---
tldr: Change inventory for pushing browser extension spec to code
status: active
---

# Push: Browser Extension Spec

## Change Inventory

### 1. postMessage API in index.html (site-side)
**Status:** missing
**What:** Add a message listener to index.html that accepts shorten/resolve/swarm-status requests via postMessage and returns results. This is the bridge that makes the thin wrapper architecture work.
**Claims:**
- `{ type: "shorten", url, mode, alias? }` → returns `{ type: "shortened", result }`
- `{ type: "resolve", hash }` → returns `{ type: "resolved", url }`
- `{ type: "swarm-status" }` → returns `{ type: "swarm-status", peers, connected }`
- Must validate origin to prevent abuse

### 2. Extension manifest (manifest.json)
**Status:** missing
**What:** Create manifest v3 for Chrome. Declare permissions (storage, contextMenus, offscreen, activeTab, clipboardWrite), background service worker, popup, keyboard shortcut, content scripts.
**Cross-browser:** Need a Firefox variant (or conditional build) for Zen/Firefox compatibility.

### 3. Service worker (background.js)
**Status:** missing
**What:** Routes messages between popup/context menu and offscreen document. Manages offscreen document lifecycle (create/recreate). Handles context menu registration. Manages chrome.storage for history and settings.
**Claims:**
- Creates offscreen document on demand
- Recreates if browser closes it
- Registers context menu "Shorten with short.string.md"
- Routes shorten/resolve requests to offscreen doc
- Updates badge with swarm peer count
- Stores history entries in chrome.storage.local

### 4. Offscreen document (offscreen.html + offscreen.js)
**Status:** missing
**What:** Loads short.string.md in an iframe. Bridges postMessage between the iframe and chrome.runtime messages from the service worker.
**Claims:**
- Loads short.string.md in an iframe
- Forwards shorten/resolve/swarm-status requests via postMessage
- Returns results back to service worker via chrome.runtime

### 5. Popup UI (popup.html + popup.js)
**Status:** missing
**What:** Extension popup. Shows current page URL pre-filled, compress/alias mode toggle, custom alias input, shorten button, result with copy button, history list, swarm toggle.
**Claims:**
- Pre-fills current tab URL on open
- Choose compressed vs alias mode
- Custom alias name input (when alias mode)
- Result displays with copy button (not auto-copy)
- Scrollable history list with click-to-copy
- Swarm toggle with consent dialog on first enable
- Swarm status indicator (peer count, green dot)

### 6. Keyboard shortcut
**Status:** missing (declared in manifest)
**What:** Ctrl+Shift+S / Cmd+Shift+S opens the popup with current URL pre-filled.

### 7. Cross-browser build
**Status:** missing
**What:** Build step or script that produces Chrome (MV3 with offscreen API) and Firefox/Zen (MV2 background page with iframe, or MV3 if supported) variants from a single codebase.

## Grouping by Concern

**A. Site-side postMessage API** (change 1) — prerequisite for everything else
**B. Extension scaffold** (changes 2, 6) — manifest, permissions, shortcut declaration
**C. Service worker + offscreen document** (changes 3, 4) — the message routing backbone
**D. Popup UI** (change 5) — user-facing interface
**E. Cross-browser build** (change 7) — Firefox/Zen variant
