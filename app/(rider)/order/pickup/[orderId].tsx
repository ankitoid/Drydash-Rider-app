import { useAuth } from "@/context/useAuth";
import { Ionicons } from "@expo/vector-icons";
import { Audio } from "expo-av";
import * as FileSystem from "expo-file-system/legacy";
import { router, useLocalSearchParams } from "expo-router";
import { useEffect, useRef, useState } from "react";
import {
    Alert,
    Linking,
    Modal,
    Platform,
    Pressable,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from "react-native";
import { useTheme } from "../../../../context/ThemeContext";

const API_URL = "https://api.drydash.in/api/v1";

export default function PickupDetails() {
  const { orderId } = useLocalSearchParams<{ orderId: string }>();
  const { theme } = useTheme();
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [pickup, setPickup] = useState<{
    Name: string;
    Address: string;
    Contact: string;
    latitude?: number;
    longitude?: number;
  }>({
    Name: "",
    Address: "",
    Contact: "",
  });
  const [cancelling, setCancelling] = useState(false);
  const [cancelHover, setCancelHover] = useState(false);
  const [navigateHover, setNavigateHover] = useState(false);

  const [cancelModalVisible, setCancelModalVisible] = useState(false);
  const [cancelNote, setCancelNote] = useState("");
  const [recording, setRecording] = useState<Audio.Recording | null>(null);
  const [recordedUri, setRecordedUri] = useState<string | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const [isSubmittingCancel, setIsSubmittingCancel] = useState(false);

  // audio playback refs/state
  const soundRef = useRef<Audio.Sound | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);

  const getPickup = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API_URL}/pickupbyId/${orderId}`, {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
          "x-client-type": "mobile",
        },
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        throw new Error(
          data.message || `Failed to load pickup (${res.status})`,
        );
      }

      setPickup(data.data || { Name: "", Address: "", Contact: "" });
    } catch (error: any) {
      Alert.alert("Error", error?.message || "Failed to load pickup");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (orderId) getPickup();

    return () => {
      // stop active recording safely
      if (recording) {
        recording.stopAndUnloadAsync().catch(() => {});
      }
      // unload sound if any
      if (soundRef.current) {
        soundRef.current.unloadAsync().catch(() => {});
        soundRef.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orderId]);

  const handleCancel = () => {
    setCancelModalVisible(true);
  };

  // Recording functions
  async function startRecording() {
    try {
      // clear previous recording to indicate new one is being recorded (optional)
      if (recordedUri) {
        // keep it, but clear UI so user knows new recording will replace it
        setRecordedUri(null);
      }

      const permission = await Audio.requestPermissionsAsync?.();
      const granted =
        (permission as any)?.granted ||
        (permission as any)?.status === "granted";
      if (!granted) {
        Alert.alert(
          "Permission required",
          "Microphone permission is needed to record voice.",
        );
        return;
      }
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true,
      });
      const options =
        (Audio as any).RECORDING_OPTIONS_PRESET_HIGH_QUALITY ||
        (Audio as any).RecordingOptionsPresets?.HIGH_QUALITY;
      const { recording: rec } = await Audio.Recording.createAsync(options);
      setRecording(rec);
      setIsRecording(true);
    } catch (err) {
      Alert.alert("Recording failed", "Could not start recording.");
    }
  }

  async function stopRecording() {
    if (!recording) return;
    setIsRecording(false);
    try {
      await recording.stopAndUnloadAsync();
    } catch (e) {
      // ignore stop errors
    }
    const uri = recording.getURI();
    setRecordedUri(uri);
    setRecording(null);
  }

  // play/pause toggle
  const togglePlayPause = async () => {
    if (!recordedUri) return;

    try {
      // if we already have a sound created
      if (soundRef.current) {
        const status = await soundRef.current.getStatusAsync();
        if (status.isLoaded) {
          if (status.isPlaying) {
            await soundRef.current.pauseAsync();
            setIsPlaying(false);
            return;
          } else {
            await soundRef.current.playAsync();
            setIsPlaying(true);
            return;
          }
        } else {
          // not loaded - unload and recreate
          await soundRef.current.unloadAsync().catch(() => {});
          soundRef.current = null;
        }
      }

      // create new sound and play
      const { sound } = await Audio.Sound.createAsync({ uri: recordedUri });
      soundRef.current = sound;
      sound.setOnPlaybackStatusUpdate((status) => {
        if (!status) return;
        if (status.isLoaded) {
          setIsPlaying(status.isPlaying ?? false);
          if (status.didJustFinish) {
            // finished
            setIsPlaying(false);
            // unload to free resources
            sound.unloadAsync().catch(() => {});
            soundRef.current = null;
          }
        } else {
          setIsPlaying(false);
        }
      });
      await sound.playAsync();
      setIsPlaying(true);
    } catch (e) {
      Alert.alert("Playback error", "Unable to play/pause recording.");
      setIsPlaying(false);
    }
  };

  const removeRecording = async () => {
    if (!recordedUri) return;
    try {
      if (soundRef.current) {
        try {
          const st = await soundRef.current.getStatusAsync();
          if (st.isLoaded) {
            await soundRef.current.stopAsync().catch(() => {});
          }
        } catch {}
        await soundRef.current.unloadAsync().catch(() => {});
        soundRef.current = null;
      }
      try {
        await FileSystem.deleteAsync(recordedUri, { idempotent: true });
      } catch (e) {}
    } catch (e) {
      // ignore
    } finally {
      setRecordedUri(null);
      setIsPlaying(false);
    }
  };

  const cancelPickup = async (note: string, voiceUri: string | null) => {
    if (!orderId) {
      Alert.alert("Error", "Missing order id");
      return;
    }

    if (!user?.name || !user?.role) {
      Alert.alert("Error", "User information missing. Please log in again.");
      return;
    }

    setIsSubmittingCancel(true);
    try {
      const formData = new FormData();
      if (note) formData.append("note", note);
      if (voiceUri) {
        const fileInfo = await FileSystem.getInfoAsync(voiceUri);
        if (fileInfo.exists) {
          const filename = voiceUri.split("/").pop() || "recording.m4a";
          formData.append("voice", {
            uri: voiceUri,
            type: "audio/m4a",
            name: filename,
          } as any);
        }
      }

      formData.append("userName", user.name);
      formData.append("userRole", user.role);

      const headers: Record<string, string> = {
        Accept: "application/json",
        "x-client-type": "mobile",
      };

      const res = await fetch(`${API_URL}/deletePickup/${orderId}`, {
        method: "PATCH",
        headers,
        body: formData,
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        throw new Error(
          data?.message || `Failed to cancel pickup (${res.status})`,
        );
      }

      Alert.alert("Success", data?.message || "Pickup cancelled");

      // Reset modal state
      setCancelModalVisible(false);
      setCancelNote("");
      setRecordedUri(null);
      setIsRecording(false);
      if (recording) {
        try {
          await recording.stopAndUnloadAsync();
        } catch {}
        setRecording(null);
      }
      if (soundRef.current) {
        try {
          await soundRef.current.unloadAsync();
        } catch {}
        soundRef.current = null;
      }
      setIsPlaying(false);

      router.back();
    } catch (err: any) {
      Alert.alert("Error", err?.message || "Failed to cancel pickup");
    } finally {
      setIsSubmittingCancel(false);
    }
  };

  const phoneNumber = pickup?.Contact;

  const handleCall = () => {
    if (!phoneNumber) return;
    Linking.openURL(`tel:${phoneNumber}`);
  };

  const handleWhatsApp = () => {
    if (!phoneNumber) return;
    const message = encodeURIComponent(
      "Hello, I am your pickup rider. I have arrived for your laundry pickup.",
    );
    Linking.openURL(`https://wa.me/${phoneNumber}?text=${message}`);
  };

  const handleNavigate = async () => {
    if (!pickup) {
      Alert.alert("Navigation error", "Pickup data not loaded yet.");
      return;
    }

    const lat = (pickup as any)?.latitude;
    const lng = (pickup as any)?.longitude;

    let nativeUrl = "";
    let webUrl = "";

    if (lat && lng) {
      nativeUrl =
        Platform.OS === "ios"
          ? `maps://?daddr=${lat},${lng}`
          : `google.navigation:q=${lat},${lng}`;
      webUrl = `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`;
    } else if (pickup.Address) {
      const q = encodeURIComponent(pickup.Address);
      nativeUrl = `https://www.google.com/maps/search/?api=1&query=${q}`;
      webUrl = nativeUrl;
    } else {
      Alert.alert(
        "Navigation unavailable",
        "No address or coordinates available.",
      );
      return;
    }

    try {
      const canOpen = await Linking.canOpenURL(nativeUrl);
      if (canOpen) {
        await Linking.openURL(nativeUrl);
      } else {
        await Linking.openURL(webUrl);
      }
    } catch (err) {
      console.error("Failed to open maps", err);
      try {
        await Linking.openURL(webUrl);
      } catch (e) {
        Alert.alert(
          "Navigation error",
          "Unable to open maps app or web fallback.",
        );
      }
    }
  };

  /* ---------- SKELETON ---------- */

  function SkeletonHeader() {
    return (
      <View style={{ paddingHorizontal: 16, marginBottom: 12 }}>
        <View style={styles.skeletonTitle} />
        <View style={styles.skeletonSub} />
      </View>
    );
  }

  function SkeletonCard() {
    return <View style={styles.skeletonCard} />;
  }

  if (loading || !pickup) {
    return (
      <ScrollView
        style={{ flex: 1, backgroundColor: theme.background }}
        contentContainerStyle={{ padding: 16 }}
      >
        <SkeletonHeader />
        <SkeletonCard />
        <SkeletonCard />
        <SkeletonCard />
        <SkeletonCard />
        <SkeletonCard />
      </ScrollView>
    );
  }

  const isNavigateDisabled =
    !pickup?.Address &&
    !(pickup as any)?.latitude &&
    !(pickup as any)?.longitude;

  const isCancelDisabled =
    (!cancelNote.trim() && !recordedUri) || isSubmittingCancel;

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: theme.background }}
      contentContainerStyle={{ paddingBottom: 120 }}
      showsVerticalScrollIndicator={false}
    >
      {/* TOP HEADER */}
      <View style={[styles.header, { backgroundColor: theme.primary }]}>
        <TouchableOpacity onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={22} color="#fff" />
        </TouchableOpacity>

        <Text style={styles.headerTitle}>Shiptos</Text>

        <View style={styles.avatar}>
          <Text style={styles.avatarText}>
            {user?.name?.slice(0, 1).toUpperCase()}
          </Text>
        </View>
      </View>

      {/* ORDER STATUS */}
      <View style={styles.statusWrap}>
        <Text style={[styles.statusLabel]}>Pickup in Progress</Text>
        <Text style={[styles.orderId, { color: theme.text }]}>
          {orderId ? `WZP-${orderId.slice(-5)}`.toUpperCase() : "WZP-----"}
        </Text>
      </View>

      {/* PICKUP DETAILS */}
      <View style={[styles.card, { backgroundColor: theme.card }]}>
        <Text style={[styles.cardTitle, { color: theme.text }]}>
          Pickup Details
        </Text>

        <DetailRow
          icon="person-outline"
          label=""
          value={pickup?.Name}
          theme={theme}
        />

        <DetailRow
          icon="location-outline"
          label=""
          value={pickup?.Address}
          theme={theme}
        />

        <View style={styles.actionRow}>
          <TouchableOpacity
            style={[styles.actionBtn, { backgroundColor: "#10B981" }]}
            onPress={handleCall}
          >
            <Ionicons name="call-outline" size={18} color="#fff" />
            <Text style={styles.actionText}>Call</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.actionBtn, { backgroundColor: "#10B981" }]}
            onPress={handleWhatsApp}
          >
            <Ionicons name="logo-whatsapp" size={18} color="#fff" />
            <Text style={styles.actionText}>WhatsApp</Text>
          </TouchableOpacity>
        </View>

        <Pressable
          onHoverIn={() => setNavigateHover(true)}
          onHoverOut={() => setNavigateHover(false)}
          onPress={handleNavigate}
          disabled={isNavigateDisabled}
          style={[
            styles.navigateBtn,
            {
              backgroundColor: theme.primary,
              opacity: navigateHover ? 0.85 : isNavigateDisabled ? 0.5 : 1,
            },
          ]}
        >
          <Ionicons name="navigate" size={18} color="#000" />
          <Text style={styles.navigateText}>Navigate</Text>
        </Pressable>

        <Pressable
          onHoverIn={() => setCancelHover(true)}
          onHoverOut={() => setCancelHover(false)}
          onPress={handleCancel}
          disabled={cancelling}
          style={[
            styles.cancelPickupBtn,
            {
              backgroundColor: cancelHover ? theme.danger : theme.primary,
              opacity: cancelling ? 0.7 : 1,
            },
          ]}
        >
          <Text style={styles.cancelPickupText}>
            {cancelling ? "Cancelling..." : "Cancel Pickup"}
          </Text>
        </Pressable>
      </View>

      <Text style={[styles.sectionTitle, { color: theme.text }]}>
        Select Items for Pickup
      </Text>

      <View style={styles.itemsRow}>
        <TouchableOpacity
          activeOpacity={0.85}
          onPress={() =>
            router.push({
              pathname: "/order/pickup/select-items/[type]",
              params: { type: "laundry", orderId: orderId },
            })
          }
          style={[styles.itemCard, { backgroundColor: theme.card }]}
        >
          <View style={styles.iconWrap}>
            <Ionicons name="shirt-outline" size={24} color={theme.primary} />
          </View>
          <Text style={[styles.itemText, { color: theme.text }]}>Laundry</Text>
        </TouchableOpacity>

        <TouchableOpacity
          activeOpacity={0.85}
          onPress={() =>
            router.push({
              pathname: "/order/pickup/select-items/[type]",
              params: { type: "shoespa", orderId: orderId },
            })
          }
          style={[styles.itemCard, { backgroundColor: theme.card }]}
        >
          <View style={styles.iconWrap}>
            <Ionicons name="walk-outline" size={24} color={theme.primary} />
          </View>
          <Text style={[styles.itemText, { color: theme.text }]}>Shoe Spa</Text>
        </TouchableOpacity>

        <TouchableOpacity
          activeOpacity={0.85}
          onPress={() =>
            router.push({
              pathname: "/order/pickup/select-items/[type]",
              params: { type: "dryclean", orderId: orderId },
            })
          }
          style={[styles.itemCard, { backgroundColor: theme.card }]}
        >
          <View style={styles.iconWrap}>
            <Ionicons name="water-outline" size={24} color={theme.primary} />
          </View>
          <Text style={[styles.itemText, { color: theme.text }]}>
            Dry-Clean
          </Text>
        </TouchableOpacity>
      </View>

      <Modal
        visible={cancelModalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setCancelModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: theme.card }]}>
            <Text style={[styles.modalTitle, { color: theme.text }]}>
              Cancel Pickup
            </Text>

            <TextInput
              style={[
                styles.noteInput,
                { color: theme.text, borderColor: theme.border },
              ]}
              placeholder="Enter reason OR record voice (one required)"
              placeholderTextColor={theme.subText}
              value={cancelNote}
              onChangeText={setCancelNote}
              multiline
              numberOfLines={3}
            />

            <View style={styles.voiceRow}>
              <TouchableOpacity
                style={[styles.voiceBtn, { backgroundColor: theme.primary }]}
                onPress={isRecording ? stopRecording : startRecording}
                disabled={isSubmittingCancel}
              >
                <Ionicons
                  name={isRecording ? "stop-circle" : "mic"}
                  size={20}
                  color="#000"
                />
                <Text style={styles.voiceBtnText}>
                  {isRecording ? "Stop" : "Record"}
                </Text>
              </TouchableOpacity>

              {recordedUri && !isRecording && (
                <>
                  <TouchableOpacity
                    style={[styles.playBtn, { backgroundColor: theme.primary }]}
                    onPress={togglePlayPause}
                  >
                    <Ionicons
                      name={isPlaying ? "pause" : "play"}
                      size={20}
                      color="#000"
                    />
                    <Text style={styles.voiceBtnText}>
                      {isPlaying ? "Pause" : "Play"}
                    </Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[
                      styles.playBtn,
                      { backgroundColor: theme.danger, marginLeft: 8 },
                    ]}
                    onPress={removeRecording}
                  >
                    <Ionicons name="trash" size={18} color="#fff" />
                  </TouchableOpacity>
                </>
              )}
            </View>

            {/* Validation hint */}
            {!cancelNote.trim() && !recordedUri && (
              <Text
                style={{ color: theme.danger, fontSize: 12, marginBottom: 8 }}
              >
                Add a note or record a voice message to cancel the pickup.
              </Text>
            )}

            <View style={styles.modalActions}>
              <TouchableOpacity
                style={[styles.modalBtn, { backgroundColor: theme.danger }]}
                onPress={async () => {
                  // safe stop on close
                  try {
                    if (recording) await recording.stopAndUnloadAsync();
                  } catch {}
                  // unload sound if any
                  try {
                    if (soundRef.current) {
                      await soundRef.current.unloadAsync();
                      soundRef.current = null;
                    }
                  } catch {}
                  setRecording(null);
                  setIsRecording(false);
                  setIsPlaying(false);
                  setCancelModalVisible(false);
                }}
                disabled={isSubmittingCancel}
              >
                <Text style={styles.modalBtnText}>Close</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.modalBtn,
                  { backgroundColor: theme.primary },
                  isCancelDisabled && { opacity: 0.5 },
                ]}
                onPress={() => cancelPickup(cancelNote.trim(), recordedUri)}
                disabled={isCancelDisabled}
              >
                <Text style={styles.modalBtnText}>
                  {isSubmittingCancel ? "Cancelling..." : "Confirm Cancel"}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </ScrollView>
  );
}

