# Product Requirement Document (PRD)

## 📌 Project Name: TL;DR Privacy — AI ToS & Privacy Policy Summarizer
**Document Version:** 2.0.0  
**Status:** Approved & Implemented  
**Target Platform:** Google Chrome & Microsoft Edge (Manifest V3)  

---

## 1. Executive Summary & Problem Statement

### 1.1 The Problem
Tech companies and digital platforms constantly update their Terms of Service (ToS) and Privacy Policies. Due to their extreme length, dense legal legalese, and deliberate obscurity:
- **91%+ of users blindly click "Agree"** without reading a single sentence.
- Users unknowingly surrender critical rights, including:
  - Allowing their personal media, posts, and data to train proprietary AI models.
  - Allowing continuous cross-site and location tracking.
  - Waiving their right to court trials via mandatory binding arbitration clauses.
  - Authorizing data selling to third-party ad networks without explicit opt-in.

### 1.2 The Solution
**TL;DR Privacy** is a lightweight, privacy-focused browser extension that instantly extracts ToS and Privacy Policy text, executes deterministic AI-driven legal analysis via ultra-fast LLM APIs (Groq Cloud), and delivers an interactive in-page sliding panel, 3-bullet executive summary, 5 category risk pillars, and a color-coded risk rating (0–100) in under 3 seconds.

---

## 2. Product Goals & Target Audience

### 2.1 Goals
- **Empower Users:** Turn 50-page legal documents into 3 concise, plain-language bullet points.
- **Zero Friction:** Automatic legal page detection with floating top banner and side pill trigger.
- **Deterministic Risk Scoring:** Consistent, reproducible risk scores (temperature = 0) based on mathematical clause deductions.
- **Privacy First:** Client-side execution with API keys stored locally (`chrome.storage.sync`); zero telemetry servers.
- **High Performance:** Response time under 3 seconds using Groq API (`openai/gpt-oss-120b`).

### 2.2 Target Audience
- **General Web Users:** Everyday internet users seeking quick risk awareness before creating accounts.
- **Privacy Enthusiasts & Advocates:** Users concerned with data sovereignty, AI training opt-outs, and tracking.
- **Developers & Reviewers:** Audience looking for a functional, polished, Manifest V3 Chrome extension solution.

---

## 3. Key User Flows & Feature Specifications

### 3.1 Automatic Legal Page Detection & Smart Banner
- **Detection:** Content script inspects metadata, document URL, title, and body keywords (`terms of service`, `privacy policy`, `user agreement`, `cookie policy`).
- **Floating Top Banner:** Unobtrusive banner appears at the top-right of legal pages offering one-click slider open.
- **Floating Side Pill Trigger:** Sleek edge trigger (`#tldr-pill`) attached to the page margin for quick toggling.

### 3.2 Automated Document Scraping & Sanitization
- **DOM Cleaning:** Removes scripts, stylesheets, iframe noise, cookie popups, footers, and ad banners.
- **Truncation Guard:** Capped at 15,000 characters to optimize LLM processing speed and context window utilization.

### 3.3 AI Analysis, Deterministic Scoring & 3-Bullet Summary
- **Deterministic LLM Inference:** Calls Groq API with `temperature: 0.0` for identical results on re-analyzing the same document.
- **Strict 3-Bullet Summary:** Prompt and code normalization strictly cap the executive summary at **exactly 3 short bullets** (under 15–20 words each).
- **Mathematical Score Calculation:** 
  - Starts at 100 points (User-Friendly).
  - Deducts 15 points per high-risk clause, 8 points per medium-risk clause, 0 for low-risk.
  - Clamped between 0 and 100.
  - Categorized into 4 rating tiers: 🔴 High Risk (0–30), 🟡 Moderate Risk (31–55), 🔵 Fair (56–75), 🟢 User-Friendly (76–100).

### 3.4 5 Privacy Category Pillars
Findings are categorized into 5 core privacy domains:
1. 📦 **Data Selling & Monetization**
2. 🧠 **AI Model Training on User Data**
3. 🔗 **Third-Party Data Sharing**
4. ⏳ **Data Retention & Account Deletion**
5. ⚖️ **User Rights & Mandatory Arbitration**

