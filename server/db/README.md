# Database Schema Management

## Migration Strategy

This project uses Drizzle ORM with `db:push` for schema management, not traditional SQL migrations.

### Development Workflow

1. Modify schemas in `shared/schema.ts`
2. Run `npm run db:push` to sync changes
3. If there are data-loss warnings, use `npm run db:push --force`

### Why db:push Instead of Migrations?

- **Simplicity**: No migration files to manage
- **Speed**: Direct schema sync without versioning
- **Replit Compatibility**: Works well with Replit's PostgreSQL

### Important Notes

- NEVER manually write SQL migrations
- NEVER change primary key types (serial ↔ varchar)
- Always check existing schema before making changes

### Commands

```bash
npm run db:push          # Sync schema changes
npm run db:push --force  # Force sync with potential data loss
npm run db:studio        # Open Drizzle Studio
```
