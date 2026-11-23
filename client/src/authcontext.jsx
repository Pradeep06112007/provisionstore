import { createContext, useContext, useEffect, useState } from "react";

const AuthContext = createContext(null);

const TOKEN_KEY = "freshmart-customer-token";
const USER_KEY = "freshmart-customer-user";
const ADMIN_TOKEN_KEY = "freshmart-admin-token";
const ADMIN_LAST_ACTIVE_KEY = "freshmart-admin-last-active";

// 30 minutes idle timeout for Admin (in milliseconds)
const ADMIN_IDLE_TIMEOUT_MS = 30 * 60 * 1000;

export function AuthProvider({ children }) {
  const [token, setToken] = useState(() => localStorage.getItem(TOKEN_KEY) || "");
  const [user, setUser] = useState(() => {
    try {
      const raw = localStorage.getItem(USER_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  });

  const loginCustomer = (nextToken, nextUser = null) => {
    if (nextToken) {
      localStorage.setItem(TOKEN_KEY, nextToken);
      setToken(nextToken);
    }
    if (nextUser) {
      localStorage.setItem(USER_KEY, JSON.stringify(nextUser));
      setUser(nextUser);
    }
  };

  const logoutCustomer = () => {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
    setToken("");
    setUser(null);
  };

  const logoutAdmin = () => {
    localStorage.removeItem(ADMIN_TOKEN_KEY);
    localStorage.removeItem("freshmart-admin-user");
    localStorage.removeItem(ADMIN_LAST_ACTIVE_KEY);
  };

  // Auto-expire idle admin sessions after 30 minutes of inactivity
  useEffect(() => {
    const hasAdminSession = () => Boolean(localStorage.getItem(ADMIN_TOKEN_KEY));

    const checkAndTouchAdminActivity = () => {
      if (!hasAdminSession()) return;

      const now = Date.now();
      const lastActive = Number(localStorage.getItem(ADMIN_LAST_ACTIVE_KEY) || now);

      if (now - lastActive > ADMIN_IDLE_TIMEOUT_MS) {
        logoutAdmin();
        if (window.location.pathname.startsWith("/admin")) {
          window.location.reload();
        }
        return;
      }

      localStorage.setItem(ADMIN_LAST_ACTIVE_KEY, String(now));
    };

    checkAndTouchAdminActivity();

    const events = ["mousemove", "mousedown", "keydown", "scroll", "touchstart"];
    events.forEach((eventName) =>
      window.addEventListener(eventName, checkAndTouchAdminActivity, { passive: true })
    );

    const intervalId = window.setInterval(checkAndTouchAdminActivity, 60 * 1000);

    return () => {
      events.forEach((eventName) =>
        window.removeEventListener(eventName, checkAndTouchAdminActivity)
      );
      window.clearInterval(intervalId);
    };
  }, []);

  const isAuthenticated = Boolean(token);

  return (
    <AuthContext.Provider
      value={{
        token,
        user,
        isAuthenticated,
        loginCustomer,
        logoutCustomer,
        logoutAdmin,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}