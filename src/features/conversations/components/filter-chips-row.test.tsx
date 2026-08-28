import { render, screen } from '@testing-library/react-native';
import { StyleSheet } from 'react-native';

import { initI18n } from '@/i18n';

import { FilterChipsRow } from './filter-chips-row';

beforeAll(() => {
  initI18n();
});

describe('FilterChipsRow', () => {
  it('renders every quick-filter chip with "All" selected by default', async () => {
    await render(<FilterChipsRow />);

    for (const label of ['All', 'Unread', 'Mine', 'Bot handling', 'Following']) {
      expect(screen.getByText(label)).toBeTruthy();
    }
    expect(screen.getByRole('button', { name: 'All' }).props.accessibilityState).toMatchObject({
      selected: true,
    });
  });

  it('does not flex-grow, so it hugs its content instead of splitting the screen with the list', async () => {
    // RN's ScrollView base style is `flexGrow: 1`; inside the Inbox flex column that made the chips
    // row take half the screen (regression seen on device).
    await render(<FilterChipsRow />);

    const style = StyleSheet.flatten(screen.getByTestId('filter-chips-row').props.style);
    expect(style.flexGrow).toBe(0);
  });
});
