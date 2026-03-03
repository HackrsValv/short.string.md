// Background page — context menu, message routing, badge
// All shortening logic is in shorten.js (loaded before this script)

const api = typeof browser !== 'undefined' ? browser : chrome;

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

  const result = await shortenURL(url, 'compress');

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

// ── Message routing (popup → shortenURL) ──

api.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (!msg || !msg._fromPopup) return;

  if (msg.type === 'swarm-status') {
    sendResponse({ peers: 0 });
    return;
  }

  (async () => {
    try {
      const result = await shortenURL(msg.url, msg.mode, msg.alias);

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
    } catch (err) {
      sendResponse({ error: err.message || 'Unknown error' });
    }
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

  // Swarming is a future feature — for now just show the toggle state
  api.browserAction.setBadgeText({ text: 'P2P' });
  api.browserAction.setBadgeBackgroundColor({ color: '#3fb950' });
}

api.storage.onChanged.addListener((changes) => {
  if (changes.swarm_enabled) updateBadge();
});
