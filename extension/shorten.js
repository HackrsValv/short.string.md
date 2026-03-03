// Shortening logic — bundled from index.html, no iframe needed
// Depends on: lib/lz-string.min.js (loaded before this script)

const SITE_ORIGIN = 'https://short.string.md';

const DOMAIN_TO_CODE = {
  'google.com':         'G',
  'youtube.com':        'Y',
  'github.com':         'GH',
  'reddit.com':         'R',
  'twitter.com':        'TW',
  'x.com':              'X',
  'wikipedia.org':      'W',
  'en.wikipedia.org':   'WE',
  'amazon.com':         'AZ',
  'stackoverflow.com':  'SO',
  'linkedin.com':       'LI',
  'facebook.com':       'FB',
  'instagram.com':      'IG',
  'tiktok.com':         'TK',
  'twitch.tv':          'TV',
  'discord.com':        'DC',
  'discord.gg':         'DG',
  'notion.so':          'NO',
  'docs.google.com':    'GD',
  'drive.google.com':   'GR',
  'mail.google.com':    'GM',
  'maps.google.com':    'GP',
  'figma.com':          'FG',
  'medium.com':         'MD',
  'npmjs.com':          'NP',
  'string.md':          'SM',
  'short.string.md':    'SS',
};

function compressURL(url) {
  let parsed;
  try { parsed = new URL(url); } catch { return null; }

  const secure = parsed.protocol === 'https:';
  const prefix = secure ? 'S' : 'H';
  const host = parsed.hostname + (parsed.port ? ':' + parsed.port : '');

  let domainPart = null;
  const sortedDomains = Object.keys(DOMAIN_TO_CODE).sort((a, b) => b.length - a.length);
  for (const domain of sortedDomains) {
    if (host === domain || host === 'www.' + domain) {
      domainPart = DOMAIN_TO_CODE[domain];
      break;
    }
  }
  if (!domainPart) domainPart = host;

  const rest = parsed.pathname + parsed.search + parsed.hash;
  const raw = prefix + domainPart + '\t' + rest;
  return LZString.compressToEncodedURIComponent(raw);
}

// ── Nostr constants ──

const NOSTR_RELAYS = ['wss://relay.damus.io', 'wss://nos.lol', 'wss://relay.nostr.band'];
const NOSTR_KIND = 30078;
const APP_TAG = 'short.string.md';
const STORAGE_KEY_SK = 'short_stringmd_sk';

// ── Key management (using extension storage.local instead of localStorage) ──

const _api = typeof browser !== 'undefined' ? browser : chrome;
const { generateSecretKey, getPublicKey, finalizeEvent } = NostrTools;

async function getOrCreateSecretKey() {
  const data = await _api.storage.local.get(STORAGE_KEY_SK);
  if (data[STORAGE_KEY_SK]) {
    return new Uint8Array(data[STORAGE_KEY_SK]);
  }
  const sk = generateSecretKey();
  await _api.storage.local.set({ [STORAGE_KEY_SK]: Array.from(sk) });
  return sk;
}

// ── Relay communication ──

function connectRelay(url) {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(url);
    const timer = setTimeout(() => {
      ws.close();
      reject(new Error('Timeout connecting to ' + url));
    }, 5000);
    ws.addEventListener('open', () => {
      clearTimeout(timer);
      resolve(ws);
    });
    ws.addEventListener('error', () => {
      clearTimeout(timer);
      reject(new Error('Error connecting to ' + url));
    });
  });
}

function queryRelays(alias) {
  return new Promise((resolve) => {
    let resolved = false;
    const sockets = [];

    const timer = setTimeout(() => {
      if (!resolved) {
        resolved = true;
        sockets.forEach(ws => { try { ws.close(); } catch {} });
        resolve(null);
      }
    }, 6000);

    const filter = {
      kinds: [NOSTR_KIND],
      '#d': [alias],
      '#t': [APP_TAG],
      limit: 1,
    };

    let pending = NOSTR_RELAYS.length;

    for (const url of NOSTR_RELAYS) {
      connectRelay(url).then(ws => {
        sockets.push(ws);
        const subId = 'q_' + Math.random().toString(36).slice(2, 8);
        ws.send(JSON.stringify(['REQ', subId, filter]));
        ws.addEventListener('message', (msg) => {
          try {
            const data = JSON.parse(msg.data);
            if (data[0] === 'EVENT' && data[2] && data[2].content && !resolved) {
              resolved = true;
              clearTimeout(timer);
              sockets.forEach(s => { try { s.close(); } catch {} });
              resolve(data[2].content);
            }
            if (data[0] === 'EOSE') {
              pending--;
              if (pending <= 0 && !resolved) {
                resolved = true;
                clearTimeout(timer);
                sockets.forEach(s => { try { s.close(); } catch {} });
                resolve(null);
              }
            }
          } catch { /* ignore */ }
        });
      }).catch(() => {
        pending--;
        if (pending <= 0 && !resolved) {
          resolved = true;
          clearTimeout(timer);
          sockets.forEach(s => { try { s.close(); } catch {} });
          resolve(null);
        }
      });
    }
  });
}

function publishToRelays(event) {
  return new Promise(async (resolve, reject) => {
    let successes = 0;
    let finished = 0;
    const total = NOSTR_RELAYS.length;

    for (const url of NOSTR_RELAYS) {
      try {
        const ws = await connectRelay(url);
        ws.send(JSON.stringify(['EVENT', event]));
        ws.addEventListener('message', (msg) => {
          try {
            const data = JSON.parse(msg.data);
            if (data[0] === 'OK' && data[2] === true) successes++;
          } catch { /* ignore */ }
          finished++;
          if (finished === total) {
            ws.close();
            successes > 0 ? resolve(successes) : reject(new Error('No relay accepted the event'));
          }
        });
        setTimeout(() => { try { ws.close(); } catch {} }, 5000);
      } catch {
        finished++;
        if (finished === total) {
          successes > 0 ? resolve(successes) : reject(new Error('No relay accepted the event'));
        }
      }
    }
  });
}

async function createNostrAlias(alias, targetURL) {
  const sk = await getOrCreateSecretKey();
  const event = finalizeEvent({
    kind: NOSTR_KIND,
    created_at: Math.floor(Date.now() / 1000),
    tags: [
      ['d', alias],
      ['t', APP_TAG],
    ],
    content: targetURL,
  }, sk);

  return publishToRelays(event);
}

function genShortCode() {
  const bytes = crypto.getRandomValues(new Uint8Array(4));
  let num = 0;
  for (const b of bytes) num = num * 256 + b;
  return num.toString(36).slice(0, 6);
}

// ── Main entry point for background.js ──

async function shortenURL(url, mode, alias) {
  if (mode === 'alias') {
    const name = alias || genShortCode();
    const existing = await queryRelays(name);
    if (existing) {
      return { error: 'Alias "' + name + '" is already taken.' };
    }
    const count = await createNostrAlias(name, url);
    return { result: SITE_ORIGIN + '/#n/' + name, alias: name, relays: count };
  }

  const compressed = compressURL(url);
  if (!compressed) {
    return { error: 'Could not compress URL' };
  }
  return { result: SITE_ORIGIN + '/#c/' + compressed };
}
