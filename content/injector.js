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
    if (!anchor || document.getElementById('jlla-trigger-summary')
        || document.getElementById(`jlla-summary-${this.issueKey}`)) return;

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
    const rawId = this.settings.acceptanceCriteriaFieldId;
    if (!rawId) return;

    // Normalise: user may enter "10112" or "customfield_10112" – both must work
    const fieldId = /^\d+$/.test(rawId.trim()) ? `customfield_${rawId.trim()}` : rawId.trim();

    // Use [id="..."] attribute selectors instead of #id notation to avoid
    // invalid CSS selectors when the id starts with a digit.
    const anchor = document.querySelector([
      `[data-field-id="${fieldId}"]`,
      `[id="${fieldId}-val"]`,
      `[id="${fieldId}"]`,
      `[id="${fieldId}-field"]`,
      `td[data-field-id="${fieldId}"]`,
      `[class~="${fieldId}"]`
    ].join(', ')) || this._findByLabelText(['akzeptanzkriterien', 'acceptance criteria', 'abnahmekriterien']);

    if (!anchor || document.getElementById('jlla-trigger-acceptance')
        || document.getElementById(`jlla-acceptance-${this.issueKey}`)) return;

    const btn = this._makeButton('jlla-trigger-acceptance', 'Akzeptanzkriterien bewerten');
    btn.addEventListener('click', () => {
      btn.remove();
      const block = new window.JiraLLM.BlockAcceptance(this.issueKey);
      this._blocks.push(block);
      block.attach(anchor, 'afterend');
    });

    // Try to find the section heading to place the button inline
    const heading = anchor.closest('.module, .field-group, .row, tr')
      ?.querySelector('h3, .mod-header, legend, label, th, .field-label');
    if (heading) {
      heading.style.position = 'relative';
      heading.insertAdjacentElement('beforeend', btn);
    } else {
      anchor.insertAdjacentElement('beforebegin', btn);
    }
    this._buttons.push(btn);
  }

  _injectSubtasks() {
    // Jira DC has many DOM structures for the subtasks panel across versions
    const anchor = document.querySelector([
      '#subtasks-section',
      '#subtasks',
      '[data-panel-id="subtasks"]',
      '.issuePanelContainer.subtasks-panel',
      '.sub-tasks-panel',
      '[data-field-id="subtasks"]',
      '.subtask-section',
      '#subtasks-table',
      '.subTaskTable'
    ].join(', ')) || this._findPanelByHeading(['unteraufgaben', 'sub-task', 'subtask', 'sub-tasks']);

    if (!anchor || document.getElementById('jlla-trigger-subtasks')
        || document.getElementById(`jlla-subtasks-${this.issueKey}`)) return;

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
    const anchor = document.querySelector([
      '#activity-stream',
      '.activity-section',
      '#issue-tabs',
      '[data-panel-id="activity"]',
      '#comment-tabpanel',
      '.activity-container',
      '#activitymodule',
      '[data-module-key="com.atlassian.jira.jira-view-issue-plugin:activitymodule"]'
    ].join(', ')) || this._findPanelByHeading(['aktivität', 'activity', 'kommentare', 'comments']);

    if (!anchor || document.getElementById('jlla-trigger-comments')
        || document.getElementById(`jlla-comments-${this.issueKey}`)) return;

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

  // ── Helpers ───────────────────────────────────────────────────────────────────
  _makeButton(id, title) {
    const btn = document.createElement('button');
    btn.id = id;
    btn.className = 'jira-llm-trigger-btn';
    btn.title = title;
    btn.textContent = '🤖';
    return btn;
  }

  /**
   * Find a field element whose label text matches one of the given keywords (case-insensitive).
   * Useful for custom fields where the data-field-id selector doesn't match.
   */
  _findByLabelText(keywords) {
    const labels = document.querySelectorAll('label, th, .field-label, .fieldLabelArea, legend');
    for (const label of labels) {
      const text = label.textContent.toLowerCase().trim();
      if (keywords.some(kw => text.includes(kw))) {
        // Return the associated value element or the parent container
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

  /**
   * Find a panel/module whose heading text matches one of the given keywords.
   */
  _findPanelByHeading(keywords) {
    const headings = document.querySelectorAll('h3, h4, .mod-header, .panel-heading, .subpanel-title, legend');
    for (const h of headings) {
      const text = h.textContent.toLowerCase().trim();
      if (keywords.some(kw => text.includes(kw))) {
        return h.closest('.module, .panel, .issuePanelContainer, section, [class*="panel"]') || h.parentElement;
      }
    }
    return null;
  }
};
