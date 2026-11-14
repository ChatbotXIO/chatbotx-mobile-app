import fs from 'node:fs';
import path from 'node:path';

const LOCALES_DIR = path.join(__dirname, 'locales');
const PLACEHOLDER = /\{\{\s*[\w.]+\s*\}\}/g;

type FlatMessages = Record<string, string>;

function flatten(value: unknown, prefix = '', out: FlatMessages = {}): FlatMessages {
  if (typeof value === 'string') {
    out[prefix] = value;
  } else if (value && typeof value === 'object') {
    for (const [key, child] of Object.entries(value)) {
      flatten(child, prefix ? `${prefix}.${key}` : key, out);
    }
  }
  return out;
}

function load(file: string): FlatMessages {
  return flatten(JSON.parse(fs.readFileSync(path.join(LOCALES_DIR, file), 'utf8')));
}

function placeholders(value: string): string[] {
  return (value.match(PLACEHOLDER) ?? []).map((p) => p.replace(/\s/g, '')).sort();
}

/** Keys whose value may legitimately equal the English copy in any locale: brand/channel names,
 * technical loanwords and placeholder-only strings. Anything else identical to `en` is an
 * untranslated string. */
const ALLOWED_SAME_AS_EN = new Set([
  'auth.email',
  'auth.emailPlaceholder',
  'auth.password',
  'settings.deleteAccountConfirmHint',
  'chat.botStatusOn',
  'chat.bubbleA11yLabel',
  'chat.camera',
  'chat.document',
  'chat.edit',
  'chat.send',
  'chat.sendFlow',
  'chat.senderBot',
  'chat.senderContact',
  'contacts.active',
  'contacts.assignedTags',
  'contacts.contactTitle',
  'contacts.email',
  'contacts.message',
  'contacts.tabInfo',
  'contacts.tabNotes',
  'contacts.tabTags',
  'contacts.tagsCount',
  'contacts.tagsCount_other',
  'contacts.title',
  'conversations.botOnOffLabel',
  'conversations.channelEmail',
  'conversations.channelInstagram',
  'conversations.channelMessenger',
  'conversations.channelOmnichannel',
  'conversations.channelTelegram',
  'conversations.channelTiktok',
  'conversations.channelWebchat',
  'conversations.channelWhatsapp',
  'conversations.channelZalo',
  'conversations.filters',
  'conversations.inboxTitle',
  'conversations.preview.audio',
  'conversations.preview.bot',
  'conversations.preview.file',
  'conversations.preview.gif',
  'conversations.preview.image',
  'conversations.preview.video',
  'conversations.quickFilterMine',
  'conversations.status',
  'conversations.title',
  'flows.nodes',
  'flows.nodes_other',
  'flows.title',
  'inbox.title',
  'notifications.androidChannelName',
  'profile.plan',
  'settings.notifications',
  'settings.restartLater',
  'settings.roleAgent',
  'settings.teams',
  'settings.themeSystem',
  'settings.version',
  'settings.workspace',
  'workspaces.title',
]);

const en = load('en.json');
const localeFiles = fs
  .readdirSync(LOCALES_DIR)
  .filter((file) => file.endsWith('.json') && file !== 'en.json');

describe.each(localeFiles)('locale %s', (file) => {
  const messages = load(file);

  it('has every key that en has', () => {
    expect(Object.keys(en).filter((key) => !(key in messages))).toEqual([]);
  });

  it('keeps {{placeholders}} identical to en', () => {
    const mismatched = Object.keys(en).filter(
      (key) =>
        key in messages && placeholders(messages[key]).join() !== placeholders(en[key]).join(),
    );
    expect(mismatched).toEqual([]);
  });

  it('has no untranslated English copies outside the allow-list', () => {
    const untranslated = Object.keys(en).filter(
      (key) => messages[key] === en[key] && !ALLOWED_SAME_AS_EN.has(key),
    );
    expect(untranslated).toEqual([]);
  });
});
