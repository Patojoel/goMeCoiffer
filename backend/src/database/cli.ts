import dataSource from './data-source.js';

/** `node dist/database/cli.js run|revert|show` — appelé par les scripts migration:* du package. */
const command = process.argv[2];

await dataSource.initialize();
try {
  if (command === 'run') {
    const applied = await dataSource.runMigrations({ transaction: 'each' });
    console.log(
      applied.length
        ? applied.map((m) => `appliquée : ${m.name}`).join('\n')
        : 'Aucune migration en attente.',
    );
  } else if (command === 'revert') {
    await dataSource.undoLastMigration({ transaction: 'each' });
    console.log('Dernière migration annulée.');
  } else if (command === 'show') {
    console.log((await dataSource.showMigrations()) ? 'Des migrations sont en attente.' : 'Base à jour.');
  } else {
    console.error('Usage : cli.js run | revert | show');
    process.exitCode = 1;
  }
} finally {
  await dataSource.destroy();
}
