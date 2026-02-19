/**
 * Jira REST API v2 wrapper.
 * All calls use Bearer token authentication (Personal Access Token).
 */
export class JiraAPI {
  constructor(baseUrl, token) {
    this.baseUrl = baseUrl.replace(/\/$/, '');
    this.token = token;
  }

  get headers() {
    return {
      'Authorization': `Bearer ${this.token}`,
      'Content-Type': 'application/json',
      'Accept': 'application/json'
    };
  }

  /**
   * Fetch full issue data including comments, subtasks and custom fields.
   * @param {string} issueKey  e.g. "PRJ-123"
   * @param {string} [acceptanceCriteriaFieldId]  e.g. "customfield_10200"
   */
  async getIssue(issueKey, acceptanceCriteriaFieldId = '') {
    const fields = [
      'summary', 'description', 'issuetype', 'status', 'priority',
      'assignee', 'reporter', 'labels', 'components', 'fixVersions',
      'subtasks', 'comment', 'attachment', 'parent', 'project'
    ];
    if (acceptanceCriteriaFieldId) {
      fields.push(acceptanceCriteriaFieldId);
    }

    const url = `${this.baseUrl}/rest/api/2/issue/${issueKey}?fields=${fields.join(',')}`;
    const response = await this._fetch(url);
    return response;
  }

  /**
   * Create a sub-task under the given parent issue.
   * @param {string} projectKey  e.g. "PRJ"
   * @param {string} parentKey   e.g. "PRJ-123"
   * @param {string} summary
   * @param {string} [description]
   */
  async createSubtask(projectKey, parentKey, summary, description = '') {
    const url = `${this.baseUrl}/rest/api/2/issue`;
    const body = {
      fields: {
        project: { key: projectKey },
        parent: { key: parentKey },
        summary,
        issuetype: { name: 'Sub-task' },
        ...(description ? { description } : {})
      }
    };
    const response = await this._fetch(url, {
      method: 'POST',
      body: JSON.stringify(body)
    });
    return response;
  }

  async _fetch(url, options = {}) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 30_000);
    try {
      const response = await fetch(url, {
        ...options,
        headers: { ...this.headers, ...(options.headers || {}) },
        signal: controller.signal
      });
      if (!response.ok) {
        const text = await response.text().catch(() => '');
        throw new JiraAPIError(response.status, text);
      }
      return await response.json();
    } catch (err) {
      if (err.name === 'AbortError') {
        throw new Error('Zeitüberschreitung: Jira-Server antwortet nicht (>30s).');
      }
      throw err;
    } finally {
      clearTimeout(timeout);
    }
  }
}

export class JiraAPIError extends Error {
  constructor(status, body) {
    super(JiraAPIError.message(status, body));
    this.status = status;
  }

  static message(status, body) {
    if (status === 401 || status === 403) {
      return `Jira-Zugriff verweigert (${status}). PAT abgelaufen oder ungültig?`;
    }
    if (status === 404) {
      return 'Jira-Issue nicht gefunden. Existiert der Vorgang?';
    }
    return `Jira-API-Fehler: HTTP ${status}`;
  }
}

/**
 * Extract a plain-text representation from a Jira field value.
 * Handles both legacy Wiki markup (string) and Atlassian Document Format (ADF object).
 */
export function extractText(value) {
  if (!value) return '';
  if (typeof value === 'string') return value;
  if (typeof value === 'object') {
    // Atlassian Document Format – recursively collect text nodes
    return adfToText(value);
  }
  return String(value);
}

function adfToText(node) {
  if (!node) return '';
  if (node.type === 'text') return node.text || '';
  if (node.content && Array.isArray(node.content)) {
    return node.content.map(adfToText).join(' ');
  }
  return '';
}

/**
 * Build a concise text representation of an issue's comments.
 */
export function formatComments(commentArray) {
  if (!commentArray || commentArray.length === 0) return '(Keine Kommentare vorhanden)';
  return commentArray
    .map((c, i) => {
      const author = c.author?.displayName || 'Unbekannt';
      const date = c.created ? new Date(c.created).toLocaleDateString('de-DE') : '';
      const body = extractText(c.body);
      return `[${i + 1}] ${author} (${date}):\n${body}`;
    })
    .join('\n\n');
}

/**
 * Build a concise list of existing subtask summaries.
 */
export function formatSubtasks(subtaskArray) {
  if (!subtaskArray || subtaskArray.length === 0) return '(Keine vorhanden)';
  return subtaskArray.map(s => `- ${s.key}: ${s.fields?.summary || ''}`).join('\n');
}
