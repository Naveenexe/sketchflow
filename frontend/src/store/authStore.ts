import { create } from 'zustand';
import type { AuthResponse, User } from '../types';
import { logoutUser } from '../services/authService';

const TOKEN_KEY = 'sketchflow_token';
const USER_KEY = 'sketchflow_user';

function loadStoredUser(): User | null {
  try {
    const raw = localStorage.getItem(USER_KEY);
    return raw ? (JSON.parse(raw) as User) : null;
  } catch {
    return null;
  }
}

interface AuthState {
  token: string | null;
  user: User | null;
  isAuthenticated: boolean;
  setAuth: (data: AuthResponse) => void;
  logout: () => Promise<void>;
}

export const useAuthStore = create<AuthState>((set) => {
  const initialToken = localStorage.getItem(TOKEN_KEY);
  const initialUser = loadStoredUser();

  return {
    token: initialToken,
    user: initialUser,
    isAuthenticated: Boolean(initialToken && initialUser),

    setAuth: (data: AuthResponse) => {
      const user: User = {
        userId: data.userId,
        email: data.email,
        displayName: data.displayName,
      };
      localStorage.setItem(TOKEN_KEY, data.token);
      localStorage.setItem(USER_KEY, JSON.stringify(user));
      set({
        token: data.token,
        user,
        isAuthenticated: true,
      });
    },

    logout: async () => {
      await logoutUser();
      localStorage.removeItem(TOKEN_KEY);
      localStorage.removeItem(USER_KEY);
      set({
        token: null,
        user: null,
        isAuthenticated: false,
      });
    },
  };
});

