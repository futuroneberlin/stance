# Deployment-Anleitung (einfach)

Das Repository enthält jetzt ein minimales Next.js-Frontend, eine API-Route und eine Visualisierung.

Empfohlene Schritte zum Deployment auf Vercel (keine Terminal-Erfahrung nötig):

1. Öffne https://vercel.com und melde dich an oder erstelle ein Konto.
2. Wähle "Import Project" → verbinde dein GitHub-Repo `futuroneberlin/stance`.
3. Vercel erkennt Next.js automatisch. Klicke auf "Deploy".

Für spätere Kategorien-Analyse / persistente Speicherung empfehle ich einen externen Datenservice (z.B. Firebase, Supabase oder ein kleines Server-Backend).

Persistente Speicherung per Git-Commit (Option B)
------------------------------------------------
Wenn du möchtest, dass Einträge dauerhaft im Git-Repository landen (ohne Supabase), kann die App beim Absenden die Datei `data/entries.json` ins Repo committen.

Schritte:
1. Erstelle ein GitHub Personal Access Token mit `repo`-Rechten (Settings → Developer settings → Personal access tokens). Kopiere das Token.
2. In Vercel: Project → Settings → Environment Variables → Add:
	- `GH_WRITE_TOKEN` = dein Token
	- `GITHUB_REPO_OWNER` = dein GitHub-Benutzername oder Org
	- `GITHUB_REPO_NAME` = `stance`
	- optional `GITHUB_BRANCH` = `main` (Standard)
3. Nach dem Setzen der Env-Variablen werden neue POST-Anfragen an `/api/entries` versuchen, die Datei `data/entries.json` per GitHub API zu committen.

Sichtbarkeit / Datenschutz
--------------------------
- Wenn dein GitHub-Repository öffentlich ist, sind alle Einträge, die commitet werden, für jeden sichtbar.
- Wenn das Repo privat ist, sind die Einträge nur für Personen mit Zugriff auf das Repo sichtbar.

Wenn du Datenschutz möchtest (nicht öffentlich), empfehle ich stattdessen Supabase/Firebase oder ein privates Repo.

Supabase Integration (Option A)
-------------------------------
Wenn du Supabase nutzen möchtest (empfohlen für strukturierte, private Speicherung), folge diesen Schritten:

1. Gehe zu https://app.supabase.com und erstelle ein neues Projekt.
2. Merke dir die `Project URL` und den `Service Role` Key (unter Settings → API).
3. Erstelle eine Tabelle `entries` (SQL Editor) mit folgendem minimalen Schema:

```sql
create table if not exists entries (
	id text primary key,
	text text,
	category jsonb,
	timestamp bigint,
	relations jsonb
);
```

4. In Vercel: Project → Settings → Environment Variables → Add:
	 - `SUPABASE_URL` = deine Supabase-Project-URL
	 - `SUPABASE_SERVICE_KEY` = Service Role Key (serverseitig, vertraulich)
	- `ADMIN_SECRET` = ein selbst gewaehltes Admin-Passwort (fuer Loeschen/Status-Update)

5. Nach Setzen dieser Variablen verwendet die API `pages/api/entries.js` Supabase für Lesen und Schreiben der Einträge.

Sichtbarkeit: Wenn Supabase-Datenbank öffentlich lesbar konfiguriert ist, können Einträge öffentlich sein — standardmäßig sind Zugriffsschlüssel erforderlich, also sind die Daten privat, solange du die Keys nicht offenlegst.

Admin-Seite
-----------
- URL: `/admin`
- Dort setzt du deinen `ADMIN_SECRET` als "Admin Key" im Browser.
- Aktionen in der Admin-Seite:
	- Eintraege loeschen
	- Optional Moderationsstatus setzen (`approved`, `flagged`, `none`) fuer spaeter

Optionales Supabase-Tabellenfeld fuer Status:
```sql
alter table entries
add column if not exists moderation_status text;
```

