import { fireEvent, render, screen } from '@testing-library/react-native';

import { initI18n } from '@/i18n';

import { Chip } from './chip';

beforeAll(() => {
  initI18n();
});

describe('Chip', () => {
  it('reflects selected state via accessibilityState', async () => {
    await render(<Chip label="Unread" selected onPress={() => {}} />);

    const chip = screen.getByRole('button', { name: 'Unread' });
    expect(chip.props.accessibilityState).toMatchObject({ selected: true, disabled: false });
  });

  it('reflects unselected state via accessibilityState', async () => {
    await render(<Chip label="Unread" selected={false} onPress={() => {}} />);

    const chip = screen.getByRole('button', { name: 'Unread' });
    expect(chip.props.accessibilityState).toMatchObject({ selected: false });
  });

  it('calls onPress when tapped', async () => {
    const onPress = jest.fn();
    await render(<Chip label="Bot" onPress={onPress} />);

    fireEvent.press(screen.getByRole('button', { name: 'Bot' }));

    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it('calls onRemove when the remove button is tapped, without triggering onPress', async () => {
    const onPress = jest.fn();
    const onRemove = jest.fn();
    await render(<Chip label="VIP" onPress={onPress} onRemove={onRemove} />);

    fireEvent.press(screen.getByRole('button', { name: 'Remove VIP' }));

    expect(onRemove).toHaveBeenCalledTimes(1);
    expect(onPress).not.toHaveBeenCalled();
  });

  it('renders without a remove button when onRemove is omitted', async () => {
    await render(<Chip label="Archived" />);

    expect(screen.queryAllByRole('button')).toHaveLength(0);
  });
});
