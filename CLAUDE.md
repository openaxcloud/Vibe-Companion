# Vibe-Companion / E-code — Mémoire projet Claude

## Contexte utilisateur
- **Propriétaire** : Henri (openaxcloud)
- **Repo GitHub** : https://github.com/openaxcloud/Vibe-Companion
- **Replit** : https://replit.com/@henri45/E-code
- **Dossier local** : `~/Documents/GitHub/Vibe-Companion` (Mac d'Henri)
- **Langue de travail** : Français

## Objectif global
Finaliser la plateforme (clone Replit amélioré) pour qu'elle soit **prête pour production** et capable de **générer des applications de dernière génération avec un design de dernière génération**, de manière fiable.

## Problème actuel signalé par Henri
« J'arrive pas à générer des apps de dernière génération avec un design de dernière génération. »
→ Pipeline de génération (prompt → code → preview → deploy) à auditer et moderniser.

## Tâches en cours (à mettre à jour au fur et à mesure)

### T1 — Vérifier synchronisation repo
- [x] Sandbox Claude ↔ GitHub `openaxcloud/Vibe-Companion` : à jour sur `main` (HEAD `f8f7d0d0`)
- [x] Sync dossier local Mac d'Henri → à jour sur `main` (HEAD `f8f7d0d0`, 2026-04-26)
- [x] `.gitignore` : ajout `.claude/worktrees/` + `logs/` + `*.log` (commit `f8f7d0d0`)
- [ ] Vérifier sync Replit `@henri45/E-code` → Henri doit confirmer dans Replit (pull depuis GitHub)

### T2 — Audit production-readiness ✅ TERMINÉ
- [x] Pipeline IA audit → **4.5/10**
  - Température 0.3 trop basse pour le design (`server/routes/code-generation.router.ts:84`)
  - Modèles pas à jour : `gpt-4.1` en primary, manque Opus 4.7 / Sonnet 4.6 (`server/ai/ai-provider-manager.ts:60-67`)
  - Prompt système basique, pas orienté "modern UX" (`server/ai/prompts/agent-system-prompt.ts`)
  - Pipeline one-shot, pas agentic, pas de post-processing (lint/format/tsc)
- [x] Preview + déploiement → **Preview OK, déploiement fragmenté**
  - Preview hot-reload + auto-fix client fonctionne bien
  - Risque boucle silent retry infinie si build échoue à répétition
  - Modules K8s/buildpack/autoscale abandonnés
- [x] Sécurité serveur → **6.5/10**
  - 🔴 Session store in-memory (`Map<>`) → perte sessions au restart (bloquant prod)
  - 🔴 Helmet CSP désactivé (`server/index.ts:77`)
  - 🟠 Console.log non structurés, risque fuite secrets
  - 🟠 Seed DB avec password "password"
  - ✅ Auth solide (bcrypt cost 12, CSRF, rate-limit tier, Zod, Drizzle)
- [x] Templates & design → **CAUSE RACINE du problème d'Henri**
  - Shadcn/ui installé mais JAMAIS injecté dans scaffolds générés
  - Framer Motion installé mais jamais utilisé dans les apps générées
  - `server/ai/prompts/design-system.ts` défini mais DORMANT
  - Templates produits = Tailwind gris générique (look 2023)

### T3 — Plan modernisation "dernière génération"

**PHASE 1 — Quick wins (semaine 1, ~6h)** ✅ TERMINÉ
- [x] Passer température de 0.3 → 0.6 pour génération design (commit `4cee6daf`)
- [x] Activer le design-system.ts dormant dans les scaffolds (via `modern-design-system.ts`)
- [x] Injecter shadcn/ui + components.json par défaut dans templates React
- [x] Ajouter section "Modern Design" dans `agent-system-prompt.ts` (+ context `'design'`)
- [x] Créer `modern-design-system.ts` (palette hsl, shadcn, Framer Motion, dark mode)
- [x] Migration SQL `0018_users_schema_sync.sql` pour colonnes users manquantes

**PHASE 2 — Qualité (semaine 2, ~8h)**
- [ ] Upgrade fallback chain : Opus 4.7 + Sonnet 4.6 (`ai-provider-manager.ts:60-67`)
- [ ] Pipeline post-processing (prettier + eslint --fix + tsc --noEmit)
- [ ] Auto-fix UI : bouton "stop silent retry" après 3 échecs

**PHASE 3 — Production-ready (semaine 3, ~6h)**
- [ ] Session store PostgreSQL (`connect-pg-simple` déjà installé)
- [ ] Helmet CSP/HSTS activés, retirer `false` injustifiés
- [ ] Unifier logging Winston/Pino, désactiver console en prod
- [ ] Nettoyer seed DB (plus de password "password")
- [ ] Consolider déploiement : choisir 1 stratégie, archiver le reste

### T3 — Moderniser la génération "dernière génération"
- [ ] Upgrader les modèles IA (Claude Opus 4.7 / Sonnet 4.6 selon coût/qualité)
- [ ] Revoir les prompts système de génération
- [ ] Ajouter templates de design modernes (Tailwind + shadcn/ui + animations)
- [ ] Ajouter patterns modernes (Next.js 15, Server Components, streaming)
- [ ] Tests E2E sur apps générées

### T4 — Production
- [ ] Variables d'env prod (`.env.production`)
- [ ] CI/CD (GitHub Actions)
- [ ] Monitoring + logs
- [ ] Doc utilisateur + dev

## Ce dont Claude a besoin pour travailler en autonomie
Voir section « Inputs requis » dans la conversation courante — à compléter dès qu'Henri répond.

## Règles de travail
1. Toujours travailler sur la branche `claude/sync-vibe-companion-kpLLm` (ou branches dédiées)
2. Commits clairs et fréquents
3. Ne jamais push sur `main` directement
4. Mettre à jour ce fichier quand une tâche avance ou qu'une nouvelle consigne est donnée
5. Répondre en français
