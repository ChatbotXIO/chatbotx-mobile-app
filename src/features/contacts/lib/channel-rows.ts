import { inboxNameOf } from '@/features/contacts/lib/inbox-name';
import { getProfileLinks } from '@/features/contacts/lib/profile-links';

type ProfileLinksInput = Parameters<typeof getProfileLinks>[0];

export interface ChannelRow {
  channel: string;
  /** Brand name of the channel — not translated. */
  name: string;
  /** `@handle` or phone number when the channel has a public profile, else null. */
  detail: string | null;
  /** Name of the connected page/account (e.g. "AhaChat"), or null when unknown. */
  inboxName: string | null;
  /** Profile URL to open, or null when the channel has no public profile. */
  url: string | null;
}

/** Display names for channels whose key is not already a readable name. Unmapped keys fall back to
 * the raw channel string rather than crashing. */
const CHANNEL_NAMES: Record<string, string> = {
  messenger: 'Messenger',
  instagram: 'Instagram',
  whatsapp: 'WhatsApp',
  tiktok: 'TikTok',
  telegram: 'Telegram',
  threads: 'Threads',
  zalo: 'Zalo',
  webchat: 'Web chat',
  email: 'Email',
  smtp: 'Email',
  sms: 'SMS',
  api: 'API',
  omnichannel: 'Omnichannel',
};

/** One row per channel the contact reached us on — deduplicated, in `channels` order, with any
 * linked channel the list omitted appended. Channels with a public profile carry a handle + url. */
export function getChannelRows(contact: ProfileLinksInput, channels: string[]): ChannelRow[] {
  const links = new Map(getProfileLinks(contact).map((link) => [link.channel, link]));
  const inboxNames = new Map<string, string>();
  for (const inbox of contact.contactInboxes ?? []) {
    const inboxName = inboxNameOf(inbox);
    if (inboxName && !inboxNames.has(inbox.channel)) inboxNames.set(inbox.channel, inboxName);
  }
  const keys = Array.from(new Set([...channels, ...links.keys()]));

  return keys.map((channel) => {
    const link = links.get(channel);
    return {
      channel,
      name: link?.channelName ?? CHANNEL_NAMES[channel] ?? channel,
      detail: link?.label ?? null,
      inboxName: inboxNames.get(channel) ?? null,
      url: link?.url ?? null,
    };
  });
}