### 3.5 In-Page Shadow DOM Slider & Popup Launcher
- **Shadow DOM Isolation:** Slider panel renders inside an isolated Shadow DOM (`#tldr-privacy-root`) to prevent CSS leakage or page layout distortion.
- **Porcelain Light Theme UI:** Modern design system built with clean porcelain light aesthetic (`#F8FAFC` background, `#FFFFFF` cards, `#0F172A` text, `#4F46E5` brand primary).
- **Typography Stack:** High-legibility Google Fonts (*Plus Jakarta Sans*, *Outfit*, *JetBrains Mono*). Bullet summary text styled at `12.5px`, medium weight (`500`), `1.45` line-height for visual balance next to the score ring.
- **Analysis History:** Saves past checks in `chrome.storage.local` with a dedicated History view in the extension popup.

### 3.6 Options Page & Key Management
- **Groq API Key Setup:** Options page to input, validate, test, and save free Groq API keys (`gsk_...`).
- **Storage:** Key saved locally in `chrome.storage.sync`.

---

## 4. Technical Architecture & Tech Stack

```
┌─────────────────────────────────────────────────────────────────┐
│  BROWSER TAB (ToS / Privacy Policy Webpage)                     │
│   ├── content.js (DOM Scraper & Text Cleaner)                   │
│   └── Shadow DOM Sliding Panel & Floating Banner/Pill           │
└──────────────────────────────┬──────────────────────────────────┘
                               │ chrome.runtime.sendMessage
                               ▼
┌─────────────────────────────────────────────────────────────────┐
│  EXTENSION POPUP (popup.html / popup.js / popup.css)             │
│   └── Launcher, Cached Score Display & History Viewer           │
└──────────────────────────────┬──────────────────────────────────┘
                               │ chrome.runtime.sendMessage
                               ▼
┌─────────────────────────────────────────────────────────────────┐
│  BACKGROUND SERVICE WORKER (background.js)                      │
│   └── Deterministic Groq API fetch (temp: 0.0, max 3 bullets)  │
└──────────────────────────────┬──────────────────────────────────┘
                               │ HTTPS POST (JSON format)
                               ▼
┌─────────────────────────────────────────────────────────────────┐
│  GROQ CLOUD LLM API                                             │
│   └── Model: openai/gpt-oss-120b                                │
└─────────────────────────────────────────────────────────────────┘
```

### Tech Stack Table

| Component | Technology | Rationale |
|---|---|---|
| **Extension Standard** | Manifest V3 | Standard for Chrome & Edge extensions |
| **Logic & Scripting** | ES6+ JavaScript | Zero external runtime dependencies; lightweight bundle |
| **UI System & Theme** | Vanilla CSS (Porcelain Light Mode) | Clean palette (`#F8FAFC`), Plus Jakarta Sans typography, shadow DOM isolation |
| **AI LLM Engine** | Groq Cloud API (`openai/gpt-oss-120b`) | Ultra-fast inference with deterministic scoring (`temp: 0.0`) |
| **Storage API** | `chrome.storage.sync` & `chrome.storage.local` | Secure key storage and local analysis history caching |

---

## 5. Security, Privacy & Data Handling

1. **Direct Communication:** Browser communicates directly with Groq API; no intermediate data collection backend.
2. **Local Key Storage:** API key stored exclusively in browser storage (`chrome.storage.sync`).
3. **DOM Text Sanitization:** Strips scripts, tracking pixels, cookies, and tokens prior to AI transmission.

---

## 6. Project Directory Structure

```
tldr-privacy-extension/
├── manifest.json          # Chrome MV3 metadata & permissions
├── background.js          # Service worker & Groq AI API handler
├── content.js             # Text scraper & Shadow DOM sliding panel
├── PRD.md                 # Product Requirement Document (v2.0.0)
├── README.md              # Installation & user guide
├── popup/
│   ├── design-tokens.css  # Porcelain Light Mode design system
│   ├── popup.html         # Extension launcher & history UI
│   ├── popup.css          # Launcher stylesheet
│   └── popup.js           # Launcher controller & history loader
├── options/
│   ├── options.html       # API key settings page
│   ├── options.css        # Options page styling
│   └── options.js         # API key saving, loading & ping tester
└── icons/
    ├── icon16.png         # Toolbar icon
    ├── icon48.png         # Extension management icon
    └── icon128.png        # Web Store icon
```

---

## 7. License & Author
- **License:** MIT License  
- **Project:** TL;DR Privacy Extension
