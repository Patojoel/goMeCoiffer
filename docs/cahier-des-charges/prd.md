
# GoMeCoiffer — Product Requirements Document

**Version :** 1.2 — MVP (20/11/2026 : avis et notes intégrés au MVP, fiche F09, D-059 ; application mobile iOS et Android dans le MVP, D-061 et D-062)
**Statut :** Proposition de périmètre fonctionnel
**Marché initial :** Cameroun
**Utilisateurs :** Clients, propriétaires de salons, administrateurs, professionnels de beauté et personnel financier
**Supports :** Application web responsive, marketplace mobile-first et back-office SaaS ; application mobile iOS et Android (une seule app, espaces client et salon), développée en parallèle du web

---

## 1. Vision et positionnement

GoMeCoiffer est une solution SaaS multi-établissements associée à une marketplace de réservation de prestations de coiffure, de barbering, d'esthétique et de soins de beauté.

La proposition de valeur repose sur deux engagements :

**Pour les clients :** connaître les disponibilités d'un professionnel, réserver en quelques étapes et choisir entre le paiement en ligne et le paiement au salon.

**Pour les établissements :** centraliser les réservations, éviter les doubles rendez-vous et administrer les collaborateurs, prestations, horaires et paiements depuis un back-office.

### Problèmes prioritaires

- Les clients ignorent souvent si leur professionnel préféré est disponible.
- Les salons gèrent les rendez-vous par téléphone, WhatsApp ou cahier.
- Les rendez-vous peuvent se chevaucher et les passages sans réservation perturbent le planning.
- Les professionnels perdent du temps à confirmer ou reprogrammer les rendez-vous.
- Les propriétaires disposant de plusieurs salons manquent d'une vue centralisée.

### Objectifs du MVP

1. Permettre de réserver une prestation auprès d'un professionnel disponible.
2. Proposer deux modes de paiement : en ligne et au salon.
3. Garantir la cohérence du planning en temps réel.
4. Permettre aux salons de gérer leurs collaborateurs et leurs accès.
5. Simplifier les reprogrammations sans messagerie complexe.
6. Commercialiser un abonnement mensuel ou annuel.

**Principe directeur :** un MVP simple et fiable vaut mieux qu'un logiciel complet de gestion de salon dont les fonctions essentielles sont mal exécutées.

---

## 2. Architecture fonctionnelle du produit

Le produit comprend trois espaces distincts.

### A. Marketplace publique

Destinée aux clients :

- Rechercher un salon par ville, quartier, nom ou prestation.
- Consulter les profils publics des salons.
- Découvrir les professionnels et leurs spécialités.
- Consulter les disponibilités en temps réel.
- Réserver, payer et gérer ses rendez-vous.
- Consulter les notes et avis, et noter le salon et le professionnel après une prestation terminée.

### B. Back-office des établissements

Destiné aux propriétaires et collaborateurs autorisés :

- Configurer un ou plusieurs salons.
- Administrer les prestations et les prix.
- Gérer les professionnels, horaires et indisponibilités.
- Consulter et traiter les rendez-vous.
- Suivre les paiements.
- Configurer les rôles et permissions.
- Consulter les avis reçus, y répondre et signaler un avis abusif.

### C. Administration GoMeCoiffer

Réservée à l'exploitant de la plateforme :

- Superviser les établissements.
- Gérer les abonnements.
- Activer ou suspendre des salons.
- Superviser les paiements et incidents.
- Administrer la visibilité des salons dans la marketplace.
- Modérer les avis signalés (masquer ou rétablir).

**Règle d'architecture :** les rôles système ne sont pas des rôles salon. Les autorisations sont évaluées dans leur propre périmètre.

---

## 3. Modèle des comptes et multi-salons

### Hiérarchie

- **Utilisateur :** une identité de connexion unique.
- **Organisation :** entité propriétaire ou exploitante.
- **Salon :** établissement physique rattaché à une organisation.
- **Collaborateur :** utilisateur ayant une appartenance et des permissions dans un salon.

Une organisation peut posséder plusieurs salons.

Un utilisateur peut appartenir à plusieurs salons, éventuellement avec des rôles différents.

**Exemple :**

