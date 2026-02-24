/**
 * BlockSubtasks – suggests subtasks via LLM, lets user create them in Jira.
 *
 * Flow:
 *   1. User clicks "📋 Unteraufgaben vorschlagen" in the sidebar panel
 *   2. Skeleton shown, LLM call sent immediately (prompt from Options page)
 *   3. Results rendered as checkboxes with individual "Anlegen" buttons
 *   4. "Alle anlegen" creates all checked items at once
 *
 * The prompt template is configured in the extension's Options page and
 * stored in chrome.storage.sync (promptSubtasksCustom). No per-issue
 * dialog is shown.
 */
window.JiraLLM = window.JiraLLM || {};

window.JiraLLM.BlockSubtasks = class BlockSubtasks extends window.JiraLLM.BlockBase {
  constructor(issueKey) {
    super(`jlla-subtasks-${issueKey}`, 'KI-Vorschläge für Unteraufgaben', issueKey);
    this._subtasks = [];
  }

  async analyze() {
    this.showSkeleton();
    try {
      const response = await this._send({
        action: 'analyzeIssue',
        feature: 'subtasks',
        issueKey: this.issueKey
      });
      this._subtasks = this._parseSubtasks(response.result);
      this.showContent(this._renderSubtasks());
      this._bindSubtaskActions();
    } catch (err) {
      this.showError(err.message);
    }
  }

  // ── Parse LLM JSON output ────────────────────────────────────────────────────
  _parseSubtasks(raw) {
    try {
      const jsonStr = raw.replace(/```json\s*/gi, '').replace(/```\s*/g, '').trim();
      const arr = JSON.parse(jsonStr);
      if (Array.isArray(arr)) return arr;
    } catch (_) {
      // Fallback: treat as raw text
    }
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
        await this._createOne(parseInt(btn.dataset.index, 10));
      });
    });

    this.contentEl.querySelector('.jira-llm-subtask-create-all')
      ?.addEventListener('click', async () => {
        const rows = this.contentEl.querySelectorAll('.jira-llm-subtask-row');
        for (const row of rows) {
          if (row.querySelector('.jira-llm-subtask-cb')?.checked) {
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
