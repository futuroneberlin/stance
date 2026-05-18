# Art as Stance

Art as Stance ist als dauerhaft wachsendes semantisches System gebaut. Jeder Beitrag wird in Supabase gespeichert, daraus werden Knoten, Kategorien und Relationen abgeleitet, und die Netzstruktur wächst bei jeder Teilnahme weiter.

## 1. User Journey

### Phase 1: Entry Screen only
- Sichtbar sind ausschließlich Titel, Beschreibung, zwei Felder und Submit.
- Mindestens ein Feld muss ausgefüllt sein.
- Vor der Teilnahme werden keine Zonen, Netzwerke oder Diagramme gerendert.

### Phase 2: Semantischer Raum
- Nach dem Submit startet die Verarbeitung mit Overlay und Reveal-Transition.
- Erst danach erscheinen LEFT / CENTER / RIGHT sowie der Connection Layer.

## 2. Persistente Architektur (Supabase)

Die Runtime speichert semantische Daten in Supabase-Tabellen:

- `entries`: Rohbeiträge und semantische Felder pro Beitrag.
- `nodes`: normalisierte Knoten des Graphen (entry, category, term, external_entry).
- `links`: relationale Kanten zwischen Knoten (z. B. `semantic_similarity`, `classified_as`, `mentions`).
- `categories`: Kategoriestamm mit Nutzungszählern.

SQL-Schema/Migration:
- `supabase/migrations/20260518_init_semantic_graph.sql`

## 3. Datenfluss und Semantik

Pipeline (in `pages/index.js`):

1. Nutzer gibt Text ein und sendet ab.
2. Das System speichert den Beitrag über `POST /api/entries` in Supabase.
3. Externe Datenquellen werden geladen (`/api/fetch-definitions`) und als zusätzliche Entries behandelt.
4. Kategorien und Relations-Tokens werden aus allen bekannten Texten extrahiert oder ergänzt.
5. Embeddings werden berechnet (`/api/embeddings`).
6. Cosine Similarity erzeugt `semantic_similarity`-Links.
7. Die vollständigen semantischen Artefakte werden zurück in Supabase geschrieben.

## 4. Welche Daten wohin gehen

- `entries`: Rohbeiträge und ihre semantische Anreicherung. Wichtige Felder: `id`, `text`, `category[]`, `relations[]`, `source`, `timestamp`, `moderation_status`, `metadata`.
- `nodes`: normalisierte Graph-Knoten für Beiträge, Kategorien und Terme. Wichtige Felder: `node_id`, `label`, `node_type`, `source_entry_id`, `metadata`.
- `links`: relationale Kanten zwischen Knoten. Wichtige Felder: `source_node_id`, `target_node_id`, `relation_type`, `weight`, `context_entry_id`, `metadata`.
- `categories`: Kategoriestamm mit Nutzungszählung und optionaler Beschreibung. Wichtige Felder: `category_key`, `label`, `usage_count`, `description`, `metadata`.

## 5. LEFT / CENTER / RIGHT als zusammenhängendes System

- LEFT: externe Begriffe und Referenzen reagieren auf die aktuelle Eingabe und spiegeln außerhalb des Systems liegende Bezüge.
- CENTER: zeigt Cluster, Overlaps, Brücken und Dichte im Kern der semantischen Struktur.
- RIGHT: zeigt User-Einträge, deren Kategorien und die direkt abgeleiteten Verbindungen.
- Verbindungsebene: `SemanticOverlay` zeichnet relationale SVG-Pfade zwischen den Zonen auf Basis persistierter Links.

## 6. Wie das Netzwerk wächst

Das Netzwerk skaliert inkrementell:

- Jeder neue Beitrag erzeugt mindestens einen Entry-Node.
- Kategorien und Terme werden als wiederverwendbare Nodes upserted, nicht doppelt angelegt.
- Neue Kanten verbinden bestehende und neue Nodes über stabile IDs.
- Wiederholte Begriffe und Kategorien verdichten Cluster statt Duplikate zu erzeugen.

## 7. Modularität und institutionelle Skalierbarkeit

Bausteine:

- Client Persistence Layer: `lib/persistence.js`
- Server DB Client: `lib/supabaseAdmin.js`
- API-Module:
	- `pages/api/entries.js`
	- `pages/api/categories.js`
	- `pages/api/nodes.js`
	- `pages/api/links.js`
	- `pages/api/network.js`

Diese Trennung erlaubt:

- spätere RLS-Policies und Rollenmodelle,
- Monitoring/Audit auf Tabellenebene,
- institutionelle Erweiterung (mehr Quellen, kuratorische Workflows, Moderation).

## 8. Status der lokalen JSON-Dateien

Die Dateien in `data/` sind keine Runtime-Quelle mehr. Das laufende System liest und schreibt ausschließlich über die Supabase-Tabellen und die API-Routen; die JSON-Dateien bleiben höchstens als historische Snapshots oder Seed-Artefakte im Repository.

## 9. Setup

```bash
npm install
npm run dev
```

Erforderliche Variablen (Server):

```env
SUPABASE_URL=
SUPABASE_SERVICE_KEY=
ADMIN_SECRET=
OPENAI_API_KEY=
```

## 10. Wichtiger Hinweis

Die Persistenz ist auf Supabase ausgerichtet. Lokale JSON-Dateien dienen nicht mehr als Runtime-Storage-Pfad fuer `entries`, `nodes`, `links`, `categories`.
