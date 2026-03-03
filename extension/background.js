// Service worker — routes messages, manages offscreen document, context menu

const OFFSCREEN_URL = 'offscreen.html';

// ── Offscreen document lifecycle ──

let creatingOffscreen = null;

async function ensureOffscreen() {
  const contexts = await chrome.runtime.getContexts({
    contextTypes: ['OFFSCREEN_DOCUMENT'],
  });
  if (contexts.length > 0) return;

  if (creatingOffscreen) {
    await creatingOffscreen;
    return;
  }

  creatingOffscreen = chrome.offscreen.createDocument({
    url: OFFSCREEN_URL,
    reasons: ['IFRAME_SCRIPTING'],
    justification: 'Load short.string.md for URL shortening and P2P swarming',
  });

  await creatingOffscreen;
  creatingOffscreen = null;
}

// ── Context menu ──

chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({
    id: 'shorten-link',
    title: 'Shorten with short.string.md',
    contexts: ['link', 'page'],
  });
});

chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  if (info.menuItemId !== 'shorten-link') return;

  const url = info.linkUrl || info.pageUrl;
  if (!url) return;

  await ensureOffscreen();
  const result = await chrome.runtime.sendMessage({
    type: 'shorten',
    url,
    mode: 'compress',
  });

  // Store result and open popup can't be done directly from context menu,
  // so store in session storage for the popup to pick up
  await chrome.storage.session.set({
    pendingResult: {
      url,
      result: result.result || null,
      error: result.error || null,
      mode: 'compress',
      created: Date.now(),
    },
  });

  // Open the popup by triggering the action
  // Note: chrome.action.openPopup() requires user gesture, so we store the result
  // and it will show next time the popup opens
});

// ── Message routing (popup → offscreen) ──

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (!msg || !msg._fromPopup) return;

  (async () => {
    await ensureOffscreen();

    // Forward to offscreen document
    const result = await chrome.runtime.sendMessage({
      type: msg.type,
      url: msg.url,
      mode: msg.mode,
      alias: msg.alias,
      hash: msg.hash,
    });

    // Save to history if successful shorten
    if (msg.type === 'shorten' && result.result && !result.error) {
      const { history = [] } = await chrome.storage.local.get('history');
      history.unshift({
        url: msg.url,
        short: result.result,
        mode: msg.mode || 'compress',
        created: Date.now(),
      });
      // Cap at 500 entries
      if (history.length > 500) history.length = 500;
      await chrome.storage.local.set({ history });
    }

    sendResponse(result);
  })();

  return true;
});

// ── Badge updates ──

async function updateBadge() {
  const { swarm_enabled = false } = await chrome.storage.local.get('swarm_enabled');
  if (!swarm_enabled) {
    chrome.action.setBadgeText({ text: '' });
    return;
  }

  try {
    await ensureOffscreen();
    const status = await chrome.runtime.sendMessage({ type: 'swarm-status' });
    if (status && typeof status.peers === 'number') {
      chrome.action.setBadgeText({ text: status.peers > 0 ? String(status.peers) : '' });
      chrome.action.setBadgeBackgroundColor({ color: status.peers > 0 ? '#3fb950' : '#8b949e' });
    }
  } catch {
    chrome.action.setBadgeText({ text: '' });
  }
}

// Poll badge every 30s when swarming is enabled
setInterval(updateBadge, 30000);

// Update badge when swarm setting changes
chrome.storage.onChanged.addListener((changes) => {
  if (changes.swarm_enabled) updateBadge();
});
