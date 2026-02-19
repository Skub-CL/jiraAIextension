# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

---

## Project Overview

A Chrome Extension (Manifest V3) that embeds AI analysis directly into Jira Data Center issue pages. Uses the "Keepa pattern" – LLM results are injected as native-looking blocks next to existing Jira UI sections, triggered on-demand by 🤖 buttons.

**No build step required.** Load the directory directly in Chrome developer mode.

---

## Common Commands

```bash
# Load/reload in Chrome (no CLI – done in browser)
# chrome://extensions → Enable Developer Mode → Load unpacked → select this directory

# Validate manifest
python3 -c "import json; json.load(open('manifest.json')); print('manifest OK')"

# Regenerate icons (if icons/ need to be rebuilt)
python3 -c "
import struct, zlib, os
def make_png(size):
    w,h=size,size
    pixels=[]
    for y in range(h):
        row=[]
        for x in range(w):
            cx,cy=x-w/2,y-h/2
            r=min(w,h)*0.42
            dist=(cx**2+cy**2)**0.5
            if dist<=r: row.extend([101,84,192,255])
            else: row.extend([0,0,0,0])
        pixels.append(row)
    def chunk(t,d): c=zlib.crc32(t+d)&0xffffffff; return struct.pack('>I',len(d))+t+d+struct.pack('>I',c)
    raw=b''.join(b'\\x00'+bytes(r) for r in pixels)
    png=b'\\x89PNG\\r\\n\\x1a\\n'+chunk(b'IHDR',struct.pack('>IIBBBBB',w,h,8,6,0,0,0))+chunk(b'IDAT',zlib.compress(raw,9))+chunk(b'IEND',b'')
    return png
[open(f'icons/icon{s}.png','wb').write(make_png(s)) for s in [16,48,128]]
"
```

---

## Architecture

### Two separate JS module systems

| Context | Module system | Reason |
|---|---|---|
| **Service worker** (`background/`) | ES modules (`import`/`export`) | Manifest V3 supports `"type": "module"` for service workers |
| **Content scripts** (`content/`) | Global namespace `window.JiraLLM` | Chrome does not support ES module imports in content scripts |
| **Options page** (`options/`) | Plain `<script>` tag | Standard HTML page |

### Message flow

```
Content Script                    Service Worker
     │                                 │
     │  chrome.runtime.sendMessage()   │
     │ ──────────────────────────────► │  reads chrome.storage.sync
     │                                 │  calls Jira REST API
     │                                 │  renders prompt via prompts.js
     │                                 │  calls LLM backend
     │  response callback              │
     │ ◄────────────────────────────── │
     │                                 │
     ▼
  Block renders HTML
```

All Jira REST API and LLM calls happen **in the service worker** to bypass content-script CORS restrictions.

### Key files

| File | Purpose |
|---|---|
| `background/service-worker.js` | Central dispatcher – receives messages, orchestrates Jira API + LLM calls |
| `utils/llm-client.js` | Routes `complete(feature, prompt, settings)` to the right backend |
| `utils/jira-api.js` | Jira REST API v2 wrapper; `extractText()` handles ADF and Wiki markup |
| `prompts/prompts.js` | All prompt templates + `fillTemplate()` variable substitution |
| `content/injector.js` | Finds Jira DOM anchor points, injects 🤖 trigger buttons |
| `content/dom-observer.js` | MutationObserver for SPA navigation detection; `extractIssueKey()` |
| `content/content-script.js` | Entry point – URL check, settings load, initializes Injector + DOMObserver |
| `content/blocks/block-base.js` | Base class: `attach()`, `showSkeleton()`, `showError()`, `showContent()`, toggle, copy |
| `options/options.js` | Settings CRUD + connection test buttons |
| `styles/injection.css` | All injected UI styles (Jira-native look with violet `#6554C0` left border) |

### Content script load order (matters – defined in manifest.json)

```
block-base.js → block-summary.js → block-acceptance.js →
block-subtasks.js → block-comments.js →
injector.js → dom-observer.js → content-script.js
```

Each file begins with `window.JiraLLM = window.JiraLLM || {};` and attaches to that namespace.

---

## Storage Schema (`chrome.storage.sync`)

```javascript
{
  // Jira
  jiraBaseUrl: "https://jira.example.com",
  jiraApiToken: "<PAT>",
  acceptanceCriteriaFieldId: "customfield_10200",  // empty = feature disabled

  // Ollama
  ollamaBaseUrl: "http://localhost:11434",
  ollamaModel: "llama3",
  ollamaUsername: "",   // optional Basic Auth
  ollamaPassword: "",

  // Copilot / Azure OpenAI
  copilotEndpoint: "https://...",
  copilotApiVersion: "2024-02-01",
  copilotModel: "gpt-4o",
  copilotApiKey: "",       // API-Key auth (simpler)
  copilotClientId: "",     // OAuth2 / Entra ID (enterprise SSO)
  copilotTenantId: "",

  // OpenAI-compatible
  openaiBaseUrl: "",
  openaiApiKey: "",
  openaiModel: "gpt-4",

  // Per-feature backend routing
  llmRouting: {
    summary: "ollama",
    acceptance: "ollama",
    subtasks: "ollama",
    comments: "ollama"
  },

  language: "de",    // "de" | "en"

  // User-editable subtasks prompt (empty = use built-in default)
  promptSubtasksCustom: ""
}
```

---

## Jira DOM Selectors

Defined in `content/injector.js`. Targets Jira Data Center stable attributes:

```javascript
// Issue title
'#summary-val, h1[data-field-id="summary"], .issue-header-content'

// Acceptance criteria (configured field ID required)
`[data-field-id="${fieldId}"], #${fieldId}-val, #${fieldId}`

// Subtasks section
'#subtasks-section, [data-panel-id="subtasks"], .issuePanelContainer.subtasks-panel'

// Activity / Comments
'#activity-stream, .activity-section, #issue-tabs, [data-panel-id="activity"]'
```

If selectors break after a Jira upgrade, update `_injectSummary()`, `_injectAcceptance()`, `_injectSubtasks()`, `_injectComments()` in `injector.js`.

---

## Adding a New LLM Backend

1. Create `utils/my-backend-client.js` with a `complete(prompt)` method
2. Import it in `utils/llm-client.js` and add a `case 'mybackend':` branch
3. Add configuration fields in `options/options.html` and `options/options.js`
4. Add the backend option to the routing dropdowns in `options.html`
5. Update default settings in `background/service-worker.js` (DEFAULTS object)

## Adding a New Feature Block

1. Create `content/blocks/block-myfeature.js` extending `window.JiraLLM.BlockBase`
2. Implement `async analyze()` – call `this._send({action:'analyzeIssue', feature:'myfeature', issueKey:this.issueKey})` and call `this.showContent(html)` or `this.showError(msg)`
3. Add the prompt template to `prompts/prompts.js`
4. Handle the feature in `background/service-worker.js` → `analyzeIssue()`
5. Add the trigger button injection in `content/injector.js`
6. Add the script to the `content_scripts.js` array in `manifest.json` (before `injector.js`)
