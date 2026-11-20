---
name: mobile-stack
description: Idiomes de l'app mobile GoMeCoiffer (Expo SDK 58, React Native 0.88, React 19.3, Expo Router, Redux Toolkit + RTK Query partagés par packages/client-core, Expo UI SwiftUI/Compose, NativeTabs, NativeWind v5 + React Native Reusables, expo-secure-store, react-native-sse, EAS, jest-expo). À charger avant d'écrire ou modifier du code dans mobile/ ou la logique partagée packages/client-core — écran natif, route Expo Router, adaptateur de plateforme (HttpClient à jeton, temps réel, stockage), composant natif iOS/Android, build EAS, test d'écran mobile. Complète front-stack (logique partagée) et hexagonal.
---

# Mobile-stack — Expo + React Native (GoMeCoiffer)

> Réf : `docs/mobile.md` (architecture, versions, structure), `CLAUDE.md` §II et stack, D-061, `docs/frontend-modules.md`
> (découpage des modules). Versions vérifiées le 20/11/2026 : Expo SDK 58, React Native 0.88, React 19.3. Toute montée
> de version passe par `docs/DECISIONS.md` et met à jour ce skill.
> Skills externes recommandés, s'ils sont installés : `expo-router`, `expo-ui`, `expo-native-ui`, `expo-data-fetching`,
> `expo-design-system`, `eas-*` (plugin Expo officiel) et `react-native-best-practices` (Callstack).

## Ce qui va où
- **`packages/client-core`** (partagé avec le web) : ports, `usecases/<cas>/<Cas>Async` + `Command` + `Response`,
  `slice/`, `listeners/`, endpoints RTK Query, adaptateurs `infra/repo/<Module>HttpGateway.ts` écrits sur le **port**
  `HttpClient`, store, rbac, format, dictionnaires i18n. **N'importe jamais** `react-native`, `react-dom`, `expo-*`,
  `fetch` ni un stockage. Tests : Vitest.
- **`mobile/src/`** : seulement les écrans (`modules/<module>/ui/<fonctionnalité>/` + hook `use*`), les routes
  (`app/`), les composants (`components/`) et les **adaptateurs de plateforme** (`lib/`) : `MobileHttpClient`,
  source temps réel, stockage sécurisé, `setupListeners` (focus et réseau).
- Une règle métier ou un appel API écrit dans `mobile/` est une erreur de couche : il va dans `client-core`.
- Un `*HttpGateway` n'est instancié que dans `mobile/src/lib/store/dependencies/`.

