// content.js — TL;DR Privacy Extension Engine
// Injected into web pages to provide an interactive, shadow-DOM sliding panel & floating smart banner

(function () {
  // Guard against double initialization
  if (window.__TLDR_PRIVACY_INJECTED__) return;
  window.__TLDR_PRIVACY_INJECTED__ = true;

  // ===== TEXT EXTRACTION UTILITIES =====
  function extractPageText() {
    const docClone = document.cloneNode(true);
    const noiseSelectors = [
      'script', 'style', 'noscript', 'iframe',
      'nav', 'header', 'footer',
      '.cookie-banner', '.cookie-notice', '#cookie-consent',
      '.advertisement', '.ad', '.ads',
      '.sidebar', '#sidebar',
      '.social-share', '.share-buttons',
      '.navigation', '.breadcrumb',
      '[aria-hidden="true"]', '.sr-only'
    ];

    noiseSelectors.forEach(selector => {
      docClone.querySelectorAll(selector).forEach(el => el.remove());
    });

    const contentSelectors = [
      'main', 'article', '[role="main"]',
      '.terms-content', '.privacy-content', '.legal-content', '.policy-content',
      '#terms', '#privacy', '#main-content', '.content', '#content'
    ];

    let mainContent = null;
    for (const selector of contentSelectors) {
      const el = docClone.querySelector(selector);
      if (el && el.innerText && el.innerText.trim().length > 500) {
        mainContent = el;
        break;
      }
    }

    const textSource = mainContent || docClone.body;
    let text = textSource.innerText || textSource.textContent || '';

    text = text
      .replace(/\t/g, ' ')
      .replace(/[ ]{2,}/g, ' ')
      .replace(/\n{3,}/g, '\n\n')
      .trim();

    const MAX_CHARS = 15000;
    if (text.length > MAX_CHARS) {
      text = text.substring(0, MAX_CHARS) + '\n\n[... document truncated for analysis ...]';
    }

    return {
      text,
      title: document.title,
      url: window.location.href,
      charCount: text.length
    };
  }

  function isPrivacyPage() {
    const indicators = [
      'terms of service', 'terms and conditions', 'privacy policy',
      'terms of use', 'user agreement', 'end user license',
      'cookie policy', 'data policy', 'legal notice', 'privacy notice'
    ];
    const pageText = (document.title + ' ' + window.location.href + ' ' + document.body.innerText.substring(0, 2000)).toLowerCase();
    return indicators.some(indicator => pageText.includes(indicator));
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

  function simpleHash(str) {
    let hash = 5381;
    const sample = str.substring(0, 5000);
    for (let i = 0; i < sample.length; i++) {
      hash = ((hash << 5) + hash + sample.charCodeAt(i)) & 0x7fffffff;
    }
    return hash.toString(36);
  }

  function escapeHtml(t) {
    const d = document.createElement('div');
    d.textContent = t;
    return d.innerHTML;
  }

  function getRiskInfo(score) {
    if (score <= 30) return { color: '#EF4444', text: 'High Risk', cls: 'grade-dangerous', risk: 'high' };
    if (score <= 55) return { color: '#F59E0B', text: 'Moderate Risk', cls: 'grade-concerning', risk: 'medium' };
    if (score <= 75) return { color: '#3B82F6', text: 'Fair', cls: 'grade-fair', risk: 'fair' };
    return { color: '#10B981', text: 'User-Friendly', cls: 'grade-good', risk: 'low' };
  }

  // ===== CATEGORY EXTRACTION ENGINE =====
  function extractCategories(clauses, verdictText) {
    const categories = {
      selling: { title: 'Data Selling & Monetization', icon: '📦', risk: 'low', summary: 'No explicit data selling clauses found.' },
      ai: { title: 'AI Model Training', icon: '🧠', risk: 'low', summary: 'No AI training on user data declared.' },
      sharing: { title: 'Third-Party Sharing', icon: '🔗', risk: 'low', summary: 'Standard third-party service provider sharing.' },
      retention: { title: 'Data Retention & Deletion', icon: '⏳', risk: 'low', summary: 'Data retention details not specified.' },
      rights: { title: 'User Rights & Arbitration', icon: '⚖️', risk: 'low', summary: 'Standard legal terms and governing law.' }
    };

    const text = (verdictText + ' ' + clauses.map(c => c.title + ' ' + c.detail).join(' ')).toLowerCase();

    if (text.includes('sell') || text.includes('monetiz') || text.includes('broker')) {
      const match = clauses.find(c => (c.title + c.detail).toLowerCase().includes('sell'));
      categories.selling.risk = match?.risk || 'high';
      categories.selling.summary = match?.detail || 'Policy permits sharing or monetizing user data with partners.';
    }

    if (text.includes('ai') || text.includes('artificial intelligence') || text.includes('train') || text.includes('machine learning') || text.includes('model')) {
      const match = clauses.find(c => (c.title + c.detail).toLowerCase().match(/ai|train|machine/));
      categories.ai.risk = match?.risk || 'medium';
      categories.ai.summary = match?.detail || 'User content may be used to develop or train AI models.';
    }

    if (text.includes('third party') || text.includes('advertis') || text.includes('partner') || text.includes('affiliate')) {
      const match = clauses.find(c => (c.title + c.detail).toLowerCase().includes('third'));
      categories.sharing.risk = match?.risk || 'medium';
      categories.sharing.summary = match?.detail || 'Data is shared with third-party advertisers and service partners.';
    }

    if (text.includes('retain') || text.includes('retention') || text.includes('delete') || text.includes('deletion') || text.includes('store')) {
      const match = clauses.find(c => (c.title + c.detail).toLowerCase().match(/retain|delete|store/));
      categories.retention.risk = match?.risk || 'medium';
      categories.retention.summary = match?.detail || 'Certain user data is retained even after account closure.';
    }

    if (text.includes('arbitration') || text.includes('dispute') || text.includes('class action') || text.includes('opt-out') || text.includes('court')) {
      const match = clauses.find(c => (c.title + c.detail).toLowerCase().match(/arbitrat|dispute|class/));
      categories.rights.risk = match?.risk || 'high';
      categories.rights.summary = match?.detail || 'Includes mandatory arbitration and class-action waiver clauses.';
    }

    return Object.values(categories);
  }

  // ===== SHADOW DOM SETUP =====
  const hostEl = document.createElement('div');
  hostEl.id = 'tldr-privacy-root';
  hostEl.style.cssText = 'all: initial; position: fixed; top: 0; right: 0; z-index: 2147483647; pointer-events: none;';
  document.documentElement.appendChild(hostEl);

  const shadow = hostEl.attachShadow({ mode: 'open' });

  // CSS Styles inside Shadow DOM — Fixed Dark Theme
  const styleEl = document.createElement('style');
  styleEl.textContent = `
    @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&family=Outfit:wght@500;600;700;800&family=JetBrains+Mono:wght@500;600;700&display=swap');

    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

    :host {
      font-family: 'Plus Jakarta Sans', 'Outfit', system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      -webkit-font-smoothing: antialiased;
      -moz-osx-font-smoothing: grayscale;
      text-rendering: optimizeLegibility;

      --bg-app: #F8FAFC;
      --bg-surface: #FFFFFF;
      --bg-card: #FFFFFF;
      --bg-hover: #F1F5F9;
      --text-main: #0F172A;
      --text-sub: #334155;
      --text-muted: #64748B;
      --border-line: #E2E8F0;
      --border-glow: rgba(79, 70, 229, 0.25);
      --shadow-drawer: -16px 0 48px rgba(15, 23, 42, 0.12);
    }

    /* Floating Top Smart Banner */
    #tldr-banner {
      position: fixed;
      top: 16px;
      right: 20px;
      background: var(--bg-surface);
      color: var(--text-main);
      border: 1px solid var(--border-glow);
      border-radius: 12px;
      padding: 10px 14px;
      box-shadow: 0 10px 30px rgba(0, 0, 0, 0.35);
      z-index: 2147483645;
      pointer-events: none;
      display: flex;
      align-items: center;
      gap: 12px;
      opacity: 0;
      visibility: hidden;
      transform: translateY(-20px);
      transition: opacity 0.3s ease, transform 0.3s cubic-bezier(0.16, 1, 0.3, 1), visibility 0.3s;
      backdrop-filter: blur(12px);
    }

    #tldr-banner.visible {
      opacity: 1;
      visibility: visible;
      pointer-events: auto;
      transform: translateY(0);
    }

    .banner-brand { display: flex; align-items: center; gap: 8px; font-weight: 700; font-size: 12.5px; }
    .banner-icon { width: 22px; height: 22px; border-radius: 6px; background: linear-gradient(135deg, #6366F1, #4F46E5); display: flex; align-items: center; justify-content: center; font-size: 11px; color: white; }
    .banner-text { font-size: 11.5px; color: var(--text-sub); }
    .banner-btn { background: linear-gradient(135deg, #6366F1, #4F46E5); color: white; border: none; padding: 6px 12px; border-radius: 6px; font-size: 11px; font-weight: 600; cursor: pointer; transition: all 0.2s; }
    .banner-btn:hover { transform: translateY(-1px); box-shadow: 0 4px 12px rgba(99, 102, 241, 0.4); }
    .banner-close { background: transparent; border: none; color: var(--text-muted); cursor: pointer; font-size: 14px; padding: 2px; }
    .banner-close:hover { color: var(--text-main); }

    /* Floating Pill Trigger */
    #tldr-pill {
      position: fixed;
      right: 0;
      top: 38%;
      transform: translateY(-50%);
      background: var(--bg-surface);
      border: 1px solid var(--border-glow);
      border-right: none;
      border-radius: 20px 0 0 20px;
      padding: 9px 13px 9px 11px;
      cursor: pointer;
      z-index: 2147483646;
      pointer-events: auto;
      display: flex;
      align-items: center;
      gap: 7px;
      box-shadow: -4px 4px 24px rgba(0, 0, 0, 0.4);
      transition: transform 0.22s cubic-bezier(0.16, 1, 0.3, 1);
      color: var(--text-main);
      font-size: 11.5px;
      font-weight: 600;
      user-select: none;
    }

    #tldr-pill:hover {
      transform: translateY(-50%) translateX(-4px);
      border-color: #6366F1;
    }

    #tldr-pill .pill-mark {
      width: 18px; height: 18px; border-radius: 5px;
      background: linear-gradient(135deg, #6366F1, #4F46E5);
      display: flex; align-items: center; justify-content: center;
      font-size: 10px; font-weight: 800; color: white;
    }

    #tldr-pill .pill-badge {
      font-size: 10px; font-family: 'JetBrains Mono', monospace;
      font-weight: 700; padding: 1px 6px; border-radius: 10px;
      background: rgba(99, 102, 241, 0.2); color: #818CF8;
    }

    #tldr-pill .pill-badge.high { background: rgba(239, 68, 68, 0.2); color: #FCA5A5; }
    #tldr-pill .pill-badge.medium { background: rgba(245, 158, 11, 0.2); color: #FCD34D; }
    #tldr-pill .pill-badge.fair { background: rgba(59, 130, 246, 0.2); color: #93C5FD; }
    #tldr-pill .pill-badge.low { background: rgba(16, 185, 129, 0.2); color: #6EE7B7; }

    /* Sliding Drawer */
    #tldr-slider {
      position: fixed;
      top: 0;
      right: 0;
      width: 390px;
      height: 100vh;
      background: var(--bg-app);
      color: var(--text-main);
      transform: translateX(100%);
      transition: transform 0.35s cubic-bezier(0.16, 1, 0.3, 1);
      box-shadow: var(--shadow-drawer);
      pointer-events: auto;
      display: flex;
      flex-direction: column;
      z-index: 2147483647;
      border-left: 1px solid var(--border-line);
      overflow: hidden;
    }

    #tldr-slider.open { transform: translateX(0); }

    /* Header */
    .slider-hdr {
      display: flex; align-items: center; justify-content: space-between;
      padding: 14px 18px;
      background: var(--bg-surface);
      border-bottom: 1px solid var(--border-line);
      flex-shrink: 0;
    }

    .hdr-brand { display: flex; align-items: center; gap: 9px; }
    .hdr-mark { width: 32px; height: 32px; border-radius: 99px; background: linear-gradient(135deg, #6366F1, #4F46E5); display: flex; align-items: center; justify-content: center; color: white; font-weight: 800; font-size: 14px; box-shadow: 0 2px 8px rgba(99, 102, 241, 0.3); }
    .hdr-title-group { display: flex; flex-direction: column; gap: 1px; }
    .hdr-name-row { display: flex; align-items: center; gap: 6px; }
    .hdr-name { font-size: 14px; font-weight: 800; color: var(--text-main); letter-spacing: -0.3px; }
    .hdr-v2-badge { font-size: 8.5px; font-weight: 700; font-family: 'JetBrains Mono', monospace; color: #6366F1; background: rgba(99, 102, 241, 0.15); padding: 1px 6px; border-radius: 4px; }
    .hdr-domain { font-size: 10.5px; font-weight: 500; color: var(--text-muted); font-family: 'JetBrains Mono', monospace; max-width: 160px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }

    .hdr-actions { display: flex; align-items: center; gap: 4px; }
    .hdr-btn { width: 28px; height: 28px; border-radius: 6px; border: none; background: transparent; color: var(--text-muted); cursor: pointer; display: flex; align-items: center; justify-content: center; transition: all 0.15s; font-size: 13px; }
    .hdr-btn:hover { background: var(--bg-hover); color: var(--text-main); }

    /* Main Body */
    .slider-body { flex: 1; overflow-y: auto; padding: 16px; display: flex; flex-direction: column; gap: 14px; }
    .hidden { display: none !important; }

    /* Buttons */
    .btn { display: inline-flex; align-items: center; justify-content: center; gap: 6px; padding: 11px 16px; border-radius: 9px; font-size: 12.5px; font-weight: 600; cursor: pointer; border: none; transition: all 0.18s; width: 100%; font-family: 'Plus Jakarta Sans', sans-serif; }
    .btn-accent { background: linear-gradient(135deg, #6366F1, #4F46E5); color: white; box-shadow: 0 4px 14px rgba(99, 102, 241, 0.35); }
    .btn-accent:hover { transform: translateY(-1px); box-shadow: 0 6px 18px rgba(99, 102, 241, 0.45); }
    .btn-muted { background: var(--bg-card); color: var(--text-sub); border: 1px solid var(--border-line); }
    .btn-muted:hover { background: var(--bg-hover); color: var(--text-main); }

    /* Scanning animation screen */
    .decode-box { background: var(--bg-card); border: 1px solid var(--border-line); border-radius: 12px; padding: 22px 16px; text-align: center; }
    .decode-lines { position: relative; display: flex; flex-direction: column; gap: 8px; margin-bottom: 16px; overflow: hidden; padding: 4px 0; }
    .decode-line { height: 4px; background: var(--border-line); border-radius: 2px; width: 100%; position: relative; }
    .decode-line.short { width: 65%; }
    .decode-scanner { position: absolute; top: 0; left: -40%; width: 40%; height: 100%; background: linear-gradient(90deg, transparent, rgba(99, 102, 241, 0.4), transparent); animation: scanSweep 1.8s ease infinite; }
    @keyframes scanSweep { 0% { left: -40%; } 100% { left: 110%; } }
    .decode-status { font-size: 12.5px; font-weight: 600; color: #4F46E5; margin-bottom: 10px; }
    .decode-bar { height: 4px; background: var(--border-line); border-radius: 2px; overflow: hidden; }
    .decode-bar-fill { height: 100%; width: 15%; background: linear-gradient(90deg, #6366F1, #06B6D4); transition: width 0.4s ease; }

    /* Hero Privacy Meter */
    .orb-hero { display: flex; align-items: center; gap: 14px; background: var(--bg-card); border: 1px solid var(--border-line); border-radius: 14px; padding: 14px; position: relative; overflow: hidden; box-shadow: 0 4px 16px rgba(15, 23, 42, 0.06); }
    .orb-wrap { position: relative; width: 74px; height: 74px; flex-shrink: 0; }
    .orb-rings { width: 100%; height: 100%; transform: rotate(-90deg); }
    .orb-ticks { fill: none; stroke: var(--text-muted); stroke-width: 1; stroke-dasharray: 2 4; opacity: 0.5; }
    .orb-outer { fill: none; stroke: var(--border-line); stroke-width: 1; }
    .orb-mid { fill: none; stroke: var(--border-line); stroke-width: 0.5; stroke-dasharray: 4 3; }
    .orb-fill { fill: none; stroke: #4F46E5; stroke-width: 4.5; stroke-linecap: round; stroke-dasharray: 238.8; stroke-dashoffset: 238.8; transition: stroke-dashoffset 1.2s cubic-bezier(0.16, 1, 0.3, 1), stroke 0.4s ease; filter: drop-shadow(0 0 4px rgba(79, 70, 229, 0.3)); }
    .orb-center { position: absolute; inset: 0; display: flex; flex-direction: column; align-items: center; justify-content: center; }
    .orb-score { font-size: 20px; font-weight: 800; color: var(--text-main); letter-spacing: -0.5px; }
    .orb-max { font-size: 8.5px; color: var(--text-muted); font-weight: 600; font-family: 'JetBrains Mono', monospace; }

    .orb-meta { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 4px; }
    .orb-grade { display: inline-block; font-size: 10.5px; font-weight: 700; padding: 2px 8px; border-radius: 20px; width: fit-content; }

    .grade-dangerous { background: rgba(239, 68, 68, 0.15); color: #DC2626; border: 1px solid rgba(239, 68, 68, 0.3); }
    .grade-concerning { background: rgba(245, 158, 11, 0.15); color: #D97706; border: 1px solid rgba(245, 158, 11, 0.3); }
    .grade-fair { background: rgba(59, 130, 246, 0.15); color: #2563EB; border: 1px solid rgba(59, 130, 246, 0.3); }
    .grade-good { background: rgba(16, 185, 129, 0.15); color: #059669; border: 1px solid rgba(16, 185, 129, 0.3); }

    .briefing-box { background: var(--bg-surface); border-left: 3px solid #4F46E5; border-radius: 0 6px 6px 0; padding: 8px 10px; margin-top: 2px; }
    .briefing-tag { display: block; font-size: 8.5px; font-weight: 700; font-family: 'JetBrains Mono', monospace; color: #4F46E5; letter-spacing: 0.6px; margin-bottom: 4px; }
    
    /* 3 Concise Summary Bullets */
    .verdict-bullets { display: flex; flex-direction: column; gap: 6px; list-style: none; padding: 0; margin: 0; }
    .verdict-bullet-item { font-size: 12.5px; font-weight: 500; color: var(--text-sub); line-height: 1.45; position: relative; padding-left: 14px; }
    .verdict-bullet-item::before { content: "•"; position: absolute; left: 0; color: #4F46E5; font-weight: 800; }

    /* Category Cards Grid */
    .cats-hdr { font-size: 10px; font-weight: 700; color: var(--text-muted); font-family: 'JetBrains Mono', monospace; letter-spacing: 0.8px; margin-top: 4px; margin-bottom: 6px; }
    .cats-grid { display: flex; flex-direction: column; gap: 8px; }

    .cat-card { background: var(--bg-card); border: 1px solid var(--border-line); border-radius: 10px; padding: 10px 12px; transition: all 0.2s ease; }
    .cat-card:hover { border-color: var(--border-glow); background: var(--bg-hover); }
    .cat-top { display: flex; align-items: center; justify-content: space-between; margin-bottom: 4px; }
    .cat-title-group { display: flex; align-items: center; gap: 7px; font-size: 12px; font-weight: 650; color: var(--text-main); }
    .cat-badge { font-size: 9px; font-weight: 700; font-family: 'JetBrains Mono', monospace; padding: 2px 7px; border-radius: 12px; text-transform: uppercase; }

    .cat-badge.high { background: rgba(239, 68, 68, 0.15); color: #EF4444; border: 1px solid rgba(239, 68, 68, 0.3); }
    .cat-badge.medium { background: rgba(245, 158, 11, 0.15); color: #F59E0B; border: 1px solid rgba(245, 158, 11, 0.3); }
    .cat-badge.low { background: rgba(16, 185, 129, 0.15); color: #10B981; border: 1px solid rgba(16, 185, 129, 0.3); }

    .cat-summary { font-size: 11px; color: var(--text-sub); line-height: 1.4; }

    /* Findings / Breakdown */
    .findings-hdr { display: flex; align-items: center; justify-content: space-between; margin-top: 6px; margin-bottom: 6px; }
    .copy-btn { display: flex; align-items: center; gap: 4px; background: transparent; border: none; color: var(--text-muted); font-size: 10.5px; font-weight: 600; cursor: pointer; padding: 3px 7px; border-radius: 4px; }
    .copy-btn:hover { background: var(--bg-hover); color: var(--text-main); }
    .copy-btn.copied { color: #10B981; }

    .finding-row { display: flex; align-items: flex-start; gap: 10px; padding: 10px 0; border-bottom: 1px solid var(--border-line); }
    .finding-row:last-child { border-bottom: none; }
    .finding-idx { font-family: 'JetBrains Mono', monospace; font-size: 11px; font-weight: 700; color: var(--text-muted); min-width: 18px; padding-top: 1px; }
    .finding-risk-bar { display: flex; flex-direction: column; align-items: center; gap: 2px; width: 22px; flex-shrink: 0; }
    .risk-level-bar { width: 3px; height: 22px; background: var(--border-line); border-radius: 2px; position: relative; overflow: hidden; }
    .risk-level-fill { position: absolute; bottom: 0; left: 0; width: 100%; border-radius: 2px; }
    .risk-level-fill.high { height: 90%; background: #EF4444; }
    .risk-level-fill.medium { height: 55%; background: #F59E0B; }
    .risk-level-fill.low { height: 25%; background: #10B981; }
    .risk-level-label { font-size: 7px; font-weight: 800; font-family: 'JetBrains Mono', monospace; }
    .risk-level-label.high { color: #EF4444; }
    .risk-level-label.medium { color: #F59E0B; }
    .risk-level-label.low { color: #10B981; }

    .finding-content { flex: 1; min-width: 0; }
    .finding-title { font-size: 12px; font-weight: 650; color: var(--text-main); margin-bottom: 2px; }
    .finding-detail { font-size: 11px; color: var(--text-sub); line-height: 1.45; }

    .footer-row { display: flex; gap: 8px; margin-top: 8px; }
  `;

  // HTML Template for Shadow DOM
  const wrapperEl = document.createElement('div');
  wrapperEl.innerHTML = `
    <!-- In-Page Floating Top Smart Banner -->
    <div id="tldr-banner">
      <div class="banner-brand">
        <div class="banner-icon">🛡️</div>
        <span>TL;DR Privacy</span>
      </div>
      <div id="bannerText" class="banner-text">Privacy Policy Detected on this page</div>
      <button id="bannerOpenBtn" class="banner-btn">Open Slider</button>
      <button id="bannerCloseBtn" class="banner-close" title="Dismiss banner">✕</button>
    </div>

    <!-- Floating Pill Trigger -->
    <div id="tldr-pill" title="TL;DR Privacy — Click to open slider">
      <div class="pill-mark">🛡️</div>
      <span id="pill-text">TL;DR Privacy</span>
      <span id="pill-badge" class="pill-badge hidden">82</span>
    </div>

    <!-- Sliding Side Drawer -->
    <div id="tldr-slider">
      <!-- Header -->
      <div class="slider-hdr">
        <div class="hdr-brand">
          <div class="hdr-mark">🛡️</div>
          <div class="hdr-title-group">
            <div class="hdr-name-row">
              <span class="hdr-name">TL;DR Privacy</span>
              <span class="hdr-v2-badge">INTELLIGENCE</span>
            </div>
            <span id="hdrDomain" class="hdr-domain">domain.com</span>
          </div>
        </div>
        <div class="hdr-actions">
          <button id="minimizeBtn" class="hdr-btn" title="Minimize slider">—</button>
          <button id="closeBtn" class="hdr-btn" title="Close slider">✕</button>
        </div>
      </div>

      <!-- Main Body -->
      <div class="slider-body">
        <!-- Detect / Idle Screen -->
        <div id="viewIdle" class="decode-box">
          <div style="font-size: 28px; margin-bottom: 8px;">🛡️</div>
          <div id="idleTitle" style="font-size: 13.5px; font-weight: 700; color: var(--text-main); margin-bottom: 4px;">Privacy Policy Detected</div>
          <div id="idleSub" style="font-size: 11px; color: var(--text-muted); margin-bottom: 16px;">Ready to decode privacy signals & 5 category pillars</div>
          <button id="startAnalyzeBtn" class="btn btn-accent">⚡ Decode Privacy Policy</button>
        </div>

        <!-- Scanning / Loading Screen -->
        <div id="viewLoading" class="decode-box hidden">
          <div class="decode-lines">
            <div class="decode-line"><div class="decode-scanner"></div></div>
            <div class="decode-line short"><div class="decode-scanner"></div></div>
            <div class="decode-line"><div class="decode-scanner"></div></div>
          </div>
          <div id="loadingMsg" class="decode-status">Scanning document fine print…</div>
          <div class="decode-bar"><div id="loadingProgress" class="decode-bar-fill"></div></div>
        </div>

        <!-- Results Screen -->
        <div id="viewResults" class="hidden">
          <!-- Hero Privacy Intelligence Meter -->
          <div class="orb-hero">
            <div class="orb-wrap">
              <svg class="orb-rings" viewBox="0 0 80 80">
                <circle class="orb-ticks" cx="40" cy="40" r="37"/>
                <circle class="orb-outer" cx="40" cy="40" r="34"/>
                <circle class="orb-mid" cx="40" cy="40" r="30"/>
                <circle id="meterArc" class="orb-fill" cx="40" cy="40" r="38"/>
              </svg>
              <div class="orb-center">
                <div class="orb-score"><span id="meterScore">0</span></div>
                <div class="orb-max">/100</div>
              </div>
            </div>
            <div class="orb-meta">
              <span id="meterGrade" class="orb-grade grade-good">User-Friendly</span>
              <div class="briefing-box">
                <span class="briefing-tag">3-BULLET PRIVACY SUMMARY</span>
                <ul id="meterVerdict" class="verdict-bullets">
                  <li class="verdict-bullet-item">Analyzing clauses…</li>
                </ul>
              </div>
            </div>
          </div>

          <!-- 5 Privacy Category Breakdown Cards -->
          <div class="cats-hdr">5 PRIVACY CATEGORY PILLARS</div>
          <div id="catsContainer" class="cats-grid"></div>

          <!-- Detailed Findings -->
          <div class="findings-hdr">
            <span class="cats-hdr" style="margin: 0;">DETAILED PRIVACY SIGNALS</span>
            <button id="copySummaryBtn" class="copy-btn">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <rect x="9" y="9" width="13" height="13" rx="2" ry="2"/>
                <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>
              </svg>
              <span id="copyLabel">Copy</span>
            </button>
          </div>
          <div id="findingsContainer"></div>

          <!-- Actions -->
          <div class="footer-row">
            <button id="reanalyzeSliderBtn" class="btn btn-muted">🔄 Re-analyze</button>
          </div>
        </div>

        <!-- Error Screen -->
        <div id="viewError" class="decode-box hidden">
          <div style="font-size: 24px; margin-bottom: 6px;">⚠️</div>
          <div style="font-size: 13px; font-weight: 700; color: #EF4444; margin-bottom: 4px;">Analysis Failed</div>
          <div id="errorText" style="font-size: 11px; color: var(--text-sub); margin-bottom: 14px;">An error occurred connecting to AI.</div>
          <button id="retrySliderBtn" class="btn btn-accent">Try Again</button>
        </div>
      </div>
    </div>
  `;

  shadow.appendChild(styleEl);
  shadow.appendChild(wrapperEl);

  // ===== SHADOW DOM ELEMENTS =====
  const bannerEl = shadow.getElementById('tldr-banner');
  const bannerText = shadow.getElementById('bannerText');
  const bannerOpenBtn = shadow.getElementById('bannerOpenBtn');
  const bannerCloseBtn = shadow.getElementById('bannerCloseBtn');

  const pillEl = shadow.getElementById('tldr-pill');
  const pillBadgeEl = shadow.getElementById('pill-badge');
  const sliderEl = shadow.getElementById('tldr-slider');
  const hdrDomainEl = shadow.getElementById('hdrDomain');
  const closeBtn = shadow.getElementById('closeBtn');
  const minimizeBtn = shadow.getElementById('minimizeBtn');

  const viewIdle = shadow.getElementById('viewIdle');
  const viewLoading = shadow.getElementById('viewLoading');
  const viewResults = shadow.getElementById('viewResults');
  const viewError = shadow.getElementById('viewError');

  const idleTitle = shadow.getElementById('idleTitle');
  const idleSub = shadow.getElementById('idleSub');
  const startAnalyzeBtn = shadow.getElementById('startAnalyzeBtn');

  const loadingMsg = shadow.getElementById('loadingMsg');
  const loadingProgress = shadow.getElementById('loadingProgress');

  const meterArc = shadow.getElementById('meterArc');
  const meterScore = shadow.getElementById('meterScore');
  const meterGrade = shadow.getElementById('meterGrade');
  const meterVerdict = shadow.getElementById('meterVerdict');
  const catsContainer = shadow.getElementById('catsContainer');
  const findingsContainer = shadow.getElementById('findingsContainer');

  const copySummaryBtn = shadow.getElementById('copySummaryBtn');
  const copyLabel = shadow.getElementById('copyLabel');
  const reanalyzeSliderBtn = shadow.getElementById('reanalyzeSliderBtn');
  const errorText = shadow.getElementById('errorText');
  const retrySliderBtn = shadow.getElementById('retrySliderBtn');

  // ===== STATE =====
  let currentResults = null;
  let loadingInterval = null;
  let isOpen = false;

  hdrDomainEl.textContent = getDomain(window.location.href);

  function showView(targetView) {
    [viewIdle, viewLoading, viewResults, viewError].forEach(v => {
      v.classList.toggle('hidden', v !== targetView);
    });
  }

  function openSlider() {
    isOpen = true;
    sliderEl.classList.add('open');
    if (bannerEl) bannerEl.classList.remove('visible');
  }

  function closeSlider() {
    isOpen = false;
    sliderEl.classList.remove('open');
  }

  function toggleSlider() {
    if (isOpen) closeSlider(); else openSlider();
  }

  // Scanner animation
  const decodeMsgs = [
    'Scanning document fine print…',
    'Finding data monetization permissions…',
    'Evaluating AI model training clauses…',
    'Checking third-party retention windows…'
  ];

  function startScannerAnimation() {
    let step = 0;
    loadingMsg.textContent = decodeMsgs[0];
    loadingProgress.style.width = '15%';
    loadingInterval = setInterval(() => {
      step = Math.min(step + 1, decodeMsgs.length - 1);
      loadingMsg.textContent = decodeMsgs[step];
      loadingProgress.style.width = `${25 + step * 20}%`;
    }, 2000);
  }

  function stopScannerAnimation() {
    if (loadingInterval) { clearInterval(loadingInterval); loadingInterval = null; }
    loadingProgress.style.width = '100%';
  }

  // Render Category Breakdown Cards
  function renderCategories(clauses, verdictText) {
    catsContainer.innerHTML = '';
    const cats = extractCategories(clauses, verdictText);

    cats.forEach(c => {
      const card = document.createElement('div');
      card.className = 'cat-card';

      const riskLabel = c.risk.toUpperCase();

      card.innerHTML = `
        <div class="cat-top">
          <div class="cat-title-group">
            <span>${c.icon}</span>
            <span>${escapeHtml(c.title)}</span>
          </div>
          <span class="cat-badge ${c.risk}">${riskLabel}</span>
        </div>
        <div class="cat-summary">${escapeHtml(c.summary)}</div>
      `;
      catsContainer.appendChild(card);
    });
  }

  // Render 3 Concise Summary Bullets
  function renderVerdictBullets(verdictData) {
    meterVerdict.innerHTML = '';
    let bullets = [];

    if (Array.isArray(verdictData)) {
      bullets = verdictData.map(b => String(b).trim()).filter(Boolean);
    } else if (typeof verdictData === 'string') {
      bullets = verdictData
        .split(/\r?\n|\. /)
        .map(b => b.replace(/^[-•*]\s*/, '').trim())
        .filter(Boolean);
    }

    if (bullets.length === 0) bullets = ['Summary unavailable for this document.'];

    while (bullets.length < 3) {
      if (bullets.length === 1) bullets.push('Review category risk breakdown below.');
      else if (bullets.length === 2) bullets.push('Check user data rights and arbitration clauses.');
    }

    // Strictly cap at first 3 bullets, max 20 words each
    bullets.slice(0, 3).forEach(bullet => {
      const words = bullet.split(/\s+/);
      const cleanText = words.length > 20 ? words.slice(0, 20).join(' ') + '…' : bullet;
      const li = document.createElement('li');
      li.className = 'verdict-bullet-item';
      li.textContent = cleanText;
      meterVerdict.appendChild(li);
    });
  }

  // Render Full Results
  function renderResults(data) {
    currentResults = data;
    showView(viewResults);

    const score = data.score || 0;
    const info = getRiskInfo(score);
    const circumference = 238.8;
    const offset = circumference - (score / 100) * circumference;

    meterArc.style.stroke = info.color;
    setTimeout(() => { meterArc.style.strokeDashoffset = offset; }, 60);

    let cur = 0;
    const step = score / (800 / 16);
    const counter = setInterval(() => {
      cur = Math.min(cur + step, score);
      meterScore.textContent = Math.round(cur);
      if (cur >= score) clearInterval(counter);
    }, 16);

    meterGrade.textContent = info.text;
    meterGrade.className = `orb-grade ${info.cls}`;

    // Render strictly 3 concise summary bullets
    renderVerdictBullets(data.verdict);

    const verdictTextStr = Array.isArray(data.verdict) ? data.verdict.join(' ') : (data.verdict || '');
    renderCategories(data.clauses || [], verdictTextStr);

    // Detailed Findings
    findingsContainer.innerHTML = '';
    const clauses = data.clauses || [];
    const riskLabels = { high: 'HIGH', medium: 'MED', low: 'LOW' };

    clauses.forEach((c, idx) => {
      const row = document.createElement('div');
      row.className = 'finding-row';
      const numStr = (idx + 1).toString().padStart(2, '0');

      row.innerHTML = `
        <span class="finding-idx">${numStr}</span>
        <div class="finding-risk-bar">
          <div class="risk-level-bar"><div class="risk-level-fill ${c.risk}"></div></div>
          <span class="risk-level-label ${c.risk}">${riskLabels[c.risk] || ''}</span>
        </div>
        <div class="finding-content">
          <div class="finding-title">${escapeHtml(c.title)}</div>
          <div class="finding-detail">${escapeHtml(c.detail)}</div>
        </div>
      `;
      findingsContainer.appendChild(row);
    });

    // Update pill badge
    pillBadgeEl.textContent = score;
    pillBadgeEl.className = `pill-badge ${info.risk}`;
    pillBadgeEl.classList.remove('hidden');
  }

  // Run AI Analysis with Content-Hash Caching for 100% Score Determinism
  async function runAnalysis(forceFresh = false) {
    openSlider();

    const extracted = extractPageText();
    if (extracted.text.length < 100) {
      errorText.textContent = 'Not enough text found to analyze on this page.';
      showView(viewError);
      return;
    }

    const pageKey = getPageKey(window.location.href);
    const contentHash = simpleHash(extracted.text);

    // Check Content Hash Cache first to avoid score drift on re-analyze
    if (!forceFresh) {
      const dataStore = await chrome.storage.local.get('tldr_analyses');
      const history = dataStore.tldr_analyses || {};
      const cached = history[pageKey];

      if (cached && cached.contentHash === contentHash && cached.score !== undefined) {
        renderResults(cached);
        return;
      }
    }

    showView(viewLoading);
    startScannerAnimation();

    try {
      const storage = await chrome.storage.sync.get(['groqApiKey', 'geminiApiKey']);
      const apiKey = storage.groqApiKey || storage.geminiApiKey;

      if (!apiKey) {
        stopScannerAnimation();
        errorText.textContent = 'Please configure your API key in extension settings.';
        showView(viewError);
        return;
      }

      const res = await chrome.runtime.sendMessage({
        action: 'ANALYZE_TOS',
        tosText: extracted.text,
        pageTitle: extracted.title,
        pageUrl: extracted.url,
        apiKey
      });

      stopScannerAnimation();

      if (!res?.success) {
        throw new Error(res?.error || 'Analysis failed. Please try again.');
      }

      // Save to cache
      const dataStore = await chrome.storage.local.get('tldr_analyses');
      const history = dataStore.tldr_analyses || {};
      history[pageKey] = {
        pageKey,
        domain: getDomain(window.location.href),
        url: window.location.href,
        pageTitle: extracted.title,
        score: res.data.score,
        verdict: res.data.verdict,
        clauses: res.data.clauses,
        riskLevel: res.data.score <= 30 ? 'high' : res.data.score <= 60 ? 'medium' : 'low',
        analyzedAt: Date.now(),
        contentHash
      };
      await chrome.storage.local.set({ tldr_analyses: history });

      renderResults(res.data);

    } catch (err) {
      stopScannerAnimation();
      errorText.textContent = err.message || 'An unexpected error occurred.';
      showView(viewError);
    }
  }

  function copySummary() {
    if (!currentResults) return;
    const labels = { high: '🔴 HIGH', medium: '🟠 MEDIUM', low: '🟢 LOW' };
    const verdictText = Array.isArray(currentResults.verdict) ? currentResults.verdict.join('\n• ') : currentResults.verdict;
    let text = `TL;DR Privacy Analysis (${getDomain(window.location.href)})\nPrivacy Score: ${currentResults.score}/100\n\n• ${verdictText}\n\n`;
    (currentResults.clauses || []).forEach(c => {
      text += `${labels[c.risk] || c.risk} — ${c.title}\n${c.detail}\n\n`;
    });
    text += `— TL;DR Privacy Extension`;

    navigator.clipboard.writeText(text).then(() => {
      copyLabel.textContent = 'Copied!';
      copySummaryBtn.classList.add('copied');
      setTimeout(() => {
        copyLabel.textContent = 'Copy';
        copySummaryBtn.classList.remove('copied');
      }, 1800);
    });
  }

  // Initial Check
  async function checkCachedAnalysis() {
    const pageKey = getPageKey(window.location.href);
    const dataStore = await chrome.storage.local.get('tldr_analyses');
    const history = dataStore.tldr_analyses || {};
    const saved = history[pageKey];
    const isLegal = isPrivacyPage();

    if (saved && saved.score !== undefined) {
      const info = getRiskInfo(saved.score);
      pillBadgeEl.textContent = saved.score;
      pillBadgeEl.className = `pill-badge ${info.risk}`;
      pillBadgeEl.classList.remove('hidden');
      renderResults(saved);
    } else {
      if (isLegal) {
        idleTitle.textContent = 'Privacy Policy Detected';
        idleSub.textContent = 'Ready to decode privacy signals & 5 category pillars';

        chrome.storage.sync.get({ showBanner: true }, (res) => {
          if (res.showBanner) {
            bannerText.textContent = `Privacy Policy Detected on ${getDomain(window.location.href)}`;
            setTimeout(() => { bannerEl.classList.add('visible'); }, 1200);
          }
        });
      } else {
        idleTitle.textContent = 'Legal Policy Check';
        idleSub.textContent = 'You can try analyzing this page for terms';
      }
      showView(viewIdle);
    }
  }

  // Event Listeners
  pillEl.addEventListener('click', toggleSlider);
  closeBtn.addEventListener('click', closeSlider);
  minimizeBtn.addEventListener('click', closeSlider);

  bannerOpenBtn?.addEventListener('click', () => { runAnalysis(false); });
  bannerCloseBtn?.addEventListener('click', () => { bannerEl.classList.remove('visible'); });

  startAnalyzeBtn.addEventListener('click', () => runAnalysis(false));
  reanalyzeSliderBtn.addEventListener('click', () => runAnalysis(true));
  retrySliderBtn.addEventListener('click', () => runAnalysis(true));
  copySummaryBtn.addEventListener('click', copySummary);

  // Runtime message handlers
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.action === 'EXTRACT_TEXT') {
      try {
        const result = extractPageText();
        result.isPrivacyPage = isPrivacyPage();
        sendResponse({ success: true, data: result });
      } catch (error) {
        sendResponse({ success: false, error: error.message });
      }
      return true;
    }

    if (message.action === 'CHECK_PAGE') {
      sendResponse({ isPrivacyPage: isPrivacyPage() });
      return true;
    }

    if (message.action === 'TOGGLE_SLIDER') {
      if (message.forceOpen) {
        openSlider();
        if (message.startAnalysis) {
          runAnalysis(false);
        }
      } else {
        toggleSlider();
      }
      sendResponse({ success: true, isOpen });
      return true;
    }
  });

  checkCachedAnalysis();
})();
