# Mobile (`mobile/`, paquet `mobile`)

App **Expo / React Native universelle (iOS, Android et Web)** de GoMeCoiffer. Décisions D-061 (20/11/2026) et D-063 (21/11/2026). Pendant la transition, `frontend/` (Vite + React) reste intact ; toute la **logique non visuelle** vit dans `packages/client-core` (sans dépendance DOM ni React Native), tandis que `mobile/` porte les écrans universels, les routes Expo Router et les adaptateurs de plateforme (`.ts` natifs vs `.web.ts` navigateur).

## 1. Choix et versions (vérifiés le 21/11/2026)

| Brique | Choix | Notes |
|---|---|---|
| Framework | **Expo SDK 58** (`expo@58.0.26`, React Native **0.88.1**, React **19.3.1**) | même version de React (`19.3.1`) que `frontend/` et `client-core` : une seule dans le monorepo |
| Architecture RN | New Architecture | imposée par SDK 58 (`newArchEnabled` retiré de `ExpoConfig`) |
| React Compiler | activé | `experiments.reactCompiler: true` dans `app.config.ts` |
| Navigation | **Expo Router** (`expo-router@58.0.32`) | `expo-router/native-tabs` sur iOS/Android, replis `_layout.web.tsx` (`WebTabNav`) sur le web ; aucun import `@react-navigation/*` |
| Web universel | `react-native-web` + `react-dom@19.3.1`, `web.output: 'single'` | évite le défaut `'server'` de SDK 58 pour produire un bundle SPA statique (`expo export --platform web`) |
| État | **Redux Toolkit 2.14 + RTK Query** (depuis `client-core`) | gateways, slices, RBAC, format, i18n, purge cache à l'ouverture/changement/fermeture de session |
| UI native iOS / Android | **Expo UI** (`@expo/ui@58.0.29`), `NativeTabs`, `expo-symbols`, `expo-glass-effect`, `expo-haptics` | contrôles système natifs sur mobile |
| Système de design | **NativeWind v5** (`nativewind@5.0.0-rc.1` + `react-native-css@3.1.0-rc.1` + Tailwind CSS v4.3) | jetons GoMeCoiffer dans `global.css` (`#17213B` bleu nuit, `#D2603A` terre cuite, `#F6EFE6` ivoire) |
| Formulaires | `react-hook-form` + `zod` | schémas de `@gomecoiffer/contracts` |
| Stockage sécurisé | `expo-secure-store` (`WHEN_UNLOCKED_THIS_DEVICE_ONLY`) | jeton de session + `deviceToken` sur natif (UC-013) ; no-op sur web (cookies HttpOnly, jamais `localStorage`) |
| Temps réel | `react-native-sse` (natif) / `EventSource` (web) | `pollingInterval: 0`, watchdog heartbeat/EOF, `Authorization` + `x-client-channel: mobile`, fermeture en `background`, relecture à la reconnexion |
| Builds | **EAS** (`development` dev client / `preview` / `production`) | `mobile/eas.json` (`EXPO_PUBLIC_APP_ENV` explicite par profil) |
| Tests | logique : **Vitest** (`client-core`, 65 tests) ; écrans & adaptateurs : **jest-expo + RNTL** (181 tests) | exception nommée à « Vitest partout » (D-061) ; zéro `jest.mock` sur les modules applicatifs |

## 2. Monorepo

```
GoMeCoiffer/
├─ backend/                 # API NestJS (inchangé)
├─ frontend/                # web Vite (laissé intact jusqu'à parité Web)
├─ mobile/                  # app Expo universelle (iOS + Android + Web)
└─ packages/
   ├─ contracts/            # schémas Zod partagés avec l'API (inchangé)
   └─ client-core/          # logique partagée sans dépendance UI/plateforme
```

- `pnpm-workspace.yaml` inclut `mobile` et `packages/*` en dépendances isolées pnpm ; seul `@parcel/watcher: true` a été ajouté à `allowBuilds` pour Expo/Metro/Tailwind.
- Vérification de l'arbre (`pnpm why --depth=10 react` et `react-native`) : 1 seule version de React (`19.3.1`) et 1 seule de React Native (`0.88.1`).
- Metro (`metro.config.js`) utilise `withNativewind(getDefaultConfig(__dirname))` sans `watchFolders` ni `extraNodeModules`.

## 3. `packages/client-core` (`@gomecoiffer/client-core`)

