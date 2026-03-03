// Popup script — UI logic, communicates with background page

const api = typeof browser !== 'undefined' ? browser : chrome;
const $ = (id) => document.getElementById(id);

const urlInput = $('url-input');
const shortenBtn = $('shorten-btn');
const modeCompress = $('mode-compress');
const modeAlias = $('mode-alias');
const aliasRow = $('alias-row');
const aliasInput = $('alias-input');
const resultEl = $('result');
const resultLabel = $('result-label');
const resultUrl = $('result-url');
const resultError = $('result-error');
const copyBtn = $('copy-btn');
const swarmToggle = $('swarm-toggle');
const swarmPeers = $('swarm-peers');
const swarmIndicator = $('swarm-indicator');
const historyList = $('history-list');
const consentOverlay = $('consent-overlay');
const consentCancel = $('consent-cancel');
const consentEnable = $('consent-enable');
const toast = $('toast');

let currentMode = 'compress';

// ── Toast ──

let toastTimer;
function showToast(msg) {
  toast.textContent = msg;
  toast.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.remove('show'), 2000);
}

// ── Mode toggle ──

modeCompress.addEventListener('click', () => {
  currentMode = 'compress';
  modeCompress.classList.add('selected');
  modeAlias.classList.remove('selected');
  aliasRow.classList.remove('visible');
});

modeAlias.addEventListener('click', () => {
  currentMode = 'alias';
  modeAlias.classList.add('selected');
  modeCompress.classList.remove('selected');
  aliasRow.classList.add('visible');
});

// ── URL input ──

urlInput.addEventListener('input', () => {
  shortenBtn.disabled = !urlInput.value.trim();
});

// Pre-fill from active tab
api.tabs.query({ active: true, currentWindow: true }, (tabs) => {
  if (tabs[0]?.url && !tabs[0].url.startsWith('chrome') && !tabs[0].url.startsWith('about:') && !tabs[0].url.startsWith('moz-extension')) {
    urlInput.value = tabs[0].url;
    shortenBtn.disabled = false;
  }
});

// Check for pending result from context menu
api.storage.local.get('pendingResult', (data) => {
  const pendingResult = data.pendingResult;
  if (pendingResult) {
    api.storage.local.remove('pendingResult');
    if (pendingResult.result) {
      showResult(pendingResult.result, pendingResult.mode);
      urlInput.value = pendingResult.url;
    } else if (pendingResult.error) {
      showError(pendingResult.error);
    }
  }
});

// ── Shorten ──

shortenBtn.addEventListener('click', async () => {
  let url = urlInput.value.trim();
  if (!url) return;

  if (!/^https?:\/\//i.test(url)) url = 'https://' + url;

  shortenBtn.disabled = true;
  shortenBtn.textContent = 'Shortening...';
  resultEl.classList.remove('visible');

  try {
    const response = await api.runtime.sendMessage({
      _fromPopup: true,
      type: 'shorten',
      url,
      mode: currentMode,
      alias: currentMode === 'alias' ? aliasInput.value.trim() || undefined : undefined,
    });

    if (response.error) {
      showError(response.error);
    } else if (response.result) {
      showResult(response.result, currentMode);
    }
  } catch (err) {
    showError(err.message || 'Failed to shorten');
  } finally {
    shortenBtn.disabled = false;
    shortenBtn.textContent = 'Shorten';
  }
});

function showResult(url, mode) {
  resultLabel.textContent = mode === 'alias' ? 'Alias' : 'Compressed';
  resultUrl.textContent = url;
  resultError.textContent = '';
  resultError.style.display = 'none';
  resultEl.classList.add('visible');
  loadHistory();
}

function showError(msg) {
  resultLabel.textContent = 'Error';
  resultUrl.textContent = '';
  resultError.textContent = msg;
  resultError.style.display = '';
  resultEl.classList.add('visible');
}

// ── Copy ──

copyBtn.addEventListener('click', () => {
  const text = resultUrl.textContent;
  if (!text) return;
  navigator.clipboard.writeText(text).then(() => showToast('Copied!'), () => showToast('Copy failed'));
});

resultUrl.addEventListener('click', () => {
  const text = resultUrl.textContent;
  if (text) navigator.clipboard.writeText(text).then(() => showToast('Copied!'), () => showToast('Copy failed'));
});

// ── Swarm toggle ──

async function loadSwarmState() {
  const { swarm_enabled = false } = await api.storage.local.get('swarm_enabled');
  swarmToggle.checked = swarm_enabled;
  updateSwarmUI(swarm_enabled);
}

function updateSwarmUI(enabled) {
  if (enabled) {
    swarmIndicator.textContent = 'swarm on';
    swarmIndicator.classList.add('active');
    api.runtime.sendMessage({ _fromPopup: true, type: 'swarm-status' }, (status) => {
      if (status && typeof status.peers === 'number') {
        swarmPeers.textContent = status.peers + ' peer' + (status.peers !== 1 ? 's' : '') + ' connected';
      }
    });
  } else {
    swarmIndicator.textContent = '';
    swarmIndicator.classList.remove('active');
    swarmPeers.textContent = '';
  }
}

swarmToggle.addEventListener('change', async () => {
  if (swarmToggle.checked) {
    const { swarm_consent_shown = false } = await api.storage.local.get('swarm_consent_shown');
    if (!swarm_consent_shown) {
      swarmToggle.checked = false;
      consentOverlay.classList.add('visible');
      return;
    }
    await api.storage.local.set({ swarm_enabled: true });
    updateSwarmUI(true);
  } else {
    await api.storage.local.set({ swarm_enabled: false });
    updateSwarmUI(false);
  }
});

consentCancel.addEventListener('click', () => {
  consentOverlay.classList.remove('visible');
});

consentEnable.addEventListener('click', async () => {
  consentOverlay.classList.remove('visible');
  await api.storage.local.set({ swarm_consent_shown: true, swarm_enabled: true });
  swarmToggle.checked = true;
  updateSwarmUI(true);
});

// ── History ──

async function loadHistory() {
  const { history = [] } = await api.storage.local.get('history');

  while (historyList.firstChild) historyList.removeChild(historyList.firstChild);

  if (history.length === 0) {
    const empty = document.createElement('div');
    empty.className = 'history-empty';
    empty.textContent = 'No shortened URLs yet';
    historyList.appendChild(empty);
    return;
  }

  history.slice(0, 50).forEach((entry) => {
    const item = document.createElement('div');
    item.className = 'history-item';

    const shortSpan = document.createElement('span');
    shortSpan.className = 'history-short';
    shortSpan.textContent = entry.short;

    const modeSpan = document.createElement('span');
    modeSpan.className = 'history-mode';
    modeSpan.textContent = entry.mode === 'alias' ? 'alias' : 'comp';

    item.appendChild(shortSpan);
    item.appendChild(modeSpan);

    item.addEventListener('click', () => {
      navigator.clipboard.writeText(entry.short).then(() => showToast('Copied!'), () => showToast('Copy failed'));
    });

    historyList.appendChild(item);
  });
}

// ── Init ──

loadSwarmState();
loadHistory();
