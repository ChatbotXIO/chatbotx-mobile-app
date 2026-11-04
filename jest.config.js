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
    // Reanimated 4 and Worklets 0.13 initialize native/browser runtimes that do not exist in
    // Jest's React Native environment. Component tests use deterministic substitutes.
    '^react-native-reanimated$': '<rootDir>/test-mocks/react-native-reanimated.js',
    '^react-native-worklets$': '<rootDir>/test-mocks/react-native-worklets.js',
    '^react-native-gesture-handler/ReanimatedSwipeable$':
      '<rootDir>/test-mocks/reanimated-swipeable.js',
  },
  collectCoverageFrom: ['src/**/*.{ts,tsx}', '!src/api/generated/**', '!src/**/*.d.ts'],
};
