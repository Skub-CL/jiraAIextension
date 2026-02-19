# Jira LLM Assistant

Eine Chrome-Erweiterung (Manifest V3), die KI-gestützte Analyse direkt in Jira Data Center / Server einbettet – ähnlich wie Keepa auf Amazon-Produktseiten. Alle LLM-Funktionen werden **on-demand** durch einen Klick auf das 🤖-Icon neben der jeweiligen Jira-Sektion ausgelöst.

---

## Features

| Feature | Auslöser | Beschreibung |
|---|---|---|
| **Zusammenfassung** | 🤖 neben dem Issue-Titel | Kompakte 3–5 Satz-Zusammenfassung |
| **Akzeptanzkriterien-Bewertung** | 🤖 neben dem AK-Feld | Bewertung nach Vollständigkeit, Testbarkeit, Verständlichkeit, Eindeutigkeit |
| **Unteraufgaben-Vorschläge** | 🤖 neben der Unteraufgaben-Sektion | LLM schlägt 3–7 Unteraufgaben vor, die direkt in Jira angelegt werden können |
| **Kommentar-Analyse** | 🤖 neben der Aktivitäts-Sektion | Extraktion von offenen Fragen, Entscheidungen, Risiken und Aktionspunkten |

---

## Installation

### Entwicklermodus (für Tests)

1. Dieses Repository klonen / herunterladen
2. Chrome öffnen → `chrome://extensions`
3. „Entwicklermodus" (oben rechts) aktivieren
4. „Entpackte Erweiterung laden" → Ordner `jira-llm-assistant/` auswählen
5. Die Erweiterung erscheint in der Liste – Einstellungen öffnen (⚙️ → Einstellungen)

### Enterprise-Deployment via Ivanti DSM