Un propriétaire crée son compte puis rattache trois établissements : Go Beauty Bastos, Go Beauty Akwa et Go Beauty Biyem-Assi.

Depuis son compte, il peut sélectionner chaque salon, consulter son planning et gérer ses équipes.

Il n'est pas nécessaire de créer trois comptes utilisateurs.

Chaque salon conserve cependant ses propres services, tarifs, collaborateurs, horaires, réservations et paramètres.

### Règles de multi-tenancy

- Aucun collaborateur ne peut accéder à un salon sans appartenance autorisée.
- Les permissions sont évaluées par salon.
- Un propriétaire peut administrer tous les salons de son organisation.
- Le changement de salon change le contexte d'autorisation.
- Chaque établissement possède son abonnement dans le modèle commercial MVP.
- Les données financières restent isolées par établissement.

---

## 4. Rôles système

Les rôles système sont attribués exclusivement par GoMeCoiffer.

| Rôle                             | Responsabilités                                                                       |
| --------------------------------- | -------------------------------------------------------------------------------------- |
| Super Administrateur              | Paramètres globaux, supervision, gestion des administrateurs et suspension des salons |
| Administrateur Opérations        | Vérification des établissements, assistance et supervision des réservations         |
| Administrateur Finance Plateforme | Abonnements, facturation SaaS, commissions éventuelles et rapprochements financiers   |

Pour un démarrage très léger, une même personne autorisée peut remplir plusieurs responsabilités internes sans créer des interfaces complexes.

Les utilisateurs de salons ne peuvent jamais s'attribuer ces rôles.

Le client de la marketplace est un utilisateur public, sans permission d'administration système.

---

## 5. Rôles des salons

Les rôles salon sont configurables par établissement.

### 5.1 Propriétaire

Rôle lié à la propriété de l'organisation.

Permissions :

- Créer et gérer ses salons.
- Administrer les collaborateurs.
- Gérer les rôles et permissions.
- Gérer les prestations et horaires.
- Accéder aux réservations et finances.
- Gérer les abonnements.
- Configurer les paramètres commerciaux.

Les droits essentiels de propriété ne sont pas désactivables par un rôle personnalisé.

### 5.2 Administrateur de salon

Supervise le fonctionnement quotidien.

Permissions initiales :

- Gérer les réservations.
- Organiser le planning.
- Ajouter et modifier des prestations.
- Gérer les collaborateurs et leurs horaires.
- Traiter les reprogrammations.
- Déclarer des absences et indisponibilités.

Les paramètres de propriété, de facturation SaaS et de destination des fonds restent protégés.

### 5.3 Coiffeur / Coiffeuse / Barbier

Professionnel réalisant les prestations capillaires.

Permissions initiales :

- Voir son planning.
- Voir les informations nécessaires à ses rendez-vous.
- Mettre à jour sa disponibilité.
- Démarrer et terminer une prestation.
- Signaler un client absent.
- Proposer un nouveau créneau pour ses rendez-vous.

Par défaut, ce rôle n'accède pas aux finances globales.

### 5.4 Responsable financier

Responsable de l'encaissement et du contrôle des paiements.

Permissions initiales :

- Consulter les réservations et montants associés.
- Consulter les paiements en ligne.
- Déclarer un paiement reçu au salon.
- Consulter les totaux encaissés.
- Exporter une liste simple de transactions.

Ce rôle ne peut pas modifier les comptes de règlement, les prix ou les permissions sensibles sans autorisation supplémentaire.

### 5.5 Praticien / Praticienne de beauté

Rôle générique pour tous les professionnels réalisant une prestation autre que la coiffure classique.

Spécialités possibles :

- Esthéticien / Esthéticienne
- Masseur / Masseuse
- Manucure / Prothésiste ongulaire
- Spécialiste pédicure
- Technicien / Technicienne de soins capillaires
- Technicien / Technicienne de shampoing
- Spécialiste soins du visage
- Maquilleur / Maquilleuse

Ces spécialités sont des **métiers**, et non des rôles de sécurité différents.

Une même personne peut posséder plusieurs spécialités et être habilitée pour plusieurs prestations.

Le système utilise donc un modèle commun d'**intervenant**, avec des spécialités, des compétences autorisées et un ensemble de permissions.

