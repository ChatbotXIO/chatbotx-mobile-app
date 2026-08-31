import { fireEvent, render, screen } from '@testing-library/react-native';

import { initI18n } from '@/i18n';

import { Avatar } from './avatar';

beforeAll(() => {
  initI18n();
});

describe('Avatar', () => {
  it('renders initials fallback when uri is absent', async () => {
    await render(<Avatar name="My Hoang Phan Tuong" />);

    expect(screen.getByText('MT')).toBeTruthy();
  });

  it('renders the image with contentFit="contain" when uri is provided', async () => {
    await render(<Avatar uri="https://example.com/photo.jpg" name="Jane Doe" />);

    const image = screen.getByTestId('avatar-image');
    expect(image.props.contentFit).toBe('contain');
  });

  it('renders the initials fallback after the image fires onError', async () => {
    await render(<Avatar uri="https://example.com/broken.jpg" name="Jane Doe" />);

    const image = screen.getByTestId('avatar-image');
    await fireEvent(image, 'onError', { nativeEvent: { error: 'load failed' } });

    expect(screen.getByText('JD')).toBeTruthy();
    expect(screen.queryByTestId('avatar-image')).toBeNull();
  });
});
