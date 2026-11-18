---
name: ddd
description: "Conventions DDD (Domain-Driven Design) de GoMeCoiffer (NestJS + TypeORM, TypeScript). À charger avant d'écrire ou modifier du code de domaine — agrégats, value objects, ports de repository, erreurs métier, événements de domaine/intégration, subscribers — ou pour découper un nouveau module. Impose : agrégats conçus par invariants réels, une transaction = un agrégat (exceptions nommées), événements = faits métier au passé, subscribers dans application/, code en anglais et commentaires en français, périmètre salon."
---

# DDD — Domain-Driven Design (GoMeCoiffer)

> Réf : `CLAUDE.md` §I, `docs/domains.md`, `docs/events.md`, PRD `docs/cahier-des-charges/prd.md`.
> Domaine modèle : le premier module complet, nommé dans `docs/domains.md` (cible : `booking`, cœur du produit).

## 1. Langue

- **Code en anglais** (types, méthodes, champs, événements, dossiers), **commentaires en français**.
- Le vocabulaire vient du PRD et se traduit toujours de la même façon :

| Métier (PRD) | Code |
|---|---|
| utilisateur (identité de connexion) | `User` |
| organisation (propriétaire de salons) | `Organization` |
| salon, établissement | `Salon` |
| appartenance d'un utilisateur à un salon | `SalonMembership` |
| rôle salon / permission | `SalonRole` / `Permission` (code `module:action`) |
| rôle système (Super Admin, Admin Opérations, Admin Finance) | `SystemRole` (`SUPER_ADMIN`, `OPERATIONS_ADMIN`, `FINANCE_ADMIN`) |
| propriétaire | `Owner` (droits protégés non désactivables) |
| professionnel, intervenant, coiffeur, barbier, praticien de beauté | `StaffMember` (profil `StaffProfile`) |
| spécialité (métier : esthéticienne, manucure…) | `Specialty` — **jamais un rôle de sécurité** |
| prestation | `SalonService` (table `salon_services`) |
| prestation autorisée pour un professionnel | `StaffService` |
| horaires de travail, pause | `WorkingSchedule`, `Break` |
| indisponibilité, blocage temporaire (client sans réservation) | `Unavailability` (`kind`: `ABSENCE` / `WALK_IN_BLOCK`) |
| créneau | `Slot` / `TimeRange` |
| réservation, rendez-vous | `Booking` |
| « Peu importe » (professionnel au choix du système) | `anyStaff` |
| client absent | `NoShow` (`markNoShow()`) |
| proposition de nouvel horaire, reprogrammation | `RescheduleProposal` |
| paiement en ligne / au salon | `Payment` (`ONLINE_MOBILE_MONEY` / `AT_SALON`) |
| encaissement déclaré au salon | `recordAtSalonPayment()` |
| incident de paiement (paiement tardif) | `PaymentIncident` |
| abonnement SaaS, période de grâce | `Subscription`, `GracePeriod` |
| publication du salon dans la marketplace | `Salon.publish()` |

- Chaîne de périmètre : Organisation → Salon → (Prestations, Intervenants, Horaires, Réservations, Paiements, Abonnement).
- Statuts de réservation (PRD §9, contrat stable) : `PENDING_PAYMENT`, `CONFIRMED`, `IN_PROGRESS`, `COMPLETED`, `NO_SHOW`, `CANCELLED`, `EXPIRED`. Le **statut financier est séparé** du statut du rendez-vous.
- Un nouveau terme métier s'ajoute à ce tableau (et au glossaire `docs/glossaire.md`).

## 2. Modules, contextes et `shared/`

