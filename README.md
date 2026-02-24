# Jira LLM Assistant

Eine Chrome-Erweiterung (Manifest V3), die KI-gestützte Analyse direkt in Jira Data Center / Server einbettet. Alle Funktionen werden **on-demand** über ein natives Panel in der rechten Jira-Spalte ausgelöst – kein LLM-Call ohne explizite Nutzeraktion.

---

## Features

| Feature | Beschreibung |
|---|---|
| **📝 Zusammenfassung** | Kompakte 3–5 Satz-Zusammenfassung des Vorgangs |
| **✅ Akzeptanzkriterien bewerten** | Bewertung nach Vollständigkeit, Testbarkeit, Verständlichkeit und Eindeutigkeit mit Qualitäts-Badge |
| **📋 Unteraufgaben vorschlagen** | LLM schlägt 3–7 konkrete Unteraufgaben vor – einzeln oder alle auf einmal direkt in Jira anlegen |
| **💬 Kommentare analysieren** | Extraktion von offenen Fragen, Entscheidungen, Risiken und Aktionspunkten aus allen Kommentaren |

**Unterstützte LLM-Backends:** Ollama (lokal/intern) · Microsoft Copilot / Azure OpenAI · beliebige OpenAI-kompatible API

---

## Screenshot

```
Rechte Jira-Spalte                    Inhaltsbereich
─────────────────────────────         ──────────────────────────────────────────
 Agil                                  Titel des Vorgangs
  Auf einem Board suchen               ┌──────────────────────────────────────┐
                                       │ 🤖 KI-Zusammenfassung    📋 ↺ ▲    │
 🤖 KI-Assistent                      │ Der Vorgang beschreibt ...           │
  📝 Zusammenfassung                   └──────────────────────────────────────┘
  ✅ Akzeptanzkriterien bewerten
  📋 Unteraufgaben vorschlagen          Akzeptanzkriterien
  💬 Kommentare analysieren             - Kriterium 1
                                        ┌──────────────────────────────────────┐
 Details                               │ 🤖 KI-Bewertung          📋 ↺ ▲    │
  Typ: Story                           │ ✅ gut                               │
  Status: In Progress                  │ · Vollständigkeit: alle Fälle ...   │
  ...                                  └──────────────────────────────────────┘
```

---

## Installation

### Entwicklermodus (für Tests)

1. Repository klonen oder als ZIP herunterladen:
   ```
   https://github.com/Skub-CL/jiraAIextension/archive/refs/heads/main.zip
   ```
2. Chrome öffnen → `chrome://extensions`
3. **„Entwicklermodus"** (oben rechts) aktivieren
4. **„Entpackte Erweiterung laden"** → entpackten Ordner auswählen
5. Erweiterungs-Icon anklicken → **Optionen** öffnen und konfigurieren

### Enterprise-Deployment via Ivanti DSM