Cela évite de créer un rôle technique distinct pour chaque métier.

---

## 6. Gestion configurable des permissions

Le propriétaire peut personnaliser les droits des rôles de son établissement.

### Modules contrôlables

| Module                | Actions possibles                                |
| --------------------- | ------------------------------------------------ |
| Tableau de bord       | Consulter                                        |
| Réservations         | Voir les siennes, voir toutes, gérer            |
| Disponibilités       | Modifier les siennes, gérer celles de l'équipe |
| Prestations           | Consulter, gérer                                |
| Personnel             | Consulter, inviter, gérer                       |
| Finances              | Consulter, déclarer un encaissement, exporter   |
| Paramètres salon     | Consulter, modifier                              |
| Avis clients          | Consulter, répondre, signaler                    |
| Rôles et permissions | Administrer                                      |

### Fonctionnement attendu

- Chaque rôle possède des permissions par défaut.
- Le propriétaire peut les modifier depuis **Paramètres → Rôles et permissions**.
- Il peut autoriser ou désactiver l'accès à un module.
- Certaines actions sensibles restent protégées.
- Les changements s'appliquent immédiatement après validation.
- Une personne peut avoir des permissions différentes dans deux salons.

**Restriction :** aucun administrateur salon ne peut modifier les rôles globaux GoMeCoiffer ni s'attribuer les droits réservés au propriétaire.

Pour le MVP, des profils prédéfinis avec permissions ajustables suffisent. Un constructeur complexe de rôles personnalisés n'est pas nécessaire.

---

## 7. Onboarding d'un établissement

L'onboarding doit guider un propriétaire non technique.

### Étape 1 — Création du compte

Informations :

- Nom du responsable
- Téléphone
- Email, si disponible
- Moyen de connexion sécurisé

L'utilisateur crée ensuite son organisation.

### Étape 2 — Création du premier salon

Informations :

- Nom commercial
- Type : salon de coiffure, barber shop, esthétique ou mixte
- Ville et quartier
- Adresse descriptive / point de repère
- Téléphone commercial
- Photo principale et courte description
- Horaires d'ouverture

### Étape 3 — Configuration des prestations

Le propriétaire ajoute :

- Nom de la prestation
- Catégorie
- Prix
- Durée estimée
- Statut actif/inactif

Exemple :

Coupe homme — 2 000 FCFA — 30 minutes.\

### Étape 4 — Présentation des rôles

Un écran explique simplement :

- **Administrateur :** organise le salon.
- **Coiffeur ou barbier :** effectue les prestations capillaires.
- **Praticien de beauté :** réalise les soins qui lui sont attribués.
- **Responsable financier :** suit les encaissements.
- **Propriétaire :** conserve le contrôle général.

Le propriétaire peut ensuite inviter ses collaborateurs.

### Étape 5 — Attribution des prestations et horaires

Pour chaque professionnel :

- Nom et coordonnées professionnelles.
- Rôle.
- Spécialités.
- Prestations qu'il est autorisé à réaliser.
- Jours et heures de travail.
- Pauses.
- Indisponibilités ponctuelles.

### Étape 6 — Vérification des permissions

Présentation des autorisations par défaut.

Le propriétaire peut les conserver ou les personnaliser.

### Étape 7 — Réservations et paiement

Le propriétaire choisit les options disponibles :

- Réservation avec paiement sur place.
- Réservation avec paiement Mobile Money, après activation du compte marchand compatible.

L'établissement peut être publié dès qu'au moins une prestation, un professionnel éligible et des horaires valides sont configurés.

L'activation du paiement en ligne peut intervenir ensuite.

L'onboarding doit être sauvegardé progressivement pour permettre une reprise.

---

## 8. Fiches techniques des fonctionnalités MVP

### F01 — Marketplace des salons

**Priorité : P0**

**Objectif :** permettre au client de découvrir rapidement un établissement.

Fonctionnalités :

- Recherche par ville et quartier.
- Recherche par nom de salon ou type de prestation.
- Liste des salons publiés.
- Page de présentation du salon.
- Catalogue des prestations et tarifs.
- Liste des professionnels.
- Affichage des prochains créneaux disponibles.
- Note moyenne et nombre d'avis du salon (carte et fiche) et de ses professionnels (fiche), derniers avis sur la fiche, tri « Mieux notés » dans la recherche (F09).

