# Événements — GoMeCoiffer

Événements de domaine (`DomainEvent`, synchrones, même transaction) et d'intégration (`IntegrationEvent`,
post-commit via l'outbox, livrés au moins une fois) avec leurs subscribers. Règles : skill `ddd` §10 et
`CLAUDE.md` §I.3. Le `type` d'un `IntegrationEvent` est un contrat : il ne se renomme jamais.

## Événements implémentés

| Événement | Nature | `type` (intégration) | Émis par (agrégat) | Subscribers (module → handler) | Même transaction justifiée ? |
|---|---|---|---|---|---|
| _aucun_ | | | | | |

## Événements prévus par le PRD (non codés)

À confirmer par les use cases ; nature indicative.

| Événement | Nature prévue | Fait métier | Réaction attendue |
|---|---|---|---|
| `BookingConfirmed` | intégration | réservation confirmée (sur place ou après paiement) | SSE planning du salon et disponibilités publiques |
| `BookingCancelled` | intégration | réservation annulée | SSE, créneau libéré |
| `BookingExpired` | intégration | paiement non confirmé à l'échéance (BR-04/05) | SSE, créneau libéré |
| `ServiceStarted` / `ServiceCompleted` | intégration | prestation démarrée / terminée | SSE, agenda recalculé (F02 règle 5) |
| `ClientMarkedAbsent` | domaine | client absent (BR-08) | proposition de nouvel horaire possible |
| `RescheduleProposed` | domaine | nouvel horaire proposé (F06) | créneau sécurisé temporairement |
| `RescheduleAccepted` | domaine | proposition acceptée | `Booking` déplacé **dans la même transaction** (exception skill `ddd` §5) |
| `StaffBlockedForWalkIn` | intégration | blocage temporaire d'un professionnel (BR-07) | SSE disponibilités |
| `OnlinePaymentConfirmed` | intégration | paiement confirmé par l'agrégateur | confirmation de la réservation, ou `PaymentIncident` si créneau perdu (BR-06) |
| `PaymentReceivedAtSalon` | intégration | encaissement déclaré au salon | tableau de bord, historique |
| `SalonPublished` / `SalonSuspended` | intégration | visibilité marketplace | lectures marketplace |
| `SubscriptionExpired` | intégration | abonnement expiré | début de la période de grâce (F08) |

Interdit par le PRD : aucun événement ne déclenche de notification promotionnelle « un professionnel est libre ».
