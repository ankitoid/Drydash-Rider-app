import AsyncStorage from "@react-native-async-storage/async-storage";
import React, {
  createContext,
  ReactNode,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

/* =====================================================
   CONFIG
===================================================== */

const API_URL = "https://rider-app-testing.onrender.com/api/v1/auth"; // 🔁 change for prod

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

  // 🔑 start as true → Splash waits correctly
  const [isLoading, setIsLoading] = useState<boolean>(true);

  const isAuthenticated = !!token;

  // 🔒 Prevent double execution (StrictMode safe)
  const hasRestoredRef = useRef(false);

  /* --------------------------------------------------
     Restore auth + validate token with /profile
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

        // 🔐 Validate token with backend
        const res = await fetch(`${API_URL}/profile`, {
          headers: {
            Authorization: `Bearer ${storedToken}`,
          },
        });

        if (!res.ok) {
          // ❌ token invalid / expired
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

        // cache safe user data
        await AsyncStorage.setItem(
          USER_KEY,
          JSON.stringify(mappedUser)
        );
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

  /* --------------------------------------------------
     Login (after OTP verification)
  -------------------------------------------------- */
  const login = async (userData: Rider, accessToken: string) => {
    setUser(userData);
    setToken(accessToken);

    await AsyncStorage.setItem(
      USER_KEY,
      JSON.stringify(userData)
    );
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
     Memoized context value (VERY IMPORTANT)
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
