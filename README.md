# Readwise Inbox for Obsidian

**Readwise Inbox** ist ein Obsidian-Plugin zur Verarbeitung von Readwise-Highlights. Highlights werden als Inbox angezeigt und können direkt in **Anki-Mastery-Karten**, **Atomic Notes im Obsidian Vault** oder **Skip** überführt werden.

Das Projekt ist aus einer Single-File-HTML-App entstanden. Diese App liegt weiterhin als Referenz unter `reference/index.html`, ist aber nicht mehr die Zielarchitektur. Die produktive Richtung ist ein TypeScript-basiertes Obsidian Community Plugin mit Vault-Dateien statt IndexedDB/Gist-Sync.

---

## Status

**Aktueller Stand:** frühes Plugin-MVP nach Sprint 1

Bereits vorhanden:

* Obsidian Plugin Bootstrap mit TypeScript
* gebündeltes `main.js`
* `manifest.json`
* `styles.css`
* eigene Readwise-Inbox-View in Obsidian
* Plugin-Settings für Readwise Token, Decknamen, State-Dateipfad und Zettel-Zielordner
* Vault-State über `readwise-inbox.json`
* manueller Readwise-Fetch über die Readwise Export API
* Inbox-Anzeige für unverarbeitete Highlights
* Skip-Funktion
* Mastery Card Modal mit AnkiConnect-Push
* Atomic Note Modal
* direkte Markdown-Dateierstellung im Vault
* Structured-Tree-Dateinamen über Parent-Fuzzy-Search
* warme Papier-/Schreibtisch-Ästhetik

Noch nicht produktionsreif / später geplant:

* vollständiger Memrise-HITL-Workflow
* Pending Cards Queue
* GPT-Handoff für Mastery-Drafts
* robuste AnkiConnect-Sendewarteschlange
* BRAT-Testworkflow
* Markdown-gerenderte Highlight-Vorschau mit Quellenlinks
* Mobile-Strategie für AnkiConnect
* ausführliche Fehler-/Konfliktbehandlung für `readwise-inbox.json`

---

## Grundidee

Readwise Inbox ist für einen lokalen, kontrollierten Wissensworkflow gedacht:

1. Highlights aus Readwise laden
2. Highlight in Obsidian prüfen
3. Entscheidung pro Highlight treffen:

   * **Mastery Card** → nach Anki senden
   * **Atomic Note** → als Markdown-Datei im Vault anlegen
   * **Skip** → aus der Inbox entfernen

Das Plugin soll keine zweite komplette Readwise-Datenbank aufbauen. `readwise-inbox.json` enthält nur temporäre Arbeitsdaten: unverarbeitete Highlights, Cursor/State und künftig Pending Cards.

---

## Features

### Readwise Inbox

Die Inbox zeigt alle Highlights mit Status `inbox`.

Pro Highlight stehen aktuell Aktionen bereit:

* **Mastery Card**
* **Atomic Note**
* **Skip**

Der Fetch erfolgt manuell über die View. Beim ersten Laden wird ein begrenzter Erstimport verwendet; danach arbeitet der Fetch cursor-basiert weiter.

---

### Mastery Cards via AnkiConnect

Das Plugin kann aus einem Highlight eine Mastery-Anki-Karte erzeugen.

Aktuelles Mastery-Modell:

```ts
"Mastery-Notiztyp"
```

Felder:

| Feld      | Inhalt                                             |
| --------- | -------------------------------------------------- |
| `Frage`   | Nutzer-Input                                       |
| `Antwort` | Nutzer-Input                                       |
| `Zitat`   | Highlight-Text mit Autor, Quelle und Readwise-Link |
| `Notizen` | Readwise-Notiz bzw. Nutzer-Input                   |
| `Medien`  | Autor, Titel, Kategorie, Quellenlink, Cover        |

AnkiConnect wird über diesen lokalen Endpoint angesprochen:

```text
http://localhost:8765
```

Anki muss laufen und das AnkiConnect-Addon muss installiert sein.

---

### Atomic Notes im Vault

Atomic Notes werden direkt als `.md`-Dateien im Obsidian Vault erstellt und anschließend in einem neuen Tab geöffnet.

Das erzeugte Markdown folgt diesem Muster:

