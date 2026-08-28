import { isWorkspaceQuery, queryKeys } from '@/api/query-keys';

describe('queryKeys', () => {
  it('builds workspace-scoped conversation list keys', () => {
    expect(queryKeys.ws.conversations.list('w1', { status: 'unread' })).toEqual([
      'ws',
      'w1',
      'conversations',
      'list',
      { status: 'unread' },
    ]);
  });

  it('builds global session/workspaces keys without a workspace id', () => {
    expect(queryKeys.session()).toEqual(['session']);
    expect(queryKeys.workspaces()).toEqual(['workspaces']);
  });

  it('builds workspace-scoped sequences list key', () => {
    expect(queryKeys.ws.sequences.list('w1')).toEqual(['ws', 'w1', 'sequences', 'list']);
  });

  it('builds workspace-scoped tags catalog key', () => {
    expect(queryKeys.ws.tags.catalog('w1')).toEqual(['ws', 'w1', 'tags', 'catalog']);
  });

  it('builds workspace-scoped custom-fields catalog key', () => {
    expect(queryKeys.ws.customFields.catalog('w1')).toEqual([
      'ws',
      'w1',
      'custom-fields',
      'catalog',
    ]);
  });
});

describe('isWorkspaceQuery', () => {
  it('returns true for a matching workspace-scoped key', () => {
    expect(isWorkspaceQuery(['ws', 'w1', 'conversations', 'list'], 'w1')).toBe(true);
  });

  it('returns false for a different workspace id', () => {
    expect(isWorkspaceQuery(['ws', 'w1', 'conversations', 'list'], 'w2')).toBe(false);
  });

  it('returns false for a non-workspace-scoped key', () => {
    expect(isWorkspaceQuery(['session'], 'w1')).toBe(false);
  });

  it('returns false for an empty key', () => {
    expect(isWorkspaceQuery([], 'w1')).toBe(false);
  });
});
