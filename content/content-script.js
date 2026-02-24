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
  let persistInterval = null;

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
    // Clear any running interval from a previous activation to prevent duplicates
    if (persistInterval) { clearInterval(persistInterval); persistInterval = null; }

    currentInjector = new Injector(issueKey, settings);

    // Quick retries for initial slow Jira renders (0s, 0.8s, 1.6s, 2.5s, 4s)
    currentInjector.inject();
    [800, 1600, 2500, 4000].forEach(delay => {
      setTimeout(() => { if (currentInjector) currentInjector.inject(); }, delay);
    });

    // Persistent re-injection every 3s: waits for Jira's right sidebar to finish
    // rendering (the "Agil" module is often injected by Jira Software asynchronously).
    persistInterval = setInterval(() => {
      if (!currentInjector || extractIssueKey(location.href) !== issueKey) {
        clearInterval(persistInterval);
        persistInterval = null;
        return;
      }
      currentInjector.inject(); // idempotent – panel already present → no-op
    }, 3000);
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
