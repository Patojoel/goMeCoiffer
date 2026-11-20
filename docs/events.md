# Événements — GoMeCoiffer

Événements de domaine (`DomainEvent`, synchrones, même transaction) et d'intégration (`IntegrationEvent`,
post-commit via l'outbox, livrés au moins une fois) avec leurs subscribers. Règles : skill `ddd` §10 et
`CLAUDE.md` §I.3. Le `type` d'un `IntegrationEvent` est un contrat : il ne se renomme jamais.

## Événements implémentés

| Événement | Nature | `type` (intégration) | Émis par (agrégat) | Subscribers (module → handler) | Même transaction justifiée ? |
|---|---|---|---|---|---|
| `OrganizationFounded` | domaine | — | `Organization.found` | aucun à ce stade | sans objet |
| `SalonRegistered` | domaine | — | `Salon.register` | `organizations` → `WhenSalonRegistered` (`InitializeSalonRolesHandler`, même transaction : recopie les permissions par défaut des 4 rôles, D-038 / UC-008) | oui (jamais de salon sans ses 4 réglages de rôle par défaut, RG-008-05) |
| `RolePermissionsAdjusted` | domaine | — | `RolePermissions.adjustPermissions` (UC-008) | aucun à ce stade ; identifiants (`salonId`, `adjustedByUserId`), rôle et codes ajoutés/retirés seulement, jamais nom ni numéro | sans objet |
| `CollaboratorInvited` | domaine | — | `Invitation.issue` | aucun à ce stade ; identifiants et rôle seulement, jamais nom ni numéro | sans objet |
| `InvitationCancelled` | domaine | — | `Invitation.cancel` | aucun à ce stade | sans objet |
| `InvitationAccepted` | domaine | — | `Invitation.accept` (UC-007) | aucun à ce stade (UC-008 : équipe et planning) ; identifiants (invitation, salon, compte) et rôle seulement, jamais nom ni numéro | sans objet |
| `CollaboratorRoleChanged` | domaine | — | `SalonMembership.changeRole` (UC-011) | aucun à ce stade ; identifiants, ancien et nouveau rôle seulement, jamais nom ni numéro (le signal SSE `salon` est publié par le handler après le commit) | sans objet |
| `CollaboratorRemoved` | domaine | — | `SalonMembership.revoke` (UC-011) | aucun à ce stade ; identifiants et rôle au retrait seulement | sans objet |
| `CollaboratorReinstated` | domaine | — | `SalonMembership.reinstate` (UC-011, via `AcceptInvitation`) | aucun à ce stade ; identifiants et rôle seulement | sans objet |
| `SystemRoleGranted` | domaine | — | `PlatformAdmin.grant` (UC-012) | aucun à ce stade ; identifiants, rôle système et instant, jamais nom ni numéro | sans objet |
| `SystemRoleRevoked` | domaine | — | `PlatformAdmin.revoke` (UC-012) | aucun à ce stade ; sessions et flux SSE du compte fermés par le handler (port, après commit) | sans objet |

Les repositories d'écriture d'`organizations` remettent `pullEvents()` au `DomainEventDispatcher` dans `add` (dans la transaction). Les repositories d'`identity` ne le font pas encore (voir backlog).

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
