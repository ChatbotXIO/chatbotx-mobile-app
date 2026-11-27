// Components like <Text> call useTranslation(); without an initialized i18next instance
// react-i18next logs NO_I18NEXT_INSTANCE. The app initializes it in src/app/_layout.tsx.
// Deferred to beforeAll (and required lazily) so '@/i18n' — which transitively loads
// src/config/brand.ts — is evaluated after each test file's own jest.mock calls, not before.
beforeAll(() => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports -- intentional lazy require.
  const { initReactI18next } = require('react-i18next');
  // Tests that jest.mock('react-i18next') with their own stub have no plugin to register and
  // don't need a real instance.
  if (!initReactI18next) {
    return;
  }
  // eslint-disable-next-line @typescript-eslint/no-require-imports -- intentional lazy require.
  require('@/i18n').initI18n();
});
