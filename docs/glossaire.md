# Glossaire métier — GoMeCoiffer

Vocabulaire du PRD, à employer **mot pour mot** dans les use cases et les écrans. La traduction dans le code
(anglais) est tenue par le skill `ddd` §1. Enrichi par `use-case-writer` à chaque nouveau terme.

| Terme | Définition | Source |
|---|---|---|
| Utilisateur | Identité de connexion unique, qui peut appartenir à plusieurs salons. | PRD §3 |
| Organisation | Entité propriétaire ou exploitante d'un ou plusieurs salons. | PRD §3 |
| Salon (établissement) | Établissement physique rattaché à une organisation ; possède ses prestations, collaborateurs, horaires, réservations, paramètres et son abonnement. | PRD §3 |
| Collaborateur | Utilisateur ayant une appartenance et des permissions dans un salon. | PRD §3 |
| Salon actif | Salon sélectionné dans le back-office ; détermine le contexte d'autorisation. | PRD §3 |
| Rôle système | Super Administrateur, Administrateur Opérations, Administrateur Finance Plateforme ; attribués uniquement par GoMeCoiffer. | PRD §4 |
| Rôle salon | Propriétaire, Administrateur de salon, Coiffeur/Barbier, Responsable financier, Praticien de beauté ; permissions ajustables par salon. | PRD §5-6 |
| Intervenant (professionnel) | Personne qui réalise des prestations ; a des spécialités et des prestations autorisées. | PRD §5.5 |
| Spécialité | Métier d'un intervenant (esthéticienne, manucure…) ; n'est pas un rôle de sécurité. | PRD §5.5 |
| Prestation | Service proposé par un salon : nom, catégorie, prix, durée estimée, statut actif/inactif. | PRD §7 étape 3 |
| Créneau | Intervalle de temps où une prestation peut être réalisée en entier par un intervenant. | PRD F02 |
| Disponible maintenant / Prochain créneau / Indisponible | États affichés d'un intervenant pour une prestation donnée. | PRD F02 |
| Blocage temporaire | Indisponibilité déclarée par un professionnel, notamment pour un client sans réservation. | PRD F02, BR-07 |
| Réservation | Rendez-vous pour une prestation assurée par un professionnel principal, dans un salon. | PRD F03, §9 |
| « Peu importe » | Choix du client qui laisse le système attribuer un professionnel qualifié et disponible. | PRD F03 |
| Client absent | Client qui ne s'est pas présenté après le délai de tolérance. | PRD F06, BR-08 |
| Proposition de nouvel horaire (reprogrammation) | Nouveau créneau proposé, acceptable ou refusable par lien, à durée de validité limitée ; une seule active par réservation. | PRD F06 |
| Paiement en ligne | Paiement Mobile Money (Orange Money, MTN MoMo) via l'agrégateur, confirmé par le serveur. | PRD F04 |
| Paiement sur place | Paiement au salon, déclaré par le responsable autorisé après encaissement. | PRD F04 |
| Incident de paiement | Paiement arrivé après expiration alors que le créneau n'est plus disponible ; à résoudre ou rembourser. | PRD BR-06 |
| Publication | Mise en ligne d'un salon dans la marketplace (au moins une prestation, un professionnel éligible, des horaires valides). | PRD §7 étape 7 |
| Abonnement | Forfait SaaS mensuel ou annuel facturé par salon. | PRD §10, F08 |
| Période de grâce | Délai après expiration de l'abonnement avant la suspension des nouvelles réservations publiques. | PRD F08 |
