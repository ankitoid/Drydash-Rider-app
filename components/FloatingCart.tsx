import { Pressable, StyleSheet, Text } from "react-native";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from "react-native-reanimated";

export default function FloatingCart({ onOpen }: { onOpen: () => void }) {
  const { items } = useCart();
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  const pathname = usePathname();

  const scale = useSharedValue(1);

  const totalQty = items.reduce((s, i) => s + i.qty, 0);
  const totalPrice = items.reduce((s, i) => s + i.qty * i.price, 0);

  const hideOnRoutes = ["/order/pickup/select-items"];
  const shouldHide = hideOnRoutes.some((route) => pathname?.includes(route));

  if (totalQty === 0 || shouldHide) return null;

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  return (
    <Pressable
      onPress={onOpen}
      onPressIn={() => {
        scale.value = withSpring(0.95);
      }}
      onPressOut={() => {
        scale.value = withSpring(1);
      }}
    >
      <Animated.View
        style={[
          styles.wrap,
          {
            backgroundColor: theme.primary,
            bottom: insets.bottom + 70,
          },
          animatedStyle,
        ]}
      >
        <Text style={[styles.text, { color: "#000" }]}>
          {totalQty} {totalQty === 1 ? "item" : "items"}
        </Text>
        <Text style={[styles.price, { color: "#000" }]}>₹{totalPrice}</Text>
      </Animated.View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  wrap: {
    position: "absolute",
    left: 16,
    right: 16,
    height: 56,
    borderRadius: 14,
    paddingHorizontal: 16,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    elevation: 14,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    zIndex: 100,
  },
  text: { fontWeight: "800", fontSize: 15 },
  price: { fontWeight: "800", fontSize: 16 },
});