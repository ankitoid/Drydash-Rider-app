import { AuthProvider } from "@/context/AuthContext";
import { Stack } from "expo-router";
import { ThemeProvider } from "../context/ThemeContext";

export default function RootLayout() {
  console.log("RootLayout")
  return (
    <AuthProvider>
    <ThemeProvider>
      <Stack screenOptions={{ headerShown: false }} />
    </ThemeProvider>
    </AuthProvider>
  );
}