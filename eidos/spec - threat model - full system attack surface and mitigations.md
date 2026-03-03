---
tldr: Threat model covering all attack surfaces — compression, Nostr aliases, P2P swarming, key management, and the browser extension
---

# Threat Model

Full-system threat model for short.string.md.
Trust assumption: **Nostr relays are untrusted** — they can lie, drop events, serve stale data, or log all traffic.
Peers in the P2P swarm are untrusted.
The only trusted component is the user's own browser and locally-held keys.

## Target

Enumerate attack surfaces, model threats using STRIDE categories, and define mitigations.
Companion Tamarin model formally verifies the Nostr alias protocol's cryptographic properties.

## Behaviour

### 1. Compression Mode Threats

#### T1.1 — Malicious Decompression Target
- Attacker crafts a `#c/` payload that decompresses to a `javascript:`, `data:`, or `blob:` URI
- **Impact:** XSS execution in the user's browser when visiting the link
- **Mitigation:** After decompression, validate the result is `http:` or `https:` only — reject all other schemes
- **Status:** MITIGATED — `decompressURL()` validates scheme via `new URL()` and rejects non-http/https

#### T1.2 — Domain Dictionary Confusion
- Attacker relies on domain code ambiguity (e.g. a future code collision) to redirect to an unintended host
- **Impact:** Phishing via a URL that appears to point to a known domain but resolves elsewhere
- **Mitigation:** Domain dictionary is static and bidirectional — `CODE_TO_DOMAIN` is derived from `DOMAIN_TO_CODE`, collisions are impossible if the dictionary is injective (each code maps to exactly one domain)
- **Status:** Safe by construction — verify injectivity at build time

#### T1.3 — LZ-String Decompression Bomb
- Payload that decompresses to an extremely large string, causing memory exhaustion
- **Impact:** DoS of the user's browser tab
- **Mitigation:** Cap decompressed output length (e.g. 8KB — no legitimate URL exceeds this)
- **Status:** MITIGATED — `decompressURL()` rejects output > 8192 chars

### 2. Nostr Alias Threats

#### T2.1 — Alias Squatting
- Attacker publishes NIP-78 events with popular alias names before legitimate users
- **Impact:** Names are taken; users get "alias already taken" errors
- **Mitigation:** Purely social — no technical fix beyond first-come-first-served
- **Friction:** This is inherent to any decentralised naming system without proof-of-work or payment

#### T2.2 — Alias Poisoning (Relay Lying)
- An untrusted relay returns a forged event mapping an alias to a malicious URL
- **Impact:** User is redirected to an attacker-controlled site
- **Mitigation:** Verify event signature against the pubkey that originally created the alias.
  Query multiple relays and require consensus (e.g. 2-of-3 agreement).
  Cache the first valid mapping and reject conflicting ones.
- **Status:** MITIGATED — `queryRelays()` calls `verifyEvent()` on received events in both site and extension

#### T2.3 — Replay Attack
- Attacker replays an old, legitimate event with a different alias-to-URL mapping after the original author updated it
- **Impact:** User sees stale data — the old URL instead of the updated one
- **Mitigation:** NIP-78 replaceable events use the `d` tag — relays should return the latest event by `created_at`.
  Client should verify `created_at` ordering when multiple responses arrive.
- **Status:** Partially mitigated — relays enforce replaceability, but client doesn't verify timestamps

#### T2.4 — Key Theft (localStorage / storage.local)
- Attacker with XSS on `short.string.md` reads the secret key from `localStorage`
- In the extension: a compromised extension or malicious extension with `storage` permission reads keys from `storage.local`
- **Impact:** Full impersonation — attacker can overwrite all aliases created by that key
- **Mitigation:**
  - Site: CSP headers, no inline scripts, subresource integrity
  - Extension: minimal permissions, no `<all_urls>`, keys stored in `storage.local` (not accessible to web pages)
  - Future: encrypt the secret key at rest with a user-provided passphrase
- **Status:** Keys are stored in plaintext

#### T2.5 — Event Forgery
- Attacker creates a NIP-78 event with a forged `pubkey` field
- **Impact:** Alias appears to be owned by someone else
- **Mitigation:** Schnorr signature verification — `finalizeEvent` signs with the real secret key, and the pubkey is derived from it.
  Relays that validate signatures will reject forged events.
  Clients must also verify signatures on received events.
- **Status:** MITIGATED — event creation uses nostr-tools signing; received events verified via `verifyEvent()`

### 3. P2P Swarming Threats (WebRTC)

#### T3.1 — Poisoned Alias Response
- A malicious peer responds to an alias query with a fake URL
- **Impact:** User redirected to attacker site
- **Mitigation:** Same as T2.2 — verify Nostr event signatures on P2P responses, not just the URL string.
  Peers should relay signed events, not bare URL strings.
