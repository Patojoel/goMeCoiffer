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
- ~~Numéros recyclés par les opérateurs~~ : **tranché le 20/11 par D-053** (« titulaire depuis », 180 jours),
  appliqué par UC-009 (RG-009-06) et filtré par « Mes réservations » au lot 4.

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
- **Écran « mot de passe oublié » (front de UC-003)** : non fait (back seul, 19/11). Contrat prêt
  (`RequestPasswordResetCodeSchema`, `ResetPasswordSchema`, réponses `SignUpCodeSent` et `SignedIn`). Après la
  réinitialisation, prendre le `csrfToken` renvoyé ; « Pas de SMS au bout d'une minute ? » (D-033).
- Le vrai `ActorRights` (UC-005/UC-008) doit renvoyer `credentialsVersion` comme `NoRightsYet` aujourd'hui, sinon
  la fermeture des sessions après une réinitialisation (D-031) cesse de fonctionner.
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

## Organisations et salon actif (UC-004, revue sécurité du 19/11)

- **Écran « créer mon organisation » (front de UC-004)** : non fait (back seul). Contrat prêt
  (`CreateOrganizationSchema`, `OrganizationCreatedSchema`, `CITIES`). Un seul envoi à la fois ; sur
  `ORGANIZATION_ALREADY_EXISTS`, relire `GET /api/salon/session` plutôt qu'afficher une erreur (un double clic peut
  finir en 409 avec l'ancien cookie de session, déjà détruit : 401 puis reconnexion).
- Flux SSE `salon:<id>` : fermer les flux d'un utilisateur quand son appartenance change ou est révoquée (UC-005 /
  UC-008) ; aujourd'hui seule la réinitialisation du mot de passe les ferme.
