import { render, screen } from '@testing-library/react-native';

import { Icon, type IconName } from './icon';

const ICON_NAMES: IconName[] = [
  'archive',
  'archive-x',
  'app-window',
  'bell',
  'bot',
  'bot-off',
  'building-2',
  'calendar-clock',
  'calendar-days',
  'camera',
  'check',
  'chevron-down',
  'chevron-left',
  'chevron-right',
  'circle',
  'circle-alert',
  'circle-check',
  'circle-plus',
  'circle-x',
  'clock',
  'cloud-off',
  'compass',
  'ellipsis-vertical',
  'eye',
  'eye-off',
  'file',
  'file-text',
  'globe',
  'hash',
  'heart',
  'image',
  'inbox',
  'info',
  'layers-2',
  'list-filter',
  'lock',
  'mail',
  'mail-open',
  'map-pin',
  'message-circle',
  'message-circle-more',
  'message-square-more',
  'message-square-text',
  'messages-square',
  'moon',
  'music',
  'paperclip',
  'pencil',
  'phone',
  'refresh-cw',
  'reply',
  'save',
  'save-off',
  'search',
  'send-horizontal',
  'settings',
  'square',
  'square-check',
  'square-pen',
  'star',
  'star-off',
  'sun',
  'tag',
  'trash-2',
  'triangle-alert',
  'type',
  'user',
  'user-check',
  'user-lock',
  'user-minus',
  'user-plus',
  'user-round-x',
  'users',
  'users-round',
  'video',
  'webhook',
  'workflow',
  'x',
];

describe('Icon', () => {
  it.each(ICON_NAMES)('renders "%s" without throwing', async (name) => {
    await expect(render(<Icon name={name} color="#000" />)).resolves.toBeTruthy();
  });

  it('passes fill=color when filled is true', async () => {
    await render(<Icon name="star" color="#f00" filled />);
    expect(JSON.stringify(screen.toJSON())).toContain('"fill":"#f00"');
  });

  it('defaults to fill="none" when not filled', async () => {
    await render(<Icon name="star" color="#f00" />);
    expect(JSON.stringify(screen.toJSON())).toContain('"fill":"none"');
  });

  it('throws in dev mode for an unknown icon name', async () => {
    await expect(
      render(<Icon name={'not-a-real-icon' as IconName} color="#000" />),
    ).rejects.toThrow();
  });
});
