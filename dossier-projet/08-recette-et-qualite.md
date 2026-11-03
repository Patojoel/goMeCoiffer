# 08 — Plan de recette et critères de qualité

## 1. Statut

Ce document est un plan de tests. L’application n’est pas encore implémentée : les cas REC ne sont pas exécutés. Les vérifications effectuées sur ce dossier concernent seulement la présence des fichiers, leurs références, les calculs illustratifs et les exports documentaires.

## 2. Jeux de données

Deux salons indépendants, chacun avec deux collaborateurs, services de 30 et 60 minutes, horaires distincts, pauses et congés. Au moins trois clients, un administrateur, un agent support et un utilisateur non autorisé. Exemples monétaires 1 000, 2 500 et 5 000 FCFA ; montants provoquant des arrondis ; avantage de 500 FCFA ; dates proches des seuils d’annulation et de minuit.

Utiliser uniquement des identités et moyens de paiement de test. Prévoir retours agrégateur simulés pour les erreurs, puis vérifier les scénarios essentiels dans sa sandbox réelle. Les mocks ne prouvent pas le fonctionnement du fournisseur.

## 3. Tests fonctionnels critiques

| ID | Scénario | Résultat attendu |
|---|---|---|
| REC-01 | Recherche sans GPS | Résultats par ville/quartier, sans permission imposée |
| REC-02 | Deux clients prennent le même créneau | Un seul confirme ; l’autre reçoit un conflit récupérable |
| REC-03 | Réservation téléphone sur créneau occupé | Refus côté serveur, même depuis le back-office |
| REC-04 | Congé, pause ou durée dépassant la fermeture | Aucun créneau invalide proposé ou confirmé |
| REC-05 | Paiement normal et retour navigateur fermé | Confirmation par webhook, reçu et rendez-vous consultables |
| REC-06 | Webhook répété dix fois | Un paiement, une confirmation et un seul effet de fidélité |
| REC-07 | Paiement tardif, créneau déjà pris | Aucun chevauchement ; remboursement intégral suivi |
| REC-08 | Montant/devise de webhook incorrect | Aucune confirmation ; alerte et vérification contrôlée |
| REC-09 | Annulation exactement 12 heures avant | Application de la politique anticipée proposée |
| REC-10 | Annulation tardive / absence | Ventilation conforme à la politique acceptée ; recours possible |
| REC-11 | Salon annule | Remboursement intégral frais inclus ou report choisi |
| REC-12 | Client arrive trop tard | Client suivant inchangé ; proposition d’un créneau disponible |
| REC-13 | Report concurrent échoue | Ancien rendez-vous conservé ; aucun double débit |
| REC-14 | Réservation payée en espèces puis réalisée | Aucun crédit fidélité |
| REC-15 | Réservation payée en ligne mais non réalisée | Aucun crédit utilisable |
| REC-16 | Paiement en ligne et réalisation | Un crédit conforme au programme du salon |
| REC-17 | Même récompense utilisée simultanément | Une seule réservation peut la consommer |
| REC-18 | Annulation après application d’un avantage | Avantage restitué et remboursement correct |
| REC-19 | Remboursement après crédit de fidélité | Correction unique et historique conservé |
| REC-20 | Compte salon A tente d’accéder au salon B | Refus pour lecture, écriture et export |
| REC-21 | Collaborateur tente un reversement | Refus et trace de sécurité |
| REC-22 | Abonnement expiré | Nouvelles opérations restreintes ; obligations existantes accessibles |
| REC-23 | Reversement/webhook dupliqué | Aucun double versement, rapprochement exact |
| REC-24 | Remboursement échoue puis est relancé | État honnête, alerte et absence de double remboursement |
| REC-25 | Absence contestée avant reversement | Fonds concernés bloqués et support saisi |
| REC-26 | Perte d’une notification | Réservation maintenue ; tentative contrôlée et confirmation dans l’app |
| REC-27 | Changement de prix ou de politique | Réservations passées conservent leurs snapshots |
| REC-28 | Restauration sauvegarde | Données et journal cohérents, délais de reprise mesurés |
| REC-29 | Événement prestataire perdu ou désordonné | Rapprochement détecte/répare sans effets dupliqués |
| REC-30 | Tarif remisé et montant avec arrondi | Total exact selon convention ; salon/frais/remboursement cohérents |

## 4. Tests techniques

- Unitaires : calculs monétaires, transitions, échéances, admissibilité fidélité et permissions.
- Intégration PostgreSQL réelle : contraintes de chevauchement, transactions de report, écritures financières et isolation.
- Bout en bout navigateur : rechercher → réserver → payer sandbox → arriver → réaliser → recevoir un avantage → consulter le reçu.
- Charge proposée : 100 utilisateurs virtuels, 20 salons, 200 collaborateurs, 10 000 rendez-vous de test ; 50 tentatives simultanées sur un même créneau. Les objectifs de latence excluent le temps d’interaction humaine et sont rapportés avec l’infrastructure utilisée.
- Résilience : arrêt du worker, retry de webhook, indisponibilité Redis, perte de réponse du prestataire après débit, restauration et rapprochement.
- Sécurité : accès direct à un objet d’un autre salon, sessions révoquées, brute force OTP, webhook falsifié/rejoué, upload malveillant, CSRF selon mode de session, injection et secrets dans les logs.
- Accessibilité : clavier, lecteur d’écran sur parcours principal, contrastes, erreurs formulaires et absence de dépendance exclusive à la couleur.

## 5. Sortie de recette

P0 : aucun défaut bloquant ni majeur non résolu affectant l’argent, la réservation, la sécurité ou la récupération. Rapports datés, version testée, environnement, résultats et preuves conservés. Les cas ignorés ou non exécutés sont affichés distinctement des réussites.

Après correction d’un échec, relancer le scénario affecté et les contrôles directement concernés. Une validation en staging ne constitue pas une validation en production ; réaliser ensuite un smoke test de production autorisé et maîtrisé avec le prestataire.
