import { useSendStatusStore } from '@/features/chat/stores/use-send-status-store';
import {
  resetSendQueue,
  runInSendQueue,
  SEND_QUEUE_CONFIRM_TIMEOUT_MS,
  SEND_QUEUE_GAP_MS,
} from './send-queue';

/** Lets queued promise callbacks run without advancing fake time. */
async function flushPromises(): Promise<void> {
  for (let i = 0; i < 10; i += 1) await Promise.resolve();
}

describe('runInSendQueue', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    resetSendQueue();
    useSendStatusStore.setState({ sends: {} });
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('holds the second send until the channel answers the first', async () => {
    const calls: string[] = [];
    const store = useSendStatusStore.getState();
    store.startTracking('c-1', 'conv-a');
    store.startTracking('c-2', 'conv-a');

    void runInSendQueue('conv-a', 'c-1', async () => calls.push('c-1'));
    void runInSendQueue('conv-a', 'c-2', async () => calls.push('c-2'));
    await flushPromises();
    expect(calls).toEqual(['c-1']);

    // messageFailed { error: null } for the first send.
    store.stopTracking('c-1');
    await flushPromises();
    expect(calls).toEqual(['c-1']);

    jest.advanceTimersByTime(SEND_QUEUE_GAP_MS);
    await flushPromises();
    expect(calls).toEqual(['c-1', 'c-2']);
  });

  it('releases the next send after the timeout when no answer arrives', async () => {
    const calls: string[] = [];
    useSendStatusStore.getState().startTracking('c-1', 'conv-a');

    void runInSendQueue('conv-a', 'c-1', async () => calls.push('c-1'));
    void runInSendQueue('conv-a', 'c-2', async () => calls.push('c-2'));
    await flushPromises();

    jest.advanceTimersByTime(SEND_QUEUE_CONFIRM_TIMEOUT_MS);
    await flushPromises();
    jest.advanceTimersByTime(SEND_QUEUE_GAP_MS);
    await flushPromises();
    expect(calls).toEqual(['c-1', 'c-2']);
  });

  it('lets the next send go at once when the previous request failed', async () => {
    const calls: string[] = [];
    useSendStatusStore.getState().startTracking('c-1', 'conv-a');

    const first = runInSendQueue('conv-a', 'c-1', async () => {
      throw new Error('network');
    });
    void runInSendQueue('conv-a', 'c-2', async () => calls.push('c-2'));

    await expect(first).rejects.toThrow('network');
    await flushPromises();
    expect(calls).toEqual(['c-2']);
  });

  it('does not hold sends in a different conversation', async () => {
    const calls: string[] = [];
    useSendStatusStore.getState().startTracking('c-1', 'conv-a');

    void runInSendQueue('conv-a', 'c-1', async () => calls.push('c-1'));
    void runInSendQueue('conv-b', 'c-2', async () => calls.push('c-2'));
    await flushPromises();

    expect(calls).toEqual(['c-1', 'c-2']);
  });
});
