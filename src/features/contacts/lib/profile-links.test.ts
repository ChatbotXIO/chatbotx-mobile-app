import { getProfileLinks } from './profile-links';

describe('getProfileLinks', () => {
  it('links Instagram by handle', () => {
    expect(
      getProfileLinks({
        contactInboxes: [{ channel: 'instagram', sourceId: 'igsid', sourceUsername: 'jane.doe' }],
      }),
    ).toEqual([
      {
        channel: 'instagram',
        channelName: 'Instagram',
        label: '@jane.doe',
        url: 'https://www.instagram.com/jane.doe',
      },
    ]);
  });

  it.each([
    ['telegram', 'https://t.me/jane'],
    ['tiktok', 'https://www.tiktok.com/@jane'],
    ['threads', 'https://www.threads.net/@jane'],
  ])('links %s once a handle is captured', (channel, url) => {
    const [link] = getProfileLinks({
      contactInboxes: [{ channel, sourceId: 'id', sourceUsername: '@jane' }],
    });
    expect(link?.url).toBe(url);
    expect(link?.label).toBe('@jane');
  });

  it('links Threads by its sourceId, which is the username', () => {
    const [link] = getProfileLinks({
      contactInboxes: [{ channel: 'threads', sourceId: 'jane.doe', sourceUsername: null }],
    });
    expect(link).toMatchObject({ label: '@jane.doe', url: 'https://www.threads.net/@jane.doe' });
  });

  it('does not treat a numeric id as a handle on other channels', () => {
    expect(
      getProfileLinks({ contactInboxes: [{ channel: 'telegram', sourceId: '123456789' }] }),
    ).toEqual([]);
  });

  it('links WhatsApp by the contact phone number', () => {
    const [link] = getProfileLinks({
      phoneNumber: '+84 912 345 678',
      contactInboxes: [{ channel: 'whatsapp', sourceId: 'VN.123abc' }],
    });
    expect(link).toMatchObject({ label: '+84912345678', url: 'https://wa.me/84912345678' });
  });

  it('falls back to a numeric WhatsApp sourceId and skips a business-scoped id', () => {
    expect(
      getProfileLinks({ contactInboxes: [{ channel: 'whatsapp', sourceId: '84912345678' }] })[0]
        ?.url,
    ).toBe('https://wa.me/84912345678');
    expect(
      getProfileLinks({ contactInboxes: [{ channel: 'whatsapp', sourceId: 'VN.123abc' }] }),
    ).toEqual([]);
  });

  it('has no link for channels without a public profile or a captured handle', () => {
    expect(
      getProfileLinks({
        contactInboxes: [
          { channel: 'messenger', sourceId: 'psid' },
          { channel: 'zalo', sourceId: 'zid' },
          { channel: 'instagram', sourceId: 'igsid', sourceUsername: null },
        ],
      }),
    ).toEqual([]);
  });

  it('keeps one link per channel', () => {
    const links = getProfileLinks({
      contactInboxes: [
        { channel: 'instagram', sourceId: 'a', sourceUsername: 'first' },
        { channel: 'instagram', sourceId: 'b', sourceUsername: 'second' },
      ],
    });
    expect(links.map((l) => l.label)).toEqual(['@first']);
  });
});
