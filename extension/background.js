// Background page — manages iframe bridge, context menu, message routing, badge
// Firefox/Zen: persistent background page with DOM access (no offscreen API needed)

const api = typeof browser !== 'undefined' ? browser : chrome;

// ── Iframe bridge (same logic as former offscreen.js) ──

const iframe = document.getElementById('site');
const SITE_ORIGIN = 'https://short.string.md';
let messageId = 0;
const pending = {};

let iframeReady = false;
const readyPromise = new Promise((resolve) => {
  iframe.addEventListener('load', () => {
    iframeReady = true;
    resolve();
  });
  setTimeout(() => {
    if (!iframeReady) resolve();
  }, 10000);
});

window.addEventListener('message', (event) => {
  if (event.source !== iframe.contentWindow) return;
  const data = event.data;
  if (!data || !data._extReply) return;

  const id = data._id;
  if (id != null && pending[id]) {
    pending[id](data);
    delete pending[id];
  }
});

async function sendToSite(msg) {
  await readyPromise;

  if (!iframeReady) {
    return { error: 'Site iframe failed to load' };
  }

  const id = ++messageId;
  const timeout = msg.type === 'shorten' && msg.mode === 'alias' ? 15000 : 8000;

  const promise = new Promise((resolve) => {
    pending[id] = resolve;
    setTimeout(() => {
      if (pending[id]) {
        delete pending[id];
        resolve({ error: 'Timeout waiting for site response' });
      }
    }, timeout);
  });

  iframe.contentWindow.postMessage(
    { ...msg, _ext: true, _id: id },
    SITE_ORIGIN
  );

  return promise;
}

// ── Context menu ──

api.runtime.onInstalled.addListener(() => {
  api.contextMenus.create({
    id: 'shorten-link',
    title: 'Shorten with short.string.md',
    contexts: ['link', 'page'],
  });
});

api.contextMenus.onClicked.addListener(async (info, tab) => {
  if (info.menuItemId !== 'shorten-link') return;

  const url = info.linkUrl || info.pageUrl;
  if (!url) return;

  const result = await sendToSite({ type: 'shorten', url, mode: 'compress' });

  // Store result for popup to pick up
  await api.storage.local.set({
    pendingResult: {
      url,
      result: result.result || null,
      error: result.error || null,
      mode: 'compress',
      created: Date.now(),
    },
  });
});

// ── Message routing (popup → site iframe) ──

api.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (!msg || !msg._fromPopup) return;

  (async () => {
    const result = await sendToSite({
      type: msg.type,
      url: msg.url,
      mode: msg.mode,
      alias: msg.alias,
      hash: msg.hash,
    });

    // Save to history if successful shorten
    if (msg.type === 'shorten' && result.result && !result.error) {
      const data = await api.storage.local.get('history');
      const history = data.history || [];
      history.unshift({
        url: msg.url,
        short: result.result,
        mode: msg.mode || 'compress',
        created: Date.now(),
      });
      if (history.length > 500) history.length = 500;
      await api.storage.local.set({ history });
    }

    sendResponse(result);
  })();

  return true;
});

// ── Badge updates ──

async function updateBadge() {
  const data = await api.storage.local.get('swarm_enabled');
  const swarmEnabled = data.swarm_enabled || false;

  if (!swarmEnabled) {
    api.browserAction.setBadgeText({ text: '' });
    return;
  }

  try {
    const status = await sendToSite({ type: 'swarm-status' });
    if (status && typeof status.peers === 'number') {
      api.browserAction.setBadgeText({ text: status.peers > 0 ? String(status.peers) : '' });
      api.browserAction.setBadgeBackgroundColor({ color: status.peers > 0 ? '#3fb950' : '#8b949e' });
    }
  } catch {
    api.browserAction.setBadgeText({ text: '' });
  }
}

setInterval(updateBadge, 30000);

api.storage.onChanged.addListener((changes) => {
  if (changes.swarm_enabled) updateBadge();
});
