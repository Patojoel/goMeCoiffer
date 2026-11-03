# 01 — Cahier des charges fonctionnel et non fonctionnel

## 1. Vision et problème traité

goMeCoiffer permet de découvrir des salons à proximité, comparer leur offre et réserver un créneau fiable. Les salons disposent d’un outil central pour gérer leur activité, leurs collaborateurs, leurs clients, leurs rendez-vous et leur fidélisation.

Les problèmes visés sont le manque de visibilité des salons, les informations de prix dispersées, l’incertitude sur les disponibilités, les doubles réservations et la difficulté à fidéliser les clients. La réussite se mesure sur les prestations réellement effectuées et la rétention des salons, pas seulement sur les comptes créés.

## 2. Publics et rôles

| Acteur | Besoin principal | Périmètre autorisé |
|---|---|---|
| Visiteur | Trouver un salon et consulter les prix | Données publiques seulement |
| Client | Réserver, payer, suivre ses avantages | Ses données, rendez-vous, paiements et réclamations |
| Propriétaire du salon | Piloter l’activité et l’abonnement | Son salon, son équipe et ses rapports |
| Responsable/réception | Organiser les rendez-vous | Agenda et clients selon droits accordés |
| Collaborateur | Connaître et réaliser ses rendez-vous | Son planning et les informations utiles à la prestation |
| Support plateforme | Résoudre un problème | Accès limité, justifié et journalisé |
| Administrateur financier | Rapprocher paiements et reversements | Finance et litiges, sans accès inutile aux notes clients |
| Administrateur plateforme | Vérifier les salons et gérer le produit | Actions sensibles protégées et auditées |

## 3. Périmètre de livraison

### P0 — Pilote exploitable

Application web adaptative installable en PWA ; recherche locale ; fiches salons ; catalogue et photos ; agenda par collaborateur ; réservations avec et sans paiement ; paiement en ligne avec frais visibles ; suivi des présences ; annulations et remboursements ; fidélité simple ; back-office salon ; administration minimale ; notifications ; gestion de la gratuité ; mécanisme d’abonnement mensuel avant la première conversion payante ; sécurité, sauvegardes et suivi des incidents.

Le paiement fait partie du pilote : il est indispensable pour vérifier le modèle de frais et de récompenses. Les premiers salons peuvent être inscrits manuellement par l’équipe, mais les opérations financières doivent rester traçables.

### P1 — Version commerciale enrichie

Liste d’attente automatisée, rapports avancés, parrainage, relances marketing consenties, import/export clients, ressources physiques partagées, tableaux de bord multi-salons et meilleure automatisation des litiges.

### P2 — Évolutions

Applications natives, gestion détaillée des stocks, vente de produits, comptabilité avancée, paie, synchronisation avec agendas externes, prestations à domicile et expansion dans plusieurs pays. Ces éléments ne sont pas inclus dans le devis initial sans ajout explicite.

## 4. Exigences marketplace

| ID | Exigence | Critère de réception |
|---|---|---|
| EX-01 | Recherche par position consentie ou quartier saisi | La recherche fonctionne même sans permission GPS |
| EX-02 | Filtres homme/femme/mixte, prestation, prix, distance et disponibilité | Les résultats respectent tous les filtres sélectionnés |
| EX-03 | Liste et carte, classement explicable | Distance affichée comme estimation ; aucun temps de trajet inventé |
| EX-04 | Fiche salon complète | Photos, adresse, contact, horaires, services, durées, prix et conditions visibles |
| EX-05 | Photos des locaux et réalisations | Publication après contrôle ; droit de retrait et signalement disponibles |
| EX-06 | Avis vérifiés | Un avis par visite réalisée via la plateforme, avec ou sans paiement en ligne ; étiquette vérifiée |
| EX-07 | Réservation | Un même collaborateur ne reçoit jamais deux occupations incompatibles |
| EX-08 | Paiement et reçu | Prix, remise, frais et total présentés avant accord ; reçu disponible après confirmation |
| EX-09 | Espace client | Rendez-vous futurs/passés, annulations, remboursements et fidélité par salon |
| EX-10 | Gestion d’incident | Le client peut signaler une absence contestée ou une prestation non fournie |

Une prestation au prix variable doit être suffisamment décrite pour fixer son prix avant paiement. Le pilote n’encaisse pas une prestation « à partir de » sans devis final accepté. Toute option ajoutée ensuite fait l’objet d’un accord et, si nécessaire, d’une transaction complémentaire.