Critères d'acceptation :

- Un salon non publié n'apparaît pas.
- Un client peut consulter les prestations sans créer de compte.
- Un salon sans disponibilité est présenté comme tel.
- Les informations visibles proviennent du salon concerné.

Hors MVP : chat, recommandations IA et carte de fidélité. Les avis et notes font partie du MVP (F09).

### F02 — Disponibilités en temps réel

**Priorité : P0 — Fonctionnalité centrale**

**Objectif :** afficher des créneaux correspondant à la capacité réelle du planning.

Chaque professionnel possède :

- Un calendrier de travail.
- Des horaires réguliers.
- Des pauses.
- Des absences ponctuelles.
- Des réservations.
- Une commande rapide de blocage temporaire.

Le statut visible dépend de la prestation sélectionnée.

États affichables :

- **Disponible maintenant :** un démarrage immédiat ou quasi immédiat est possible pour la durée demandée.
- **Prochain créneau :** aucun démarrage immédiat, mais un horaire futur est disponible.
- **Indisponible :** aucun créneau valide dans la période consultée.

Règles :

1. Le calcul prend en compte la durée complète de la prestation.
2. Les créneaux hors horaires de travail sont exclus.
3. Les réservations existantes et les indisponibilités bloquent les créneaux concernés.
4. Le professionnel peut bloquer temporairement son agenda lorsqu'il reçoit un client sans réservation.
5. À la fin d'une prestation, l'agenda est recalculé.
6. Toute réservation doit être revalidée côté serveur au moment de sa confirmation.

L'affichage est synchronisé en temps réel, mais ne prétend pas détecter physiquement la présence du professionnel.

**Important :** aucune notification promotionnelle n'est envoyée lorsqu'un professionnel redevient libre.

### F03 — Réservation client

**Priorité : P0**

Parcours :

1. Choisir un salon.
2. Choisir une prestation.
3. Choisir un professionnel ou « Peu importe ».
4. Consulter les créneaux libres.
5. Sélectionner une date et un horaire.
6. Fournir un numéro de téléphone.
7. Confirmer les informations.
8. Choisir le mode de paiement.
9. Recevoir la confirmation.

Le choix « Peu importe » attribue un professionnel qualifié, disponible sur le créneau choisi.

Le client peut réserver sans installation d'une application mobile.

Une vérification du numéro ou un lien sécurisé permet de retrouver et modifier la réservation.

Une réservation correspond à une prestation assurée par un professionnel principal. Les prestations nécessitant plusieurs intervenants simultanés sont exclues du MVP.

### F04 — Paiement en ligne ou sur place

**Priorité : P0**

Deux possibilités :

**Option A — Payer en ligne**

- Le client sélectionne Orange Money ou MTN MoMo.
- Le système crée une réservation temporaire.
- Une transaction est initiée auprès du prestataire de paiement.
- Le créneau est bloqué pendant une courte période.
- La réservation est confirmée après validation du paiement par le serveur.

**Option B — Payer au salon**

- Le client choisit « Payer sur place ».
- La réservation est confirmée sans paiement immédiat.
- Le montant à payer reste affiché.
- Le responsable autorisé marque le paiement reçu après encaissement.

Le choix des moyens de paiement proposés dépend de l'activation du salon.

Les frais éventuels sont présentés selon les conditions du prestataire et de l'établissement.

La plateforme conserve un historique des transactions, sans stocker les codes secrets Mobile Money.

### F05 — Planning et gestion des rendez-vous

**Priorité : P0**

Fonctions :

- Planning journalier du salon.
- Vue « Mes rendez-vous » pour le professionnel.
- Liste des rendez-vous à venir.
- Détail d'une réservation.
- Ajout d'un rendez-vous effectué directement au salon.
- Blocage temporaire d'un professionnel.
- Démarrage et clôture d'une prestation.
- Annulation simple.
- Signalement d'une absence client.
- Reprogrammation.

Le salon doit pouvoir enregistrer rapidement un client présent physiquement sans passer par toute la marketplace.

