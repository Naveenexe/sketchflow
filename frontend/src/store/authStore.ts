import { create } from 'zustand';
import type { AuthResponse, User } from '../types';
import { logoutUser } from '../services/authService';

const TOKEN_KEY = 'sketchflow_token';
const USER_KEY = 'sketchflow_user';

export function isTokenExpired(token: string | null): boolean {
  if (!token) return true;
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return true;
    const base64Url = parts[1];
    const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
    const jsonPayload = decodeURIComponent(
      atob(base64)
        .split('')
        .map((c) => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
        .join('')
    );
    const parsed = JSON.parse(jsonPayload);
    if (typeof parsed.exp === 'number') {
      // Return expired if current time is past expiration
      return Date.now() >= parsed.exp * 1000;
    }
    return false;
  } catch {
    return true;
  }
}

function loadStoredUser(): User | null {
  try {
    const raw = localStorage.getItem(USER_KEY);
    return raw ? (JSON.parse(raw) as User) : null;
  } catch {
    return null;
  }
}

export const clearAuthSession = () => {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(USER_KEY);
  useAuthStore.setState({
    token: null,
    user: null,
    isAuthenticated: false,
  });
};

interface AuthState {
  token: string | null;
  user: User | null;
  isAuthenticated: boolean;
  setAuth: (data: AuthResponse) => void;
  logout: () => Promise<void>;
}

export const useAuthStore = create<AuthState>((set) => {
  let initialToken = localStorage.getItem(TOKEN_KEY);
  let initialUser = loadStoredUser();

  if (initialToken && isTokenExpired(initialToken)) {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
    initialToken = null;
    initialUser = null;
  }

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

