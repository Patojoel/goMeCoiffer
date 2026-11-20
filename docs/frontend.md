# Frontend (`frontend/`, paquet `web`)

SPA Vite + React 19 (React Compiler via `@vitejs/plugin-react` `compiler: true`), Redux Toolkit + RTK Query,
Tailwind v4 + shadcn/ui, **mobile-first**. Référence d'architecture : `CLAUDE.md` §II ; idiomes : skill `front-stack` ;
structure interne d'un module, liste des modules et routes : `docs/frontend-modules.md`.

Organisation reprise du frontend de vossou (`CrinaProjet/vossou/frontend`), adaptée à la stack de GoMeCoiffer :
SSE (pas STOMP), lectures RTK Query, contrats Zod partagés, pas de persistance globale (décision D-060).

## Structure de `frontend/src/`

```
src/
├─ main.tsx                      # composition : HttpClient, dépendances, store, temps réel, router
├─ index.css                     # Tailwind v4 + jetons de thème
├─ app/
│  ├─ router/
│  │  ├─ router.tsx              # assemble les routeurs des modules dans 5 espaces paresseux
│  │  ├─ routes.ts               # URL racines des espaces (constantes)
│  │  ├─ ResolveHomeRoute.ts     # étape suivante après connexion (D-027) → bon espace
│  │  ├─ ErrorBoundaryView.tsx
│  │  └─ NotFoundPage.tsx
│  └─ layouts/
│     ├─ MarketplaceLayout.tsx   # public : /
│     ├─ AuthLayout.tsx          # /connexion, /inscription, /mot-de-passe-oublie, /rejoindre
│     ├─ SalonLayout.tsx         # /salon/* : salon actif, sélecteur de salon, navigation filtrée par permission
│     ├─ ClientLayout.tsx        # /mon-espace/* : espace client (D-055)
│     └─ AdminLayout.tsx         # /admin/* : rôles système
├─ components/
│  ├─ ui/                        # shadcn/ui (button, card, input, dialog, sheet, select, skeleton, toast…)
│  ├─ forms/                     # PhoneField (format camerounais), PasswordField, OtpField, FieldHint (aria-describedby)
│  ├─ feedback/                  # EmptyState, ErrorState (« Réessayer »), LoadingButton, PageSkeleton
│  ├─ navigation/                # BottomNav mobile, SalonSwitcher, BackLink
│  └─ AppShell.tsx
├─ lib/
│  ├─ http/                      # HttpClient : cookies, CSRF, déballage ApiResponse, 401 → purge + /connexion, 403 typé ; HttpError
│  ├─ store/
│  │  ├─ store.ts  reducer.ts  hooks.ts  createAppAsyncThunk.ts
│  │  ├─ actions/                # actions transverses (remise à zéro de l'état lié au salon)
│  │  ├─ api/                    # appApi.ts (UNE api RTK Query, fakeBaseQuery), fromGateway, API_TAGS, purgeApiCache
│  │  ├─ dependencies/           # AppDependencies + createDependencies : SEUL endroit qui importe un *HttpGateway
│  │  ├─ listeners/              # listenerMiddleware ; purge du cache à sessionCleared / activeSalonChanged
│  │  └─ testing/                # createTestStore (gateways fakes, « unprovided » explicite)
│  ├─ realtime/                  # un EventSource, onRealtimeEvent(type), schémas, reconnexion → invalidation totale
│  ├─ rbac/                      # sessionSlice (sessionStarted, activeSalonChanged, sessionCleared),
│  │                             # <RequirePermission>, <RequireSystemRole>, <RequireStaffSession>, can()
│  ├─ i18n/
│  │  ├─ i18n.ts                 # t() typé, type Dictionary
│  │  ├─ fr.ts  en.ts            # agrègent les fichiers de lang/
│  │  └─ lang/                   # <module>.fr.ts (+ <module>.en.ts) : auth, team, booking…
│  ├─ format/                    # formatXaf, formatTimeInZone, formatPhone
│  └─ utils.ts                   # cn()
├─ shared/
│  ├─ hooks/                     # useActiveSalon, useSubmitOnce, useOnline
│  ├─ errors/                    # codeToMessage : code 422/409 de l'API → clé i18n
│  └─ test-utils/                # renderWithProviders, builders (session, salon, membre), handlers MSW communs
└─ modules/<module>/             # un module par domaine fonctionnel (liste : docs/frontend-modules.md)
```