Cette fonctionnalité est indispensable pour que la disponibilité affichée reste cohérente.

### F06 — Reprogrammation simplifiée

**Priorité : P0**

Objectif : trouver un nouvel horaire sans système de messagerie interne.

**Scénario 1 — Client en retard ou absent**

1. Le professionnel ouvre le rendez-vous.
2. Il clique sur « Client absent ».
3. Il clique sur « Proposer un nouvel horaire ».
4. Il choisit un nouveau créneau disponible.
5. GoMeCoiffer génère un lien avec la proposition.
6. Le professionnel peut partager ce lien sur WhatsApp avec un message prérempli.
7. Le client accepte ou refuse depuis une page simple.

**Scénario 2 — Changement demandé par le client**

Le client ouvre son rendez-vous, sélectionne « Reprogrammer », puis propose un horaire libre.

Selon la configuration minimale retenue, le salon valide la proposition.

**Règles :**

- Une seule proposition active par réservation.
- Une proposition possède une durée de validité.
- Le nouveau créneau est sécurisé temporairement pendant la phase d'acceptation.
- Une proposition expirée ne modifie pas le rendez-vous initial.
- Un nouveau créneau n'est confirmé que s'il est encore réellement disponible.
- Le système conserve l'historique du changement.
- Aucun échange de messages libre n'est nécessaire.

Une réservation déjà payée conserve sa référence de paiement lorsque la même prestation est simplement déplacée, sous réserve de la politique du salon.

Pour une absence constatée, le salon décide si le paiement peut être reporté au nouveau rendez-vous.

### F07 — Gestion du salon et du personnel

**Priorité : P0**

Fonctions :

- Modifier les informations du salon.
- Ajouter et désactiver des collaborateurs.
- Affecter leurs rôles.
- Gérer leurs horaires.
- Associer les prestations à chaque professionnel.
- Activer ou désactiver les prestations.
- Ajuster les permissions.
- Consulter un tableau de bord simple.

Le tableau de bord affiche uniquement :

- Réservations du jour.
- Rendez-vous en cours.
- Professionnels disponibles.
- Prochains rendez-vous.
- Paiements enregistrés aujourd'hui.

Les analyses financières avancées sont hors MVP.

### F08 — Administration et abonnements SaaS

**Priorité : P0**

Fonctions :

- Lister les organisations et salons.
- Voir le statut de chaque abonnement.
- Activer, suspendre ou rétablir un établissement.
- Enregistrer les paiements d'abonnement.
- Gérer les périodes mensuelles et annuelles.
- Superviser les incidents de paiement.
- Consulter quelques indicateurs opérationnels.

En cas d'abonnement expiré, le comportement doit être explicitement défini : suspension des nouvelles réservations publiques après une période de grâce, sans effacement des données ni disparition des réservations déjà confirmées.

### F09 — Avis et notes

**Priorité : P1 — inclus dans le MVP, après le cycle central** (dépend de F03 et de F05 : une réservation doit pouvoir passer à « Prestation terminée »)

**Objectif :** aider le client à choisir un salon et un professionnel grâce aux avis de clients réellement servis, et donner au salon un retour sur la qualité de ses prestations.

Fonctionnalités :

- Après une réservation passée à « Prestation terminée », le client peut laisser un avis : une note de 1 à 5 pour le salon, une note de 1 à 5 pour le professionnel qui a réalisé la prestation, et un commentaire facultatif.
- Un seul avis par réservation, déposé dans les 14 jours qui suivent la fin de la prestation.
- Le salon peut publier une réponse publique, une seule par avis.
- Le salon peut signaler un avis abusif (insultes, données personnelles, contenu sans rapport avec la prestation). Seule l'administration GoMeCoiffer peut masquer un avis signalé ou le rétablir.
- La marketplace affiche la note moyenne et le nombre d'avis du salon (carte de résultat et fiche) et de chaque professionnel (fiche du salon), ainsi que les derniers avis publiés, et propose un tri « Mieux notés » dans la recherche.
- Une note moyenne n'est affichée qu'à partir de 3 avis publiés ; en dessous, le nombre d'avis seul est montré.
- Le back-office montre au salon ses avis, ses notes moyennes et celles de chaque professionnel.