Exports strictement séparés (`package.json`) :
- `.` : `store/` (`createCoreStore`, `appApi`, `purgeApiCache`, `invalidateAllReads`, `sessionExpired`, `selectExpiredSessionKind`), `http/` (`HttpClient`, `HttpError`, `parseApiEnvelope`, `assertSafeApiPath`, `encodePathSegment`, `toApiFailure`, `codeToMessage`, `resolveApiErrorMessage`), `storage/` (`TokenStorage`), `realtime/` (`RealtimeSource`, `createRealtimeClient`), `rbac/` (`sessionSlice`, `can`, `canAccessSalonSpace`, `hasSystemRole`, `resolveHomeTarget`), `format/`, `i18n/` (`t`, `fr`), et les 8 modules du lot 1 (`health`, `auth`, `salons` + `weeklySchedule`, `team`, `join-salon`, `roles` + `permissionDependencies`, `client-space`, `platform`).
- `./gateways` : adaptateurs `*HttpGateway` (importés **uniquement** dans `lib/store/dependencies/` de chaque app, vérifié par `pnpm arch`).
- `./testing` : `createTestStore`, les 8 `InMemory*Gateway`.

Règles `pnpm arch` (`dependency-cruiser`) : `client-core` n'importe jamais `react-dom`, `react-native`, `react-native-web`, `expo*`, `@expo/*`, `react-native-sse` ni aucune app.

## 4. Structure de `mobile/`

```
mobile/
├─ app.config.ts            # GoMeCoiffer, cm.gomecoiffer.app, web.output: 'single', reactCompiler: true, liens universels
├─ eas.json                 # profils development / preview / production (EXPO_PUBLIC_APP_ENV explicite)
├─ metro.config.js          # withNativewind(getDefaultConfig(__dirname))
├─ babel.config.js          # babel-preset-expo
├─ postcss.config.mjs       # @tailwindcss/postcss
├─ global.css               # Tailwind v4 + nativewind/theme + jetons GoMeCoiffer
├─ assets/images/           # icon, adaptive-icon, splash-icon, favicon (depuis brand/logo/)
└─ src/
   ├─ app/                  # Expo Router : routes uniquement
   │  ├─ _layout.tsx        # SafeAreaProvider, ThemeProvider, StoreProvider, SessionLifecycle, OfflineBanner, Stack
   │  ├─ index.tsx          # redirection vers /(client)/(tabs)
   │  ├─ (auth)/            # connexion, inscription, mot-de-passe-oublie, rejoindre
   │  ├─ (client)/(tabs)/   # NativeTabs (_layout.tsx) + repli Web (_layout.web.tsx) : index, reservations, profil
   │  ├─ (client)/salon/[salonId].tsx
   │  ├─ (salon)/_layout.tsx            # garde session STAFF (canAccessSalonSpace, D-055) + Stack écrans salon
   │  ├─ (salon)/           # creer-organisation, choisir-salon, ajouter-salon, roles, horaires
   │  ├─ (salon)/(tabs)/    # NativeTabs (_layout.tsx) + repli Web (_layout.web.tsx) + RequireActiveSalonNotice : index, rendez-vous, equipe, plus
   │  ├─ (admin)/           # _layout.tsx (garde RequireSystemRole) + index (PlatformAdminsView)
   │  ├─ reprogrammation/[token].tsx
   │  └─ +not-found.tsx
   ├─ modules/              # modules lot 1 : health, auth, client-space, join-salon, salons, roles, team, platform
   ├─ components/           # ui/ (Button, Card, ThemedText, Skeleton, TextField, CheckboxField, SelectField, SwitchRow, SegmentedTabs, Badge, InlineAlert, SafeAreaView), feedback/, forms/ (FieldHint, PhoneField, OtpCodeField), navigation/ (WebTabNav, RequirePermission, RequireSystemRole)
   └─ lib/
      ├─ config/env.ts      # validation URL API (HTTPS obligatoire hors dev local, défaut 'production' hors __DEV__/test)
      ├─ navigation/home-route.ts
      ├─ storage/           # createTokenStorage.ts (SecureStore WHEN_UNLOCKED_THIS_DEVICE_ONLY) / .web.ts (no-op) / InMemoryTokenStorage.ts
      ├─ http/              # sessionPaths.ts, MobileHttpClient.ts (Bearer + x-client-channel + mutex + anti-course 401), WebHttpClient.ts (cookies + CSRF D-039 + epoch), createHttpClient(.web).ts
      ├─ realtime/          # createRealtimeSource.ts (react-native-sse, pollingInterval: 0, heartbeat/EOF, AppState) / .web.ts (EventSource + CLOSED)
      ├─ platform/          # setupPlatformListeners.ts (AppState + NetInfo) / .web.ts (window focus/online)
      ├─ store/             # dependencies/dependencies.ts, createMobileStore.ts, StoreProvider.tsx, SessionLifecycle.tsx, hooks.ts
      └─ ui/cn.ts
```

