# 07 — Backlog, organisation et plan de réalisation

## 1. Méthode et équipe

Recommandation : incréments démontrables de deux semaines, backlog priorisé et validation métier à chaque démonstration. Équipe indicative : un responsable produit disponible, un designer à temps partiel, deux développeurs polyvalents, un QA à temps partiel puis renforcé en recette, et un appui infrastructure/sécurité ponctuel. Les rôles peuvent être cumulés selon compétences et budget.

Une première estimation de 12 à 16 semaines avec cette équipe est un ordre de grandeur, pas un engagement. Elle suppose des accès prestataires disponibles, un périmètre P0 stable, des retours rapides et l’absence de difficulté majeure d’intégration. Les points du backlog sont relatifs et doivent être estimés par l’équipe ; ce dossier ne les transforme pas artificiellement en jours.

## 2. Phases et jalons

| Phase | Durée indicative | Livrable vérifiable | Condition de sortie |
|---|---|---|---|
| 0 — Cadrage | 1–2 semaines | Paramètres, parcours, contrat agrégateur, maquettes | Pays/devise, frais et politique pilote fixés |
| 1 — Fondations | 2 semaines | Authentification, rôles, salons, catalogue, infrastructure | Isolation et publication d’une fiche test |
| 2 — Agenda | 2–3 semaines | Disponibilités, réservations, téléphone/sur place, report | Tests de concurrence et horaires réussis |
| 3 — Finance | 2–3 semaines | Paiements, annulation, remboursement, reversement, journal | Parcours financier sandbox complet et rapproché |
| 4 — Fidélité et exploitation | 2 semaines | Récompenses, notifications, support et abonnement | Règles d’éligibilité et de suspension vérifiées |
| 5 — Recette pilote | 2–3 semaines | Charge, sécurité, restauration, formation, corrections | Zéro défaut bloquant et salons formés |
| 6 — Commercialisation | Après résultats pilote | Améliorations P1 et conversion payante | Valeur mesurée et volonté de payer confirmée |

Les plages se recouvrent partiellement selon l’équipe. Le chemin critique passe par les règles de paiement, la réservation concurrente, la recette agrégateur et la formation des salons.

## 3. Priorités

P0 : nécessaire à un pilote payant sûr et mesurable. P1 : amélioration après validation du pilote. P2 : extension. Le fichier `backlog.csv` détaille les exigences et leurs critères d’acceptation ; il sert de base d’import dans l’outil de suivi choisi.

## 4. Définition d’une tâche prête

Objectif utilisateur explicite, règles applicables identifiées, maquette si interface, dépendances accessibles, critères observables, états d’erreur décrits et données de test prévues. Une dépendance fournisseur non confirmée est signalée avant estimation ferme.

## 5. Définition d’une tâche terminée

Code revu, tests pertinents réussis, migrations compatibles, permissions vérifiées, interfaces accessibles, erreurs et logs utiles, documentation actualisée et démonstration sur staging. Pour la finance : preuve d’idempotence, ventilation exacte, remboursement et rapprochement. Une capture d’écran seule ne suffit pas.

## 6. Budget à construire

Séparer investissement initial et dépenses mensuelles. Investissement : conception, développement, intégrations, recette et formation. Mensuel : infrastructure, prestataires, support, commercial, maintenance et conformité locale.

Formule de devis : somme des jours estimés par rôle × tarif journalier + coûts directs des fournisseurs + réserve explicitement budgétée pour aléas. Demander au prestataire technique de préciser hypothèses, propriété du code, maintenance, garanties de correction, exclusion du périmètre et coût des évolutions.

Le prix d’abonnement ne sera fixé qu’après entretiens et test de conversion. Ne pas considérer les trois scénarios financiers comme des preuves de disposition à payer.

## 7. Gouvernance et changements

Le responsable produit arbitre le périmètre et les règles ; l’équipe technique choisit l’implémentation compatible ; le propriétaire commercial valide prix et contrats. Toute modification de frais, pénalité ou fidélité entraîne une nouvelle version de politique et des tests ciblés.

À chaque jalon : démonstration, anomalies ouvertes, budget consommé, risques, décision de poursuite et actions. Aucun report de fonctionnalité P0 ne doit être dissimulé dans une livraison annoncée complète.
