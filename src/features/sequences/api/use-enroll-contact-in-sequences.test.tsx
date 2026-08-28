import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook, waitFor } from '@testing-library/react-native';
import { act } from 'react';
import type { PropsWithChildren } from 'react';

import { useEnrollContactInSequences } from './use-enroll-contact-in-sequences';

// `FEATURES.sendSequence` is hardcoded `false` in src/config/features.ts — this hook must refuse
// to execute (and never reach `fetch`) while that's the case, per its own doc comment.
const originalFetch = global.fetch;

afterEach(() => {
  global.fetch = originalFetch;
});

function wrapper(queryClient: QueryClient) {
  return function Wrapper({ children }: PropsWithChildren) {
    return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
  };
}

describe('useEnrollContactInSequences', () => {
  it('throws before any network call while FEATURES.sendSequence is off', async () => {
    const fetchSpy = jest.fn();
    global.fetch = fetchSpy as unknown as typeof fetch;
    const queryClient = new QueryClient();

    const { result } = await renderHook(() => useEnrollContactInSequences('ws-1', 'contact-1'), {
      wrapper: wrapper(queryClient),
    });

    act(() => {
      result.current.mutate(['seq-1']);
    });

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(fetchSpy).not.toHaveBeenCalled();
    expect(result.current.error).toBeInstanceOf(Error);

    queryClient.clear();
    queryClient.unmount();
  });
});