Siehe [Deployment-Anleitung](#deployment-ivanti-dsm) am Ende dieser Datei.

---

## Konfiguration

Die Einstellungen sind über Rechtsklick auf das Erweiterungs-Icon → **„Optionen"** erreichbar.

### 1. Jira-Konfiguration

| Einstellung | Beschreibung |
|---|---|
| **Jira-Basis-URL** | URL der Jira-Instanz, z. B. `https://jira.example.com` |
| **Personal Access Token (PAT)** | In Jira: Profil → Personal Access Tokens → Token erstellen |
| **Akzeptanzkriterien Feld-ID** | ID des Custom Fields, z. B. `customfield_10200` oder kurz `10200`. Zu finden unter Jira-Verwaltung → Felder → Benutzerdefinierte Felder. Leer lassen wenn nicht genutzt. |

> **Sicherheit**: Der PAT wird in `chrome.storage.sync` gespeichert und nicht im Klartext weitergegeben. Alle API-Calls laufen direkt zwischen Browser und Jira/LLM.

### 2. LLM-Backends

Drei Backends werden unterstützt. Das Backend kann **pro Feature** unabhängig zugewiesen werden.

#### Ollama (empfohlen für lokales / internes LLM)

| Einstellung | Standard | Beschreibung |
|---|---|---|
| Basis-URL | `http://localhost:11434` | URL des Ollama-Servers |
| Modell | `llama3` | `ollama list` zeigt verfügbare Modelle |
| Benutzername / Passwort | *(leer)* | Optional: Basic Auth hinter Reverse Proxy |

```bash
# Ollama installieren: https://ollama.com
ollama pull llama3   # Modell laden
ollama serve         # Server starten (Port 11434)
```

> Reasoning-Modelle (DeepSeek-R1, QwQ, o.ä.) werden unterstützt –
> `<think>`-Blöcke werden automatisch aus der Ausgabe entfernt.

#### Microsoft Copilot / Azure OpenAI

| Einstellung | Beschreibung |
|---|---|
| Azure OpenAI Endpoint | Vollständiger Deployment-URL aus dem Azure-Portal |
| API-Version | z. B. `2024-02-01` |
| Modell / Deployment-Name | z. B. `gpt-4o` |
| API-Key | Azure-API-Key (einfachste Option) |
| Tenant-ID + Client-ID | Für OAuth2/SSO via vorhandenem M365-Konto |

**OAuth2-Setup (M365 SSO)**:
1. Azure AD → App-Registrierungen → Neue Registrierung
2. Redirect-URI: Wert aus den Erweiterungs-Einstellungen kopieren
3. API-Berechtigungen: `Cognitive Services → user_impersonation`
4. Tenant-ID und Client-ID eintragen

#### OpenAI-kompatibel (LM Studio, vLLM, LocalAI, Groq …)

| Einstellung | Beschreibung |
|---|---|
| Basis-URL | z. B. `http://localhost:1234/v1` |
| Modell | Modellname |
| API-Key | Leer lassen falls keine Auth nötig |

### 3. LLM-Zuweisung pro Feature

In den Einstellungen → **„LLM-Zuweisung pro Feature"** kann jede der vier Funktionen einem eigenen Backend zugewiesen werden.

### 4. Unteraufgaben-Prompt

In den Einstellungen → **„Unteraufgaben-Prompt"** ist die Prompt-Vorlage direkt einsehbar und anpassbar. Änderungen gelten sofort beim nächsten Klick auf „📋 Unteraufgaben vorschlagen". Mit **„Standard-Vorlage wiederherstellen"** wird der Original-Prompt wiederhergestellt.

Verfügbare Platzhalter im Prompt: `{issueKey}` `{summary}` `{issuetype}` `{description}` `{acceptanceCriteria}` `{existingSubtasks}`

### 5. Sprache

Die KI-Ausgaben werden standardmäßig auf **Deutsch** ausgegeben. Kann in den Einstellungen auf Englisch umgestellt werden.

---

## Nutzung

### KI-Panel aufrufen

Nach dem Öffnen eines Jira-Issues erscheint in der **rechten Spalte unterhalb des „Agil"-Blocks** das Panel **„🤖 KI-Assistent"** mit vier beschrifteten Buttons.

### Funktionen im Detail

**📝 Zusammenfassung**
- Klick → Skeleton-Loader → 3–5 Satz-Zusammenfassung erscheint direkt unter dem Issue-Titel

**✅ Akzeptanzkriterien bewerten** *(nur sichtbar wenn Feld-ID konfiguriert)*
- Klick → Bewertung erscheint unter dem Akzeptanzkriterien-Feld
- Farbiges Badge: ✅ gut · ⚠️ ausreichend · ❌ überarbeitungsbedürftig

**📋 Unteraufgaben vorschlagen**
- Klick → LLM generiert sofort 3–7 Unteraufgaben (konfigurierter Prompt wird verwendet)
- Vorschläge erscheinen als Checkliste unter der Unteraufgaben-Sektion
- **„+ Anlegen"** legt einzelne Unteraufgabe direkt in Jira an
- **„✓ Alle anlegen"** legt alle markierten auf einmal an
- Status-Feedback je Aufgabe: ⏳ wird angelegt … · ✅ PRJ-456 · ❌ Fehlertext

**💬 Kommentare analysieren**
- Klick → Analyse erscheint oberhalb der Kommentar-Liste
- Kategorien: ❓ Offene Fragen · ✅ Entscheidungen · ⚠️ Risiken / Blocker · 📋 Nächste Schritte
- Jede Kategorie ist ein- und ausklappbar

### Block-Steuerung (in jedem Ergebnis-Block)

| Button | Funktion |
|---|---|
| `▲ / ▼` | Block ein-/ausblenden (Zustand bleibt pro Session erhalten) |
| `📋` | Blockinhalt in die Zwischenablage kopieren |
| `↺` | Ergebnis neu laden (erneuter LLM-Call) |

---

## Technische Hinweise

- **SPA-Navigation**: Die Erweiterung erkennt Issue-Wechsel in Jira ohne vollen Seitenreload und injiziert alle Elemente neu.
- **Jira-DOM-Selektoren**: Basieren auf stabilen `id`- und `data-field-id`-Attributen von Jira DC. Bei Anpassungen der Jira-Oberfläche können die Selektoren in `content/injector.js` angepasst werden. Der genaue DOM-Anker für das „Agil"-Panel ist `#greenhopper-agile-issue-web-panel`.
- **Akzeptanzkriterien-Feld-ID**: Akzeptiert sowohl `customfield_10200` als auch die Kurzform `10200`.
- **Reasoning-Modelle**: `<think>`, `<thinking>` und `<reasoning>`-Blöcke werden automatisch aus der Ausgabe gefiltert.

---

## Prompt-Verwaltung

| Feature | Editierbar? | Wo? |
|---|---|---|
| Zusammenfassung | Nein | `prompts/prompts.js` |
| Akzeptanzkriterien-Bewertung | Nein | `prompts/prompts.js` |
| Kommentar-Analyse | Nein | `prompts/prompts.js` |
| Unteraufgaben-Vorschläge | **Ja** | Einstellungen → „Unteraufgaben-Prompt" |

---

## Deployment (Ivanti DSM)

### Schritt 1: Extension packen

Im Chrome-Browser (Entwicklermodus):
1. `chrome://extensions` öffnen
2. **„Erweiterung packen"** → Ordner auswählen
3. Erzeugtes `.crx`-File und privaten Schlüssel sicher aufbewahren

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

> **Hinweis**: Der Jira-PAT muss durch den Endnutzer einmalig in den Erweiterungs-Einstellungen eingetragen werden, da Tokens nutzerspezifisch sind.

---

## Datenschutz & Sicherheit

- Jira-Daten werden **ausschließlich** an die konfigurierten LLM-Server gesendet.
- Kein Datentransfer an externe Cloud-Dienste, sofern ein lokaler/interner LLM-Server genutzt wird.
- Der Jira-PAT wird in `chrome.storage.sync` gespeichert und ist nur der Erweiterung zugänglich.
- Kein `eval()`, kein `innerHTML` mit unkontrollierten Nutzerdaten (XSS-sicher).
