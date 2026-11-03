# goMeCoiffer — Dossier de conception du projet

Version 1.0 — 4 novembre 2026 — Langue : français — Porteur : Patojoel.

Ce dossier définit le produit à construire, son fonctionnement et les conditions de sa livraison. Il constitue une base de consultation d’une équipe de développement et de préparation du pilote. Il ne représente ni une application développée ni une intégration de paiement déjà testée.

## Documents

1. [Cahier des charges](01-cahier-des-charges.md) : objectifs, périmètre, exigences et critères de réception.
2. [Règles métier](02-regles-metier.md) : réservation, horaires, annulations, fidélité et abonnements.
3. [Paiements et modèle économique](03-paiements-et-modele-economique.md) : frais, remboursements, reversements et rentabilité.
4. [Parcours et écrans](04-parcours-et-ecrans.md) : interfaces client, salon et administration.
5. [Architecture technique](05-architecture-technique.md) : choix recommandés, concurrence et intégrations.
6. [Données et API](06-donnees-et-api.md) : entités, droits, contrat des opérations et événements.
7. [Plan de réalisation](07-plan-de-realisation.md) : phases, livrables et organisation.
8. [Recette et qualité](08-recette-et-qualite.md) : tests fonctionnels, financiers et techniques.
9. [Exploitation, sécurité et cadre contractuel](09-exploitation-securite-contrats.md).
10. [Lancement et acquisition](10-lancement-et-acquisition.md).
11. [Décisions et paramètres](11-decisions-et-parametres.md) : règles actées, hypothèses et points à finaliser.
12. `backlog.csv` : fonctionnalités, priorités, dépendances et critères d’acceptation importables dans un tableur.
13. `simulation-financiere.csv` : scénarios illustratifs de frais et rentabilité.
14. `matrice-recette.csv` : cas de recette à exécuter ; aucun résultat d’application n’est présenté comme déjà obtenu.
15. `goMeCoiffer-tableaux.xlsx` : les quatre tableaux réunis dans un classeur Excel avec filtres et en-têtes figés. Les simulations sont des valeurs illustratives ; les formules de référence figurent dans le document financier et le script de génération.

Le document Word et le PDF réunissent les onze documents de référence. L’archive contient également les tableaux CSV et les sources Markdown modifiables.

Les schémas sont fournis en PNG et au format source Graphviz. Le script `generer_livrables.py` permet de régénérer les exports avec Python, python-docx, reportlab, openpyxl, Graphviz et les polices DejaVu.

## Comment utiliser le dossier

- Lire d’abord le cahier des charges, les règles métier et le modèle économique.
- Utiliser les identifiants EX, RM, PAY et REC pour relier les fonctionnalités, les règles et les tests.
- Les exigences P0 constituent le lancement pilote ; P1 complète la version commerciale ; P2 est une évolution ultérieure.
- Les mentions « validé » proviennent de la conversation. Les mentions « proposé » et les chiffres d’hypothèse restent modifiables ; ils ne constituent pas des accords commerciaux.
- Actualiser le registre de décisions à chaque arbitrage. Versionner les politiques applicables aux réservations pour préserver les conditions acceptées par les clients.

## Principes centraux

Une marketplace locale et un back-office salon partagent le même agenda. Les salons sont gratuits pendant une période de lancement puis paient un abonnement mensuel. Le client supporte les frais du paiement en ligne : 5 % pour la plateforme et, dans l’exemple actuel, 3 % pour l’agrégateur. Seules les visites réservées, payées sur la plateforme et réalisées peuvent générer des récompenses, propres au salon concerné.

L’agrégateur est déclaré capable de différer les reversements par le porteur du projet. Son identité, ses API, la base des frais et les modalités contractuelles doivent encore être documentées. Le pays, la ville pilote et la devise ISO (XAF ou XOF) restent à choisir : « FCFA » seul ne suffit pas à configurer le paiement.
