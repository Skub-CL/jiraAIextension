'use strict';

// ── Keys stored in chrome.storage.sync ───────────────────────────────────────
const STORAGE_KEYS = [
  'jiraBaseUrl', 'jiraApiToken', 'acceptanceCriteriaFieldId',
  'ollamaBaseUrl', 'ollamaModel', 'ollamaUsername', 'ollamaPassword',
  'copilotEndpoint', 'copilotApiVersion', 'copilotModel',
  'copilotApiKey', 'copilotClientId', 'copilotTenantId',
  'openaiBaseUrl', 'openaiModel', 'openaiApiKey',
  'language',
  'llmRouting'
];

const DEFAULTS = {
  ollamaBaseUrl: 'http://localhost:11434',
  ollamaModel: 'llama3',
  copilotApiVersion: '2024-02-01',
  copilotModel: 'gpt-4o',
  openaiModel: 'gpt-4',
  language: 'de',
  llmRouting: { summary: 'ollama', acceptance: 'ollama', subtasks: 'ollama', comments: 'ollama' }
};

// ── Field map (storageKey → element id) ────────────────────────────────────
const FIELDS = {
  jiraBaseUrl: 'jiraBaseUrl',
  jiraApiToken: 'jiraApiToken',
  acceptanceCriteriaFieldId: 'acceptanceCriteriaFieldId',
  ollamaBaseUrl: 'ollamaBaseUrl',
  ollamaModel: 'ollamaModel',
  ollamaUsername: 'ollamaUsername',
  ollamaPassword: 'ollamaPassword',
  copilotEndpoint: 'copilotEndpoint',
  copilotApiVersion: 'copilotApiVersion',
  copilotModel: 'copilotModel',
  copilotApiKey: 'copilotApiKey',
  copilotClientId: 'copilotClientId',
  copilotTenantId: 'copilotTenantId',
  openaiBaseUrl: 'openaiBaseUrl',
  openaiModel: 'openaiModel',
  openaiApiKey: 'openaiApiKey',
  language: 'language'
};

// ── Init ─────────────────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', async () => {
  await loadSettings();
  bindEvents();
  showRedirectUri();
});

async function loadSettings() {
  const stored = await chrome.storage.sync.get(STORAGE_KEYS);
  const data = { ...DEFAULTS, ...stored };

  for (const [key, elId] of Object.entries(FIELDS)) {
    const el = document.getElementById(elId);
    if (el) el.value = data[key] || '';
  }

  // LLM routing selects
  const routing = data.llmRouting || {};
  ['summary', 'acceptance', 'subtasks', 'comments'].forEach(feature => {
    const sel = document.getElementById(`routing-${feature}`);
    if (sel) sel.value = routing[feature] || 'ollama';
  });
}

async function saveSettings() {
  const data = {};
  for (const [key, elId] of Object.entries(FIELDS)) {
    const el = document.getElementById(elId);
    if (el) data[key] = el.value.trim();
  }

  data.llmRouting = {};
  ['summary', 'acceptance', 'subtasks', 'comments'].forEach(feature => {
    const sel = document.getElementById(`routing-${feature}`);
    if (sel) data.llmRouting[feature] = sel.value;
  });

  await chrome.storage.sync.set(data);
  showStatus('✅ Einstellungen gespeichert.', 'success');
}

function bindEvents() {
  document.getElementById('save').addEventListener('click', saveSettings);

  document.getElementById('reset-all').addEventListener('click', async () => {
    if (!confirm('Alle Einstellungen zurücksetzen?')) return;
    await chrome.storage.sync.clear();
    await loadSettings();
    showStatus('Einstellungen zurückgesetzt.', 'success');
  });

  document.getElementById('reset-subtask-prompt').addEventListener('click', async () => {
    await chrome.storage.sync.remove('promptSubtasksCustom');
    showStatus('Unteraufgaben-Prompt zurückgesetzt.', 'success');
  });

  // Backend tabs
  document.querySelectorAll('.tab').forEach(tab => {
    tab.addEventListener('click', () => {
      document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
      document.querySelectorAll('.tab-panel').forEach(p => p.classList.remove('active'));
      tab.classList.add('active');
      const panel = document.getElementById(`tab-${tab.dataset.tab}`);
      if (panel) panel.classList.add('active');
    });
  });

  // Connection tests
  document.getElementById('test-jira').addEventListener('click', testJira);
  document.getElementById('test-ollama').addEventListener('click', testOllama);
  document.getElementById('test-copilot').addEventListener('click', testCopilot);
  document.getElementById('test-openai').addEventListener('click', testOpenAI);
}

