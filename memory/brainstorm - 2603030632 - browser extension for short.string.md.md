---
tldr: Brainstorm a Chrome/Zen browser extension for short.string.md — one-click URL generation and optional P2P swarming
status: active
---

# Brainstorm: Browser Extension for short.string.md

## Seed

short.string.md is a serverless URL shortener built as a single HTML page. It uses two shortening mechanisms:
- **Compressed URLs** (`#c/<compressed>`) — self-contained, offline-capable, uses LZ-String + domain dictionary
- **Nostr aliases** (`#n/<alias>`) — short memorable names published to Nostr relays as replaceable events

Resolution uses a 4-layer waterfall: localStorage → P2P peers (Trystero WebRTC) → Nostr relays → fallback error.

The extension should:
1. Make URL shortening frictionless — one click from any page
2. Optionally participate in the P2P swarm — contributing to alias resolution without having the site open
3. Work with Chrome and Zen Browser (Firefox-based)

Open questions for the user:
- How deep should swarm participation go? Background service worker keeping connections alive?
- Should the extension manage its own Nostr keypair or share with the site's localStorage?
- Any string.md-specific integrations to consider?

## Ideas

- **Context menu "Shorten this URL"** — right-click any link or page → generate compressed or alias URL, copy to clipboard
- **Toolbar popup** — click extension icon → shows current page URL, one-click shorten, choose compressed vs alias
- **Omnibox integration** — type `s ` in address bar → paste URL → get shortened version
- **Background swarm worker** — service worker maintains Trystero P2P connections, answers alias resolution queries from other peers
- **Swarm toggle** — user can enable/disable swarming from popup; green dot when active
- **Alias cache sync** — extension's localStorage acts as another cache layer in the resolution waterfall
- **QR code generation** — after shortening, option to generate/display QR code
- **Batch shorten** — select multiple links on a page, shorten all at once
- **Auto-shorten on copy** — detect URL copy events, offer to replace with shortened version
- **History/dashboard** — show all URLs you've shortened, with click-to-copy
- **Nostr keypair management** — extension manages its own keypair, or imports from the site
- **Cross-browser manifest** — use WebExtension API (manifest v3 for Chrome, v2/v3 for Zen/Firefox)
- **Keyboard shortcut** — e.g. Ctrl+Shift+S to shorten current page URL instantly
- **Link preview on hover** — when hovering a short.string.md link, show the resolved destination
- **Content script injection** — on short.string.md page, enhance the UI or sync state with extension
- **Relay health indicator** — show which Nostr relays are reachable, swarm peer count
- **Share menu integration** — on mobile/desktop, appear in the OS share menu
- **Offline compression only mode** — when no network, fall back to compressed URLs only
- **Custom alias UI** — set your own alias name right from the popup
- **String.md integration** — detect when viewing string.md content, offer one-click shortening of the full doc URL
- **Notification on resolution** — when your swarmed cache helps resolve someone's alias, show a subtle notification
- **Badge counter** — show number of swarm peers connected on the extension icon
- **URL stats** — lightweight local-only tracking of how many times you've used/shared each alias
- **Import/export** — backup your aliases and keypair
- **Companion mode** — extension as a thin wrapper that opens the short.string.md page in a popup window, minimal code
- **Consent-first swarming** — explicit opt-in prompt before enabling background P2P, clear explanation of what it does, easy off-switch
- **Site code reuse via iframe/offscreen doc** — load short.string.md in an offscreen document or iframe, message-pass to it rather than bundling compression/Nostr code
- **Offscreen document for swarm** — Chrome's Offscreen API lets a service worker spin up an invisible page that can hold WebRTC connections

## Clusters

### One-Click Shortening (core UX)
The primary value — make it trivially easy to shorten any URL from the browser.
- Context menu "Shorten this URL"
- Toolbar popup with one-click shorten
- Keyboard shortcut (Ctrl+Shift+S)
- Omnibox integration (`s ` prefix)
- Custom alias UI in popup
- Auto-shorten on copy
- Offline compression only mode (fallback)

### Background Swarm Participation
The differentiator — extension users become always-on peers in the resolution network, even without a tab open.
- Background swarm worker (service worker + offscreen document)
- Consent-first swarming (explicit opt-in, clear explanation, easy off)
- Swarm toggle in popup with green dot indicator
- Badge counter showing connected peers
- Relay health indicator
- Alias cache sync (extension storage as resolution layer)
- Notification on resolution (your cache helped someone)

### Code Reuse & Architecture
Minimize duplication — the site already has all the logic.
- Site code reuse via offscreen document loading short.string.md
- Content script injection to sync state when on the site
- Cross-browser manifest (MV3 Chrome, MV2/3 Zen/Firefox)
- Companion mode (popup = mini site)

### History & Management
Track what you've created, manage your identity.
- History/dashboard of shortened URLs
- Nostr keypair management (generate or import)
- Import/export aliases and keypair
- URL stats (local-only usage tracking)

### Extras & Integrations
Nice-to-haves that expand reach.
- QR code generation
- Link preview on hover for short.string.md URLs
- Batch shorten (select multiple links)
- String.md integration (detect content docs)
- Share menu integration

## Standouts

1. **Context menu + toolbar popup + keyboard shortcut** — The table-stakes trio. Right-click to shorten a link, click the icon to shorten current page, keyboard shortcut for power users. Without this the extension has no reason to exist.

2. **Offscreen document reuse** — Instead of bundling LZ-String, nostr-tools, and Trystero separately, load the actual short.string.md page in a Chrome offscreen document (or hidden iframe for Firefox). Message-pass shorten/resolve requests to it. This means: zero code duplication, automatic feature parity as the site evolves, and the offscreen doc can also hold WebRTC swarm connections.

3. **Consent-first background swarming** — On first install or first toggle, explain clearly: "This keeps a background connection to help other users resolve short URLs. Uses minimal bandwidth. You can turn it off anytime." The offscreen document holds the Trystero connections. Badge counter shows peer count so the user sees it's alive.

4. **Alias cache in extension storage** — Every alias the user creates or resolves gets cached in `chrome.storage.local`. This cache participates in the resolution waterfall. Even without swarming enabled, the extension improves resolution speed for the user's own aliases.

## Next Steps

What to do with the standouts:
- Create a spec for the extension architecture (offscreen document approach, message-passing API, manifest structure)
- Decision file: MV3-only vs MV2+MV3 for Zen/Firefox compatibility
- Decision file: how the offscreen document communicates with the site code (postMessage protocol)
- Prototype: minimal popup + context menu + offscreen doc loading short.string.md
