# 11 — Registre des décisions et paramètres

## 1. Décisions actées dans la conversation

| ID | Décision | Conséquence |
|---|---|---|
| D-01 | Marketplace de salons homme, femme et mixte | Recherche locale et fiches riches |
| D-02 | Back-office pour gérer activité et agenda | Agenda partagé entre réservation web et saisie salon |
| D-03 | Réservation directe auprès d’un salon choisi | Créneaux et prestations propres au salon |
| D-04 | Gratuité initiale puis abonnement mensuel salon | Gestion essai, tarif, facturation et fin d’accès commercial |
| D-05 | Récompenses seulement après paiement sur la plateforme | Espèces exclues ; correction de la formulation initiale |
| D-06 | Programme configuré par chaque salon | Droits et récompenses isolés par salon |
| D-07 | Frais supplémentaires payés par le client | Présentation séparée avant confirmation |
| D-08 | Frais plateforme de 5 % | Remplace l’exemple antérieur à 2 % |
| D-09 | Exemple de frais agrégateur à 3 % | Base, arrondis et taxes à confirmer au contrat |
| D-10 | Respect des autres rendez-vous malgré un retard | Aucun privilège horaire lié au paiement |
| D-11 | Annulation, absence, report et recours selon règles annoncées | Politiques versionnées et acceptées |
| D-12 | Annulation salon : remboursement intégral ou report choisi | Frais inclus dans la protection client proposée et acceptée |
| D-13 | Agrégateur déclaré capable du reversement différé | Intégration à concevoir et vérifier en sandbox |

La validation générale des règles précédentes est conservée. Les nouvelles valeurs chiffrées introduites dans ce dossier restent des propositions lorsqu’elles n’avaient pas été précisées auparavant.

## 2. Paramètres proposés pour cadrer le développement

| Paramètre | Proposition | Statut et raison |
|---|---|---|
| Limite d’annulation anticipée | 12 heures | Exemple précédent retenu comme défaut modifiable |
| Tolérance d’arrivée | 10 minutes | Soumise à la possibilité de terminer sans décaler le suivant |
| Retard salon ouvrant annulation sans pénalité | 20 minutes | Nouvelle valeur proposée |
| Indemnité d’annulation tardive | 20 % du prix net | Nouvelle proposition à valider commercialement |
| Indemnité d’absence | 30 % du prix net | Nouvelle proposition, sans retenue automatique totale |
| Blocage paiement | 10 minutes | À adapter aux canaux du prestataire |
| Délai d’acceptation manuelle | 30 minutes | Proposition ; pas de créneau garanti avant acceptation |
| Reversement éligible | 24 heures après fin sans litige bloquant | Proposition, sans supprimer les recours ultérieurs |
| Crédit de fidélité | 1 par visite admissible, plafond 1/jour/salon | Proposition de compteur simple |
| Prolongation avantage après annulation salon | 30 jours | Proposition pour préserver le droit du client |
| Essai salon | 60 jours | Proposition, durée non fixée par le porteur |
| Grâce abonnement impayé | 7 jours | Proposition |
| Frais non restitués lors d’annulation | Charge plateforme | Hypothèse économique du dossier, à négocier |

## 3. Informations à préciser avant implémentation ou lancement

| Sujet | Décision attendue | Moment limite |
|---|---|---|
| Marché | Pays, ville et quartiers de départ | Avant configuration paiement et pilote |
| Monnaie | XAF ou XOF ; règles de prix et fiscalité | Avant développement financier final |
| Agrégateur | Nom, contrat, documentation, sandbox, canaux | Avant intégration |
| Base des frais | 3 % du prix ou du total, frais fixes, taxes et arrondis | Avant mise en production des devis |
| Abonnement | Tarif, essai, mode de renouvellement et résiliation | Avant recrutement avec promesse tarifaire |
| Indemnités | Validation des montants proposés et répartition | Avant toute réservation réelle |
| Fidélité | Paramètres du premier programme et plafonds | Avant activation par salon |
| Prestataires | Hébergement, messages, cartes, identité | Pendant cadrage technique |
| Exploitant | Entité juridique, contacts support, contrats locaux | Avant lancement |
| Équipe/budget | Ressources et calendrier contractuel | Avant engagement de réalisation |

Ces informations n’empêchent pas de rédiger les spécifications et de préparer les maquettes. Elles empêchent de présenter le produit comme prêt à encaisser en production.

## 4. Historique

2026-11-04 — v1.0 : constitution du dossier complet à partir des échanges ; priorité donnée aux règles corrigées : paiement en ligne seul admissible aux récompenses, frais plateforme de 5 %, frais supportés par le client.

Pour chaque évolution : enregistrer date, auteur, ancienne règle, nouvelle règle, justification, effet sur les réservations existantes et tests concernés. L’accord à une nouvelle version ne modifie pas rétroactivement les conditions déjà acceptées.
