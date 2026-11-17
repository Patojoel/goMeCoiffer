# Historique des migrations — GoMeCoiffer

Migrations TypeORM de `backend/src/database/migrations/`, dans l'ordre d'application. Une ligne par migration,
ajoutée dans le même commit que la migration. Une migration commitée ne se modifie jamais (hook de garde) :
on en ajoute une nouvelle.

| Fichier | Module | Contenu | Générée / écrite à la main | Destructive (expand/contract) | Date |
|---|---|---|---|---|---|
| `1795000000000-Socle.ts` | socle | extension `btree_gist` ; tables `outbox` (+ index partiel des lignes non traitées), `processed_events` (PK consumer + event_id), `sessions` (store connect-pg-simple, index `expire`), `audit_log` (+ index salon/date) | écrite à la main | non | 2026-11-17 |

Rappels (`CLAUDE.md` §I.8) : SQL généré relu ligne à ligne, `down()` réel, contraintes d'exclusion et index
partiels écrits à la main, `CREATE INDEX CONCURRENTLY` (migration sans transaction) sur une table déjà
volumineuse, jamais `synchronize` ni `schema:sync`.