Règles :

- Le salon ne peut ni modifier ni supprimer un avis, ni choisir les avis affichés.
- Un avis reste rattaché au salon et au professionnel de la réservation notée, même si le professionnel quitte ensuite le salon.
- Un avis masqué ne compte plus dans les moyennes. Le masquage et le rétablissement sont tracés (auteur, date, motif).
- L'avis public ne montre aucune donnée personnelle du client au-delà de son prénom et de l'initiale de son nom ; jamais son numéro.
- Les avis ne sont accessibles qu'à travers des réservations terminées : aucun avis sans rendez-vous réel.

Critères d'acceptation :

- Un client sans prestation terminée dans le salon ne peut pas laisser d'avis.
- Un même rendez-vous ne donne lieu qu'à un seul avis, et plus aucun après 14 jours.
- Un salon ne peut pas faire disparaître un avis négatif.
- Les moyennes affichées n'incluent que les avis publiés, et n'apparaissent qu'à partir de 3 avis.
- Le tri « Mieux notés » ne place pas devant un salon qui n'a pas encore 3 avis publiés.

À préciser dans les use cases : modification de son avis par le client, délai de réponse du salon, permissions par défaut du module « Avis clients », absence de réservation client sans compte (lien sécurisé).

---

## 9. Règles métier de réservation

### Cycle de vie

Statuts de réservation :

- `PENDING_PAYMENT`
- `CONFIRMED`
- `IN_PROGRESS`
- `COMPLETED`
- `NO_SHOW`
- `CANCELLED`
- `EXPIRED`

Le statut financier est géré séparément de celui du rendez-vous.

### Règles obligatoires

**BR-01 — Éligibilité**

Un professionnel peut être réservé uniquement s'il est actif, habilité pour la prestation et disponible sur toute sa durée.

**BR-02 — Absence de conflit**

Deux réservations bloquantes ne peuvent pas se chevaucher sur un même professionnel.

**BR-03 — Réservation sur place**

Une réservation avec paiement sur place bloque immédiatement le créneau après confirmation.

**BR-04 — Paiement en ligne**

Le créneau est temporairement réservé pendant le paiement, avec une expiration initialement fixée à 10 minutes.

**BR-05 — Paiement échoué**

Un paiement refusé ou non confirmé à l'expiration libère le créneau après réconciliation du statut.

**BR-06 — Paiement tardif**

Si un paiement arrive après expiration et que le créneau n'est plus disponible, le système n'invente pas une réservation confirmée. L'incident est signalé pour résolution ou remboursement.

**BR-07 — Occupation manuelle**

Un professionnel peut signaler une indisponibilité temporaire. Cela bloque les nouvelles réservations concernées, sans supprimer silencieusement les réservations existantes.

**BR-08 — Retard**

Le salon peut marquer manuellement un client absent après un délai de tolérance défini.

**BR-09 — Changement d'horaire**

Toute reprogrammation doit vérifier la disponibilité du nouveau créneau et enregistrer qui a initié le changement.

**BR-10 — Annulation et remboursement**

L'annulation d'un rendez-vous payé n'entraîne pas automatiquement un remboursement. Le remboursement suit les conditions affichées par le salon et les capacités réelles de l'opérateur de paiement.

**BR-11 — Confidentialité**

Un collaborateur ne consulte que les informations nécessaires à ses permissions et à l'exécution des prestations.

**BR-12 — Multi-salons**

Une réservation, un professionnel, un service et un encaissement sont toujours rattachés à un établissement explicite.

---

## 10. Modèle économique

### Source principale : abonnement SaaS

Le produit propose un forfait fonctionnel unique, facturé par salon.

Deux périodicités :

- Mensuelle.
- Annuelle, avec réduction.

Hypothèse de prix à tester : **5 000 FCFA/mois ou 50 000 FCFA/an par salon**.

Ces montants sont des hypothèses commerciales, pas des prix validés par une étude de marché.

Un essai limité peut faciliter l'onboarding des premiers salons.

### Source secondaire : commission de réservation en ligne

Une commission sur les transactions en ligne constitue une option de croissance.

Recommandation :

