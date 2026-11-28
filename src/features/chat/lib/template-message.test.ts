import { parseTemplate } from './template-message';

describe('parseTemplate', () => {
  it('returns null for non-template attributes', () => {
    expect(parseTemplate(null)).toBeNull();
    expect(parseTemplate([])).toBeNull();
    expect(parseTemplate({ type: 'other' })).toBeNull();
  });

  it('parses every button kind of a button template', () => {
    const parsed = parseTemplate({
      type: 'template',
      templateType: 'button',
      text: 'Book now',
      buttons: [
        { type: 'url', title: 'Open', url: 'https://x.test' },
        { type: 'phone', title: 'Call', phone: '+8412345' },
        { type: 'copy-code', title: 'Copy', code: 'ABC' },
        { type: 'postback', title: 'Reply', payload: 'p' },
        { type: 'url', title: 'Broken' },
      ],
    });
    expect(parsed).toEqual({
      kind: 'button',
      text: 'Book now',
      buttons: [
        { kind: 'url', title: 'Open', url: 'https://x.test' },
        { kind: 'phone', title: 'Call', phone: '+8412345' },
        { kind: 'copy-code', title: 'Copy', code: 'ABC' },
        { kind: 'postback', title: 'Reply' },
      ],
    });
  });

  it('returns null for a button template without usable buttons', () => {
    expect(parseTemplate({ type: 'template', templateType: 'button', buttons: [] })).toBeNull();
  });

  it('parses carousel cards and drops empty ones', () => {
    const parsed = parseTemplate({
      type: 'template',
      templateType: 'carousel',
      cards: [
        {
          title: 'A',
          subtitle: 'sub',
          imageUrl: 'https://img.test/a.png',
          buttons: [{ type: 'url', title: 'Go', url: 'https://x.test' }],
        },
        {},
      ],
    });
    expect(parsed).toEqual({
      kind: 'carousel',
      cards: [
        {
          title: 'A',
          subtitle: 'sub',
          imageUrl: 'https://img.test/a.png',
          buttons: [{ kind: 'url', title: 'Go', url: 'https://x.test' }],
        },
      ],
    });
  });
});
