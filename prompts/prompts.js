// Central prompt templates for all features.
// Only the subtasks prompt is user-editable via the options/dialog.

export const PROMPTS = {
  summary: `Du bist ein erfahrener Projektmanager. Fasse den folgenden Jira-Vorgang präzise zusammen.

Vorgang: {issueKey} – {summary}
Typ: {issuetype}
Status: {status}
Priorität: {priority}

Beschreibung:
{description}

Erstelle eine kurze, verständliche Zusammenfassung (3–5 Sätze) auf {language}.
Fokussiere auf: Was soll erreicht werden? Was ist der aktuelle Stand?`,

  acceptance: `Du bist ein erfahrener Scrum Master und Quality Engineer.
Bewerte die folgenden Akzeptanzkriterien für den Jira-Vorgang {issueKey}.

Vorgang: {summary}
Typ: {issuetype}

Akzeptanzkriterien:
{acceptanceCriteria}

Beurteile die Akzeptanzkriterien nach folgenden Dimensionen:
1. Vollständigkeit – Sind alle relevanten Szenarien abgedeckt?
2. Testbarkeit – Sind die Kriterien eindeutig testbar?
3. Verständlichkeit – Sind sie für alle Beteiligten klar formuliert?
4. Eindeutigkeit – Gibt es Interpretationsspielraum?

Antworte mit:
- Gesamtbewertung (gut/ausreichend/überarbeitungsbedürftig)
- Konkrete Verbesserungsvorschläge als Liste
- Optional: Vorschläge für fehlende Szenarien

Antworte auf {language}.`,

  // Default template – users can customize this per-issue via the dialog.
  subtasks: `Du bist ein erfahrener Software-Entwickler und Scrum-Praktiker.
Analysiere den folgenden Jira-Vorgang und schlage konkrete Unteraufgaben vor.

Vorgang: {issueKey} – {summary}
Typ: {issuetype}
Beschreibung: {description}
Akzeptanzkriterien: {acceptanceCriteria}
Bereits vorhandene Unteraufgaben: {existingSubtasks}

Erstelle 3–7 konkrete, umsetzbare Unteraufgaben.
Beachte: Schlage keine Aufgaben vor, die bereits als Unteraufgabe existieren.

Antworte ausschließlich als JSON-Array:
[
  {
    "summary": "Kurzer Titel der Unteraufgabe",
    "description": "Optionale kurze Beschreibung (max. 2 Sätze)"
  }
]

Keine zusätzlichen Erklärungen außerhalb des JSON.`,

  comments: `Du bist ein erfahrener Projektmanager. Analysiere die folgenden Kommentare
zum Jira-Vorgang {issueKey}.

Vorgang: {summary}

Kommentare (chronologisch):
{comments}

Extrahiere und kategorisiere:
1. Offene Fragen / ungeklärte Punkte
2. Getroffene Entscheidungen
3. Identifizierte Risiken oder Blocker
4. Nächste Schritte / Action Items (falls erwähnt)

Falls eine Kategorie leer ist, weise darauf hin.
Antworte auf {language}.`
};

/**
 * Replaces {placeholder} variables in a template with actual values.
 * Unknown placeholders are left as-is.
 */
export function fillTemplate(template, vars) {
  return template.replace(/\{(\w+)\}/g, (match, key) => {
    return vars[key] !== undefined ? String(vars[key]) : match;
  });
}
