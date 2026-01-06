import React, {
  createContext,
  useContext,
  useEffect,
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

const ThemeContext = createContext<ThemeContextProps | undefined>(undefined);

export const ThemeProvider = ({
  children,
}: {
  children: React.ReactNode;
}) => {
  const [scheme, setScheme] = useState<ColorSchemeName>(
    Appearance.getColorScheme()
  );

  const isDark = scheme !== "light";
  const theme = isDark ? DarkTheme : LightTheme;

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

  return (
    <ThemeContext.Provider value={{ theme, isDark, toggleTheme }}>
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
