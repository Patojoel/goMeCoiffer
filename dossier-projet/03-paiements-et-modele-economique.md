# 03 — Paiements, frais et modèle économique

## PAY-01 — Modèle commercial validé

Le salon bénéficie d’une période gratuite puis paie un abonnement mensuel. Le client paie le prix de la prestation augmenté des frais. Les frais plateforme sont fixés à 5 % dans les échanges. Les frais agrégateur de 3 % constituent l’exemple commercial à confirmer contractuellement.

Notations : P est le prix net de prestation après avantage salon ; f = 5 % ; a = 3 %. Tous les calculs techniques utilisent des unités monétaires entières et des décimales exactes, jamais des nombres flottants binaires. Le code ISO XAF ou XOF doit être choisi avant intégration. Les arrondis et minimums imposés par le prestataire prévalent sur les hypothèses de simulation.

## PAY-02 — Deux bases de frais à ne pas confondre

### Tarification simple présentée au client

Frais plateforme F = arrondi(P × f). Frais de paiement affichés A = arrondi(P × a). Total T = P + F + A.

Pour P = 1 000 FCFA : F = 50, A = 30 et T = 1 080. Le salon reçoit 1 000 pour une prestation réalisée sans incident.

Si l’agrégateur prélève 3 % de P, son coût est 30 et la marge transactionnelle avant autres coûts est 50. S’il prélève 3 % de T, son coût théorique est 32,40 et la marge théorique est 47,60 ; le montant réellement débité dépend des arrondis contractuels. Facturer 5 % ne garantit donc pas de conserver exactement 5 % nets.

### Si l’objectif devient de conserver exactement 5 % avant autres coûts

Si l’agrégateur taxe le total encaissé, une majoration doit résoudre T × (1 − a) = P × (1 + f). Pour P = 1 000 : T théorique = 1 082,474… FCFA. Le prix entier final et les lignes de frais doivent être déterminés avec la règle exacte du prestataire. Ce modèle n’est pas adopté automatiquement : il modifie le montant présenté au client.

Décision de conception : conserver pour les maquettes l’exemple 1 080 FCFA, afficher la marge réelle dans le back-office, puis figer le mode de calcul contractuel avant la production. Ne pas annoncer des frais d’agrégateur de 30 si le contrat exige une présentation différente des coûts refacturés.

## PAY-03 — Cycle du paiement

1. Le serveur calcule un devis immuable : prestations, remise, devise, frais, total, durée de validité et version de politique.
2. Le serveur acquiert le créneau et réserve l’éventuel avantage fidélité.
3. Il crée une intention de paiement chez l’agrégateur avec une clé d’idempotence et une référence interne unique.
4. Le client réalise le paiement dans l’interface du prestataire ; l’application ne stocke ni code secret ni données de carte.
5. Le webhook est authentifié, dédupliqué et traité transactionnellement. Montant, devise, bénéficiaire et référence doivent correspondre au devis.
6. La réservation est confirmée si la disponibilité est encore acquise. Sinon appliquer le remboursement de RM-02.
7. Le client reçoit une confirmation avec reçu, horaire, adresse, détail des frais et règles applicables.
8. Après réalisation et délai opérationnel proposé de 24 heures sans litige bloquant, le montant dû au salon devient éligible au reversement.
9. La confirmation du reversement provient du prestataire. Un ordre envoyé n’est pas un reversement réussi.

Le retour du navigateur ne constitue pas une preuve de paiement. Si le téléphone du client se ferme après le débit, la confirmation reste possible par webhook et consultation ultérieure du compte.

## PAY-04 — Remboursements et indemnités

Politique de conception proposée pour simplifier le pilote : remboursement intégral des frais client lors d’une annulation, avec retenue éventuelle de la seule indemnité de prestation acceptée. Les frais réellement non remboursés par le prestataire sont une charge plateforme dans les simulations, sauf répartition contractuelle explicitement différente. Ce choix doit être chiffré avant lancement.

Exemples pour P = 1 000, T = 1 080, hors arrondis du prestataire :

