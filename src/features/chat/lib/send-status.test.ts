import type { Message } from '@/features/chat/api/use-messages-infinite';

import { DELIVERY_FAILED_ERROR_KIND, resolveSendStatus } from './send-status';

function message(overrides: Record<string, unknown> = {}): Message {
  return {
    id: 'm-1',
    clientId: 'c-1',
    sendError: null,
    attachments: [],
    ...overrides,
  } as unknown as Message;
}

describe('resolveSendStatus', () => {
  it('is sending while the create request is in flight', () => {
    expect(resolveSendStatus(message({ __optimisticStatus: 'pending' }), false)).toEqual({
      status: 'sending',
    });
  });

  it('stays sending after the server accepted the request until the channel answers', () => {
    expect(resolveSendStatus(message(), true)).toEqual({ status: 'sending' });
  });

  it('is sent once the channel answered without an error', () => {
    expect(resolveSendStatus(message(), false)).toEqual({ status: 'sent' });
  });

  it('is a retryable failure for a local row the server removed', () => {
    const removed = message({
      __optimisticStatus: 'failed',
      __optimisticError: DELIVERY_FAILED_ERROR_KIND,
    });
    expect(resolveSendStatus(removed, false)).toEqual({
      status: 'failed',
      retryable: true,
      errorKind: DELIVERY_FAILED_ERROR_KIND,
    });
  });

  it('shows the channel error of a server row without offering a duplicate-creating retry', () => {
    const rejected = message({ sendError: 'Outside of allowed window' });
    expect(resolveSendStatus(rejected, true)).toEqual({
      status: 'failed',
      retryable: false,
      errorText: 'Outside of allowed window',
    });
  });
});