```md
---
title: Beispiel-Titel
alias: Beispiel-Titel
desc: Kurze Beschreibung
tags:
  - proto-atomic
created: 2026-06-08
rwi_source: readwise
---

# Beispiel-Titel

Eigene Notiz / Gedanke

## 📖 Quelle

„Highlight-Text"
(Autor, Quellentitel)
[📖 Original in Readwise](https://readwise.io/...)
```

Das Frontmatter-Feld

```yaml
rwi_source: readwise
```

markiert Notizen, die aus der Readwise Inbox entstanden sind.

---

### Structured-Tree-Dateinamen

Neue Zettel verwenden keine Timestamp-Dateinamen.

Stattdessen wird die Hierarchie über Punkte im Dateinamen kodiert:

```text
<parent-basename>.<kürzel>.md
```

Beispiel:

```text
Ideologie.Nihonjinron.jap-Imp.md
```

Ablauf:

1. Nutzer wählt per Fuzzy Search eine bestehende Markdown-Datei als Parent.
2. Das Plugin nutzt deren `file.basename`.
3. Nutzer gibt ein Kürzel ein.
4. Das Plugin erzeugt daraus den neuen Dateinamen.

---

## Installation für lokale Entwicklung

Repository klonen:

```bash
git clone <REPOSITORY_URL>
cd Readwise-Zettel-Inbox-for-obsidian
```

Dependencies installieren:

```bash
npm install
```

Build ausführen:

```bash
npm run build
```

Optional: Readwise-Mapping-Fixture testen:

```bash
npm run test:readwise-fixture
```

---

## Manuelle Installation in einem Obsidian-Test-Vault

Nach dem Build müssen diese Dateien in den Plugin-Ordner eines Obsidian Vaults kopiert werden:

```text
manifest.json
main.js
styles.css
```

Zielordner im Vault:

```text
.obsidian/plugins/readwise-inbox/
```

Falls der Ordner noch nicht existiert:

```text
<Vault>/.obsidian/plugins/readwise-inbox/
```

Danach in Obsidian:

1. Einstellungen öffnen
2. Community Plugins aktivieren
3. „Readwise Inbox“ aktivieren
4. Command Palette öffnen
5. `Readwise Inbox öffnen` ausführen

---

## Plugin Settings

Aktuelle Einstellungen:

| Setting            | Beschreibung                                                   |
| ------------------ | -------------------------------------------------------------- |
| Readwise API Token | Token für die Readwise API                                     |
| Mastery Deck       | Zieldeck für Mastery Cards                                     |
| Memrise Deck       | vorbereitet, aber noch kein vollständiger Memrise-Flow         |
| State-Dateipfad    | Pfad zur `readwise-inbox.json`, Default: `readwise-inbox.json` |
| Zettel-Zielordner  | Zielordner für neu erzeugte Atomic Notes; leer = Vault-Root    |

Tokens werden in den Obsidian-Plugin-Daten gespeichert, nicht in `readwise-inbox.json`.

---

## Datenmodell

Der temporäre Inbox-State liegt in einer Vault-Datei, standardmäßig:

```text
readwise-inbox.json
```

Vereinfachte Struktur:

```ts
interface InboxState {
  highlights: Highlight[];
  cards_pending: CardPending[];
  last_readwise_cursor: string | null;
  updatedAt: string;
  schemaVersion: number;
}
```

Ein Highlight hat unter anderem:

```ts
interface Highlight {
  id: string;
  readwise_id: string;
  text: string;
  note: string;
  source_title: string;
  source_author: string;
  source_url: string;
  source_cover: string;
  highlighted_at: string;
  category: string;
  readwise_url: string;
  status: "inbox" | "processed" | "skipped";
  loadedAt: string;
  updatedAt: string;
}
```

---

## Architektur

```text
.
├── manifest.json
├── main.js
├── package.json
├── package-lock.json
├── styles.css
├── esbuild.config.mjs
├── tsconfig.json
├── index.html
├── reference/
│   └── index.html
├── src/
│   ├── AnkiConnect.ts
│   ├── InboxState.ts
│   ├── InboxView.ts
│   ├── ReadwiseApi.ts
│   ├── ReadwiseMapping.ts
│   ├── ZettelCreator.ts
│   ├── main.ts
│   └── types.ts
└── tests/
    └── readwise-export-fixture.test.ts
```

### Wichtige Module

