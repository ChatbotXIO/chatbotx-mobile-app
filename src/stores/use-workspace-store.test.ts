import { useWorkspaceStore } from '@/stores/use-workspace-store';

beforeEach(() => {
  useWorkspaceStore.setState({ currentWorkspaceId: null });
});

describe('useWorkspaceStore', () => {
  it('starts with no current workspace', () => {
    expect(useWorkspaceStore.getState().currentWorkspaceId).toBeNull();
  });

  it('setCurrentWorkspaceId updates the id', () => {
    useWorkspaceStore.getState().setCurrentWorkspaceId('w1');
    expect(useWorkspaceStore.getState().currentWorkspaceId).toBe('w1');
  });

  it('setCurrentWorkspaceId can clear back to null', () => {
    useWorkspaceStore.getState().setCurrentWorkspaceId('w1');
    useWorkspaceStore.getState().setCurrentWorkspaceId(null);
    expect(useWorkspaceStore.getState().currentWorkspaceId).toBeNull();
  });
});
