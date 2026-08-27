import { create } from 'zustand';

export interface AuthUser {
  id: string;
  email: string;
  name: string | null;
  mustChangePassword: boolean;
}

export type AuthStatus = 'pending' | 'signed-out' | 'signed-in';

/**
 * Client-state store for the auth session. `status` starts 'pending' so the root layout's
 * bootstrap gate can hold the splash screen until `getSession` resolves — see api/auth-endpoints.ts.
 * Token storage lives in SecureStore (api/auth-token.ts), not here; this store only holds the
 * resolved session shape the UI reads from.
 */
interface AuthStoreState {
  status: AuthStatus;
  user: AuthUser | null;
  setSignedIn: (user: AuthUser) => void;
  setSignedOut: () => void;
  setMustChangePassword: (mustChangePassword: boolean) => void;
}

export const useAuthStore = create<AuthStoreState>((set) => ({
  status: 'pending',
  user: null,
  setSignedIn: (user) => set({ status: 'signed-in', user }),
  setSignedOut: () => set({ status: 'signed-out', user: null }),
  setMustChangePassword: (mustChangePassword) =>
    set((state) => (state.user ? { user: { ...state.user, mustChangePassword } } : state)),
}));