- Les dossiers `backend/src/modules/*` sont des **modules** d'une même application (une équipe, une base, un langage), pas des contextes bornés indépendants.
- **Écrire** dans un autre module passe par un **événement** ; **lire** un autre module est permis (query SQL en lecture seule). Jamais d'appel d'un handler d'un autre module depuis un handler.
- **Lectures CQRS** : les QueryHandlers ne passent pas par les agrégats et peuvent joindre les tables de plusieurs modules ; ce n'est pas une fuite.
- **`shared/`** n'accueille qu'un concept utilisé par au moins trois modules **et** stable (`Id`, `Money`, `TimeRange`, `PhoneNumber`, bus d'événements). Sinon il reste dans son module.
- **Système externe** (agrégateur Mobile Money, SMS, stockage de photos) : une **couche de traduction** dans `infrastructure/` convertit son modèle dans le nôtre ; aucun type externe n'entre dans `domain/`. Le domaine déclare le port (`PaymentGateway`, `SmsSender`).
- **Effort proportionné** : le cœur (disponibilités, réservations, reprogrammation, paiements) se modélise finement ; les zones génériques (comptes, photos, notifications) restent simples.

## 3. Le domaine ne dépend de rien

`domain/` ne connaît ni NestJS, ni TypeORM, ni HTTP, ni SDK de paiement, ni `application/`, ni `infrastructure/`. Aucun décorateur dans `domain/`. Les dépendances externes entrent par des **interfaces** déclarées dans `domain/`. Une interface de repository parle en objets de domaine, jamais en entité TypeORM. Les I/O restent dans le handler, pas dans l'agrégat.

## 4. Agrégats

- **Conçus par invariants réels** : un agrégat regroupe ce qui doit rester cohérent **à tout instant**. Petit : la racine et le minimum d'entités et de VO. Exemples : `Booking` (statut, créneau, transitions), `RescheduleProposal` (une seule active par réservation, validité), `SalonRoleSet` (droits protégés du propriétaire).
- **Racine seul point d'entrée** ; référence aux autres agrégats **par id**, jamais par champ objet.
- **Création par factory statique** qui valide (`Booking.reserveWithOnlinePayment(...)`, `Booking.reserveAtSalon(...)`, `Booking.recordWalkIn(...)`).
- **Mutation par méthode métier** nommée par l'intention (`confirm()`, `start()`, `complete()`, `markNoShow()`, `cancel()`), jamais par setter. Transitions de statut interdites → erreur métier nommée.
- **Lecture par `snapshot()`** (objet `readonly`). **Aucune décision** ne se prend sur un snapshot dans un handler : un `if` sur un champ du snapshot est une règle sortie de l'agrégat.
- **`AggregateRoot`** s'étend quand l'agrégat publie des événements ; **c'est l'agrégat qui enregistre** (`this.record(...)`) dans sa méthode métier, jamais le handler.
- **Reconstitution** (`static restore(props)`) : ne rejoue aucune règle de création.
- **Concurrence** : chaque racine porte `version` (verrou optimiste, `CLAUDE.md` §I.5).

## 5. Une transaction = un agrégat

Règle par défaut : une commande modifie **un** agrégat. Un agrégat et ses entités enfants comptent pour un.

Exception assumée : un **`DomainEvent` synchrone** dont le subscriber modifie un autre agrégat **dans la même transaction**, seulement quand une règle métier exige que les deux soient cohérents au même instant. Exemple légitime : accepter une `RescheduleProposal` déplace le `Booking` (le client ne doit jamais voir une proposition acceptée sur un rendez-vous non déplacé). Le nommer dans `docs/events.md` comme tel.

Hors de ce cas, la cohérence entre agrégats, et toujours entre modules, est **éventuelle** : un `IntegrationEvent` post-commit (outbox), un subscriber idempotent, une compensation si l'effet échoue (ex. paiement confirmé après expiration → `PaymentIncident`, BR-06).

## 6. Value objects

- Un VO n'existe que s'il **porte une règle** (format, borne, calcul) : envelopper chaque `string` est de la cérémonie.
- Immuable, égalité par valeur, **auto-validé** à la construction par une erreur métier, avec son comportement :
  - `Money` (XAF entiers, jamais négatif, `add`, `equals`) ;
  - `TimeRange` (`start < end`, `overlaps`, `contains`, durée) — créneaux, pauses, indisponibilités ;
  - `PhoneNumber` (format camerounais normalisé E.164, `+237…`) ;
  - `ServiceDuration` (minutes > 0, multiple du pas de planning si le projet en fixe un).
- Un VO qui contient un secret a un `toString()` muet (`OtpCode[***]`, `PasswordHash[***]`).

## 7. Invariants, validation et services de domaine

- **Invariant** (toujours vrai pour l'agrégat) → erreur métier levée par l'agrégat ou le VO.
  **Entrée invalide** (attendue, venue de l'utilisateur) → validation à l'entrée (schéma Zod du contrat) et 400.
- **L'agrégat ne protège que ce qu'il voit.** Une règle qui demande d'autres instances relève d'un **service de domaine** (sans état, interface dans `domain/`) :
  - éligibilité d'un professionnel (BR-01 : actif, habilité pour la prestation, disponible sur toute la durée) ;
  - choix du professionnel pour « Peu importe » ;
  - unicité d'un téléphone, d'un nom de salon dans une organisation.
- **Absence de chevauchement (BR-02)** : la règle est vérifiée par le service de domaine **et** garantie par la contrainte d'exclusion PostgreSQL (`CLAUDE.md` §I.5) ; le repository traduit `23P01` en `SlotNoLongerAvailableError`.
- **Le handler orchestre** (charger, appeler l'agrégat ou le service, sauver) et ne porte **aucune règle métier**. Pas de logique métier dans un contrôleur, un mapper, une entité TypeORM ou un subscriber.

## 8. Repositories

Deux familles, séparées dans `domain/repositories/` (D-024) :

- **Écriture** (`repositories/write/<x>.repository.ts`) : un repository **par racine d'agrégat** qui en a besoin, interface (port) + token ; implémentation `TypeOrm<X>Repository` dans `infrastructure/persistence/typeorm-repositories/`. Il **charge et sauve** des agrégats (et pose un verrou si la règle l'exige), rien d'autre.
- **Lecture** (`repositories/read/<x>.read-repository.ts`) : une lecture dont une commande a besoin **sans charger d'agrégat** (historique d'envois, compteurs, existence), interface + token ; implémentation en **SQL pur** dans `application/read-repositories/sql-<x>.ts` via `SqlReader`. Les lectures d'écran ne sont pas des repositories : ce sont des QueryHandlers (skill [sql-query]).

Les deux ont leur fake in-memory dans `tests/fakes/` (le fake de lecture lit les données du fake d'écriture). Méthodes nommées dans le langage métier (`getOfSalon(salonId, id)`, `findActiveProposalOf(bookingId)`, `recentSends(phone, purpose, since)`), objets de domaine en entrée et en sortie. Toute méthode de chargement prend le `salonId` (périmètre, §11).

Les autres dépendances externes (SMS, paiement, hachage, générateur de code) sont des **ports** : `domain/ports/<x>.port.ts`, un port et son token par fichier.

## 9. Erreurs métier

Une règle du domaine a son erreur **nommée par l'intention**, **une par fichier** dans `domain/exceptions/<intention>.error.ts` (`SlotNoLongerAvailableError`, `BookingAlreadyStartedError`, `ProposalExpiredError`, `OwnerRightsCannotBeRevokedError`), sous-classe de `BusinessRuleViolation` avec un `code` stable (`BOOKING_ALREADY_STARTED`). Jamais `new Error('...')` pour une règle, jamais d'héritage de `HttpException`. Une panne système n'est **jamais catchée** dans un handler.

## 10. Événements

- **Un fait du métier, au passé** : `BookingConfirmed`, `BookingCancelled`, `ClientMarkedAbsent`, `RescheduleProposed`, `RescheduleAccepted`, `OnlinePaymentConfirmed`, `PaymentReceivedAtSalon`, `StaffBlockedForWalkIn`, `SalonPublished`, `SalonSuspended`. Jamais `*Created`, `*Updated`, `*Saved`.
- Objet immuable portant les **identifiants** utiles (dont `salonId`) et l'**instant** du fait ; aucune donnée personnelle superflue (pas de téléphone ni de nom de client).
- **`DomainEvent`** : synchrone dans la transaction (§5). **`IntegrationEvent`** : post-commit, livré au moins une fois → **consommateur idempotent** (`processed_events`). Le `type` d'un `IntegrationEvent` ne se renomme pas.
- **Subscribers** : dans `application/subscribers/`, une classe qui reçoit le **handler cible injecté** et lui délègue ; aucune logique métier ni écriture directe en repository.
- Tout nouvel événement est documenté dans `docs/events.md`.
- **Interdit par le PRD** : aucun événement ne déclenche de notification promotionnelle « un professionnel est libre » (F02, §14).

## 11. Périmètre salon (multi-tenant)

- Toute ressource de fonctionnement (prestation, intervenant, horaire, réservation, encaissement, abonnement) porte son `salonId` directement (BR-12).
- Une opération ne traverse jamais deux salons. Cas transverses légitimes, et seulement eux : le `User` (appartient à plusieurs salons), l'`Organization` (le propriétaire administre tous ses salons, mais chaque écriture vise un salon explicite), l'administration de la plateforme (rôles système).
- Les permissions s'évaluent **par salon** : un même utilisateur peut avoir des droits différents dans deux salons.

## Anti-patterns à refuser

- Règle métier dans un handler (`if` sur un snapshot), un contrôleur, un mapper, un subscriber.
- Handler qui publie l'événement à la place de l'agrégat.
- Handler d'un module qui appelle le handler d'un autre module, ou écrit dans ses repositories.
- Agrégat qui contient un autre agrégat en champ ; setter public ; tableau interne exposé mutable.
- Décorateur TypeORM ou NestJS dans `domain/` ; port de repository qui renvoie une entité TypeORM.
- Spécialité utilisée comme rôle de sécurité ; rôle système attribuable depuis un salon.
- Événement CRUD ; VO sans règle ; montant en `number` flottant ; `new Date()` dans le domaine.

## Checklist avant de valider

- [ ] Code en anglais, commentaires en français, terme pris dans le tableau §1 ?
- [ ] L'agrégat protège un invariant réel ; une règle qui demande d'autres instances est dans un service ?
- [ ] Une transaction = un agrégat, ou exception §5 justifiée et documentée ?
- [ ] Aucune règle métier dans le handler ; l'agrégat enregistre ses événements ?
- [ ] `domain/` pur (ni NestJS, ni TypeORM, ni `application/`, ni `infrastructure/`) ?
- [ ] VO porteurs de règle, auto-validés par erreur métier ?
- [ ] Événement = fait métier au passé, avec `salonId` et instant, documenté ; consommateur idempotent ?
- [ ] Subscriber dans `application/subscribers/`, handler injecté, sans logique ?
- [ ] Périmètre salon vérifié sur toute écriture ?
- [ ] Se combine avec les skills `tdd`, `hexagonal`, `nest-stack`, `clean-code`.
