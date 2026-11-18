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
- **Numéros recyclés par les opérateurs (avant UC-009)** — revue sécurité UC-001 (C3), 18/11 : MTN et Orange
  réattribuent les numéros inactifs ; le nouveau titulaire qui vérifie le numéro par SMS hériterait de l'historique
  client de l'ancien (salons, dates, prestations), et l'inscription (RG-001-10) le figerait sous son mot de passe.
  Options : détacher l'historique si le numéro n'a pas été vérifié depuis N mois, ou ne montrer que les
  réservations postérieures à la dernière vérification. À trancher avant d'ouvrir les comptes clients légers.

## À faire avec le lot 1 (connexion), relevé au socle (17/11, revue sécurité du socle)

- Remplacer `NoRightsYet` par la vraie résolution des droits (`isMember`, permissions du salon actif, rôles
  système) — UC-005 / UC-008. Les durées plus courtes des rôles système (D-026) sont déjà appliquées par `AuthGuard`.
- **Écran de connexion (front de UC-002)** : non fait (back seul, 18/11). Contrat prêt (`SignInSchema`,
  `SignedInSchema`, `SignedOutSchema`, `SessionSummarySchema`). Le front doit :
  - remettre le jeton CSRF de `HttpClient` à zéro à la connexion (prendre le `csrfToken` renvoyé) et à la
    déconnexion ;
  - traiter un 401 ou 403 sur `POST /api/public/auth/sign-out` comme « déconnecté » : une session déjà expirée rend
    le jeton CSRF invalide (revue sécurité UC-002) ;
  - conduire vers l'étape suivante du résumé de session (D-027), afficher les aides et messages du UC (§10, §15).
- **Numéro mal formé à la connexion** (écart UC-002 E1, 18/11) : l'API répond 422 « Numéro de téléphone camerounais
  invalide », comme à l'inscription, au lieu d'un 400 par champ. Aucun essai n'est compté. Proposé : garder ce
  comportement commun ; à confirmer par le user.
- UC-003 (mot de passe oublié) doit lever les blocages de connexion du numéro (D-025) et fermer toutes les sessions
  de l'utilisateur (D-028).
- Front : route `/connexion` (le 401 y redirige déjà, elle tombe en 404) ; poser `<RequirePermission>` sur
  `/salon/*` et `<RequireSystemRole>` sur `/admin/*` ; brancher le flux SSE (`/api/salon/realtime/stream`) dans
  `main.tsx`, le relancer au changement de salon actif et le couper à la déconnexion ; relecture de secours
  (20-30 s) tant que le flux est coupé.
- Vérifier le rendu à 390 px des écrans du socle (non vérifié : pas d'outil de capture pendant le lot 0).
- **Écran d'inscription (front de UC-001)** : non fait, à la demande du user (back seul, 18/11). Le contrat
  `@gomecoiffer/contracts` (`RequestSignUpCodeSchema`, `ConfirmSignUpSchema`, `SignedUpSchema`) est prêt ; après
  l'inscription, le front doit prendre le `csrfToken` renvoyé (la session est régénérée).

## Avant de brancher un vrai fournisseur SMS (revue sécurité UC-001, 18/11)

- L'appel au fournisseur se fait aujourd'hui dans la transaction de la commande (sérialisée par numéro) : avec un
  fournisseur lent, ~10 demandes simultanées occupent tout le pool (`DB_POOL_MAX=10`). Avant le branchement :
  délai d'expiration court (≤ 3 s) sur l'appel, et passage à un envoi après commit (défi enregistré « en cours »,
  puis `ACTIVE` ou `FAILED` exclu des quotas) si la latence réelle le justifie.
- Préprod : bac à sable du fournisseur ou liste blanche de numéros de test (le faux fournisseur masque désormais
  le code hors local et test : on ne peut plus s'inscrire en préprod en lisant les logs).
- Limite par IP et CGNAT des opérateurs (D2) : stockage partagé du limiteur avant une 2e instance ; défi
  anti-robot plutôt que limite par IP plus stricte en cas d'abus.
- Liste des mots de passe courants : charger une liste issue des fuites publiques (top 10k à 100k, ≥ 10 caractères)
  en plus de la liste locale (D3).
- Alerte d'exploitation sur le volume de codes faux et de SMS envoyés (détection d'attaque et de facture SMS).
- Limite d'envoi et niveau d'isolation (revue sécurité du refactoring D-024, 18/11) :
  - la lecture de l'historique après le verrou par numéro suppose READ COMMITTED (défaut PostgreSQL) ;
  - si l'isolation par défaut change un jour (`defaultTxOptions` du plugin transactionnel), figer READ COMMITTED
    sur `RequestSignUpCode` ;
  - garder l'E2E « rafale = un seul SMS » avec la configuration de prod.

## Tests : plantage natif intermittent sous Windows (relevé le 18/11, mis de côté à la demande du user)

- Un processus de test meurt parfois sans message (code `0xC0000409`), au hasard pendant l'exécution, d'autant plus
  souvent qu'un fichier enchaîne de requêtes vers la base. Ce n'est pas un test rouge : relancer le fichier.
- Mesures : 600 requêtes sur `/api/public/health` (route triviale) plantent aussi (1 à 5 fois sur 8) ; aucun rapport
  Node (pas une erreur V8) ; `argon2` seul ne plante jamais ; même panne en pool `threads` (le processus principal
  meurt) ; un seul port d'écoute n'y change rien. Environnement : Node 24.15.0, Windows 11, base dans Docker Desktop.
- Atténuation faite : les plafonds de connexion sont configurables, les tests de rafale les atteignent en ~40
  requêtes au lieu de 600.
- Pistes : faire tourner la suite sur Linux (CI), essayer une autre version de Node 24, activer les vidages mémoire
  Windows (WER LocalDumps) pour nommer le module fautif.

## Connexion, à surveiller (revues sécurité UC-002, 18/11)

- Filet de 100 connexions/h : compté par jeton d'appareil quand le cookie en porte un, sinon par adresse IP. Des
  cookies forgés échappent au filet ; le coût reste borné par la politique D-025 (30 échecs/h par adresse ou /64,
  5/15 min et 20/24 h par numéro). Revoir si l'on observe un abus de calcul argon2id.
- `TRUST_PROXY` (nombre de sauts) : à régler exactement au déploiement (CDN + répartiteur = 2) ; une valeur fausse
  regroupe tous les clients sous une seule adresse ou laisse usurper l'adresse.
- Audit `SIGN_IN_BLOCKED` écrit seulement pour un compte existant (une fois par blocage) : écart de temps minime,
  non observable par le client ; à sortir du chemin de la réponse si une mesure le montre.
- Rapport d'index (`EXPLAIN`) de `SqlSignInAttemptHistory` et volume de `sign_in_attempts` (purge horaire) à
  mesurer avec des données réalistes.
- IPv6 : la limite par adresse compte par /64 ; un attaquant qui dispose d'un /48 ou d'un /56 multiplie son quota
  (la limite par numéro tient). Ajouter un compteur au /48 avec un seuil plus haut si l'abus apparaît (contre-revue
  UC-002) ; modifie D-025, décision du user.
- Seed de démo d'un compte du personnel pour se connecter en local (non fait).

## Structure (refactoring D-024, 18/11)

- Le socle `shared/domain` (erreurs, VO transverses) garde l'ancienne organisation (`errors.ts` regroupe les erreurs
  de base). À aligner sur D-024 si le user le souhaite.

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
