# Mobile (`mobile/`, paquet `mobile`)

App **Expo / React Native** de GoMeCoiffer, iOS et Android. Décision D-061 (20/11/2026). Le web reste l'app Vite
+ React de `frontend/` ; le mobile **partage avec lui toute la logique non visuelle** par le paquet
`packages/client-core`, pas les écrans.

## 1. Choix et versions (vérifiés le 20/11/2026)

| Brique | Choix | Notes |
|---|---|---|
| Framework | **Expo SDK 58** (React Native **0.88**, React **19.3**) | même version de React que le web : une seule dans le monorepo (obligatoire) |
| Architecture RN | New Architecture | toujours active, non désactivable depuis SDK 55 |
| React Compiler | activé | `experiments.reactCompiler: true` dans `app.config.ts` (pas activé par défaut) |
| Navigation | **Expo Router** (routes fichiers) | ne dépend plus de React Navigation depuis SDK 56 ; native tabs et data loaders stables en SDK 58 |
| État | **Redux Toolkit + RTK Query** (depuis `client-core`) | même code que le web : gateways, thunks, endpoints, slices, sélecteurs |
| UI native iOS / Android | **Expo UI** (`@expo/ui` : SwiftUI / Jetpack Compose), `NativeTabs` d'Expo Router, `expo-symbols` (SF Symbols), `expo-glass-effect` | rendu « Apple » : onglets Liquid Glass (iOS 26+), feuilles, menus, sélecteurs, listes |
| Système de design | **NativeWind v5** (Tailwind v4) + **React Native Reusables** | portage de shadcn/ui : mêmes jetons et mêmes composants de base que le web |
| Formulaires | `react-hook-form` + `zod` | schémas de `@gomecoiffer/contracts`, comme le web |
| Stockage sécurisé | `expo-secure-store` | jeton de session (UC-013) ; jamais AsyncStorage pour un secret |
| Temps réel | `react-native-sse` | en-tête `Authorization` ; même routage par `type` que le web |
| Builds | **EAS** (Build, Submit, Update) + dev client | Expo Go seulement pour essayer : les modules natifs exigent un dev client |
| Tests | logique : **Vitest** (dans `client-core`) ; écrans : **jest-expo + React Native Testing Library** | exception nommée à « Vitest partout » (D-061) |

Alternatives écartées ou en réserve : TanStack Query + Zustand (le défaut du marché, mais ne partage rien avec le web) ;
HeroUI Native, gluestack-ui, Tamagui (versions à vérifier sur leurs sites avant tout changement) ; react-native-web
pour remplacer le web (point faible sur un back-office dense, D-060 déjà en place).

## 2. Monorepo

```
GoMeCoiffer/
├─ backend/                 # API NestJS (inchangé)
├─ frontend/                # web : écrans React DOM + adaptateurs web
├─ mobile/                  # app Expo : écrans React Native + adaptateurs natifs
└─ packages/
   ├─ contracts/            # schémas Zod partagés avec l'API (inchangé)
   └─ client-core/          # logique partagée web + mobile (sans react-dom ni react-native)
```

- `pnpm-workspace.yaml` liste `mobile` ; dépendances internes en `workspace:*`.
- Metro se configure seul en monorepo (`expo/metro-config`) ; ne rien ajouter de `watchFolders` /
  `extraNodeModules`.
- pnpm installe en dépendances isolées (supporté depuis SDK 54) ; si une bibliothèque native casse : `nodeLinker:
  hoisted` dans `pnpm-workspace.yaml`. Vérifier les doublons : `pnpm why --depth=10 react-native` (une seule version
  de React et de React Native).
- pnpm 11 : ajouter à `allowBuilds` les scripts d'installation réellement nécessaires aux paquets Expo, et respecter la
  politique d'âge des versions.

## 3. `packages/client-core` (partagé web + mobile)

Tout ce qui ne dessine rien. Ni `react-dom`, ni `react-native`, ni `fetch` direct, ni stockage : ces détails arrivent
par injection.

```
packages/client-core/src/
├─ store/                   # createAppAsyncThunk, appApi (RTK Query), API_TAGS, actions (sessionCleared,
│                           # activeSalonChanged), listeners (purge du cache), createCoreStore(deps, plateforme)
├─ http/                    # port HttpClient (interface), HttpError, toApiFailure, codeToMessage
├─ realtime/                # port RealtimeSource, routage par type, invalidation à la reconnexion
├─ rbac/                    # session et droits : can(), étape suivante (D-027)
├─ format/                  # formatXaf, formatTimeInZone, formatPhone
├─ i18n/                    # dictionnaires fr/en par module + t() typé (le rendu reste dans chaque app)
└─ modules/<module>/        # models/gateway (port), usecases/<cas>/, slice/, listeners/, infra/api/, infra/repo/
                            # (adaptateur HTTP écrit sur le PORT HttpClient : réutilisé par les deux apps)
```

- Chaque app fournit ses **adaptateurs de plateforme** : `HttpClient` (web : cookies + CSRF ; mobile : jeton porteur),
  source temps réel (web : `EventSource` ; mobile : `react-native-sse`), stockage, et le branchement du focus et du
  réseau (web : `window` ; mobile : `AppState` et `@react-native-community/netinfo` via `setupListeners`).
- Tests : Vitest, gateways fakes (`createTestStore`), comme décrit dans `docs/frontend.md`.
- Ce paquet remplace, pour la logique, les `modules/<module>/{models,usecases,slice,listeners,infra/api,infra/repo}`
  et `lib/store` du web : le web garde `infra/ui`, `infra/router`, `infra/validators` si propres à l'UI, et ses
  adaptateurs (`docs/frontend.md`, `docs/frontend-modules.md`).

