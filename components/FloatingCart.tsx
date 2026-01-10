// components/FloatingCart.tsx
import { StyleSheet, Text, TouchableOpacity } from "react-native";
import { useCart } from "../context/CartContext";
import { useTheme } from "../context/ThemeContext";

export default function FloatingCart({ onOpen }: { onOpen: () => void }) {
  const { items } = useCart();
  const { theme } = useTheme();

  const totalQty = items.reduce((s, i) => s + i.qty, 0);
  const totalPrice = items.reduce((s, i) => s + i.qty * i.price, 0);

  if (totalQty === 0) return null;

  return (
    <TouchableOpacity activeOpacity={0.9} onPress={onOpen} style={[styles.wrap, { backgroundColor: theme.primary }]}>
      <Text style={[styles.text, { color: "#000" }]}>{totalQty} items</Text>
      <Text style={[styles.price, { color: "#000" }]}>₹{totalPrice}</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  wrap: {
    position: "absolute",
    left: 16,
    right: 16,
    bottom: 55,
    height: 56,
    borderRadius: 14,
    paddingHorizontal: 16,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    elevation: 14,
  },
  text: { fontWeight: "800" },
  price: { fontWeight: "800" },
});
