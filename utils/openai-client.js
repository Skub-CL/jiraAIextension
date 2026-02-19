/**
 * Generic OpenAI-compatible API client.
 * Works with any OpenAI-compatible endpoint (LM Studio, vLLM, Groq, etc.).
 */
export class OpenAIClient {
  constructor(baseUrl, apiKey, model) {
    this.baseUrl = baseUrl.replace(/\/$/, '');
    this.apiKey = apiKey;
    this.model = model;
  }

  async complete(prompt) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 120_000);

    try {
      const response = await fetch(`${this.baseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.apiKey}`
        },
        body: JSON.stringify({
          model: this.model,
          messages: [{ role: 'user', content: prompt }]
        }),
        signal: controller.signal
      });

      if (!response.ok) {
        const text = await response.text().catch(() => '');
        if (response.status === 401 || response.status === 403) {
          throw new Error('OpenAI-API: Ungültiger API-Key (401/403).');
        }
        throw new Error(`OpenAI-API-Fehler (HTTP ${response.status}): ${text.slice(0, 200)}`);
      }

      const data = await response.json();
      const content = data?.choices?.[0]?.message?.content;
      if (!content) {
        throw new Error('OpenAI-API: Leere Antwort erhalten.');
      }
      return content;
    } catch (err) {
      if (err.name === 'AbortError') {
        throw new Error('Zeitüberschreitung beim API-Aufruf (>120s).');
      }
      if (err.message.includes('Failed to fetch') || err.message.includes('NetworkError')) {
        throw new Error(`OpenAI-kompatibler Server nicht erreichbar: ${this.baseUrl}`);
      }
      throw err;
    } finally {
      clearTimeout(timeout);
    }
  }
}
