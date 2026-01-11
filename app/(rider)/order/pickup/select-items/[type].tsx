// app/(rider)/order/pickup/select-items/[type].tsx
import { Ionicons } from "@expo/vector-icons";
import { Audio } from "expo-av";
import { CameraView, useCameraPermissions } from "expo-camera";
import { router, useLocalSearchParams } from "expo-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { Image } from "react-native";

import {
    Alert,
    Modal,
    Platform,
    ScrollView,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useCart } from "../../../../../context/CartContext";
import { useTheme } from "../../../../../context/ThemeContext";

/* ---------- Data ---------- */
const ITEMS: Record<
  string,
  { id: string; title: string; price: number; emoji: string }[]
> = {
  laundry: [
    { id: "laundry-shirt", title: "Shirt", price: 50, emoji: "👕" },
    { id: "laundry-pant", title: "Pant", price: 70, emoji: "👖" },
    { id: "laundry-tshirt", title: "T-Shirt", price: 40, emoji: "👔" },
    { id: "laundry-dress", title: "Dress", price: 80, emoji: "👗" },
    { id: "laundgry-jacket", title: "Jacket", price: 100, emoji: "🧥" },
    { id: "laundry-tshirtg", title: "T-Shirt", price: 40, emoji: "👔" },
    { id: "laundrya-dress", title: "Dress", price: 80, emoji: "👗" },
    { id: "laundadry-jacket", title: "Jacket", price: 100, emoji: "🧥" },
  ],
  shoe: [
    { id: "shoe-clean", title: "Shoe Cleaning", price: 200, emoji: "👟" },
    { id: "shoe-polish", title: "Shoe Polish", price: 120, emoji: "👞" },
    { id: "shoe-repair", title: "Shoe Repair", price: 300, emoji: "🥾" },
  ],
  drywash: [
    { id: "dry-saree", title: "Saree Dry Clean", price: 300, emoji: "🥻" },
    { id: "dry-blazer", title: "Blazer Dry Clean", price: 350, emoji: "🧥" },
    { id: "dry-coat", title: "Coat Dry Clean", price: 400, emoji: "🧥" },
  ],
};

const SERVICES = [
  { key: "laundry", label: "Laundry", icon: "shirt-outline" },
  { key: "shoe", label: "Shoe Spa", icon: "walk-outline" },
  { key: "drywash", label: "Drywash", icon: "water-outline" },
];

