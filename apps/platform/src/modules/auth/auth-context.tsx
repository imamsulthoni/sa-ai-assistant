import React, { createContext, useCallback, useContext, useEffect, useState } from "react";
import {
  clearStoredSession,
  getStoredToken,
  getStoredUser,
  setStoredSession,
} from "#/lib/auth-storage";
import { getMe, login as apiLogin, register as apiRegister, type PublicUser } from "#/lib/api";

type AuthContextValue = {
  user: PublicUser | null;
  token: string | null;
  loading: boolean;
  login: (credentials: { email: string; password: string }) => Promise<void>;
  register: (data: { username: string; email: string; password: string }) => Promise<void>;
  logout: () => void;
  refreshUser: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [token, setToken] = useState<string | null>(() => getStoredToken());
  const [user, setUser] = useState<PublicUser | null>(() => getStoredUser());
  const [loading, setLoading] = useState(true);

  const refreshUser = useCallback(async () => {
    const currentToken = getStoredToken();
    if (!currentToken) {
      setUser(null);
      setToken(null);
      setLoading(false);
      return;
    }
    try {
      const { user: latestUser } = await getMe();
      setUser(latestUser);
      setToken(currentToken);
      setStoredSession(currentToken, latestUser);
    } catch {
      // Jika token expired atau user tidak valid
      clearStoredSession();
      setUser(null);
      setToken(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refreshUser();
  }, [refreshUser]);

  const login = useCallback(
    async (credentials: { email: string; password: string }) => {
      const res = await apiLogin(credentials);
      setStoredSession(res.token, res.user);
      setToken(res.token);
      setUser(res.user);
    },
    [],
  );

  const register = useCallback(
    async (data: { username: string; email: string; password: string }) => {
      const res = await apiRegister(data);
      setStoredSession(res.token, res.user);
      setToken(res.token);
      setUser(res.user);
    },
    [],
  );

  const logout = useCallback(() => {
    clearStoredSession();
    setToken(null);
    setUser(null);
    if (typeof window !== "undefined") {
      window.location.assign("/");
    }
  }, []);

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        loading,
        login,
        register,
        logout,
        refreshUser,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return ctx;
}
