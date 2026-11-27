import { getChannelRows } from './channel-rows';

describe('getChannelRows', () => {
  it('returns one row per channel, deduplicated, in input order', () => {
    const rows = getChannelRows({}, ['messenger', 'zalo', 'messenger']);

    expect(rows.map((row) => row.channel)).toEqual(['messenger', 'zalo']);
  });

  it('attaches the handle and url to a channel that has a profile link', () => {
    const rows = getChannelRows(
      { contactInboxes: [{ channel: 'instagram', sourceId: '1', sourceUsername: 'sanu' }] },
      ['instagram', 'messenger'],
    );

    expect(rows).toEqual([
      {
        channel: 'instagram',
        name: 'Instagram',
        detail: '@sanu',
        inboxName: null,
        url: 'https://www.instagram.com/sanu',
      },
      { channel: 'messenger', name: 'Messenger', detail: null, inboxName: null, url: null },
    ]);
  });

  it('includes a linked channel even when the channels list omits it', () => {
    const rows = getChannelRows(
      { contactInboxes: [{ channel: 'telegram', sourceId: '1', sourceUsername: 'abc' }] },
      [],
    );

    expect(rows.map((row) => row.channel)).toEqual(['telegram']);
  });

  it('falls back to the raw channel key for an unknown channel', () => {
    const rows = getChannelRows({}, ['line']);

    expect(rows[0]).toMatchObject({ channel: 'line', name: 'line', url: null });
  });

  it('returns no rows when the contact has no channels', () => {
    expect(getChannelRows({}, [])).toEqual([]);
  });
});

describe('getChannelRows inbox name', () => {
  it('carries the connected page name for the channel', () => {
    const rows = getChannelRows(
      { contactInboxes: [{ channel: 'zalo', sourceId: '1', inbox: { name: 'AhaChat' } }] },
      ['zalo'],
    );

    expect(rows[0]).toMatchObject({ channel: 'zalo', inboxName: 'AhaChat' });
  });
});
