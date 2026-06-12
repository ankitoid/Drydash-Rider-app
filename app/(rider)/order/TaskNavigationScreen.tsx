import UniversalLoader from "@/components/Loader/UniversalLoader";
import { TaskNavigationMap } from "@/components/TaskNavigationMap";
import { useAuth } from "@/context/useAuth";
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { useLowPowerMode } from "expo-battery";
import * as KeepAwake from "expo-keep-awake";
import { useCallback, useEffect, useState, useRef } from "react";
import {
  Alert,
  AppState,
  AppStateStatus,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  Modal,
  TextInput,
  ActivityIndicator,
  Platform,
} from "react-native";
import { useTheme } from "../../../context/ThemeContext";
import { Audio } from "expo-av";
import DateTimePicker, {
  DateTimePickerAndroid,
} from "@react-native-community/datetimepicker";
import moment from "moment";
import { trackingLegService } from "@/services/trackingLegService";
import { locationService } from "@/services/locationService";
import { socket } from "@/services/socket";
import * as Location from "expo-location";

type NavigationTaskType = "pickup" | "delivery" | "return_to_plant";

type Props = {
  orderId: string;
  type: NavigationTaskType;
};

type TaskDetails = {
  taskId?: string;
  title: string;
  address?: string;
  destination?: {
    latitude: number;
    longitude: number;
  } | null;
};

const getCoordinates = (value: any) => {
  if (value?.latitude != null && value?.longitude != null) {
    return {
      latitude: value.latitude,
      longitude: value.longitude,
    };
  }

  if (value?.lat != null && value?.lng != null) {
    return {
      latitude: value.lat,
      longitude: value.lng,
    };
  }

  return null;
};

const getPickupLocation = (data: any) => {
  return (
    getCoordinates(data?.pickupLocation) ||
    getCoordinates(data?.pickup_location) ||
    getCoordinates(data?.pickupAddressLocation) ||
    getCoordinates(data?.location) ||
    getCoordinates(data?.deliveryLocation)
  );
};

const API_URL = "https://api.shiptos.com/api/v1";
const AUTH_API_URL = "https://api.shiptos.com/api/v1/auth";