- Seed : sortir le dossier `seed/` de l'image de production.
- **Écran « choisir mon salon » (front de UC-005)** : non fait (back seul, 19/11). Contrat prêt
  (`SelectActiveSalonSchema`, `ActiveSalonSelectedSchema`). Quand l'étape suivante est `OPEN_SALON`, appeler aussitôt
  « ouvrir ce salon » (D-040) ; attendre ou annuler les requêtes en cours avant un changement de salon ; prendre le
  nouveau `csrfToken` ; sur `CSRF_INVALID` (onglet resté sur l'ancien salon), relire le résumé de session ; relancer
  le flux SSE sur le nouveau salon.
- Requête lente partie avec l'ancien cookie et terminée après une rotation de session : avec `rolling: true`, elle
  renvoie `Set-Cookie` avec l'ancien identifiant, le navigateur écrase le nouveau et l'utilisateur est déconnecté (accès
  refusé, pas une faille). Côté front : attendre les requêtes en cours avant un changement de salon ; côté serveur,
  envisager de ne plus renvoyer le cookie d'une session qui n'existe plus (revue sécurité UC-005).
- SSE : `closingOf(userId)` à passer au même modèle que `closingOfSession` (un seul `Subject` filtré, sans table par
  canal) ; le `Subject` de fermeture vit dans un seul processus, à revoir avant toute 2e instance de l'API.
- « Autre salon → 404 » à rejouer en E2E avec UC-005 (aujourd'hui couvert en intégration sur `ActorRights`).
- Le champ `role` et le catalogue de permissions sont provisoires jusqu'à UC-008.
- Repositories d'`identity` : toujours sans `dispatch(pullEvents())` (ceux d'`organizations` le font).

## Invitations (UC-006, revue sécurité du 19/11)

- ~~**Avant d'ouvrir `staff:invite` à un autre rôle que le propriétaire (UC-008)**~~ : **fait le 20/11 avec UC-008** (`RoleGrantPolicy` lit désormais `SqlSalonRolePermissions` avec refus par défaut si réglage absent ; les tests T28 de `inviting-as-a-salon-administrator.e2e.test.ts` sont actifs et verts).
- **Écran « Équipe → Inviter » et liste des invitations (front de UC-006)** : non fait (back seul). Contrat prêt
  (`InviteCollaboratorSchema`, `CollaboratorInvitedSchema`, `InvitationCancelledSchema`, `SalonInvitationsSchema`) ;
  bouton « Partager sur WhatsApp » (D-043), aides des rôles (UC-006 §15), message si la liste atteint 100 lignes.
- **Page « Rejoindre un salon » (front de UC-007)** : non faite (back seul, 20/11). Contrats prêts
  (`RequestInvitationCodeSchema`, `ProveInvitationPhoneSchema`, `InvitationPhoneProvenSchema`,
  `InvitationsForProvenPhoneSchema`, `AcceptInvitationSchema`, `InvitationAcceptedSchema`). Après la preuve, lire
  `GET /api/public/invitations` (la preuve ne renvoie pas la liste) ; `suggestedName` en texte seulement (champ
  prérempli) ; prendre le `csrfToken` renvoyé quand la session s'ouvre ; `SIGN_IN_REQUIRED` → écran de connexion.
- UC-007, relevé non traité :
  - 3e « vérifier le code » (`ConfirmSignUp`, `ResetPassword`, `ProveInvitationPhone`) et 3e « demander un code » :
    à factoriser (changement des constructeurs des handlers existants et de leurs tests) ;
  - mutation (T31) non lancée : `PhoneProof.isValidFor`, borne d'échéance de `Invitation.accept`,
    `sessionAfterAcceptance` ;
  - non-énumération de la demande de code (médianes < 20 %) non mesurée, à faire avec le vrai fournisseur SMS ;
  - `IdentityModule` est `@Global()` pour fournir `INVITEE_ACCOUNTS` et `PHONE_PROOFS` à `organizations` sans
    importer son infrastructure : à revoir si d'autres modules ont besoin d'`identity` (module d'export dédié) ;
  - choix de session après acceptation : la durée absolue est vérifiée, pas les durées plus courtes des rôles
    système (D-026) ; sans escalade (la requête suivante est refusée par `AuthGuard`), mais la réponse annonce
    `SIGNED_IN` ;
  - cookie `__Host-gmc.join` non exercé par les E2E (`COOKIE_SECURE` faux en test) : ajouter un test d'attributs ;
  - runner E2E Windows : plantage intermittent d'un worker (code 3221226505) sur un fichier au hasard ; stable avec
    `--maxWorkers=2` ;
  - `@apres-UC-008` : réactiver une appartenance retirée (l'unicité `(salon_id, user_id)` répond aujourd'hui
    « vous faites déjà partie de l'équipe ») ; `@apres-UC-009` : parcours complet du compte client léger.
- Vrai fournisseur SMS : `organizations.module.ts` refuse de démarrer si `SMS_PROVIDER` n'est pas `fake`, et `fake`
  est refusé en prod : l'API ne démarre pas en prod tant que le fournisseur n'est pas branché (blocage voulu). Deux
  adaptateurs SMS existent (`identity`, `organizations`) : extraire l'envoi dans `shared` au 3e utilisateur (UC-009).
- Nom de salon : liste blanche de caractères (pas de liens, `@`, suites de chiffres) à décider avant la publication
  sur la marketplace (lot 3) ; le SMS d'invitation, lui, ne le contient plus (D-046).

## Use cases du lot 1 à rédiger ou aligner (20/11)

- ~~**À rédiger** (`use-case-writer`) : UC-010, UC-011, UC-012~~ — **rédigés et validés le 20/11** (`docs/use-cases/UC-010` à `UC-012`, décisions D-056 à D-058) ; backend livré le 20/11 (voir `docs/EVOLUTIONS.md`).
- **UC-004 E6 / T26 à aligner sur D-054** : le compte client léger qui veut créer une organisation est refusé par la
  protection d'espace (403 « Cet espace est réservé aux salons… ») avant le domaine ; le refus
  `OWNER_ACCOUNT_REQUIRED` (422) reste en défense.
- **UC-007 / RG-009-06** : l'acceptation d'une invitation par un compte existant doit aussi enregistrer la date de
  preuve du numéro (`User.recordPhoneProof`), comme tout parcours qui prouve le numéro (`SignIn` compris).
- ~~**Ordre d'implémentation conseillé** : la protection d'espace (`/api/client/*`, type de session, D-055) avant la première session client de UC-009.~~ **Fait le 20/11** avant UC-009.

## Rôles salon et espace client léger (UC-008 & UC-009, revues sécurité du 20/11)

- **Écrans front UC-008** (« Paramètres → Rôles et permissions », onboarding étape 6, `<RequirePermission>` branché sur `session.permissions`, aides du §15) : non faits (back seul). Contrats prêts (`AdjustRolePermissionsSchema`, `RolePermissionsAdjustedSchema`, `SalonRolesSchema`, `DEFAULT_ROLE_PERMISSIONS`).
- **Écrans front UC-009** (numéro, code SMS, espace client, à livrer avec « Mes réservations » lot 4) : non faits (back seul). Contrats prêts (`RequestClientCodeSchema`, `VerifyClientCodeSchema`, `ClientSignedInSchema`, `ClientSessionSummarySchema`).
- **UC-009 — D-053 / `SignInHandler` (`recordPhoneProof`)** (revue sécurité du 20/11) : `SignInHandler` rafraîchit aujourd'hui `phoneVerifiedAt` sur connexion par mot de passe conformément à D-053 et T15 ; la revue sécurité signale qu'une connexion par mot de passe ne prouve pas la possession actuelle de la carte SIM (un numéro recyclé pourrait rester sous le seuil de 180 j si l'ancien titulaire s'est connecté par mot de passe). À arbitrer par le user s'il souhaite restreindre `recordPhoneProof` aux seules preuves SMS.
- **UC-009 — `ProveInvitationPhoneHandler`** (durcissement sécurité du 20/11) : enregistrer aussi `recordPhoneProof` dès la preuve SMS d'invitation si le compte existe (aujourd'hui fait à l'acceptation).
- **UC-009 — Plafond global SMS tous motifs confondus** (durcissement sécurité du 20/11) : ajouter un plafond global par numéro (ex. 15–20 SMS / 24 h) avant de brancher le vrai fournisseur SMS, en plus des quotas isolés par motif (`SIGN_UP`, `PASSWORD_RESET`, `INVITATION`, `CLIENT_LOGIN`).
- **UC-008 / UC-009 — Mutation testing (Stryker)** : T29 (UC-008) et T26 (UC-009) non lancés en mode light ; T25 (`@apres-UC-009` : rejeu UC-004 T26 aligné 403 et UC-007 T20 avec un compte client léger issu de UC-009) à activer.
- **UC-008 — `EXPLAIN (ANALYZE, BUFFERS)`** sur `salon_role_permissions` : à mesurer après `migration:run && db:seed` sur la base locale ; index partiel optionnel `salon_memberships (salon_id, role) WHERE status = 'ACTIVE'` si le volume de membres révoqués par salon grandit.

## Salons, équipe et rôles système (UC-010 à UC-012, revue sécurité du 20/11)

- **Écrans front** non faits (back seul) : « Ajouter un salon » (UC-010), « Équipe » (liste, changer de rôle,
  retirer, UC-011), administration « Rôles GoMeCoiffer » (UC-012). Contrats prêts dans `packages/contracts`
  (`organizations.ts`, `platform.ts`).
- **Avant le lot 4** : après une rétrogradation (ex. Administrateur → Coiffeur), le flux SSE `salon:<id>` reste
  ouvert et tous les membres reçoivent les mêmes signaux quel que soit leur rôle ; filtrer les signaux selon
  `bookings:view-all` / `view-own`, ou fermer le flux au changement de rôle (revue sécurité, point 7).
- UC-011 : `actorPermissions` est un instantané du garde ; une rétrogradation de l'auteur pendant sa requête laisse
  une fenêtre de quelques millisecondes (risque faible, non traité).
- Mutation (Stryker) non lancée : UC-011 T23, UC-012 T24 ; UC-010 T19 (`@apres-UC-012`, rejeu d'un administrateur
  plateforme propriétaire qui ajoute un salon) non couvert.
- Tests d'annulation de migration : trois comptent encore la pile des migrations en dur
  (`reverting-the-invitations-migration`, `…-organizations-migration`, `…-invitation-acceptance-migrations`) ;
  passer au modèle « boucler jusqu'à disparition de l'objet ».
- `identity.module.ts` fournit des ports de `platform` (`STAFF_ACCOUNT_LOOKUP`, `USER_SESSIONS_REVOKER`) et
  `IdentityModule` reste `@Global()` : à revoir avec un module d'export dédié si les dépendances croisées augmentent.
- `todo` « re-activates a membership removed earlier @apres-UC-008 » de `accepting-an-invitation.test.ts` : couvert
  par `managing-the-salon-team` (unit et E2E T16), à supprimer.
- Use cases : retirer les marques `@apres-UC-008` / `@apres-UC-009` / `@apres-UC-012` devenues jouables.

## Revue d'architecture du 19/11 : suggestions 🟠 non traitées

- `RequestSignUpCode` envoie le SMS dans la transaction (si le commit échoue, le code part sans être enregistré) :
  l'aligner sur `RequestPasswordResetCode` (`AfterCommit.registerDetached`) avant le vrai fournisseur SMS.
- Repositories : la version en mémoire n'est pas mise à jour après `save` (un 2e `save` du même agrégat dans une
  transaction échoue) ; aucun `dispatch(pullEvents())` dans `save` (le premier événement de domaine serait perdu).
- `SignUpNextStep` double l'enum `NextStep` ; le champ `outcome` de `ConfirmSignUp` n'est lu que par les tests.
- Renommer `typeorm-user-sessions` en adaptateur ; le contrat `SignUpCodeSent` (réutilisé par UC-003) en `CodeSent`.
- Limites de débit en dur sur l'inscription et la réinitialisation (celles de la connexion sont configurables) ;
  `HOUR_MS` dupliqué.
- Commentaires trop longs à raccourcir.
- Doublons à surveiller (factoriser à la 3e occurrence) : « vérifier le code » (inscription, réinitialisation),
  « remplacer le défi » (deux demandes de code).
- Temps de réponse comparable (D-019) non mesurable avec le faux fournisseur SMS : à mesurer avec le vrai.

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

## Front partagé et app mobile (D-060, D-061, 20/11)

Ordre : 1, puis 2 avec le front du lot 1, puis 3.

1. **Créer `packages/client-core`** (avant le front du lot 1) : y déplacer `lib/store` (store, `createAppAsyncThunk`,
   `appApi`, actions, listeners), le port `HttpClient`, le routage temps réel, la logique rbac, `format` et les
   dictionnaires i18n ; le web garde `WebHttpClient`, la source `EventSource`, les composants de garde et le rendu.
   Règles `pnpm arch` : `client-core` n'importe ni `react-dom`, ni `react-native`, ni `fetch`, ni stockage ; un
   `*HttpGateway` n'est instancié que dans `lib/store/dependencies/` de chaque app. Mettre à jour `docs/checklists.md`.
2. **Front du lot 1** (web) sur cette base, module `auth` en premier (`docs/frontend-modules.md`).
3. **App mobile `mobile/`** (`docs/mobile.md`) :
   - prérequis côté API : **UC-013 session mobile par jeton porteur** (en rédaction le 20/11), avec revue sécurité ;
   - socle : Expo SDK 58, Expo Router, NativeWind v5 + React Native Reusables, Expo UI, `createMobileStore`,
     `MobileHttpClient`, `react-native-sse`, `expo-secure-store`, jest-expo, EAS (profils, dev client) ;
   - pnpm : vérifier les dépendances isolées (repli `nodeLinker: hoisted`), `allowBuilds` et la politique d'âge ;
   - puis les écrans, lot par lot, en commençant par l'authentification et l'espace client.
- **Skills des agents à installer par le user** (refusé à l'agent par le garde-fou de Claude Code) :
  `claude plugin install expo@claude-plugins-official --scope project` (puis `/mcp`) et
  `npx skills@latest add callstackincubator/agent-skills --skill react-native-best-practices`. Ensuite, ajouter
  un agent `mobile-builder` (ou étendre `front-builder` / `front-ui`) qui charge ces skills.
- **Décisions à prendre plus tard** : comptes Apple Developer et Google Play, identifiants de l'app
  (`bundleIdentifier`, `package`), domaine des liens universels (`/rejoindre`, `/reprogrammation/:token`),
  notifications push (hors PRD actuel).

## Lots MVP (ordre proposé, cycle Disponibilité → Réservation → Paiement → Prestation terminée)

Chaque lot commence par `use-case-writer` (use cases + `.feature`), puis contrat dans `packages/contracts`,
puis back et front en parallèle.

1. **Comptes, organisation et salons** (PRD §3-7, F07 en partie) : compte du propriétaire, organisation, premier
   salon, appartenances, rôles salon prédéfinis et permissions ajustables, droits protégés du propriétaire,
   salon actif en session, rôles système séparés, onboarding sauvegardé par étape.
2. **Prestations et intervenants** (onboarding étapes 3-6, F07) : prestations (prix, durée, actif), intervenants,
   spécialités, prestations autorisées, horaires, pauses, indisponibilités (l'invitation des collaborateurs relève du lot 1 : UC-006, UC-007, D-045).
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
9. **Avis et notes** (F09, D-059, ajouté au MVP le 20/11) : avis d'une réservation terminée (note du salon et du
   professionnel, commentaire), réponse et signalement par le salon, modération par l'administration, moyennes et
   tri « Mieux notés » sur la marketplace, écran « Avis clients » du back-office. Peut démarrer dès que le lot 4
   produit des réservations « Prestation terminée » ; nouveau module backend `reviews`. Prévoir dès le lot 3 la
   place de la note sur la carte et la fiche du salon, et dès le lot 4 le lien « Laisser un avis » dans « Mes
   réservations ». Au démarrage : compléter le catalogue des permissions de UC-008 avec le module « Avis clients »
   (consulter, répondre, signaler), ses défauts par rôle et une migration pour les salons existants.

## Hors MVP (PRD §14) — ne rien préparer

Notifications « coiffeur libre », marketing automatisé, fidélité, abonnements clients, chat,
sponsoring opérationnel, commission automatique, stock, paie, comptabilité, franchises, multi-intervenants,
application mobile native, IA, cabines et équipements partagés.

## À observer

- Indicateurs de réussite du PRD §15 : prévoir dès le lot 4 les données qui permettront de les mesurer (taux de
  conflits, absences, reprogrammations réussies), sans écran d'analyse avancée.
