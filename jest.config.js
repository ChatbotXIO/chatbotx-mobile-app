module.exports = {
  preset: 'jest-expo',
  setupFiles: ['./jest.setup.ts'],
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
    // Under Jest's RN environment, lucide-react-native's package.json `exports` picks its ESM
    // `.mjs` build (customExportConditions includes `react-native`), but Jest has no transform
    // registered for `.mjs` (only `.[jt]sx?`) — `require()`-ing it raw hits `export` syntax and
    // throws. Its CJS build is real CommonJS and needs no transform, so map straight to it.
    '^lucide-react-native$':
      '<rootDir>/node_modules/lucide-react-native/dist/cjs/lucide-react-native.js',
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
