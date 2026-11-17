---
name: tdd
description: "Tests de comportement métier (une règle = un test, nommé et vérifié en langage métier, jamais calqué sur un fichier), flow TDD et stratégie de test à 3 niveaux de GoMeCoiffer (unit sur fakes in-memory / intégration Testcontainers sur la vraie dépendance / E2E HTTP par parcours métier), back NestJS et front React, tout en Vitest. À charger avant d'écrire tout code applicatif et avant d'écrire/modifier des tests. Impose : liste des règles puis un test à la fois, test rouge d'abord, ordre unit → intégration → E2E → mutation (règles sensibles), aucun mock framework ni vi.mock de module, QueryHandlers testés en E2E uniquement."
---

# TDD — Développement piloté par les tests (GoMeCoiffer)

> Réf : `CLAUDE.md` §I.7 et §V. Règle du projet : **un changement non testé n'est pas terminé.**

## On teste un comportement métier, jamais un fichier

Un test décrit **une règle ou un scénario du métier**, tel qu'un gérant de salon, un coiffeur ou un client
l'énoncerait, et le vérifie par ce qui est **observable de l'extérieur** du cas d'usage. Le code (handler,
contrôleur, gateway, hook) n'est que le moyen de l'exercer : on doit pouvoir le refactorer sans toucher au test.

- **Partir de la règle, pas de la classe.** Énoncer la règle en une phrase métier avant d'écrire le test :
  « deux réservations ne peuvent pas se chevaucher sur le même coiffeur », « un créneau en attente de paiement
  se libère au bout de 10 minutes ». Une règle = un test (ou quelques cas limites de cette règle).
- **Nommer par le comportement.** Fichier = la capacité métier ou le parcours (`booking-a-slot.test.ts`,
  `rescheduling-after-no-show.e2e.test.ts`), jamais le nom d'un fichier de production
  (`confirm-booking.handler.test.ts`). `describe` = la capacité, `it` = la règle en phrase anglaise
  (`it('refuses a booking that overlaps another one for the same staff member')`).
  Le niveau technique se lit dans le suffixe/dossier, pas dans le nom.
- **Given / When / Then en vocabulaire métier.** Mise en place par des actions métier via les builders
  (le salon ouvre à 8 h, le coiffeur Paul fait la coupe homme de 30 min…), une action, puis l'effet attendu.
- **Asserter le résultat métier**, pas le chemin : état relu par une lecture, réponse HTTP, refus et son `code`,
  événement d'intégration émis. Jamais : nombre d'appels à un repository, méthode interne appelée, structure
  d'un objet intermédiaire, classe CSS.
- **Une sortie vers l'extérieur est un comportement.** Un SMS envoyé, un paiement initié auprès de
  l'agrégateur, un événement SSE poussé se vérifient sur un **fake qui les enregistre** (`FakeSmsSender`,
  `FakePaymentGateway`, `InMemoryRealtimePublisher`). Leur **nombre** ne s'asserte que s'il est lui-même la
  règle : « un webhook rejoué ne confirme le paiement qu'une fois ».
- **Un test qui casse au refactoring sans changement de comportement est un mauvais test** : le réécrire sur la règle.

```ts
// ❌ calqué sur les fichiers, vérifie la mécanique
describe('ConfirmBookingHandler', () => { it('calls repository.save once', …) });
// ✅ la règle métier, vérifiée par son effet observable
describe('Booking a slot', () => {
  it('refuses a slot that overlaps another booking of the same staff member', …);   // refus + code
  it('confirms a pay-at-salon booking immediately and blocks the slot', …);         // BR-03
});
```

## Cycle

1. **Lister les règles d'abord.** Avant le premier test, écrire en phrases métier la liste des règles du cas
   d'usage, refus compris (les refus avant les cas passants). Source : le use case `docs/use-cases/UC-xxx`
   (règles `RG-xxx`, plan de tests TDD) ou le PRD (BR-01…BR-12).
