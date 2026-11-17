---
name: security
description: Invariants de sécurité de GoMeCoiffer (SaaS multi-salons + marketplace publique, NestJS session-cookie + React, paiements Mobile Money). À charger avant d'écrire ou relire du code touchant l'authentification, l'OTP ou les liens de réservation, l'autorisation (permissions salon, rôles système, droits protégés du propriétaire), l'isolation entre salons, une route publique, un webhook de paiement, le CSRF, les données personnelles des clients, le SSE ou du SQL. Complète ddd/hexagonal côté robustesse, pas architecture.
---

# Sécurité — invariants GoMeCoiffer

> Règle d'or : **ne jamais faire confiance à une entrée client**, ni à un webhook non vérifié.
> Données manipulées : téléphones et noms de clients, données financières des salons, droits des collaborateurs.

## Isolation entre salons (risque n°1)

- Toute ressource de fonctionnement appartient à un **salon** (`salonId`, BR-12). Avant toute lecture/écriture, vérifier que la ressource appartient **au salon actif de la session** — pas seulement qu'elle existe.
- **IDOR** : un `bookingId`, `staffId`, `serviceId`, `paymentId` reçu dans l'URL ou le body ne prouve rien. Charger la ressource **filtrée par `salonId`** (repository `getOfSalon`, SQL `WHERE salon_id = ${salonId}`). Une ressource d'un autre salon répond **404**, comme si elle n'existait pas.
- Le salon actif vient de la **session** ; le changer (`POST /api/salon/session/active-salon`) vérifie l'appartenance (ou la propriété via l'organisation) et régénère le contexte d'autorisation.
- Les données financières restent isolées par salon (PRD §3), même pour un propriétaire multi-salons : chaque lecture vise un salon explicite.

## Autorisation

