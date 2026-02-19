/**
 * BlockSubtasks – suggests subtasks via LLM, lets user create them in Jira.
 *
 * Flow:
 *   1. User clicks 🤖 icon → prompt dialog opens (editable template)
 *   2. User clicks "Starten" → skeleton shown, LLM call sent
 *   3. Results rendered as checkboxes with individual "Anlegen" buttons
 *   4. "Alle anlegen" creates all at once
 */
window.JiraLLM = window.JiraLLM || {};

window.JiraLLM.BlockSubtasks = class BlockSubtasks extends window.JiraLLM.BlockBase {
  constructor(issueKey) {
    super(`jlla-subtasks-${issueKey}`, 'KI-Vorschläge für Unteraufgaben', issueKey);
    this._subtasks = []; // parsed LLM result
    this._defaultPrompt = null; // loaded from settings
    this._customPrompt = null;  // user-edited version
  }

  // Override attach: show prompt dialog first, don't call analyze() immediately
  attach(anchorEl, position = 'afterend') {
    const existing = document.getElementById(this.id);
    if (existing) existing.remove();

    const wrapper = document.createElement('div');
    wrapper.id = this.id;
    wrapper.className = 'jira-llm-block';
    wrapper.innerHTML = this._headerHTML() +
      `<div class="jira-llm-placeholder">
        Klicke auf ↺, um neue Vorschläge zu laden.
       </div>
      </div>`;

    anchorEl.insertAdjacentElement(position, wrapper);
    this.container = wrapper;
    this.contentEl = wrapper.querySelector('.jira-llm-block-content');
    this._bindEvents();
    this._restoreCollapseState();

    // Override reload button to open dialog instead of re-running directly
    this.container.querySelector('.jira-llm-reload-btn')
      ?.removeEventListener('click', this._reloadHandler);
    this.container.querySelector('.jira-llm-reload-btn')
      ?.addEventListener('click', () => this._openDialog());
  }

  // analyze() is called after dialog confirms
  async analyze(customPrompt) {
    this.showSkeleton();
    try {
      const response = await this._send({
        action: 'analyzeIssue',
        feature: 'subtasks',
        issueKey: this.issueKey,
        customPrompt: customPrompt || null
      });
      this._subtasks = this._parseSubtasks(response.result);
      this.showContent(this._renderSubtasks());
      this._bindSubtaskActions();
    } catch (err) {
      this.showError(err.message);
    }
  }

  // ── Prompt dialog ────────────────────────────────────────────────────────────
  async _openDialog() {
    // Fetch default prompt from service worker settings
    if (!this._defaultPrompt) {
      try {
        const res = await this._send({ action: 'getSettings' });
        this._defaultPrompt = res.settings?.promptSubtasksCustom || '';
      } catch (_) {
        this._defaultPrompt = '';
      }
    }

    const dialogId = `jlla-dialog-${this.issueKey}`;
    const existing = document.getElementById(dialogId);
    if (existing) existing.remove();

    const dialog = document.createElement('div');
    dialog.id = dialogId;
    dialog.className = 'jira-llm-dialog-overlay';
    dialog.innerHTML = `
      <div class="jira-llm-dialog">
        <div class="jira-llm-dialog-header">
          <span>🤖 Unteraufgaben generieren</span>
          <button class="jira-llm-btn-icon jira-llm-dialog-close" title="Schließen">✕</button>
        </div>
        <div class="jira-llm-dialog-body">
          <label class="jira-llm-dialog-label">Prompt anpassen:</label>
          <textarea class="jira-llm-dialog-textarea" rows="10">${this._esc(this._defaultPrompt)}</textarea>
          <p class="jira-llm-dialog-hint">
            Platzhalter: <code>{issueKey}</code>, <code>{summary}</code>, <code>{issuetype}</code>,
            <code>{description}</code>, <code>{acceptanceCriteria}</code>, <code>{existingSubtasks}</code>
          </p>
        </div>
        <div class="jira-llm-dialog-footer">
          <button class="jira-llm-btn jira-llm-btn-secondary jira-llm-dialog-reset">🔄 Vorlage zurücksetzen</button>
          <div>
            <button class="jira-llm-btn jira-llm-btn-secondary jira-llm-dialog-cancel">Abbrechen</button>
            <button class="jira-llm-btn jira-llm-btn-primary jira-llm-dialog-start">Starten</button>
          </div>
        </div>
      </div>`;

    document.body.appendChild(dialog);

    const textarea = dialog.querySelector('.jira-llm-dialog-textarea');
    const close = () => dialog.remove();

    dialog.querySelector('.jira-llm-dialog-close').addEventListener('click', close);
    dialog.querySelector('.jira-llm-dialog-cancel').addEventListener('click', close);
    dialog.addEventListener('click', (e) => { if (e.target === dialog) close(); });

    dialog.querySelector('.jira-llm-dialog-reset').addEventListener('click', async () => {
      // Clear saved custom prompt, restore built-in default
      await chrome.storage.sync.remove('promptSubtasksCustom');
      this._defaultPrompt = '';
      textarea.value = '';
    });

    dialog.querySelector('.jira-llm-dialog-start').addEventListener('click', async () => {
      const prompt = textarea.value.trim();
      // Save custom prompt for next time
      if (prompt) {
        await chrome.storage.sync.set({ promptSubtasksCustom: prompt });
        this._defaultPrompt = prompt;
      }
      close();
      this.analyze(prompt || null);
    });
  }

  // ── Parse LLM JSON output ────────────────────────────────────────────────────
  _parseSubtasks(raw) {
    try {
      // The LLM may wrap the JSON in a code block
      const jsonStr = raw.replace(/```json\s*/gi, '').replace(/```\s*/g, '').trim();
      const arr = JSON.parse(jsonStr);
      if (Array.isArray(arr)) return arr;
    } catch (_) {
      // Fallback: treat as raw text
    }
    // If JSON parsing failed, return a single item with the raw text
    return [{ summary: 'LLM-Antwort (kein JSON)', description: raw }];
  }

  // ── Render subtask list ──────────────────────────────────────────────────────
  _renderSubtasks() {
    if (!this._subtasks.length) {
      return '<p>Keine Unteraufgaben vorgeschlagen.</p>';
    }
    const items = this._subtasks.map((s, i) => `
      <div class="jira-llm-subtask-row" data-index="${i}">
        <label class="jira-llm-subtask-label">
          <input type="checkbox" class="jira-llm-subtask-cb" checked>
          <span class="jira-llm-subtask-summary">${this._esc(s.summary)}</span>
          ${s.description ? `<span class="jira-llm-subtask-desc">${this._esc(s.description)}</span>` : ''}
        </label>
        <button class="jira-llm-btn jira-llm-btn-small jira-llm-subtask-create-one" data-index="${i}">
          + Anlegen
        </button>
        <span class="jira-llm-subtask-status"></span>
      </div>`).join('');

    return `
      <div class="jira-llm-subtask-list">${items}</div>
      <div class="jira-llm-subtask-footer">
        <button class="jira-llm-btn jira-llm-btn-primary jira-llm-subtask-create-all">
          ✓ Alle anlegen
        </button>
      </div>`;
  }

  // ── Bind subtask create actions ──────────────────────────────────────────────
  _bindSubtaskActions() {
    this.contentEl.querySelectorAll('.jira-llm-subtask-create-one').forEach(btn => {
      btn.addEventListener('click', async () => {
        const idx = parseInt(btn.dataset.index, 10);
        await this._createOne(idx);
      });
    });

    this.contentEl.querySelector('.jira-llm-subtask-create-all')
      ?.addEventListener('click', async () => {
        const rows = this.contentEl.querySelectorAll('.jira-llm-subtask-row');
        for (const row of rows) {
          const cb = row.querySelector('.jira-llm-subtask-cb');
          if (cb?.checked) {
            await this._createOne(parseInt(row.dataset.index, 10));
          }
        }
      });
  }

  async _createOne(index) {
    const subtask = this._subtasks[index];
    const row = this.contentEl.querySelector(`.jira-llm-subtask-row[data-index="${index}"]`);
    const statusEl = row?.querySelector('.jira-llm-subtask-status');
    const btn = row?.querySelector('.jira-llm-subtask-create-one');

    if (!row || !statusEl) return;
    if (btn) btn.disabled = true;
    statusEl.textContent = '⏳ Wird angelegt…';

    try {
      const res = await this._send({
        action: 'createSubtask',
        issueKey: this.issueKey,
        summary: subtask.summary,
        description: subtask.description || ''
      });
      statusEl.textContent = `✅ ${res.createdKey}`;
      statusEl.className = 'jira-llm-subtask-status jira-llm-status-ok';
    } catch (err) {
      statusEl.textContent = `❌ Fehler: ${err.message}`;
      statusEl.className = 'jira-llm-subtask-status jira-llm-status-err';
      if (btn) btn.disabled = false;
    }
  }
};