2. **Une règle à la fois : Red → Green → Refactor.** Transformer **une seule** règle en test, **annoncer avant
   de le lancer la raison d'échec attendue** (« attendu : refus SLOT_NO_LONGER_AVAILABLE, obtenu : OK »), le
   **voir échouer sur une assertion métier pour cette raison-là** (pas sur une erreur de compilation ni
   d'environnement), écrire le minimum de code pour passer au vert, puis refactorer sous couverture. Jamais
   plusieurs tests rouges écrits d'avance ; jamais de refactoring pendant qu'un test est rouge.
3. Reprendre la règle suivante jusqu'à épuiser la liste.

**Ordre des niveaux**, chacun en suivant ce cycle :
1. **Unitaires** : les règles métier du cas d'usage, sur fakes in-memory.
2. **Intégration** : le branchement de chaque adapter réel touché avec sa dépendance (repository TypeORM et
   contrainte d'exclusion sur PostgreSQL, adaptateur de paiement contre un faux serveur HTTP).
3. **E2E** : le parcours métier complet, de bout en bout par HTTP.
4. **Mutation** (Stryker), seulement sur les règles sensibles : chevauchement, transitions de statut,
   montants, permissions et droits protégés du propriétaire, expiration des paiements.

**Exception : un QueryHandler se teste en E2E seulement**, écrit avant la requête ; ni unitaire ni intégration.

Le rapport donne la liste des règles et, pour chacune, son test et le message d'échec vu.

## Écrire le test

- **Valeur attendue calculée à la main**, écrite en dur (`expect(remaining).toBe(3_000)` pour 5 000 FCFA moins
  2 000 payés), jamais recopiée de ce que le code produit ni recalculée par la même formule que le code.
- **Lisible avant d'être factorisé** : chaque test se lit seul. Les builders portent les valeurs par défaut ;
  ce qui compte pour la règle s'écrit dans le test. Ni `if`, ni boucle, ni calcul dans un test : un cas par
  test, ou `it.each` dont chaque ligne est un cas.
- **Déterministe et indépendant de l'ordre** :
  - l'heure vient d'une horloge injectée (`FixedClock` côté back, `vi.setSystemTime` côté front), jamais
    `new Date()` dans le code testé ; les fuseaux sont explicites (`Africa/Douala`) ;
  - pas d'aléatoire : identifiants fixés par le test ou par `SequentialIdGenerator` ;
  - aucun état partagé entre tests (base clonée par worker, store neuf par test).
- **La doublure se branche depuis le test** : le test construit le fake, lui donne son état et le passe au
  handler (ou l'injecte dans le store). Un fake câblé ailleurs donne une assertion qui ne peut pas rougir.
- **Un test de droit ou de périmètre s'exécute avec l'autorisation réellement active** (E2E avec vraie session,
  guards et salon actif) ; jamais un en-tête de test qui court-circuite les guards. Les refus se testent en
  **table de cas** (`it.each` : rôle × salon × action → attendu), refus avant accès accordés. Toujours un cas
  « ressource d'un autre salon → 404 ».
- **Un E2E qui échoue sans qu'aucun test plus bas n'ait rougi** révèle un trou : écrire d'abord le test
  unitaire ou d'intégration qui l'aurait attrapé, le voir rouge, puis corriger.

## Les 3 niveaux (back)

**Forme pyramide** : beaucoup d'unitaires, moins d'intégration, **un E2E par parcours métier** (pas un par endpoint).

### 1. Unit — `tests/unit/*.test.ts`
- Instancie **directement** le handler avec des fakes in-memory (`tests/fakes/InMemory*Repository`). Pas de
  `Test.createTestingModule`, pas de NestJS.
- **Aucun mock framework** (`vi.fn()` comme doublure de repository, `vi.mock`, `jest-mock-extended` : interdits).
  Doublure = implémentation in-memory déterministe du port, écrite à la main.
- **Le fake reproduit ce que l'intégration prouve** : quand l'adapter réel porte une règle (filtre `salon_id`,
  non-chevauchement, unicité, verrou optimiste), elle est prouvée en intégration contre PostgreSQL, et le fake
  la reproduit ; une divergence trouvée se corrige dans le fake.
- Données via **builders** (`tests/builders/`) avec valeurs par défaut surchargeables.
- Erreur métier → `await expect(…).rejects.toThrow(SlotNoLongerAvailableError)` ou assertion sur le `code`.

### 2. Intégration — `tests/integration/*.int.test.ts`
- **Rôle : prouver que le branchement avec l'extérieur est correct**, sur la vraie dépendance : repository
  TypeORM et SQL contre PostgreSQL 17, contrainte d'exclusion réellement violée par deux transactions
  concurrentes, adaptateur de paiement contre un serveur HTTP de test (signature, idempotence).
- **Testcontainers** (`@testcontainers/postgresql`), schéma posé par les **vraies migrations TypeORM**.
- Identifiants cohérents : ce qu'on insère est ce qu'on relit (sinon l'assertion passe à vide).

### 3. E2E — `tests/e2e/*.e2e.test.ts`
- App Nest complète + Testcontainers + `supertest` (agent avec cookie de session et jeton CSRF). Un test suit
  **un parcours métier** (le client réserve une coupe en payant au salon, le coiffeur la démarre puis la
  termine, le créneau suivant redevient libre) et peut enchaîner plusieurs requêtes.
- **Seul niveau de test des QueryHandlers**, écrit **avant** la query.

## Front (Vitest + Testing Library)

Même cycle, même règle : pas d'exemption « c'est de l'UI ».

**Ce qui se teste, test d'abord**
- La **logique** (thunk, slice, selector, listener) : vérifiée par l'**état du store** après une action, avec un
  **gateway fake in-memory** injecté via `createTestStore({ <gateway>: fake })`.
- Les **hooks** (`renderHook`) : ce qu'ils rendent selon la réponse du gateway.
- Le **comportement** d'un écran : chargement / erreur / vide / données, refus de droit, champ désactivé,
  message d'aide, ouverture d'une modale, navigation.

**Ce qui ne se teste pas : l'apparence.** Couleurs, marges, fidélité à une maquette se vérifient **à l'écran**
(captures 390 px et ordinateur). Test sur une classe Tailwind ou `toMatchSnapshot` : **interdit**.

**Les doublures** : on remplace la **frontière** (gateway injecté, prop, contexte), jamais un module.
`vi.mock('…')` est **interdit**. MSW seulement pour les tests d'intégration du gateway HTTP.

**Les requêtes** : par rôle et par libellé (`getByRole('button', { name: 'Réserver' })`, `getByLabelText('Téléphone')`).
`data-testid` seulement quand aucun rôle n'existe. Interactions avec `@testing-library/user-event`.

**Niveaux** : unitaires (logique, hooks, composants, gateway fake) ; intégration (`*.int.test.ts`, gateway HTTP
réel contre MSW : URL, CSRF, `ApiResponse`, erreurs 401/403/404/409/422) ; E2E (parcours utilisateur).

## Exécuter les tests

Prérequis : Docker démarré (Testcontainers lance ses conteneurs seul).

```bash
pnpm --filter api test <chemin|motif>        # unit
pnpm --filter api test:int <chemin>          # intégration
pnpm --filter api test:e2e <chemin>          # E2E
pnpm --filter web test <chemin>
pnpm test                                    # suite complète, une fois avant le commit final
```

## Règles pratiques

- Ne jamais désactiver (`it.skip`, `it.only` oublié) un test pour « faire passer » — corriger la cause.
- Lancer **au minimum** les tests du cas d'usage modifié, et la suite du module si tu touches du partagé.
- Ne jamais affirmer qu'un test passe sans l'avoir exécuté.
- **Vérifier le nombre de tests exécutés**, pas seulement la couleur : « 0 passed » (motif mal orthographié)
  est un vert vide. Le rapport cite le nombre lu dans la sortie.

## Checklist avant de valider

- [ ] Liste des règles écrite avant le premier test, refus compris ?
- [ ] Chaque test énonce une règle métier (fichier, `describe`, `it`), pas un fichier de production ?
- [ ] Assertions sur un effet observable ; un nombre seulement si le nombre est la règle ?
- [ ] Un test à la fois, écrit **avant** le code et vu rouge sur une assertion ; refactoring seulement au vert ?
- [ ] Ordre suivi : unit, intégration, E2E (QueryHandler : E2E seul), mutation si règle sensible ?
- [ ] Valeurs attendues calculées à la main ; ni logique ni boucle ; heure et fuseau injectés ; pas d'aléatoire ?
- [ ] Unit = fakes in-memory, aucun mock framework, aucune I/O ?
- [ ] Intégration = vraie dépendance (Testcontainers), vraies migrations ?
- [ ] Droits et périmètre testés avec les vrais guards, en table de cas, avec un cas « autre salon » ?
- [ ] Front : par rôle, `userEvent`, ni `vi.mock`, ni classe CSS, ni instantané ?
- [ ] Tests exécutés et verts, nombre de tests lu dans la sortie ?
