/**
 * Central LLM routing interface.
 *
 * Reads the per-feature backend assignment from chrome.storage.sync (llmRouting)
 * and dispatches to the appropriate client implementation.
 *
 * Usage:
 *   import { LLMClient } from '../utils/llm-client.js';
 *   const text = await LLMClient.complete('summary', prompt, settings);
 */
import { OllamaClient } from './ollama-client.js';
import { CopilotClient } from './copilot-client.js';
import { OpenAIClient } from './openai-client.js';

export class LLMClient {
  /**
   * @param {'summary'|'acceptance'|'subtasks'|'comments'} feature
   * @param {string} prompt  Fully rendered prompt string
   * @param {object} settings  Full settings object from chrome.storage.sync
   */
  static async complete(feature, prompt, settings) {
    const routing = settings.llmRouting || {};
    const backend = routing[feature] || settings.defaultBackend || 'ollama';

    switch (backend) {
      case 'ollama':
        return LLMClient._ollama(prompt, settings);
      case 'copilot':
        return LLMClient._copilot(prompt, settings);
      case 'openai':
        return LLMClient._openai(prompt, settings);
      default:
        throw new Error(`Unbekanntes LLM-Backend: "${backend}"`);
    }
  }

  static async _ollama(prompt, settings) {
    const { ollamaBaseUrl, ollamaModel, ollamaUsername, ollamaPassword } = settings;
    if (!ollamaBaseUrl) {
      throw new Error('Ollama: Basis-URL nicht konfiguriert (Einstellungen öffnen).');
    }
    const basicAuth = ollamaUsername ? { username: ollamaUsername, password: ollamaPassword || '' } : null;
    const client = new OllamaClient(ollamaBaseUrl, ollamaModel || 'llama3', basicAuth);
    return client.complete(prompt);
  }

  static async _copilot(prompt, settings) {
    if (!settings.copilotEndpoint) {
      throw new Error('Copilot: Endpoint nicht konfiguriert (Einstellungen öffnen).');
    }
    const client = new CopilotClient(settings);
    return client.complete(prompt);
  }

  static async _openai(prompt, settings) {
    if (!settings.openaiBaseUrl) {
      throw new Error('OpenAI-kompatibel: Basis-URL nicht konfiguriert (Einstellungen öffnen).');
    }
    const client = new OpenAIClient(settings.openaiBaseUrl, settings.openaiApiKey || '', settings.openaiModel || 'gpt-4');
    return client.complete(prompt);
  }
}