/* ---------- Component ---------- */
export default function SelectItems() {
  const params = useLocalSearchParams<{ type?: string; orderId?: string }>();
  const initialType = params?.type ?? "laundry";
  const orderId = params?.orderId;
  const insets = useSafeAreaInsets();

  const {
    items: cartItems,
    addItem,
    removeItem,
    setQty,
    clear,
    getQty,
    total,
  } = useCart();
  const { theme, isDark } = useTheme();

  const [selected, setSelected] = useState<string>(initialType);

  const [checkoutModal, setCheckoutModal] = useState(false);

  const [cameraPermission, requestCameraPermission] = useCameraPermissions();
  const cameraRef = useRef<CameraView>(null);

  const [photos, setPhotos] = useState<string[]>([]);
  const [recording, setRecording] = useState<Audio.Recording | null>(null);
  const [audioUri, setAudioUri] = useState<string | null>(null);
  const [sound, setSound] = useState<Audio.Sound | null>(null);
  useEffect(() => {
    return () => {
      if (sound) {
        sound.unloadAsync();
      }
    };
  }, [sound]);

  useEffect(() => {
    if (params?.type) setSelected(params.type);
  }, [params?.type]);

  const items = useMemo(() => ITEMS[selected] ?? [], [selected]);

  // derive available items (not yet added to cart)
  const availableItems = items.filter((i) => getQty(i.id) === 0);

  const cartItemsArray = Object.values(cartItems);
  const subtotal = Math.round(total());
  const discount = subtotal >= 1000 ? Math.round(subtotal * 0.1) : 0;
  const payable = subtotal - discount;

  const onCheckout = () => {
    if (subtotal <= 0) {
      Alert.alert("Cart is empty", "Please add items to cart before checkout.");
      return;
    }

    Alert.alert(
      "Confirm Checkout",
      `Order total ₹${payable}. Proceed to checkout?`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Confirm",
          style: "default",
          onPress: () => {
            clear();
            Alert.alert("Success", "Checkout completed.");
            router.back();
          },
        },
      ],
      { cancelable: true }
    );
  };

  const deleteItem = (itemId: string) => {
    removeItem(itemId);
  };

  // helper to find emoji across all categories (cart may contain items from other categories)
  const findEmoji = (id: string) => {
    for (const list of Object.values(ITEMS)) {
      const f = list.find((i) => i.id === id);
      if (f) return f.emoji;
    }
    return "📦";
  };

  const openCheckoutModal = async () => {
    if (!cameraPermission?.granted) {
      await requestCameraPermission();
    }
    setCheckoutModal(true);
  };

  const takePhoto = async () => {
    if (!cameraRef.current) return;
    const photo = await cameraRef.current.takePictureAsync();
    setPhotos((prev) => [...prev, photo.uri]);
  };
 const removePhoto = (uri: string) => {
    setPhotos((prev) => prev.filter((photoUri) => photoUri !== uri));
  };

  const startRecording = async () => {
    await Audio.requestPermissionsAsync();
    await Audio.setAudioModeAsync({ allowsRecordingIOS: true });

    const { recording } = await Audio.Recording.createAsync(
      Audio.RecordingOptionsPresets.HIGH_QUALITY
    );
    setRecording(recording);
  };

  const stopRecording = async () => {
    if (!recording) return;
    await recording.stopAndUnloadAsync();
    setAudioUri(recording.getURI() || null);
    setRecording(null);
  };
  const playAudio = async () => {
    if (!audioUri) return;
    const { sound } = await Audio.Sound.createAsync({ uri: audioUri });
    setSound(sound);
    await sound.playAsync();
  };

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      {/* HEADER */}
      <View
        style={[
          styles.header,
          { backgroundColor: theme.card, borderBottomColor: theme.border },
        ]}
      >
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={24} color={theme.text} />
        </TouchableOpacity>

        <View style={styles.headerCenter}>
          <Text style={[styles.headerTitle, { color: theme.text }]}>
            Add Items
          </Text>
          {orderId && (
            <Text style={[styles.headerSubtitle, { color: theme.subText }]}>
              Order #{orderId}
            </Text>
          )}
        </View>

        <View style={styles.headerRight} />
      </View>

      {/* SERVICE TABS */}
      <View
        style={[styles.tabsContainer, { backgroundColor: theme.background }]}
      >
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.tabs}
        >
          {SERVICES.map((service) => {
            const isActive = service.key === selected;
            return (
              <TouchableOpacity
                key={service.key}
                onPress={() => setSelected(service.key)}
                style={[
                  styles.tab,
                  {
                    backgroundColor: isActive ? theme.primary : theme.card,
                    borderColor: theme.border,
                  },
                ]}
              >
                <Ionicons
                  name={service.icon as any}
                  size={18}
                  color={isActive ? "#fff" : theme.text}
                />
                <Text
                  style={[
                    styles.tabText,
                    { color: isActive ? "#fff" : theme.text },
                  ]}
                >
                  {service.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>

      {/* CONTENT */}
      <View style={styles.content}>
        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={{ padding: 16, paddingBottom: 300 }}
          showsVerticalScrollIndicator={false}
        >
          <Text style={[styles.sectionTitle, { color: theme.text }]}>
            Available Items
          </Text>

          {/* FEATURED TOP 2 */}

          {/* SMALL ROW LIST */}
          {/* AVAILABLE ITEMS - SINGLE ROW LAYOUT */}
          <View style={styles.smallRowList}>
            {availableItems.length === 0 && (
              <Text style={{ color: theme.subText }}>No items available</Text>
            )}

            {availableItems.map((item) => (
              <View
                key={item.id}
                style={[
                  styles.smallRowCard,
                  { backgroundColor: theme.card, borderColor: theme.border },
                ]}
              >
                <Text style={styles.smallEmoji}>{item.emoji}</Text>

                <View style={{ flex: 1 }}>
                  <Text
                    style={[styles.smallTitle, { color: theme.text }]}
                    numberOfLines={1}
                  >
                    {item.title}
                  </Text>
                  <Text style={[styles.smallPrice, { color: theme.subText }]}>
                    ₹{item.price}
                  </Text>
                </View>

                <TouchableOpacity
                  onPress={() =>
                    addItem(
                      { id: item.id, title: item.title, price: item.price },
                      1
                    )
                  }
                  style={[
                    styles.smallAddBtn,
                    { backgroundColor: theme.primary },
                  ]}
                >
                  <Ionicons name="add" size={16} color="#fff" />
                </TouchableOpacity>
              </View>
            ))}
          </View>

          {/* CHECKOUT CARD (shows items added with quantity controls) */}
          {cartItemsArray.length > 0 && (
            <View
              style={[
                styles.checkoutCard,
                { backgroundColor: theme.card, borderColor: theme.border },
              ]}
            >
              <Text style={[styles.checkoutHeading, { color: theme.text }]}>
                Items in Order
              </Text>

              {cartItemsArray.map((it: any) => (
                <View key={it.id} style={styles.checkoutItemRow}>
                  <Text
                    style={[styles.checkoutItemEmoji, { color: theme.text }]}
                  >
                    {findEmoji(it.id)}
                  </Text>

                  <View style={styles.checkoutItemInfo}>
                    <Text
                      style={[styles.checkoutItemTitle, { color: theme.text }]}
                      numberOfLines={1}
                    >
                      {it.title}
                    </Text>
                    <Text
                      style={[
                        styles.checkoutItemMeta,
                        { color: theme.subText },
                      ]}
                    >
                      ₹{it.price} × {it.qty} = ₹{it.price * it.qty}
                    </Text>
                  </View>

                  <View style={styles.checkoutQtyControls}>
                    <TouchableOpacity
                      onPress={() => {
                        const newQty = it.qty - 1;
                        if (newQty <= 0) removeItem(it.id);
                        else setQty(it.id, newQty);
                      }}
                      style={[styles.qtyBtn, { borderColor: theme.border }]}
                    >
                      <Ionicons name="remove" size={16} color={theme.text} />
                    </TouchableOpacity>

                    <Text style={[styles.qtyText, { color: theme.text }]}>
                      {it.qty}
                    </Text>

                    <TouchableOpacity
                      onPress={() => setQty(it.id, it.qty + 1)}
                      style={[
                        styles.qtyBtnPrimary,
                        { backgroundColor: theme.primary },
                      ]}
                    >
                      <Ionicons name="add" size={16} color="#fff" />
                    </TouchableOpacity>

                    <TouchableOpacity
                      onPress={() => deleteItem(it.id)}
                      style={styles.deleteBtn}
                    >
                      <Ionicons
                        name="trash-outline"
                        size={18}
                        color="#EF4444"
                      />
                    </TouchableOpacity>
                  </View>
                </View>
              ))}
            </View>
          )}

          <View style={{ height: 60 }} />
        </ScrollView>

        {/* FIXED CHECKOUT SUMMARY - floating at bottom */}
        <View
          style={[
            styles.summaryPanel,
            {
              backgroundColor: theme.card,
              borderColor: theme.border,
              bottom: insets.bottom + 12, // Account for safe area
              paddingBottom: insets.bottom > 0 ? 8 : 12, // Extra padding on devices with notch
            },
          ]}
        >
          <View style={styles.summaryTopRow}>
            <Text style={[styles.summaryLabel, { color: theme.subText }]}>
              Subtotal
            </Text>
            <Text style={[styles.summaryValue, { color: theme.text }]}>
              ₹{subtotal}
            </Text>
          </View>

          {discount > 0 && (
            <View style={styles.summaryTopRow}>
              <Text style={[styles.discountLabel]}>Discount (10%)</Text>
              <Text style={[styles.discountValue]}>-₹{discount}</Text>
            </View>
          )}

          <View style={[styles.summaryTopRow, styles.totalRow]}>
            <Text style={[styles.totalLabel, { color: theme.text }]}>
              Total
            </Text>
            <Text style={[styles.totalValue, { color: theme.primary }]}>
              ₹{payable}
            </Text>
          </View>

          <View style={styles.checkoutRow}>
            <TouchableOpacity
              onPress={openCheckoutModal}
              style={[styles.checkoutBtn, { backgroundColor: theme.primary }]}
              activeOpacity={0.8}
            >
              <Text style={styles.checkoutBtnText}>Proceed to Checkout</Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={() => clear()}
              style={[styles.clearBtn, { borderColor: theme.border }]}
            >
              <Text style={[styles.clearBtnText, { color: theme.subText }]}>
                Clear
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        <Modal visible={checkoutModal} transparent animationType="fade">
          <View style={styles.modalOverlay}>
            <View style={[styles.modalCard, { backgroundColor: theme.card }]}>
              <Text style={[styles.modalTitle, { color: theme.text }]}>
                Pickup Instructions
              </Text>

              {/* CAMERA */}
              {cameraPermission?.granted ? (
                <CameraView ref={cameraRef} style={styles.camera} />
              ) : (
                <View
                  style={[
                    styles.camera,
                    { alignItems: "center", justifyContent: "center" },
                  ]}
                >
                  <Text style={{ color: theme.subText }}>
                    Camera permission required
                  </Text>
                </View>
              )}

              <TouchableOpacity
                onPress={takePhoto}
                style={[styles.primaryBtn, { backgroundColor: theme.primary }]}
              >
                <Text style={styles.primaryBtnText}>📸 Capture Image</Text>
              </TouchableOpacity>

              {/* IMAGE PREVIEW */}
              {photos.length > 0 && (
                <ScrollView horizontal style={{ marginTop: 15 ,marginBottom:8 }}>
                  {photos.map((uri) => (
                    <View key={uri} style={styles.imageWrap}>
                      <Image source={{ uri }} style={styles.previewImage} />
                      <TouchableOpacity
                        onPress={() => removePhoto(uri)}
                        style={styles.removeImgBtn}
                      >
                        <Ionicons name="close" size={16} color="#fff" />
                      </TouchableOpacity>
                    </View>
                  ))}
                </ScrollView>
              )}

              {/* AUDIO */}
              <Text style={[styles.audioLabel, { color: theme.text }]}>
                Voice Instructions
              </Text>

              <TouchableOpacity
                onPress={recording ? stopRecording : startRecording}
                style={[
                  styles.audioBtn,
                  { backgroundColor: recording ? "#EF4444" : "#10B981" },
                ]}
              >
                <Text style={styles.primaryBtnText}>
                  {recording ? "⏹ Stop Recording" : "🎤 Record Audio"}
                </Text>
              </TouchableOpacity>

              {audioUri && (
                <TouchableOpacity
                  onPress={playAudio}
                  style={[styles.audioBtn, { backgroundColor: "#3B82F6" }]}
                >
                  <Text style={styles.primaryBtnText}>▶ Play Audio</Text>
                </TouchableOpacity>
              )}

              {/* ACTIONS */}
              <View style={styles.modalActions}>
                <TouchableOpacity
                  onPress={() => {
                    setCheckoutModal(false);
                    setPhotos([]);
                    setAudioUri(null);
                  }}
                  style={[styles.secondaryBtn]}
                >
                  <Text style={styles.secondaryBtnText}>Cancel</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  onPress={onCheckout}
                  style={[
                    styles.primaryBtn,
                    { backgroundColor: theme.primary },
                  ]}
                >
                  <Text style={styles.primaryBtnText}>Confirm</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>
      </View>
    </View>
  );
}

/* ---------- STYLES ---------- */
const styles = StyleSheet.create({
  container: { flex: 1 },

  header: {
    paddingTop: Platform.OS === "ios" ? 52 : 40,
    paddingBottom: 12,
    paddingHorizontal: 16,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderBottomWidth: 1,
  },
  backBtn: { width: 40 },
  headerCenter: { flex: 1, alignItems: "center" },
  headerTitle: { fontSize: 18, fontWeight: "700" },
  headerSubtitle: { fontSize: 12, marginTop: 2 },
  headerRight: { width: 40, alignItems: "flex-end" },

  tabsContainer: { paddingVertical: 8 },
  tabs: { paddingHorizontal: 12, alignItems: "center" },
  tab: {
    minWidth: 84,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 12,
    borderWidth: 1,
    marginRight: 8,
  },
  tabText: { fontSize: 13, fontWeight: "700" },

  content: { flex: 1 },

  sectionTitle: { fontSize: 16, fontWeight: "700", marginBottom: 10 },

  /* FEATURE CARDS (top two) */
  topGrid: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 10,
  },
  featureCard: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    padding: 10,
    borderRadius: 12,
    borderWidth: 1,
    // don't set marginRight here; map will add gap for first card
  },
  featureImage: {
    width: 56,
    height: 56,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 10,
  },
  featureEmoji: { fontSize: 26 },
  featureTitle: { fontSize: 14, fontWeight: "700", flexShrink: 1 },
  featurePrice: { fontSize: 13, fontWeight: "700", marginTop: 4 },
  featureAddBtn: {
    width: 36,
    height: 36,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
    marginLeft: 8,
  },

  /* SMALL ROW LIST */
  smallRowList: { marginTop: 6 },
  smallRowCard: {
    flexDirection: "row",
    alignItems: "center",
    padding: 10,
    borderRadius: 12,
    borderWidth: 1,
    gap: 12,
    marginBottom: 8,
  },
  smallEmoji: { fontSize: 24, width: 36, textAlign: "center" },
  smallTitle: { fontSize: 14, fontWeight: "600", flexShrink: 1 },
  smallPrice: { fontSize: 13, marginTop: 2 },
  smallAddBtn: {
    width: 36,
    height: 36,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
  },

  /* CHECKOUT CARD (inline above summary) */
  checkoutCard: {
    marginTop: 12,
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
  },
  checkoutHeading: { fontSize: 16, fontWeight: "700", marginBottom: 8 },
  checkoutItemRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 8,
  },
  checkoutItemEmoji: { fontSize: 28, width: 36, textAlign: "center" },
  checkoutItemInfo: { flex: 1, marginLeft: 8 },
  checkoutItemTitle: { fontSize: 14, fontWeight: "700" },
  checkoutItemMeta: { fontSize: 13, marginTop: 2 },

  checkoutQtyControls: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },

  qtyBtn: {
    width: 36,
    height: 36,
    borderRadius: 8,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  qtyBtnPrimary: {
    width: 36,
    height: 36,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
  },
  qtyText: {
    minWidth: 28,
    textAlign: "center",
    fontSize: 15,
    fontWeight: "700",
  },
  deleteBtn: { marginLeft: 6 },

  /* SUMMARY (floating) */
  summaryPanel: {
    position: "absolute",
    left: 12,
    right: 12,
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    elevation: 8,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    zIndex: 50,
  },
  summaryTopRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 8,
  },
  summaryLabel: { fontSize: 14 },
  summaryValue: { fontSize: 14, fontWeight: "600" },
  discountLabel: { fontSize: 14, color: "#10B981" },
  discountValue: { fontSize: 14, fontWeight: "600", color: "#10B981" },
  totalRow: { marginTop: 8, paddingTop: 8, borderTopWidth: 1 },
  totalLabel: { fontSize: 16, fontWeight: "700" },
  totalValue: { fontSize: 18, fontWeight: "700" },

  checkoutRow: { flexDirection: "row", gap: 12, marginTop: 12 },
  checkoutBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  checkoutBtnText: { color: "#fff", fontSize: 16, fontWeight: "700" },
  clearBtn: {
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderRadius: 10,
    borderWidth: 1,
    justifyContent: "center",
  },
  clearBtnText: { fontSize: 14 },

  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "center",
    padding: 16,
  },

  modalCard: {
    borderRadius: 16,
    padding: 16,
  },

  modalTitle: {
    fontSize: 18,
    fontWeight: "700",
    marginBottom: 8,
  },

  camera: {
    height: 190,
    borderRadius: 8,
    overflow: "hidden",
  },

  primaryBtn: {
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: "center",
    marginTop: 10,
    
  },

  primaryBtnText: {
    color: "#fff",
    fontWeight: "700",
  },

  imageWrap: {
    marginRight: 8,
    position: "relative",
  },

  previewImage: {
    marginTop:8,
    width: 80,
    height: 80,
    borderRadius: 8,
  },

  removeImgBtn: {
    position: "absolute",
    top: 2,
    right: -6,
    backgroundColor: "#EF4444",
    width: 18,
    height: 18,
    borderRadius: 9,
    alignItems: "center",
    justifyContent: "center",
  },

  audioLabel: {
    marginTop: 14,
    fontSize: 15,
    fontWeight: "600",
  },

  audioBtn: {
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: "center",
    marginTop: 8,
  },

  modalActions: {
    flexDirection: "row",
    gap: 12,
    marginTop: 14,
  },

  secondaryBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 10,
    backgroundColor: "#E5E7EB",
    alignItems: "center",
  },

  secondaryBtnText: {
    fontWeight: "700",
  },
});
