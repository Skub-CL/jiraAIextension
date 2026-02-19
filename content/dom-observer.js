/**
 * DOMObserver – detects SPA navigation in Jira and re-triggers injection.
 *
 * Jira Data Center can navigate between issues without a full page reload.
 * We watch for URL changes and document title changes to detect this.
 */
window.JiraLLM = window.JiraLLM || {};

window.JiraLLM.DOMObserver = class DOMObserver {
  /**
   * @param {function(issueKey: string|null): void} onNavigate
   *   Called with the new issue key (or null if no issue page).
   */
  constructor(onNavigate) {
    this.onNavigate = onNavigate;
    this._lastUrl = location.href;
    this._observer = null;
  }

  start() {
    // Observe document.title changes as a proxy for SPA navigation
    this._observer = new MutationObserver(() => {
      if (location.href !== this._lastUrl) {
        this._lastUrl = location.href;
        this.onNavigate(window.JiraLLM.extractIssueKey(location.href));
      }
    });

    this._observer.observe(document.querySelector('title') || document.head, {
      subtree: true,
      characterData: true,
      childList: true
    });

    // Also handle pushState/replaceState navigation
    const origPush = history.pushState.bind(history);
    const origReplace = history.replaceState.bind(history);

    history.pushState = (...args) => {
      origPush(...args);
      this._handleUrlChange();
    };
    history.replaceState = (...args) => {
      origReplace(...args);
      this._handleUrlChange();
    };

    window.addEventListener('popstate', () => this._handleUrlChange());
  }

  stop() {
    this._observer?.disconnect();
  }

  _handleUrlChange() {
    if (location.href !== this._lastUrl) {
      this._lastUrl = location.href;
      // Small delay to let Jira render the new page
      setTimeout(() => {
        this.onNavigate(window.JiraLLM.extractIssueKey(location.href));
      }, 800);
    }
  }
};

/**
 * Extracts the Jira issue key from a URL.
 * Supports:
 *   /browse/PRJ-123
 *   /jira/software/projects/PRJ/issues/PRJ-123
 *   ?selectedIssue=PRJ-123
 *
 * @param {string} url
 * @returns {string|null}
 */
window.JiraLLM.extractIssueKey = function extractIssueKey(url) {
  try {
    const u = new URL(url);
    // Pattern: /browse/PRJ-123
    const browseMatch = u.pathname.match(/\/browse\/([A-Z][A-Z0-9_]+-\d+)/i);
    if (browseMatch) return browseMatch[1].toUpperCase();

    // Pattern: /issues/PRJ-123
    const issuesMatch = u.pathname.match(/\/issues\/([A-Z][A-Z0-9_]+-\d+)/i);
    if (issuesMatch) return issuesMatch[1].toUpperCase();

    // Query param selectedIssue=PRJ-123
    const param = u.searchParams.get('selectedIssue');
    if (param && /^[A-Z][A-Z0-9_]+-\d+$/i.test(param)) return param.toUpperCase();

    return null;
  } catch (_) {
    return null;
  }
};
