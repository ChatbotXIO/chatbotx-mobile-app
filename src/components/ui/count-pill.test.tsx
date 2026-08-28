import { render, screen } from '@testing-library/react-native';

import { initI18n } from '@/i18n';

import { CountPill } from './count-pill';

beforeAll(() => {
  initI18n();
});

describe('CountPill', () => {
  it('renders the raw count when under the cap', async () => {
    await render(<CountPill count={7} />);

    expect(screen.getByText('7')).toBeTruthy();
  });

  it('renders "{max}+" when the count exceeds the default cap of 99', async () => {
    await render(<CountPill count={140} />);

    expect(screen.getByText('99+')).toBeTruthy();
  });

  it('respects a custom max', async () => {
    await render(<CountPill count={12} max={9} />);

    expect(screen.getByText('9+')).toBeTruthy();
  });

  it('renders nothing when count is 0', async () => {
    const { toJSON } = await render(<CountPill count={0} />);

    expect(toJSON()).toBeNull();
  });
});
