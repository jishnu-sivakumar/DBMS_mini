# Using a hosted PostgreSQL (Supabase or Neon)

By default PropFind talks to PostgreSQL running **in Docker on your own computer** (`docker compose up -d`).
That database is only reachable from your machine, so nobody else can look at the tables.

PropFind works unchanged with any online PostgreSQL that supports the `pgvector` extension. The only
differences are the connection string and TLS (encrypted connection). The code reads both from `.env`.

> Nothing in the application changes: same schema, same seed, same queries. Only `.env` changes.

---

## Option A: Supabase (recommended: has a web table viewer and SQL editor)

1. Go to <https://supabase.com>, sign in, **New project**. Pick a region close to you and set a **database password**
   (save it, you cannot read it again later).
2. Wait until the project is ready, then open **Connect** (top bar) or **Project Settings > Database**.
3. Copy the **Session pooler** connection string (looks like
   `postgresql://postgres.<project-ref>:[YOUR-PASSWORD]@aws-0-<region>.pooler.supabase.com:5432/postgres`).
   Use the pooler string, not "Direct connection": the direct host is IPv6-only on the free plan and often fails on home networks.
4. Edit **`.env`** (this file is git-ignored, never commit it):
   ```env
   DATABASE_URL=postgresql://postgres.<project-ref>:YOUR_PASSWORD@aws-0-<region>.pooler.supabase.com:5432/postgres
   DATABASE_SSL=true
   ```
   If your password contains characters like `@`, `/` or `#`, URL-encode them (`@` becomes `%40`).
5. Create the tables and load the demo data in the hosted database:
   ```bash
   npm run db:setup      # = db:init (schema, extensions, triggers) + db:seed (data + embeddings)
   ```
   `db:init` enables the `vector` and `uuid-ossp` extensions itself.
6. Start the app as usual (`npm run dev`). It now reads and writes the hosted database.

**Looking at the data online:** Supabase dashboard > **Table Editor** (browse and edit rows, see all 7 tables),
**SQL Editor** (paste anything from `db/queries.sql`), **Database > Extensions** (shows `vector` enabled) and
**Database > Schema Visualizer** (an ER diagram of the real tables).

Notes:
- Free projects pause after about a week of inactivity. Open the dashboard and click **Restore** before a demo.
- The first `npm run db:seed` downloads the ~23 MB embedding model on your computer; the vectors are then uploaded.

## Option B: Neon

1. <https://neon.tech> > create a project (choose Postgres 16 or newer).
2. Copy the connection string from the dashboard (it already ends in `?sslmode=require`).
3. Put it in `.env` as `DATABASE_URL=...` and set `DATABASE_SSL=true`.
4. `npm run db:setup`. Neon has a **Tables** view and a **SQL Editor** in its console.

---

## Important warnings

- **`npm run db:init` drops and recreates every table in whatever database `DATABASE_URL` points at.**
  Check the value of `DATABASE_URL` before you run it. `db:seed` also deletes existing rows first.
- Never paste the connection string (it contains your password) into chat, commits or screenshots.
- To go back to the local Docker database, restore the old `DATABASE_URL` and set `DATABASE_SSL=false`.

## Copying the data you already have locally instead of re-seeding

Re-running `db:seed` is simpler and gives the same demo data. If you want to copy accounts or listings you created by hand,
dump the local database and load it into the hosted one with the client tools that already ship in the Docker image:

```bash
docker exec propfind-db pg_dump -U postgres --no-owner --no-privileges --clean --if-exists propfind_db \
  | docker exec -i propfind-db psql "postgresql://postgres.<ref>:PASSWORD@<host>:5432/postgres"
```

## Why this is the right choice for this project

The requirements ask for **SQL plus a vector database** (Option 2). PostgreSQL with `pgvector` is both, in one engine,
and Supabase and Neon are hosted PostgreSQL, so moving online does not change the design, the SQL, or the demo.
MongoDB would not help: it is a different (document) model and has no role in this design.
