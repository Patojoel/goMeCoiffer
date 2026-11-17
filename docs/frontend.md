# Frontend (`frontend/`, paquet `web`)

SPA Vite + React 19 (React Compiler via `@vitejs/plugin-react` `compiler: true`), Redux Toolkit + RTK Query, Tailwind v4, mobile-first. Référence d'architecture : `CLAUDE.md` §II ; idiomes : skill `front-stack`.

## Structure

```
frontend/src/
  main.tsx             # racine de composition : HttpClient, store, 401 -> purge + connexion
  app/                 # router (3 espaces paresseux), layouts/, pages/
  components/          # transverses (AppShell) ; ui/ = shadcn (button, card, skeleton)
  lib/http/            # HttpClient : cookies, CSRF, déballage ApiResponse, HttpError, onUnauthorized
  lib/store/           # store.ts, reducer.ts, createAppAsyncThunk, hooks, testing/createTestStore
    api/appApi.ts      # UNE api RTK Query (fakeBaseQuery) ; fromGateway(), API_TAGS, purgeApiCache, invalidateAllReads
    dependencies/      # AppDependencies (type) + createDependencies : seul endroit qui importe un *HttpGateway
  lib/realtime/        # createRealtime (un EventSource, routage par type), createStoreRealtime
  lib/i18n/            # fr.ts (dictionnaire) + t() typé
  lib/format/          # formatXaf, formatTimeInZone
  lib/rbac/            # sessionSlice, <RequirePermission>, <RequireSystemRole>
  modules/<module>/    # models/gateway, usecases/, slice/, listeners/, infra/{repo,api,validators,ui}
```

Module de référence : `modules/health/` (port, adapter HTTP, endpoint RTK Query, hook `useApiHealth`, composant `HealthStatus`).

## Conventions

- Lectures : RTK Query, `injectEndpoints` + `queryFn: fromGateway((deps) => deps.<gateway>.<méthode>())` + `providesTags`. Écran : erreur, puis chargement (skeleton), puis vide, puis données.
- Écritures : thunk `createAppAsyncThunk` (gateways via `extra`) qui invalide les tags concernés.
- Jamais d'import d'un `*HttpGateway` hors de `lib/store/dependencies/` (`pnpm arch` le vérifie).
- Aucun texte en dur : clés dans `lib/i18n/fr.ts`, `t('cle')`. Une 2e langue = un dictionnaire de type `Dictionary` dans `i18n.ts`.
- Cache RTK Query jamais persisté ; vidé à la déconnexion (`sessionCleared`) et au changement de salon actif (`activeSalonChanged`) par un listener du store.
- Temps réel : `realtime.onRealtimeEvent(type, handler)` ; la reconnexion invalide toutes les lectures.
- Cibles tactiles >= 44 px (`min-h-11`), conçu à 390 px, aucun débordement horizontal.

## Tests

Vitest + jsdom, sans `vi.mock` : HTTP via MSW (`msw/node`), gateways fakes injectés par `createTestStore({ health: fake })`, faux `EventSource` via la fabrique injectable.

```bash
pnpm --filter web test <chemin>    # un fichier ou un motif
pnpm --filter web test:all         # tout, une fois
pnpm --filter web typecheck && pnpm --filter web build
```

## Ajouter un module

1. Port : `modules/<m>/models/gateway/<M>Gateway.ts` (+ types d'entités ; types des réponses repris de `@gomecoiffer/contracts`).
2. Adapter : `modules/<m>/infra/repo/<M>HttpGateway.ts` sur `HttpClient`, avec le schéma de contrat.
3. DI : ajouter le gateway à `AppDependencies` et `createDependencies`, et un échec explicite dans `createTestStore` (`unprovided`).
4. Lecture : `infra/api/<m>Api.ts` (`injectEndpoints`, tags) ; ajouter le tag à `API_TAGS`.
5. Écriture : `usecases/<cas>/` (thunk + Command + Response) ; invalider les tags modifiés.
6. UI : `infra/ui/` (composant + hook `use*`), textes dans `fr.ts`, garde `<RequirePermission>` si sensible, aide de guidage sous les choix non évidents.
7. Tests d'abord (gateway fake), puis `pnpm --filter web test <module>`.
