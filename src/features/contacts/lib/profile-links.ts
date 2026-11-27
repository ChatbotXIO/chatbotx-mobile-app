interface ContactInboxIdentity {
  channel: string;
  sourceId: string;
  sourceUsername?: string | null;
  /** The connected page/account the contact reached us on. */
  inbox?: { name?: string | null } | null;
}

interface ContactIdentity {
  phoneNumber?: string | null;
  contactInboxes?: readonly ContactInboxIdentity[];
}

export interface ProfileLink {
  channel: string;
  /** Brand name of the channel — not translated. */
  channelName: string;
  /** What the user sees: `@handle` or a phone number. */
  label: string;
  url: string;
}

/** Channels whose public profile is addressed by a handle. The backend records the handle as the
 * contact inbox's `sourceUsername` (today Instagram; the others link as soon as it is captured). */
const HANDLE_PROFILES: Record<string, { name: string; url: (handle: string) => string }> = {
  instagram: { name: 'Instagram', url: (h) => `https://www.instagram.com/${h}` },
  telegram: { name: 'Telegram', url: (h) => `https://t.me/${h}` },
  tiktok: { name: 'TikTok', url: (h) => `https://www.tiktok.com/@${h}` },
  threads: { name: 'Threads', url: (h) => `https://www.threads.net/@${h}` },
};

/** wa.me takes the full international number as digits only. */
const WHATSAPP_NUMBER = /^\d{7,15}$/;

/** A WhatsApp contact's number: the contact's phone, else the inbox `sourceId` when it is a phone
 * number (it can also be a business-scoped user id for a contact who hides their number). */
function whatsappNumber(contact: ContactIdentity, inbox: ContactInboxIdentity): string | null {
  for (const candidate of [contact.phoneNumber, inbox.sourceId]) {
    const digits = candidate?.replace(/[\s()+-]/g, '') ?? '';
    if (WHATSAPP_NUMBER.test(digits)) return digits;
  }
  return null;
}

/** Channels that key the contact inbox by the handle itself, leaving `sourceUsername` empty: a
 * Threads commenter's `sourceId` is their lowercased username. */
const HANDLE_IS_SOURCE_ID: ReadonlySet<string> = new Set(['threads']);

function handleOf(inbox: ContactInboxIdentity): string | undefined {
  const raw =
    inbox.sourceUsername || (HANDLE_IS_SOURCE_ID.has(inbox.channel) ? inbox.sourceId : undefined);
  return raw?.trim().replace(/^@/, '') || undefined;
}

function linkFor(contact: ContactIdentity, inbox: ContactInboxIdentity): ProfileLink | null {
  const handleProfile = HANDLE_PROFILES[inbox.channel];
  const handle = handleOf(inbox);
  if (handleProfile && handle) {
    return {
      channel: inbox.channel,
      channelName: handleProfile.name,
      label: `@${handle}`,
      url: handleProfile.url(encodeURIComponent(handle)),
    };
  }
  if (inbox.channel === 'whatsapp') {
    const number = whatsappNumber(contact, inbox);
    if (!number) return null;
    return {
      channel: 'whatsapp',
      channelName: 'WhatsApp',
      label: `+${number}`,
      url: `https://wa.me/${number}`,
    };
  }
  // Messenger, Zalo, LINE, webchat, email, ... identify the contact by an app- or page-scoped id
  // only: there is no public profile to open.
  return null;
}

/** One link per channel that has a public profile for this contact, in inbox order. */
export function getProfileLinks(contact: ContactIdentity): ProfileLink[] {
  const links: ProfileLink[] = [];
  const seen = new Set<string>();
  for (const inbox of contact.contactInboxes ?? []) {
    if (seen.has(inbox.channel)) continue;
    const link = linkFor(contact, inbox);
    if (!link) continue;
    seen.add(inbox.channel);
    links.push(link);
  }
  return links;
}
