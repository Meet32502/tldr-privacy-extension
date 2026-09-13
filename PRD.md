# Product Requirement Document (PRD)

## 📌 Project Name: TL;DR Privacy — AI ToS & Privacy Policy Summarizer
**Document Version:** 1.0.0  
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
**TL;DR Privacy** is a lightweight, privacy-focused browser extension that instantly scrapes ToS and Privacy Policy documents from any webpage, executes AI-driven legal analysis via LLM APIs, and returns a concise, color-coded risk assessment and privacy rating (0–100) within 3 seconds.

---

## 2. Product Goals & Target Audience

### 2.1 Goals
- **Empower Users:** Turn 50-page legal documents into a 5-second readable summary.
- **Zero Friction:** Automatic detection of legal pages with single-click analysis.
- **Privacy First:** Client-side execution with API keys stored securely in local browser storage; zero intermediary telemetry.
- **High Performance:** Response time under 3 seconds using high-speed LLMs (`openai/gpt-oss-120b` / Groq API).

### 2.2 Target Audience
- **General Web Users:** Everyday internet users seeking quick risk awareness before creating accounts.
- **Privacy Enthusiasts & Advocates:** Users concerned with data sovereignty, AI training opt-outs, and tracking.
- **Hackathon Judges & Technical Reviewers:** Audience looking for a functional, slick, and scalable browser extension solution.

---

## 3. Key User Flows & Feature Specifications

### 3.1 Automatic Legal Page Detection
- **Requirement:** Content script scans page metadata (title, URL, header DOM elements) for privacy-related keywords (`terms of service`, `privacy policy`, `user agreement`, `terms of use`).
- **Behavior:** Extension popup displays an active green status badge (`✓ Privacy/ToS page detected`) when on a legal page.

### 3.2 Automated Document Scraping & Cleaning
- **Requirement:** Extract core document body text while removing DOM clutter (navbars, footers, ad banners, scripts, styling tags).
- **Truncation Guard:** Cap text at ~15,000 characters to optimize LLM context window utilization and speed up processing.

### 3.3 AI Analysis & Risk Rating
- **Requirement:** Send sanitized text to OpenAI-compatible LLM endpoint using structured JSON mode.
- **Risk Assessment Schema:**
  - **Privacy Score:** Rating from 0 (Extremely Invasive) to 100 (User-Friendly).
  - **Overall Verdict:** 1-sentence executive summary.
  - **Clause Breakdown:** 5 to 8 specific clauses classified into 3 risk levels:
    - 🔴 **High Risk / Dangerous:** AI training on user data, data selling, mandatory arbitration, location tracking.
    - 🟡 **Medium Risk / Caution:** Changes to terms without notification, third-party analytics sharing.
    - 🟢 **Low Risk / Safe:** Clear data deletion rights, strong opt-out policies, end-to-end encryption.

### 3.4 Interactive Dark Glassmorphism UI
- **Requirement:** Modern, high-aesthetic popup interface built with Vanilla HTML/CSS/JS.
- **Components:**
  - Animated SVG Privacy Score Ring with dynamic HSL color transitions.
  - Staggered animation cards for risk clauses.
  - One-click copy summary button for sharing.
  - Restricted page guard (`chrome://`, `edge://`) to prevent invalid script execution errors.

### 3.5 Secure Key Management (Options Page)
- **Requirement:** Dedicated Chrome Options page for entering, saving, and testing API keys.
- **Storage:** Key stored in `chrome.storage.sync` (encrypted local profile storage).
- **Connection Tester:** Real-time API ping test with status indicator before saving key.

---

## 4. Technical Architecture & Tech Stack

```
┌─────────────────────────────────────────────────────┐
│  BROWSER TAB (ToS / Privacy Policy Webpage)         │
│   └── content.js (DOM Scraper & Text Cleaner)        │
└──────────────────────────┬──────────────────────────┘
                           │ chrome.runtime.sendMessage
                           ▼
┌─────────────────────────────────────────────────────┐
│  EXTENSION POPUP (popup.html / popup.js / popup.css) │
│   └── Dark Glassmorphic UI & Animated Score Ring    │
└──────────────────────────┬──────────────────────────┘
                           │ chrome.runtime.sendMessage
                           ▼
┌─────────────────────────────────────────────────────┐
│  BACKGROUND SERVICE WORKER (background.js)          │
│   └── Direct fetch call with Bearer Token           │
└──────────────────────────┬──────────────────────────┘
                           │ HTTPS POST (JSON format)
                           ▼
┌─────────────────────────────────────────────────────┐
│  LLM API (OpenAI-compatible / Groq API)             │
│   └── Model: openai/gpt-oss-120b                    │
└─────────────────────────────────────────────────────┘
```

### Tech Stack Table

| Component | Technology | Rationale |
|---|---|---|
| **Extension Standard** | Manifest V3 | Mandated by Chrome & Edge; enhanced security & performance |
| **Logic & Scripting** | ES6+ JavaScript | Zero external runtime dependencies; lightweight bundle |
| **UI Styling** | Custom Vanilla CSS | Maximum flexibility, glassmorphism gradients, zero CSS overhead |
| **LLM Provider** | Groq / OpenAI-compatible API | Sub-second latency; support for `openai/gpt-oss-120b` |
| **Storage API** | `chrome.storage.sync` | Automatic cross-device profile syncing & encryption |

---

## 5. Security, Privacy & Data Handling

1. **No Intermediary Backend:** Extension communicates directly from browser to LLM provider; no third-party logging servers.
2. **Local Key Storage:** API key resides exclusively in user's browser storage (`chrome.storage.sync`).
3. **On-Demand Scrape Execution:** Content script executes only when user opens extension popup and clicks "Analyze".
4. **Data Sanitization:** DOM script strips scripts, cookies, and tokens before sending text payloads.

---

## 6. Project Directory Structure

```
tldr-privacy-extension/
├── manifest.json          # Chrome MV3 metadata & permissions
├── background.js          # Service worker for LLM API calls
├── content.js             # Page text extraction & DOM cleaner
├── PRD.md                 # Product Requirement Document
├── README.md              # Installation & setup guide
├── popup/
│   ├── popup.html         # Main popup HTML layout (5 screen states)
│   ├── popup.css          # Glassmorphism dark design system
│   └── popup.js           # Popup controller & score animations
├── options/
│   ├── options.html       # Options/Settings page
│   ├── options.css        # Options styling
│   └── options.js         # API key save, load & test handler
└── icons/
    ├── icon16.png         # Toolbar icon 16x16
    ├── icon48.png         # Management icon 48x48
    └── icon128.png        # Web Store icon 128x128
```

---

## 7. Future Scope & Roadmap (Post-Hackathon)

1. **Auto-Highlights on Webpage:** Highlight dangerous clauses directly inside the webpage DOM with tooltip warnings.
2. **Browser Push Notifications:** Alert user when a site updates its ToS policy.
3. **Policy Comparison Engine:** Compare previous ToS version vs. updated version to highlight newly added invasive clauses.
4. **Multi-LLM Provider Dropdown:** Allow user to switch between Groq, OpenAI, Anthropic Claude, and local Ollama instances.

---

## 8. License & Author
- **License:** MIT License  
- **Project:** Hackathon Submission — TL;DR Privacy Extension
