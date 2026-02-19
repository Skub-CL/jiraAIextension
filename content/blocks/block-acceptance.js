/**
 * BlockAcceptance – evaluates acceptance criteria using INVEST/quality dimensions.
 * Injected directly below the acceptance criteria field.
 */
window.JiraLLM = window.JiraLLM || {};

window.JiraLLM.BlockAcceptance = class BlockAcceptance extends window.JiraLLM.BlockBase {
  constructor(issueKey) {
    super(`jlla-acceptance-${issueKey}`, 'KI-Bewertung der Akzeptanzkriterien', issueKey);
  }

  async analyze() {
    try {
      const response = await this._send({
        action: 'analyzeIssue',
        feature: 'acceptance',
        issueKey: this.issueKey
      });
      this.showContent(this._renderAcceptance(response.result));
    } catch (err) {
      this.showError(err.message);
    }
  }

  /**
   * Renders the LLM response with a quality badge if a rating keyword is found.
   */
  _renderAcceptance(text) {
    const lower = text.toLowerCase();
    let badge = '';
    if (lower.includes('gut')) {
      badge = '<span class="jira-llm-badge jira-llm-badge-good">✅ gut</span>';
    } else if (lower.includes('ausreichend')) {
      badge = '<span class="jira-llm-badge jira-llm-badge-ok">⚠️ ausreichend</span>';
    } else if (lower.includes('überarbeitungsbedürftig') || lower.includes('kritisch')) {
      badge = '<span class="jira-llm-badge jira-llm-badge-bad">❌ überarbeitungsbedürftig</span>';
    }

    return `${badge}${this._textToHtml(text)}`;
  }
};
