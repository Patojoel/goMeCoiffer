# 02 — Règles métier et politiques de réservation

## RM-01 — Disponibilité et réservation

Chaque prestation possède une durée, un prix connu, des collaborateurs habilités et éventuellement une marge de préparation/nettoyage. L’occupation comprend la prestation et les marges. Les intervalles sont semi-ouverts : une occupation finissant à 10 h 30 permet une autre occupation commençant à 10 h 30.

Les créneaux proposés respectent les horaires du salon, les horaires individuels, les congés, les réservations confirmées et les blocages temporaires encore actifs. Les réservations par téléphone ou sur place utilisent les mêmes contrôles que celles de la marketplace.

Le salon choisit un mode de confirmation automatique ou manuelle. En mode manuel, il accepte d’abord la demande ; le client reçoit ensuite une fenêtre de paiement si ce mode a été choisi. Aucun débit n’est lancé pour un rendez-vous encore refusé ou non accepté. Les délais d’acceptation et de paiement sont configurables et visibles ; défauts proposés : 30 minutes pour répondre et 10 minutes pour payer. Les réservations très proches peuvent être désactivées dans ce mode.

Une demande en attente d’acceptation ne garantit pas le créneau. L’acceptation acquiert atomiquement la disponibilité. Sans paiement, elle confirme le rendez-vous ; avec paiement, elle crée un blocage temporaire. Les demandes concurrentes non acceptées restent des demandes, sans promesse de disponibilité.

## RM-02 — Paiement et confirmation

Un blocage temporaire empêche un autre client d’acquérir le même créneau pendant le paiement. Sa durée proposée est de 10 minutes ; elle doit être compatible avec le moyen de paiement retenu. Limiter les blocages par compte et appareil pour éviter l’accaparement.

La confirmation financière provient d’un webhook signé ou d’une vérification serveur auprès de l’agrégateur, jamais du seul retour du navigateur. Si le paiement réussit après expiration, le serveur tente une nouvelle acquisition atomique du créneau. Si elle échoue, il ouvre un remboursement intégral automatique, informe le client et ne crée pas de rendez-vous concurrent. Un autre horaire peut être réservé séparément.

## RM-03 — Égalité des créneaux confirmés

Un client ayant payé ne passe pas devant un client possédant un rendez-vous confirmé sans paiement. Tout client confirmé dispose de la même protection contre les chevauchements. Les clients sans rendez-vous occupent uniquement les disponibilités restantes.

## RM-04 — Arrivée, retard et absence

Le client présente un code de rendez-vous ou un QR code au salon. Le salon confirme l’arrivée. L’auto-déclaration seule du client ne suffit pas à prouver la présence. Le salon peut enregistrer une arrivée sans téléphone avec justification.

Tolérance proposée : 10 minutes. Elle n’autorise pas à dépasser le créneau suivant. Si une prestation complète ne tient plus dans le temps restant, proposer un collaborateur disponible et accepté, un créneau ultérieur ou un report. Ne pas raccourcir la prestation ou changer son prix sans accord.

Une absence peut être proposée après la tolérance, mais elle est notifiée au client et reste contestable. Aucune indemnité ni aucun reversement lié à l’absence ne doit être définitivement validé automatiquement en cas de contestation ouverte. L’absence se fonde sur le rendez-vous, les communications et la validation du salon ; le GPS seul ne constitue pas une preuve.

Exemple : rendez-vous 10 h–10 h 30, puis 10 h 30–11 h. Une arrivée à 10 h 20 ne permet pas de conserver une prestation de 30 minutes à 10 h 20. Le second client garde son horaire ; le premier choisit une autre disponibilité sous les conditions de report applicables.

## RM-05 — Politique d’annulation proposée

Principes validés : annulation anticipée favorable au client, pénalité tardive limitée et annoncée, indemnité d’absence distincte, remboursement intégral si le salon annule, recours possible. Les montants ci-dessous sont des propositions, pas des montants déjà approuvés.

| Cas | Proposition initiale |
|---|---|
| Au moins 12 heures avant le début | Remboursement intégral ou report gratuit au choix |
| Moins de 12 heures, avant le début | Indemnité de 20 % du prix net de prestation ; reste remboursé |
| Absence imputable au client | Indemnité de 30 % du prix net ; reste remboursé |
| Salon annule ou ne peut assurer la prestation | Remboursement intégral, frais inclus, ou report choisi |
| Retard du salon supérieur à 20 minutes | Droit proposé à annuler sans pénalité ou à reporter |
| Incident exceptionnel justifié | Examen par support ; décision traçable |

Les seuils utilisent l’heure du serveur et l’heure de début locale convertie en UTC. « Au moins 12 heures » inclut exactement 12 heures. Le règlement applicable est celui accepté au moment de la réservation, pas celui actuellement affiché par le salon.