- **Status:** P2P responses are trusted without verification

#### T3.2 — Sybil Attack
- Attacker floods the swarm with many peers to dominate alias resolution
- **Impact:** Attacker controls what most queries return
- **Mitigation:** Rate-limit responses per peer.
  Require signed events (Sybil nodes can't forge valid signatures for aliases they don't own).
  Weight relay responses over peer responses.
- **Status:** No Sybil protection

#### T3.3 — Eclipse Attack
- Attacker isolates a user by surrounding them with malicious peers, cutting off honest peers
- **Impact:** User only sees attacker-controlled responses
- **Mitigation:** Always query Nostr relays in parallel with P2P — don't rely solely on swarm.
  Trystero's room-based topology makes full eclipse difficult but not impossible.
- **Status:** Current resolution waterfall queries cache → P2P → relays, so relays provide a fallback

#### T3.4 — STUN/TURN Metadata Leakage
- WebRTC's STUN/TURN reveals the user's IP address to peers and STUN servers
- **Impact:** Privacy — peers can fingerprint users by IP even without account identity
- **Mitigation:** Document this clearly in the swarming consent dialog.
  Consider offering a "relay-only mode" that avoids direct peer connections.
- **Status:** Consent dialog exists but doesn't mention IP exposure

#### T3.5 — Peer Fingerprinting
- Repeated connections allow peers to build a profile of which aliases a user queries
- **Impact:** Privacy — query patterns reveal browsing behaviour
- **Mitigation:** Ephemeral peer IDs per session.
  Don't broadcast queries to all peers — use targeted lookups.
- **Status:** No mitigation

#### T3.6 — NAT Traversal Abuse
- Malicious peer exploits STUN/TURN to probe the user's internal network
- **Impact:** Information disclosure about local network topology
- **Mitigation:** Standard WebRTC security model handles this — STUN only reveals the public IP, and TURN relays traffic rather than exposing internals.
  Trystero uses standard WebRTC, so this is mitigated by the browser's implementation.
- **Status:** Mitigated by browser

### 4. Extension Threats

#### T4.1 — Bundled Dependency Compromise
- `nostr-tools.bundle.js` (232KB) is vendored — if the upstream is compromised and the bundle is updated without review, malicious code executes in the extension context
- **Impact:** Full extension compromise — key theft, data exfiltration
- **Mitigation:** Pin the exact version.
  Generate and verify a SHA-256 hash of the vendored bundle.
  Review diffs on any update.
- **Status:** Version is pinned (v2 from unpkg), but no hash verification

#### T4.2 — Extension Permission Escalation
- If the manifest requests overly broad permissions, a compromised extension can access all tabs, cookies, etc.
- **Impact:** Full browser compromise
- **Mitigation:** Current permissions are minimal: `storage`, `contextMenus`, `activeTab`, `clipboardWrite` — none grant broad access
- **Status:** Safe — permissions are appropriately scoped

#### T4.3 — Storage Injection via Context Menu
- Attacker constructs a page with a link whose `href` contains payloads that exploit the context menu shortening flow
- **Impact:** XSS or storage corruption if the URL is stored/displayed without sanitisation
- **Mitigation:** URLs are passed through `compressURL` which uses `new URL()` for parsing — invalid URLs are rejected.
  Display in popup uses `textContent`, not `innerHTML`.
- **Status:** Mitigated

### 5. Site Infrastructure Threats

#### T5.1 — GitHub Pages Compromise
- If the GitHub account or repo is compromised, the attacker can modify `index.html`
- **Impact:** All users of the web app execute attacker-controlled code.
  Secret keys in localStorage are exfiltrated.
- **Mitigation:** 2FA on GitHub, branch protection rules, signed commits.
  Consider SRI hashes for CDN dependencies (lz-string).
- **Status:** No branch protection or signed commits currently

#### T5.2 — CDN Dependency Hijacking
- `lz-string` is loaded from `cdn.jsdelivr.net` — if jsdelivr is compromised, arbitrary JS executes
- **Impact:** Same as T5.1
- **Mitigation:** Add Subresource Integrity (SRI) hash to the `<script>` tag.
  The extension already bundles lz-string locally, so only the web app is affected.
- **Status:** MITIGATED — SRI hash (sha384) added to lz-string script tag

## Design

### STRIDE Classification

