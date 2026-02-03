import AsyncStorage from "@react-native-async-storage/async-storage";
import React, {
  createContext,
  ReactNode,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import { registerForPushNotifications } from "@/services/pushNotifications";
import { setupNotificationChannel } from "@/services/notificationSetup";

/* =====================================================
   CONFIG
===================================================== */

const API_URL = "https://rider-app-testing.onrender.com/api/v1/auth";

const USER_KEY = "DRYDASH_RIDER_USER";
const TOKEN_KEY = "DRYDASH_RIDER_TOKEN";

/* =====================================================
   TYPES
===================================================== */

export interface Rider {
  _id: string;
  name: string;
  email: string;
  phone: string;
  role: string;
  plant: string;
}

interface AuthContextType {
  user: Rider | null;
  token: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (user: Rider, token: string) => Promise<void>;
  logout: () => Promise<void>;
}

/* =====================================================
   CONTEXT
===================================================== */

export const AuthContext = createContext<AuthContextType | undefined>(
  undefined
);

/* =====================================================
   PROVIDER
===================================================== */

interface AuthProviderProps {
  children: ReactNode;
}

export const AuthProvider = ({ children }: AuthProviderProps) => {
  const [user, setUser] = useState<Rider | null>(null);
  const [token, setToken] = useState<string | null>(null);

  const [isLoading, setIsLoading] = useState<boolean>(true);
  const isAuthenticated = !!token;

  const hasRestoredRef = useRef(false);

  /* --------------------------------------------------
     Restore auth + validate token
  -------------------------------------------------- */
  useEffect(() => {
    if (hasRestoredRef.current) return;
    hasRestoredRef.current = true;

    const restoreAuth = async () => {
      try {
        const storedToken = await AsyncStorage.getItem(TOKEN_KEY);

        if (!storedToken) {
          setIsLoading(false);
          return;
        }

        const res = await fetch(`${API_URL}/profile`, {
          headers: {
            Authorization: `Bearer ${storedToken}`,
          },
        });

        if (!res.ok) {
          await AsyncStorage.multiRemove([USER_KEY, TOKEN_KEY]);
          setUser(null);
          setToken(null);
          setIsLoading(false);
          return;
        }

        const data = await res.json();
        const profile = data.profile;

        const mappedUser: Rider = {
          _id: profile._id,
          name: profile.name,
          email: profile.email,
          phone: profile.phone,
          role: profile.role,
          plant: profile.plant,
        };

        setUser(mappedUser);
        setToken(storedToken);

        await AsyncStorage.setItem(USER_KEY, JSON.stringify(mappedUser));
      } catch (error) {
        console.error("Auth restore failed:", error);
        setUser(null);
        setToken(null);
      } finally {
        setIsLoading(false);
      }
    };

    restoreAuth();
  }, []);

  useEffect(() => {
    if (!token || !user?._id) return;

    const initPush = async () => {
      try {
        await setupNotificationChannel();

        const fcmToken = await registerForPushNotifications();
        if (!fcmToken) return;

        await fetch(
          "https://rider-app-testing.onrender.com/api/v1/rider/push-tokens",
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${token}`,
            },
            body: JSON.stringify({
              token: fcmToken,
              platform: "android",
            }),
          }
        );
      } catch (err) {
        console.log("Push registration failed:", err);
      }
    };

    initPush();
  }, [token, user?._id]);

  /* --------------------------------------------------
     Login
  -------------------------------------------------- */
  const login = async (userData: Rider, accessToken: string) => {
    setUser(userData);
    setToken(accessToken);

    await AsyncStorage.setItem(USER_KEY, JSON.stringify(userData));
    await AsyncStorage.setItem(TOKEN_KEY, accessToken);
  };

  /* --------------------------------------------------
     Logout
  -------------------------------------------------- */
  const logout = async () => {
    setUser(null);
    setToken(null);
    await AsyncStorage.multiRemove([USER_KEY, TOKEN_KEY]);
  };

  /* --------------------------------------------------
     Memoized context value
  -------------------------------------------------- */
  const value = useMemo(
    () => ({
      user,
      token,
      isAuthenticated: Boolean(token),
      isLoading,
      login,
      logout,
    }),
    [user, token, isLoading]
  );

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};