- Ne pas prélever de commission transactionnelle pendant la validation initiale du MVP.
- Mesurer le volume réel des réservations payées en ligne.
- Étudier ensuite une commission faible, par exemple 1 %, sous réserve de la marge nette et de l'accord commercial avec les établissements.
- Ne pas facturer de commission sur les paiements effectués directement au salon.

L'activation d'une commission automatique nécessite un prestataire de paiement disposant d'une solution de partage des paiements adaptée et effectivement contractualisée.

Les frais du prestataire de paiement doivent être distincts de la commission GoMeCoiffer.

### Source future : sponsoring des salons

Après validation de l'utilisation réelle de la marketplace :

- Mise en avant payante dans une ville ou un quartier.
- Durée fixe de campagne.
- Emplacements limités.
- Étiquette explicite « Sponsorisé ».
- Historique de facturation du sponsoring.

Le sponsoring ne remplace pas la pertinence géographique ou la disponibilité.

**Hors MVP initial.**

---

## 11. Modèle de données minimal

Entités principales :

| Entité                    | Responsabilité                               |
| -------------------------- | --------------------------------------------- |
| User                       | Identité et authentification                 |
| Organization               | Propriétaire de plusieurs salons             |
| Salon                      | Établissement physique                       |
| SalonMembership            | Appartenance d'un utilisateur à un salon     |
| SystemRole                 | Autorisations globales de plateforme          |
| SalonRole / RolePermission | Rôles et permissions locaux                  |
| StaffProfile               | Profil professionnel                          |
| Service                    | Prestation, prix et durée                    |
| StaffService               | Prestations autorisées pour un professionnel |
| WorkingSchedule            | Horaires et pauses                            |
| Unavailability             | Absence ou blocage temporaire                 |
| Booking                    | Réservation et statut                        |
| RescheduleProposal         | Proposition de nouvel horaire                 |
| Payment                    | Transaction et état de paiement              |
| Subscription               | Abonnement de l'établissement                |
| Review                     | Avis d'une réservation terminée : notes du salon et du professionnel, commentaire, réponse du salon, signalement et état de modération |

Les modifications sensibles de permissions, de réservations et de paiements, ainsi que le masquage ou le rétablissement d'un avis, doivent conserver une trace d'audit.

---

## 12. Exigences techniques

### Architecture recommandée

- Frontend web : React, Vite et TypeScript.
- Interface responsive mobile-first.
- API : NestJS.
- Base de données : PostgreSQL.
- Architecture backend : monolithe modulaire, séparation domaine/application/infrastructure selon la complexité de chaque module.
- Synchronisation des disponibilités : événements serveur via SSE ou solution équivalente, avec rechargement fiable après reconnexion.
- Paiements : adaptateur isolé vers l'agrégateur.
- Conteneurisation : Docker dès le démarrage.
- Tests : tests unitaires métier, tests d'intégration et tests des flux critiques.

Aucun microservice, broker Kafka ou RabbitMQ n'est nécessaire pour le MVP.

### Contraintes non fonctionnelles

**Disponibilité :** l'interface doit être mise à jour rapidement après une modification du planning. Objectif indicatif : moins de 5 secondes pour les utilisateurs connectés.

**Concurrence :** empêcher les doubles réservations avec des contrôles transactionnels côté serveur et des contraintes de non-chevauchement au niveau de la base.

**Paiement :** utiliser les confirmations vérifiables du prestataire, des références de transaction uniques et des traitements idempotents.

**Sécurité :** contrôle d'accès côté backend, séparation stricte des établissements et protection des opérations financières.

**Fiabilité :** les événements manqués lors d'une déconnexion ne doivent pas entraîner un planning durablement incorrect.

**Dates :** conserver les instants en UTC et afficher les heures dans le fuseau local de l'établissement.

**Données :** collecte minimale des informations clients, conservation encadrée et droits d'accès limités conformément au cadre réglementaire applicable au Cameroun.

---

## 13. Interfaces indispensables

### Marketplace

1. Accueil / Recherche.
2. Résultats des salons (avec note moyenne et tri « Mieux notés »).
3. Fiche d'un salon (avec notes et derniers avis).
4. Choix prestation, professionnel et créneau.
5. Confirmation et paiement.
6. Mes réservations / Reprogrammation / Laisser un avis.

