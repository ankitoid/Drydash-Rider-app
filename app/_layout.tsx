
import { AuthProvider } from "@/context/AuthContext";
import { useAuth } from "@/context/useAuth";
import { Stack, router } from "expo-router";
import { useEffect } from "react";
import { ActivityIndicator, View } from "react-native";
import { ThemeProvider } from "../context/ThemeContext";

function AuthGuard() {
  const { token, isLoading } = useAuth();

  useEffect(() => {
    if (!isLoading && !token) {
      router.replace("/(auth)/rider-login");
    }
  }, [token, isLoading]);

  if (isLoading) {
    return (
      <View style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  return <Stack screenOptions={{ headerShown: false }} />;
}

export default function RootLayout() {
  return (
    <AuthProvider>
      <ThemeProvider>
        <AuthGuard />
      </ThemeProvider>
    </AuthProvider>
  );
}