function showRedirectUri() {
  const el = document.getElementById('redirect-uri');
  if (el && chrome.identity?.getRedirectURL) {
    el.textContent = chrome.identity.getRedirectURL();
  }
}

// ── Connection tests ──────────────────────────────────────────────────────────

async function testJira() {
  const resultEl = document.getElementById('test-jira-result');
  const url = document.getElementById('jiraBaseUrl').value.trim();
  const token = document.getElementById('jiraApiToken').value.trim();

  if (!url || !token) {
    setTestResult(resultEl, false, 'URL und PAT erforderlich.');
    return;
  }
  setTestResult(resultEl, null, 'Teste…');
  try {
    const resp = await fetch(`${url}/rest/api/2/myself`, {
      headers: { 'Authorization': `Bearer ${token}`, 'Accept': 'application/json' }
    });
    if (resp.ok) {
      const data = await resp.json();
      setTestResult(resultEl, true, `Verbunden als: ${data.displayName || data.name}`);
    } else {
      setTestResult(resultEl, false, `HTTP ${resp.status}`);
    }
  } catch (err) {
    setTestResult(resultEl, false, err.message);
  }
}

async function testOllama() {
  const resultEl = document.getElementById('test-ollama-result');
  const url = document.getElementById('ollamaBaseUrl').value.trim();
  if (!url) { setTestResult(resultEl, false, 'URL erforderlich.'); return; }

  setTestResult(resultEl, null, 'Teste…');
  try {
    const resp = await fetch(`${url}/api/tags`);
    if (resp.ok) {
      const data = await resp.json();
      const models = (data.models || []).map(m => m.name).join(', ') || '(keine Modelle)';
      setTestResult(resultEl, true, `Erreichbar. Modelle: ${models}`);
    } else {
      setTestResult(resultEl, false, `HTTP ${resp.status}`);
    }
  } catch (err) {
    setTestResult(resultEl, false, 'Nicht erreichbar: ' + err.message);
  }
}

async function testCopilot() {
  const resultEl = document.getElementById('test-copilot-result');
  const endpoint = document.getElementById('copilotEndpoint').value.trim();
  const apiKey = document.getElementById('copilotApiKey').value.trim();
  const apiVersion = document.getElementById('copilotApiVersion').value.trim() || '2024-02-01';

  if (!endpoint) { setTestResult(resultEl, false, 'Endpoint erforderlich.'); return; }
  if (!apiKey) {
    setTestResult(resultEl, false, 'API-Key für den Test erforderlich (OAuth2-Test nur zur Laufzeit möglich).');
    return;
  }

  setTestResult(resultEl, null, 'Teste…');
  const url = endpoint.includes('/chat/completions')
    ? `${endpoint}?api-version=${apiVersion}`
    : `${endpoint}/chat/completions?api-version=${apiVersion}`;
  try {
    const resp = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` },
      body: JSON.stringify({ messages: [{ role: 'user', content: 'Antworte mit: OK' }], max_tokens: 5 })
    });
    if (resp.ok) {
      setTestResult(resultEl, true, 'Verbindung erfolgreich.');
    } else {
      const txt = await resp.text().catch(() => '');
      setTestResult(resultEl, false, `HTTP ${resp.status}: ${txt.slice(0, 100)}`);
    }
  } catch (err) {
    setTestResult(resultEl, false, err.message);
  }
}

async function testOpenAI() {
  const resultEl = document.getElementById('test-openai-result');
  const url = document.getElementById('openaiBaseUrl').value.trim();
  const key = document.getElementById('openaiApiKey').value.trim();

  if (!url) { setTestResult(resultEl, false, 'URL erforderlich.'); return; }
  setTestResult(resultEl, null, 'Teste…');
  try {
    const headers = { 'Content-Type': 'application/json' };
    if (key) headers['Authorization'] = `Bearer ${key}`;
    const resp = await fetch(`${url}/models`, { headers });
    if (resp.ok) {
      const data = await resp.json();
      const count = data.data?.length || '?';
      setTestResult(resultEl, true, `Erreichbar. ${count} Modell(e) verfügbar.`);
    } else {
      setTestResult(resultEl, false, `HTTP ${resp.status}`);
    }
  } catch (err) {
    setTestResult(resultEl, false, 'Nicht erreichbar: ' + err.message);
  }
}

// ── Utilities ─────────────────────────────────────────────────────────────────

function setTestResult(el, ok, msg) {
  el.textContent = msg;
  el.className = 'test-result' + (ok === true ? ' ok' : ok === false ? ' err' : '');
}

function showStatus(message, type = 'success') {
  const bar = document.getElementById('status-bar');
  bar.textContent = message;
  bar.className = `visible ${type}`;
  setTimeout(() => { bar.className = type; }, 3000);
}
