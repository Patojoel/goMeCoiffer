# 04 — Parcours utilisateurs et spécifications des écrans

## 1. Navigation

Client : Explorer → Salon → Prestation → Créneau → Récapitulatif → Paiement éventuel → Rendez-vous → Récompenses / Aide.

Salon : Vue du jour → Agenda → Clients → Prestations → Équipe → Fidélité → Finances → Abonnement → Paramètres.

Administration : Salons → Réservations → Transactions → Reversements → Litiges → Modération → Paramètres → Audit.

## 2. Parcours client principal

### Écran C01 — Explorer

Champ quartier/ville, demande facultative de géolocalisation, filtres, liste des salons et carte facultative. Chaque carte affiche nom, catégorie, distance estimée, photo, note et un prix représentatif clairement associé à une prestation. Prévoir état sans résultat, position refusée, connexion faible et localisation approximative. Ne pas bloquer la consultation derrière une création de compte.

### C02 — Fiche salon

Galerie des locaux et réalisations, description, services et prix, durée, équipe, horaires, adresse, avis, accès, programme de fidélité et bouton de réservation. Les conditions d’annulation sont accessibles avant le choix final. La présence d’un programme ne garantit pas qu’une visite donnée soit admissible : afficher les prestations concernées.

### C03 — Choix de prestation et créneau

Sélection de prestation, options et collaborateur ou « sans préférence ». Le système associe alors un professionnel précis pour garantir la capacité. Calendrier de disponibilités réelles. Afficher heure de début, durée et heure de fin. Si un créneau vient d’être pris, proposer les prochains créneaux sans effacer la prestation choisie.

### C04 — Identification

Compte par téléphone et code à usage unique, email facultatif selon besoin de reçu. Consentement aux conditions séparé de l’autorisation marketing. Le prestataire OTP et ses coûts restent à sélectionner. Prévoir renvoi limité, code expiré, changement de numéro et récupération contrôlée du compte.

### C05 — Récapitulatif et règlement

Afficher salon, prestation, professionnel, date/heure, prix, avantage appliqué, frais de paiement, frais plateforme et total. Exemple : « Coiffure 1 000 FCFA ; frais de paiement 30 ; frais goMeCoiffer 50 ; total 1 080 FCFA » sous réserve de la base contractuelle retenue.

Choix : payer maintenant sur la plateforme, ou réserver sans paiement si le salon l’autorise. Afficher que seule une prestation payée sur la plateforme et réalisée ouvre droit aux récompenses. Présenter la limite d’annulation gratuite en date et heure exactes, les pénalités et le lien vers la politique versionnée. Aucune case marketing précochée.

### C06 — Paiement

Interface de l’agrégateur ou redirection sécurisée. États : en attente, confirmé, échoué, expiré, remboursement en cours. Le bouton ne doit pas autoriser des paiements multiples accidentels. Après perte de connexion, retrouver la transaction existante avant de proposer un nouvel essai.

### C07 — Détail rendez-vous

Statut, itinéraire externe choisi, contact salon, rappel, code de présence, annulation/report, reçu et assistance. Afficher « demande en attente » distinctement de « confirmé ». Un paiement confirmé sans créneau disponible affiche le remboursement en cours, jamais une réservation confirmée fictive.

### C08 — Visite terminée et fidélité

Résumé de la visite, progression propre au salon, conditions de l’avantage et avis. Exemple de texte : « 3 visites admissibles sur 5 ». Les droits en attente de résolution d’un litige sont présentés séparément des avantages utilisables.

### C09 — Incident

Motif guidé : salon fermé, retard important, absence contestée, paiement débité sans confirmation, prestation non fournie, remboursement manquant. Pièces facultatives, numéro de dossier et statut. Ne pas demander des données de carte ou codes secrets.

## 3. Parcours d’inscription salon

S01 : compte propriétaire et téléphone vérifié. S02 : identité de l’établissement et position. S03 : horaires, équipe et prestations. S04 : photos et droits d’utilisation. S05 : coordonnées de règlement et vérification via l’agrégateur. S06 : conditions, essai gratuit et futur abonnement. S07 : contrôle de publication et première réservation de démonstration sans argent réel.

Un salon incomplet peut préparer son catalogue en brouillon. La réception des paiements est bloquée tant que les vérifications requises ne sont pas terminées. L’administration ne doit pas contourner cette condition par un simple changement de visibilité.

## 4. Écrans back-office

| Écran | Contenu et actions | États particuliers |
|---|---|---|
| S10 — Aujourd’hui | Prochains clients, retards, demandes, encaissements déclarés | Aucun rendez-vous, notification échouée |
| S11 — Agenda | Colonnes collaborateurs, blocs de durée, pauses et congés | Conflit, paiement en attente, report proposé |
| S12 — Rendez-vous | Arrivée, début/fin, paiement, annulation, messages | Absence contestée, paiement tardif |
| S13 — Catalogue | Prestations, prix, durée, affectations | Modification applicable aux futures réservations |
| S14 — Clients | Historique et fidélité | Fusion contrôlée de doublons, suppression demandée |
| S15 — Équipe | Invitations, rôles et disponibilités | Départ avec rendez-vous à réaffecter |
| S16 — Fidélité | Règles, aperçu, coût potentiel, droits existants | Nouvelle version, programme arrêté |
| S17 — Finances | À reverser, reversé, remboursé, litiges | Écart de rapprochement ou compte non vérifié |
| S18 — Abonnement | Offre, échéance, facture, résiliation | Essai expiré, paiement échoué, délai de grâce |

L’agenda utilise des libellés en plus des couleurs. Toute action destructive ou financière affiche son effet avant validation. Le collaborateur n’a pas accès par défaut aux revenus globaux ni aux coordonnées de reversement.

## 5. Administration et notifications

Les écrans administrateur proposent recherche par référence, historique chronologique et justification obligatoire pour les corrections. Les remboursements importants peuvent nécessiter une seconde validation selon un seuil à définir. Aucune suppression physique d’écriture financière.

| Événement | Destinataire | Contenu minimum |
|---|---|---|
| Confirmation | Client et salon | Date, durée, service, paiement et règles |
| Rappel J-1/H-1 proposés | Client | Horaire, accès et bouton annuler/reporter |
| Retard annoncé | Client | Retard estimé et options disponibles |
| Annulation/report | Parties concernées | Ancienne/nouvelle date, effet financier |
| Remboursement | Client | Montant et état réel du prestataire |
| Récompense acquise | Client | Salon, avantage et date de validité |
| Essai bientôt terminé | Propriétaire | Tarif, date et action nécessaire |

Ne pas envoyer deux rappels simultanés pour une réservation faite moins d’une heure avant. Les messages transactionnels sont séparés du marketing. Les notifications ne remplacent pas l’état consultable dans l’application.