## 5. Règles

- **Mêmes espaces que le web** (D-055) : une app, deux espaces (client et salon) plus l'authentification ; la session `CLIENT` n'ouvre que l'espace client.
- **Mêmes chemins que le web** pour les liens partagés (`/rejoindre`, `/reprogrammation/:token`) : liens universels dans `app.config.ts`.
- **Séparation stricte des canaux (UC-013, D-004, D-063)** : natif = `MobileHttpClient` (`credentials: 'omit'`, `redirect: 'error'`, `x-client-channel: mobile`, `Authorization: Bearer`, `x-device-token` limité à `/api/public/auth/sign-in`, coffre `expo-secure-store` `WHEN_UNLOCKED_THIS_DEVICE_ONLY`) ; web = `WebHttpClient` (`credentials: 'include'`, `x-csrf-token`, aucun jeton en stockage client).
- **Rendu natif d'abord** : `NativeTabs` sur iOS/Android et replis `_layout.web.tsx` sur navigateur ; cibles ≥ 44 pt (`min-h-11`), zones sûres, haptique légère sur mobile.
- **Réseau mobile camerounais** : bandeau `OfflineBanner`, relecture au retour du réseau et au premier plan, pas de double envoi (`Button` `loading`).
- **Guidage, i18n, FCFA, fuseau du salon** : depuis `@gomecoiffer/client-core`.

## 6. Commandes

```bash
pnpm --filter @gomecoiffer/client-core test   # Vitest (logique partagée)
pnpm --filter mobile start                   # Metro (iOS / Android / Web)
pnpm --filter mobile test                    # jest-expo (écrans & adaptateurs)
pnpm --filter mobile typecheck               # tsc --noEmit
pnpm --filter mobile build:web               # expo export --platform web
```

## 7. Skills et agent

- Projet : skill **`mobile-stack`** (`.claude/skills/mobile-stack/`) et agent **`mobile-builder`** (`.claude/agents/mobile-builder.md`).
- Skills externes installés dans `.claude/skills/` (`skills-lock.json`) :
  - `expo/skills` : `expo-overview`, `expo-project-structure`, `expo-router`, `expo-ui`, `expo-native-ui`, `expo-design-system`, `expo-data-fetching`, `expo-dev-client`, `eas-app-stores`, `eas-update` ;
  - `callstackincubator/agent-skills` : `react-native-best-practices`.

## 8. Reste à décider / à faire (voir `docs/BACKLOG.md`)

- **Socle & écrans du lot 1 (`packages/client-core` + `mobile/`)** : livrés le 21/11/2026 (`auth`, `client-space`, `join-salon`, `salons`, `roles`, `team`, `platform`, `SessionLifecycle` SSE, tests unitaires/écrans et export Web verts ; remédiation sécurité validée par `security-reviewer`).
- **UC-013 (backend + contrats, bloquant C-1 natif)** : adapter `packages/contracts` (`sessionToken`, `deviceToken?`, `csrfToken` web) et implémenter la variante `BEARER` côté API (`x-client-channel: mobile`, `x-device-token`, CORS, `noStorePrivateRoutes`, `data: 'ping'` sur `event: heartbeat`) avant toute connexion réelle sur iOS/Android.
- **UC-014 (spécification + backend, bloquant C-2 natif)** : rédiger puis implémenter l'inscription, le mot de passe oublié et `/rejoindre` sans cookie `__Host-gmc.join` pour l'application native.
- **Identifiants & domaine** : valider `cm.gomecoiffer.app`, le domaine des liens universels (`gomecoiffer.cm` en placeholder) et les comptes Apple Developer / Google Play.
- **Simulateurs & UI native avancée** : effectuer les captures visuelles iOS et Android dès qu'un simulateur Xcode / émulateur Android est lancé, puis adopter `@expo/ui` sur les prochains lots si pertinent.
- **Bascule Web** : une fois la parité Web atteinte sur `mobile/`, valider la suppression de `frontend/`.