export default function TaskNavigationScreen({ orderId, type }: Props) {

  useEffect(() => {
    KeepAwake.activateKeepAwakeAsync("navigation_screen_wake_lock");

    const handleAppStateChange = (nextAppState: AppStateStatus) => {
      if (nextAppState === "active") {
        console.log("Aggressively re-activating screen wake lock...");
        KeepAwake.activateKeepAwakeAsync("navigation_screen_wake_lock");
      }
    };

    const subscription = AppState.addEventListener("change", handleAppStateChange);

    return () => {
      subscription.remove();
      KeepAwake.deactivateKeepAwake("navigation_screen_wake_lock");
    };
  }, []);

  const { theme, isDark } = useTheme();
  const isLowPowerMode = useLowPowerMode();
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [task, setTask] = useState<TaskDetails | null>(null);
  const [rawTaskData, setRawTaskData] = useState<any>(null);

  // DateTimePicker state (For Pickup Reschedule)
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [rescheduleSubmitting, setRescheduleSubmitting] = useState(false);

  // Cancellation state (For Pickup Cancel)
  const [cancelModalVisible, setCancelModalVisible] = useState(false);
  const [cancelNote, setCancelNote] = useState("");
  const [cancelRecording, setCancelRecording] = useState<Audio.Recording | null>(null);
  const [cancelRecordedUri, setCancelRecordedUri] = useState<string | null>(null);
  const [cancelIsRecording, setCancelIsRecording] = useState(false);
  const cancelSoundRef = useRef<Audio.Sound | null>(null);
  const [cancelIsPlaying, setCancelIsPlaying] = useState(false);
  const [isRemovingCancelAudio, setIsRemovingCancelAudio] = useState(false);
  const [cancelSubmitting, setCancelSubmitting] = useState(false);

  // Delivery Reschedule state
  const [rescheduleVisible, setRescheduleVisible] = useState(false);
  const [rescheduling, setRescheduling] = useState(false);

  // Clean up recording/sound on unmount
  useEffect(() => {
    return () => {
      if (cancelSoundRef.current) {
        cancelSoundRef.current.unloadAsync().catch(() => { });
        cancelSoundRef.current = null;
      }
      if (cancelRecording) {
        cancelRecording.stopAndUnloadAsync().catch(() => { });
      }
    };
  }, [cancelRecording]);

  // Save progress helper
  const saveProgressIfActive = async () => {
    try {
      const activeLeg = await trackingLegService.getActiveLeg();
      const currentTaskId = task?.taskId || orderId;
      if (activeLeg && (activeLeg.taskId === orderId || activeLeg.taskId === currentTaskId)) {
        let currentLocation: { latitude: number; longitude: number } | undefined = undefined;
        try {
          const loc = await Location.getCurrentPositionAsync({
            accuracy: Location.Accuracy.Balanced,
          });
          currentLocation = {
            latitude: loc.coords.latitude,
            longitude: loc.coords.longitude,
          };
        } catch (e) {
          console.warn("Could not get location to save active progress", e);
        }

        const completed = await trackingLegService.completeActiveLeg(currentLocation);
        await locationService.stopTracking();

        socket.emit("taskNavigationEnded", {
          riderId: user?._id,
          trackingLegId: completed?.id,
          taskId: activeLeg.taskId,
          taskType: type,
          totalDistanceKm: completed?.totalDistanceKm ?? activeLeg.totalDistanceKm,
        });

        if (completed?.id) {
          await fetch(`${API_URL}/location/tracking/complete`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              riderId: user?._id,
              trackingLegId: completed.id,
              taskId: activeLeg.taskId,
              taskType: type,
              totalDistanceKm: completed.totalDistanceKm,
              endLocation: completed.endLocation ?? currentLocation,
            }),
          }).catch((httpErr) => {
            console.warn("Tracking completion sync failed", httpErr);
          });
        }
      }
    } catch (error) {
      console.error("Error saving active leg progress:", error);
    }
  };

  // --- Pickup Reschedule Date Picker Trigger ---
  const openReschedulePicker = () => {
    if (Platform.OS === "android") {
      DateTimePickerAndroid.open({
        value: selectedDate,
        mode: "date",
        minimumDate: new Date(),
        onChange: (_event, date) => {
          if (date) {
            setSelectedDate(date);
            reschedulePickup(date);
          }
        },
      });
      return;
    }
    setShowDatePicker(true);
  };

  // --- Pickup Reschedule Submission ---
  const reschedulePickup = async (date: Date) => {
    setRescheduleSubmitting(true);
    try {
      await saveProgressIfActive();

      const res = await fetch(`${API_URL}/rider/reschedulePickup/${orderId}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
          "x-client-type": "mobile",
        },
        body: JSON.stringify({
          newDate: moment(date).format("YYYY-MM-DD"),
        }),
      });

      const json = await res.json().catch(() => null);
      if (!res.ok) {
        throw new Error(
          json?.message || `Failed to reschedule pickup (${res.status})`,
        );
      }

      Alert.alert(
        "Success",
        json?.message || "Pickup rescheduled successfully",
        [{ text: "OK", onPress: () => router.back() }],
      );
    } catch (error: any) {
      Alert.alert("Error", error?.message || "Failed to reschedule pickup");
    } finally {
      setRescheduleSubmitting(false);
      setShowDatePicker(false);
    }
  };

  // --- Pickup Cancellation audio/note controls ---
  const handleCancelPress = () => {
    setCancelModalVisible(true);
  };

  async function startCancelRecording() {
    try {
      if (cancelRecordedUri) {
        await removeCancelRecording();
      }

      const permission = await Audio.requestPermissionsAsync();
      if (permission.status !== "granted") {
        Alert.alert("Permission required", "Microphone permission is needed.");
        return;
      }
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true,
      });
      const { recording: rec } = await Audio.Recording.createAsync(
        Audio.RecordingOptionsPresets.HIGH_QUALITY,
        undefined,
        300,
      );
      setCancelRecording(rec);
      setCancelIsRecording(true);
    } catch (error) {
      console.error("Recording start error:", error);
      Alert.alert("Recording failed", "Could not start recording.");
    }
  }

  async function stopCancelRecording() {
    if (!cancelRecording) return;
    setCancelIsRecording(false);
    try {
      await cancelRecording.stopAndUnloadAsync();
      const uri = cancelRecording.getURI();
      if (uri) setCancelRecordedUri(uri);
    } catch (error) {
      console.error("Stop recording error:", error);
      Alert.alert("Error", "Failed to stop recording");
    } finally {
      setCancelRecording(null);
    }
  }

  const toggleCancelPlayPause = async () => {
    if (!cancelRecordedUri) return;
    try {
      if (cancelSoundRef.current) {
        const status = await cancelSoundRef.current.getStatusAsync();
        if (status.isLoaded) {
          if (status.isPlaying) {
            await cancelSoundRef.current.pauseAsync();
            setCancelIsPlaying(false);
            return;
          } else {
            await cancelSoundRef.current.playAsync();
            setCancelIsPlaying(true);
            return;
          }
        } else {
          await cancelSoundRef.current.unloadAsync().catch(() => { });
          cancelSoundRef.current = null;
        }
      }
      const { sound } = await Audio.Sound.createAsync({
        uri: cancelRecordedUri,
      });
      cancelSoundRef.current = sound;
      sound.setOnPlaybackStatusUpdate((status) => {
        if (!status) return;
        if (status.isLoaded) {
          setCancelIsPlaying(status.isPlaying ?? false);
          if (status.didJustFinish) {
            setCancelIsPlaying(false);
            sound.unloadAsync().catch(() => { });
            cancelSoundRef.current = null;
          }
        } else {
          setCancelIsPlaying(false);
        }
      });
      await sound.playAsync();
      setCancelIsPlaying(true);
    } catch (error) {
      console.error("Playback error:", error);
      Alert.alert("Playback error", "Unable to play/pause recording.");
      setCancelIsPlaying(false);
    }
  };

  const removeCancelRecording = async () => {
    if (!cancelRecordedUri) return;
    setIsRemovingCancelAudio(true);
    try {
      if (cancelSoundRef.current) {
        try {
          const status = await cancelSoundRef.current.getStatusAsync();
          if (status.isLoaded) {
            await cancelSoundRef.current.stopAsync().catch(() => { });
          }
        } catch (error) {
          console.warn("Sound cleanup error:", error);
        }
        await cancelSoundRef.current.unloadAsync().catch(() => { });
        cancelSoundRef.current = null;
      }
    } catch (error) {
      console.error("Error in removeCancelRecording:", error);
    } finally {
      setCancelRecordedUri(null);
      setCancelIsPlaying(false);
      setIsRemovingCancelAudio(false);
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

    setCancelSubmitting(true);
    try {
      await saveProgressIfActive();

      const formData = new FormData();
      if (note.trim()) {
        formData.append("note", note.trim());
      }
      if (voiceUri) {
        const filename = voiceUri.split("/").pop() || "recording.m4a";
        const mimeType = filename.endsWith(".mp3")
          ? "audio/mpeg"
          : "audio/mp4";
        formData.append("voice", {
          uri: voiceUri,
          type: mimeType,
          name: filename,
        } as any);
      }
      formData.append("userName", user.name);
      formData.append("userRole", user.role);

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 30000);

      const res = await fetch(`${API_URL}/deletePickup/${orderId}`, {
        method: "PATCH",
        headers: {
          Accept: "application/json",
          "x-client-type": "mobile",
        },
        body: formData,
        signal: controller.signal,
      });
      clearTimeout(timeoutId);

      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(
          json?.message || `Failed to cancel pickup (${res.status})`,
        );
      }

      Alert.alert("Success", json?.message || "Pickup cancelled");

      setCancelModalVisible(false);
      setCancelNote("");
      setCancelRecordedUri(null);
      setCancelIsRecording(false);
      if (cancelRecording) {
        try {
          await cancelRecording.stopAndUnloadAsync();
        } catch { }
          setCancelRecording(null);
      }
      if (cancelSoundRef.current) {
        try {
          await cancelSoundRef.current.unloadAsync();
        } catch { }
        cancelSoundRef.current = null;
      }
      setCancelIsPlaying(false);

      router.back();
    } catch (err: any) {
      if (err.name === "AbortError") {
        Alert.alert(
          "Error",
          "Request timed out. Please check your connection.",
        );
      } else {
        Alert.alert("Error", err?.message || "Failed to cancel pickup");
      }
    } finally {
      setCancelSubmitting(false);
    }
  };

  // --- Delivery Reschedule Wati Integration & Status Update & API Call ---
  const wattiUri = "https://live-server-101289.wati.io/api/v1";
  const wattiToken =
    "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1bmlxdWVfbmFtZSI6ImF5dXNoc2luZ2g4NDIwMThAZ21haWwuY29tIiwibmFtZWlkIjoiYXl1c2hzaW5naDg0MjAxOEBnbWFpbC5jb20iLCJlbWFpbCI6ImF5dXNoc2luZ2g4NDIwMThAZ21haWwuY29tIiwiYXV0aF90aW1lIjoiMTIyMDg5IiwidGVuYW50X2lkIjoiMTAxMjg5IiwiZGJfbmFtZSI6Im10LXByb2QtVGVuYW50cyIsImh0dHA6Ly9zY2hlbWFzLm1pY3Jvc29mdC5jb20vd3MvMjAwOC8wNi9pZGVudGl0eS9jbGFpbXMvcm9sZSI6WyJURU1QTEFURV9NQU5BR0VSIiwiREVWRUxPUEVSIiwiQVVUT01BVElPTV9NQU5BR0VSIl0sImV4cCI6MjUzNDAyMzAwODAwLCJpc3MiOiJDbGFyZV9BSSIsImF1ZCI6IkNsYXJlX0FJIn0.NpVe1fi-RXRuNgCAGzFQLZT6dE7Y-rvlx1SYxLKZ_m4";

  const normalizePhoneForWhatsApp = (raw: any) => {
    if (!raw) return null;
    let digits = String(raw).replace(/\D/g, "");
    if (digits.length === 10) digits = "91" + digits;
    if (digits.length < 11) return null;
    return digits;
  };

  const updateStatusTo = async (id: string | undefined, status: string) => {
    if (!id) return;
    try {
      const res = await fetch(`${API_URL}/updateOrderStatus/${id}`, {
        method: "PATCH",
        body: JSON.stringify({ status }),
        headers: {
          "Content-Type": "application/json",
          "x-client-type": "mobile",
        },
      });

      const json = await res.json().catch(() => null);
      if (!res.ok) {
        throw new Error(json?.message || "Failed to update order status");
      }
    } catch (error) {
      console.log("Order status update error:", error);
      throw error;
    }
  };

  const sendWhatsAppTemplateRescheduleNoCall = async () => {
    try {
      const phone = normalizePhoneForWhatsApp(rawTaskData?.contactNo);
      if (!phone) return false;

      const templatePayload = {
        template_name: "delivery_rescheduled__unable_to_reach_customer_",
        broadcast_name: `delivery_rescheduled__unable_to_reach_customer_${orderId}_${Date.now()}`,
        parameters: [{ name: "name", value: rawTaskData?.customerName }],
      };

      const sendRes = await fetch(
        `${wattiUri}/sendTemplateMessage?whatsappNumber=${phone}`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${wattiToken}`,
          },
          body: JSON.stringify(templatePayload),
        },
      );

      return sendRes.ok;
    } catch (err) {
      console.error("Error sending reschedule no-call template:", err);
      return false;
    }
  };

  const sendWhatsAppTemplateRescheduleWithCall = async (chosenDate?: Date) => {
    try {
      const rescheduleDate = chosenDate
        ? moment(chosenDate).format("MMMM Do YYYY")
        : moment(rawTaskData?.rescheduledDate).format("MMMM Do YYYY");

      const phone = normalizePhoneForWhatsApp(rawTaskData?.contactNo);
      if (!phone) return false;

      const templatePayload = {
        template_name: "delivery__rescheduling_notification",
        broadcast_name: `delivery__rescheduling_notification_${orderId}_${Date.now()}`,
        parameters: [
          { name: "name", value: rawTaskData?.customerName },
          {
            name: "delivery_rescheduled_date",
            value: rescheduleDate,
          },
        ],
      };

      const sendRes = await fetch(
        `${wattiUri}/sendTemplateMessage?whatsappNumber=${phone}`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${wattiToken}`,
          },
          body: JSON.stringify(templatePayload),
        },
      );

      return sendRes.ok;
    } catch (error) {
      console.error("Error sending reschedule with-call template:", error);
      return false;
    }
  };

  const rescheduleDeliveryOrder = async (
    newDate: Date | null,
    answered: boolean,
  ) => {
    setRescheduling(true);
    try {
      await saveProgressIfActive();

      const dateToSend = newDate ? newDate.toISOString() : null;

      const res = await fetch(
        `${API_URL}/rider/rescheduleorder/${orderId}`,
        {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ newDate: dateToSend }),
        },
      );

      const json = await res.json();
      if (!res.ok) {
        throw new Error(json.message || "Failed to reschedule");
      }

      await updateStatusTo(orderId, "ready for delivery");

      if (answered) {
        await sendWhatsAppTemplateRescheduleWithCall(newDate ?? undefined);
      } else {
        await sendWhatsAppTemplateRescheduleNoCall();
      }

      router.replace({
        pathname: "/(rider)/(tabs)/pickup",
        params: { completedOrderId: orderId },
      });
    } catch (err) {
      console.error("Error rescheduling delivery order:", err);
      Alert.alert("Error", "Could not reschedule delivery order.");
    } finally {
      setRescheduleVisible(false);
      setRescheduling(false);
    }
  };

  const openDetails = useCallback(() => {
    if (type === "return_to_plant") {
      router.replace("/(rider)/(tabs)/dashboard");
      return;
    }

    router.replace(
      type === "pickup"
        ? `/(rider)/order/pickup/${orderId}`
        : `/(rider)/order/delivered/${orderId}`,
    );
  }, [orderId, type]);

  const fetchTask = useCallback(async () => {
    setLoading(true);
    try {
      if (type === "return_to_plant") {
        if (!user?._id) throw new Error("Rider not found");

        const res = await fetch(`${API_URL}/plant/rider/${user._id}/destination`, {
          method: "GET",
          headers: {
            "Content-Type": "application/json",
            "x-client-type": "mobile",
          },
        });
        const json = await res.json().catch(() => null);

        if (!res.ok) {
          throw new Error(
            json?.error ||
              "Plant location is missing. Please contact admin.",
          );
        }

        const plant = json?.plant;
        const location = getCoordinates(plant);

        if (!location) {
          throw new Error("Plant coordinates are not configured.");
        }

        setTask({
          taskId: `plant_${plant.id}_${new Date().toISOString().slice(0, 10)}`,
          title: plant.name || "Return to Plant",
          address: plant.location || "Plant location",
          destination: location,
        });
        return;
      }

      const url =
        type === "pickup"
          ? `${API_URL}/pickupbyId/${orderId}`
          : `${AUTH_API_URL}/getOrderById/${orderId}`;
      const res = await fetch(url, {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
          "x-client-type": "mobile",
        },
      });
      const json = await res.json().catch(() => null);

      if (!res.ok) {
        throw new Error(json?.message || "Failed to load task");
      }

      const data = type === "pickup" ? json?.data : json;
      const location =
        type === "pickup"
          ? getPickupLocation(data)
          : getCoordinates(data?.orderLocation);

      const taskDetails = {
        title:
          type === "pickup"
            ? data?.Name || "Pickup location"
            : data?.customerName || data?.order_id || "Delivery location",
        address: type === "pickup" ? data?.Address : data?.address,
        destination: location,
      };

      setTask(taskDetails);
      setRawTaskData(data);

      if (!location) {
        Alert.alert(
          "Location not available",
          "This task does not have map coordinates, so navigation cannot be started. Opening task details instead.",
          [{ text: "OK", onPress: openDetails }],
        );
      }
    } catch (err: any) {
      Alert.alert("Error", err?.message || "Failed to load navigation");
      setTask(null);
    } finally {
      setLoading(false);
    }
  }, [openDetails, orderId, type, user?._id]);

  useEffect(() => {
    fetchTask();
  }, [fetchTask]);

  if (loading) return <UniversalLoader fullscreen />;

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <View
        style={[
          styles.header,
          { backgroundColor: theme.card, borderBottomColor: theme.border },
        ]}
      >
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={22} color={theme.text} />
        </TouchableOpacity>
        <View style={styles.headerTextWrap}>
          <Text style={[styles.headerTitle, { color: theme.text }]}>
            {type === "pickup"
              ? "Pickup Navigation"
              : type === "delivery"
                ? "Delivery Navigation"
                : "Return to Plant"}
          </Text>
        </View>
        <View style={styles.backBtn} />
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        {isLowPowerMode && (
          <View
            style={[
              styles.warningBanner,
              {
                backgroundColor: isDark ? "#2D1E0A" : "#FEF3C7",
                borderColor: isDark ? "#78350F" : "#FCD34D",
              },
            ]}
          >
            <Ionicons
              name="warning"
              size={20}
              color={theme.warning}
              style={styles.warningIcon}
            />
            <View style={styles.warningTextContainer}>
              <Text
                style={[
                  styles.warningTitle,
                  { color: isDark ? "#FBBF24" : "#92400E" },
                ]}
              >
                Battery Saver is ON
              </Text>
              <Text
                style={[
                  styles.warningDesc,
                  { color: isDark ? "#FDE68A" : "#B45309" },
                ]}
              >
                This may cause your screen to turn off or pause location tracking in the background. Connect to a charger or turn off Battery Saver for the best navigation experience.
              </Text>
            </View>
          </View>
        )}

        <View
          style={[
            styles.summaryCard,
            { backgroundColor: theme.card, borderColor: theme.border },
          ]}
        >
          <Text style={[styles.taskTitle, { color: theme.text }]}>
            {task?.title || "Task location"}
          </Text>
          <Text style={[styles.address, { color: theme.subText }]}>
            {task?.address || "Address not available"}
          </Text>
        </View>

        <TaskNavigationMap
          taskId={task?.taskId || orderId}
          taskType={type}
          rider={user}
          destination={task?.destination}
          destinationLabel={task?.address}
          onReached={openDetails}
        />

        {type === "pickup" && (
          <View style={styles.actionRow}>
            <TouchableOpacity
              style={[styles.btn, styles.cancelBtn, { borderColor: theme.danger }]}
              onPress={handleCancelPress}
            >
              <Ionicons name="close-circle-outline" size={18} color={theme.danger} />
              <Text style={[styles.btnText, { color: theme.danger }]}>Cancel Pickup</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.btn, styles.rescheduleBtn, { borderColor: theme.primary }]}
              onPress={openReschedulePicker}
            >
              <Ionicons name="calendar-outline" size={18} color={theme.primary} />
              <Text style={[styles.btnText, { color: theme.primary }]}>Reschedule Pickup</Text>
            </TouchableOpacity>
          </View>
        )}

        {type === "delivery" && (
          <View style={styles.actionRow}>
            <TouchableOpacity
              style={[styles.btn, styles.rescheduleBtn, { borderColor: theme.primary }]}
              onPress={() => setRescheduleVisible(true)}
            >
              <Ionicons name="calendar-outline" size={18} color={theme.primary} />
              <Text style={[styles.btnText, { color: theme.primary }]}>Reschedule Delivery</Text>
            </TouchableOpacity>
          </View>
        )}

        <Text style={[styles.note, { color: theme.subText }]}>
          KM is counted only after Start Navigation and stops when you tap
          Reached Location.
        </Text>
      </ScrollView>

      {/* --- Pickup Reschedule DatePicker (iOS) --- */}
      {Platform.OS === "ios" && showDatePicker && (
        <Modal
          visible={showDatePicker}
          transparent
          animationType="fade"
          onRequestClose={() => setShowDatePicker(false)}
        >
          <View style={styles.modalOverlay}>
            <View
              style={[
                styles.dateModal,
                { backgroundColor: theme.card, borderColor: theme.border },
              ]}
            >
              <DateTimePicker
                value={selectedDate}
                mode="date"
                minimumDate={new Date()}
                display="spinner"
                onChange={(_, date) => {
                  if (date) setSelectedDate(date);
                }}
              />
              <View style={styles.modalActions}>
                <TouchableOpacity
                  onPress={() => setShowDatePicker(false)}
                  style={[
                    styles.modalSecondaryBtn,
                    {
                      backgroundColor: theme.background,
                      borderColor: theme.border,
                    },
                  ]}
                >
                  <Text style={[styles.modalSecondaryBtnText, { color: theme.text }]}>
                    Cancel
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={() => reschedulePickup(selectedDate)}
                  disabled={rescheduleSubmitting}
                  style={[
                    styles.modalPrimaryBtn,
                    { backgroundColor: theme.primary },
                  ]}
                >
                  {rescheduleSubmitting ? (
                    <ActivityIndicator size="small" color="#fff" />
                  ) : (
                    <Text style={styles.modalPrimaryBtnText}>Confirm</Text>
                  )}
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>
      )}

      {/* --- Pickup Cancel Modal --- */}
      <Modal
        visible={cancelModalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setCancelModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View
            style={[
              styles.modalCard,
              { backgroundColor: theme.card, width: "90%" },
            ]}
          >
            <Text style={[styles.sectionTitle, { color: theme.text }]}>
              Cancel Pickup
            </Text>

            <TextInput
              style={[
                styles.searchInputWrap,
                {
                  color: theme.text,
                  borderColor: theme.border,
                  backgroundColor: theme.background,
                  height: 80,
                  marginTop: 14,
                  paddingTop: 10,
                  paddingHorizontal: 10,
                  borderRadius: 8,
                  borderWidth: 1,
                  textAlignVertical: "top",
                },
              ]}
              placeholder="Enter reason OR record voice (one required)"
              placeholderTextColor={theme.subText}
              value={cancelNote}
              onChangeText={setCancelNote}
              multiline
              numberOfLines={3}
            />

            <View
              style={[
                styles.voiceRow,
                {
                  borderColor: theme.border,
                  backgroundColor: theme.background,
                },
              ]}
            >
              <TouchableOpacity
                style={[
                  styles.recordBtn,
                  {
                    backgroundColor: cancelIsRecording
                      ? theme.danger || "#EF4444"
                      : theme.primary,
                  },
                ]}
                onPress={
                  cancelIsRecording ? stopCancelRecording : startCancelRecording
                }
                disabled={cancelSubmitting || isRemovingCancelAudio}
              >
                <Ionicons
                  name={cancelIsRecording ? "square" : "mic"}
                  size={18}
                  color="#fff"
                />
              </TouchableOpacity>

              <Text style={[styles.audioTime, { color: theme.text }]}>
                {cancelIsRecording
                  ? "Recording..."
                  : cancelRecordedUri
                    ? "Voice recorded"
                    : "No voice note"}
              </Text>

              {cancelRecordedUri &&
                !cancelIsRecording &&
                !isRemovingCancelAudio && (
                  <View style={{ flexDirection: "row", gap: 8 }}>
                    <TouchableOpacity
                      style={styles.audioIconBtn}
                      onPress={toggleCancelPlayPause}
                    >
                      <Ionicons
                        name={cancelIsPlaying ? "pause" : "play"}
                        size={18}
                        color={theme.primary}
                      />
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={styles.audioIconBtn}
                      onPress={removeCancelRecording}
                    >
                      <Ionicons
                        name="trash-outline"
                        size={18}
                        color={theme.danger || "#EF4444"}
                      />
                    </TouchableOpacity>
                  </View>
                )}
              {isRemovingCancelAudio && (
                <ActivityIndicator size="small" color={theme.primary} />
              )}
            </View>

            {!cancelNote.trim() && !cancelRecordedUri && (
              <Text
                style={{ color: theme.danger || "#EF4444", fontSize: 12, marginBottom: 8 }}
              >
                Add a note or record a voice message to cancel the pickup.
              </Text>
            )}

            <View style={[styles.modalActions, { marginTop: 6 }]}>
              <TouchableOpacity
                onPress={async () => {
                  try {
                    if (cancelRecording)
                      await cancelRecording.stopAndUnloadAsync();
                  } catch { }
                  try {
                    if (cancelSoundRef.current) {
                      await cancelSoundRef.current.unloadAsync();
                      cancelSoundRef.current = null;
                    }
                  } catch { }
                  setCancelRecording(null);
                  setCancelIsRecording(false);
                  setCancelIsPlaying(false);
                  setCancelModalVisible(false);
                  setCancelNote("");
                  setCancelRecordedUri(null);
                }}
                disabled={cancelSubmitting}
                style={[
                  styles.modalSecondaryBtn,
                  {
                    backgroundColor: theme.background,
                    borderColor: theme.border,
                  },
                ]}
              >
                <Text
                  style={[styles.modalSecondaryBtnText, { color: theme.text }]}
                >
                  Close
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={() =>
                  cancelPickup(cancelNote.trim(), cancelRecordedUri)
                }
                disabled={
                  (!cancelNote.trim() && !cancelRecordedUri) ||
                  cancelSubmitting ||
                  isRemovingCancelAudio
                }
                style={[
                  styles.modalPrimaryBtn,
                  {
                    backgroundColor: theme.danger || "#EF4444",
                    opacity:
                      (!cancelNote.trim() && !cancelRecordedUri) ||
                        cancelSubmitting ||
                        isRemovingCancelAudio
                        ? 0.5
                        : 1,
                  },
                ]}
              >
                {cancelSubmitting ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <Text style={styles.modalPrimaryBtnText}>Cancel Pickup</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* --- Delivery Reschedule Modal --- */}
      <RescheduleDeliveryModal
        visible={rescheduleVisible}
        onClose={() => setRescheduleVisible(false)}
        onConfirm={rescheduleDeliveryOrder}
        loading={rescheduling}
        theme={theme}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    alignItems: "center",
    borderBottomWidth: 1,
    flexDirection: "row",
    paddingHorizontal: 16,
    paddingBottom: 14,
    paddingTop: 48,
  },
  backBtn: {
    alignItems: "center",
    height: 40,
    justifyContent: "center",
    width: 40,
  },
  headerTextWrap: {
    alignItems: "center",
    flex: 1,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: "900",
  },
  headerSub: {
    fontSize: 12,
    marginTop: 2,
  },
  content: {
    gap: 16,
    padding: 16,
    paddingBottom: 40,
  },
  summaryCard: {
    borderRadius: 8,
    borderWidth: 1,
    padding: 14,
  },
  taskTitle: {
    fontSize: 16,
    fontWeight: "900",
  },
  address: {
    fontSize: 13,
    lineHeight: 18,
    marginTop: 8,
  },
  note: {
    fontSize: 12,
    lineHeight: 18,
    textAlign: "center",
  },
  warningBanner: {
    borderRadius: 8,
    borderWidth: 1,
    flexDirection: "row",
    padding: 12,
    gap: 10,
    alignItems: "flex-start",
  },
  warningIcon: {
    marginTop: 2,
  },
  warningTextContainer: {
    flex: 1,
  },
  warningTitle: {
    fontSize: 14,
    fontWeight: "bold",
    marginBottom: 4,
  },
  warningDesc: {
    fontSize: 12,
    lineHeight: 16,
  },
  actionRow: {
    flexDirection: "row",
    gap: 12,
    marginTop: 8,
  },
  btn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    borderWidth: 1.5,
    borderRadius: 8,
    paddingVertical: 12,
    minHeight: 48,
  },
  cancelBtn: {
    backgroundColor: "transparent",
  },
  rescheduleBtn: {
    backgroundColor: "transparent",
  },
  btnText: {
    fontSize: 14,
    fontWeight: "800",
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
  },
  modalCard: {
    padding: 20,
    borderRadius: 12,
    gap: 12,
    elevation: 5,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: "800",
    textAlign: "center",
  },
  searchInputWrap: {
    borderWidth: 1,
    padding: 10,
    fontSize: 14,
  },
  voiceRow: {
    flexDirection: "row",
    alignItems: "center",
    padding: 10,
    borderRadius: 8,
    borderWidth: 1,
    gap: 12,
  },
  recordBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: "center",
    alignItems: "center",
  },
  audioTime: {
    flex: 1,
    fontSize: 14,
    fontWeight: "600",
  },
  audioIconBtn: {
    padding: 8,
  },
  modalActions: {
    flexDirection: "row",
    justifyContent: "flex-end",
    gap: 12,
    marginTop: 8,
  },
  modalSecondaryBtn: {
    borderWidth: 1,
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 8,
    justifyContent: "center",
    alignItems: "center",
  },
  modalSecondaryBtnText: {
    fontSize: 14,
    fontWeight: "700",
  },
  modalPrimaryBtn: {
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 8,
    justifyContent: "center",
    alignItems: "center",
    minWidth: 80,
  },
  modalPrimaryBtnText: {
    color: "#fff",
    fontSize: 14,
    fontWeight: "800",
  },
  dateModal: {
    width: "90%",
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    gap: 16,
  },
});

/* ===================== DELIVERY RESCHEDULE MODAL ===================== */

function RescheduleDeliveryModal({
  visible,
  onClose,
  onConfirm,
  loading,
  theme,
}: {
  visible: boolean;
  onClose: () => void;
  onConfirm: (date: Date | null, answered: boolean) => Promise<void>;
  loading?: boolean;
  theme: any;
}) {
  const [step, setStep] = useState<"CHOICE" | "ANSWERED" | "NO_ANSWER">("CHOICE");
  const [date, setDate] = useState<Date>(new Date());
  const [showIOSPicker, setShowIOSPicker] = useState(false);

  useEffect(() => {
    if (visible) {
      setStep("CHOICE");
      setDate(new Date());
      setShowIOSPicker(false);
    }
  }, [visible]);

  const openAndroidPicker = () => {
    DateTimePickerAndroid.open({
      value: date,
      mode: "date",
      minimumDate: new Date(),
      onChange: (_, selectedDate) => {
        if (selectedDate) setDate(selectedDate);
      },
    });
  };

  if (!visible) return null;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <View style={modalStyles.backdrop}>
        <View style={[modalStyles.sheet, { backgroundColor: theme.card }]}>
          <Text style={[modalStyles.title, { color: theme.text }]}>Reschedule Delivery</Text>

          {step === "CHOICE" && (
            <>
              <Text style={[modalStyles.sub, { color: theme.subText }]}>
                Did the customer answer your call?
              </Text>

              <View style={modalStyles.actionsRow}>
                <TouchableOpacity
                  style={[modalStyles.action, { backgroundColor: "#22C55E" }]}
                  onPress={() => setStep("ANSWERED")}
                >
                  <Text style={modalStyles.actionText}>Answered</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[modalStyles.action, { backgroundColor: "#FACC15" }]}
                  onPress={() => setStep("NO_ANSWER")}
                >
                  <Text style={[modalStyles.actionText, { color: "#000" }]}>Not Answered</Text>
                </TouchableOpacity>
              </View>

              <TouchableOpacity
                onPress={onClose}
                style={[modalStyles.cancelBtn, { backgroundColor: theme.background }]}
                activeOpacity={0.8}
              >
                <Text style={[modalStyles.cancelTextDark, { color: theme.text }]}>Cancel</Text>
              </TouchableOpacity>
            </>
          )}

          {step === "ANSWERED" && (
            <>
              <Text style={[modalStyles.sub, { color: theme.subText }]}>
                Select a new delivery date & time
              </Text>

              <TouchableOpacity
                style={[modalStyles.dateBtn, { backgroundColor: theme.background }]}
                onPress={() =>
                  Platform.OS === "android"
                    ? openAndroidPicker()
                    : setShowIOSPicker(true)
                }
              >
                <Text style={[modalStyles.dateText, { color: theme.text }]}>
                  {moment(date).format("dddd, MMM D, YYYY - hh:mm A")}
                </Text>
              </TouchableOpacity>

              {Platform.OS === "ios" && showIOSPicker && (
                <DateTimePicker
                  value={date}
                  mode="datetime"
                  display="inline"
                  minimumDate={new Date()}
                  onChange={(_, d) => d && setDate(d)}
                />
              )}

              <View style={modalStyles.actionsRow}>
                <TouchableOpacity
                  style={[modalStyles.action, { backgroundColor: "#22C55E" }]}
                  disabled={loading}
                  onPress={() => onConfirm(date, true)}
                >
                  {loading ? (
                    <ActivityIndicator size="small" color="#fff" />
                  ) : (
                    <Text style={modalStyles.actionText}>Confirm</Text>
                  )}
                </TouchableOpacity>

                <TouchableOpacity
                  style={[modalStyles.action, { backgroundColor: theme.background }]}
                  onPress={() => setStep("CHOICE")}
                >
                  <Text style={[modalStyles.actionText, { color: theme.text }]}>
                    Back
                  </Text>
                </TouchableOpacity>
              </View>
            </>
          )}

          {step === "NO_ANSWER" && (
            <>
              <Text style={[modalStyles.sub, { color: theme.subText }]}>
                Customer did not answer. Delivery will be rescheduled to:
              </Text>

              <Text style={[modalStyles.dateText, { color: theme.text, textAlign: "center", marginVertical: 12 }]}>
                {moment().add(1, "day").format("dddd, MMM D, YYYY")}
              </Text>

              <View style={modalStyles.actionsRow}>
                <TouchableOpacity
                  style={[modalStyles.action, { backgroundColor: "#F59E0B" }]}
                  disabled={loading}
                  onPress={() =>
                    onConfirm(moment().add(1, "day").toDate(), false)
                  }
                >
                  {loading ? (
                    <ActivityIndicator size="small" color="#fff" />
                  ) : (
                    <Text style={modalStyles.actionText}>Confirm</Text>
                  )}
                </TouchableOpacity>

                <TouchableOpacity
                  style={[modalStyles.action, { backgroundColor: theme.background }]}
                  onPress={() => setStep("CHOICE")}
                >
                  <Text style={[modalStyles.actionText, { color: theme.text }]}>
                    Back
                  </Text>
                </TouchableOpacity>
              </View>
            </>
          )}
        </View>
      </View>
    </Modal>
  );
}

const modalStyles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: "#00000066",
    justifyContent: "flex-end",
  },
  sheet: {
    padding: 16,
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
  },
  title: {
    fontSize: 16,
    fontWeight: "900",
    marginBottom: 6,
  },
  sub: {
    fontSize: 14,
    marginBottom: 12,
  },
  dateBtn: {
    padding: 12,
    borderRadius: 12,
  },
  dateText: {
    fontSize: 14,
    fontWeight: "700",
  },
  actionsRow: {
    flexDirection: "row",
    gap: 12,
    marginTop: 12,
  },
  action: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  actionText: {
    color: "#fff",
    fontWeight: "800",
  },
  cancelBtn: {
    marginTop: 12,
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  cancelTextDark: {
    fontWeight: "900",
    fontSize: 14,
  },
});