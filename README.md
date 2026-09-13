# 🛡️ TL;DR Privacy — ToS Summarizer Extension

> **Stop blindly clicking "Agree."** Instantly understand what you're signing up for.

A lightweight Chrome/Edge browser extension that scrapes Terms of Service and Privacy Policy pages, sends the text to **Groq AI (Llama 3.3 70B)**, and returns a color-coded risk summary — so you know what you're agreeing to in seconds.

---

## ✨ Features

- 🔴🟡🟢 **Color-coded risk clauses** — Dangerous / Caution / Safe
- 🎯 **Privacy Score** — 0–100 rating with animated ring visualization
- ⚡ **Groq Llama-3 AI** — Ultra-fast, free-tier analysis
- 🔍 **Auto-detection** — Badge lights up on ToS/Privacy Policy pages
- 📋 **One-click copy** — Share the summary instantly
- 🔒 **100% private** — Your API key stays in your browser, never shared

---

## 🚀 Installation (Developer Mode)

1. Clone or download this repository
2. Open **Chrome** or **Edge** and go to:
   - Chrome: `chrome://extensions`
   - Edge: `edge://extensions`
3. Toggle **Developer Mode** ON (top-right corner)
4. Click **"Load unpacked"**
5. Select the `tldr-privacy-extension` folder
6. The 🛡️ icon appears in your toolbar!

---

## 🔑 Setup — Get Your Free Groq API Key

1. Go to **[Groq Console](https://console.groq.com/keys)**
2. Sign in or create a free account (no credit card required)
3. Click **"Create API Key"**
4. Copy the key (starts with `gsk_...`)
5. Click the extension icon → **Settings (⚙️)**
6. Paste your key → Click **"Test Connection"** → **"Save API Key"**

> 💡 Groq offers a generous free tier with ultra-fast LLM inference!

---

## 📁 Project Structure

```
tldr-privacy-extension/
├── manifest.json          # Chrome MV3 configuration
├── background.js          # Service worker — Groq API caller
├── content.js             # Page text scraper (injected into tabs)
├── popup/
│   ├── popup.html         # Extension popup UI
│   ├── popup.css          # Dark glassmorphism styles
│   └── popup.js           # Popup logic & state management
├── options/
│   ├── options.html       # Settings page
│   ├── options.css        # Settings styles
│   └── options.js         # Save/load/test API key
├── icons/
│   ├── icon16.png
│   ├── icon48.png
│   └── icon128.png
└── README.md              # Full setup docs
```

---

## 🔒 Privacy & Security

| Concern | Answer |
|---------|--------|
| Where is my API key stored? | Locally in `chrome.storage.sync` — encrypted by Chrome |
| Is my data sent anywhere? | Only to Groq Cloud API directly — nowhere else |
| Does the extension spy on me? | No — it only activates when YOU click "Analyze" |
| Is it open source? | Yes — audit the code yourself! |

---

## 🧠 How It Works

```
You click "Analyze"
    → content.js extracts text from the page
    → popup.js sends text to background.js
    → background.js calls Groq Llama-3 API
    → Groq returns structured JSON (score + clauses)
    → popup.js renders the beautiful results
```

---

## 🏆 Built For

Hackathon Project — *"TL;DR Privacy: Because nobody reads Terms of Service"*

---

## 📄 License

MIT — Free to use, modify, and distribute.