- **Identité résolue côté serveur** (session → CLS), jamais un `userId`/`salonId` venu du client.
- **Deux mondes séparés** : rôles système (`/api/admin/*`, `@RequiresSystemRole`) et permissions salon (`/api/salon/*`, `@RequiresPermission`). Un utilisateur de salon ne peut jamais obtenir ni s'attribuer un rôle système ; aucun écran salon ne liste ni ne modifie les rôles système.
- **Permissions par salon** (PRD §6) : évaluées sur le salon actif à chaque requête, effet immédiat après modification (pas de cache de droits non invalidé).
- **Droits protégés du propriétaire** : aucun administrateur de salon ne peut retirer les droits essentiels du propriétaire, ni s'attribuer les siens, ni modifier facturation SaaS ou destination des fonds. Règle dans le domaine **et** testée en table de cas.
- **« Voir les siennes » vs « voir toutes »** : un coiffeur avec `bookings:read-own` ne lit que les rendez-vous où il est le professionnel ; le filtre est dans le SQL, pas dans l'écran.
- **BR-11** : un collaborateur ne voit que les informations nécessaires à ses permissions (le téléphone d'un client seulement si son rendez-vous le requiert).
- Front : les gardes de route et le masquage de boutons sont du **confort UX**, pas une protection — le back refuse seul.
- Codes HTTP : **401** = pas de session valide (le front déconnecte), **403** = droit insuffisant (le front masque), **404** = ressource absente ou hors périmètre.

## Authentification, OTP, liens sécurisés

- Mots de passe (si retenus, voir `docs/DECISIONS.md`) : `argon2id`, jamais en clair ni loggés. Réinitialisation et invitation : jeton aléatoire ≥ 32 octets, stocké **haché** (SHA-256), expirable, à usage unique, réponse identique que le compte existe ou non.
- **OTP SMS** (vérification du numéro client) : code haché avec `OTP_PEPPER`, durée de vie courte (5 min), 5 essais maximum, limitation par numéro et par IP, renvoi limité ; message d'erreur qui ne révèle pas si le numéro a des réservations.
- **Lien sécurisé de réservation / de proposition de reprogrammation** (F03, F06) : jeton opaque aléatoire stocké haché, lié à **une** réservation, expirable (validité de la proposition), révocable ; le lien ne donne que les actions prévues (voir, accepter, refuser, reprogrammer) ; jamais d'id de réservation seul dans l'URL ; pas de donnée personnelle dans l'URL ni dans le message WhatsApp prérempli au-delà du nécessaire.
- Session : cookie `HttpOnly`, `SameSite=Lax`, `Secure` hors local ; id régénéré à la connexion ; expiration glissante bornée ; déconnexion qui détruit la session côté serveur.

## Session, CSRF, CORS, en-têtes

- **CSRF actif** sur toutes les écritures, routes publiques de réservation comprises. Seule exception : `/api/webhooks/*`, protégé par signature.
- Route publique → `@Public()` explicite, justifiée, sous `/api/public/*` ; jamais d'ouverture large.
- CORS en **allowlist** (`WEB_ORIGIN`) ; jamais `*` avec credentials. `helmet` actif.
- Limitation de débit (`@nestjs/throttler`) : connexion, OTP, création de réservation publique, recherche marketplace, webhooks.

## Paiements (Mobile Money)

- **Aucun code secret Mobile Money** saisi, stocké, transmis ou loggé par la plateforme (PRD F04) : le client valide sur son téléphone auprès de l'opérateur.
- Un paiement n'est **confirmé** que par le serveur : webhook à **signature vérifiée** (HMAC, comparaison à temps constant, horodatage borné contre le rejeu) **puis** relecture du statut auprès de l'agrégateur. Jamais sur une redirection ou un retour du navigateur.
- Référence de transaction **unique en base** (contrainte d'unicité) ; webhook **idempotent** (rejouer le même événement ne confirme pas deux fois).
- Montant vérifié contre la réservation (pas de confiance au montant du webhook seul) ; devise XAF.
- Paiement tardif sur créneau perdu → `PaymentIncident`, jamais une réservation inventée (BR-06). Remboursement : jamais automatique sur annulation (BR-10).
- Déclaration d'un encaissement au salon : permission `finance:record-payment`, trace d'audit (qui, quand, montant), pas de modification silencieuse.
- Identifiants marchands d'un salon (si stockés) : chiffrés au repos (AES-256-GCM, `APP_ENCRYPTION_KEY`), jamais renvoyés en clair à l'API.

## Données personnelles

- Collecte minimale (PRD §12) : téléphone obligatoire, nom facultatif ou minimal, e-mail facultatif.
- Réponses API : projection minimale (pas de hash, jeton, id de session, données d'un autre salon). Marketplace publique : **aucune** donnée de client ni de réservation.
- Erreurs : message métier générique au client, détail technique dans les logs seulement.
- Pas de donnée personnelle ni de jeton dans une URL de log, un message SSE, un événement ou une trace.

## Secrets & config

- Aucun secret dans le dépôt : `backend/.env` est gitignoré (hook de garde), `backend/.env.example` ne porte que des placeholders, prod/preprod lisent des variables d'environnement du serveur.
- Secrets forts, générés (`SESSION_SECRET` ≥ 64 octets, `APP_ENCRYPTION_KEY` 32 octets), différents par environnement, refusés au démarrage s'ils sont trop courts.
- Front : toute variable `VITE_*` est **publique** → jamais de secret.

## Injection & entrées

- SQL : gabarit `sql` à paramètres liés ou API TypeORM paramétrée, aucune concaténation (skill `sql-query`).
- Validation stricte des entrées (schémas Zod du contrat, clés inconnues refusées) ; ids en `ParseUUIDPipe`.
- Upload (photo du salon) : type vérifié par signature de fichier côté serveur, taille bornée, nom regénéré, jamais servi depuis un chemin fourni par le client.
- Aucun HTML riche rendu sans assainissement.

## Concurrence

- Double réservation : contrainte d'exclusion PostgreSQL + revalidation à la confirmation (BR-02, BR-04).
- Une seule proposition active par réservation : index unique partiel (F06).
- Consommateurs d'`IntegrationEvent`, tâches planifiées et webhooks : idempotents.

## SSE

- Flux privés : session authentifiée et origine vérifiées ; destinataires choisis par le serveur ; un client ne choisit jamais le salon ou l'utilisateur écouté.
- Flux public de disponibilités : identifiants d'intervenant et signal de changement seulement.

## Checklist avant de valider

- [ ] Ressource chargée filtrée par le salon actif (pas d'IDOR, 404 hors périmètre) ?
- [ ] Identité et salon actif lus en session ; permission ou rôle système vérifié côté serveur ?
- [ ] Droits protégés du propriétaire intouchables ; rôles système inaccessibles aux salons ?
- [ ] CSRF actif ; route publique justifiée ; débit limité sur les routes sensibles ?
- [ ] Paiement : signature + relecture serveur, référence unique, webhook idempotent, aucun secret stocké ?
- [ ] OTP / liens : hachés, expirables, usage borné, non énumérables ?
- [ ] Aucune donnée sensible dans une réponse, une erreur, un log, une URL ou un événement SSE ?
- [ ] SQL paramétré ; secrets hors dépôt ?