## Navigation (Expo Router)
- Un fichier de `src/app/` = une route. Groupes : `(auth)`, `(client)/(tabs)`, `(salon)/(tabs)`.
- Onglets : **`NativeTabs`** (barre système, Liquid Glass sur iOS 26+), jamais une barre d'onglets JS refaite.
- `_layout.tsx` porte les fournisseurs (store, i18n, thème, zones sûres) et les gardes : session `CLIENT` → espace
  client seulement (D-055) ; espace salon → session `STAFF` + salon actif ; écran sensible → permission du salon actif
  (confort UX, l'API refuse seule).
- Depuis SDK 56, Expo Router ne dépend plus de React Navigation : **ne pas importer `@react-navigation/*`**.
- Liens partagés : mêmes chemins que le web (`/rejoindre`, `/reprogrammation/[token]`), liens universels déclarés dans
  `app.config.ts`.

## UI « native d'abord »
- **Contrôles système par Expo UI** (`@expo/ui` : SwiftUI sur iOS, Jetpack Compose sur Android) : feuilles, menus,
  sélecteurs de date et d'heure, interrupteurs, listes de réglages ; enveloppés dans `components/native/` pour exposer
  une API commune aux deux plateformes. Vérifier dans la doc du SDK si un composant est stable avant de l'utiliser
  pour une grande liste.
- **Système de design** : NativeWind v5 (Tailwind v4, mêmes jetons que le web) + React Native Reusables (portage de
  shadcn/ui) dans `components/ui/`. Réutiliser avant de créer.
- Icônes : `expo-symbols` (SF Symbols) sur iOS, équivalent Material sur Android ; effet de verre :
  `expo-glass-effect`, avec repli sans effet sous iOS 26.
- Respecter les HIG d'Apple et Material : cibles ≥ 44 pt, zones sûres (`react-native-safe-area-context`), taille de
  police dynamique, retour haptique (`expo-haptics`) sur les actions importantes, pas de tableau large.
- Listes longues : liste virtualisée (`FlashList` ou liste native d'Expo UI) ; jamais `ScrollView` + `map` sur une
  liste de données.

## Données et état
- Redux Toolkit + RTK Query **de `client-core`** : même lecture (erreur, chargement, vide, données), même
  invalidation, même purge du cache à la déconnexion et au changement de salon (`sessionCleared`,
  `activeSalonChanged`).
- `setupListeners` branché sur `AppState` (retour au premier plan) et `@react-native-community/netinfo` (retour du
  réseau) : relecture des données affichées.
- Hors ligne : bandeau visible, actions désactivées avec la raison ; jamais de double envoi (bouton `loading`).

## Session et sécurité
- Session = **jeton porteur de la même session serveur** (UC-013), rangé dans **`expo-secure-store`**, envoyé par
  `MobileHttpClient` en en-tête `Authorization`. Jamais dans AsyncStorage, jamais dans un log, jamais dans une URL.
- 401 → purge du store, suppression du jeton, retour à la connexion ; 403 → erreur typée sans déconnexion.
- Aucune donnée personnelle de client (nom, téléphone) dans les logs ou un outil de suivi d'erreurs.
- Code SMS : `textContentType="oneTimeCode"` (iOS) et `autoComplete="sms-otp"` (Android) ; numéro au format
  camerounais normalisé avant envoi.

## Temps réel
- `react-native-sse` (GET + en-tête `Authorization`), routage par `type` et schéma Zod de `client-core`.
- Flux fermé quand l'app passe en arrière-plan, rouvert au premier plan ; **à chaque reconnexion, invalider toutes
  les lectures affichées**.

## Formulaires, dates, montants, textes
- `react-hook-form` + `zod` avec les schémas de `@gomecoiffer/contracts`.
- Heures dans le **fuseau du salon**, montants en FCFA entiers (`format` de `client-core`).
- Aucun texte en dur : dictionnaires de `client-core` ; **guidage** obligatoire (`CLAUDE.md`) : aide sous les choix non
  évidents, états vides et refus qui disent pourquoi et quoi faire.

## Configuration et builds
- `app.config.ts` : `experiments.reactCompiler: true`, plugins, schéma et liens universels, identifiants. Aucun secret
  (tout ce qui est dans l'app est public).
- Monorepo pnpm : Metro se configure seul (`expo/metro-config`), ne pas ajouter `watchFolders` ; une seule version de
  React et de React Native (`pnpm why --depth=10 react-native`) ; repli `nodeLinker: hoisted` si une dépendance native
  casse en installation isolée.
- Développement sur **dev client** (`eas build --profile development`) ; Expo Go seulement pour essayer. Mises à jour
  OTA (`eas update`) réservées au JS : un changement natif exige un nouveau build.

## Tests
- Logique : dans `client-core`, Vitest avec gateway fake (`createTestStore`), comme le web.
- Écrans mobiles : **jest-expo + React Native Testing Library** (exception D-061), dans
  `mobile/src/modules/<module>/__tests__/`, nommés par règle métier, sans `jest.mock` de module : store de test et
  gateways fakes injectés.
- Avant de rendre : `pnpm --filter mobile test`, `pnpm --filter mobile lint`, `pnpm --filter mobile typecheck`, et
  captures iOS et Android des écrans touchés (simulateur ou appareil).

## Checklist
- [ ] Aucune logique métier ni appel API dans `mobile/` (tout dans `client-core`) ?
- [ ] Onglets, feuilles, menus, sélecteurs natifs (Expo UI / `NativeTabs`) ?
- [ ] Jeton dans `expo-secure-store` seulement ; rien de sensible dans les logs ?
- [ ] Relecture au retour au premier plan, du réseau et du flux temps réel ?
- [ ] Textes via l'i18n, aides de guidage, cibles ≥ 44 pt, zones sûres ?
- [ ] Tests d'écran verts (nombre exécuté lu), captures iOS et Android regardées ?
