# Décisions — GoMeCoiffer

Décisions d'architecture et décisions métier tranchées. Une décision ne se rediscute pas sans élément nouveau ;
si elle change, on ajoute une nouvelle entrée qui remplace l'ancienne (« remplace D-00x ») au lieu de réécrire
l'historique. Les décisions encore attendues sont listées dans `docs/BACKLOG.md`.

| ID | Date | Décision | Raison | Source |
|---|---|---|---|---|
| D-001 | 2026-11-17 | Persistance **TypeORM** pour les écritures (entités et repositories derrière des ports). Lectures en **SQL pur écrit dans `application/queries`**, exécuté par le port `SqlReader` avec le gabarit `sql` (paramètres liés), jamais par l'ORM. | Choix du user ; garder les lectures optimisables et lisibles, l'ORM limité au cycle de vie des agrégats. | user |
| D-002 | 2026-11-17 | Temps réel par **SSE**, relecture complète à la reconnexion ; **aucun broker** au MVP (outbox + relais en processus). | PRD §12 (SSE ou équivalent, pas de Kafka/RabbitMQ). | PRD |
| D-003 | 2026-11-17 | Le **salon** est le périmètre (tenant) ; le **salon actif** est porté par la session et change le contexte d'autorisation ; rôles système et permissions salon sont deux mondes séparés. | PRD §2-6, BR-12. | PRD |
| D-004 | 2026-11-17 | Authentification par **session serveur** (cookie HttpOnly, stockage PostgreSQL) + CSRF double-submit ; pas de JWT. | Révocation immédiate, changement de salon actif côté serveur, périmètre critique de `CLAUDE.md`. | archi |
| D-005 | 2026-11-17 | Non-chevauchement des réservations garanti **en base** par une contrainte d'exclusion PostgreSQL (`btree_gist`), en plus de la revalidation applicative. | PRD §12 Concurrence, BR-02. | PRD |
| D-006 | 2026-11-17 | Monorepo pnpm : `backend/` (paquet `api`), `frontend/` (paquet `web`), `packages/contracts` (Zod 4 partagés). | Dossiers existants du projet ; contrat partagé API ↔ web (`backend/backendNestjs.md`). | archi |
| D-007 | 2026-11-17 | Montants en **FCFA (XAF) entiers** ; instants en UTC (`timestamptz`), affichage et calcul des créneaux dans le fuseau IANA du salon (`Africa/Douala` par défaut). | PRD §12 Dates, marché Cameroun. | PRD |
| D-008 | 2026-11-17 | Ports locaux : bloc **10400-10409** (API 10400, Vite 10401, PostgreSQL 10402, Mailpit 10403/10404), publiés sur `127.0.0.1`. | Pas de conflit avec VO'SSOU (10370-10389). | archi |
| D-009 | 2026-11-17 | Modules ESM côté API **à confirmer** à l'init du socle selon le support de la CLI TypeORM ; repli CommonJS possible, à noter ici. | `backend/backendNestjs.md` vise ESM ; CLI TypeORM historiquement fragile en ESM. | à confirmer |
