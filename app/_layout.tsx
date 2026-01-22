// Update app/_layout.tsx
import { AuthProvider } from "@/context/AuthContext";
import { useAuth } from "@/context/useAuth";
import { router, Stack } from "expo-router";
import { useEffect } from "react";
import { ActivityIndicator, View } from "react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { CartProvider } from "../context/CartContext";
import { ThemeProvider } from "../context/ThemeContext";
import { NotificationProvider } from "@/context/NotificationContext";
import { RiderDataProvider } from "@/context/RiderDataContext";
import { SocketProvider } from "@/context/SocketProvider";
import { LocationProvider } from "@/context/LocationContext"; // Add this

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
    <SafeAreaProvider>
      <AuthProvider>
        <ThemeProvider>
          <CartProvider>
            <RiderDataProvider>
              <NotificationProvider>
                <SocketProvider>
                  <LocationProvider>
                    <AuthGuard />
                  </LocationProvider>
                </SocketProvider>
              </NotificationProvider>
            </RiderDataProvider>
          </CartProvider>
        </ThemeProvider>
      </AuthProvider>
    </SafeAreaProvider>
  );
}