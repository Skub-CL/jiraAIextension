/**
 * Microsoft Azure OpenAI / Copilot client.
 *
 * Two authentication modes are supported:
 *   1. API Key (simple):  Set apiKey in settings. Used as Bearer token.
 *   2. OAuth2 via chrome.identity (M365 SSO):  Set clientId + tenantId.
 *      The user's already-signed-in M365 account is used – no extra login needed.
 *      Requires the extension to be registered as an Azure AD app.
 *
 * Config fields used:
 *   copilotEndpoint    – full Azure OpenAI deployment URL
 *   copilotApiVersion  – e.g. "2024-02-01"
 *   copilotModel       – deployment name
 *   copilotApiKey      – API key (mode 1) or empty
 *   copilotClientId    – Azure AD client ID (mode 2)
 *   copilotTenantId    – Azure AD tenant ID (mode 2)
 */
export class CopilotClient {
  constructor(config) {
    this.endpoint = config.copilotEndpoint?.replace(/\/$/, '') || '';
    this.apiVersion = config.copilotApiVersion || '2024-02-01';
    this.model = config.copilotModel || 'gpt-4o';
    this.apiKey = config.copilotApiKey || '';
    this.clientId = config.copilotClientId || '';
    this.tenantId = config.copilotTenantId || '';
    this._cachedToken = null;
    this._tokenExpiry = 0;
  }

  async complete(prompt) {
    const token = await this._getToken();
    const url = this.endpoint.includes('/chat/completions')
      ? `${this.endpoint}?api-version=${this.apiVersion}`
      : `${this.endpoint}/chat/completions?api-version=${this.apiVersion}`;

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 60_000);

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
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
          this._cachedToken = null; // invalidate cached token
          throw new Error('Copilot-Authentifizierung fehlgeschlagen (401/403). Token abgelaufen?');
        }
        throw new Error(`Copilot-Fehler (HTTP ${response.status}): ${text.slice(0, 200)}`);
      }

      const data = await response.json();
      const content = data?.choices?.[0]?.message?.content;
      if (!content) {
        throw new Error('Copilot: Leere Antwort erhalten.');
      }
      return content;
    } catch (err) {
      if (err.name === 'AbortError') {
        throw new Error('Zeitüberschreitung beim Copilot-API-Aufruf (>60s).');
      }
      throw err;
    } finally {
      clearTimeout(timeout);
    }
  }

  async _getToken() {
    // Mode 1: API Key
    if (this.apiKey) return this.apiKey;

    // Mode 2: OAuth2 via chrome.identity
    if (!this.clientId || !this.tenantId) {
      throw new Error(
        'Copilot-Backend: Weder API-Key noch OAuth2-Konfiguration (Client-ID + Tenant-ID) gesetzt.'
      );
    }

    // Return cached token if still valid (5-minute buffer)
    if (this._cachedToken && Date.now() < this._tokenExpiry - 300_000) {
      return this._cachedToken;
    }

    const scope = encodeURIComponent('https://cognitiveservices.azure.com/.default');
    const authUrl =
      `https://login.microsoftonline.com/${this.tenantId}/oauth2/v2.0/authorize` +
      `?client_id=${this.clientId}` +
      `&response_type=token` +
      `&redirect_uri=${encodeURIComponent(chrome.identity.getRedirectURL())}` +
      `&scope=${scope}`;

    return new Promise((resolve, reject) => {
      chrome.identity.launchWebAuthFlow(
        { url: authUrl, interactive: false },
        (redirectUrl) => {
          if (chrome.runtime.lastError) {
            reject(new Error(`Copilot-OAuth2 fehlgeschlagen: ${chrome.runtime.lastError.message}`));
            return;
          }
          const params = new URLSearchParams(new URL(redirectUrl).hash.slice(1));
          const token = params.get('access_token');
          const expiresIn = parseInt(params.get('expires_in') || '3600', 10);
          if (!token) {
            reject(new Error('Copilot-OAuth2: Kein Token in der Antwort.'));
            return;
          }
          this._cachedToken = token;
          this._tokenExpiry = Date.now() + expiresIn * 1000;
          resolve(token);
        }
      );
    });
  }
}
