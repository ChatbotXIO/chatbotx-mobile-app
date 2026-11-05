import type { ConversationListItem } from '@/features/conversations/api/use-conversations-infinite';

type LastMessage = ConversationListItem['messages'][number];

export type PreviewSender = 'you' | 'bot' | null;
export type PreviewAttachmentType = 'image' | 'video' | 'audio' | 'gif' | 'file';

export type ConversationPreview =
  | { kind: 'empty' }
  | { kind: 'failed'; sender: PreviewSender }
  | { kind: 'deleted' }
  | { kind: 'attachment'; sender: PreviewSender; attachmentType: PreviewAttachmentType }
  | { kind: 'text'; sender: PreviewSender; text: string };

function senderOf(message: Pick<LastMessage, 'senderType'>): PreviewSender {
  if (message.senderType === 'bot') return 'bot';
  if (message.senderType === 'user' || message.senderType === 'api') return 'you';
  return null;
}

/** Describes what a row's second line should say, without any copy — the component maps it to
 * translated strings. Order matters: a failed send and a deletion win over the body. */
export function describeConversationPreview(conversation: {
  messages: ConversationListItem['messages'];
}): ConversationPreview {
  const message = conversation.messages[conversation.messages.length - 1];
  if (!message) return { kind: 'empty' };

  const sender = senderOf(message);
  if (message.sendError) return { kind: 'failed', sender };
  if (message.deletedAt) return { kind: 'deleted' };
  if (message.text) return { kind: 'text', sender, text: message.text };
  if (message.attachmentCount || message.attachments?.length) {
    return {
      kind: 'attachment',
      sender,
      attachmentType: message.attachments?.[0]?.fileType ?? 'file',
    };
  }
  return { kind: 'empty' };
}
