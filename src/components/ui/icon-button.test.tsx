import { fireEvent, render, screen } from '@testing-library/react-native';

import { initI18n } from '@/i18n';

import { IconButton } from './icon-button';

beforeAll(() => {
  initI18n();
});

describe('IconButton', () => {
  it('exposes the required accessibilityLabel and button role', async () => {
    await render(
      <IconButton accessibilityLabel="Close conversation" icon="close" onPress={() => {}} />,
    );

    const button = screen.getByRole('button', { name: 'Close conversation' });
    expect(button).toBeTruthy();
  });

  it('calls onPress when pressed', async () => {
    const onPress = jest.fn();
    await render(
      <IconButton accessibilityLabel="Archive" icon="archive-outline" onPress={onPress} />,
    );

    fireEvent.press(screen.getByRole('button', { name: 'Archive' }));

    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it('marks itself disabled via accessibilityState when loading', async () => {
    await render(<IconButton accessibilityLabel="Send" icon="send" loading onPress={() => {}} />);

    const button = screen.getByRole('button', { name: 'Send' });
    expect(button.props.accessibilityState).toMatchObject({ disabled: true, busy: true });
  });

  it('does not call onPress when disabled', async () => {
    const onPress = jest.fn();
    await render(
      <IconButton accessibilityLabel="Delete" icon="trash-outline" disabled onPress={onPress} />,
    );

    fireEvent.press(screen.getByRole('button', { name: 'Delete' }));

    expect(onPress).not.toHaveBeenCalled();
  });
});
