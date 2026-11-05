import { describeConversationPreview } from './conversation-preview';

type Messages = Parameters<typeof describeConversationPreview>[0]['messages'];
const withMessage = (overrides: Record<string, unknown>) =>
  ({
    messages: [
      { text: null, senderType: 'contact', sendError: null, deletedAt: null, ...overrides },
    ],
  }) as unknown as { messages: Messages };

describe('describeConversationPreview', () => {
  it('is empty without messages', () => {
    expect(describeConversationPreview({ messages: [] })).toEqual({ kind: 'empty' });
  });

  it('has no sender prefix for contact text', () => {
    expect(describeConversationPreview(withMessage({ text: 'hi' }))).toEqual({
      kind: 'text',
      sender: null,
      text: 'hi',
    });
  });

  it('prefixes agent and bot messages', () => {
    expect(
      describeConversationPreview(withMessage({ text: 'a', senderType: 'user' })),
    ).toMatchObject({ sender: 'you' });
    expect(
      describeConversationPreview(withMessage({ text: 'a', senderType: 'bot' })),
    ).toMatchObject({ sender: 'bot' });
  });

  it('describes attachments by file type, defaulting to file', () => {
    expect(
      describeConversationPreview(
        withMessage({ attachmentCount: 1, attachments: [{ fileType: 'image' }] }),
      ),
    ).toMatchObject({ kind: 'attachment', attachmentType: 'image' });
    expect(describeConversationPreview(withMessage({ attachmentCount: 2 }))).toMatchObject({
      kind: 'attachment',
      attachmentType: 'file',
    });
  });

  it('prefers failed sends and deletions over the body', () => {
    expect(
      describeConversationPreview(
        withMessage({ text: 'x', sendError: 'boom', senderType: 'user' }),
      ),
    ).toEqual({ kind: 'failed', sender: 'you' });
    expect(
      describeConversationPreview(withMessage({ text: 'x', deletedAt: '2025-01-01T00:00:00Z' })),
    ).toEqual({ kind: 'deleted' });
  });
});
