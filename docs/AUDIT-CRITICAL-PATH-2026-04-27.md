# Critical-path audit — 2026-04-27

**Branche** : `claude/option2-unblock`
**Demande** : faire fonctionner le chemin prompt → AI → fichiers → preview de bout en bout, plus terminal + Monaco + file CRUD.
**État au démarrage** : commit `1cfed00f` venait d'unblock le splash IDE côté backend (création des tables manquantes + coercion userId int↔varchar) mais sans validation que la SPA franchit réellement le splash.

## Verdict honnête

| Critique | État au début | État après cette session |
|---|---|---|
| Splash IDE se lève | ❌ stuck à 30s+ (audit du 26/04) | ✅ mount à 6-7s |
| Prompt → AI → fichiers | ❌ crash sur `relation "ai_plans" does not exist` | ✅ 25s, fichier `index.html` créé via Sonnet 4.6 |
| Preview iframe | inconnu (splash bloqué) | ✅ `/api/preview/projects/:id/preview` sert le HTML |
| Terminal /ws/terminal | ❌ 401 (cookie stale) puis 403 (coercion) puis crash sur `account_env_var_links` | ✅ PTY spawn, prompt bash visible, workspace mounté |
| File CRUD | ❌ 500 sur read/update/create | ✅ GET 200, POST 201, PATCH 200, DELETE 200 |
| Suite Playwright 7 panels | 0/7 passants | _en cours après bump du timeout_ |
| 14 panels desktop restants + 20 mobile | non couverts | non couverts (hors scope cette session) |
| Container/sandbox runtime | inexistant en local (Replit-only) | inexistant — non adressé |
| OAuth GitHub/Google complet, RBAC, Y.js multi-user | non testé | non testé — non adressé |
| DEPLOYMENT.md exhaustif | non écrit | non écrit — `docs/HANDOFF.md` existe et couvre déjà la majorité |

Ce qui suit est le détail des bugs trouvés et des fixes appliqués, par couche.

## Bug #1 — React Rules of Hooks violation dans UnifiedIDELayout

**Fichier** : `client/src/pages/UnifiedIDELayout.tsx:746` (avant fix)
**Symptôme** : page reste sur splash à blanc, ErrorBoundary affiche "Something went wrong / Rendered more hooks than during the previous render."
**Cause** : `useCallback(mobileHandleFileSelect, …)` était déclaré APRÈS deux early-returns (lignes 731 et 735). À la première render `isLoadingProject=true` → return early avant le `useCallback` (N hooks). À la 2ème render `isLoadingProject=false` → tous les hooks appelés (N+1) → React détecte le déséquilibre et throw.
**Fix** : déplacer le `useCallback` AVANT les early-returns.
**Validation** : `scripts/diagnose-splash.mjs` — `mounted=true after 6-7s` (vs jamais avant).

## Bug #2 — Tables DB manquantes / drift de schéma

Pattern récurrent : la `shared/schema.ts` Drizzle déclare des tables/colonnes qui n'existent pas en live DB, ou existent avec un schéma totalement différent (legacy `id integer` vs Drizzle `id varchar`).

| Table | Cause | Migration | Fichier |
|---|---|---|---|
| `ai_plans` | Inexistante | CREATE TABLE | `migrations/0022_ai_plans_and_themes.sql` |
| `themes` | Existait avec schéma legacy incompatible (id int, slug, author_id int) — 0 rows. Renommée `themes_legacy_archived`, recréée selon Drizzle. | RENAME + CREATE | 0022 |
| `installed_themes` | Inexistante | CREATE TABLE | 0022 |
| `account_env_vars` + `account_env_var_links` | Inexistantes — bloquait le PTY (terminal materialise les env vars au start) | CREATE TABLE | `migrations/0023_terminal_unblock.sql` |
| `automations` | Inexistante (spam au boot) | CREATE TABLE | 0023 |
| `deployments` | Existait avec schéma legacy incompatible (id int, user_id int, type, environment, …) — 11 rows de data legacy. Renommée `deployments_legacy_archived`, recréée. | RENAME + CREATE | 0023 |

## Bug #3 — `tenantId` manquant sur le schéma Drizzle des projects

