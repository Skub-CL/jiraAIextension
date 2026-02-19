/**
 * BlockBase – base class for all injected AI blocks.
 *
 * Subclasses must implement:
 *   analyze()  – triggers the LLM call and calls showContent(html) on success
 *
 * Lifecycle:
 *   new BlockSomething(issueKey)
 *   .attach(anchorEl, 'afterend')  →  injects DOM, shows skeleton, calls analyze()
 */
window.JiraLLM = window.JiraLLM || {};

window.JiraLLM.BlockBase = class BlockBase {
  /**
   * @param {string} id      Unique DOM id for this block
   * @param {string} title   Display title shown in the block header
   * @param {string} issueKey  e.g. "PRJ-123"
   */
  constructor(id, title, issueKey) {
    this.id = id;
    this.title = title;
    this.issueKey = issueKey;
    this.container = null;
    this.contentEl = null;
    this.isCollapsed = false;
  }

  /**
   * Inject block into the DOM after/before anchorEl and start analysis.
   * @param {Element} anchorEl
   * @param {'afterend'|'beforebegin'|'afterbegin'|'beforeend'} position
   */
  attach(anchorEl, position = 'afterend') {
    // Remove any stale block from a previous navigation
    const existing = document.getElementById(this.id);
    if (existing) existing.remove();

    const wrapper = document.createElement('div');
    wrapper.id = this.id;
    wrapper.className = 'jira-llm-block';
    wrapper.innerHTML = this._headerHTML() + this._skeletonHTML();
    anchorEl.insertAdjacentElement(position, wrapper);

    this.container = wrapper;
    this.contentEl = wrapper.querySelector('.jira-llm-block-content');

    this._bindEvents();
    this._restoreCollapseState();
    this.analyze();
  }

  // ── To be overridden ────────────────────────────────────────────────────────
  analyze() {
    throw new Error(`${this.constructor.name}.analyze() not implemented`);
  }

  // ── Display helpers ─────────────────────────────────────────────────────────
  showSkeleton() {
    this.contentEl.innerHTML = this._skeletonHTML();
  }

  showError(message) {
    this.contentEl.innerHTML =
      `<div class="jira-llm-error">
        <span class="jira-llm-error-icon">⚠️</span>
        <span>${this._esc(message)}</span>
      </div>`;
  }

  showContent(html) {
    this.contentEl.innerHTML = html;
  }

  remove() {
    this.container?.remove();
  }

  // ── Toggle ──────────────────────────────────────────────────────────────────
  toggle() {
    this.isCollapsed ? this._expand() : this._collapse();
  }

  _collapse() {
    this.isCollapsed = true;
    this.contentEl.style.display = 'none';
    const btn = this.container.querySelector('.jira-llm-toggle-btn');
    if (btn) { btn.textContent = '▼'; btn.title = 'Einblenden'; }
    sessionStorage.setItem(`jlla-${this.id}`, '1');
  }

  _expand() {
    this.isCollapsed = false;
    this.contentEl.style.display = '';
    const btn = this.container.querySelector('.jira-llm-toggle-btn');
    if (btn) { btn.textContent = '▲'; btn.title = 'Ausblenden'; }
    sessionStorage.setItem(`jlla-${this.id}`, '0');
  }

  _restoreCollapseState() {
    if (sessionStorage.getItem(`jlla-${this.id}`) === '1') {
      this._collapse();
    }
  }

  // ── Copy ────────────────────────────────────────────────────────────────────
  _copy() {
    const text = this.contentEl?.innerText || '';
    navigator.clipboard.writeText(text).catch(() => {
      const ta = document.createElement('textarea');
      ta.value = text;
      Object.assign(ta.style, { position: 'fixed', opacity: '0' });
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      ta.remove();
    });
    const btn = this.container.querySelector('.jira-llm-copy-btn');
    if (btn) {
      btn.textContent = '✓';
      setTimeout(() => { btn.textContent = '📋'; }, 2000);
    }
  }

  // ── Events ──────────────────────────────────────────────────────────────────
  _bindEvents() {
    this.container.querySelector('.jira-llm-toggle-btn')
      ?.addEventListener('click', () => this.toggle());
    this.container.querySelector('.jira-llm-copy-btn')
      ?.addEventListener('click', () => this._copy());
    this.container.querySelector('.jira-llm-reload-btn')
      ?.addEventListener('click', () => { this.showSkeleton(); this.analyze(); });
  }

  // ── Message passing to service worker ───────────────────────────────────────
  _send(data) {
    return new Promise((resolve, reject) => {
      chrome.runtime.sendMessage(data, (response) => {
        if (chrome.runtime.lastError) {
          reject(new Error(chrome.runtime.lastError.message));
          return;
        }
        if (response?.success === false) {
          reject(new Error(response.error || 'Unbekannter Fehler'));
          return;
        }
        resolve(response);
      });
    });
  }

  // ── HTML helpers ─────────────────────────────────────────────────────────────
  _headerHTML() {
    return `
      <div class="jira-llm-block-header">
        <span class="jira-llm-block-icon">🤖</span>
        <span class="jira-llm-block-title">${this._esc(this.title)}</span>
        <div class="jira-llm-block-actions">
          <button class="jira-llm-btn-icon jira-llm-copy-btn" title="Kopieren">📋</button>
          <button class="jira-llm-btn-icon jira-llm-reload-btn" title="Neu laden">↺</button>
          <button class="jira-llm-btn-icon jira-llm-toggle-btn" title="Ausblenden">▲</button>
        </div>
      </div>
      <div class="jira-llm-block-content">`;
  }

  _skeletonHTML() {
    // The content el wrapping is closed here
    return `
        <div class="jira-llm-skeleton">
          <div class="jira-llm-skeleton-line"></div>
          <div class="jira-llm-skeleton-line"></div>
          <div class="jira-llm-skeleton-line jira-llm-skeleton-short"></div>
        </div>
      </div>`;
  }

  _esc(str) {
    const d = document.createElement('div');
    d.textContent = String(str);
    return d.innerHTML;
  }

  /** Convert LLM plain-text output to simple HTML (paragraphs + bullet points). */
  _textToHtml(text) {
    const lines = String(text).split('\n');
    let html = '';
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed) {
        html += '<br>';
      } else if (/^[-*•]\s+/.test(trimmed)) {
        html += `<div class="jira-llm-list-item">• ${this._esc(trimmed.replace(/^[-*•]\s+/, ''))}</div>`;
      } else if (/^\d+\.\s+/.test(trimmed)) {
        html += `<div class="jira-llm-list-item">${this._esc(trimmed)}</div>`;
      } else if (/^#{1,3}\s+/.test(trimmed)) {
        const level = trimmed.match(/^(#+)/)[1].length;
        const headingText = trimmed.replace(/^#+\s+/, '');
        html += `<div class="jira-llm-heading jira-llm-h${level}">${this._esc(headingText)}</div>`;
      } else {
        html += `<p>${this._esc(trimmed)}</p>`;
      }
    }
    return html;
  }
};
