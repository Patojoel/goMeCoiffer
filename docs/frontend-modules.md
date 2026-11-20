# Modules frontend — référence

Document détaillé référencé depuis `CLAUDE.md` §II et `docs/frontend.md` : liste des modules, structure interne
d'un module, routes par espace. Modèle repris de vossou (`docs/frontend-modules.md` de ce projet), adapté (D-060).

## Liste des modules

| Module front | Backend | Use cases / lot | Espace(s) |
|---|---|---|---|
| `health` | socle | lot 0 (module de référence du socle) | — |
| `auth` | `identity` | UC-001 inscription, UC-002 connexion / déconnexion, UC-003 mot de passe oublié, résumé de session | auth |
| `salons` | `organizations` | UC-004 créer son organisation, UC-005 choisir / changer de salon, UC-010 ajouter un salon ; paramètres du salon (lots 2-3) | salon |
| `team` | `organizations` | UC-006 inviter, UC-011 gérer l'équipe | salon |
| `join-salon` | `identity` + `organizations` | UC-007 rejoindre un salon | auth |
| `roles` | `organizations` | UC-008 rôles et permissions (onboarding étape 6) | salon |
| `client-space` | `identity` (+ `booking`) | UC-009 espace client ; « Mes réservations » (lot 4) | client |
| `platform` | `platform` | UC-012 rôles système ; supervision (lot 7) | admin |
| `catalog` | `catalog` | lot 2 : prestations | salon |
| `staff` | `staff` | lot 2 : intervenants, spécialités, horaires, indisponibilités | salon |
| `marketplace` | lectures `booking` + `organizations` | lot 3 : recherche, fiche salon, disponibilités (F01, F02, flux SSE public) | marketplace |
| `booking` | `booking` | lot 4 : parcours de réservation client | marketplace |
| `planning` | `booking` | lot 4 : planning et rendez-vous du salon | salon |
| `payments` | `payments` | lot 5 : paiement en ligne, encaissement au salon | marketplace, salon |
| `reschedule` | `booking` | lot 6 : proposition et acceptation de reprogrammation | salon, marketplace |
| `subscriptions` | `subscriptions` | lot 7 : abonnements SaaS | salon, admin |
| `dashboard` | lectures | lot 8 : tableau de bord du salon | salon |
| `reviews` | `reviews` | lot 9 : avis et notes (F09) | marketplace, client, salon, admin |

Noms de dossiers en kebab-case ; un module front peut consommer plusieurs modules backend, mais un use case n'a
qu'un module front propriétaire.

## Structure interne d'un module

Exemple : `team`.

```
modules/team/
├─ models/
│  ├─ gateway/TeamGateway.ts                 # port : une méthode par endpoint consommé
│  ├─ teamMember.ts  invitation.ts           # entités (types repris de @gomecoiffer/contracts)
│  └─ teamAccess.ts                          # règles d'affichage pures (peut-on retirer ce membre ?)
├─ usecases/
│  ├─ invite-collaborator/
│  │  ├─ InviteCollaboratorAsync.ts          # thunk createAppAsyncThunk ; invalide les tags concernés
│  │  ├─ InviteCollaboratorCommand.ts        # = z.infer<typeof InviteCollaboratorSchema>
│  │  └─ InviteCollaboratorResponse.ts       # = z.infer<typeof CollaboratorInvitedSchema>
│  ├─ cancel-invitation/
│  ├─ change-collaborator-role/
│  └─ remove-collaborator/
├─ slice/                                    # seulement s'il y a un état local
│  ├─ teamSlice.ts
│  └─ TeamSelector.ts                        # sélecteurs en méthodes statiques
├─ listeners/
│  └─ ListenWhenCollaboratorRemoved.ts       # effets (listenerMiddleware)
├─ infra/
│  ├─ api-routes/TeamApiRoutes.ts            # URL des endpoints backend
│  ├─ repo/TeamHttpGateway.ts                # adapter sur HttpClient, réponse validée par le schéma du contrat
│  ├─ api/teamApi.ts                         # lectures RTK Query (injectEndpoints, providesTags)
│  ├─ validators/inviteCollaboratorForm.ts   # schéma du contrat étendu pour l'UI
│  ├─ router/
│  │  ├─ TeamRoutes.ts                       # URL front : /salon/equipe, /salon/equipe/inviter…
│  │  └─ TeamRouter.tsx                      # TeamRouter(store) → RouteObject[] paresseux + gardes
│  └─ ui/
│     ├─ team-list/      TeamListView.tsx  useTeamList.ts  components/
│     ├─ invite/         InviteCollaboratorSheet.tsx  useInviteCollaborator.ts  ShareOnWhatsApp.tsx
│     └─ invitations/    InvitationsView.tsx  useInvitations.ts
└─ __tests__/
   ├─ fakes/InMemoryTeamGateway.ts
   ├─ renderTeam.tsx                         # rendu avec store de test + router mémoire
   ├─ invitingACollaborator.test.tsx         # un fichier par règle ou parcours, nommé en langage métier
   └─ removingACollaborator.test.tsx
```

