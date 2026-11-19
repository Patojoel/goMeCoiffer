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
| EX-002 | prd.md §3 Hiérarchie, Exemple | Un propriétaire gère plusieurs salons avec un seul compte utilisateur. | Fonctionnelle | P0 | UC-004, UC-005, UC-010 |
| EX-003 | prd.md §3 Hiérarchie | Une organisation peut posséder plusieurs salons. | Règle métier | P0 | UC-004 (premier salon), UC-010 (salons suivants, à rédiger) |
| EX-004 | prd.md §3 Hiérarchie | Un utilisateur peut appartenir à plusieurs salons, avec des rôles différents. | Règle métier | P0 | UC-005, UC-006 |
| EX-005 | prd.md §3 Exemple | Chaque salon conserve ses propres services, tarifs, collaborateurs, horaires, réservations et paramètres. | Règle métier | P0 | UC-004 |
| EX-006 | prd.md §3 Règles de multi-tenancy | Aucun collaborateur n'accède à un salon sans appartenance autorisée. | Règle métier / Sécurité | P0 | UC-002, UC-004 (aucun droit sur un salon créé par un autre), UC-005 (salon sans appartenance active : refus 404 identique ; appartenance retirée oubliée à la requête suivante), UC-006 |
| EX-007 | prd.md §3 Règles de multi-tenancy | Les permissions sont évaluées par salon. | Règle métier | P0 | UC-005, UC-008 |
| EX-008 | prd.md §3 Règles de multi-tenancy | Un propriétaire peut administrer tous les salons de son organisation. | Règle métier | P0 | UC-004, UC-005, UC-010 (appartenance « Propriétaire » sur chaque nouveau salon, D-041) |
| EX-009 | prd.md §3 Règles de multi-tenancy | Le changement de salon change le contexte d'autorisation. | Règle métier / Sécurité | P0 | UC-002 (aucun salon actif à la connexion), UC-004 (salon créé ouvert dans la session), UC-005 (ouverture et changement de salon actif, session régénérée) |
| EX-010 | prd.md §3 Règles de multi-tenancy | Les données financières restent isolées par établissement. | Règle métier / Sécurité | P0 | UC-005 (en partie : toute lecture vise le seul salon actif) ; isolation de chaque écran financier prouvée par le cas de périmètre de chaque query (lots 4, 5, 8) |
| EX-011 | prd.md §2 Règle d'architecture, §4 | Les rôles système ne sont pas des rôles salon ; ils sont évalués dans leur propre périmètre. | Règle métier / Sécurité | P0 | UC-001, UC-002, UC-004, UC-005, UC-008 |
| EX-012 | prd.md §4 | Les rôles système sont attribués exclusivement par GoMeCoiffer ; un utilisateur de salon ne peut jamais se les attribuer. | Sécurité | P0 | UC-001, UC-004, UC-008 |
| EX-013 | prd.md §4 | Le client de la marketplace est un utilisateur public, sans permission d'administration. | Règle métier | P0 | UC-009 |
| EX-014 | prd.md §5.1 | Les droits essentiels du propriétaire ne sont pas désactivables par un rôle personnalisé. | Règle métier / Sécurité | P0 | UC-004 (rôle de propriétaire non configurable), UC-008 |
| EX-015 | prd.md §5.5 | Les spécialités sont des métiers, pas des rôles de sécurité. | Règle métier | P0 | UC-006 |
| EX-016 | prd.md §6 Fonctionnement attendu | Chaque rôle salon a des permissions par défaut, modifiables par le propriétaire ; effet immédiat. | Fonctionnelle | P0 | UC-008 |
| EX-017 | prd.md §6 Restriction | Aucun administrateur de salon ne modifie les rôles globaux ni ne s'attribue les droits du propriétaire. | Sécurité | P0 | UC-008 |
| EX-018 | prd.md §7 Étape 1 | La création du compte demande : nom du responsable, téléphone, e-mail si disponible, moyen de connexion sécurisé. | Fonctionnelle | P0 | UC-001, UC-002 (moyen de connexion), UC-003 (récupération du moyen de connexion) |
| EX-019 | prd.md §7 Étape 1 | Après la création du compte, l'utilisateur crée son organisation. | Fonctionnelle | P0 | UC-001, UC-004 |
| EX-020 | prd.md §7 introduction | L'onboarding guide un propriétaire non technique. | Non fonctionnelle (UX) | P0 | UC-001, UC-002, UC-003, UC-004 |
| EX-021 | prd.md §7 fin | L'onboarding est sauvegardé progressivement pour permettre une reprise. | Fonctionnelle | P0 | UC-004 |
| EX-022 | prd.md §7 Étape 4 | Le propriétaire peut inviter ses collaborateurs. | Fonctionnelle | P0 | UC-006, UC-007 |
| EX-023 | prd.md §11 | Les modifications sensibles de permissions conservent une trace d'audit. | Non fonctionnelle (audit) | P0 | UC-001, UC-004, UC-008 |
| EX-024 | prd.md §12 Sécurité | Contrôle d'accès côté backend et séparation stricte des établissements. | Sécurité | P0 | tous |
| EX-025 | prd.md §12 Données | Collecte minimale des informations, conservation encadrée, accès limités, conformité au cadre camerounais. | Contrainte | P0 | UC-001, UC-002, UC-003, UC-004, UC-009 |
| EX-026 | prd.md §12 Dates | Instants conservés en UTC, affichés dans le fuseau local du salon. | Contrainte | P0 | tous |
| EX-027 | prd.md §1 Objectifs, §2.A | Le client consulte la marketplace sans créer de compte ; il réserve sans application mobile. | Fonctionnelle | P0 | UC-009 |
| EX-028 | prd.md F03 | Une vérification du numéro ou un lien sécurisé permet au client de retrouver et modifier sa réservation. | Fonctionnelle / Sécurité | P0 | UC-009 |
| EX-029 | prd.md §2.B, §11 (User : « Identité et authentification ») | Le back-office n'est accessible qu'aux propriétaires et collaborateurs authentifiés ; l'utilisateur ouvre et ferme sa session. | Fonctionnelle / Sécurité | P0 | UC-002, UC-003 (accès retrouvé après un oubli) |
| EX-030 | prd.md §7 Étape 2 | Le premier salon est enregistré avec son nom commercial, son type (salon de coiffure, barber shop, esthétique ou mixte), sa ville et son quartier, son adresse descriptive / point de repère et son téléphone commercial. | Fonctionnelle | P0 | UC-004 |
| EX-031 | prd.md §7 Étape 2 | Le salon a une photo principale et une courte description. | Fonctionnelle | P0 | **Non couvert** : use case à créer (upload, périmètre critique), hors UC-004 (UC-004 Q3) |
| EX-032 | prd.md §7 Étape 2 | Le salon a des horaires d'ouverture. | Fonctionnelle | P0 | **Non couvert** : use case à créer (lot 1 ou 2), lien avec les horaires de travail à clarifier (A-13) |
| EX-033 | prd.md §5.1 | Le rôle de propriétaire est lié à la propriété de l'organisation ; le propriétaire crée et gère ses salons. | Règle métier | P0 | UC-004 (création), UC-005 (ouvre chacun des salons de son organisation), UC-010 (ajout de salons, à rédiger), UC-008 (droits protégés) |
| EX-034 | prd.md F01 critères, §7 Étape 7 | Un salon non publié n'apparaît pas dans la marketplace ; il est publiable dès qu'au moins une prestation, un professionnel éligible et des horaires valides sont configurés. | Règle métier | P0 | UC-004 (salon créé non publié), lot 3 (publication) |
| EX-035 | prd.md §3 Règles de multi-tenancy | Chaque établissement possède son abonnement. | Règle métier | P0 | **Non couvert** : lot 7 (UC-004 ne crée aucun abonnement, Q7) |
| EX-036 | prd.md §12 Fiabilité | Les événements manqués lors d'une déconnexion du suivi en direct n'entraînent pas un affichage durablement incorrect : relecture complète à chaque reconnexion. | Non fonctionnelle (fiabilité) | P0 | UC-005 (en partie : flux de l'ancien salon fermé, relecture à la reconnexion) ; lots 3 et 4 (planning, disponibilités) |
| D-003 | DECISIONS.md | Le salon actif est porté par la session et change le contexte d'autorisation. | Décision | — | UC-004, UC-005 |
| D-027 | DECISIONS.md | Étape suivante après la connexion : rôle système → administration ; une appartenance → ce salon s'ouvre ; plusieurs → choix ; aucune → créer son organisation. | Décision | — | UC-002, UC-004, UC-005 |
| D-037 | DECISIONS.md | Droits relus à chaque requête (`ActorRights`) ; session régénérée au changement de privilèges (nouvel identifiant, nouveau jeton). | Décision | — | UC-004, UC-005 (étendue au changement de salon par D-039) |
| D-035 | DECISIONS.md | Une seule organisation par utilisateur ; le nom d'un salon n'est unique qu'au sein de son organisation. | Décision | — | UC-004 (organisation unique), UC-010 (unicité du nom de salon, à rédiger) |
| D-039 | DECISIONS.md | Session régénérée à chaque ouverture ou changement de salon ; seuls les flux en direct de l'ancienne session sont fermés ; une session remplacée n'est jamais recréée ; pas de garde-fou « salon attendu ». | Décision | — | UC-005 |
| D-040 | DECISIONS.md | Ouverture d'office par un appel du front ; dernier salon non retenu ; changement de salon non audité ; ville et quartier dans la liste des salons. | Décision | — | UC-005 |
| D-041 | DECISIONS.md | Appartenance « Propriétaire » sur chaque salon de l'organisation, garantie par UC-010 (qui porte aussi l'unicité du nom de salon) ; salon suspendu traité au lot 7 dans `ActorRights`. | Décision | — | UC-005, UC-010 |
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
| A-12 | Trou | §3 Hiérarchie, §11 (Organization) | L'organisation n'a aucun attribut défini (nom ? raison sociale ? identifiant fiscal ?) et le PRD ne dit pas si elle se crée à part du premier salon. | **Résolu** par D-035 : organisation créée avec le premier salon, en une seule action, nommée comme lui (UC-004 Q2). |
| A-13 | Ambiguïté | §7 Étape 2 « Horaires d'ouverture », Étape 5 « Jours et heures de travail », Étape 7 « horaires valides » | Le lien entre les horaires d'ouverture du salon et les horaires de travail des professionnels n'est pas défini (bornes ? lesquels comptent pour la publication et les créneaux ?). | À trancher dans le use case des horaires (EX-032), avant le lot 3. |
| A-14 | Trou | §7 Étape 2 | Aucun champ n'est dit obligatoire ou facultatif ; aucun format pour la ville et le quartier, alors que la marketplace cherche « par ville et quartier » (F01). | **Résolu** par D-036 : six informations obligatoires, ville dans une liste fermée tenue par GoMeCoiffer, quartier en texte libre (UC-004 Q3, Q4, RG-004-04 à RG-004-08). |
| A-15 | Trou | §3 Hiérarchie, §5.1 | Combien d'organisations un utilisateur peut-il posséder ? Un collaborateur ou un administrateur GoMeCoiffer peut-il en créer une ? | **Résolu** par D-035 (une seule organisation par utilisateur, garantie en base) et D-038 (collaborateur et administrateur GoMeCoiffer autorisés pour leur propre organisation, compte client léger refusé) — UC-004 Q1, Q9, Q10, Q12. |
| A-16 | Trou | F08 « Activer, suspendre ou rétablir », §3 « chaque établissement possède son abonnement », §10 « essai limité » | L'état d'un salon à sa création (activé ? en attente de validation ?) et le démarrage éventuel d'un essai ne sont pas définis. | **Résolu pour la création** par D-036 : salon utilisable aussitôt, non publié, sans abonnement (UC-004 Q7) ; activation, suspension et essai à décider avec le lot 7 (backlog). |
| A-17 | Ambiguïté | §7 « sauvegardé progressivement » | Granularité non définie (par champ ? par étape ?). | **Résolu** par D-035 et D-036 : par étape, chaque étape est enregistrée dès sa validation (photo, description et horaires dans des étapes suivantes) ; la reprise passe par l'étape suivante de la connexion (D-027) — UC-004 RG-004-03, RG-004-12. |
| A-18 | Trou | §3 Multi-tenancy « Le changement de salon change le contexte d'autorisation » | Le PRD ne dit pas comment le salon est choisi ni s'il est retenu d'une connexion à l'autre, ni ce qui arrive avec plusieurs onglets ou appareils, ni au suivi en direct de l'ancien salon. | **Résolu** par D-039 et D-040 : choix dans la liste de ses salons (avec ville et quartier), ouverture d'office d'un salon unique par un appel du front, aucun salon retenu, un salon actif par session régénérée à chaque changement, flux de l'ancienne session fermés, session remplacée jamais recréée — UC-005 RG-005-08 à RG-005-12, Q1 à Q3, Q5, Q6, Q8, Q10. |
| A-19 | Ambiguïté | §3 Multi-tenancy « Aucun collaborateur ne peut accéder à un salon sans appartenance autorisée » et « Un propriétaire peut administrer tous les salons de son organisation » | Le propriétaire tient-il son accès d'une appartenance à chaque salon ou de la seule propriété de l'organisation ? | **Résolu** par D-041 : une appartenance « Propriétaire » sur chaque salon de l'organisation, créée avec le salon (UC-004 pour le premier, UC-010 pour les suivants) — UC-005 RG-005-04, Q7. |
| A-20 | Trou | F08 « Activer, suspendre ou rétablir un établissement » | Ce que peut faire un membre dans un salon suspendu (l'ouvrir ? le consulter ? y écrire ?) n'est pas défini. | **Reporté au lot 7 par D-041**, à un seul endroit : la décision « peut agir dans ce salon » (`ActorRights`), utilisée à l'ouverture et à chaque requête — UC-005 RG-005-16, Q9. |
