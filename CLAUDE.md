# Vibe-Companion / E-code — Mémoire projet Claude

## Contexte utilisateur
- **Propriétaire** : Henri (openaxcloud)
- **Repo GitHub** : https://github.com/openaxcloud/Vibe-Companion
- **Replit** : https://replit.com/@henri45/E-code
- **Dossier local** : `Documents/=github/vibe companion` (machine Henri)
- **Langue de travail** : Français

## Objectif global
Finaliser la plateforme (clone Replit amélioré) pour qu'elle soit **prête pour production** et capable de **générer des applications de dernière génération avec un design de dernière génération**, de manière fiable.

## Problème actuel signalé par Henri
« J'arrive pas à générer des apps de dernière génération avec un design de dernière génération. »
→ Pipeline de génération (prompt → code → preview → deploy) à auditer et moderniser.

## Tâches en cours (à mettre à jour au fur et à mesure)

### T1 — Vérifier synchronisation repo
- [x] Sandbox Claude ↔ GitHub `openaxcloud/Vibe-Companion` : à jour sur `main` (HEAD `ccd8fb1d`)
- [ ] Vérifier sync du dossier local d'Henri → Henri doit lancer `git status` + `git pull` sur sa machine
- [ ] Vérifier sync Replit `@henri45/E-code` → Henri doit confirmer dans Replit (pull depuis GitHub)

### T2 — Audit production-readiness
- [ ] Auditer `server/` (APIs, auth, sécurité, rate-limit)
- [ ] Auditer `client/` (UI, thèmes, composants)
- [ ] Auditer pipeline génération IA (prompts, modèles utilisés, qualité output)
- [ ] Auditer preview + déploiement (erreurs build, config)
- [ ] Lister bugs bloquants et dettes techniques

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
