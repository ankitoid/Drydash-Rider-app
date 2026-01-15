import UniversalLoader from "@/components/Loader/UniversalLoader";
import { dashboardPickupRemoved } from "@/app/(rider)/(tabs)/dashboard";
import { Ionicons } from "@expo/vector-icons";
import { Audio } from "expo-av";
import { CameraView, useCameraPermissions } from "expo-camera";
import * as ImageManipulator from "expo-image-manipulator";
import { SaveFormat } from "expo-image-manipulator";
import * as Location from "expo-location"; // <-- new
import { router, useLocalSearchParams } from "expo-router";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  Alert,
  Image,
  Keyboard,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  Linking,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useCart } from "../../../../../context/CartContext";
import { useTheme } from "../../../../../context/ThemeContext";
import { useAuth } from "../../../../../context/useAuth";
import { PRODUCTS } from "@/constants/products";
import { productImages } from "@/constants/productImages";

const API_URL = "https://api.drydash.in/api/v1";

const SERVICES = [
  { key: "laundry", label: "Laundry", icon: "shirt-outline" },
  { key: "shoe", label: "Shoe Spa", icon: "walk-outline" },
  { key: "drywash", label: "Dry-Clean", icon: "water-outline" },
];

/* ---------- Component ---------- */
export default function SelectItems() {
  const params = useLocalSearchParams<{ type?: string; orderId?: string }>();
  const initialType = params?.type ?? "laundry";
  const orderId = params?.orderId as string | undefined;
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
  const { user } = useAuth(); // <-- new

  const [selected, setSelected] = useState<string>(initialType);
  const [checkoutModal, setCheckoutModal] = useState(false);

  const [cameraPermission, requestCameraPermission] = useCameraPermissions();
  const cameraRef = useRef<CameraView>(null);

  const [photos, setPhotos] = useState<string[]>([]);
  const [recording, setRecording] = useState<Audio.Recording | null>(null);
  const [audioUri, setAudioUri] = useState<string | null>(null);
  const [sound, setSound] = useState<Audio.Sound | null>(null);
  const [confirmLoading, setConfirmLoading] = useState(false);

  const [pickup, setPickup] = useState<any>(null); // fetched pickup details
  const [locationCoords, setLocationCoords] = useState<{
    latitude: number;
    longitude: number;
  } | null>(null);
  const [fetchingPickup, setFetchingPickup] = useState(false);

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

  useEffect(() => {
    if (orderId) {
      fetchPickupById(orderId);
    }
  }, [orderId]);

  const items = useMemo(() => {
    const category = PRODUCTS[selected as keyof typeof PRODUCTS];
    if (!category) return [];

    return category.children.map((item, index) => ({
      id: `${selected}-${index}`,
      title: item.label,
      price: item.Price,
      img: productImages[item.img] ?? productImages.fallback,
      type: item.type,
    }));
  }, [selected]);

  const availableItems = items.filter((i) => getQty(i.id) === 0);
  const cartItemsArray = Object.values(cartItems);
  const subtotal = Math.round(total());

  const [discountPercentStr, setDiscountPercentStr] = useState<string>("0");
  const [keyboardHeight, setKeyboardHeight] = useState<number>(0);

  /* ---------- Fetch pickup details ---------- */
  const fetchPickupById = async (id: string) => {
    setFetchingPickup(true);
    try {
      const res = await fetch(`${API_URL}/pickupbyId/${id}`, {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
          "x-client-type": "mobile",
        },
      });

      const json = await res.json().catch(() => null);
      if (!res.ok) {
        console.warn("Failed to fetch pickup", res.status, json);
        setPickup(null);
      } else {
        setPickup(json?.data ?? null);
        console.log("Pickup fetched:", json?.data);
      }
    } catch (err) {
      console.error("fetchPickupById error:", err);
      setPickup(null);
    } finally {
      setFetchingPickup(false);
    }
  };

  // mark pickup complete on server (called after successful file upload)
  const completePickup = async (id: string) => {
    try {
      const res = await fetch(`${API_URL}/completePickup/${id}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          "x-client-type": "mobile",
        },
      });

      const json = await res.json().catch(() => null);
      if (!res.ok) {
        console.warn("completePickup failed:", res.status, json);
        return { ok: false, status: res.status, json };
      }
      return { ok: true, status: res.status, json };
    } catch (err) {
      console.error("completePickup error:", err);
      return { ok: false, err };
    }
  };

  const sendWatiMessage = async (
    customerNumber: string,
    name: string,
    totalBill: number
  ) => {
    try {
      const url =
        "https://live-mt-server.wati.io/101289/api/v1/sendTemplateMessage" +
        `?whatsappNumber=${customerNumber}`;

      const res = await fetch(url, {
        method: "POST",
        headers: {
          "content-type": "application/json-patch+json",
          Authorization: "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1bmlxdWVfbmFtZSI6ImF5dXNoc2luZ2g4NDIwMThAZ21haWwuY29tIiwibmFtZWlkIjoiYXl1c2hzaW5naDg0MjAxOEBnbWFpbC5jb20iLCJlbWFpbCI6ImF5dXNoc2luZ2g4NDIwMThAZ21haWwuY29tIiwiYXV0aF90aW1lIjoiMTIvMDgvMjAyNSAwNzoyMzo1MyIsInRlbmFudF9pZCI6IjEwMTI4OSIsImRiX25hbWUiOiJtdC1wcm9kLVRlbmFudHMiLCJodHRwOi8vc2NoZW1hcy5taWNyb3NvZnQuY29tL3dzLzIwMDgvMDYvaWRlbnRpdHkvY2xhaW1zL3JvbGUiOlsiVEVNUExBVEVfTUFOQUdFUiIsIkRFVkVMT1BFUiIsIkFVVE9NQVRJT05fTUFOQUdFUiJdLCJleHAiOjI1MzQwMjMwMDgwMCwiaXNzIjoiQ2xhcmVfQUkiLCJhdWQiOiJDbGFyZV9BSSJ9.NpVe1fi-RXRuNgCAGzFQLZT6dE7Y-rvlx1SYxLKZ_m4",
        },
        body: JSON.stringify({
          parameters: [
            { name: "name", value: name },
            { name: "total_Bill", value: String(totalBill) },
          ],
          template_name: "sudhanshu_collection_under_2k",
          broadcast_name: `sudhanshu_collection_under_2k_${Date.now()}`,
        }),
      });

      const json = await res.json().catch(() => null);

      if (!res.ok) {
        console.warn("WATI message failed:", res.status, json);
        return false;
      }

      console.log("WATI message sent:", json);
      return true;
    } catch (err) {
      console.error("WATI send error:", err);
      return false;
    }
  };

  /* ---------- Location helper ---------- */
  const getDeviceLocation = async (): Promise<{
    latitude: number;
    longitude: number;
  } | null> => {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== "granted") {
        console.warn("Location permission not granted");
        return null; // now strictly require location — don't return fallback
      }
      const pos = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Highest,
      });
      const coords = {
        latitude: pos.coords.latitude,
        longitude: pos.coords.longitude,
      };
      setLocationCoords(coords);
      console.log("Location obtained:", coords);
      return coords;
    } catch (err) {
      console.error("getDeviceLocation error:", err);
      return null;
    }
  };

  useEffect(() => {
    const showEvent =
      Platform.OS === "ios" ? "keyboardWillShow" : "keyboardDidShow";
    const hideEvent =
      Platform.OS === "ios" ? "keyboardWillHide" : "keyboardDidHide";

    const showSub = Keyboard.addListener(showEvent, (e: any) => {
      const h = e?.endCoordinates?.height ?? 0;
      setKeyboardHeight(h);
    });
    const hideSub = Keyboard.addListener(hideEvent, () => {
      setKeyboardHeight(0);
    });

    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, []);

  const discountPercent = Math.max(
    0,
    Math.min(
      100,
      Number(discountPercentStr === "" ? 0 : Number(discountPercentStr)) || 0
    )
  );

  const discount = Math.round((subtotal * discountPercent) / 100);
  const payable = subtotal - discount;

  const uriToBlob = (uri: string): Promise<Blob> =>
    new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      xhr.onload = function () {
        resolve(xhr.response);
      };
      xhr.onerror = function (e) {
        reject(new Error("Failed to load file: " + (e as any)?.toString()));
      };
      xhr.responseType = "blob";
      xhr.open("GET", uri, true);
      xhr.send(null);
    });

  /* ---------- Build dynamic currObj ---------- */
  const buildCurrObj = () => {
    // pickup might be null if not fetched; use fallbacks
    const customerName = pickup?.Name;
    const contactNo = pickup?.Contact;
    const address = pickup?.Address;
    const plantName = pickup?.plantName;

    const itemsPayload = cartItemsArray.map((it: any) => ({
      key: it.title,
      heading: it.title,
      subHeading: `${it.price}/pc`,
      quantity: it.qty,
      price: it.price,
      newQtyPrice: it.qty * it.price,
      type: selected,
      img: it.imgKey || "fallback.png",
    }));

    return {
      contactNo,
      customerName,
      address,
      plantName,
      items: itemsPayload,
      price: payable,
      id: orderId,
    };
  };

  const onCheckout = async () => {
    if (!orderId) return Alert.alert("Error", "No orderId found");
    if (!photos.length)
      return Alert.alert("Error", "At least 1 image required");
    if (cartItemsArray.length === 0)
      return Alert.alert("Error", "Add at least one item to proceed");

    if (!locationCoords) {
      const deviceCoords = await getDeviceLocation();
      if (!deviceCoords) {
        return Alert.alert(
          "Location required",
          "This action requires location permission. Please enable location and try again."
        );
      }
    }
    setConfirmLoading(true);
    const currObj = buildCurrObj();

    // Defensive check: ensure currObj has required fields
    if (!currObj.id) {
      setConfirmLoading(false);
      return Alert.alert("Error", "Order ID missing from payload");
    }

    const form = new FormData();
    form.append("currObj", JSON.stringify(currObj));
    form.append("location", JSON.stringify(locationCoords));
    form.append("price", String(payable));

    const isWeb = Platform.OS === "web";

    for (let i = 0; i < photos.length; i++) {
      const uri = photos[i];
      const filename = uri.split("/").pop() || `image_${i}.jpg`;

      try {
        if (isWeb) {
          const blob = await uriToBlob(uri);
          form.append("image", blob as any, filename);
          console.log(
            `Appended web blob ${filename} size: ${(blob as any).size}`
          );
        } else {
          form.append("image", {
            uri,
            name: filename,
            type: "image/jpeg",
          } as any);
          console.log("Appended mobile file", filename, uri);
        }
      } catch (err) {
        console.error("Failed to append image", uri, err);
      }
    }

    if (audioUri) {
      const audioName = audioUri.split("/").pop() || "voice.m4a";
      try {
        if (isWeb) {
          const blob = await uriToBlob(audioUri);
          form.append("voice", blob as any, audioName);
        } else {
          form.append("voice", {
            uri: audioUri,
            name: audioName,
            type: "audio/m4a",
          } as any);
        }
      } catch (e) {
        console.error("Failed to append audio", e);
      }
    }

    try {
      const res = await fetch(`${API_URL}/rider/uploadFiles/${orderId}`, {
        method: "POST",
        headers: {
          Accept: "application/json",
        },
        body: form,
      });

      const json = await res.json().catch(() => null);

      if (!res.ok) {
        console.error("Upload failed. Response not OK.", res.status, json);
        setConfirmLoading(false);
        return Alert.alert("Failed", json?.message || "Upload failed");
      }

      const completeRes = await completePickup(orderId);
      if (!completeRes.ok) {
        // upload succeeded but status update failed — warn user but keep uploaded files
        console.warn(
          "Files uploaded but failed to update pickup status",
          completeRes
        );
        Alert.alert(
          "Partial Success",
          "Files uploaded but failed to update pickup status. Please try marking it complete again from the dashboard."
        );
      } else {
        console.log("Pickup marked complete:", completeRes);
        dashboardPickupRemoved(orderId);

        try {
          const phone = currObj.contactNo ?? pickup?.Contact ?? "";
          const name = currObj.customerName ?? pickup?.Name ?? "";
          await sendWatiMessage(phone, name, payable);
        } catch (err) {
          console.warn("sendWatiMessage failed:", err);
        }
      }

      Alert.alert("Success", "Files uploaded!");

      clear();
      setPhotos([]);
      setAudioUri(null);
      setCheckoutModal(false);
      router.replace({
        pathname: "/(rider)/(tabs)/pickup",
        params: { completedOrderId: orderId },
      });
    } catch (error: any) {
      console.error("NETWORK/UPLOAD ERROR:", error);
      Alert.alert("Error", error?.message ?? JSON.stringify(error));
    } finally {
      setConfirmLoading(false);
    }
  };

  const deleteItem = (itemId: string) => {
    removeItem(itemId);
  };

  const openCheckoutModal = async () => {
    if (cartItemsArray.length === 0) {
      return Alert.alert(
        "Error",
        "Add at least one item to proceed to checkout"
      );
    }

    if (!cameraPermission?.granted) {
      await requestCameraPermission();
    }

    const deviceCoords = await getDeviceLocation();
    if (!deviceCoords) {
      Alert.alert(
        "Location required",
        "This action requires location permission. Please enable location in your device settings.",
        [
          {
            text: "Open Settings",
            onPress: () => {
              Linking.openSettings?.();
            },
          },
          { text: "OK" },
        ]
      );
      return;
    }

    setLocationCoords(deviceCoords);
    setCheckoutModal(true);
  };

  const takePhoto = async () => {
    if (!cameraRef.current) return;
    try {
      const photo = await cameraRef.current.takePictureAsync({ quality: 0.5 });

      const manipulated = await ImageManipulator.manipulateAsync(
        photo.uri,
        [{ resize: { width: 1024 } }],
        {
          compress: 0.8,
          format: SaveFormat.JPEG,
        }
      );

      setPhotos((prev) => [...prev, manipulated.uri]);
    } catch (error) {
      console.error("Error capturing/compressing photo:", error);
      Alert.alert("Error", "Failed to capture image");
    }
  };

  const removePhoto = (uri: string) => {
    setPhotos((prev) => prev.filter((photoUri) => photoUri !== uri));
  };

  const startRecording = async () => {
    try {
      await Audio.requestPermissionsAsync();
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true,
      });

      const { recording } = await Audio.Recording.createAsync(
        Audio.RecordingOptionsPresets.HIGH_QUALITY
      );
      setRecording(recording);
    } catch (err) {
      console.error("Failed to start recording", err);
      Alert.alert("Error", "Could not start recording");
    }
  };

  const stopRecording = async () => {
    if (!recording) return;
    try {
      await recording.stopAndUnloadAsync();
      const uri = recording.getURI();
      setAudioUri(uri || null);
      setRecording(null);
    } catch (err) {
      console.error("Failed to stop recording", err);
    }
  };

  const playAudio = async () => {
    if (!audioUri) return;
    try {
      const { sound } = await Audio.Sound.createAsync({ uri: audioUri });
      setSound(sound);
      await sound.playAsync();
    } catch (err) {
      console.error("Failed to play audio", err);
    }
  };

  const handleDiscountChange = (text: string) => {
    let cleaned = text.replace(/[^0-9]/g, "");
    if (cleaned.length > 1 && cleaned.startsWith("0")) {
      cleaned = cleaned.replace(/^0+/, "");
    }
    if (cleaned.length > 3) cleaned = cleaned.slice(0, 3);
    if (cleaned !== "" && Number(cleaned) > 100) cleaned = "100";
    setDiscountPercentStr(cleaned);
  };

  const handleDiscountBlur = () => {
    if (discountPercentStr === "") setDiscountPercentStr("0");
    if (Number(discountPercentStr) > 100) setDiscountPercentStr("100");
    if (Number(discountPercentStr) < 0) setDiscountPercentStr("0");
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
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={{
            padding: 16,
            paddingBottom: 300 + keyboardHeight,
          }}
        >
          <Text style={[styles.sectionTitle, { color: theme.text }]}>
            Available Items
          </Text>

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
                <Image
                  source={item.img}
                  style={{ width: 42, height: 42, borderRadius: 8 }}
                  resizeMode="contain"
                />

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
                      {
                        id: item.id,
                        title: item.title,
                        price: item.price,
                        img: item.img,
                        type: selected,
                      },
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

          {/* CHECKOUT CARD */}
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
                  <Image
                    source={it.img}
                    style={{ width: 36, height: 36, borderRadius: 6 }}
                    resizeMode="contain"
                  />

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

        {/* FIXED CHECKOUT SUMMARY */}
        <View
          style={[
            styles.summaryPanel,
            {
              backgroundColor: theme.card,
              borderColor: theme.border,
              bottom: insets.bottom + keyboardHeight + 12,
              paddingBottom: insets.bottom > 0 ? 8 : 12,
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

          <View style={[styles.summaryTopRow, styles.discountInputRow]}>
            <Text style={[styles.summaryLabel, { color: theme.subText }]}>
              Discount %
            </Text>

            <View style={styles.discountInputWrap}>
              <TextInput
                value={discountPercentStr}
                onChangeText={handleDiscountChange}
                onBlur={handleDiscountBlur}
                keyboardType="number-pad"
                maxLength={3}
                placeholder="0"
                placeholderTextColor={theme.subText}
                style={[
                  styles.discountInput,
                  {
                    color: theme.text,
                    borderColor: theme.border,
                    backgroundColor: theme.card,
                  },
                ]}
                returnKeyType="done"
              />
              <Text style={[styles.percentSign, { color: theme.subText }]}>
                %
              </Text>
            </View>
          </View>

          {discount > 0 && (
            <View style={styles.summaryTopRow}>
              <Text style={[styles.discountLabel]}>
                Discount ({discountPercent}%)
              </Text>
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
              style={[
                styles.checkoutBtn,
                {
                  backgroundColor:
                    cartItemsArray.length === 0 ? "#9CA3AF" : theme.primary,
                },
              ]}
              activeOpacity={0.8}
              disabled={cartItemsArray.length === 0}
            >
              <Text style={styles.checkoutBtnText}>Complete Pickup</Text>
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

        {/* CHECKOUT MODAL */}
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
                <ScrollView
                  horizontal
                  style={{ marginTop: 15, marginBottom: 8 }}
                >
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
                  style={[styles.modalBtn, styles.secondaryBtn]}
                >
                  <Text style={styles.secondaryBtnText}>Cancel</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  onPress={onCheckout}
                  disabled={confirmLoading}
                  style={[
                    styles.modalBtn,
                    {
                      backgroundColor: confirmLoading
                        ? "#9CA3AF"
                        : theme.primary,
                    },
                  ]}
                >
                  <Text style={styles.primaryBtnText}>
                    {confirmLoading ? "Uploading..." : "Confirm"}
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>
      </View>
      {confirmLoading && (
        <View
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            zIndex: 999,
          }}
        >
          <UniversalLoader fullscreen />
        </View>
      )}
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

  discountInputRow: {
    alignItems: "center",
  },
  discountInputWrap: {
    flexDirection: "row",
    alignItems: "center",
    minWidth: 96,
    justifyContent: "flex-end",
  },
  discountInput: {
    width: 64,
    height: 36,
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 8,
    textAlign: "right",
    fontWeight: "700",
  },
  percentSign: {
    marginLeft: 8,
    fontWeight: "700",
  },

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
    height: 350,
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
    marginTop: 8,
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
  halfBtn: {
    flex: 1,
  },
  modalBtn: {
    flex: 1,
    height: 48,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
});