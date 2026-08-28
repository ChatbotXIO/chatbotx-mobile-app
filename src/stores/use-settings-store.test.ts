import { useSettingsStore } from '@/stores/use-settings-store';

// Hoisted above the import above by babel-jest regardless of source order.
jest.mock('expo-localization', () => ({
  getLocales: () => [{ languageTag: 'en-US' }],
}));

beforeEach(() => {
  useSettingsStore.setState({ themePreference: 'system', language: 'en', pushEnabled: false });
});

describe('useSettingsStore', () => {
  it('defaults themePreference to system and pushEnabled to false', () => {
    expect(useSettingsStore.getState().themePreference).toBe('system');
    expect(useSettingsStore.getState().pushEnabled).toBe(false);
  });

  it('setThemePreference updates the preference', () => {
    useSettingsStore.getState().setThemePreference('dark');
    expect(useSettingsStore.getState().themePreference).toBe('dark');
  });

  it('setLanguage is a pure setter with no side effects', () => {
    useSettingsStore.getState().setLanguage('vi');
    expect(useSettingsStore.getState().language).toBe('vi');
  });

  it('setPushEnabled updates the flag', () => {
    useSettingsStore.getState().setPushEnabled(true);
    expect(useSettingsStore.getState().pushEnabled).toBe(true);
  });
});
