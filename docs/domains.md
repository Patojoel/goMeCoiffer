# Modules backend — GoMeCoiffer

Référence des modules de `backend/src/modules/`, de leurs commandes et de leurs queries. Mis à jour par
`backend-builder` / `query-perf` à chaque nouveau cas d'usage. État : **prévu** (rien de codé), **en cours**,
**livré**.

**Module modèle** (à reproduire pour un nouveau module) : aucun pour l'instant. Le premier module complet
(cible : `booking`) sera nommé ici et servira de référence de style (skill `ddd`).

## Vue d'ensemble

| Module | Responsabilité | Agrégats (prévus) | PRD | HTTP | État |
|---|---|---|---|---|---|
| `identity` | Comptes, connexion, session, OTP, réinitialisation | `User` | §3, §7 étape 1, §16 | `/api/public/auth`, `/api/salon/session` | prévu |
| `organizations` | Organisation, salons, publication, appartenances, rôles salon et permissions, salon actif, onboarding | `Organization`, `Salon`, `SalonMembership`, `SalonRoleSet` | §3, §5, §6, §7, F07 | `/api/salon/*` | prévu |
| `catalog` | Prestations, catégories, prix, durées, statut actif | `SalonService` | §7 étape 3, F07 | `/api/salon/services`, lecture publique | prévu |
| `staff` | Intervenants, spécialités, prestations autorisées, horaires, pauses, indisponibilités et blocages temporaires | `StaffMember`, `WorkingSchedule`, `Unavailability` | §5.3, §5.5, §7 étapes 4-5, F02, BR-07 | `/api/salon/staff` | prévu |
| `booking` | Réservations (cycle de vie), planning, client sur place, reprogrammations, disponibilités (lecture) | `Booking`, `RescheduleProposal` | F02, F03, F05, F06, BR-01…BR-03, BR-07…BR-09, BR-11, BR-12 | `/api/public/*`, `/api/salon/bookings` | prévu |
| `payments` | Paiement en ligne (Mobile Money), paiement au salon, webhooks, réconciliation, incidents | `Payment`, `PaymentIncident` | F04, BR-04…BR-06, BR-10 | `/api/public/payments`, `/api/salon/payments`, `/api/webhooks/payments` | prévu |
| `subscriptions` | Abonnement SaaS par salon, périodes, paiements d'abonnement, grâce, suspension | `Subscription` | F08, §10 | `/api/admin/subscriptions`, `/api/salon/subscription` | prévu |
| `platform` | Administration GoMeCoiffer : rôles système, supervision, visibilité marketplace, indicateurs | `PlatformAdmin` | §2.C, §4, F08 | `/api/admin/*` | prévu |

## Commandes par module

_Aucune commande implémentée._ Format d'une ligne : `module` | commande | route | permission | UC.

## Queries par module

_Aucune query implémentée._ Format d'une ligne : `module` | query | route | permission | UC | tables lues.
