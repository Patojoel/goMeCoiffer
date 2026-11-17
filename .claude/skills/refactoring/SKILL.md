---
name: refactoring
description: Refactoring sûr sur GoMeCoiffer (back NestJS/TypeORM + front React/TS) — modifier la STRUCTURE sans changer le comportement, sous tests verts, par petits pas. À charger quand la tâche est « refactore / nettoie / simplifie » un module. Partage le catalogue de smells du skill clean-code (qui, lui, dit comment écrire juste du premier coup).
---

# Refactoring — comportement préservé, sous tests (GoMeCoiffer)

> Refactorer = changer la **structure** sans changer le **comportement observable**. La sûreté vient des
> **tests**. Complète `clean-code` (écrire juste du premier coup) : ici on **corrige après**.

## Règle d'entrée : pas de refactoring sans filet
- Le code visé est-il **couvert** (unit sur fakes, intégration, E2E) ? Oui → refactore sous couverture.
- Sinon → écris d'abord des **tests de caractérisation** qui figent le comportement **actuel** (bugs compris). Voir skill `tdd`.

## Protocole
1. **Tests verts** avant de commencer (sinon, stabilise d'abord).
2. **Petits pas atomiques** : une transformation à la fois (extraire une fonction, introduire un VO, déplacer une règle du handler vers l'agrégat, remplacer un appel direct inter-module par un événement, remplacer une lecture ORM par une query SQL…) — **jamais** structure + comportement dans le même pas.
3. **Tests après chaque pas** ; au moindre rouge, on revient en arrière.
4. **Un commit par pas** (`refactor: …`).
5. **Comportement final identique** — y compris le contrat HTTP (`ApiResponse`, codes d'erreur stables), les schémas de `packages/contracts`, les événements publiés (`type` inchangé) et le schéma BD. Un changement de schéma n'est pas un refactoring : migration TypeORM + tests.

## Quand refactorer — et quand s'abstenir
- **Oui** : un smell **bloque** un changement à venir, ou est **avéré** et répété (règle de trois).
- **Non** : refactoring **spéculatif**, ou qui **ajoute** une abstraction sans besoin présent.

## Cibles (catalogue partagé avec `clean-code`)
- **Back** : handler obèse (SRP), contrôleur gras, règle métier dans un handler/mapper/subscriber/entité TypeORM, TypeORM qui fuit dans `domain/` ou `application/`, lecture d'écran faite par l'ORM au lieu du SQL pur, CTE non filtrée, `sql.unsafe` sur une valeur, agrégation JS en O(n²), `new Date()`/`randomUUID()` dans le métier, transaction ouverte à la main, appel direct d'un handler d'un autre module.
- **Front** : logique métier dans un composant (→ usecase/hook), prop-drilling, thunk dupliqué, `*HttpGateway` importé hors de `lib/store/dependencies/`, lecture faite par thunk au lieu de RTK Query, composant « générique » prématuré, texte en dur au lieu de l'i18n.

## Périmètre
- Ne mélange pas refactoring et feature dans le même lot/commit — deux intentions, deux passes.
- Reste dans le module demandé ; signale les smells voisins (dans `docs/BACKLOG.md`) sans les traiter.

## Avant de conclure
- [ ] Comportement inchangé (tests verts, mêmes assertions qu'avant) ?
- [ ] Chaque pas est-il atomique ?
- [ ] N'as-tu pas **ajouté** de complexité au nom du « propre » ?
