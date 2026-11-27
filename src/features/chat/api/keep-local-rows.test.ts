import { keepLocalRows, type ListMessagesResponse, type Message } from './use-messages-infinite';

function page(messages: Record<string, unknown>[]): ListMessagesResponse {
  return {
    data: messages as Message[],
    nextCursor: null,
    prevCursor: null,
  } as ListMessagesResponse;
}

describe('keepLocalRows', () => {
  it('keeps a failed local row the server no longer returns', () => {
    const previous = {
      pages: [
        page([{ id: 'tmp', clientId: 'c-1', __optimisticStatus: 'failed' }, { id: 'srv-1' }]),
      ],
      pageParams: [undefined],
    };

    const result = keepLocalRows(previous, page([{ id: 'srv-1' }]));

    expect(result.data.map((m) => m.id)).toEqual(['tmp', 'srv-1']);
  });

  it('drops a local row once the server returns its clientId', () => {
    const previous = {
      pages: [page([{ id: 'tmp', clientId: 'c-1', __optimisticStatus: 'pending' }])],
      pageParams: [undefined],
    };

    const result = keepLocalRows(previous, page([{ id: 'srv-1', clientId: 'c-1' }]));

    expect(result.data.map((m) => m.id)).toEqual(['srv-1']);
  });

  it('returns the fresh page unchanged when nothing was cached', () => {
    const fresh = page([{ id: 'srv-1' }]);
    expect(keepLocalRows(undefined, fresh)).toBe(fresh);
  });

  it('drops a reconciled local row once the server returns its id, keeping the clientId', () => {
    // The server never returns clientId; the create response already gave the row its server id.
    const previous = {
      pages: [page([{ id: 'srv-1', clientId: 'c-1' }])],
      pageParams: [undefined],
    };

    const result = keepLocalRows(previous, page([{ id: 'srv-1' }, { id: 'srv-0' }]));

    expect(result.data).toEqual([{ id: 'srv-1', clientId: 'c-1' }, { id: 'srv-0' }]);
  });

  it('drops a failed local row whose server id the refetch returns', () => {
    const previous = {
      pages: [page([{ id: 'srv-1', clientId: 'c-1', __optimisticStatus: 'failed' }])],
      pageParams: [undefined],
    };

    const result = keepLocalRows(previous, page([{ id: 'srv-1' }]));

    expect(result.data).toEqual([{ id: 'srv-1', clientId: 'c-1' }]);
  });
});
