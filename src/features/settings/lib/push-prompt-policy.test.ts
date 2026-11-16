import {
  PUSH_PROMPT_MAX_DISMISSALS,
  PUSH_PROMPT_REASK_INTERVAL_MS,
  shouldShowPushPrompt,
  type PushPromptInput,
} from './push-prompt-policy';

const NOW = 1_800_000_000_000;

function input(overrides: Partial<PushPromptInput> = {}): PushPromptInput {
  return {
    isPhysicalDevice: true,
    permissionStatus: 'undetermined',
    pushEnabled: false,
    dismissCount: 0,
    lastDismissedAt: null,
    now: NOW,
    ...overrides,
  };
}

describe('shouldShowPushPrompt', () => {
  it('shows on first run when permission has never been decided', () => {
    expect(shouldShowPushPrompt(input())).toBe(true);
  });

  it('never shows on simulators/emulators, where remote push is unsupported', () => {
    expect(shouldShowPushPrompt(input({ isPhysicalDevice: false }))).toBe(false);
  });

  it('does not show when push is already enabled', () => {
    expect(shouldShowPushPrompt(input({ pushEnabled: true }))).toBe(false);
  });

  it('does not show when the OS permission is already granted (user turned push off on purpose)', () => {
    expect(shouldShowPushPrompt(input({ permissionStatus: 'granted' }))).toBe(false);
  });

  it('does not show when the OS permission was denied (the system prompt cannot be re-shown)', () => {
    expect(shouldShowPushPrompt(input({ permissionStatus: 'denied' }))).toBe(false);
  });

  it('stays quiet right after the user chose "Later"', () => {
    expect(shouldShowPushPrompt(input({ dismissCount: 1, lastDismissedAt: NOW - 60_000 }))).toBe(
      false,
    );
  });

  it('asks again once the re-ask interval has elapsed', () => {
    expect(
      shouldShowPushPrompt(
        input({ dismissCount: 1, lastDismissedAt: NOW - PUSH_PROMPT_REASK_INTERVAL_MS }),
      ),
    ).toBe(true);
  });

  it('stops asking after the maximum number of dismissals', () => {
    expect(
      shouldShowPushPrompt(
        input({
          dismissCount: PUSH_PROMPT_MAX_DISMISSALS,
          lastDismissedAt: NOW - PUSH_PROMPT_REASK_INTERVAL_MS * 10,
        }),
      ),
    ).toBe(false);
  });

  it('treats a missing dismissal timestamp with a positive count as due', () => {
    expect(shouldShowPushPrompt(input({ dismissCount: 1, lastDismissedAt: null }))).toBe(true);
  });
});
