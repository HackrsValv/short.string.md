---
tldr: Browser extension that wraps short.string.md for one-click URL shortening and optional P2P swarm participation
---

# Browser Extension

A Chrome and Zen/Firefox extension that makes short.string.md accessible from any page. Thin wrapper architecture — the site's own code runs in an offscreen document, the extension only provides browser integration chrome (popup, context menu, shortcuts) and message-passing.

## Target

Using short.string.md currently requires navigating to the site, pasting a URL, and copying the result. The extension removes that friction — shorten any URL with a right-click or toolbar click. Optionally, users who consent can participate in the P2P swarm in the background, strengthening alias resolution for the whole network even without a tab open.

## Behaviour

### Shortening
- Right-click any link or page → "Shorten with short.string.md" context menu item → result appears in popup
- Click extension icon → popup shows current page URL pre-filled → one-click shorten
- Keyboard shortcut (default: Ctrl+Shift+S / Cmd+Shift+S) → opens popup with current URL pre-filled
- User chooses compressed URL or Nostr alias (with custom alias name input)
- Result displays in popup with copy button — not auto-copied
- Each shortened URL is cached in `chrome.storage.local` for history

### Resolution
- When the user visits a `short.string.md/#n/` or `#c/` URL, the extension can pre-resolve from its local cache before the page loads
- Extension storage participates as an additional layer in the resolution waterfall

### Swarming
- Off by default — requires explicit user opt-in
- First-time toggle shows explanation: what swarming does, that it uses minimal bandwidth, how to turn it off
- When enabled, the offscreen document maintains Trystero P2P connections in the background
- Extension badge shows connected peer count when swarming is active
- Green dot or badge colour indicates swarm status (active/inactive)
- User can toggle swarming on/off from the popup at any time

### History
- All created and resolved URLs are stored locally in `chrome.storage.local`
- Popup has a scrollable history list with click-to-copy on each entry
- No data leaves the browser unless swarming is enabled

## Design

### Architecture: Thin Wrapper

```
┌─────────────────────────────────────────┐
│  Popup / Context Menu / Shortcuts       │
│  (extension UI — no shortening logic)   │
└──────────────┬──────────────────────────┘
               │ chrome.runtime messages
┌──────────────▼──────────────────────────┐
│  Service Worker                          │
│  (routes messages, manages state)        │
└──────────────┬──────────────────────────┘
               │ postMessage
┌──────────────▼──────────────────────────┐
│  Offscreen Document                      │
│  (loads short.string.md in iframe)       │
│  — LZ-String compression                │
│  — Nostr relay communication             │
│  — Trystero P2P swarm connections        │
└─────────────────────────────────────────┘
```

- The offscreen document loads the real `short.string.md` page
- All shortening, resolution, and P2P logic stays in the site's code
- The extension communicates via a defined postMessage protocol
- The site needs a small addition: a message listener that accepts shorten/resolve requests and returns results

### Message Protocol

Messages from extension to offscreen iframe:
- `{ type: "shorten", url: "...", mode: "compress" | "alias", alias?: "..." }` → returns `{ type: "shortened", result: "..." }`
- `{ type: "resolve", hash: "..." }` → returns `{ type: "resolved", url: "..." }`
- `{ type: "swarm-status" }` → returns `{ type: "swarm-status", peers: number, connected: boolean }`

### Cross-Browser Compatibility

- WebExtension API with manifest v3
- Chrome: uses `chrome.offscreen` API for the offscreen document
- Firefox/Zen: uses a hidden background page or iframe (offscreen API not available, fall back to background script with DOM access in MV2, or `browser.offscreen` if available)
- Use `webextension-polyfill` or feature detection for API differences
- Single codebase, build step produces Chrome and Firefox variants

### Storage Schema

```
chrome.storage.local = {
  "history": [
    { url: "...", short: "...", mode: "compress"|"alias", created: timestamp },
    ...
  ],
  "swarm_enabled": false,
  "swarm_consent_shown": false,
  "alias_cache": { "alias-name": "resolved-url", ... }
}
```

## Verification

- Install extension, right-click a link → context menu appears → shortening produces a valid short.string.md URL
- Click extension icon → popup shows current page URL → shorten → result displays → copy button works
- Navigate to a shortened URL → extension cache resolves it
- Enable swarming → badge shows peer count → disable → connections drop
- Test on Chrome and Zen/Firefox with same extension package
- Offscreen document loads short.string.md and responds to messages

## Friction

- The offscreen document approach requires the site to be reachable on first load (or cached by the service worker)
- Chrome's offscreen API has lifetime constraints — the document may be closed by the browser, requiring recreation
- Firefox doesn't have an offscreen API equivalent — needs a different approach (background page with iframe)
- The site needs modification to expose a postMessage API for the extension to call into

## Interactions

- Depends on short.string.md site code (the offscreen document loads it)
- Site needs a new postMessage listener to accept extension requests
- Extension's alias cache feeds back into the P2P resolution network when swarming is enabled

## Mapping

> [[index.html]] — site code loaded by the offscreen document

## Future

{[!] postMessage API added to index.html for extension communication}
{[?] omnibox integration — type `s ` prefix to shorten from address bar}
{[?] QR code generation from shortened URLs}
{[?] batch shortening — select multiple links on a page}
{[?] string.md content detection — offer shortening when viewing long string.md doc URLs}
{[?] import/export of history and keypair}