| Cas | Remboursement client | Montant salon | Frais plateforme conservés | Coût agrégateur résiduel |
|---|---:|---:|---:|---|
| Prestation réalisée | 0 | 1 000 | 50 affichés ; marge réelle après coût agrégateur | Selon contrat |
| Annulation anticipée | 1 080 | 0 | 0 | À la charge plateforme dans l’hypothèse |
| Annulation tardive, indemnité proposée 20 % | 880 | 200 | 0 | Même hypothèse |
| Absence, indemnité proposée 30 % | 780 | 300 | 0 | Même hypothèse |
| Annulation du salon | 1 080 | 0 | 0 | Même hypothèse |

L’indemnité est attribuée au salon dans ce modèle, pas assimilée à une commission plateforme. Aucun débit additionnel n’est effectué pour augmenter une indemnité. Pour les annulations, l’identité monétaire est T = remboursement + indemnité ; le coût agrégateur est ensuite une charge séparée de la plateforme.

Les remboursements partiels après prestation ont une allocation explicite : part prestation, part frais plateforme et part frais paiement. Enregistrer chaque part et son motif ; ne pas recalculer aveuglément un pourcentage sur le total. La somme des remboursements ne peut jamais excéder les encaissements confirmés correspondants.

Un remboursement demandé reste « en cours » tant que le prestataire ne confirme pas son exécution. Une erreur déclenche une relance contrôlée et une alerte support. Le délai annoncé au client dépend du canal de paiement réel.

## PAY-05 — Reversements, litiges et rapprochement

La plateforme orchestre les opérations via un prestataire habilité ; elle ne doit pas supposer qu’elle peut détenir elle-même les fonds des clients. L’agrégateur a été déclaré capable de reversement différé ; vérifier aussi les bénéficiaires multiples, le remboursement des frais, les réserves, les annulations après reversement et les litiges tardifs.

Le compte de reversement du salon doit être vérifié. Sa modification impose une authentification renforcée, une notification au propriétaire et une temporisation proposée avant le prochain versement.

Rapprochement quotidien à trois niveaux : transactions internes, état agrégateur et relevé de reversement. Toute opération manquante ou en doublon ouvre une anomalie. Le rapprochement n’est pas remplacé par les webhooks : un webhook peut être perdu ou reçu en retard.

Un litige ouvert avant éligibilité suspend la part concernée. Après reversement, traiter les remboursements via les capacités contractuelles du prestataire et une réserve éventuelle ; ne pas inventer de récupération automatique sur un compte salon. Une contestation tardive reste enregistrable.

Le journal financier doit être immuable, avec écritures compensatoires. Séparer principal salon, frais client, coût prestataire, commission plateforme, remboursement, indemnité, abonnement et reversement. Toute écriture a une devise, une référence et un événement source unique.

## PAY-06 — Revenus et coûts

Revenu potentiel = abonnements effectivement payés + frais plateforme réellement conservés. Le volume encaissé et le principal reversé aux salons ne sont pas du chiffre d’affaires de plateforme par défaut ; la présentation comptable dépend du statut contractuel.

Coûts à budgéter : paiement, SMS/notifications, cartographie, hébergement, stockage des photos, support, acquisition salons/clients, remboursements non récupérables, litiges, fiscalité, comptabilité et maintenance.

Marge contributive mensuelle = abonnements + marge transactionnelle − coûts variables. Résultat opérationnel indicatif = marge contributive − coûts fixes. Le seuil de rentabilité dépend de la rétention, du panier, du taux de paiement en ligne et des annulations ; il ne se déduit pas du taux de 5 % seul.

Le fichier `simulation-financiere.csv` propose trois tailles d’activité et plusieurs paniers. Toutes les données de volume, d’abonnement et de coût y sont des hypothèses, pas des prévisions validées. Les montants théoriques décimaux ne remplacent pas le règlement en unités entières du prestataire.

## PAY-07 — Questions à fermer avec l’agrégateur

- Pays, devise, canaux de paiement et éventuels minimums/frais fixes.
- Base des 3 %, taxes incluses ou non, règle d’arrondi, coût du reversement et du remboursement.
- Autorisation et présentation de la surcharge client selon les canaux.
- Paiement marchand multi-bénéficiaires, vérification salon et délais de règlement.
- Webhooks signés, idempotence, états, relevés de rapprochement et environnement de test.
- Remboursements partiels, frais non restitués, contestations tardives et fonds déjà reversés.
- Modalités de paiement et de renouvellement des abonnements salons ; le renouvellement automatique n’est pas supposé disponible.
