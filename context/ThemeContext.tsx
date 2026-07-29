import AsyncStorage from "@react-native-async-storage/async-storage";
import React, {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { DarkTheme, LightTheme } from "../constants/colors";

type ThemeType = typeof LightTheme;
const THEME_STORAGE_KEY = "@user_theme_choice";

interface ThemeContextProps {
  theme: ThemeType;
  isDark: boolean;
  toggleTheme: () => void;
}

const ThemeContext = createContext<ThemeContextProps | undefined>(
  undefined
);

export const ThemeProvider = ({
  children,
}: {
  children: React.ReactNode;
}) => {
  // Bright/Light theme is the default theme (isDark = false)
  const [isDark, setIsDark] = useState<boolean>(false);

  // Load saved user theme preference on app startup
  useEffect(() => {
    const loadSavedTheme = async () => {
      try {
        const savedTheme = await AsyncStorage.getItem(THEME_STORAGE_KEY);
        if (savedTheme === "dark") {
          setIsDark(true);
        } else if (savedTheme === "light") {
          setIsDark(false);
        }
      } catch (error) {
        console.warn("Failed to load saved theme preference", error);
      }
    };
    loadSavedTheme();
  }, []);

  // Toggle between bright (light) and dark theme, persisting choice
  const toggleTheme = async () => {
    try {
      const nextIsDark = !isDark;
      setIsDark(nextIsDark);
      await AsyncStorage.setItem(
        THEME_STORAGE_KEY,
        nextIsDark ? "dark" : "light"
      );
    } catch (error) {
      console.warn("Failed to save theme preference", error);
    }
  };

  const theme = useMemo(
    () => (isDark ? DarkTheme : LightTheme),
    [isDark]
  );

  const value = useMemo(
    () => ({
      theme,
      isDark,
      toggleTheme,
    }),
    [theme, isDark]
  );

  return (
    <ThemeContext.Provider value={value}>
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = () => {
  const ctx = useContext(ThemeContext);
  if (!ctx) {
    throw new Error("useTheme must be used inside ThemeProvider");
  }
  return ctx;
};