Une réservation sans paiement peut être annulée et affecter le suivi des absences. Aucune somme n’est débitée sans moyen de paiement autorisé et consentement préalable ; pour le pilote, les indemnités financières concernent les réservations prépayées seulement. Les absences répétées peuvent limiter les futures réservations avec procédure de contestation.

## RM-06 — Report

Le report acquiert le nouveau créneau puis libère l’ancien dans une transaction atomique. En cas d’échec, l’ancien rendez-vous reste valable. Le client voit la nouvelle date, le prix et les éventuels frais avant de confirmer.

Un report gratuit conserve le montant déjà payé lorsque le prix est inchangé. Une différence de prix impose soit un complément explicite, soit un remboursement partiel. En pilote, un changement de prestation peut passer par une annulation et une nouvelle réservation pour réduire les ambiguïtés comptables.

Une demande faite après la limite d’annulation conserve son caractère tardif ; déplacer le rendez-vous ne permet pas d’effacer une pénalité déjà applicable. Un geste commercial reste possible et audité. Les modalités financières d’un report tardif sont annoncées avant son acceptation.

## RM-07 — Réalisation et fidélité

Seule une visite réservée via la plateforme, payée en ligne, réellement effectuée et non intégralement remboursée peut produire des droits. Les paiements en espèces et les réservations saisies seulement par le salon n’en produisent pas. Un lien de réservation envoyé par le salon et finalisé par le client sur la plateforme est admissible.

Pour le pilote, utiliser un compteur de visites : au maximum une visite admissible par rendez-vous terminé, même avec plusieurs prestations. Une facture fractionnée ne multiplie pas les droits. Les crédits sont enregistrés après réalisation, mis en attente en cas de litige et utilisables après clôture de cette attente.

Proposition anti-abus : une seule visite créditée par client et par salon sur une même journée locale ; plusieurs rendez-vous réels restent autorisés, mais ne multiplient pas automatiquement les avantages.

Chaque salon choisit le seuil, les prestations admissibles, la récompense, sa durée de validité et son plafond. Exemple purement illustratif : après 5 visites admissibles, une réduction de 500 FCFA sur une prochaine prestation d’au moins 2 000 FCFA. Une récompense appartient à un salon et ne peut pas être transférée à un autre.

Le salon finance l’avantage par une réduction de son prix. Les frais client sont calculés sur le prix réduit. Une prestation complémentaire offerte peut accompagner une prestation payée. Les commandes entièrement gratuites et la conversion des récompenses en espèces sont hors pilote.

Une récompense utilisée est réservée pendant le paiement puis consommée après confirmation. Si le paiement échoue ou si le rendez-vous est annulé sans prestation, elle est restituée ; l’indemnité éventuelle est calculée sur le prix net accepté. L’annulation imputable au salon ne doit pas faire perdre un avantage expiré entre-temps : prolongation proposée de 30 jours.

Un remboursement intégral après réalisation annule le crédit de fidélité associé. Si ce crédit a déjà permis une récompense utilisée, conserver un solde correctif explicite, sans débiter automatiquement le client. En remboursement partiel, conserver le crédit uniquement si une prestation admissible a effectivement eu lieu ; la décision doit être justifiée.

Toute évolution du programme est versionnée et prospective. Les avantages déjà acquis conservent leurs conditions jusqu’à expiration. Le salon ne peut pas effacer les droits acquis en désactivant son programme.

## RM-08 — Avis et litiges

Les avis nécessitent une réservation réalisée, pas obligatoirement un paiement en ligne. Ils sont limités à un avis par rendez-vous et modérables selon des règles publiques. Un salon peut répondre ou signaler, mais pas supprimer seul un avis négatif.

Le client peut contester une absence, un prix additionnel ou une prestation non fournie. Une fenêtre de 24 heures après l’heure de fin est proposée pour suspendre automatiquement le reversement ; elle ne supprime pas les recours ultérieurs prévus par les conditions ou le prestataire. L’ouverture d’un litige bloque la part financière concernée et les récompenses associées.

## RM-09 — Abonnement salon

Gratuité de démarrage, puis abonnement mensuel : principe validé. Durée d’essai et tarif restent à définir. Propositions de travail : essai de 60 jours, notifications avant échéance, délai de grâce de 7 jours après impayé.

Le tarif, la date de passage au payant et l’autorisation de renouvellement sont acceptés explicitement. À défaut de souscription, ne pas facturer automatiquement. Le salon peut résilier pour la prochaine échéance et exporter les données autorisées.

Après suspension, arrêter les nouvelles réservations selon la politique annoncée, mais conserver l’accès nécessaire aux rendez-vous déjà pris, aux remboursements, à la facturation et aux droits acquis des clients. La suspension ne supprime ni les dettes ni les rendez-vous en cours.
