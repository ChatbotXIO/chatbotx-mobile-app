import { fireEvent, render, screen } from '@testing-library/react-native';

import { initI18n } from '@/i18n';

import { ToggleRow } from './toggle-row';

beforeAll(() => {
  initI18n();
});

describe('ToggleRow', () => {
  it('exposes switch role and checked accessibility state', async () => {
    await render(<ToggleRow label="Push notifications" value onValueChange={() => {}} />);

    const control = screen.getByRole('switch', { name: 'Push notifications' });
    expect(control.props.accessibilityState).toMatchObject({ checked: true });
  });

  it('reflects unchecked state', async () => {
    await render(<ToggleRow label="Push notifications" value={false} onValueChange={() => {}} />);

    const control = screen.getByRole('switch', { name: 'Push notifications' });
    expect(control.props.accessibilityState).toMatchObject({ checked: false });
  });

  it('calls onValueChange with the new value when toggled', async () => {
    const onValueChange = jest.fn();
    await render(
      <ToggleRow label="Push notifications" value={false} onValueChange={onValueChange} />,
    );

    fireEvent(screen.getByRole('switch', { name: 'Push notifications' }), 'valueChange', true);

    expect(onValueChange).toHaveBeenCalledWith(true);
  });
});
