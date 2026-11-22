const path = require('node:path');
const { getDefaultConfig } = require('expo/metro-config');
const { withNativewind } = require('nativewind/metro');

const config = getDefaultConfig(__dirname);

// Expo can start directly after a pull, before client-core/dist has been rebuilt.
const coreSource = path.resolve(__dirname, '../packages/client-core/src');
const coreEntries = new Map([
  ['@gomecoiffer/client-core', 'index.ts'],
  ['@gomecoiffer/client-core/gateways', 'gateways.ts'],
  ['@gomecoiffer/client-core/testing', 'testing.ts'],
]);
const expoResolve = config.resolver.resolveRequest;
config.resolver.resolveRequest = (context, name, platform) => {
  const entry = coreEntries.get(name);
  if (entry) {
    return { type: 'sourceFile', filePath: path.join(coreSource, entry) };
  }

  // The shared TypeScript uses Node ESM's emitted .js extension for relative imports.
  if (context.originModulePath.startsWith(coreSource + path.sep) && name.startsWith('.') && name.endsWith('.js')) {
    name = name.slice(0, -3);
  }
  return (expoResolve ?? context.resolveRequest)(context, name, platform);
};

module.exports = withNativewind(config);
