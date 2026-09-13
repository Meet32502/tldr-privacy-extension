// popup.js — TL;DR Privacy Extension (Series A Launcher Controller)

const screens = {
  noKey: document.getElementById('screenNoKey'),
  launcher: document.getElementById('screenLauncher'),
  history: document.getElementById('screenHistory')
};

const el = {
  headerDomain: document.getElementById('headerDomain'),
  themeToggleBtn: document.getElementById('themeToggleBtn'),
  settingsBtn: document.getElementById('settingsBtn'),
  historyBtn: document.getElementById('historyBtn'),
  goToSettingsBtn: document.getElementById('goToSettingsBtn'),

  detectStrip: document.getElementById('detectStrip'),
  detectLabel: document.getElementById('detectLabel'),
  detectSub: document.getElementById('detectSub'),

  cachedPreview: document.getElementById('cachedPreview'),
  cachedDomain: document.getElementById('cachedDomain'),
  cachedGrade: document.getElementById('cachedGrade'),
  cachedTime: document.getElementById('cachedTime'),

  openSliderBtn: document.getElementById('openSliderBtn'),
  reanalyzeBtn: document.getElementById('reanalyzeBtn'),

  histBackBtn: document.getElementById('histBackBtn'),
  histList: document.getElementById('histList'),
  histEmpty: document.getElementById('histEmpty'),
  histFooter: document.getElementById('histFooter'),
  clearAllBtn: document.getElementById('clearAllBtn')
};

let currentTab = null;
let isDarkMode = true;

// Theme Switcher
function setTheme(theme) {
  isDarkMode = theme === 'dark';
  document.documentElement.setAttribute('data-theme', theme);
  if (el.themeToggleBtn) el.themeToggleBtn.textContent = isDarkMode ? '🌙' : '☀️';
  chrome.storage.sync.set({ theme });
}

if (el.themeToggleBtn) {
  el.themeToggleBtn.addEventListener('click', () => {
    setTheme(isDarkMode ? 'light' : 'dark');
  });
}

// Load saved theme
chrome.storage.sync.get('theme', (res) => {
  if (res.theme) setTheme(res.theme);
});

function showScreen(name) {
  Object.entries(screens).forEach(([k, v]) => {
    if (v) v.classList.toggle('hidden', k !== name);
  });
}

function getDomain(url) {
  try { return new URL(url).hostname.replace(/^www\./, ''); } catch { return '—'; }
}

function getPageKey(url) {
  try {
    const u = new URL(url);
    const domain = u.hostname.replace(/^www\./, '');
    const path = u.pathname.replace(/\/$/, '').toLowerCase() || '/';
    return `${domain}${path}`;
  } catch { return '—'; }
}

function relativeTime(ts) {
  const diff = Date.now() - ts;
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return new Date(ts).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function getRiskInfo(score) {
  if (score <= 30) return { text: `High Risk (${score})`, cls: 'grade-dangerous' };
  if (score <= 55) return { text: `Moderate Risk (${score})`, cls: 'grade-concerning' };
  if (score <= 75) return { text: `Fair (${score})`, cls: 'grade-fair' };
  return { text: `User-Friendly (${score})`, cls: 'grade-good' };
}

async function loadHistory() {
  const data = await chrome.storage.local.get('tldr_analyses');
  return data.tldr_analyses || {};
}

async function init() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  currentTab = tab;

  if (!tab || !tab.url) return;

  const domain = getDomain(tab.url);
  if (el.headerDomain) el.headerDomain.textContent = domain;

  // Check API key
  const storage = await chrome.storage.sync.get(['groqApiKey', 'geminiApiKey']);
  const apiKey = storage.groqApiKey || storage.geminiApiKey;
  if (!apiKey) { showScreen('noKey'); return; }

  // Check restricted URL
  const restricted = ['chrome://', 'edge://', 'about:', 'chrome-extension://', 'moz-extension://'];
  if (restricted.some(p => tab.url.startsWith(p))) {
    if (el.detectStrip) el.detectStrip.classList.add('hidden');
    if (el.cachedPreview) el.cachedPreview.classList.add('hidden');
    if (el.openSliderBtn) el.openSliderBtn.disabled = true;
    if (el.reanalyzeBtn) el.reanalyzeBtn.classList.add('hidden');
    showScreen('launcher');
    return;
  }

  // Ensure content script is injected
  try {
    await chrome.scripting.executeScript({ target: { tabId: tab.id }, files: ['content.js'] });
  } catch (e) { /* silent */ }

  // Check cached analysis
  const pageKey = getPageKey(tab.url);
  const history = await loadHistory();
  const saved = history[pageKey];

  if (saved && saved.score !== undefined) {
    if (el.detectStrip) el.detectStrip.classList.add('hidden');
    if (el.cachedPreview) el.cachedPreview.classList.remove('hidden');
    if (el.cachedDomain) el.cachedDomain.textContent = saved.domain;
    if (el.cachedTime) el.cachedTime.textContent = `Analyzed ${relativeTime(saved.analyzedAt)}`;
    if (el.cachedGrade) {
      const info = getRiskInfo(saved.score);
      el.cachedGrade.textContent = `Score ${saved.score}`;
      el.cachedGrade.className = `ret-grade ${info.cls}`;
    }

    if (el.openSliderBtn) el.openSliderBtn.innerHTML = '⚡ Open Privacy Slider';
    if (el.reanalyzeBtn) el.reanalyzeBtn.classList.remove('hidden');
  } else {
    if (el.cachedPreview) el.cachedPreview.classList.add('hidden');
    if (el.reanalyzeBtn) el.reanalyzeBtn.classList.add('hidden');

    try {
      const check = await chrome.tabs.sendMessage(tab.id, { action: 'CHECK_PAGE' });
      if (check?.isPrivacyPage) {
        if (el.detectStrip) {
          el.detectStrip.classList.remove('hidden');
          el.detectStrip.classList.add('detected');
        }
        if (el.detectLabel) el.detectLabel.textContent = 'Privacy Policy Detected';
        if (el.detectSub) el.detectSub.textContent = 'Click below to decode privacy signals';
        if (el.openSliderBtn) el.openSliderBtn.innerHTML = '⚡ Decode Privacy Policy';
      } else {
        if (el.detectStrip) el.detectStrip.classList.add('hidden');
        if (el.openSliderBtn) el.openSliderBtn.innerHTML = '⚡ Analyze Page';
      }
    } catch {
      if (el.detectStrip) el.detectStrip.classList.add('hidden');
      if (el.openSliderBtn) el.openSliderBtn.innerHTML = '⚡ Analyze Page';
    }
  }

  showScreen('launcher');
}

