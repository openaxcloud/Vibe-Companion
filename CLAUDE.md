# Vibe-Companion / E-code — Mémoire projet Claude

## Contexte utilisateur
- **Propriétaire** : Henri (openaxcloud)
- **Repo GitHub** : https://github.com/openaxcloud/Vibe-Companion
- **Replit** : https://replit.com/@henri45/E-code
- **Dossier local** : `~/Documents/GitHub/Vibe-Companion` (Mac d'Henri)
- **Langue de travail** : Français

## Objectif global
Finaliser la plateforme (clone Replit amélioré) pour qu'elle soit **prête pour production** et capable de **générer des applications de dernière génération avec un design de dernière génération**, de manière fiable.

## État production : ✅ READY (code + smoketest validés) — 2026-04-26

- Smoketest E2E : 13/13 critères qualité sur Opus 4.7, Sonnet 4.6 ET
  GPT-4.1 (rapport complet dans [`docs/SMOKETEST-2026-04-26.md`](docs/SMOKETEST-2026-04-26.md)).
- Screenshots de démo : [`docs/demo-screenshot.png`](docs/demo-screenshot.png) (light) +
  [`docs/demo-screenshot-dark.png`](docs/demo-screenshot-dark.png) (dark).
- Le smoketest a déterré 7 bugs (root-cause de la plainte d'Henri) tous
  corrigés sur cette branche : 6 leaks de prompt 2023-era qui contredisaient
  `MODERN_DESIGN_PROMPT` + 1 régression Anthropic (Opus 4.7 rejette le
  paramètre `temperature` — chaque appel Opus tombait silencieusement en
  fallback Sonnet).
- Reste les actions opérateur listées dans [`docs/HANDOFF.md`](docs/HANDOFF.md)
  (secrets, comptes tiers, fix `OPENAI_API_KEY` cassée).

## Tâches

### T1 — Vérifier synchronisation repo
- [x] Sandbox Claude ↔ GitHub `openaxcloud/Vibe-Companion` à jour sur `main`
- [x] Sync dossier local Mac d'Henri à jour (HEAD `f8f7d0d0`, 2026-04-26)
- [x] `.gitignore` : `.claude/worktrees/` + `logs/` + `*.log` (commit `f8f7d0d0`)
- [ ] Sync Replit `@henri45/E-code` → Henri doit confirmer dans Replit (pull depuis GitHub)

### T2 — Audit production-readiness ✅ TERMINÉ
- [x] Pipeline IA audit → 4.5/10 (causes corrigées en Phase 1+2)
- [x] Preview + déploiement → Preview OK ; déploiement consolidé sur Replit deploy
- [x] Sécurité serveur → 6.5/10 (corrigé en Phase 3)
- [x] Templates & design → CAUSE RACINE identifiée + corrigée en Phase 1

### T3 — Plan modernisation "dernière génération"

**PHASE 1 — Quick wins** ✅ TERMINÉ
- [x] Température 0.3 → 0.6 pour génération design (commit `4cee6daf`)
- [x] Activer `design-system.ts` dormant via `modern-design-system.ts`
- [x] Injecter shadcn/ui + components.json par défaut dans templates React
- [x] Section "Modern Design" dans `agent-system-prompt.ts` (+ context `'design'`)
- [x] Migration SQL `0018_users_schema_sync.sql`

**PHASE 2 — Qualité génération IA** ✅ TERMINÉ
- [x] Fallback chain : Opus 4.7 (primary, 1M ctx) → Sonnet 4.6 → GPT-4.1 → Gemini → Grok-3 → Kimi
- [x] Cheap tier : Haiku 4.5 (`FAST_CHEAP_MODEL`)
- [x] Pipeline post-processing (`server/ai/post-processing.ts`) : prettier + eslint --fix + tsc --noEmit (retry IA x2 si erreurs)
- [x] Auto-fix UI : stop après 3 échecs consécutifs avec banner d'alerte + bouton "Resume"
- [x] Renommage cohérent de tous les modèles legacy (`claude-sonnet-4-20250514` → `claude-sonnet-4-6`, …) sur 41 fichiers
- [x] Fix bug duplicate-key dans `ai-pricing.ts` (Haiku 4.5 mal labellisé Sonnet)

**PHASE 3 — Production-ready** ✅ TERMINÉ
- [x] Session store PostgreSQL consolidé (`server/middleware/session-config.ts`), fail-fast si pas de DB en prod
- [x] Helmet CSP + HSTS activés (whitelist Anthropic/OpenAI/Gemini/xAI/Moonshot/Stripe/Sentry/Replicate)
- [x] Logger enrichi : redaction de secrets (`password`, `token`, `apikey`, Bearer, `sk-/pk-`, postgres URLs) + `silenceConsoleInProduction()` (Pino non-migré, choix documenté dans le commit — winston/viteLog déjà partout, refactor à 100+ fichiers trop coûteux pour le gain)
- [x] Seed DB sécurisé : random base64url affiché une seule fois au stdout, plus de `password` literal en dev
- [x] Consolidation déploiement : 13 stratégies dormantes archivées dans `archive/deploy-strategies/` avec README ; `tsconfig.json` exclut `archive/`

**PHASE 4 — CI / monitoring / docs** ✅ TERMINÉ
- [x] CI GitHub Actions : 4 jobs (lint + typecheck non-bloquant avec annotation du baseline + tests + build)
- [x] `.env.production.example` exhaustif (~70 vars curées sur 341 trouvées par grep)
- [x] Sentry serveur (`server/monitoring.ts`) + client (`client/src/lib/sentry.ts`) conditionnels (soft dep, dynamic import, opt-in via `SENTRY_DSN` / `VITE_SENTRY_DSN`)
- [x] `README.md` quickstart + `docs/ARCHITECTURE.md` (1 page, schéma pipeline génération)

### T4 — Production
- [x] Variables d'env prod (`.env.production.example`)
- [x] CI/CD (GitHub Actions amélioré)
- [x] Monitoring + logs (Sentry conditionnel + logger redactor)
- [x] Doc utilisateur + dev (README + ARCHITECTURE + HANDOFF)
- [ ] Henri exécute la checklist de [`docs/HANDOFF.md`](docs/HANDOFF.md)

## Dette technique connue (non bloquante)

| Item | Pourquoi reporté | Quand revisiter |
|---|---|---|
| ~3781 erreurs TS strict-mode | Baseline pré-existante, build non-bloquant | Au fil de l'eau, par module touché |
| `container-orchestrator.ts` encore dans `server/deployment/` | Encore importé par `polyglot-routes.ts` + `edge/edge-manager.ts` | Archiver quand ces routes seront retirées |
| Tests E2E avec base de données réelle | Aucun pour l'instant | Quand la bandwidth le permet (Playwright + Postgres-in-CI) |
| Migration vers Pino | Le wrapper actuel fait déjà redaction + console-silencing | Si la perf devient un bottleneck |

## Règles de travail
1. Branches `claude/<sujet>` créées depuis `main` à jour
2. Commits clairs et fréquents (conventional commits : `feat:`, `fix:`, `chore:`, …)
3. Push sur `main` autorisé après tests verts (typecheck baseline + boot 30s OK)
4. Mettre à jour ce fichier quand une tâche avance
5. Répondre en français
6. JAMAIS `--no-verify` — corriger la cause racine si un hook plante