## 4. Structure de `mobile/`

```
mobile/
├─ app.config.ts            # nom, schéma de liens, liens universels (associatedDomains / intentFilters),
│                           # experiments.reactCompiler, plugins (expo-router, expo-secure-store…)
├─ eas.json                 # profils development / preview / production
└─ src/
   ├─ app/                  # Expo Router : un fichier = une route
   │  ├─ _layout.tsx        # fournisseurs : store, i18n, thème, zones sûres, garde de session
   │  ├─ (auth)/            # connexion, inscription, mot-de-passe-oublie, rejoindre
   │  ├─ (client)/(tabs)/   # NativeTabs : Explorer, Mes réservations, Profil
   │  ├─ (client)/salon/[salonId].tsx  reserver/…
   │  ├─ (salon)/(tabs)/    # NativeTabs : Aujourd'hui, Rendez-vous, Équipe, Plus
   │  ├─ (salon)/…          # écrans du back-office mobile, gardés par permission
   │  ├─ reprogrammation/[token].tsx
   │  └─ +not-found.tsx
   ├─ modules/<module>/
   │  ├─ ui/<fonctionnalité>/   # écrans + hooks use* (même découpage de modules que le web)
   │  └─ __tests__/             # jest-expo + React Native Testing Library
   ├─ components/
   │  ├─ ui/                # React Native Reusables (NativeWind)
   │  ├─ native/            # enveloppes Expo UI (SwiftUI / Compose) : Sheet, Menu, DatePicker, List
   │  ├─ forms/             # PhoneField, OtpField (code SMS auto-rempli), PasswordField, FieldHint
   │  └─ feedback/          # EmptyState, ErrorState, LoadingButton
   └─ lib/
      ├─ http/              # MobileHttpClient (implémente le port de client-core : jeton porteur)
      ├─ realtime/          # source react-native-sse
      ├─ storage/           # expo-secure-store
      ├─ store/             # createMobileStore(dépendances mobiles)
      └─ platform/          # setupListeners (AppState, NetInfo), liens profonds
```

## 5. Règles

- **Mêmes espaces que le web** (D-055) : une app, deux espaces (client et salon) plus l'authentification ; la session
  `CLIENT` n'ouvre que l'espace client.
- **Mêmes chemins que le web** pour les liens partagés (`/rejoindre`, `/reprogrammation/:token`) : un lien reçu par
  WhatsApp ouvre l'app si elle est installée (liens universels), sinon le web.
- **Session** : jeton porteur de la même session serveur, rangé dans `expo-secure-store` (UC-013). Jamais en clair dans
  les logs, jamais dans AsyncStorage.
- **Rendu natif d'abord** : contrôles système (onglets, feuilles, menus, sélecteurs de date) par Expo UI ou Expo
  Router ; NativeWind + Reusables pour le reste ; règles HIG d'Apple et Material sur Android.
- **Accessibilité et confort** : cibles ≥ 44 pt, zones sûres, taille de police dynamique, retour haptique sur les
  actions importantes, code SMS auto-rempli (`textContentType="oneTimeCode"`, `autoComplete="sms-otp"`).
- **Réseau mobile camerounais** : état hors ligne visible, relecture au retour du réseau et au retour au premier plan,
  pas de double envoi (bouton `loading`).
- **Guidage** (`CLAUDE.md`, tous modes) : mêmes exigences que le web (aide sous les choix, états vides qui disent quoi
  faire).
- **i18n, FCFA, fuseau du salon** : depuis `client-core`, comme le web.

## 6. Commandes

```bash
pnpm --filter mobile start            # Metro + dev client
pnpm --filter mobile test             # jest-expo (écrans)
pnpm --filter @gomecoiffer/client-core test   # Vitest (logique partagée)
eas build --profile development       # dev client
eas build --profile preview           # build interne (TestFlight / test interne)
eas update --branch preview           # mise à jour OTA
```

## 7. Skills et agent

- Projet : skill **`mobile-stack`** (`.claude/skills/mobile-stack/`) et agent **`mobile-builder`**
  (`.claude/agents/mobile-builder.md`), qui charge `mobile-stack`, `front-stack`, `tdd`, `clean-code` et `security`.

Skills externes, à installer par le user (refusé à l'agent par le garde-fou de Claude Code) :

- Expo officiel (skills `expo-router`, `expo-ui`, `expo-native-ui`, `expo-data-fetching`, `expo-design-system`,
  `eas-*`… + serveur MCP Expo) : `claude plugin install expo@claude-plugins-official --scope project`, puis `/mcp`.
- Callstack (performance) : `npx skills@latest add callstackincubator/agent-skills --skill react-native-best-practices`.

## 8. Reste à décider (voir `docs/BACKLOG.md`)

- UC-013 (session mobile par jeton, prêt pour dev, D-062) : prérequis côté API avant toute connexion depuis l'app ;
  UC-014 (inscription, mot de passe oublié, invitation depuis l'app) à rédiger.
- Comptes Apple Developer et Google Play, identifiants de l'app (`bundleIdentifier`, `package`), domaine des liens
  universels.
- Notifications push (rappels de rendez-vous) : hors PRD actuel.
- Ordre (D-062, mobile dans le MVP **en parallèle du web**) : `client-core`, backend de UC-013 et socle mobile
  d'abord ; puis chaque use case livre ses écrans web et mobiles ensemble.