Rôle de chaque couche :

| Couche | Contient | N'importe jamais |
|---|---|---|
| `models/` | port, entités, règles d'affichage pures | React, Redux, `infra/` |
| `usecases/` | thunks `<Cas>Async` + `Command` + `Response` | un `*HttpGateway`, React |
| `slice/`, `listeners/` | état local, sélecteurs, effets | un `*HttpGateway` |
| `infra/repo/` | adapter HTTP sur `HttpClient` | Redux, React |
| `infra/api/` | endpoints RTK Query via `fromGateway` | un `*HttpGateway` |
| `infra/ui/` | composants + hook `use*` par fonctionnalité | un gateway (passe par RTK Query ou un thunk) |
| `infra/router/` | routes du module, gardes, `lazy` | — |

Différences avec vossou, assumées (D-060) : lectures RTK Query (pas de slice `EntityAdapter` par liste) ; `Command`
et `Response` tirés des contrats ; pas d'`apiMiddleware` (`HttpClient` gère 401/403) ; RBAC par code de permission
du salon actif (pas `APP_RESOURCE` × CRUD) ; temps réel SSE (pas STOMP) ; pas de persistance globale.

## Exemple de thunk

```ts
// modules/team/usecases/invite-collaborator/InviteCollaboratorAsync.ts
export const InviteCollaboratorAsync = createAppAsyncThunk<InviteCollaboratorResponse, InviteCollaboratorCommand>(
  'team/invite-collaborator',
  async (command, { extra: { team }, dispatch, rejectWithValue }) => {
    try {
      const invited = await team.inviteCollaborator(command);
      dispatch(appApi.util.invalidateTags([{ type: 'Invitation', id: 'LIST' }]));
      return invited;
    } catch (error) {
      return rejectWithValue(toApiFailure(error)); // code 422/409 stable → message i18n dans l'écran
    }
  },
);
```

## Routes par espace

| Espace | Préfixe | Layout | Garde | Modules |
|---|---|---|---|---|
| Marketplace | `/` | `MarketplaceLayout` | aucune | `marketplace`, `booking`, `payments` ; `/reprogrammation/:token` (`reschedule`) |
| Authentification | `/connexion`, `/inscription`, `/mot-de-passe-oublie`, `/rejoindre` | `AuthLayout` | aucune | `auth`, `join-salon` |
| Back-office | `/salon/*` | `SalonLayout` | session STAFF + salon actif ; `<RequirePermission>` par écran | `salons` (`/salon/creer`, `/salon/choisir`, paramètres, ajout), `dashboard`, `planning`, `catalog`, `staff`, `team`, `roles`, `reviews`, `subscriptions` |
| Espace client | `/mon-espace/*` | `ClientLayout` | session CLIENT ou STAFF | `client-space`, `reviews` |
| Administration | `/admin/*` | `AdminLayout` | `<RequireSystemRole>` | `platform`, `subscriptions`, `reviews` (avis signalés) |

Après la connexion, `app/router/ResolveHomeRoute.ts` suit l'étape suivante du résumé de session (D-027) : créer
l'organisation, ouvrir ou choisir un salon, administration.

## Listeners et temps réel

- `listeners/ListenWhen<Fait>.ts` : `listenerMiddleware.startListening` sur une action du module ; démarrés au
  montage du store (pas dans un composant).
- Temps réel : chaque module déclare ses abonnements (`onRealtimeEvent('<type>', …)`) qui invalident ses tags ; la
  charge est validée par un schéma Zod, un type inconnu est ignoré.

## i18n

```
lib/i18n/
├─ i18n.ts                # t() typé, type Dictionary
├─ fr.ts                  # agrège lang/*.fr.ts
├─ en.ts                  # agrège lang/*.en.ts (2e langue à confirmer, BACKLOG)
└─ lang/
   ├─ common.fr.ts
   ├─ auth.fr.ts
   ├─ team.fr.ts
   └─ …
```