// Actions
async function handleOpenSlider() {
  if (!currentTab) return;
  const pageKey = getPageKey(currentTab.url);
  const history = await loadHistory();
  const saved = history[pageKey];

  try {
    await chrome.tabs.sendMessage(currentTab.id, {
      action: 'TOGGLE_SLIDER',
      forceOpen: true,
      startAnalysis: !saved
    });
  } catch (e) {
    await chrome.scripting.executeScript({ target: { tabId: currentTab.id }, files: ['content.js'] });
    await chrome.tabs.sendMessage(currentTab.id, {
      action: 'TOGGLE_SLIDER',
      forceOpen: true,
      startAnalysis: !saved
    });
  }
  window.close();
}

async function handleReanalyze() {
  if (!currentTab) return;
  try {
    await chrome.tabs.sendMessage(currentTab.id, {
      action: 'TOGGLE_SLIDER',
      forceOpen: true,
      startAnalysis: true
    });
  } catch (e) {
    await chrome.scripting.executeScript({ target: { tabId: currentTab.id }, files: ['content.js'] });
    await chrome.tabs.sendMessage(currentTab.id, {
      action: 'TOGGLE_SLIDER',
      forceOpen: true,
      startAnalysis: true
    });
  }
  window.close();
}

// History
async function showHistory() {
  const history = await loadHistory();
  const entries = Object.values(history).sort((a, b) => b.analyzedAt - a.analyzedAt);

  if (el.histList) el.histList.innerHTML = '';

  if (entries.length === 0) {
    if (el.histEmpty) el.histEmpty.classList.remove('hidden');
    if (el.histList) el.histList.classList.add('hidden');
    if (el.histFooter) el.histFooter.classList.add('hidden');
  } else {
    if (el.histEmpty) el.histEmpty.classList.add('hidden');
    if (el.histList) el.histList.classList.remove('hidden');
    if (el.histFooter) el.histFooter.classList.remove('hidden');

    entries.forEach((entry) => {
      const row = document.createElement('div');
      row.className = 'hist-row';

      row.innerHTML = `
        <div class="hist-favicon">
          <img src="https://www.google.com/s2/favicons?domain=${encodeURIComponent(entry.domain)}&sz=32" alt="" onerror="this.style.display='none'"/>
        </div>
        <div class="hist-info">
          <div class="hist-name">${entry.domain}</div>
          <div class="hist-detail">
            <span>Score ${entry.score}</span> · <span>${relativeTime(entry.analyzedAt)}</span>
          </div>
        </div>
      `;

      row.addEventListener('click', async () => {
        if (currentTab) {
          await chrome.tabs.update(currentTab.id, { url: entry.url });
          window.close();
        }
      });

      if (el.histList) el.histList.appendChild(row);
    });
  }

  showScreen('history');
}

// Event Listeners
if (el.openSliderBtn) el.openSliderBtn.addEventListener('click', handleOpenSlider);
if (el.reanalyzeBtn) el.reanalyzeBtn.addEventListener('click', handleReanalyze);
if (el.settingsBtn) el.settingsBtn.addEventListener('click', () => chrome.runtime.openOptionsPage());
if (el.goToSettingsBtn) el.goToSettingsBtn.addEventListener('click', () => chrome.runtime.openOptionsPage());

if (el.historyBtn) el.historyBtn.addEventListener('click', showHistory);
if (el.histBackBtn) el.histBackBtn.addEventListener('click', () => showScreen('launcher'));

if (el.clearAllBtn) {
  el.clearAllBtn.addEventListener('click', async () => {
    if (confirm('Clear all saved privacy analysis history?')) {
      await chrome.storage.local.set({ tldr_analyses: {} });
      showHistory();
    }
  });
}

init();
