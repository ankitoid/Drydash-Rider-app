import { CartProvider } from "@/context/CartContext";
import { LocationProvider } from "@/context/LocationContext";
import { NotificationProvider } from "@/context/NotificationContext";
import { RiderDataProvider } from "@/context/RiderDataContext";
import { SocketProvider } from "@/context/SocketProvider";
import { useAuth } from "@/context/useAuth";
import { router, Stack } from "expo-router";
import { useEffect } from "react";
import { ActivityIndicator, View } from "react-native";

export default function RiderLayout() {
  const { token, isLoading } = useAuth();

  useEffect(() => {
    if (!isLoading && !token) {
      router.replace("/(auth)/rider-login");
    }
  }, [token, isLoading]);

  if (isLoading || !token) {
    return (
      <View style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  return (
    <CartProvider>
      <RiderDataProvider>
        <NotificationProvider>
          <SocketProvider>
            <LocationProvider>
              <Stack screenOptions={{ headerShown: false }} />
            </LocationProvider>
          </SocketProvider>
        </NotificationProvider>
      </RiderDataProvider>
    </CartProvider>
  );
}