| Datei                    | Aufgabe                                                          |
| ------------------------ | ---------------------------------------------------------------- |
| `src/main.ts`            | Plugin-Lifecycle, Settings, Commands, View-Registrierung         |
| `src/InboxView.ts`       | Obsidian ItemView, Inbox-Rendering, Aktionen                     |
| `src/InboxState.ts`      | Lesen/Schreiben von `readwise-inbox.json`                        |
| `src/ReadwiseApi.ts`     | Readwise Fetch                                                   |
| `src/ReadwiseMapping.ts` | Mapping der Readwise Export API auf interne Highlights           |
| `src/AnkiConnect.ts`     | AnkiConnect-Request, Mastery-Payload                             |
| `src/ZettelCreator.ts`   | Atomic Note Modal, Parent-Fuzzy-Search, Markdown-Dateierstellung |
| `src/types.ts`           | zentrale TypeScript-Interfaces                                   |
| `reference/index.html`   | ursprüngliche Single-File-App als Referenz                       |

---

## Development Scripts

```bash
npm run dev
```

Startet esbuild im Watch-Modus.

```bash
npm run build
```

Führt TypeScript-Check und Production-Build aus.

```bash
npm run test:readwise-fixture
```

Testet das Readwise-Export-Mapping gegen eine Fixture.

---

## Aktuelle Grenzen

### AnkiConnect

AnkiConnect funktioniert realistisch nur dort, wo Anki lokal läuft und `http://localhost:8765` erreichbar ist. Auf Obsidian Mobile ist das nicht ohne Weiteres nutzbar.

### Memrise

Die Modellnamen sind vorbereitet, aber der vollständige Memrise-HITL-Workflow ist noch nicht Sprint-1-Scope.

Wichtig: Der Anki-Modellname enthält absichtlich den Tippfehler `Listenting`. Nicht korrigieren, wenn das Modell in Anki exakt so heißt.

```ts
const MODELS = {
  mastery: "Mastery-Notiztyp",
  mc: "Memrise (Lτ) Preset [Translation+Listenting | MultipleChoice+Typing] v5.1",
  tapping: "Memrise (Lτ) Preset [Translation+Listenting | Tapping+Typing] v5.1",
  cloze: "Memrise (Lτ) Cloze Template v5.1"
};
```

### State-Konflikte

`readwise-inbox.json` ist eine Vault-Datei. Wenn mehrere Geräte gleichzeitig dieselbe Datei bearbeiten oder synchronisieren, gibt es aktuell noch keine ausgearbeitete Konfliktlösung.

---

## Roadmap

Naheliegende nächste Schritte:

### 1. Inbox-UX-Polish

* Highlight-Text über Obsidian MarkdownRenderer rendern
* Links im Highlight klickbar machen
* Button „In Readwise öffnen“
* Button „Quelle öffnen“
* fehlende URLs defensiv behandeln

### 2. Mastery Card Queue

* Highlights als Mastery-Kandidaten markieren
* mehrere Highlights in GPT-Handoff-Prompt überführen
* GPT-JSON wieder importieren
* Mastery-Drafts in `cards_pending` speichern
* Drafts einzeln oder gesammelt an AnkiConnect senden
* Fehlerstatus erhalten statt Datenverlust

### 3. Pending Cards Ansicht

* ungesendete Anki-Drafts anzeigen
* bearbeiten
* erneut senden
* verwerfen
* als erledigt markieren

### 4. BRAT-Testworkflow

* Plugin über BRAT in einem Test-Vault installieren
* Updates reproduzierbar testen
* manuelles Kopieren von `manifest.json`, `main.js`, `styles.css` reduzieren

### 5. AnkiConnect-Hinweise

* Settings um verständlichere Setup-Hinweise ergänzen
* typische Fehler wie `Failed to fetch` besser erklären

---

## Projektprinzipien

* lokal-first
* kein eigener Server
* Vault-Dateien statt Cloud-Backend
* Readwise-Daten nur als temporärer Arbeitsstate
* Markdown-Dateien sind nach Erstellung die eigentlichen Zettel
* Obsidian-native Workflows statt paralleler Datenbank
* sichere Zwischenzustände vor blindem Senden an Anki
* kleine, prüfbare Sprints statt großer Komplettport

---

## Lizenz

MIT
