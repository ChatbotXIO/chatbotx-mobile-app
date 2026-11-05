import { fireEvent, render, screen } from '@testing-library/react-native';

import { initI18n } from '@/i18n';

import { TextField } from './text-field';

beforeAll(() => {
  initI18n();
});

describe('TextField', () => {
  it('renders with a leading icon and still accepts input', async () => {
    const onChangeText = jest.fn();
    await render(
      <TextField
        label="Email"
        placeholder="name@company.com"
        leadingIcon="mail"
        onChangeText={onChangeText}
      />,
    );

    fireEvent.changeText(screen.getByPlaceholderText('name@company.com'), 'a@b.co');

    expect(onChangeText).toHaveBeenCalledWith('a@b.co');
  });
});
