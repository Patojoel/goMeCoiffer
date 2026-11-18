# BACKLOG — GoMeCoiffer

Travaux décidés, mis en attente, à reprendre. Les règles des skills (`.claude/skills/`) s'appliquent à tout
nouveau code dès maintenant, sans attendre ces reprises. Une entrée sort du backlog quand elle est traitée et
fusionnée ; elle laisse alors sa trace dans `docs/EVOLUTIONS.md`. Chaque entrée porte sa date (JJ/MM) et sa source
(décision du user, revue, relevé en cours de travail).

## URGENT, à traiter avant tout nouveau chantier

Cette section passe avant toute autre tâche, à chaque reprise de travail (elle est injectée en début de session
par le hook `session-context`).

_Rien d'urgent._

## Décisions attendues du user (PRD §16 et hypothèses des fichiers de config)

Tant qu'une décision manque, le code retient l'hypothèse indiquée, marquée `[HYPOTHÈSE]` dans les use cases.
Chaque décision prise va dans `docs/DECISIONS.md`.

- **Agrégateur Mobile Money** (Orange Money, MTN MoMo) et conditions de règlement des fonds par salon. Bloque le
  lot Paiement en ligne ; un adaptateur `fake` permet d'avancer.
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
- **Textes des conditions d'utilisation et de la politique de confidentialité** à rédiger (acceptation obligatoire
  à l'inscription, D-022) ; d'ici là, l'écran pointe vers des pages provisoires. À fournir avant la production.
- **Stockage des photos de salon** en prod (disque du serveur ou stockage objet).

## À faire avec le lot 1 (connexion), relevé au socle (17/11, revue sécurité du socle)

- Connexion : `session.regenerate()` + `authenticatedAt` + nouveau jeton CSRF ; déconnexion qui détruit la session
  et efface les cookies de session et CSRF ; tests « l'id de session change », « un jeton CSRF d'avant la connexion
  est refusé ». Côté front : remettre le jeton CSRF de `HttpClient` à zéro à la connexion et à la déconnexion.
- Remplacer `NoRightsYet` par la vraie résolution des droits (`isMember`, permissions du salon actif, rôles
  système) ; durée absolue plus courte pour les rôles système (aujourd'hui 72 h pour tous).
- Front : route `/connexion` (le 401 y redirige déjà, elle tombe en 404) ; poser `<RequirePermission>` sur
  `/salon/*` et `<RequireSystemRole>` sur `/admin/*` ; brancher le flux SSE (`/api/salon/realtime/stream`) dans
  `main.tsx`, le relancer au changement de salon actif et le couper à la déconnexion ; relecture de secours
  (20-30 s) tant que le flux est coupé.
- Vérifier le rendu à 390 px des écrans du socle (non vérifié : pas d'outil de capture pendant le lot 0).

## Durcissements relevés au socle (17/11, revue sécurité), à traiter quand le besoin arrive

- SSE : limiter le nombre de flux simultanés par session ; supprimer les canaux sans abonné ; ne diffuser sur
  `salon:` que des signaux d'invalidation (jamais de montant) ; vérifier l'origine à l'ouverture du flux.
- Throttler : limites par route (OTP : numéro + IP ; connectés : session) et stockage partagé avant toute
  deuxième instance ; attention au CGNAT des opérateurs camerounais (une IP pour beaucoup de clients).
- `TRUST_PROXY` : régler le nombre exact de proxys au déploiement (CDN + répartiteur).
- `/api/public/health` : réserver l'état de la base à une sonde interne une fois la supervision en place.
- Logs : masquer les champs sensibles en profondeur (pas seulement `*.phone`) ; ne jamais placer un jeton de lien
  dans l'URL loggée (POST, ou masquage de `req.url` sur ces routes).
- Outbox : identifiant de consommateur explicite et stable (aujourd'hui le nom de classe du subscriber) ; purge des
  lignes traitées et de `last_error` ; événements d'intégration avec des identifiants seulement.
- `sql.unsafe` : proposer `sql.identifier(whitelist, key)` typé par `keyof` et réserver `unsafe` aux littéraux.
- Config : `WEB_ORIGIN` validé comme URL (https hors local) ; OpenAPI protégé en preprod.
- React Compiler par l'option native expérimentale de `@vitejs/plugin-react` (D-014) : surveiller, repli Babel documenté.

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
