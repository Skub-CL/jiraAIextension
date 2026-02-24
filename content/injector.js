/**
 * Injector – places a single "KI-Assistent" panel in Jira's right sidebar
 * (below the "Agil" module) with four labelled buttons.
 *
 * Clicking a button creates the corresponding output block at the canonical
 * position inside the issue content area (unchanged from before):
 *   Summary     → directly below the issue title
 *   Acceptance  → directly below the acceptance-criteria field
 *   Subtasks    → directly below the subtasks section
 *   Comments    → directly above the activity / comments section
 *
 * inject() is idempotent and safe to call repeatedly.
 */
window.JiraLLM = window.JiraLLM || {};

window.JiraLLM.Injector = class Injector {
  constructor(issueKey, settings) {
    this.issueKey = issueKey;
    this.settings = settings;
    this._blocks = [];
    this._panel = null;
  }

  // ── Public API ────────────────────────────────────────────────────────────────

  inject() {
    this._injectPanel();
  }

  cleanup() {
    this._blocks.forEach(b => b.remove());
    this._panel?.remove();
    this._blocks = [];
    this._panel = null;
    document.querySelectorAll('[id^="jlla-dialog-"]').forEach(el => el.remove());
  }

  // ── Side panel ────────────────────────────────────────────────────────────────

  _injectPanel() {
    if (document.getElementById('jlla-panel')) return;

    const insertAfter = this._findAgilModule()
      || this._findPanelByHeading(['details', 'details'])
      || document.querySelector('#details-module, .details-module, #people-module');

    if (!insertAfter) return;

    const fieldId = this._normaliseFieldId(this.settings.acceptanceCriteriaFieldId || '');

    const panel = document.createElement('div');
    panel.id = 'jlla-panel';
    panel.className = 'module toggle-wrap jira-llm-side-panel';
    panel.innerHTML = `
      <div class="mod-header">
        <h3 class="toggle-title jira-llm-panel-title">🤖 KI-Assistent</h3>
      </div>
      <div class="mod-content jira-llm-panel-body">
        <button class="jira-llm-side-btn" id="jlla-btn-summary"
                title="Kompakte Zusammenfassung des Vorgangs erstellen">
          <span class="jira-llm-side-btn-icon">📝</span>
          <span class="jira-llm-side-btn-label">Zusammenfassung</span>
        </button>
        ${fieldId ? `
        <button class="jira-llm-side-btn" id="jlla-btn-acceptance"
                title="Akzeptanzkriterien nach Vollständigkeit, Testbarkeit und Eindeutigkeit bewerten">
          <span class="jira-llm-side-btn-icon">✅</span>
          <span class="jira-llm-side-btn-label">Akzeptanzkriterien&nbsp;bewerten</span>
        </button>` : ''}
        <button class="jira-llm-side-btn" id="jlla-btn-subtasks"
                title="Konkrete Unteraufgaben vom LLM vorschlagen lassen und direkt anlegen">
          <span class="jira-llm-side-btn-icon">📋</span>
          <span class="jira-llm-side-btn-label">Unteraufgaben&nbsp;vorschlagen</span>
        </button>
        <button class="jira-llm-side-btn" id="jlla-btn-comments"
                title="Offene Fragen, Entscheidungen, Risiken und Aktionspunkte aus Kommentaren extrahieren">
          <span class="jira-llm-side-btn-icon">💬</span>
          <span class="jira-llm-side-btn-label">Kommentare&nbsp;analysieren</span>
        </button>
      </div>`;

    insertAfter.insertAdjacentElement('afterend', panel);
    this._panel = panel;
    this._bindPanelButtons(panel);
  }

  _bindPanelButtons(panel) {
    panel.querySelector('#jlla-btn-summary')
      ?.addEventListener('click', () => this._activateSummary());
    panel.querySelector('#jlla-btn-acceptance')
      ?.addEventListener('click', () => this._activateAcceptance());
    panel.querySelector('#jlla-btn-subtasks')
      ?.addEventListener('click', () => this._activateSubtasks());
    panel.querySelector('#jlla-btn-comments')
      ?.addEventListener('click', () => this._activateComments());
  }

  // ── Block activators (find anchor → attach block at content position) ─────────

  _activateSummary() {
    if (document.getElementById(`jlla-summary-${this.issueKey}`)) return;
    const anchor = document.querySelector(
      '#summary-val, h1[data-field-id="summary"], .issue-header-content'
    );
    if (!anchor) { this._panelError('summary', 'Issue-Titel nicht im DOM gefunden.'); return; }

    this._markBtnActive('jlla-btn-summary');
    const block = new window.JiraLLM.BlockSummary(this.issueKey);
    this._blocks.push(block);
    block.attach(anchor, 'afterend');
  }

  _activateAcceptance() {
    if (document.getElementById(`jlla-acceptance-${this.issueKey}`)) return;
    const fieldId = this._normaliseFieldId(this.settings.acceptanceCriteriaFieldId || '');
    const anchor = fieldId
      ? (document.querySelector([
          `[data-field-id="${fieldId}"]`,
          `[id="${fieldId}-val"]`,
          `[id="${fieldId}"]`,
          `[id="${fieldId}-field"]`,
          `td[data-field-id="${fieldId}"]`,
          `[class~="${fieldId}"]`
        ].join(', ')) || this._findByLabelText(['akzeptanzkriterien', 'acceptance criteria', 'abnahmekriterien']))
      : this._findByLabelText(['akzeptanzkriterien', 'acceptance criteria', 'abnahmekriterien']);

    if (!anchor) { this._panelError('acceptance', 'Akzeptanzkriterien-Feld nicht gefunden.'); return; }

    this._markBtnActive('jlla-btn-acceptance');
    const block = new window.JiraLLM.BlockAcceptance(this.issueKey);
    this._blocks.push(block);
    block.attach(anchor, 'afterend');
  }

  _activateSubtasks() {
    if (document.getElementById(`jlla-subtasks-${this.issueKey}`)) return;
    const anchor = document.querySelector([
      '#subtasks-section', '#subtasks',
      '[data-panel-id="subtasks"]',
      '.issuePanelContainer.subtasks-panel',
      '.sub-tasks-panel',
      '[data-field-id="subtasks"]',
      '.subtask-section', '#subtasks-table', '.subTaskTable'
    ].join(', ')) || this._findPanelByHeading(['unteraufgaben', 'sub-task', 'subtask', 'sub-tasks']);

    if (!anchor) { this._panelError('subtasks', 'Unteraufgaben-Sektion nicht gefunden.'); return; }

    this._markBtnActive('jlla-btn-subtasks');
    const block = new window.JiraLLM.BlockSubtasks(this.issueKey);
    this._blocks.push(block);
    block.attach(anchor, 'afterend');
    block._openDialog();
  }

  _activateComments() {
    if (document.getElementById(`jlla-comments-${this.issueKey}`)) return;
    const anchor = document.querySelector([
      '#activity-stream', '.activity-section',
      '#issue-tabs', '[data-panel-id="activity"]',
      '#comment-tabpanel', '.activity-container',
      '#activitymodule',
      '[data-module-key="com.atlassian.jira.jira-view-issue-plugin:activitymodule"]'
    ].join(', ')) || this._findPanelByHeading(['aktivität', 'activity', 'kommentare', 'comments']);

    if (!anchor) { this._panelError('comments', 'Aktivitäts-Sektion nicht gefunden.'); return; }

    this._markBtnActive('jlla-btn-comments');
    const block = new window.JiraLLM.BlockComments(this.issueKey);
    this._blocks.push(block);
    block.attach(anchor, 'beforebegin');
  }

  // ── Panel helpers ─────────────────────────────────────────────────────────────

  /** Mark a button as active (already triggered) and disable it. */
  _markBtnActive(btnId) {
    const btn = document.getElementById(btnId);
    if (!btn) return;
    btn.classList.add('jira-llm-side-btn-active');
    btn.disabled = true;
    // Re-enable if block is later removed (e.g. on issue key change handled by cleanup)
  }

  /** Show a temporary error message below the relevant button in the panel. */
  _panelError(feature, message) {
    const body = this._panel?.querySelector('.jira-llm-panel-body');
    if (!body) return;
    const existing = body.querySelector('.jira-llm-panel-error');
    if (existing) existing.remove();
    const err = document.createElement('div');
    err.className = 'jira-llm-panel-error';
    err.textContent = `⚠️ ${message}`;
    body.appendChild(err);
    setTimeout(() => err.remove(), 6000);
  }

  // ── Right-column "Agil" module detection ─────────────────────────────────────

  _findAgilModule() {
    const byId = document.querySelector([
      '#greenhopper-agile-issue-web-panel',   // confirmed Jira DC selector
      '#greenhopper-agile-fields-module',
      '[id*="greenhopper-agile"]',
      '[data-module-key*="agile-issue-tracking"]',
      '[data-module-key*="greenhopper"]',
      '[id*="agile-fields"]'
    ].join(', '));
    if (byId) return byId;

    // Fallback: find module whose heading says "Agil" or "Agile"
    return this._findPanelByHeading(['agil', 'agile']);
  }

  // ── Generic DOM helpers ───────────────────────────────────────────────────────

  _normaliseFieldId(rawId) {
    if (!rawId) return '';
    return /^\d+$/.test(rawId.trim()) ? `customfield_${rawId.trim()}` : rawId.trim();
  }

  _findByLabelText(keywords) {
    const labels = document.querySelectorAll('label, th, .field-label, .fieldLabelArea, legend');
    for (const label of labels) {
      const text = label.textContent.toLowerCase().trim();
      if (keywords.some(kw => text.includes(kw))) {
        const forId = label.getAttribute('for');
        if (forId) {
          const target = document.getElementById(forId) || document.getElementById(`${forId}-val`);
          if (target) return target;
        }
        return label.closest('.field-group, .module, tr, .row') || label.nextElementSibling || label.parentElement;
      }
    }
    return null;
  }

  _findPanelByHeading(keywords) {
    const headings = document.querySelectorAll(
      'h3, h4, .mod-header, .panel-heading, .subpanel-title, legend, .toggle-title'
    );
    for (const h of headings) {
      const text = h.textContent.toLowerCase().trim();
      if (keywords.some(kw => text.includes(kw))) {
        return h.closest('.module, .panel, .issuePanelContainer, section, [class*="panel"]')
          || h.parentElement;
      }
    }
    return null;
  }
};
