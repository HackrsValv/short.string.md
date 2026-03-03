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
