---
name: front-stack
description: Idiomes du frontend GoMeCoiffer (React 19.2 + Vite 8 + Redux Toolkit 2 + RTK Query + TypeScript strict + Tailwind v4/shadcn, mobile-first). À charger avant d'écrire ou modifier du code dans frontend/src/ — module hexagonal, thunk/slice/listener, DI des gateways, HttpClient/CSRF, RTK Query et invalidation, SSE, formulaires rhf+zod avec schémas de packages/contracts, i18n, RBAC par salon, fuseau du salon et FCFA. Complète la partie front du skill hexagonal.
---

# Front-stack — React + Vite + Redux Toolkit (GoMeCoiffer)

> Réf : `CLAUDE.md` §II, `docs/frontend.md` (quand il existe), `docs/checklists.md` § Frontend.
> SPA Vite (pas de SSR, pas de `'use client'`). Routage `react-router`. **Mobile-first** : le client réserve depuis son téléphone.

## Trois espaces, une app
- `app/` porte trois layouts et arbres de routes **paresseux** : marketplace publique (`/`), back-office salon (`/salon/*`), administration plateforme (`/admin/*`).
- La marketplace ne charge jamais le code du back-office ni de l'admin (découpage par `lazy`).
- Le back-office affiche le **salon actif** et un sélecteur de salon pour les utilisateurs multi-salons ; changer de salon appelle l'API, puis vide le cache RTK Query et l'état dépendant du salon.

## Structure hexagonale par module (`src/modules/<module>/`)
- `models/` — types d'entités, **port** `models/gateway/<Module>Gateway.ts`.
- `usecases/<cas>/` — thunk `createAppAsyncThunk` + `Command` + `Response`.
- `slice/` — slice + selectors ; `listeners/` — effets (`listenerMiddleware`).
- `infra/` — `repo/<Module>HttpGateway.ts` (adapter sur `HttpClient`), `api/<module>Api.ts` (RTK Query `injectEndpoints`), `validators/`, `ui/<fonctionnalité>/` (composants + hook `use*`).

## Injection de dépendances (règle centrale)
- Conteneur typé `AppDependencies` instancié dans `lib/store/dependencies/` et passé en `extraArgument` (thunks) et au contexte des `queryFn`.
- Le thunk déstructure `{ extra: { <gateway> }, rejectWithValue }`.
- **Interdit** : importer un `*HttpGateway` dans un thunk, un slice, un endpoint ou un composant.

## HTTP
- Tous les adapters s'appuient sur `lib/http/HttpClient` (`credentials: 'include'`, en-tête CSRF, déballage d'`ApiResponse<T>`, 401 → purge du store + redirection connexion, 403 → erreur typée sans déconnexion). Ne pas réimplémenter `fetch`/CSRF.
- Base `VITE_API_BASE_URL` + `/api`. Espaces : `/api/public/*`, `/api/salon/*`, `/api/admin/*`.
- Erreurs typées depuis l'API : `code` stable d'un 422 (règle métier) et 409 (créneau pris) → message i18n dédié, jamais le `message` brut affiché tel quel si une traduction existe.

## Lectures : RTK Query
- Une seule `api` (`lib/store/api/appApi.ts`), endpoints par module avec `injectEndpoints`. Pas de `fetchBaseQuery` : `queryFn` qui appelle le gateway injecté.
- Étiquettes `providesTags` par type et id ; une commande (thunk) invalide ce qu'elle change (`api.util.invalidateTags`) ; un événement SSE invalide les tags concernés.
- Le cache est vidé au changement de salon actif et à la déconnexion ; il n'est **jamais** persisté.
- Écran : `isError` d'abord (un refus efface la donnée affichée), puis chargement, puis vide, puis données.

## Temps réel (SSE)
- Un seul `EventSource` (`lib/realtime/`), ouvert après connexion (flux privé) ou sur la fiche d'un salon (flux public de disponibilités).
- Routage par `type` (`onRealtimeEvent(type, handler)`), charge validée par schéma Zod ; événement inconnu ignoré.
- **À la reconnexion, invalider toutes les lectures affichées** (PRD : un événement manqué ne doit pas laisser un planning faux). Relecture de secours espacée (20-30 s) tant que le flux est coupé.

## Formulaires et validation
- `react-hook-form` + `zod` (`@hookform/resolvers`) ; schémas **importés de `@gomecoiffer/contracts`**, éventuellement étendus pour l'UI dans `infra/validators/`.
- Téléphone : saisie guidée au format camerounais, normalisé avant envoi.

## Dates, heures, montants
- Les heures s'affichent dans le **fuseau du salon** (fourni par l'API), jamais celui du navigateur ; les instants transitent en ISO UTC.
- Montants en FCFA entiers : `new Intl.NumberFormat('fr-CM', { style: 'currency', currency: 'XAF', maximumFractionDigits: 0 })`.

## UI
- **shadcn/ui** dans `components/ui/` (Radix + Tailwind v4 + `class-variance-authority` + `tailwind-merge`), icônes `lucide-react`.
- Réutilise `components/ui/` et `components/` avant de créer ; nouveau composant au bon niveau (transverse → `components/`, spécifique → `infra/ui/` du module).
- **Mobile-first** : conçu à 390 px puis élargi ; cibles tactiles ≥ 44 px ; pas de tableau large sur mobile (cartes ou liste) ; pas de débordement horizontal.
- **i18n obligatoire** : aucun texte en dur ; clés dans `lib/i18n/` pour chaque langue du projet (français par défaut ; anglais à confirmer, voir `docs/BACKLOG.md`).
- **RBAC** : écrans et actions sous garde de permission du **salon actif** (`<RequirePermission code="bookings:manage">`) — confort UX, le back refuse seul. Routes `/admin/*` sous garde de rôle système.
- **Guidage** (`CLAUDE.md`) : aide sous chaque choix non évident, états vides et refus qui disent pourquoi et quoi faire.
- Chaque vue interactive a son hook `use*.ts` qui porte la logique de présentation.

## États de chargement
| Situation | À faire |
|---|---|
| Premier chargement d'un écran, liste, fiche | `Skeleton` à la forme du contenu |
| Relecture, filtre, page déjà vue | garder les données affichées, indicateur discret (`aria-busy`) |
| Bouton d'action (réserver, confirmer, enregistrer) | bouton `loading` (spinner, désactivé, `aria-busy`) ; pas de double envoi |
| Paiement en ligne en attente de validation sur le téléphone | écran d'attente dédié avec le temps restant (10 min) et la conduite à tenir |
| Erreur | état d'erreur avec « Réessayer » ; état vide seulement une fois la lecture finie |

## Validation
`pnpm --filter web test <chemin>` (logique), `pnpm --filter web lint`, `pnpm --filter web build` (inclut `tsc -b`).

## Checklist avant de valider
- [ ] Fichiers dans la bonne couche (models/usecases/slice/listeners/infra) ?
- [ ] Aucun `*HttpGateway` importé hors `lib/store/dependencies/` ?
- [ ] Lecture via RTK Query avec étiquettes ; commande via thunk qui invalide ce qu'elle change ?
- [ ] Schémas de `@gomecoiffer/contracts` réutilisés ?
- [ ] Textes via l'i18n ; garde de permission sur le salon actif si sensible ; aides de guidage présentes ?
- [ ] Heures dans le fuseau du salon, montants en FCFA entiers ?
- [ ] Rendu vérifié à 390 px sans débordement ?
- [ ] Logique couverte par un test Vitest avec gateway fake ; lint + build OK ?
