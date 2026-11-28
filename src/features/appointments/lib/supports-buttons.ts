/** Channels that can't render a button template, so a booking-link message wouldn't arrive as a
 * tappable link. */
const CHANNELS_WITHOUT_BUTTONS = new Set(['email', 'tiktok']);

export function channelSupportsButtons(channel: string | undefined): boolean {
  return channel !== undefined && !CHANNELS_WITHOUT_BUTTONS.has(channel);
}
