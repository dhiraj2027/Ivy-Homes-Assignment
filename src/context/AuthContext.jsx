import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";

import {
  login as apiLogin,
  logout as apiLogout,
  refreshAccessToken,
  isTokenValid,
  getToken,
  getRefreshToken,
  getStoredUser,
  clearToken,
} from "../api/client.js";

import { clearCollectionCache } from "../api/dataCache.js";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => getStoredUser());
  const [loading, setLoading] = useState(true);

  const initializeSession = useCallback(async () => {
    try {
      const token = getToken();
      const refreshToken = getRefreshToken();

      if (token && isTokenValid()) {
        setUser(getStoredUser());
        return;
      }

      if (refreshToken) {
        const data = await refreshAccessToken();

        setUser(data?.user || getStoredUser() || null);

        return;
      }

      clearToken();
      setUser(null);
    } catch {
      clearToken();
      setUser(null);
    }
  }, []);

  useEffect(() => {
    let mounted = true;

    const initialize = async () => {
      await initializeSession();

      if (mounted) {
        setLoading(false);
      }
    };

    initialize();

    return () => {
      mounted = false;
    };
  }, [initializeSession]);

  useEffect(() => {
    let mounted = true;

    const checkSession = async () => {
      if (!mounted) {
        return;
      }

      const token = getToken();

      if (!token || isTokenValid()) {
        return;
      }

      if (!getRefreshToken()) {
        clearToken();

        if (mounted) {
          setUser(null);
        }

        return;
      }

      try {
        const data = await refreshAccessToken();

        if (mounted) {
          setUser(data?.user || getStoredUser() || null);
        }
      } catch {
        clearToken();
        clearCollectionCache();

        if (mounted) {
          setUser(null);
        }
      }
    };

    const intervalId = window.setInterval(checkSession, 60_000);

    return () => {
      mounted = false;
      window.clearInterval(intervalId);
    };
  }, []);

  useEffect(() => {
    const handleUnauthorized = () => {
      clearToken();
      clearCollectionCache();
      setUser(null);
    };

    window.addEventListener("auth:unauthorized", handleUnauthorized);

    return () => {
      window.removeEventListener("auth:unauthorized", handleUnauthorized);
    };
  }, []);

  const login = useCallback(async (email, password) => {
    const data = await apiLogin(email, password);

    // Collection data is shared within a session, but clear any previous
    // session cache when authentication changes.
    clearCollectionCache();

    setUser(data?.user || getStoredUser() || null);

    return data;
  }, []);

  const logout = useCallback(async () => {
    try {
      await apiLogout();
    } finally {
      clearCollectionCache();
      setUser(null);
    }
  }, []);

  const value = {
    user,
    loading,
    login,
    logout,
    isAuthenticated: Boolean(user),
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);

  if (!context) {
    throw new Error("useAuth must be used within AuthProvider.");
  }

  return context;
}