/* ---------- SMALL COMPONENTS ---------- */

function DetailRow({
  icon,
  label,
  value,
  theme,
}: {
  icon: any;
  label: string;
  value: string;
  theme: any;
}) {
  return (
    <View style={styles.detailRow}>
      <Ionicons name={icon} size={18} color={theme.primary} />
      <View style={{ marginLeft: 10 }}>
        {label ? (
          <Text style={[styles.detailLabel, { color: theme.subText }]}>
            {label}
          </Text>
        ) : null}
        <Text style={[styles.detailValue, { color: theme.text }]}>{value}</Text>
      </View>
    </View>
  );
}

/* ---------- STYLES ---------- */

const styles = StyleSheet.create({
  header: {
    paddingTop: 40,
    paddingHorizontal: 16,
    paddingBottom: 16,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  headerTitle: { color: "#fff", fontWeight: "900", fontSize: 16 },
  avatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "#ECFDF5",
    alignItems: "center",
    justifyContent: "center",
  },
  avatarText: { fontWeight: "800", color: "#16A34A" },

  statusWrap: {
    alignItems: "center",
    marginVertical: 14,
  },
  statusLabel: { color: "#16A34A", fontWeight: "800", fontSize: 13 },
  orderId: { fontSize: 20, fontWeight: "900", marginTop: 4 },

  card: {
    marginHorizontal: 16,
    marginBottom: 16,
    padding: 16,
    borderRadius: 18,
  },
  cardTitle: { fontSize: 16, fontWeight: "900", marginBottom: 12 },

  detailRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    marginBottom: 10,
  },
  detailLabel: { fontSize: 12 },
  detailValue: { fontSize: 14, fontWeight: "700" },

  navigateBtn: {
    marginTop: 14,
    height: 40,
    borderRadius: 14,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },

  navigateText: { fontWeight: "700", color: "#000" },

  cancelPickupBtn: {
    marginTop: 14,
    height: 40,
    borderRadius: 14,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },

  cancelPickupText: { fontWeight: "700", color: "#000" },

  sectionTitle: {
    fontSize: 16,
    fontWeight: "900",
    marginHorizontal: 16,
    marginBottom: 10,
  },
  itemsRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginHorizontal: 16,
    marginBottom: 16,
  },

  itemCard: {
    width: "30%",
    paddingVertical: 18,
    borderRadius: 18,
    alignItems: "center",
    elevation: 6, // Android shadow
  },

  iconWrap: {
    width: 54,
    height: 54,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 8,
  },

  itemText: {
    fontSize: 13,
    fontWeight: "800",
  },

  summaryRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 8,
  },
  summaryLabel: { fontSize: 14 },
  summaryPrice: { fontSize: 14, fontWeight: "800" },

  divider: {
    height: 1,
    backgroundColor: "#E5E7EB",
    marginVertical: 10,
  },

  completeBtn: {
    marginHorizontal: 16,
    height: 54,
    borderRadius: 16,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  skeletonTitle: {
    width: 160,
    height: 22,
    borderRadius: 8,
    backgroundColor: "#CBD5E1",
    opacity: 0.3,
    marginBottom: 8,
  },
  skeletonSub: {
    width: 220,
    height: 14,
    borderRadius: 6,
    backgroundColor: "#CBD5E1",
    opacity: 0.25,
  },
  skeletonCard: {
    height: 86,
    borderRadius: 16,
    backgroundColor: "#CBD5E1",
    opacity: 0.3,
    marginHorizontal: 16,
    marginBottom: 12,
  },
  completeText: { fontWeight: "900", color: "#000" },
  actionRow: {
    flexDirection: "row",
    gap: 10,
    marginTop: 12,
  },

  actionBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 12,
    borderRadius: 10,
    gap: 6,
  },

  actionText: {
    color: "#fff",
    fontWeight: "700",
    fontSize: 14,
  },

  // Modal styles
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "center",
    alignItems: "center",
  },
  modalContent: {
    width: "90%",
    borderRadius: 20,
    padding: 20,
    elevation: 5,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: "900",
    marginBottom: 16,
  },
  noteInput: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 12,
    fontSize: 14,
    textAlignVertical: "top",
    marginBottom: 16,
  },
  voiceRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 20,
  },
  voiceBtn: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 30,
    marginRight: 10,
    gap: 6,
  },
  playBtn: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 30,
    gap: 6,
  },
  voiceBtnText: {
    fontWeight: "700",
    color: "#000",
  },
  modalActions: {
    flexDirection: "row",
    justifyContent: "flex-end",
    gap: 12,
  },
  modalBtn: {
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 12,
  },
  modalBtnText: {
    fontWeight: "700",
    color: "#000",
  },
});
