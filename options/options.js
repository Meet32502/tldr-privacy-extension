// options.js — TL;DR Privacy Extension (Series A Settings Controller)

const el = {
  themeToggleBtn: document.getElementById('themeToggleBtn'),
  themeSelect: document.getElementById('themeSelect'),
  apiKeyInput: document.getElementById('apiKeyInput'),
  toggleVisibility: document.getElementById('toggleVisibility'),
  bannerToggle: document.getElementById('bannerToggle'),
  saveBtn: document.getElementById('saveBtn'),
  testBtn: document.getElementById('testBtn'),
  statusMsg: document.getElementById('statusMsg')
};

let isDarkMode = true;

// Theme Switcher
function setTheme(theme) {
  isDarkMode = theme === 'dark';
  document.documentElement.setAttribute('data-theme', theme);
  if (el.themeToggleBtn) el.themeToggleBtn.textContent = isDarkMode ? '🌙' : '☀️';
  if (el.themeSelect) el.themeSelect.value = theme;
  chrome.storage.sync.set({ theme });
}

if (el.themeToggleBtn) {
  el.themeToggleBtn.addEventListener('click', () => {
    setTheme(isDarkMode ? 'light' : 'dark');
  });
}

if (el.themeSelect) {
  el.themeSelect.addEventListener('change', (e) => {
    setTheme(e.target.value);
  });
}

// Show/Hide Key Toggle
let isKeyVisible = false;
if (el.toggleVisibility) {
  el.toggleVisibility.addEventListener('click', () => {
    isKeyVisible = !isKeyVisible;
    el.apiKeyInput.type = isKeyVisible ? 'text' : 'password';
  });
}

// Helper: Show status message
function showStatus(text, isError = false) {
  el.statusMsg.className = `status-msg ${isError ? 'error' : 'success'}`;
  el.statusMsg.innerHTML = `${isError ? '⚠️' : '✓'} ${text}`;
  el.statusMsg.classList.remove('hidden');
  setTimeout(() => {
    el.statusMsg.classList.add('hidden');
  }, 4500);
}

// Load saved settings
async function loadSettings() {
  const sync = await chrome.storage.sync.get(['groqApiKey', 'geminiApiKey', 'theme', 'showBanner']);

  if (sync.theme) setTheme(sync.theme);

  const key = sync.groqApiKey || sync.geminiApiKey || '';
  if (el.apiKeyInput) el.apiKeyInput.value = key;

  if (el.bannerToggle) {
    el.bannerToggle.checked = sync.showBanner !== false;
  }
}

// Save Settings
async function saveSettings() {
  const key = el.apiKeyInput.value.trim();
  const showBanner = el.bannerToggle.checked;

  await chrome.storage.sync.set({
    groqApiKey: key,
    showBanner
  });

  showStatus('Settings saved successfully!');
}

// Test Connection
async function testConnection() {
  const apiKey = el.apiKeyInput.value.trim();
  if (!apiKey) {
    showStatus('Please enter an API key first.', true);
    return;
  }

  el.testBtn.disabled = true;
  el.testBtn.textContent = '⏳ Testing...';

  try {
    const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: 'openai/gpt-oss-120b',
        messages: [{ role: 'user', content: 'Ping' }],
        max_tokens: 5
      })
    });

    if (res.status === 401) throw new Error('Invalid API key. Please check your Groq API key.');
    if (!res.ok) throw new Error(`Groq API test failed: HTTP ${res.status}`);

    showStatus('Connection successful! Groq AI is ready to use.');
  } catch (err) {
    showStatus(err.message || 'Connection test failed.', true);
  } finally {
    el.testBtn.disabled = false;
    el.testBtn.textContent = '⚡ Test Connection';
  }
}

// Event Listeners
if (el.saveBtn) el.saveBtn.addEventListener('click', saveSettings);
if (el.testBtn) el.testBtn.addEventListener('click', testConnection);

if (el.bannerToggle) {
  el.bannerToggle.addEventListener('change', () => {
    chrome.storage.sync.set({ showBanner: el.bannerToggle.checked });
  });
}

loadSettings();
