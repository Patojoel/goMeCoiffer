module.exports = {
  preset: 'jest-expo',
  watchman: false,
  setupFilesAfterEnv: ['<rootDir>/jest.setup.ts'],
  testMatch: ['**/__tests__/**/*.test.[jt]s?(x)', '**/?(*.)+(spec|test).[jt]s?(x)'],
  moduleNameMapper: {
    '^@gomecoiffer/client-core$': '<rootDir>/../packages/client-core/dist/index.js',
    '^@gomecoiffer/client-core/gateways$': '<rootDir>/../packages/client-core/dist/gateways.js',
    '^@gomecoiffer/client-core/testing$': '<rootDir>/../packages/client-core/dist/testing.js',
    '^@gomecoiffer/contracts$': '<rootDir>/../packages/contracts/dist/index.js',
    '\\.css$': '<rootDir>/jest.css-stub.js',
  },
  transformIgnorePatterns: [
    '/node_modules/(?!(.pnpm|react-native|@react-native|@react-native-community|nativewind|expo|@expo|@expo-google-fonts|standard-navigation|@gomecoiffer|immer|react-redux|redux|redux-thunk|reselect|@reduxjs))',
    '/node_modules/react-native-reanimated/plugin/',
    '/node_modules/@react-native/babel-preset/',
  ],
};
