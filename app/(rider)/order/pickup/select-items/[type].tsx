import UniversalLoader from "@/components/Loader/UniversalLoader";
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
  Linking,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useCart } from "../../../../../context/CartContext";
import { useTheme } from "../../../../../context/ThemeContext";
import { useAuth } from "../../../../../context/useAuth";

const API_URL = "https://api.drydash.in/api/v1";

// Service icon mapping
const SERVICE_ICONS: Record<string, string> = {
  laundry: "shirt-outline",
  shoespa: "walk-outline",
  dryclean: "water-outline",
};

const SERVICE_OPTIONS = [
  { slug: "laundry", label: "Laundry" },
  { slug: "shoespa", label: "Shoe Spa" },
  { slug: "dryclean", label: "Dry-Clean" },
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

  // Dynamically fetched service data and pagination per slug
  const [servicesBySlug, setServicesBySlug] = useState<
    Record<
      string,
      {
        catalog?: any;
        items: any[];
        page: number;
        totalPages: number;
        hasNextPage: boolean;
        loading: boolean;
      }
    >
  >({});
  const [servicesLoading, setServicesLoading] = useState(false);

  const [cameraPermission, requestCameraPermission] = useCameraPermissions();
  const cameraRef = useRef<CameraView>(null);

  const [photos, setPhotos] = useState<string[]>([]);
  const [recording, setRecording] = useState<Audio.Recording | null>(null);
  const [audioUri, setAudioUri] = useState<string | null>(null);
  const [sound, setSound] = useState<Audio.Sound | null>(null);

  const [audioDuration, setAudioDuration] = useState<number | null>(null); // seconds
  const [isPlaying, setIsPlaying] = useState<boolean>(false);

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

  console.log("Fetching pickup details for orderId:", orderId);

  useEffect(() => {
    if (orderId) {
      fetchPickupById(orderId);
    }
  }, [orderId]);

  const PAGE_LIMIT = 10;

  /* ---------- Fetch the selected service catalog ---------- */
  const fetchSelectedService = async (slug: string, page = 1) => {
    const current = servicesBySlug[slug] ?? {
      items: [],
      page: 0,
      totalPages: 0,
      hasNextPage: true,
      loading: false,
    };

    if (current.loading) return;

    if (page === 1) {
      setServicesLoading(true);
    }

    setServicesBySlug((prev) => ({
      ...prev,
      [slug]: {
        ...current,
        loading: true,
      },
    }));

    try {
      const res = await fetch(
        `${API_URL}/catalog/${slug}?isActive=true&page=${page}&limit=${PAGE_LIMIT}`,
        {
          method: "GET",
          headers: {
            "Content-Type": "application/json",
            "x-client-type": "mobile",
          },
        },
      );

      const json = await res.json().catch(() => null);
      console.log(`Catalog ${slug} API response:`, json);
      if (!res.ok) {
        console.warn(`Failed to fetch catalog ${slug}`, res.status, json);
        setServicesBySlug((prev) => ({
          ...prev,
          [slug]: {
            ...current,
            loading: false,
          },
        }));
        return;
      }

      const catalog = json?.data ?? null;
      const pagination = json?.pagination ?? {};
      if (!catalog) {
        console.warn(`No catalog data returned for ${slug}`);
        setServicesBySlug((prev) => ({
          ...prev,
          [slug]: {
            ...current,
            loading: false,
          },
        }));
        return;
      }

      const incomingItems = Array.isArray(catalog.items) ? catalog.items : [];
      const mergedItems =
        page === 1 ? incomingItems : [...current.items, ...incomingItems];

      setServicesBySlug((prev) => ({
        ...prev,
        [slug]: {
          catalog,
          items: mergedItems,
          page,
          totalPages: pagination.totalPages ?? page,
          hasNextPage:
            typeof pagination.hasNextPage === "boolean"
              ? pagination.hasNextPage
              : page < (pagination.totalPages ?? page),
          loading: false,
        },
      }));
    } catch (err) {
      console.error(`fetchSelectedService error for ${slug}:`, err);
      setServicesBySlug((prev) => ({
        ...prev,
        [slug]: {
          ...current,
          loading: false,
        },
      }));
    } finally {
      if (page === 1) {
        setServicesLoading(false);
      }
    }
  };

  useEffect(() => {
    if (selected) {
      const service = servicesBySlug[selected];
      if (!service || service.page === 0) {
        fetchSelectedService(selected, 1);
      }
    }
  }, [selected]);

  const selectedService = servicesBySlug[selected] ?? {
    catalog: null,
    items: [] as any[],
    page: 0,
    totalPages: 0,
    hasNextPage: false,
    loading: false,
  };

  const items = useMemo(() => {
    // Get service items from the selected slug
    if (!selectedService.items) return [];

    // Map API items to the expected format with all details
    return selectedService.items.map((item: any, index: number) => ({
      id: item._id || `${selected}-${index}`,
      title: item.label,
      price: item.price,
      displayPrice: item.displayPrice || `${item.price}/${item.unit}`,
      description: item.mainDescription,
      heading: item.mainHeading,
      // Use the first image from the API response
      img: item.images?.[0]?.url
        ? { uri: item.images[0].url }
        : { uri: "https://via.placeholder.com/100?text=No+Image" },
      type: item.type,
      unit: item.unit,
      process: item.process || [],
      sku: item.sku,
    }));
  }, [selected, servicesBySlug]);

  const availableItems = items.filter((i) => getQty(i.id) === 0);
  const cartItemsArray = Object.values(cartItems);
  const subtotal = Math.round(total());

  const loadMoreItems = () => {
    if (!selectedService.hasNextPage || selectedService.loading) return;
    fetchSelectedService(selected, selectedService.page + 1);
  };

  const isCloseToBottom = ({
    layoutMeasurement,
    contentOffset,
    contentSize,
  }: any) => {
    return (
      layoutMeasurement.height + contentOffset.y >= contentSize.height - 120
    );
  };

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

  // const completePickup = async (id: string) => {
  //   try {
  //     const res = await fetch(`${API_URL}/completePickup/${id}`, {
  //       method: "PUT",
  //       headers: {
  //         "Content-Type": "application/json",
  //         "x-client-type": "mobile",
  //       },
  //     });

  //     const json = await res.json().catch(() => null);
  //     if (!res.ok) {
  //       console.warn("completePickup failed:", res.status, json);
  //       return { ok: false, status: res.status, json };
  //     }
  //     return { ok: true, status: res.status, json };
  //   } catch (err) {
  //     console.error("completePickup error:", err);
  //     return { ok: false, err };
  //   }
  // };

  const sendWatiMessage = async (
    customerNumber: string,
    name: string,
    totalBill: number,
  ) => {
    try {
      const url =
        "https://live-mt-server.wati.io/101289/api/v1/sendTemplateMessage" +
        `?whatsappNumber=${customerNumber}`;

      const res = await fetch(url, {
        method: "POST",
        headers: {
          "content-type": "application/json-patch+json",
          Authorization:
            "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1bmlxdWVfbmFtZSI6ImF5dXNoc2luZ2g4NDIwMThAZ21haWwuY29tIiwibmFtZWlkIjoiYXl1c2hzaW5naDg0MjAxOEBnbWFpbC5jb20iLCJlbWFpbCI6ImF5dXNoc2luZ2g4NDIwMThAZ21haWwuY29tIiwiYXV0aF90aW1lIjoiMTIvMDgvMjAyNSAwNzoyMzo1MyIsInRlbmFudF9pZCI6IjEwMTI4OSIsImRiX25hbWUiOiJtdC1wcm9kLVRlbmFudHMiLCJodHRwOi8vc2NoZW1hcy5taWNyb3NvZnQuY29tL3dzLzIwMDgvMDYvaWRlbnRpdHkvY2xhaW1zL3JvbGUiOlsiVEVNUExBVEVfTUFOQUdFUiIsIkRFVkVMT1BFUiIsIkFVVE9NQVRJT05fTUFOQUdFUiJdLCJleHAiOjI1MzQwMjMwMDgwMCwiaXNzIjoiQ2xhcmVfQUkiLCJhdWQiOiJDbGFyZV9BSSJ9.NpVe1fi-RXRuNgCAGzFQLZT6dE7Y-rvlx1SYxLKZ_m4",
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
        accuracy: Location.Accuracy.Balanced,
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
      Number(discountPercentStr === "" ? 0 : Number(discountPercentStr)) || 0,
    ),
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

    // Format items as per backend requirement
    // Backend expects: [{ "itemId": "catalogItemId", "quantity": 2 }, ...]
    const itemsPayload = cartItemsArray.map((item: any) => ({
      itemId: item.id, // Use the item id (catalog item ID from API)
      quantity: item.qty,
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
          "This action requires location permission. Please enable location and try again.",
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
    // form.append("currObj", JSON.stringify(currObj));
    form.append("location", JSON.stringify(locationCoords));
    form.append("items", JSON.stringify(buildCurrObj().items));
    // form.append("price", String(payable));

    const isWeb = Platform.OS === "web";

    for (let i = 0; i < photos.length; i++) {
      const uri = photos[i];
      const filename = uri.split("/").pop() || `image_${i}.jpg`;

      try {
        if (isWeb) {
          const blob = await uriToBlob(uri);
          form.append("image", blob as any, filename);
          console.log(
            `Appended web blob ${filename} size: ${(blob as any).size}`,
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
        // setConfirmLoading(false);
        return Alert.alert("Failed", json?.message || "Upload failed");
      }
      // const completeRes = await completePickup(orderId);
      // if (!completeRes.ok) {
      //   // upload succeeded but status update failed — warn user but keep uploaded files
      //   console.warn(
      //     "Files uploaded but failed to update pickup status",
      //     completeRes
      //   );
      //   Alert.alert(
      //     "Partial Success",
      //     "Files uploaded but failed to update pickup status. Please try marking it complete again from the dashboard."
      //   );
      // } else {
      //   console.log("Pickup marked complete:", completeRes);

      try {
        const phone = currObj.contactNo ?? pickup?.Contact ?? "";
        const name = currObj.customerName ?? pickup?.Name ?? "";
        await sendWatiMessage(phone, name, payable);
      } catch (err) {
        console.warn("sendWatiMessage failed:", err);
        // }
      }

      Alert.alert("Success", "Files uploaded!");

      clear();
      setPhotos([]);
      setAudioUri(null);
      setAudioDuration(null);
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
        "Add at least one item to proceed to checkout",
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
        ],
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
        },
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
        Audio.RecordingOptionsPresets.HIGH_QUALITY,
      );
      setRecording(recording);
      setAudioUri(null);
      setAudioDuration(null);
      if (sound) {
        try {
          await sound.unloadAsync();
        } catch {}
        setSound(null);
        setIsPlaying(false);
      }
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
      setRecording(null);

      if (uri) {
        setAudioUri(uri);
        try {
          const { sound: tmpSound, status } = await Audio.Sound.createAsync(
            { uri },
            { shouldPlay: false },
          );
          const durMs =
            typeof (status as any).durationMillis === "number"
              ? (status as any).durationMillis
              : 0;
          setAudioDuration(Math.round(durMs / 1000));
          await tmpSound.unloadAsync();
        } catch (e) {
          console.warn("Failed to read audio duration", e);
        }
      }
    } catch (err) {
      console.error("Failed to stop recording", err);
    }
  };

  const playAudio = async () => {
    if (!audioUri) return;
    try {
      if (!sound) {
        const { sound: s } = await Audio.Sound.createAsync(
          { uri: audioUri },
          { shouldPlay: true },
        );
        setSound(s);
        setIsPlaying(true);

        s.setOnPlaybackStatusUpdate((status) => {
          if (!status) return;
          if (!("isLoaded" in status) || !(status as any).isLoaded) {
            return;
          }
          const loaded = status as any;
          setIsPlaying(Boolean(loaded.isPlaying));
          if (loaded.didJustFinish) {
            s.unloadAsync().catch(() => {});
            setSound(null);
            setIsPlaying(false);
          }
        });
      } else {
        const status = await sound.getStatusAsync();
        if ("isPlaying" in status && status.isPlaying) {
          await sound.pauseAsync();
          setIsPlaying(false);
        } else {
          await sound.playAsync();
          setIsPlaying(true);
        }
      }
    } catch (err) {
      console.error("Failed to play/pause audio", err);
      Alert.alert("Playback error", "Unable to play the recorded message.");
    }
  };

  const removeAudio = async () => {
    setAudioUri(null);
    setAudioDuration(null);
    try {
      if (sound) {
        await sound.unloadAsync();
        setSound(null);
      }
    } catch (e) {}
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
          {SERVICE_OPTIONS.map((service) => {
            const isActive = service.slug === selected;
            const iconName = SERVICE_ICONS[service.slug] || "list-outline";
            return (
              <TouchableOpacity
                key={service.slug}
                onPress={() => setSelected(service.slug)}
                style={[
                  styles.tab,
                  {
                    backgroundColor: isActive ? theme.primary : theme.card,
                    borderColor: theme.border,
                  },
                ]}
              >
                <Ionicons
                  name={iconName as any}
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
          onScroll={({ nativeEvent }) => {
            if (isCloseToBottom(nativeEvent)) {
              loadMoreItems();
            }
          }}
          scrollEventThrottle={200}
        >
          <Text style={[styles.sectionTitle, { color: theme.text }]}>
            Available Items
          </Text>

          <View style={styles.smallRowList}>
            {servicesLoading || selectedService.loading ? (
              <Text style={{ color: theme.subText }}>Loading items...</Text>
            ) : availableItems.length === 0 ? (
              <Text style={{ color: theme.subText }}>No items available</Text>
            ) : null}

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
                  style={{ width: 56, height: 56, borderRadius: 10 }}
                  resizeMode="contain"
                />

                <View style={{ flex: 1, marginLeft: 12 }}>
                  <Text
                    style={[styles.smallTitle, { color: theme.text }]}
                    numberOfLines={1}
                  >
                    {item.title}
                  </Text>
                  <Text style={[styles.smallPrice, { color: theme.primary }]}>
                    ₹{item.price}
                  </Text>
                  <Text
                    style={[styles.smallDescription, { color: theme.subText }]}
                    numberOfLines={1}
                  >
                    {item.displayPrice}
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
                        type: item.type,
                      },
                      1,
                    )
                  }
                  style={[
                    styles.smallAddBtn,
                    { backgroundColor: theme.primary },
                  ]}
                >
                  <Ionicons name="add" size={18} color="#fff" />
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

          {selectedService.hasNextPage && selectedService.loading && (
            <View style={styles.loadingMoreContainer}>
              <Text style={{ color: theme.subText }}>Loading more items…</Text>
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

              <Text style={[styles.audioLabel, { color: theme.text }]}>
                Voice Instructions
              </Text>

              <View style={styles.audioControlContainer}>
                <TouchableOpacity
                  onPress={recording ? stopRecording : startRecording}
                  style={[
                    styles.recordButton,
                    { backgroundColor: recording ? "#EF4444" : theme.primary },
                  ]}
                >
                  <Ionicons
                    name={recording ? "square" : "mic"}
                    size={20}
                    color="#fff"
                  />
                </TouchableOpacity>

                <View style={styles.audioInfo}>
                  <TouchableOpacity
                    onPress={playAudio}
                    disabled={!audioUri}
                    style={[
                      styles.playButton,
                      {
                        backgroundColor: audioUri ? "#111827" : "#E5E7EB",
                      },
                    ]}
                  >
                    <Ionicons
                      name={isPlaying ? "pause" : "play"}
                      size={18}
                      color={audioUri ? "#fff" : "#9CA3AF"}
                    />
                  </TouchableOpacity>

                  <Text
                    style={[styles.audioDurationText, { color: theme.subText }]}
                  >
                    {audioDuration != null
                      ? `${audioDuration}s`
                      : audioUri
                        ? "…"
                        : "No recording"}
                  </Text>
                </View>

                <TouchableOpacity
                  onPress={removeAudio}
                  disabled={!audioUri}
                  style={[styles.audioTrash, { opacity: audioUri ? 1 : 0.4 }]}
                >
                  <Ionicons name="trash-outline" size={18} color="#EF4444" />
                </TouchableOpacity>
              </View>

              {/* ACTIONS */}
              <View style={styles.modalActions}>
                <TouchableOpacity
                  onPress={() => {
                    setCheckoutModal(false);
                    setPhotos([]);
                    setAudioUri(null);
                    setAudioDuration(null);
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
  smallPrice: { fontSize: 14, marginTop: 2, fontWeight: "700" },
  smallDescription: { fontSize: 12, marginTop: 2 },
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

  audioControlContainer: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 10,
    gap: 12,
  },
  recordButton: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: "center",
    justifyContent: "center",
    elevation: 3,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.12,
    shadowRadius: 6,
  },
  audioInfo: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  playButton: {
    width: 44,
    height: 44,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    elevation: 2,
  },
  audioDurationText: {
    fontSize: 13,
    fontWeight: "700",
  },
  audioTrash: {
    width: 40,
    height: 40,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },

  loadingMoreContainer: {
    paddingVertical: 14,
    alignItems: "center",
    justifyContent: "center",
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