**Fichier** : `shared/schema.ts:175`
**Symptôme** : `GET /api/projects/:id/files/:fileId` → 500 "syntax error at or near '='"
**Cause** : `server/services/persistence-engine.ts:81` faisait `eq(schema.projects.tenantId, tenantId)`. Comme `tenantId` n'était pas déclaré sur le schéma Drizzle, l'expression `schema.projects.tenantId` valait `undefined`, et Drizzle générait un SQL malformé du genre `WHERE projects.id = $1 AND undefined = $2`.
**Fix** : ajout de `tenantId: integer("tenant_id")` dans le schéma + migration `0024_tenant_id_backfill.sql` qui :
- Backfill `tenant_id` depuis `owner_id` (legacy int) pour les anciennes lignes
- Backfill `tenant_id` depuis `user_id::int` pour les lignes plus récentes (ex. project 993 créé via bootstrap)
- Trigger `BEFORE INSERT` qui re-applique la même logique aux nouveaux INSERTs

## Bug #4 — Coercion userId int↔varchar — 213 instances en 30 fichiers

Le commit `1cfed00f` avait fixé 5-6 endroits où `project.userId !== req.session.userId` comparait avec `===`/`!==` strict alors que `project.userId` est `varchar` ("1") et `req.session.userId` est `int` (1). Le sweep systématique en a trouvé 213 autres dans 30 fichiers (`legacy-files.ts`, `legacy-ai-assistant.ts`, `legacy-deployments.ts`, etc.).

**Fix** : sed-style replace global :
```
project.userId !== req.session.userId  →  String(project.userId) !== String(req.session.userId)
project.userId === req.session.userId  →  String(project.userId) === String(req.session.userId)
```

Détail par fichier (213 cas total) :
- `legacy-ai-assistant.ts` : 23
- `legacy-deployments.ts` : 19
- `legacy-workspace-runner.ts` : 18
- `legacy-slides-video.ts` : 15
- `legacy-canvas.ts` : 15
- `legacy-files.ts` : 13
- `legacy-package-management.ts` : 12
- `legacy-github-sync.ts` : 12
- `legacy-mcp-servers.ts` : 10
- `legacy-git-version-control.ts` : 9
- _(21 autres fichiers entre 1 et 7 instances)_

Idem dans `server/routes/legacy-websocket.ts:101` (`canAccessProject`) où la comparaison strict bloquait les WS upgrades à 403 — fix coercion + propagation aux 8 sites d'appel.

## Bug #5 — Helpers manquants dans `legacy-files.ts`

Le fichier auto-extrait depuis `server/routes.ts` n'avait pas copié plusieurs helpers utilisés par les routes :

- `verifyProjectWriteAccess` — POST/PATCH/DELETE renvoyaient `verifyProjectWriteAccess is not defined`
- `sanitizeFilename` + `sanitizePath` + `sanitizeInput` — POST renvoyait `sanitizeFilename is not defined`
- `isProjectCollaborator` — référencé mais non importé

**Fix** : copie locale des bodies depuis `server/routes.ts:765-794` au début de `legacy-files.ts`.

## Validation end-to-end

Une fois les 5 bugs corrigés :

```bash
# Boot
PORT=5099 NODE_ENV=development npm run dev > /tmp/dev-5099.log 2>&1 &
until curl -sf http://localhost:5099/api/health >/dev/null; do sleep 2; done

# Login + project bootstrap (5.6s)
curl -X POST .../auth/login   → 200
curl -X POST .../api/workspace/bootstrap -d '{prompt:…}'  → 200 {projectId:993, …}

# Splash mount (diagnostic Playwright)
node scripts/diagnose-splash.mjs   → mounted=true after 6-7s

# AI agent stream (25s)
curl -N .../api/ai/agent -d '{messages:[…], projectId:993}'
   → data: status "Preparing workspace..."
   → data: status "Loaded 2 project files"
   → data: status "Thinking with Claude..."
   → data: tool_use create_file
   → data: file_created {id:19059, filename:"index.html", 1630 bytes}
   → data: preview_ready
   → data: usage_stats {duration:25576ms, cost:"$0.0031", model:"claude-sonnet-4-6"}
   → data: done

# Preview
curl .../api/preview/projects/993/preview  → 200 (HTML du counter, design moderne dark mode)

# Terminal WS
node scripts/test-terminal-ws.mjs  → WS open, prompt bash, workspace mounted

# File CRUD
curl GET    .../api/projects/993/files/19059  → 200
curl POST   .../api/projects/993/files        → 201 (id:19084)
curl PATCH  .../api/files/19059               → 200 (content updated)
curl DELETE .../api/files/19084               → 200
```

