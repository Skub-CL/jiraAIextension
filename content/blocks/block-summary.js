/**
 * BlockSummary – shows a 3–5 sentence AI summary of the current issue.
 * Injected directly below the issue title.
 */
window.JiraLLM = window.JiraLLM || {};

window.JiraLLM.BlockSummary = class BlockSummary extends window.JiraLLM.BlockBase {
  constructor(issueKey) {
    super(`jlla-summary-${issueKey}`, 'KI-Zusammenfassung', issueKey);
  }

  async analyze() {
    try {
      const response = await this._send({
        action: 'analyzeIssue',
        feature: 'summary',
        issueKey: this.issueKey
      });
      this.showContent(this._textToHtml(response.result));
    } catch (err) {
      this.showError(err.message);
    }
  }
};
