# Inventaire des exigences — GoMeCoiffer

Source : `docs/cahier-des-charges/prd.md` (lecture seule) et décisions du user (`docs/DECISIONS.md`).
Les fonctionnalités (`F01`…`F08`) et règles de réservation (`BR-01`…`BR-12`) gardent les identifiants du PRD ;
les autres exigences reçoivent un `EX-xxx`. Une exigence = une phrase vérifiable.

**État** : inventaire commencé avec le lot 1 (comptes, organisations, salons, rôles) et les exigences
transverses de sécurité et de données. Il sera complété lot par lot.

## Exigences du lot 1 et transverses

| ID | Source | Énoncé reformulé | Type | Priorité PRD | Use case(s) |
|---|---|---|---|---|---|
| EX-001 | prd.md §3 Hiérarchie | Un utilisateur est une identité de connexion unique. | Règle métier | P0 | UC-001, UC-002, UC-003, UC-009 |
| EX-002 | prd.md §3 Hiérarchie, Exemple | Un propriétaire gère plusieurs salons avec un seul compte utilisateur. | Fonctionnelle | P0 | UC-004, UC-005 |
| EX-003 | prd.md §3 Hiérarchie | Une organisation peut posséder plusieurs salons. | Règle métier | P0 | UC-004 |
| EX-004 | prd.md §3 Hiérarchie | Un utilisateur peut appartenir à plusieurs salons, avec des rôles différents. | Règle métier | P0 | UC-005, UC-006 |
| EX-005 | prd.md §3 Exemple | Chaque salon conserve ses propres services, tarifs, collaborateurs, horaires, réservations et paramètres. | Règle métier | P0 | UC-004 |
| EX-006 | prd.md §3 Règles de multi-tenancy | Aucun collaborateur n'accède à un salon sans appartenance autorisée. | Règle métier / Sécurité | P0 | UC-002, UC-005, UC-006 |
| EX-007 | prd.md §3 Règles de multi-tenancy | Les permissions sont évaluées par salon. | Règle métier | P0 | UC-005, UC-008 |
| EX-008 | prd.md §3 Règles de multi-tenancy | Un propriétaire peut administrer tous les salons de son organisation. | Règle métier | P0 | UC-004, UC-005 |
| EX-009 | prd.md §3 Règles de multi-tenancy | Le changement de salon change le contexte d'autorisation. | Règle métier / Sécurité | P0 | UC-002 (aucun salon actif à la connexion), UC-005 |
| EX-010 | prd.md §3 Règles de multi-tenancy | Les données financières restent isolées par établissement. | Règle métier / Sécurité | P0 | UC-005 |
| EX-011 | prd.md §2 Règle d'architecture, §4 | Les rôles système ne sont pas des rôles salon ; ils sont évalués dans leur propre périmètre. | Règle métier / Sécurité | P0 | UC-001, UC-002, UC-008 |
| EX-012 | prd.md §4 | Les rôles système sont attribués exclusivement par GoMeCoiffer ; un utilisateur de salon ne peut jamais se les attribuer. | Sécurité | P0 | UC-001, UC-008 |
| EX-013 | prd.md §4 | Le client de la marketplace est un utilisateur public, sans permission d'administration. | Règle métier | P0 | UC-009 |
| EX-014 | prd.md §5.1 | Les droits essentiels du propriétaire ne sont pas désactivables par un rôle personnalisé. | Règle métier / Sécurité | P0 | UC-008 |
| EX-015 | prd.md §5.5 | Les spécialités sont des métiers, pas des rôles de sécurité. | Règle métier | P0 | UC-006 |
| EX-016 | prd.md §6 Fonctionnement attendu | Chaque rôle salon a des permissions par défaut, modifiables par le propriétaire ; effet immédiat. | Fonctionnelle | P0 | UC-008 |
| EX-017 | prd.md §6 Restriction | Aucun administrateur de salon ne modifie les rôles globaux ni ne s'attribue les droits du propriétaire. | Sécurité | P0 | UC-008 |
| EX-018 | prd.md §7 Étape 1 | La création du compte demande : nom du responsable, téléphone, e-mail si disponible, moyen de connexion sécurisé. | Fonctionnelle | P0 | UC-001, UC-002 (moyen de connexion), UC-003 (récupération du moyen de connexion) |
| EX-019 | prd.md §7 Étape 1 | Après la création du compte, l'utilisateur crée son organisation. | Fonctionnelle | P0 | UC-001, UC-004 |
| EX-020 | prd.md §7 introduction | L'onboarding guide un propriétaire non technique. | Non fonctionnelle (UX) | P0 | UC-001, UC-002, UC-003, UC-004 |
| EX-021 | prd.md §7 fin | L'onboarding est sauvegardé progressivement pour permettre une reprise. | Fonctionnelle | P0 | UC-004 |
| EX-022 | prd.md §7 Étape 4 | Le propriétaire peut inviter ses collaborateurs. | Fonctionnelle | P0 | UC-006, UC-007 |
| EX-023 | prd.md §11 | Les modifications sensibles de permissions conservent une trace d'audit. | Non fonctionnelle (audit) | P0 | UC-001, UC-008 |
| EX-024 | prd.md §12 Sécurité | Contrôle d'accès côté backend et séparation stricte des établissements. | Sécurité | P0 | tous |
| EX-025 | prd.md §12 Données | Collecte minimale des informations, conservation encadrée, accès limités, conformité au cadre camerounais. | Contrainte | P0 | UC-001, UC-002, UC-003, UC-009 |
| EX-026 | prd.md §12 Dates | Instants conservés en UTC, affichés dans le fuseau local du salon. | Contrainte | P0 | tous |
| EX-027 | prd.md §1 Objectifs, §2.A | Le client consulte la marketplace sans créer de compte ; il réserve sans application mobile. | Fonctionnelle | P0 | UC-009 |
| EX-028 | prd.md F03 | Une vérification du numéro ou un lien sécurisé permet au client de retrouver et modifier sa réservation. | Fonctionnelle / Sécurité | P0 | UC-009 |
| EX-029 | prd.md §2.B, §11 (User : « Identité et authentification ») | Le back-office n'est accessible qu'aux propriétaires et collaborateurs authentifiés ; l'utilisateur ouvre et ferme sa session. | Fonctionnelle / Sécurité | P0 | UC-002, UC-003 (accès retrouvé après un oubli) |
| D-004 | DECISIONS.md | Session serveur (cookie HttpOnly, stockage PostgreSQL) + CSRF double-submit ; pas de JWT. | Décision | — | UC-001, UC-002, UC-003 |
| D-019 | DECISIONS.md | Non-énumération des comptes : aucune réponse ne révèle si un numéro est inscrit. | Décision | — | UC-001, UC-002, UC-003 |
| D-020 | DECISIONS.md | Mot de passe du personnel : 10 à 128 caractères, empreinte argon2id. | Décision | — | UC-001, UC-002, UC-003, UC-007 |
| D-017 | DECISIONS.md | Personnel : téléphone + mot de passe ; code SMS seulement pour les actions sensibles (création du compte, mot de passe oublié, invitation, changement de numéro). | Décision | — | UC-001, UC-002, UC-003, UC-007 |
| D-018 | DECISIONS.md | Client : compte léger sans mot de passe, identifié par son numéro vérifié par SMS ; même numéro = même utilisateur que le personnel. | Décision | — | UC-001, UC-002, UC-003, UC-009 |
| D-021, D-023 | DECISIONS.md | Envoi des codes SMS : 60 s entre deux codes, 5 par heure, 10 par 24 h, plus aucun après 10 codes faux en 24 h, par numéro **et par motif** ; limite par adresse ; une panne du fournisseur ne compte pas. | Décision | — | UC-001, UC-003, UC-007, UC-009 |
| D-025 | DECISIONS.md | Blocages de connexion limités aux appareils non reconnus ; « Mot de passe oublié » lève les blocages. | Décision | — | UC-002, UC-003 |
| D-028 | DECISIONS.md | Audit sans numéro ni adresse réseau ; sessions simultanées illimitées ; la réinitialisation du mot de passe ferme toutes les sessions de l'utilisateur. | Décision | — | UC-002, UC-003 |

