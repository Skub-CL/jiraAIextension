/**
 * Injector – finds DOM anchor points in Jira and injects 🤖 trigger buttons.
 *
 * On first click of a trigger button, the corresponding block is created and
 * attached to the DOM. Subsequent clicks on the trigger do nothing (the block
 * has its own ↺ reload button).
 *
 * Injection points (Jira Data Center selectors):
 *   - Title area      → Summary block
 *   - AK field        → Acceptance criteria block
 *   - Subtasks        → Subtask suggestions block
 *   - Activity area   → Comment analysis block
 *
 * The acceptanceCriteriaFieldId selector is loaded from settings so that
 * the correct custom field is targeted.
 */
window.JiraLLM = window.JiraLLM || {};

window.JiraLLM.Injector = class Injector {
  constructor(issueKey, settings) {
    this.issueKey = issueKey;
    this.settings = settings;
    this._blocks = [];
    this._buttons = [];
  }

  /**
   * Find all Jira anchor points and inject trigger buttons.
   * Safe to call multiple times (idempotent – checks for existing buttons).
   */
  inject() {
    this._injectSummary();
    this._injectAcceptance();
    this._injectSubtasks();
    this._injectComments();
  }

  /** Remove all injected elements (called on SPA navigation). */
  cleanup() {
    this._blocks.forEach(b => b.remove());
    this._buttons.forEach(btn => btn.remove());
    this._blocks = [];
    this._buttons = [];
    // Also remove any open dialogs
    document.querySelectorAll('[id^="jlla-dialog-"]').forEach(el => el.remove());
  }

  // ── Individual injection points ──────────────────────────────────────────────

  _injectSummary() {
    // Jira Data Center: issue title is in #summary-val or h1[data-field-id="summary"]
    const anchor = document.querySelector('#summary-val, h1[data-field-id="summary"], .issue-header-content');
    if (!anchor || document.getElementById('jlla-trigger-summary')) return;

    const btn = this._makeButton('jlla-trigger-summary', 'KI-Zusammenfassung anzeigen');
    btn.addEventListener('click', () => {
      btn.remove();
      const block = new window.JiraLLM.BlockSummary(this.issueKey);
      this._blocks.push(block);
      block.attach(anchor, 'afterend');
    });
    anchor.insertAdjacentElement('afterend', btn);
    this._buttons.push(btn);
  }

  _injectAcceptance() {
    const fieldId = this.settings.acceptanceCriteriaFieldId;
    if (!fieldId) return;

    // Try data-field-id attribute first, then by known custom field patterns
    const anchor = document.querySelector(
      `[data-field-id="${fieldId}"], #${fieldId}-val, #${fieldId}`
    );
    if (!anchor || document.getElementById('jlla-trigger-acceptance')) return;

    const btn = this._makeButton('jlla-trigger-acceptance', 'Akzeptanzkriterien bewerten');
    btn.addEventListener('click', () => {
      btn.remove();
      const block = new window.JiraLLM.BlockAcceptance(this.issueKey);
      this._blocks.push(block);
      block.attach(anchor, 'afterend');
    });

    // Try to find the section heading to place the button there
    const heading = anchor.closest('.module, .field-group')
      ?.querySelector('h3, .mod-header, legend');
    if (heading) {
      heading.style.position = 'relative';
      heading.insertAdjacentElement('beforeend', btn);
    } else {
      anchor.insertAdjacentElement('beforebegin', btn);
    }
    this._buttons.push(btn);
  }

  _injectSubtasks() {
    // Jira DC: #subtasks-section or .issuePanelContainer containing "subtasks"
    const anchor = document.querySelector(
      '#subtasks-section, [data-panel-id="subtasks"], .issuePanelContainer.subtasks-panel'
    );
    if (!anchor || document.getElementById('jlla-trigger-subtasks')) return;

    const btn = this._makeButton('jlla-trigger-subtasks', 'Unteraufgaben vorschlagen');
    btn.addEventListener('click', () => {
      btn.remove();
      const block = new window.JiraLLM.BlockSubtasks(this.issueKey);
      this._blocks.push(block);
      block.attach(anchor, 'afterend');
      // For subtasks, immediately open dialog
      block._openDialog();
    });

    const heading = anchor.querySelector('h3, .mod-header, .panel-heading');
    if (heading) {
      heading.style.position = 'relative';
      heading.insertAdjacentElement('beforeend', btn);
    } else {
      anchor.insertAdjacentElement('beforebegin', btn);
    }
    this._buttons.push(btn);
  }

  _injectComments() {
    // Jira DC: #activity-stream, .activity-section, #issue-tabs
    const anchor = document.querySelector(
      '#activity-stream, .activity-section, #issue-tabs, [data-panel-id="activity"]'
    );
    if (!anchor || document.getElementById('jlla-trigger-comments')) return;

    const btn = this._makeButton('jlla-trigger-comments', 'Kommentare analysieren');
    btn.addEventListener('click', () => {
      btn.remove();
      const block = new window.JiraLLM.BlockComments(this.issueKey);
      this._blocks.push(block);
      block.attach(anchor, 'beforebegin');
    });

    const heading = anchor.querySelector('h3, .mod-header, .panel-heading');
    if (heading) {
      heading.style.position = 'relative';
      heading.insertAdjacentElement('beforeend', btn);
    } else {
      anchor.insertAdjacentElement('beforebegin', btn);
    }
    this._buttons.push(btn);
  }

  // ── Helper ────────────────────────────────────────────────────────────────────
  _makeButton(id, title) {
    const btn = document.createElement('button');
    btn.id = id;
    btn.className = 'jira-llm-trigger-btn';
    btn.title = title;
    btn.textContent = '🤖';
    return btn;
  }
};
