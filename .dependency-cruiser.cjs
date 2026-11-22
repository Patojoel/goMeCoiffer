/** Règles d'architecture de CLAUDE.md §I.1 et §II, vérifiées par `pnpm arch`. */
module.exports = {
  forbidden: [
    {
      name: 'domain-is-pure',
      comment:
        'domain/ n’importe que shared/domain : ni NestJS, ni TypeORM, ni application, ni infrastructure.',
      severity: 'error',
      from: { path: '^backend/src/(modules/[^/]+|shared)/domain/' },
      to: { pathNot: ['^backend/src/(modules/[^/]+|shared)/domain/'] },
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
      to: {
        path: [
          'node_modules/(typeorm|pg|express|express-session|csrf-csrf|connect-pg-simple|@nestjs/(typeorm|platform-express))/',
          '^backend/src/(modules/[^/]+|shared)/infrastructure/',
        ],
      },
    },
    {
      name: 'controller-builds-no-command',
      comment:
        'Un contrôleur ne construit ni commande ni query : le mapper requête → commande (http/mappers/) est le seul fichier HTTP à les importer.',
      severity: 'error',
      from: { path: '^backend/src/modules/[^/]+/infrastructure/http/.+\\.controller\\.ts$' },
      to: { path: '^backend/src/modules/[^/]+/application/(commands|queries)/.+\\.(command|query)\\.ts$' },
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
      from: {
        path: '^frontend/src/',
        pathNot: ['^frontend/src/lib/store/dependencies/', '\\.(test|int\\.test)\\.tsx?$'],
      },
      to: { path: 'HttpGateway\\.ts$' },
    },
    {
      name: 'client-core-is-platform-agnostic',
      comment:
        'packages/client-core/ reste pur : ni DOM, ni React Native, ni Expo, ni fetch/stockage natif, ni apps.',
      severity: 'error',
      from: { path: '^packages/client-core/src/' },
      to: {
        path: [
          'node_modules/(react-dom|react-native|react-native-web|expo|expo-[^/]+|@expo/|react-native-sse|@react-native-community/|@react-native-async-storage/)',
          '^(frontend|mobile|backend)/',
        ],
      },
    },
    {
      name: 'client-core-gateway-not-in-logic',
      comment:
        'Les modèles, use cases, slices, listeners et API RTK Query ne dépendent jamais d’un *HttpGateway.',
      severity: 'error',
      from: { path: '^packages/client-core/src/modules/[^/]+/(models|usecases|slice|listeners|infra/api)/' },
      to: { path: 'HttpGateway\\.ts$' },
    },
    {
      name: 'mobile-gateway-injected',
      comment:
        'Un *HttpGateway ou @gomecoiffer/client-core/gateways ne s’importe que depuis mobile/src/lib/store/dependencies/.',
      severity: 'error',
      from: {
        path: '^mobile/src/',
        pathNot: ['^mobile/src/lib/store/dependencies/', '\\.(test|int\\.test)\\.tsx?$'],
      },
      to: {
        path: ['HttpGateway\\.ts$', '@gomecoiffer/client-core/gateways', 'packages/client-core/.*/gateways'],
      },
    },
    {
      name: 'mobile-no-react-navigation',
      comment: 'Expo Router >= SDK 56 : utiliser expo-router/react-navigation, jamais @react-navigation/*.',
      severity: 'error',
      from: { path: '^mobile/src/' },
      to: { path: 'node_modules/@react-navigation/' },
    },
    {
      name: 'mobile-no-async-storage',
      comment: 'Ne jamais utiliser de stockage non chiffré (secrets dans expo-secure-store).',
      severity: 'error',
      from: { path: '^mobile/src/' },
      to: { path: 'node_modules/(@react-native-async-storage|react-native-mmkv|expo-sqlite)/' },
    },
    {
      name: 'mobile-http-client-encapsulated',
      comment: 'MobileHttpClient et WebHttpClient ne s’importent que depuis createHttpClient*.ts.',
      severity: 'error',
      from: {
        path: '^mobile/src/',
        pathNot: ['^mobile/src/lib/http/createHttpClient(\\.web)?\\.ts$', '\\.(test|int\\.test)\\.tsx?$'],
      },
      to: { path: '^mobile/src/lib/http/(MobileHttpClient|WebHttpClient)\\.ts$' },
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
    enhancedResolveOptions: {
      exportsFields: ['exports'],
      conditionNames: ['import', 'require', 'node', 'default'],
    },
  },
};