## Anomalies du PRD

| # | Type | Passage | Constat | Proposition |
|---|---|---|---|---|
| A-1 | Ambiguïté | §7 Étape 1 « Moyen de connexion sécurisé » | Le moyen n'est pas défini. | **Résolu** par D-017 / D-018. |
| A-2 | Trou | §7 Étape 1 « Email, si disponible » | Aucune règle : l'e-mail sert-il à se connecter ? doit-il être unique ? vérifié ? | Contact facultatif, ni identifiant ni vérifié au MVP — [HYPOTHÈSE], UC-001 Q4. |
| A-3 | Trou | §7, §10 | Qui peut créer une organisation ? L'inscription est-elle libre (self-service) ou sur validation de GoMeCoiffer ? Un essai gratuit démarre-t-il à l'inscription ? | Inscription libre, validation par l'équipe Opérations avant publication (§4) — [HYPOTHÈSE], UC-001 Q6. |
| A-4 | Trou | §12 Données | Pas de règle de consentement ni d'acceptation de conditions d'utilisation, alors que des données personnelles sont collectées. | Acceptation explicite des conditions et de la politique de confidentialité à l'inscription — [HYPOTHÈSE], UC-001 Q5. |
| A-5 | Non testable | §7 « guider un propriétaire non technique » | Formulation qualitative. | Mesurable : 9 propriétaires sur 10 du pilote créent leur compte sans assistance (indicateur §15 « sans assistance »). |
| A-6 | Trou | §16 « Politique de conservation et protection des données » | Durée de conservation des comptes inactifs et des codes non définie. | À trancher avant la production (backlog). |
| A-7 | Trou | §2.B, §11 « authentification » | Le PRD ne dit rien de la connexion elle-même : déconnexion, durée de session, protection contre la recherche de mot de passe, blocage d'un compte par un tiers. | Règles proposées dans UC-002 (RG-002-04 à -12, -15) — [HYPOTHÈSE], UC-002 Q1, Q3. |
| A-8 | Trou | §4 « une même personne autorisée peut remplir plusieurs responsabilités », §2 règle d'architecture | Une personne peut-elle avoir à la fois un rôle système et une appartenance à un salon ? Où arrive-t-elle après connexion ? | Administration d'abord, accès à ses salons ensuite — [HYPOTHÈSE], UC-002 Q4. |
| A-9 | Trou | §11 « trace d'audit » | L'audit est exigé pour permissions, réservations et paiements ; rien sur les connexions. | Tracer connexion réussie, blocage, déconnexion, sans numéro ni adresse réseau — [HYPOTHÈSE], UC-002 Q5. |
| A-10 | Trou | §2.B, §7 Étape 1, §11 « Identité et authentification » | Le PRD ne prévoit aucune récupération d'accès (mot de passe oublié) ni ses effets sur les sessions et les blocages. | **Résolu** par D-017 (code SMS), D-025, D-028, D-030 et D-031 (détail dans UC-003). |
| A-11 | Trou | §3 « identité de connexion unique » liée au téléphone | Les opérateurs réattribuent les numéros inactifs : le nouveau titulaire peut réinitialiser le mot de passe d'un membre du personnel et entrer dans son salon. | Accepter au MVP avec trace d'audit, mesure à décider avant la production — D-032 (UC-003 Q7, backlog C3). |
