# Art as Stance — Architektur & Nutzerfluss

Dieses Repository implementiert eine zweistufige User Journey und ein lebendes semantisches Archiv. Ziel ist, dass die Anwendung als dynamisches, relationales System erscheint — nicht als statisches Drei-Spalten-Mockup.

**Kernidee (kurz)**
- Zwei-stufige Nutzerreise: Erst Teilnahme (Entry Screen), dann Verarbeitung & Netzwerkansicht.
- Semantische Pipeline verarbeitet Beiträge, erzeugt Kategorien, Relationen und ähnliche Einträge.
- Visualisierung verbindet externe (Internet) Daten, semantische Cluster und User-Beiträge zu einem vernetzten System.

**Wesentliche Prinzipien**
- Auf der ersten Seite (Entry Screen) sind ausschließlich: Titel, Beschreibung, zwei Eingabefelder und ein Submit-Button sichtbar.
- Mindestens ein Feld muss ausgefüllt werden, bevor Submit akzeptiert wird.
- Erst nach Submit startet die Verarbeitung (Anzeige einer Übergangsanimation / Processing-Overlay). Erst danach öffnet sich die vollständige Netzwerkansicht.
- Externe Internetdaten werden nur nach Teilnahme geladen und erscheinen in der LEFT-Spalte.

## Zweistufige User Journey

1) Entry Screen (Seite 1)
- Titel: ART AS STANCE
- Beschreibung: A living glossary where language, participation and external data continuously reshape meaning.
- Zwei Felder: `Art is …` und `I acted through art today by …`
- Pflicht: Mindestens eines der beiden Felder muss ausgefüllt sein.
- Button: Submit → zeigt Verarbeitung an und startet Pipeline.

2) Network View (Seite 2)
- Wird erst nach abgeschlossener (oder gestarteter) Verarbeitung sichtbar.
- Besteht aus drei Bereichen: LEFT (Internetdaten), CENTER (semantische Cluster/Overlaps), RIGHT (User-Einträge & Archiv).
- Visuelle Verbindungsebene (`SemanticOverlay`) zeichnet relationale Pfade zwischen Nodes als animierte SVG-Linien.

## Semantische Verarbeitung (Pipeline)

- Eingaben werden bereitgestellt an die zentrale Pipeline in `pages/index.js` → Analyse → Kategorie-Vorhersage → Relations-Extraktion → Embedding-Anfrage → Ähnlichkeitsberechnung → Link-Generierung.
- Nach Erzeugung der Relationen werden `entries` und `simLinks` gesetzt, die die Visualisierung und Archivfunktionen antreiben.

## LEFT — Internetdaten

- Lädt externe Quellen (Wikipedia, Wikidata, ggf. Datamuse/OpenLibrary) erst nach Teilnahme.
- Reagiert dynamisch auf neue Nutzereingaben und versucht, relevante externe Begriffe zu ziehen und anzuzeigen.

## CENTER — Semantische Cluster

- Visualisiert Overlaps, Brücken und Dichten mit D3-Force-Simulation.
- Nutzt generierte Links (Similarity / Shared Categories) zur Cluster- und Pfad-Bildung.

## RIGHT — User Entries & Archiv

- Zeigt tatsächliche User-Beiträge als strukturierte Nodes mit Kategorien, Verbindungen und Archiv-Informationen.
- Erlaubt neue Beiträge auch aus der Hauptansicht heraus (delegiert an die zentrale Pipeline).

## Visuelle Verbindungen

- `SemanticOverlay` rendert eine SVG-Ebene über dem Layout mit animierten, hover-aktiven Kurven zwischen Nodes.
- Hover hebt Knoten und Pfade hervor und zeigt relationale Pfade.

## Entwicklungs-Hinweise

- Dev-Start:
```
npm install
npm run dev
```
- API-Endpoints (beispielhaft): `/api/entries`, `/api/embeddings`, `/api/fetch-definitions`.
- Lokale Persistenz: Eingaben können in `localStorage` markiert werden, werden aber nicht automatisch zur Umgehung des Entry Screens führen.

## Ziel

Die Anwendung soll wirken wie ein lebendes semantisches Archiv — dynamisch, relational und partizipativ — nicht wie ein statisches Dashboard.

---

Für detaillierte Architekturhinweise oder weitere Anpassungen (z. B. erweiterte NER, persistente Graph-DB, oder verbesserte Embeddings-Pipelines) schreibe mir kurz, dann implementiere ich die nächsten Schritte.
