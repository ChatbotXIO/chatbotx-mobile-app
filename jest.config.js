module.exports = {
  preset: 'jest-expo',
  setupFiles: ['./jest.setup.ts'],
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
  },
  // react-native-worklets (reanimated 4's underlying worklets runtime) ships a real native
  // module with no Jest mock; its own package provides this resolver, which steers Jest away
  // from the `.native.ts` entrypoints (which throw under Jest — see react-native-worklets'
  // NativeWorklets.native.ts) toward its JS-only fallback path instead. Without this, importing
  // anything that pulls in `react-native-reanimated` (e.g. any UI primitive built on
  // PressableScale) crashes at import time under Jest.
  resolver: 'react-native-worklets/jest/resolver.js',
  collectCoverageFrom: ['src/**/*.{ts,tsx}', '!src/api/generated/**', '!src/**/*.d.ts'],
};
