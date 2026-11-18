---
name: sql-query
description: Conventions des lectures (QueryHandlers) et performance SQL PostgreSQL de GoMeCoiffer. À charger avant d'écrire ou d'optimiser une query côté backend. Impose le SQL pur écrit dans application/queries via le gabarit sql et le port SqlReader (paramètres liés, jamais l'ORM pour lire), CTE filtrées à l'entrée par salon, read models readonly, test E2E d'abord, et le rapport d'analyse avec vérification réelle des index (pg_indexes, EXPLAIN ANALYZE) + migration TypeORM d'index.
---

# SQL & performance en lecture (GoMeCoiffer)

> Réf : `CLAUDE.md` §I.2.B (règles obligatoires des QueryHandlers). Base : **PostgreSQL 17**.

## Où et comment

- `backend/src/modules/<module>/application/queries/<use-case>/` : `<use-case>.query.ts` (`extends Query<R>`), `<use-case>.handler.ts` (`@QueryHandler`), `<use-case>.read-model.ts` (types `readonly`).
- Le handler injecte **`SqlReader`** (`@Inject(READ_DB)`) et écrit son SQL **en clair** avec le gabarit `sql\`…\`` de `shared/application/sql` : chaque `${valeur}` devient un paramètre lié `$n`.
- Interdits dans une lecture : `typeorm` importé, `Repository.find*`, QueryBuilder, entité TypeORM en sortie, repository d'agrégat, `dataSource.query` avec une chaîne concaténée, `sql.unsafe()` sur une valeur venue de l'extérieur.
- Colonnes aliasées en camelCase dans le SELECT (`s.display_name AS "displayName"`) : le read model sort tel quel, sans boucle de renommage en JS.
- Lecture pure : aucune écriture ni effet de bord.

## Règles de performance

1. **CTE filtrées dès l'entrée** sur le périmètre (`salon_id`, `staff_id`, plage de dates) — jamais un scan global filtré plus tard.
2. **Projection minimale** — pas de `SELECT *` ; pas de donnée personnelle non nécessaire à l'écran (BR-11).
3. **Indexation** — toute colonne de `WHERE` / `JOIN` / `ORDER BY` sur une table volumineuse s'appuie sur un index. Index composite : ordre selon le préfixe le plus à gauche (`(salon_id, starts_at)` pour le planning du jour).
4. **Pas de N+1 ni d'agrégation JS en O(n²)** — agréger en SQL (`json_agg`, `array_agg`, `DISTINCT ON`, `LATERAL`).
5. **Sargabilité** — pas de fonction sur une colonne indexée dans le `WHERE` (`lower(name)`, `starts_at::date`) sans index d'expression ; filtrer une journée par plage `[début, fin)` calculée dans le fuseau du salon.
6. **Pagination** par clé (keyset) pour les listes longues (réservations, transactions) ; `LIMIT/OFFSET` seulement sur de petits volumes.
7. **Aucune donnée codée en dur** (id de rôle, libellé, fuseau) dans le SQL.
8. **Recherche marketplace** (ville, quartier, nom, prestation) : uniquement les salons **publiés et non suspendus** ; recherche textuelle par `pg_trgm` ou `unaccent` + index d'expression, décidée et notée dans `docs/DECISIONS.md` au premier besoin.

## Disponibilités (F02) — lecture sensible

- Calcul en SQL à partir de `working_schedules`, `unavailabilities` et `bookings` bloquantes, **borné** à l'intervenant (ou aux intervenants habilités pour la prestation) et à la période demandée : `generate_series` sur la période, exclusion par `tstzrange && tstzrange`.
- La durée complète de la prestation doit tenir dans le créneau (règle 1 de F02).
- Une lecture de disponibilité n'est **jamais** une garantie : la confirmation revalide côté écriture (contrainte d'exclusion).
- Index attendus : GiST sur `tstzrange(starts_at, ends_at)` (porté par la contrainte d'exclusion), `(staff_id, starts_at)`, `(salon_id, starts_at)`.

## Rapport d'analyse (obligatoire, même si les corrections sont déjà appliquées)

1. **Structure** : CTE, JOIN, filtres.
2. **Problèmes de performance** : scans globaux, O(n²) JS, données en dur, incohérences avec le reste du projet.
3. **Vérification des index — sur la vraie base**, jamais estimée :
   ```bash
   docker exec gomecoiffer-postgres psql -U gomecoiffer -d gomecoiffer -c \
     "SELECT tablename, indexname, indexdef FROM pg_indexes WHERE tablename IN ('bookings','staff_profiles');"
   docker exec gomecoiffer-postgres psql -U gomecoiffer -d gomecoiffer -c \
     "EXPLAIN (ANALYZE, BUFFERS) <requête avec valeurs réalistes>;"
   ```
   (ou la base Testcontainers du test E2E, en gardant le conteneur ouvert le temps de la mesure). Le seed de démo doit fournir un volume réaliste pour que l'`EXPLAIN` ait un sens.
   Tableau : table.colonne | index existant (oui/non) | recommandation.
4. **Récapitulatif priorisé** : 🔴 Critique / 🟡 Important / 🟠 Mineur, avec l'impact attendu.

Index manquant → **migration TypeORM écrite à la main** (`migration:create`, `CREATE INDEX CONCURRENTLY` si la table est déjà volumineuse en prod, avec `transaction = false` sur la migration) + ligne dans `docs/migrations-history.md`.

## Tests

- **E2E uniquement** (Testcontainers + supertest), écrit **avant** le handler, sur un parcours métier (ex. « le planning du jour ne montre que les rendez-vous du salon actif »). Pas d'unit ni d'intégration pour une query.
- Toujours un cas de **périmètre** : une donnée d'un autre salon présente en base n'apparaît jamais.

## Anti-patterns à refuser

```ts
this.db.many(sql.unsafe(`… WHERE salon_id = '${salonId}'`));        // ❌ injection
this.ds.getRepository(BookingOrmEntity).find({ where: { salonId } }); // ❌ ORM pour lire
const all = await this.db.many(sql`SELECT … FROM bookings`);          // ❌ scan global
return all.filter(b => b.salonId === salonId);                        //    filtré en JS

this.db.many(sql`… WHERE b.salon_id = ${salonId} AND b.starts_at >= ${from}`); // ✅
```
- CTE non filtrée, read model mutable, entité TypeORM en sortie, query livrée sans rapport d'index.

## Checklist avant de valider

- [ ] SQL pur dans `application/queries` (ou `application/read-repositories` pour une lecture utile à une commande), gabarit `sql`, `SqlReader`, aucune concaténation ni ORM ?
- [ ] CTE filtrées à l'entrée par salon, projection minimale, pas d'O(n²) JS ?
- [ ] Read models `readonly`, alias camelCase ?
- [ ] Test E2E écrit d'abord et vert, avec un cas d'isolation entre salons ?
- [ ] Rapport avec `pg_indexes` et `EXPLAIN` réellement exécutés + migration d'index si besoin ?