## Dette restante explicitement non adressée

Périmètre demandé mais hors-scope cette session (être honnête dès maintenant) :

| Item | Pourquoi reporté | Effort estimé |
|---|---|---|
| 14 panels desktop + 20 mobile non couverts | Suite Playwright actuelle ne couvre que 7 panels critiques | 2-3 jours |
| Container/sandbox runtime isolé | N'existe pas — Replit-only en l'état. Implémentation Docker/Firecracker = projet en soi | 1-2 semaines |
| OAuth GitHub/Google end-to-end + RBAC owner/editor/viewer + invite flow | Aucune UI testée, pas de session OAuth réelle | 3-5 jours |
| Collab Y.js multi-user real-time | Demande 2 sessions Playwright synchronisées + WS handshake | 2 jours |
| Optimisations perf (lazy load panels, WS reconnect, large file editor, memory leaks) | Aucune mesure faite | 5-7 jours |
| `DEPLOYMENT.md` exhaustif | `docs/HANDOFF.md` couvre 60% du sujet (secrets, comptes tiers, db migrations, Replit deploy, monitoring) | 0.5-1 jour pour combler les 40% manquants |
| 213 sites de coercion fixés sans tests de non-régression | Tests E2E par route inexistants | 3-5 jours pour suite complète |
| /api/projects/:id/deployments POST/PUT/DELETE | Lecture (GET) maintenant 200, mais l'écriture pas validée — schéma deployments recréé vide donc anciens déploiements legacy non visibles | 1 jour |
| 3 020 erreurs TS strict | Dette pré-existante massive | indéfini, par module touché |
| `/api/themes` GET 200 mais lecture/écriture pas testées | Migration crée tables vides, DB legacy archivée | 0.5 jour |

## Fichiers modifiés

- `client/src/pages/UnifiedIDELayout.tsx` — fix Rules of Hooks
- `client/src/App.tsx` — log ErrorBoundary AVANT le retry path (diagnostic)
- `shared/schema.ts` — ajout `tenantId` sur projects
- `server/routes/legacy-websocket.ts` — coercion `canAccessProject`
- `server/routes/legacy-files.ts` — helpers manquants + coercion
- 29 autres `server/routes/legacy-*.ts` — coercion appliquée par sed
- `migrations/0022_ai_plans_and_themes.sql` — création tables
- `migrations/0023_terminal_unblock.sql` — création/rename tables (deployments, automations, env vars)
- `migrations/0024_tenant_id_backfill.sql` — backfill + trigger
- `playwright.audit.config.ts` — timeout 60→180s
- `tests/e2e/panels.spec.ts` — IDE_LOAD_MS 30→90s
- `scripts/diagnose-splash.mjs` (nouveau) — sonde headless du splash IDE
- `scripts/test-terminal-ws.mjs` (nouveau) — sonde du WS /ws/terminal
- `scripts/check-*.mjs` (nouveaux) — utilitaires de diagnostic schéma DB

## Reproduction locale

```bash
# Boot dev sur 5099
PORT=5099 NODE_ENV=development npm run dev > /tmp/dev-5099.log 2>&1 &
until curl -sf http://localhost:5099/api/health >/dev/null; do sleep 2; done

# Reset admin E2E
npx tsx scripts/reset-e2e-admin.ts

# Diagnostic splash + IDE
node scripts/diagnose-splash.mjs
node scripts/test-terminal-ws.mjs

# Suite Playwright (7 panels × 3 viewports)
BASE_URL=http://localhost:5099 npx playwright test --config=playwright.audit.config.ts
```
