import React, {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { Appearance, ColorSchemeName } from "react-native";
import { DarkTheme, LightTheme } from "../constants/colors";

type ThemeType = typeof DarkTheme;

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
  const [scheme, setScheme] = useState<ColorSchemeName>(
    Appearance.getColorScheme()
  );

  // 🔒 MEMOIZE derived values
  const isDark = useMemo(
    () => scheme !== "light",
    [scheme]
  );

  const theme = useMemo(
    () => (isDark ? DarkTheme : LightTheme),
    [isDark]
  );

  useEffect(() => {
    const subscription = Appearance.addChangeListener(
      ({ colorScheme }) => {
        setScheme(colorScheme);
      }
    );

    return () => subscription.remove();
  }, []);

  const toggleTheme = () => {
    setScheme((prev) => (prev === "light" ? "dark" : "light"));
  };

  // 🔥 MOST IMPORTANT FIX
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
