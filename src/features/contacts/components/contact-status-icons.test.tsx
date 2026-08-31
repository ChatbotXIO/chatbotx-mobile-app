import { render, screen } from '@testing-library/react-native';

import { initI18n } from '@/i18n';

import { ContactStatusStrip } from './contact-status-icons';

beforeAll(() => {
  initI18n();
});

describe('ContactStatusStrip', () => {
  it('renders nothing when blocked and tags are both absent', async () => {
    const { toJSON } = await render(<ContactStatusStrip />);
    expect(toJSON()).toBeNull();
  });

  it('labels the blocked icon when blockedAt is set', async () => {
    await render(<ContactStatusStrip blockedAt="2026-01-01T00:00:00.000Z" />);
    expect(screen.getByLabelText('Blocked')).toBeTruthy();
  });

  it('renders the tag count with a label', async () => {
    await render(<ContactStatusStrip tagCount={3} />);
    expect(screen.getByLabelText('3 tags')).toBeTruthy();
    expect(screen.getByText('3')).toBeTruthy();
  });
});
