import { AuthProvider } from "@/context/AuthContext";
import { Stack } from "expo-router";
import { CartProvider } from "../context/CartContext";
import { ThemeProvider } from "../context/ThemeContext";

export default function RootLayout() {
  console.log("RootLayout");

  return (
    <AuthProvider>
      <ThemeProvider>
        <CartProvider>
          <Stack screenOptions={{ headerShown: false }} />
        </CartProvider>
      </ThemeProvider>
    </AuthProvider>
  );
}
