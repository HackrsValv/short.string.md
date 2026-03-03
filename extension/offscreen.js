// Offscreen document — bridges chrome.runtime messages ↔ iframe postMessage

const iframe = document.getElementById('site');
const SITE_ORIGIN = 'https://short.string.md';
let messageId = 0;
const pending = {};

// Wait for iframe to load
let iframeReady = false;
const readyPromise = new Promise((resolve) => {
  iframe.addEventListener('load', () => {
    iframeReady = true;
    resolve();
  });
  // Timeout fallback
  setTimeout(() => {
    if (!iframeReady) resolve();
  }, 10000);
});

// Listen for replies from the iframe
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

// Forward chrome.runtime messages to the iframe
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (!msg || !msg.type) return;

  (async () => {
    await readyPromise;

    if (!iframeReady) {
      sendResponse({ error: 'Site iframe failed to load' });
      return;
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

    const result = await promise;
    sendResponse(result);
  })();

  return true; // async response
});