Siehe [Deployment-Anleitung](#deployment-ivanti-dsm) am Ende dieser Datei.

---

## Konfiguration

Die Einstellungen sind über das Chrome-Erweiterungsmenü → Optionen erreichbar.

### Jira-Konfiguration

| Einstellung | Beschreibung |
|---|---|
| **Jira-Basis-URL** | URL der Jira-Instanz, z. B. `https://jira.example.com` |
| **Personal Access Token (PAT)** | Jira DC: Profil → Personal Access Tokens → Token erstellen |
| **Akzeptanzkriterien Feld-ID** | Interne ID des Custom Fields, z. B. `customfield_10200`. Zu finden unter Jira-Verwaltung → Felder → Benutzerdefinierte Felder. Leer lassen, wenn nicht genutzt. |

> **Sicherheit**: Der PAT wird in `chrome.storage.sync` gespeichert und nicht im Klartext an Dritte übermittelt. Alle API-Calls laufen direkt zwischen dem Browser und Jira/LLM.

### LLM-Backends

Drei Backends werden unterstützt. Das Backend kann pro Feature unabhängig zugewiesen werden.

#### Ollama (empfohlen für lokales/internes LLM)

| Einstellung | Standard | Beschreibung |
|---|---|---|
| `Basis-URL` | `http://localhost:11434` | URL des Ollama-Servers |
| `Modell` | `llama3` | Zu verwendendes Modell (`ollama list` zeigt verfügbare Modelle) |
| `Benutzername` / `Passwort` | *(leer)* | Optional: Basic Auth, falls Ollama hinter einem Reverse Proxy mit Auth liegt |

**Ollama installieren**: [https://ollama.com](https://ollama.com)
```bash
ollama pull llama3   # Modell herunterladen
ollama serve         # Server starten (Standard: Port 11434)
```

#### Microsoft Copilot / Azure OpenAI

| Einstellung | Beschreibung |
|---|---|
| `Azure OpenAI Endpoint` | Vollständiger Deployment-URL aus dem Azure-Portal |
| `API-Version` | z. B. `2024-02-01` |
| `Modell / Deployment-Name` | z. B. `gpt-4o` |
| `API-Key` | Azure-API-Key (empfohlen für den einfachen Einstieg) |
| `Tenant-ID` + `Client-ID` | Für OAuth2/SSO via M365-Konto (erfordert Azure AD App-Registrierung) |

**OAuth2-Setup (für M365 SSO)**:
1. In Azure AD → App-Registrierungen → Neue Registrierung
2. Redirect-URI: Den angezeigten Wert aus den Erweiterungs-Einstellungen kopieren
3. API-Berechtigungen: `Cognitive Services → user_impersonation`
4. Tenant-ID und Client-ID in die Einstellungen eintragen

#### OpenAI-kompatibel (LM Studio, vLLM, LocalAI, etc.)

| Einstellung | Beschreibung |
|---|---|
| `Basis-URL` | URL des Servers, z. B. `http://localhost:1234/v1` |
| `Modell` | Modellname |
| `API-Key` | Leer lassen, falls keine Authentifizierung nötig |

### LLM-Zuweisung pro Feature

In den Einstellungen → „LLM-Zuweisung pro Feature" kann für jedes Feature (Zusammenfassung, Akzeptanzkriterien, Unteraufgaben, Kommentare) ein eigenes Backend gewählt werden. So können z. B. sensible Features über Copilot laufen, während einfachere Aufgaben lokal via Ollama verarbeitet werden.

### Sprache

Die KI-Ausgaben werden standardmäßig auf **Deutsch** ausgegeben. Kann in den Einstellungen auf Englisch umgestellt werden.

---

## Nutzung

1. **Jira-Issue öffnen**: Die Erweiterung erkennt automatisch, ob die aktuelle Seite eine konfigurierte Jira-Instanz ist.

2. **KI-Funktion aktivieren**: Das 🤖-Icon erscheint dezent neben den jeweiligen Jira-Sektionen:
   - Rechts neben dem Issue-Titel → Zusammenfassung
   - Neben der Akzeptanzkriterien-Überschrift → AK-Bewertung
   - Neben der Unteraufgaben-Überschrift → Unteraufgaben-Vorschläge
   - Neben der Aktivitäts-Überschrift → Kommentar-Analyse

3. **Unteraufgaben anlegen**:
   - Klick auf 🤖 öffnet zuerst einen Dialog mit dem editierbaren Prompt
   - Nach Klick auf „Starten" erscheinen die LLM-Vorschläge als Checkliste
   - Einzeln per „+ Anlegen" oder alle markierten per „✓ Alle anlegen" in Jira erstellen

4. **Block-Steuerung**:
   - `▲/▼` – Block ein-/ausblenden (Zustand bleibt bis zum Seiten-Reload erhalten)
   - `📋` – Blockinhalt in die Zwischenablage kopieren
   - `↺` – Ergebnis neu laden (erneuter LLM-Call)

---

## Wichtige Hinweise

- **On-Demand**: Kein LLM-Call wird ohne explizite Nutzeraktion ausgeführt.
- **SPA-Navigation**: Die Erweiterung erkennt Seiten-Navigationen in Jira ohne vollen Seitenreload und injiziert die Blöcke neu.
- **Jira-DOM-Selektoren**: Die Erweiterung nutzt stabile `id`- und `data-field-id`-Attribute von Jira DC. Bei starken Anpassungen der Jira-Oberfläche können Selektoren in `content/injector.js` angepasst werden.
- **Akzeptanzkriterien-Feld**: In Jira DC werden AK meist in einem Custom Field gespeichert. Die Feld-ID muss einmalig konfiguriert werden.

---

## Prompt-Verwaltung

| Feature | Editierbar? | Speicherort |
|---|---|---|
| Zusammenfassung | Nein | `prompts/prompts.js` |
| Akzeptanzkriterien-Bewertung | Nein | `prompts/prompts.js` |
| Kommentar-Analyse | Nein | `prompts/prompts.js` |
| Unteraufgaben-Vorschläge | **Ja** (pro Nutzer) | `chrome.storage.sync` → `promptSubtasksCustom` |

Der Unteraufgaben-Prompt kann vor jeder Ausführung im Dialog angepasst werden. Die Anpassung wird gespeichert und beim nächsten Aufruf wieder vorausgefüllt. Über die Einstellungen kann der Prompt auf den Standard zurückgesetzt werden.

---

## Deployment (Ivanti DSM)

### Schritt 1: Extension packen

Im Chrome-Browser (Entwicklermodus):
1. `chrome://extensions` öffnen
2. „Erweiterung packen" → Ordner auswählen
3. Erzeugtes `.crx`-File und den privaten Schlüssel sicher aufbewahren

### Schritt 2: Hosting

```
https://intern.example.com/extensions/
├── jira-llm-assistant.crx
└── update_manifest.xml
```

**update_manifest.xml:**
```xml
<?xml version='1.0' encoding='UTF-8'?>
<gupdate xmlns='http://www.google.com/update2/response' protocol='2.0'>
  <app appid='<EXTENSION-ID>'>
    <updatecheck codebase='https://intern.example.com/extensions/jira-llm-assistant.crx'
                 version='1.0.0'/>
  </app>
</gupdate>
```

### Schritt 3: Registry-Policy (per Ivanti PowerShell-Script)

```powershell
# Erweiterung erzwingen
$regPath = "HKLM:\Software\Policies\Google\Chrome\ExtensionInstallForcelist"
New-Item -Path $regPath -Force | Out-Null
New-ItemProperty -Path $regPath -Name "1" -PropertyType String -Force `
  -Value "<EXTENSION-ID>;https://intern.example.com/extensions/update_manifest.xml"

# Jira-URL und Ollama-URL per ExtensionSettings vorbelegen
$settingsPath = "HKLM:\Software\Policies\Google\Chrome\3rdparty\extensions\<EXTENSION-ID>\policy"
New-Item -Path $settingsPath -Force | Out-Null
$policy = @{
  jiraBaseUrl   = "https://jira.example.com"
  ollamaBaseUrl = "http://llm-server.intern.example.com:11434"
  ollamaModel   = "llama3"
  language      = "de"
} | ConvertTo-Json
New-ItemProperty -Path $settingsPath -Name "storage" -Value $policy -Force
```

> **Hinweis**: Die PAT-Eingabe muss durch den Endnutzer einmalig in den Erweiterungs-Einstellungen erfolgen, da Tokens nutzerspezifisch sind.

---

## Datenschutz & Sicherheit

- Jira-Daten werden **ausschließlich** an die konfigurierten LLM-Server gesendet (Ollama/Azure/OpenAI-kompatibel).
- Es werden keine Daten an externe Dienste oder Anthropic/OpenAI-Clouds übermittelt, sofern ein lokaler/interner LLM-Server genutzt wird.
- Der Jira-PAT wird in `chrome.storage.sync` gespeichert und ist nur der Erweiterung selbst zugänglich.
- Der injizierte Code nutzt kein `eval()` und kein `innerHTML` mit unkontrollierten Nutzerdaten (XSS-sicher).
