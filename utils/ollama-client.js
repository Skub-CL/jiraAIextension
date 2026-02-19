/**
 * Ollama REST API client.
 * Endpoint: POST /api/chat  (supports streaming, but we use stream:false for simplicity)
 */
export class OllamaClient {
  constructor(baseUrl, model, basicAuth = null) {
    this.baseUrl = baseUrl.replace(/\/$/, '');
    this.model = model;
    this.basicAuth = basicAuth; // { username, password } or null
  }

  get headers() {
    const h = { 'Content-Type': 'application/json' };
    if (this.basicAuth?.username) {
      const encoded = btoa(`${this.basicAuth.username}:${this.basicAuth.password}`);
      h['Authorization'] = `Basic ${encoded}`;
    }
    return h;
  }

  async complete(prompt) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 120_000); // 2 min for large models

    try {
      const response = await fetch(`${this.baseUrl}/api/chat`, {
        method: 'POST',
        headers: this.headers,
        body: JSON.stringify({
          model: this.model,
          messages: [{ role: 'user', content: prompt }],
          stream: false
        }),
        signal: controller.signal
      });

      if (!response.ok) {
        const text = await response.text().catch(() => '');
        throw new Error(`Ollama-Fehler (HTTP ${response.status}): ${text.slice(0, 200)}`);
      }

      const data = await response.json();
      const content = data?.message?.content;
      if (!content) {
        throw new Error('Ollama: Leere Antwort erhalten.');
      }
      return content;
    } catch (err) {
      if (err.name === 'AbortError') {
        throw new Error('Zeitüberschreitung: LLM-Server antwortet nicht (>120s). Modell zu groß?');
      }
      if (err.message.includes('Failed to fetch') || err.message.includes('NetworkError')) {
        throw new Error(`LLM-Server nicht erreichbar. Ollama läuft unter: ${this.baseUrl}`);
      }
      throw err;
    } finally {
      clearTimeout(timeout);
    }
  }
}
