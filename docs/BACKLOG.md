# BACKLOG — GoMeCoiffer

Travaux décidés, mis en attente, à reprendre. Les règles des skills (`.claude/skills/`) s'appliquent à tout
nouveau code dès maintenant, sans attendre ces reprises. Une entrée sort du backlog quand elle est traitée et
fusionnée ; elle laisse alors sa trace dans `docs/EVOLUTIONS.md`. Chaque entrée porte sa date (JJ/MM) et sa source
(décision du user, revue, relevé en cours de travail).

## URGENT, à traiter avant tout nouveau chantier

Cette section passe avant toute autre tâche, à chaque reprise de travail (elle est injectée en début de session
par le hook `session-context`).

- **Initialiser le dépôt git (17/11).** Le projet n'est pas encore un dépôt git : le garde-fou des migrations
  commitées et la protection des secrets par `.gitignore` en dépendent. `git init`, vérifier avec
  `git status --ignored` que `backend/.env` et `infra/.env` sont ignorés, puis premier commit
  (`CLAUDE.md`, `.claude/`, `docs/`, `infra/compose.yml`, fichiers `*.env.example`).

## Décisions attendues du user (PRD §16 et hypothèses des fichiers de config)

Tant qu'une décision manque, le code retient l'hypothèse indiquée, marquée `[HYPOTHÈSE]` dans les use cases.
Chaque décision prise va dans `docs/DECISIONS.md`.

- **Agrégateur Mobile Money** (Orange Money, MTN MoMo) et conditions de règlement des fonds par salon. Bloque le
  lot Paiement en ligne ; un adaptateur `fake` permet d'avancer.
- **Mode d'authentification** : propriétaires et collaborateurs (téléphone + mot de passe ? OTP SMS ?), clients
  (OTP SMS, lien sécurisé, ou les deux). Hypothèse : mot de passe `argon2id` pour le personnel, OTP SMS + lien
  sécurisé pour les clients. Bloque le lot Comptes.
- **Fournisseur SMS** (OTP, lien de réservation). Hypothèse : adaptateur `fake` jusqu'au choix.
- **Prix des abonnements** : 5 000 FCFA/mois ou 50 000 FCFA/an par salon (hypothèse PRD §10), essai gratuit
  oui/non et durée.
- **Politique d'annulation, de report et de remboursement** (BR-10) ; procédure de litige de paiement.
- **Validité d'une proposition de reprogrammation** (F06). Hypothèse : 24 h (`RESCHEDULE_PROPOSAL_TTL_HOURS`).
- **Reprogrammation demandée par le client** (F06 scénario 2) : validée par le salon, ou acceptée d'office si le
  créneau est libre ? Hypothèse : validée par le salon.
- **Délai de tolérance avant « client absent »** (BR-08). Hypothèse : réglable par salon, 15 min par défaut.
- **Période de grâce d'un abonnement expiré** (F08). Hypothèse : 7 jours (`SUBSCRIPTION_GRACE_DAYS`).
- **Langues de l'interface** : français seul, ou français + anglais (Cameroun bilingue) ? Hypothèse : structure
  i18n dès le départ, français seul au MVP.
- **Politique de conservation et de protection des données** des clients (PRD §12).
- **Stockage des photos de salon** en prod (disque du serveur ou stockage objet).

## Lot 0 — Socle technique (premier chantier de code)

Checklist détaillée : `docs/checklists.md` § Socle.
- Monorepo pnpm : `backend/` (`api`), `frontend/` (`web`), `packages/contracts` ; `.nvmrc` Node 24.
- Backend : NestJS 12, config validée par Zod (variables de `backend/.env.example`), TypeORM + `data-source.ts` +
  scripts de migration, `TransactionHost` (adaptateur TypeORM), `TransactionalCommandBus`, `SqlReader` + gabarit
  `sql`, outbox + relais local + `processed_events`, `DomainExceptionFilter`, `ApiResponse<T>`, session PostgreSQL,
  CSRF, `AuthGuard` deny-by-default, `PermissionsGuard`, `@CurrentActor()`, SSE, pino avec redaction, terminus.
- Vérifier à l'init (et noter dans `docs/DECISIONS.md`) : `@Body({ schema })` de NestJS 12, adaptateur TypeORM de
  `@nestjs-cls/transactional`, CLI TypeORM sous ESM.
- Qualité : Vitest (projects unit/integration/e2e, SWC), Testcontainers PostgreSQL 17, oxlint + ESLint, Prettier,
  dependency-cruiser (`pnpm arch`) avec les règles de dépendance de `CLAUDE.md` §I.1.
- Frontend : Vite 8 + React 19.2 + React Compiler, Redux Toolkit + RTK Query, `HttpClient`, i18n, shadcn/ui,
  trois layouts (marketplace, salon, admin).

## Lots MVP (ordre proposé, cycle Disponibilité → Réservation → Paiement → Prestation terminée)

Chaque lot commence par `use-case-writer` (use cases + `.feature`), puis contrat dans `packages/contracts`,
puis back et front en parallèle.

1. **Comptes, organisation et salons** (PRD §3-7, F07 en partie) : compte du propriétaire, organisation, premier
   salon, appartenances, rôles salon prédéfinis et permissions ajustables, droits protégés du propriétaire,
   salon actif en session, rôles système séparés, onboarding sauvegardé par étape.
2. **Prestations et intervenants** (onboarding étapes 3-6, F07) : prestations (prix, durée, actif), intervenants,
   spécialités, prestations autorisées, horaires, pauses, indisponibilités, invitation des collaborateurs.
3. **Disponibilités et marketplace** (F01, F02) : publication du salon (au moins une prestation, un intervenant
   éligible, des horaires valides), recherche, fiche salon, calcul des créneaux, états « Disponible maintenant /
   Prochain créneau / Indisponible », flux SSE public.
4. **Réservation et planning** (F03, F05, BR-01 à BR-03, BR-07, BR-08, BR-12) : réservation client avec « Peu
   importe », paiement au salon, contrainte d'exclusion, planning du jour, « Mes rendez-vous », client sur place,
   blocage temporaire, démarrage/clôture, annulation, client absent.
5. **Paiement en ligne** (F04, BR-04 à BR-06, BR-10) : réservation temporaire 10 min, initiation, webhook signé,
   réconciliation, expiration, incident de paiement tardif, encaissement déclaré au salon, historique.
6. **Reprogrammation** (F06, BR-09) : proposition unique active, lien partageable WhatsApp, acceptation/refus,
   créneau sécurisé pendant l'acceptation, historique.
7. **Abonnements et administration** (F08) : organisations et salons, abonnement par salon, paiements
   d'abonnement, suspension/rétablissement, période de grâce, incidents de paiement, indicateurs.
8. **Tableau de bord du salon** (F07) : réservations du jour, en cours, professionnels disponibles, prochains
   rendez-vous, paiements du jour.

## Hors MVP (PRD §14) — ne rien préparer

Notifications « coiffeur libre », marketing automatisé, fidélité, abonnements clients, avis et notes, chat,
sponsoring opérationnel, commission automatique, stock, paie, comptabilité, franchises, multi-intervenants,
application mobile native, IA, cabines et équipements partagés.

## À observer

- Indicateurs de réussite du PRD §15 : prévoir dès le lot 4 les données qui permettront de les mesurer (taux de
  conflits, absences, reprogrammations réussies), sans écran d'analyse avancée.