| ID | Threat | S | T | R | I | D | E |
|----|--------|---|---|---|---|---|---|
| T1.1 | Malicious decompression | | | | | | x |
| T1.2 | Dictionary confusion | x | | | | | |
| T1.3 | Decompression bomb | | | | | x | |
| T2.1 | Alias squatting | | | | | x | |
| T2.2 | Alias poisoning | x | x | | | | |
| T2.3 | Replay attack | | x | | | | |
| T2.4 | Key theft | | | | x | | x |
| T2.5 | Event forgery | x | | x | | | |
| T3.1 | Poisoned P2P response | x | x | | | | |
| T3.2 | Sybil attack | | | | | x | |
| T3.3 | Eclipse attack | | | | | x | |
| T3.4 | STUN/TURN IP leak | | | | x | | |
| T3.5 | Peer fingerprinting | | | | x | | |
| T3.6 | NAT traversal abuse | | | | x | | |
| T4.1 | Dependency compromise | x | x | | | | x |
| T4.2 | Permission escalation | | | | | | x |
| T4.3 | Storage injection | x | | | | | |
| T5.1 | GitHub Pages compromise | x | x | | | | x |
| T5.2 | CDN hijacking | x | x | | | | x |

Legend: **S**poofing, **T**ampering, **R**epudiation, **I**nformation disclosure, **D**enial of service, **E**levation of privilege

### Trust Boundaries

```
┌─────────────────────────────────────────────────┐
│  TRUSTED: User's Browser                        │
│  ┌─────────────┐  ┌──────────────────────────┐  │
│  │ Web App      │  │ Extension                 │  │
│  │ (index.html) │  │ (background + popup)      │  │
│  │              │  │                           │  │
│  │ Secret key   │  │ Secret key (storage.local)│  │
│  │ (localStorage│  │ LZ-String (bundled)       │  │
│  │  )           │  │ nostr-tools (bundled)     │  │
│  └──────┬───────┘  └─────────┬─────────────────┘  │
│         │                    │                    │
├─────────┼────────────────────┼────────────────────┤
│  UNTRUSTED                   │                    │
│         │                    │                    │
│  ┌──────▼───────┐  ┌────────▼────────┐           │
│  │ CDN           │  │ Nostr Relays     │           │
│  │ (jsdelivr)    │  │ (damus, nos.lol, │           │
│  │               │  │  nostr.band)     │           │
│  └───────────────┘  └────────┬────────┘           │
│                              │                    │
│                    ┌─────────▼────────┐           │
│                    │ P2P Peers         │           │
│                    │ (WebRTC/Trystero) │           │
│                    └──────────────────┘           │
└─────────────────────────────────────────────────┘
```

### Priority Mitigations (ordered by impact)

1. **T1.1 — URL scheme validation** after decompression (blocks XSS via crafted links)
2. **T2.2 / T2.5 — Signature verification** on received Nostr events (blocks alias poisoning)
3. **T5.2 — SRI hashes** on CDN script tags (blocks dependency hijacking on the web app)
4. **T1.3 — Decompression length cap** (blocks DoS)
5. **T2.4 — Key encryption at rest** (limits key theft impact)
6. **T3.1 — Signed events over P2P** (blocks poisoned peer responses)
7. **T3.4 — Consent dialog IP disclosure** (informed consent for privacy)

## Verification

- Tamarin model in `eidos/models/short-string-md.spthy` proves:
  - Alias ownership: only the key holder can publish/update an alias
  - No forgery: a valid event requires the correct secret key
  - Freshness: replayed events don't override newer ones (when client checks `created_at`)
- Manual verification of each mitigation against its threat
- Code audit against the Mapping entries for each "NOT currently implemented" status

## Friction

- Full signature verification on every received event adds latency to alias resolution
- Untrusted relay model means we can never fully trust a single relay response — multi-relay consensus is slower
- Encrypting keys at rest requires a passphrase UX that doesn't exist yet
- The P2P threat surface is largely theoretical while swarming adoption is low

## Interactions

- Depends on [[spec - browser extension - thin wrapper with optional swarming]]
- Affects all code in `index.html` and `extension/` — mitigations require code changes
- Tamarin model validates the Nostr protocol assumptions independently of implementation

## Mapping

> [[index.html]] — web app: decompression, Nostr relay communication, key management, CDN dependencies
> [[extension/shorten.js]] — extension: compression, relay communication, key management
> [[extension/background.js]] — extension: message routing, context menu
> [[extension/manifest.json]] — extension: permissions, CSP
> [[eidos/models/short-string-md.spthy]] — Tamarin protocol model

## Future

{[x] Implement URL scheme validation after decompression (T1.1)}
{[x] Add Nostr event signature verification on received events (T2.2, T2.5)}
{[x] Add SRI hash to CDN script tag in index.html (T5.2)}
{[x] Cap decompressed output length (T1.3)}
{[?] Encrypt secret keys at rest with user passphrase (T2.4)}
{[?] Require signed Nostr events in P2P responses (T3.1)}
{[?] Update consent dialog to mention IP exposure via WebRTC (T3.4)}
{[?] Dependency hash verification for vendored bundles (T4.1)}
