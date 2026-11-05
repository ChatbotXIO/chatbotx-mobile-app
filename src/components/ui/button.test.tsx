import { render, screen } from '@testing-library/react-native';
import { Text as RNText } from 'react-native';

import { initI18n } from '@/i18n';

import { Button } from './button';

beforeAll(() => {
  initI18n();
});

describe('Button', () => {
  it('renders the leading node alongside the label', async () => {
    await render(<Button label="Continue" leading={<RNText>logo</RNText>} onPress={() => {}} />);

    expect(screen.getByText('logo')).toBeTruthy();
    expect(screen.getByText('Continue')).toBeTruthy();
  });

  it('prefers leading over icon when both are given', async () => {
    await render(
      <Button label="Go" icon="mail" leading={<RNText>custom</RNText>} onPress={() => {}} />,
    );

    expect(screen.getByText('custom')).toBeTruthy();
  });
});
