# Évolutions de GoMeCoiffer

Journal des évolutions livrées de l'application, **la plus récente en haut**. Une entrée par évolution
(fonctionnalité, lot, correctif notable, changement d'architecture), écrite par la session principale à la fin
du travail, une fois les tests verts. Le détail technique vit dans git ; ici, ce qui a changé pour le produit et
pour l'équipe.

Gabarit d'une entrée :

```markdown
### AAAA-MM-JJ — <Titre court de l'évolution>

- **Quoi** : ce qui change pour l'utilisateur ou pour l'équipe (1 à 3 lignes).
- **Pourquoi** : besoin, exigence (F0x, BR-xx, UC-xxx) ou décision qui l'explique.
- **Périmètre** : modules back/front, migrations, contrats d'API, événements.
- **Vérification** : tests lancés (nombre, niveaux), revues faites (archi, sécurité, front), mode de la session.
- **Suites** : ce qui reste, reporté dans `docs/BACKLOG.md`.
```

---

### 2026-11-17 — Initialisation de la configuration Claude Code, de la documentation et de l'environnement

- **Quoi** : mise en place de `CLAUDE.md`, de la configuration `.claude/` (8 agents, 9 skills, hooks), du
  dossier `docs/` (backlog, évolutions, décisions, référentiels), de l'infrastructure locale
  (`infra/compose.yml` : PostgreSQL 17, Mailpit) et des fichiers d'environnement du backend.
- **Pourquoi** : démarrer le projet avec les règles de travail reprises de VO'SSOU, adaptées à l'architecture
  NestJS de `backend/backendNestjs.md`, avec **TypeORM** pour les écritures et des **requêtes SQL pures écrites
  dans la couche application** pour les lectures (décision du user, voir `docs/DECISIONS.md` D-001).
- **Périmètre** :
  - agents `backend-builder`, `query-perf`, `front-builder`, `front-ui`, `use-case-writer`, `archi-reviewer`,
    `security-reviewer`, `front-reviewer` ;
  - skills `ddd`, `hexagonal`, `nest-stack` (nouveau), `tdd`, `sql-query`, `security`, `clean-code`,
    `refactoring`, `front-stack` ;
  - hooks : garde-fous sur `.env` et les migrations commitées, garde-fous shell (push forcé, `--no-verify`,
    `schema:sync`), formatage Prettier, contexte de session, worktrees ;
  - `backend/.env.example` (commité) et `backend/.env` / `infra/.env` (secrets générés aléatoirement, ignorés
    par git, lecture réservée au compte Windows courant) ;
  - PRD déplacé dans `docs/cahier-des-charges/prd.md`.
- **Vérification** : 22 cas de test des hooks garde-fous passés, plus le cas de la migration commitée, vérifié
  dans un dépôt git temporaire. Aucun code applicatif à ce stade.
- **Suites** : initialiser git (URGENT du backlog), décisions attendues du user, lot 0 (socle technique).
