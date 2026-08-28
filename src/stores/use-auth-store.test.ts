import { useAuthStore } from '@/stores/use-auth-store';

const testUser = { id: 'u1', email: 'a@b.com', name: 'A B', mustChangePassword: false };

beforeEach(() => {
  useAuthStore.setState({ status: 'pending', user: null });
});

describe('useAuthStore', () => {
  it('starts pending with no user', () => {
    expect(useAuthStore.getState().status).toBe('pending');
    expect(useAuthStore.getState().user).toBeNull();
  });

  it('setSignedIn sets status signed-in and stores the user', () => {
    useAuthStore.getState().setSignedIn(testUser);
    expect(useAuthStore.getState().status).toBe('signed-in');
    expect(useAuthStore.getState().user).toEqual(testUser);
  });

  it('setSignedOut clears the user and sets status signed-out', () => {
    useAuthStore.getState().setSignedIn(testUser);
    useAuthStore.getState().setSignedOut();
    expect(useAuthStore.getState().status).toBe('signed-out');
    expect(useAuthStore.getState().user).toBeNull();
  });

  it('setMustChangePassword updates the flag on an existing user', () => {
    useAuthStore.getState().setSignedIn(testUser);
    useAuthStore.getState().setMustChangePassword(true);
    expect(useAuthStore.getState().user?.mustChangePassword).toBe(true);
  });

  it('setMustChangePassword is a no-op when there is no signed-in user', () => {
    useAuthStore.getState().setMustChangePassword(true);
    expect(useAuthStore.getState().user).toBeNull();
  });
});
