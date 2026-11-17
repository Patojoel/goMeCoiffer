/** Règles d'architecture de CLAUDE.md §I.1 et §II, vérifiées par `pnpm arch`. */
module.exports = {
  forbidden: [
    {
      name: 'domain-is-pure',
      comment: 'domain/ n’importe que shared/domain : ni NestJS, ni TypeORM, ni application, ni infrastructure.',
      severity: 'error',
      from: { path: '^backend/src/(modules/[^/]+|shared)/domain/' },
      to: {
        pathNot: ['^backend/src/(modules/[^/]+|shared)/domain/'],
        dependencyTypesNot: ['type-only'],
      },
    },
    {
      name: 'domain-no-framework',
      severity: 'error',
      from: { path: '^backend/src/(modules/[^/]+|shared)/domain/' },
      to: { path: 'node_modules/(@nestjs|typeorm|pg)/' },
    },
    {
      name: 'application-no-typeorm',
      comment: 'application/ n’importe jamais typeorm, HTTP ni infrastructure : le SQL passe par SqlReader.',
      severity: 'error',
      from: { path: '^backend/src/(modules/[^/]+|shared)/application/' },
      to: { path: ['node_modules/(typeorm|pg|express)/', '^backend/src/(modules/[^/]+|shared)/infrastructure/'] },
    },
    {
      name: 'no-cross-module-infrastructure',
      comment: 'Un module n’importe jamais l’infrastructure d’un autre module.',
      severity: 'error',
      from: { path: '^backend/src/modules/([^/]+)/' },
      to: { path: '^backend/src/modules/([^/]+)/infrastructure/', pathNot: '^backend/src/modules/$1/' },
    },
    {
      name: 'front-gateway-injected',
      comment: 'Un *HttpGateway ne s’importe que depuis lib/store/dependencies/.',
      severity: 'error',
      from: { path: '^frontend/src/', pathNot: ['^frontend/src/lib/store/dependencies/', '\\.(test|int\\.test)\\.tsx?$'] },
      to: { path: 'HttpGateway\\.ts$' },
    },
    {
      name: 'no-circular',
      severity: 'error',
      from: {},
      to: { circular: true },
    },
  ],
  options: {
    doNotFollow: { path: 'node_modules' },
    exclude: { path: '(^|/)(dist|coverage)/' },
    tsPreCompilationDeps: true,
    tsConfig: { fileName: 'tsconfig.base.json' },
    enhancedResolveOptions: { exportsFields: ['exports'], conditionNames: ['import', 'require', 'node', 'default'] },
  },
};
