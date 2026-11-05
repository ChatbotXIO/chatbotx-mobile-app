import { render } from '@testing-library/react-native';
import type * as ReactType from 'react';

import type { Message } from '@/features/chat/api/use-messages-infinite';

import { MessageList } from './message-list';

const mockScrollToEnd = jest.fn();

jest.mock('@shopify/flash-list', () => {
  const React = jest.requireActual<typeof ReactType>('react');
  const FlashList = React.forwardRef(function FlashList(
    _props: unknown,
    ref: ReactType.ForwardedRef<{ scrollToEnd: typeof mockScrollToEnd }>,
  ) {
    React.useImperativeHandle(ref, () => ({ scrollToEnd: mockScrollToEnd }));
    return null;
  });

  return { FlashList };
});

jest.mock('@/components/ui/date-separator', () => ({ DateSeparator: () => null }));
jest.mock('@/components/ui/empty-state', () => ({ EmptyState: () => null }));
jest.mock('@/components/ui/skeleton', () => ({ Skeleton: () => null }));
jest.mock('./message-bubble', () => ({ MessageBubble: () => null }));
jest.mock('./scroll-to-bottom-fab', () => ({ ScrollToBottomFab: () => null }));
jest.mock('./typing-indicator', () => ({ TypingIndicator: () => null }));
jest.mock('react-i18next', () => ({ useTranslation: () => ({ t: (key: string) => key }) }));

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

describe('MessageList', () => {
  beforeEach(() => {
    mockScrollToEnd.mockReset();
  });
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('scrolls to the newest message after the initially loaded rows mount', async () => {
    let scheduledFrame: FrameRequestCallback | undefined;
    jest.spyOn(global, 'requestAnimationFrame').mockImplementation((callback) => {
      scheduledFrame = callback;
      return 1;
    });

    await render(
      <MessageList
        messages={[fakeMessage()]}
        isLoading={false}
        hasNextPage={false}
        isFetchingNextPage={false}
        conversationId="conv-1"
        onLoadOlder={jest.fn()}
        onLongPressMessage={jest.fn()}
        onRetryMessage={jest.fn()}
      />,
    );

    expect(scheduledFrame).toBeDefined();

    scheduledFrame?.(0);

    expect(mockScrollToEnd).toHaveBeenCalledWith({ animated: false });
  });
});
