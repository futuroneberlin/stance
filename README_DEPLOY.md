# Deployment-Anleitung (Supabase-first)

Dieses Projekt ist auf eine persistente Supabase-Architektur ausgerichtet.

## 1. Vercel Deployment

1. Repository bei Vercel importieren.
2. Build-Framework: Next.js (automatisch erkannt).
3. Environment Variables setzen (siehe unten).
4. Deploy starten.

## 2. Pflicht-Environment-Variablen

```env
SUPABASE_URL=
SUPABASE_SERVICE_KEY=
ADMIN_SECRET=
OPENAI_API_KEY=
```

Hinweis:
- `SUPABASE_SERVICE_KEY` nur serverseitig verwenden.
- Nicht im Browser oder in public env vars exponieren.

## 3. Datenbankschema anlegen

Führe die Migration aus:

- Datei: `supabase/migrations/20260518_init_semantic_graph.sql`

Enthaltene Tabellen:
- `entries`
- `nodes`
- `links`
- `categories`

## 4. Persistenzverhalten

Die API-Routen schreiben in Supabase:

- `POST /api/entries` -> `entries`
- `POST /api/nodes` -> `nodes`
- `POST /api/links` -> `links`
- `POST /api/categories` -> `categories`
- `POST /api/network` -> Snapshot der `semantic_similarity`-Kanten

Die Runtime liest die semantische Struktur wieder aus Supabase zurück. Lokale JSON-Dateien sind nicht Teil des Live-Pfads.

## 5. Admin

- URL: `/admin`
- Delete und Moderations-Update brauchen `ADMIN_SECRET`.
- Der Key wird als `x-admin-key` an `pages/api/entries.js` gesendet.

## 6. Betriebshinweise

- JSON-Dateien werden nicht mehr als persistenter Runtime-Speicher verwendet.
- Für institutionellen Betrieb empfiehlt sich:
  - regelmäßige DB-Backups,
  - Monitoring auf API-Fehler,
  - optionale RLS-Policies für spätere Rollenmodelle.

