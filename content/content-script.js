/**
 * Content Script – main entry point.
 *
 * Responsibilities:
 *   1. Check if the current page is a Jira issue page (URL matches configured jiraBaseUrl)
 *   2. Extract the issue key
 *   3. Load settings and initialize the Injector
 *   4. Start the DOMObserver for SPA navigation
 */
(function () {
  'use strict';

  const { Injector, DOMObserver, extractIssueKey } = window.JiraLLM;

  let currentInjector = null;
  let settings = null;

  // ── Bootstrap ────────────────────────────────────────────────────────────────

  async function init() {
    settings = await loadSettings();
    const issueKey = extractIssueKey(location.href);
    if (issueKey && isJiraPage()) {
      activate(issueKey);
    }

    // Watch for SPA navigation
    const observer = new DOMObserver((newKey) => {
      if (currentInjector) {
        currentInjector.cleanup();
        currentInjector = null;
      }
      if (newKey && isJiraPage()) {
        // Wait for Jira to render the new issue DOM
        waitForDom(() => activate(newKey));
      }
    });
    observer.start();
  }

  function isJiraPage() {
    if (!settings?.jiraBaseUrl) return false;
    try {
      const jiraHost = new URL(settings.jiraBaseUrl).hostname;
      return location.hostname === jiraHost;
    } catch (_) {
      // If jiraBaseUrl is not a valid URL, do a simple string check
      return location.href.includes(settings.jiraBaseUrl);
    }
  }

  function activate(issueKey) {
    if (currentInjector) currentInjector.cleanup();
    currentInjector = new Injector(issueKey, settings);

    // Inject immediately and retry a few times for slow Jira renders
    currentInjector.inject();
    let attempts = 0;
    const retryInterval = setInterval(() => {
      attempts++;
      currentInjector.inject(); // idempotent
      if (attempts >= 5) clearInterval(retryInterval);
    }, 1000);
  }

  /**
   * Wait until a key Jira DOM element is present (indicates Jira finished rendering).
   */
  function waitForDom(callback, maxWait = 5000) {
    const start = Date.now();
    const check = () => {
      if (document.querySelector('#summary-val, h1[data-field-id="summary"], .issue-header-content')) {
        callback();
      } else if (Date.now() - start < maxWait) {
        setTimeout(check, 300);
      }
    };
    check();
  }

  async function loadSettings() {
    return new Promise((resolve) => {
      chrome.runtime.sendMessage({ action: 'getSettings' }, (response) => {
        if (chrome.runtime.lastError || !response?.settings) {
          resolve({});
          return;
        }
        resolve(response.settings);
      });
    });
  }

  // ── Start ────────────────────────────────────────────────────────────────────
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
