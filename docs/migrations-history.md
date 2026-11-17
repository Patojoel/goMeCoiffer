# Historique des migrations — GoMeCoiffer

Migrations TypeORM de `backend/src/database/migrations/`, dans l'ordre d'application. Une ligne par migration,
ajoutée dans le même commit que la migration. Une migration commitée ne se modifie jamais (hook de garde) :
on en ajoute une nouvelle.

| Fichier | Module | Contenu | Générée / écrite à la main | Destructive (expand/contract) | Date |
|---|---|---|---|---|---|
| _aucune_ | | | | | |

Rappels (`CLAUDE.md` §I.8) : SQL généré relu ligne à ligne, `down()` réel, contraintes d'exclusion et index
partiels écrits à la main, `CREATE INDEX CONCURRENTLY` (migration sans transaction) sur une table déjà
volumineuse, jamais `synchronize` ni `schema:sync`.