Module de référence actuel : `modules/health/`. Le premier module complet du lot 1 (`auth`) deviendra le modèle.

## Règles

- **Lectures** : RTK Query, `injectEndpoints` + `queryFn: fromGateway((deps) => deps.<gateway>.<méthode>())` +
  `providesTags`. Écran : erreur, puis chargement (skeleton), puis vide, puis données.
- **Écritures** : thunk `createAppAsyncThunk` (`<Cas>Async.ts`, gateways via `extra`) qui invalide les tags concernés.
  Pas de wrapper `apiMiddleware` : `HttpClient` traite 401 et 403.
- **Types** : `Command` et `Response` sont des `z.infer` des schémas de `@gomecoiffer/contracts`, jamais réécrits à la
  main. Formulaires `react-hook-form` + `zod` sur ces schémas, étendus pour l'UI dans `infra/validators/`.
- **DI** : jamais d'import d'un `*HttpGateway` hors de `lib/store/dependencies/` (`pnpm arch` le vérifie).
- **État** : un `slice/` seulement pour un état local (étape d'un parcours, brouillon, sélection) ; les listes
  viennent de RTK Query, pas d'un `EntityAdapter`. **Pas de redux-persist global** : seuls les slices listés en
  `whitelist` sont persistés, jamais le cache RTK Query.
- **Cache** : vidé à la déconnexion (`sessionCleared`) et au changement de salon actif (`activeSalonChanged`) par un
  listener du store, avec l'état des slices liés au salon (`actions/`).
- **Routage** : chaque module expose `infra/router/<Module>Routes.ts` (URL) et `<Module>Router.tsx`
  (`(store) => RouteObject[]`, routes paresseuses, gardes) ; `app/router/router.tsx` ne fait qu'assembler.
- **RBAC** : `<RequirePermission code="staff:invite">` sur le salon actif, même code que le `@RequiresPermission` du
  backend ; `<RequireSystemRole>` sur `/admin/*` ; `<RequireStaffSession>` hors de l'espace client (D-055). Confort
  UX : le backend refuse seul.
- **i18n** : aucun texte en dur ; un fichier par module dans `lib/i18n/lang/`, agrégé dans `fr.ts` (et `en.ts`).
  Les `code` stables des 422/409 passent par `shared/errors/codeToMessage`.
- **Temps réel** : `realtime.onRealtimeEvent(type, handler)` ; la reconnexion invalide toutes les lectures.
- **Heures et montants** : fuseau du salon (fourni par l'API), FCFA entiers (`formatXaf`).
- **Mobile-first** : conçu à 390 px, cibles tactiles >= 44 px (`min-h-11`), aucun débordement horizontal ; pas de
  tableau large sur mobile.
- **Guidage** (`CLAUDE.md`) : `FieldHint` sous chaque choix non évident ; `EmptyState` / `ErrorState` qui disent
  pourquoi et quoi faire.

## Tests

Vitest + jsdom + Testing Library, sans `vi.mock` : gateways fakes injectés par `createTestStore`, HTTP de l'adapter
via MSW (`msw/node`), faux `EventSource` via la fabrique injectable.

- Un dossier `__tests__/` par module : `fakes/InMemory<Module>Gateway.ts`, `render<Module>.tsx` (store de test +
  router mémoire), tests nommés par **règle métier** (`invitingACollaborator.test.tsx`), jamais par fichier.
- La logique (thunk, slice, listener, hook) se teste d'abord avec le gateway fake ; l'écran par ce que voit
  l'utilisateur (textes, rôles ARIA), pas par sa structure.
- Socle (`lib/`) : tests à côté du fichier, comme aujourd'hui.

```bash
pnpm --filter web test <chemin>    # un fichier ou un motif
pnpm --filter web test:all         # tout, une fois
pnpm --filter web typecheck && pnpm --filter web build
```

## Ajouter un module

Checklist : `docs/checklists.md` § Nouveau module frontend ; structure interne : `docs/frontend-modules.md`.
