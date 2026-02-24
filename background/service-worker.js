/**
 * Background Service Worker
 *
 * Handles all API calls (Jira + LLM) to bypass content-script CORS restrictions.
 * Receives messages from content scripts via chrome.runtime.onMessage.
 *
 * Supported actions:
 *   analyzeIssue   – fetch Jira data, build prompt, call LLM, return text
 *   createSubtask  – create a Jira sub-task via REST API
 *   getSettings    – return current settings from chrome.storage.sync
 */
import { LLMClient } from '../utils/llm-client.js';
import { JiraAPI, extractText, formatComments, formatSubtasks } from '../utils/jira-api.js';
import { PROMPTS, fillTemplate } from '../prompts/prompts.js';

// ── Default settings ─────────────────────────────────────────────────────────
const DEFAULTS = {
  ollamaBaseUrl: 'http://localhost:11434',
  ollamaModel: 'llama3',
  ollamaUsername: '',
  ollamaPassword: '',
  jiraBaseUrl: '',
  jiraApiToken: '',
  acceptanceCriteriaFieldId: '',
  language: 'de',
  panelPosition: 'right',
  llmRouting: {
    summary: 'ollama',
    acceptance: 'ollama',
    subtasks: 'ollama',
    comments: 'ollama'
  },
  defaultBackend: 'ollama',
  // Copilot / Azure OpenAI
  copilotEndpoint: '',
  copilotApiVersion: '2024-02-01',
  copilotModel: 'gpt-4o',
  copilotApiKey: '',
  copilotClientId: '',
  copilotTenantId: '',
  // OpenAI-compatible
  openaiBaseUrl: '',
  openaiApiKey: '',
  openaiModel: 'gpt-4',
  // User-customizable subtasks prompt
  promptSubtasksCustom: ''
};

// ── Message listener ──────────────────────────────────────────────────────────
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  handleMessage(message)
    .then(result => sendResponse({ success: true, ...result }))
    .catch(err => sendResponse({ success: false, error: err.message }));
  return true; // keep channel open for async response
});

async function handleMessage(message) {
  switch (message.action) {
    case 'analyzeIssue':
      return analyzeIssue(message);
    case 'createSubtask':
      return createSubtask(message);
    case 'getSettings':
      return { settings: await getSettings() };
    default:
      throw new Error(`Unbekannte Aktion: ${message.action}`);
  }
}

// ── Get settings ──────────────────────────────────────────────────────────────
async function getSettings() {
  const stored = await chrome.storage.sync.get(Object.keys(DEFAULTS));
  return { ...DEFAULTS, ...stored };
}

// ── Analyze issue ─────────────────────────────────────────────────────────────
async function analyzeIssue({ feature, issueKey, customPrompt }) {
  const settings = await getSettings();

  if (!settings.jiraBaseUrl) {
    throw new Error('Jira-URL nicht konfiguriert. Bitte die Erweiterungs-Einstellungen öffnen.');
  }
  if (!settings.jiraApiToken) {
    throw new Error('Jira Personal Access Token (PAT) nicht konfiguriert.');
  }

  // Normalise fieldId: user may enter "10112" or "customfield_10112"
  const rawFieldId = settings.acceptanceCriteriaFieldId || '';
  const fieldId = rawFieldId && /^\d+$/.test(rawFieldId.trim())
    ? `customfield_${rawFieldId.trim()}`
    : rawFieldId.trim();

  const jira = new JiraAPI(settings.jiraBaseUrl, settings.jiraApiToken);
  const issue = await jira.getIssue(issueKey, fieldId);
  const fields = issue.fields;

  // Build template variables from issue data
  const vars = {
    issueKey,
    summary: fields.summary || '',
    issuetype: fields.issuetype?.name || '',
    status: fields.status?.name || '',
    priority: fields.priority?.name || '—',
    assignee: fields.assignee?.displayName || '(nicht zugewiesen)',
    description: extractText(fields.description) || '(keine Beschreibung)',
    acceptanceCriteria: fieldId
      ? extractText(fields[fieldId]) || '(keine Akzeptanzkriterien)'
      : '(kein Feld konfiguriert)',
    existingSubtasks: formatSubtasks(fields.subtasks),
    comments: formatComments(fields.comment?.comments),
    language: settings.language === 'en' ? 'English' : 'Deutsch'
  };

  // Select prompt template
  let template;
  if (feature === 'subtasks' && customPrompt) {
    template = customPrompt; // user-edited prompt already has variables
  } else if (feature === 'subtasks' && settings.promptSubtasksCustom) {
    template = settings.promptSubtasksCustom;
  } else {
    template = PROMPTS[feature];
    if (!template) throw new Error(`Unbekanntes Feature: ${feature}`);
  }

  const prompt = fillTemplate(template, vars);
  const raw = await LLMClient.complete(feature, prompt, settings);

  return { result: stripThinkingBlocks(raw) };
}

// ── Strip reasoning/thinking blocks from LLM output ──────────────────────────
// Handles: <think>, <thinking>, <reasoning> – used by DeepSeek-R1, QwQ, etc.
function stripThinkingBlocks(text) {
  return text
    .replace(/<think>[\s\S]*?<\/think>/gi, '')
    .replace(/<thinking>[\s\S]*?<\/thinking>/gi, '')
    .replace(/<reasoning>[\s\S]*?<\/reasoning>/gi, '')
    .trim();
}

// ── Create subtask ────────────────────────────────────────────────────────────
async function createSubtask({ issueKey, summary, description }) {
  const settings = await getSettings();

  if (!settings.jiraBaseUrl || !settings.jiraApiToken) {
    throw new Error('Jira nicht konfiguriert.');
  }

  const projectKey = issueKey.split('-')[0];
  const jira = new JiraAPI(settings.jiraBaseUrl, settings.jiraApiToken);
  const created = await jira.createSubtask(projectKey, issueKey, summary, description);

  return { createdKey: created.key };
}
