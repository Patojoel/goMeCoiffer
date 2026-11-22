import type { ConfigContext, ExpoConfig } from 'expo/config';

// Domaine placeholder pour les liens universels en attendant la validation du domaine final (docs/mobile.md §8).
const UNIVERSAL_LINK_HOST = 'gomecoiffer.cm';

export default ({ config }: ConfigContext): ExpoConfig => ({
  ...config,
  name: 'GoMeCoiffer',
  slug: 'gomecoiffer',
  scheme: 'gomecoiffer',
  version: '0.1.0',
  userInterfaceStyle: 'automatic',
  icon: './assets/images/icon.png',
  ios: {
    supportsTablet: true,
    bundleIdentifier: 'cm.gomecoiffer.app',
    associatedDomains: [`applinks:${UNIVERSAL_LINK_HOST}`],
  },
  android: {
    package: 'cm.gomecoiffer.app',
    softwareKeyboardLayoutMode: 'resize',
    adaptiveIcon: {
      foregroundImage: './assets/images/adaptive-icon.png',
      backgroundColor: '#17213B',
    },
    intentFilters: [
      {
        action: 'VIEW',
        autoVerify: true,
        data: [
          { scheme: 'https', host: UNIVERSAL_LINK_HOST, pathPrefix: '/rejoindre' },
          { scheme: 'https', host: UNIVERSAL_LINK_HOST, pathPrefix: '/reprogrammation' },
        ],
        category: ['BROWSABLE', 'DEFAULT'],
      },
    ],
  },
  web: {
    bundler: 'metro',
    output: 'single',
    favicon: './assets/images/favicon.png',
  },
  experiments: {
    typedRoutes: true,
    reactCompiler: true,
  },
  plugins: [
    'expo-router',
    'expo-secure-store',
    [
      'expo-splash-screen',
      {
        backgroundColor: '#17213B',
        image: './assets/images/splash-icon.png',
        imageWidth: 180,
      },
    ],
  ],
});