## 5. Exigences back-office salon

| ID | Fonction | Détail attendu |
|---|---|---|
| EX-11 | Configuration salon | Identité, localisation, horaires, fermetures, catégorie, photos et publication |
| EX-12 | Catalogue | Prestations, durée, prix, collaborateurs compétents, temps de préparation/nettoyage |
| EX-13 | Agenda | Vues jour/semaine, congés, pauses, ajout téléphone/sur place, déplacement avec contrôle des conflits |
| EX-14 | Présence et réalisation | Arrivée, début, fin, retard et absence ; preuves et historique des corrections |
| EX-15 | Équipe et droits | Invitations nominatives, rôles et révocation ; aucun compte collectif obligatoire |
| EX-16 | Clients | Historique utile, préférences consenties et remarques professionnelles limitées |
| EX-17 | Fidélité | Activation, seuil, avantage, validité et historique des droits acquis |
| EX-18 | Finances | Montants prestations, espèces déclarées, paiements en ligne, remboursements et reversements séparés |
| EX-19 | Abonnement | Gratuité, date de fin, tarif, factures, renouvellement, retard et résiliation |
| EX-20 | Pilotage | Rendez-vous réalisés, absence, récurrence, revenu enregistré et origine des réservations |

Le chiffre d’affaires enregistré est distingué du solde bancaire. Une vente en espèces saisie par le salon est déclarative et ne prouve pas un encaissement auprès du prestataire.

## 6. Exigences administration

EX-21 : contrôler les établissements et leur habilitation au paiement ; suspendre la vente sans effacer les obligations existantes.

EX-22 : consulter les commissions et rapprocher le relevé agrégateur avec les transactions internes ; traiter les écarts.

EX-23 : gérer les litiges, remboursements et anomalies de fidélité avec justification et journal d’audit.

EX-24 : administrer les paramètres versionnés, les offres d’abonnement, les notifications et la modération.

EX-25 : suivre les indicateurs, les incidents, les échecs de notifications et les tentatives d’accès interdites.

## 7. Exigences de qualité proposées

- Interface française, mobile d’abord, utilisable sur écran de 360 px et connexion limitée ; images compressées et chargement progressif.
- Objectif d’accessibilité WCAG 2.2 AA sur les parcours essentiels ; navigation clavier, contrastes et erreurs lisibles.
- Recherche API : p95 inférieur à 800 ms sur le jeu pilote ; opérations locales de réservation : p95 inférieur à 1 seconde hors agrégateur. Conditions de charge décrites dans la recette.
- Objectif initial de disponibilité mensuelle : 99,5 % ; mesure incluant les incidents affectant le parcours principal. Aucun engagement commercial avant mesure réelle.
- Horodatages techniques en UTC ; affichage selon le fuseau IANA de chaque salon ; fuseau explicitement stocké.
- Isolation stricte des salons, contrôles serveur des permissions, limitation des tentatives et authentification renforcée pour administration/finance.
- Sauvegardes chiffrées, restauration testée, objectifs proposés RPO 1 heure et RTO 4 heures, à budgéter avec l’hébergeur.
- Conservation minimale des données et absence de données de carte dans l’application.

## 8. Livrables attendus de l’équipe de réalisation

Code source et historique, maquettes validées, application client, back-office salon, administration, migrations, intégration agrégateur en bac à sable puis production, tests automatisés, rapports de recette, procédures d’exploitation, documentation API, configuration de déploiement, sauvegarde/restauration et formation des premiers salons.

La réception du pilote exige : tous les scénarios critiques REC exécutés avec succès ; zéro anomalie bloquante ; absence de double réservation ; rapprochement financier correct ; preuve d’un remboursement et d’un reversement en bac à sable ; isolation inter-salons ; restauration testée ; conditions et frais présentés avant paiement.

## 9. Limites et dépendances

Le pays, la ville, le fournisseur de paiement, le fournisseur de messages, la cartographie, les tarifs d’abonnement et les pénalités chiffrées ne sont pas encore fixés. Les principes métier sont validés ; les valeurs proposées dans ce dossier sont des hypothèses de lancement. Aucun budget ni calendrier ne doit être considéré comme un engagement ferme avant estimation de l’équipe retenue.
