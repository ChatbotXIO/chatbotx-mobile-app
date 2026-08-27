import { render, screen } from '@testing-library/react-native';

import { initI18n } from '@/i18n';
import type { Message } from '@/features/chat/api/use-messages-infinite';

import { MessageBubble } from './message-bubble';

// expo-router's full module (pulled in transitively via attachment-view.tsx's `router.push` for
// the image viewer) drags in its native-stack navigator, which in turn imports expo-glass-effect's
// native view manager — unavailable under Jest ("requireNativeViewManager is not available").
// This component only needs the imperative `router.push` call, so a minimal stand-in is enough;
// no navigation actually needs to occur in these tests. jest.mock calls are hoisted above imports
// by babel-jest regardless of source position, so this placement (after the imports, for readable
// import ordering) is functionally identical to placing it first.
jest.mock('expo-router', () => ({
  __esModule: true,
  router: { push: jest.fn(), back: jest.fn() },
}));

beforeAll(() => {
  initI18n();
});

function fakeMessage(overrides: Partial<Message> = {}): Message {
  return {
    id: 'm-1',
    createdAt: '2026-01-01T12:00:00.000Z',
    updatedAt: '2026-01-01T12:00:00.000Z',
    conversationId: 'conv-1',
    workspaceId: 'ws-1',
    contactInboxId: '',
    text: 'Hello there',
    contentAttributes: null,
    messageType: 'outgoing',
    contentType: 'text',
    senderType: 'user',
    sourceId: null,
    deletedAt: null,
    type: 'message',
    parentId: null,
    attributes: null,
    sendError: null,
    attachments: [],
    ...overrides,
  } as unknown as Message;
}

const NO_OP = () => {};

describe('MessageBubble', () => {
  it('renders message text', async () => {
    await render(
      <MessageBubble
        message={fakeMessage({ text: 'Hello there' })}
        position="single"
        showMeta
        messagesById={new Map()}
        onLongPress={NO_OP}
        onRetry={NO_OP}
      />,
    );

    expect(screen.getByText('Hello there')).toBeTruthy();
  });

  it('renders a deleted-message placeholder instead of the original text', async () => {
    await render(
      <MessageBubble
        message={fakeMessage({ text: 'secret stuff', deletedAt: '2026-01-01T12:05:00.000Z' })}
        position="single"
        showMeta
        messagesById={new Map()}
        onLongPress={NO_OP}
        onRetry={NO_OP}
      />,
    );

    expect(screen.getByText('Message deleted')).toBeTruthy();
    expect(screen.queryByText('secret stuff')).toBeNull();
  });

  it('shows the failed-to-send label for a failed optimistic bubble', async () => {
    const failedMessage = {
      ...fakeMessage({ text: 'oops' }),
      __optimisticStatus: 'failed',
      __optimisticError: 'Network error',
    } as unknown as Message;

    await render(
      <MessageBubble
        message={failedMessage}
        position="single"
        showMeta
        messagesById={new Map()}
        onLongPress={NO_OP}
        onRetry={NO_OP}
      />,
    );

    expect(screen.getByText('Network error')).toBeTruthy();
  });

  it('renders a quoted reply preview when parentId resolves in messagesById', async () => {
    const parent = fakeMessage({ id: 'parent-1', text: 'original message' });
    const messagesById = new Map([['parent-1', parent]]);

    await render(
      <MessageBubble
        message={fakeMessage({ text: 'a reply', parentId: 'parent-1' })}
        position="single"
        showMeta
        messagesById={messagesById}
        onLongPress={NO_OP}
        onRetry={NO_OP}
      />,
    );

    expect(screen.getByText('original message')).toBeTruthy();
    expect(screen.getByText('a reply')).toBeTruthy();
  });

  it('renders the "unavailable" fallback when parentId does not resolve', async () => {
    await render(
      <MessageBubble
        message={fakeMessage({ text: 'a reply', parentId: 'missing-parent' })}
        position="single"
        showMeta
        messagesById={new Map()}
        onLongPress={NO_OP}
        onRetry={NO_OP}
      />,
    );

    expect(screen.getByText('Original message unavailable')).toBeTruthy();
  });

  it('renders a centered activity chip for messageType "activity" instead of a bubble', async () => {
    await render(
      <MessageBubble
        message={fakeMessage({ messageType: 'activity', text: 'Conversation archived' })}
        position="single"
        showMeta
        messagesById={new Map()}
        onLongPress={NO_OP}
        onRetry={NO_OP}
      />,
    );

    expect(screen.getByText('Conversation archived')).toBeTruthy();
  });
});
