/**
 * BlockComments – extracts open questions, decisions, risks and next steps
 * from all comments on the current issue.
 * Injected directly above the comment/activity list.
 */
window.JiraLLM = window.JiraLLM || {};

window.JiraLLM.BlockComments = class BlockComments extends window.JiraLLM.BlockBase {
  constructor(issueKey) {
    super(`jlla-comments-${issueKey}`, 'KI-Kommentar-Analyse', issueKey);
  }

  async analyze() {
    try {
      const response = await this._send({
        action: 'analyzeIssue',
        feature: 'comments',
        issueKey: this.issueKey
      });
      this.showContent(this._renderComments(response.result));
    } catch (err) {
      this.showError(err.message);
    }
  }

  /**
   * Renders the LLM output and adds collapsible sections per category.
   */
  _renderComments(text) {
    // Try to detect numbered categories in the output and make them collapsible
    const sections = this._parseSections(text);
    if (sections.length > 1) {
      return sections.map(s => this._renderSection(s)).join('');
    }
    // Fallback: plain text
    return this._textToHtml(text);
  }

  _parseSections(text) {
    // Match patterns like "1. Offene Fragen", "## Offene Fragen", "**Offene Fragen**"
    const sectionPattern = /(?:^|\n)(?:\d+\.\s+|#{1,3}\s+|\*{1,2})(.+?)(?:\*{1,2})?\n([\s\S]*?)(?=(?:\n(?:\d+\.\s+|#{1,3}\s+|\*{1,2})|$))/g;
    const sections = [];
    let match;
    while ((match = sectionPattern.exec(text)) !== null) {
      sections.push({ heading: match[1].trim(), body: match[2].trim() });
    }
    return sections;
  }

  _renderSection({ heading, body }) {
    const sectionId = `jlla-section-${Math.random().toString(36).slice(2)}`;
    const icon = this._sectionIcon(heading);
    return `
      <div class="jira-llm-comment-section">
        <button class="jira-llm-section-toggle" data-target="${sectionId}">
          ${icon} <strong>${this._esc(heading)}</strong> ▼
        </button>
        <div class="jira-llm-section-body" id="${sectionId}">
          ${this._textToHtml(body || '(Keine Einträge)')}
        </div>
      </div>`;
  }

  _sectionIcon(heading) {
    const lower = heading.toLowerCase();
    if (lower.includes('frage') || lower.includes('ungekl')) return '❓';
    if (lower.includes('entscheid')) return '✅';
    if (lower.includes('risik') || lower.includes('blocker')) return '⚠️';
    if (lower.includes('nächste') || lower.includes('action')) return '📋';
    return '•';
  }

  // Override showContent to also bind section toggles
  showContent(html) {
    super.showContent(html);
    this._bindSectionToggles();
  }

  _bindSectionToggles() {
    this.contentEl?.querySelectorAll('.jira-llm-section-toggle').forEach(btn => {
      btn.addEventListener('click', () => {
        const targetId = btn.dataset.target;
        const body = document.getElementById(targetId);
        if (!body) return;
        const collapsed = body.style.display === 'none';
        body.style.display = collapsed ? '' : 'none';
        btn.querySelector('strong').nextSibling.textContent = collapsed ? ' ▼' : ' ▶';
      });
    });
  }
};
