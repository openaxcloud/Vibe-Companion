# Database Schema Management

## Migration Strategy

This project uses **versioned forward-only SQL migrations**, applied
via `npm run db:migrate`. We deliberately do *not* use
`drizzle-kit push` in any normal workflow — `push` syncs the schema
directly to the live DB and can silently drop columns or tables when
the in-code schema diverges (which has burned us in the past — see
the `*_legacy_archived` tables for evidence).

### Development workflow

1. Edit `shared/schema.ts`.
2. Run `npm run db:generate` — drizzle-kit produces a SQL diff in
   `migrations/NNNN_<name>.sql`.
3. Review the SQL. Adjust if needed (rename columns instead of
   drop+create, add backfill, etc).
4. Run `npm run db:migrate` to apply locally.
5. Commit both the schema change and the new SQL file.

### Production deploy

CI runs `npm run db:migrate` before booting the app. The runner is
idempotent — re-running on a fully-migrated DB is a no-op. The
runner records each applied file in `_drizzle_migrations` (id +
sha256) so a future re-run skips it.

### Bootstrap on a long-lived DB

If you point the runner at a DB that pre-dates the runner (e.g.
production), the first invocation goes into bootstrap mode: it
detects the `users` table already exists and marks all migrations
0000..0024 as applied without running them (those are the
historical schema-creation migrations and are not idempotent).
Migrations 0025+ are authored with `IF NOT EXISTS` /
archive-and-recreate guards and ARE safe to re-run.

### Commands

```bash
npm run db:generate            # produce a new SQL file from schema diff
npm run db:migrate             # apply unrun migrations (idempotent)
npm run db:push:dangerous      # drizzle-kit push — DO NOT USE IN PROD
                               # legitimate uses: throwaway dev DB,
                               # or after careful schema reset.
npm run db:studio              # open Drizzle Studio
```

### When to write a migration manually instead of using `db:generate`

`drizzle-kit generate` does not handle:
- Renames (it sees `drop+create`, losing data).
- Backfills (it doesn't know how to populate new NOT NULL columns).
- Legacy table archival (the pattern in 0023, 0025, 0026: rename
  `tableA` → `tableA_legacy_archived`, then create the canonical
  Drizzle-shaped table).

For those cases, hand-write the SQL file with the same numeric prefix
the generator would have used.