### Back-office salon

1. Tableau de bord.
2. Réservations et planning.
3. Personnel et disponibilités.
4. Prestations.
5. Paiements simples.
6. Paramètres, permissions et abonnement.
7. Avis clients (consulter, répondre, signaler).

### Administration plateforme

1. Vue générale.
2. Gestion des salons et organisations.
3. Abonnements et transactions.
4. Gestion des administrateurs.
5. Avis signalés (modération).

Une seule interface de gestion peut regrouper plusieurs écrans grâce à des onglets, tiroirs et formulaires. Il n'est pas nécessaire de multiplier les pages pour chaque action.

---

## 14. Hors périmètre du MVP

Fonctionnalités explicitement reportées :

- Notifications lorsqu'un coiffeur devient libre.
- Campagnes marketing automatisées.
- Programme de fidélité.
- Abonnements clients.
- Chat interne.
- Sponsoring payant opérationnel.
- Commission automatique sans prestataire compatible.
- Gestion de stock.
- Paie et commissions salariales des professionnels.
- Comptabilité complète.
- Gestion avancée des franchises.
- Prestations multi-intervenants.
- Intelligence artificielle.
- Gestion complexe des cabines, équipements et ressources partagées.

Ces fonctionnalités pourront être ajoutées selon les besoins réellement observés.

---

## 15. Indicateurs de réussite

Les premiers indicateurs doivent mesurer la résolution du problème central.

| Indicateur                        | Ce qu'il mesure                                           |
| --------------------------------- | --------------------------------------------------------- |
| Salons activés                   | Établissements ayant publié des prestations et horaires |
| Réservations confirmées         | Utilisation réelle du produit                            |
| Réservations abouties            | Rendez-vous effectivement réalisés                      |
| Taux de conflits de planning      | Fiabilité de la réservation                             |
| Taux de paiement en ligne         | Adoption du paiement intégré                            |
| Taux d'absences clients           | Qualité opérationnelle                                  |
| Taux de reprogrammation réussie  | Efficacité du parcours simplifié                        |
| Conversion visite → réservation | Utilité de la marketplace                                |
| Taux d'avis et note moyenne       | Satisfaction des clients et confiance dans la marketplace |
| Salons actifs chaque semaine      | Adoption du back-office                                   |
| Renouvellement d'abonnement       | Valeur commerciale du SaaS                                |

### Validation du MVP

Prévoir un pilote avec environ 10 à 20 salons de catégories différentes et observer les usages pendant plusieurs semaines.

Le MVP sera considéré comme prometteur lorsque :

- Les salons utilisent réellement le planning.
- Les clients réussissent à réserver sans assistance.
- Les doubles réservations sont éliminées dans les scénarios pris en charge.
- Le personnel maintient les disponibilités à jour.
- Les établissements expriment une volonté de payer pour conserver le service.

---

## 16. Décisions retenues et validations restantes

### Décisions recommandées

- Une plateforme unique, deux interfaces métier et une administration système.
- Un utilisateur peut gérer plusieurs salons.
- Séparation des rôles plateforme et salon.
- Permissions salon personnalisables.
- Professionnels classés par spécialités et compétences.
- Disponibilités synchronisées en temps réel.
- Réservation avec paiement en ligne ou sur place.
- Reprogrammation par proposition et acceptation.
- Aucun message promotionnel de disponibilité.
- Abonnement SaaS comme revenu principal.
- Sponsoring et commission automatique reportés.

### Validations à effectuer avant la mise en production

- Prix réel des abonnements après entretiens avec les salons.
- Agrégateur sélectionné et conditions de règlement des fonds.
- Contrat permettant l'encaissement pour chaque salon.
- Politique d'annulation, de report et de remboursement.
- Mode d'authentification client le moins contraignant et suffisamment sécurisé.
- Politique de conservation et protection des données.
- Procédure de gestion des litiges de paiement.

**Livrable attendu :** un MVP capable de gérer intégralement le cycle *Disponibilité → Réservation → Paiement → Prestation terminée*, sans reproduire toutes les fonctions d'un ERP de salon.
