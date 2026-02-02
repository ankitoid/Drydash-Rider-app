// app/(rider)/(tabs)/dashboard/index.tsx
import { useLocation } from "@/context/LocationContext";
import { useAuth } from "@/context/useAuth";
import { Ionicons } from "@expo/vector-icons";
import { manipulateAsync, SaveFormat } from "expo-image-manipulator";
import * as ImagePicker from "expo-image-picker";
import moment from "moment";
import React, { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Animated,
  Dimensions,
  FlatList,
  Image,
  Modal,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { Skeleton } from "../../../../components/ui/Skeleton";
import { useTheme } from "../../../../context/ThemeContext";
import { useFadeSlide } from "../../../../hooks/useFadeSlide";

const { width, height } = Dimensions.get("window");
const CARD_WIDTH = width - 48;
const H_CARD = Math.min(320, width * 0.85);

const PICKUP_API_BASE = "https://rider-app-testing.onrender.com/api/v1/rider";
const ORDERS_API_BASE = "https://rider-app-testing.onrender.com/api/v1";

type Order = {
  id: string;
  kind: "pickup" | "delivery";
  priority: number;
  time: string;
  status: "Active" | "Pending" | "Delivered";
  name?: string;
  address?: string;
  contact?: string;
  to?: string;
  from?: string;
  lat?: number | null;
  lng?: number | null;
  price?: string;
  distance?: string;
};

export default function Dashboard() {
  const { theme } = useTheme();
  const { user } = useAuth();
  const { isTracking, lastLocation, toggleTracking, error: locationError } = useLocation();

  const [tripId, setTripId] = useState<string | null>(null);
  const [startKm, setStartKm] = useState("");
  const [endKm, setEndKm] = useState("");
  const [startImage, setStartImage] = useState<ImagePicker.ImagePickerAsset | null>(null);
  const [endImage, setEndImage] = useState<ImagePicker.ImagePickerAsset | null>(null);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const [fulfilledCount, setFulfilledCount] = useState<number>(0);
  const [deliveredCount, setDeliveredCount] = useState<number>(0);
  const [dailyKm, setDailyKm] = useState<number>(0);
  const [totalKm, setTotalKm] = useState<number>(0);

  // Modal states
  const [showTripModal, setShowTripModal] = useState(false);
  const [isStartingTrip, setIsStartingTrip] = useState(false);
  const [isEndingTrip, setIsEndingTrip] = useState(false);
  const [isCompressing, setIsCompressing] = useState(false);

  const restoreOpenTrip = async () => {
    try {
      if (!user?._id) return;

      const res = await fetch(
        `${ORDERS_API_BASE}/trips/active/${user._id}`
      );
      if (!res.ok) {
        console.warn("restoreOpenTrip: failed", res.status);
        return;
      }
      const json = await res.json();
      if (json.hasActiveTrip && json.trip) {
        setTripId(json.trip._id);
        setStartKm(String(json.trip.startKm));

        if (json.trip.startImage) {
          setStartImage({
            uri: json.trip.startImage,
            fileSize: 0,
            width: 0,
            height: 0,
          } as any);
        }
      } else {
        setTripId(null);
        setStartKm("");
        setStartImage(null);
      }
    } catch (err) {
      console.warn("Error restoring open trip:", err);
    }
  };

  const fetchKilometersData = useCallback(async () => {
    try {
      if (!user?._id) return;

      const today = getLocalYYYYMMDD();
      const dailyRes = await fetch(
        `${ORDERS_API_BASE}/trips/daily/${user._id}?date=${today}`
      );

      if (dailyRes.ok) {
        const dailyJson = await dailyRes.json();
        setDailyKm(dailyJson.totalDailyDistance || 0);
      }

      const totalRes = await fetch(
        `${ORDERS_API_BASE}/trips/custom-summary/${user._id}`
      );

      if (totalRes.ok) {
        const totalJson = await totalRes.json();
        setTotalKm(totalJson.userTotalKm || 0);
      }
    } catch (err) {
      console.warn("Error fetching kilometers data:", err);
    }
  }, [user?._id]);

  const getLocalYYYYMMDD = () => {
    return moment().format("YYYY-MM-DD");
  };

  const fetchRiderTasks = useCallback(async (date?: string) => {
    try {
      if (!user?._id) return;
      const d = date || getLocalYYYYMMDD();
      const url = `${PICKUP_API_BASE}/rider-tasks/${user._id}?date=${encodeURIComponent(d)}`;
      const res = await fetch(url);
      if (!res.ok) {
        console.warn("fetchRiderTasks failed:", res.status);
        return;
      }
      const json = await res.json();
      const summary = json.summary || {};

      setFulfilledCount(Number(summary.totalCompletedPickups ?? 0));
      setDeliveredCount(Number(summary.totalCompletedDeliveries ?? 0));
    } catch (err) {
      console.warn("Error fetching rider tasks:", err);
    }
  }, [user?._id]);

  const kpi = useFadeSlide(0, 20);

  const compressImage = async (image: ImagePicker.ImagePickerAsset) => {
    try {
      setIsCompressing(true);

      const originalSize = image.fileSize || 0;

      // Compress image with expo-image-manipulator
      const manipResult = await manipulateAsync(
        image.uri,
        [
          { resize: { width: 900 } }
        ],
        {
          compress: 0.5,
          format: SaveFormat.JPEG // Convert to JPEG
        }
      );

      const compressedSize = (manipResult.width) * (manipResult.height || 600) * 0.5;
      const savedPercentage = originalSize
        ? Math.round(((originalSize - compressedSize) / originalSize) * 100)
        : 0;

      console.log(`Image compressed: ${savedPercentage}% size reduction`);

      return {
        uri: manipResult.uri,
        width: manipResult.width,
        height: manipResult.height,
        fileSize: compressedSize,
      };
    } catch (error) {
      console.error("Image compression error:", error);
      // Return original if compression fails
      return image;
    } finally {
      setIsCompressing(false);
    }
  };

  const clickPhoto = async (setter: any) => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();

    if (status !== "granted") {
      Alert.alert(
        "Permission Required",
        "Camera access is required to capture odometer photos"
      );
      return;
    }

    const res = await ImagePicker.launchCameraAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.4,
      cameraType: ImagePicker.CameraType.back,
      allowsEditing: false,
    });

    if (!res.canceled && res.assets?.length) {
      const original = res.assets[0];

      setter(original);

      compressImage(original).then((compressed) => {
        setter(compressed);
      });
    }
  };

  const handleStartTrip = async () => {
    if (!startKm || !startImage || !user?._id) {
      Alert.alert("Missing Information", "Please enter start KM and capture odometer photo");
      return;
    }

    setIsStartingTrip(true);

    const form = new FormData();
    form.append("riderId", user._id);
    form.append("startKm", startKm);
    form.append("image", {
      uri: startImage.uri,
      name: "start.jpg",
      type: "image/jpeg",
    } as any);

    try {
      const res = await fetch(`${ORDERS_API_BASE}/trips/start`, {
        method: "POST",
        body: form,
      });

      const json = await res.json();

      if (res.ok) {
        setTripId(json.trip._id);
        setShowTripModal(false);
        Alert.alert("Trip Started", "Your trip has been started successfully!");
        fetchKilometersData();
      } else {
        Alert.alert("Error", json.message || "Failed to start trip");
      }
    } catch (error) {
      Alert.alert("Error", "Network error. Please try again.");
    } finally {
      setIsStartingTrip(false);
    }
  };

  const handleEndTrip = async () => {
    if (!endKm || !endImage || !tripId) {
      Alert.alert("Missing Information", "Please enter end KM and capture odometer photo");
      return;
    }

    setIsEndingTrip(true);

    const form = new FormData();
    form.append("endKm", endKm);
    form.append("image", {
      uri: endImage.uri,
      name: "end.jpg",
      type: "image/jpeg",
    } as any);

    try {
      const res = await fetch(
        `${ORDERS_API_BASE}/trips/${tripId}/end`,
        {
          method: "PUT",
          body: form,
        }
      );

      const json = await res.json();

      if (res.ok) {
        Alert.alert(
          "Trip Completed",
          `Distance covered: ${json.trip.distance} km\n\nGreat work!`
        );
        setTripId(null);
        setStartKm("");
        setEndKm("");
        setStartImage(null);
        setEndImage(null);
        setShowTripModal(false);
        fetchKilometersData();
      } else {
        Alert.alert("Error", json.message || "Failed to end trip");
      }
    } catch (error) {
      Alert.alert("Error", "Network error. Please try again.");
    } finally {
      setIsEndingTrip(false);
    }
  };

  const confirmToggle = () => {
    if (isTracking) {
      Alert.alert(
        "Stop Live Tracking?",
        "Your real-time location will no longer be shared with admin.",
        [
          { text: "Cancel", style: "cancel" },
          {
            text: "Stop",
            style: "destructive",
            onPress: () => {
              try {
                toggleTracking();
              } catch (e) {
                console.warn("Error stopping tracking", e);
              }
            },
          },
        ]
      );
    } else {
      Alert.alert(
        "Start Live Tracking?",
        "Enable live tracking to share your real-time location with admin.",
        [
          { text: "Cancel", style: "cancel" },
          {
            text: "Start",
            onPress: () => {
              try {
                toggleTracking();
              } catch (e) {
                console.warn("Error starting tracking", e);
              }
            },
          },
        ]
      );
    }
  };

  const renderLocationStatus = () => (
    <View style={styles.locationStatusContainer}>
      <TouchableOpacity
        style={[
          styles.locationStatusBadge,
          {
            backgroundColor: isTracking ? '#10b981' : '#ef4444',
            borderColor: theme.border,
          }
        ]}
        onPress={confirmToggle}
        activeOpacity={0.8}
      >
        <View style={styles.statusIndicator}>
          <View style={[
            styles.statusDot,
            { backgroundColor: isTracking ? '#10b981' : '#ef4444' }
          ]} />
        </View>
        <Text style={styles.statusText}>
          {isTracking ? 'LIVE TRACKING' : 'OFFLINE'}
        </Text>
      </TouchableOpacity>

      {lastLocation && (
        <Text style={[styles.lastUpdateText, { color: theme.subText }]}>
          Last update: {new Date(lastLocation.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
        </Text>
      )}

      {locationError && (
        <Text style={styles.errorText}>⚠️ {locationError}</Text>
      )}
    </View>
  );

  const renderTripModal = () => (
    <Modal
      visible={showTripModal}
      animationType="slide"
      transparent={true}
      onRequestClose={() => setShowTripModal(false)}
    >
      <View style={styles.modalOverlay}>
        <View style={[styles.modalContent, { backgroundColor: theme.background }]}>
          {/* Header */}
          <View style={styles.modalHeader}>
            <View>
              <Text style={[styles.modalTitle, { color: theme.text }]}>
                {tripId ? "End Trip" : "Start Trip"}
              </Text>
              <Text style={[styles.modalSubtitle, { color: theme.subText }]}>
                {tripId ? "Record your final odometer reading" : "Record your starting odometer reading"}
              </Text>
            </View>
            <TouchableOpacity
              onPress={() => setShowTripModal(false)}
              style={styles.closeButton}
            >
              <Ionicons name="close" size={24} color={theme.text} />
            </TouchableOpacity>
          </View>

          <ScrollView showsVerticalScrollIndicator={false}>
            {/* Odometer Input */}
            <View style={styles.inputSection}>
              <Text style={[styles.inputLabel, { color: theme.text }]}>
                Odometer Reading (KM)
              </Text>
              <View style={[styles.inputWrapper, { borderColor: theme.border, backgroundColor: theme.card }]}>
                <Ionicons name="speedometer-outline" size={20} color={theme.primary} style={styles.inputIcon} />
                <TextInput
                  placeholder={tripId ? "Enter ending KM" : "Enter starting KM"}
                  placeholderTextColor={theme.subText}
                  keyboardType="numeric"
                  value={tripId ? endKm : startKm}
                  onChangeText={tripId ? setEndKm : setStartKm}
                  style={[styles.textInput, { color: theme.text }]}
                />
              </View>
            </View>

            {/* Photo Section */}
            <View style={styles.photoSection}>
              <View style={styles.photoLabelRow}>
                <Text style={[styles.inputLabel, { color: theme.text }]}>
                  Odometer Photo
                </Text>
                {isCompressing && (
                  <View style={styles.compressingBadge}>
                    <ActivityIndicator size="small" color={theme.primary} />
                    <Text style={[styles.compressingText, { color: theme.primary }]}>
                      Compressing...
                    </Text>
                  </View>
                )}
              </View>

              {(tripId ? endImage : startImage) ? (
                <View style={styles.imagePreviewContainer}>
                  <Image
                    source={{ uri: (tripId ? endImage : startImage)?.uri }}
                    style={styles.imagePreview}
                  />
                  <View style={styles.imageInfoOverlay}>
                    <View style={styles.compressionBadge}>
                      <Ionicons name="checkmark-circle" size={14} color="#10b981" />
                      <Text style={styles.compressionText}>Compressed</Text>
                    </View>
                  </View>
                  <TouchableOpacity
                    style={styles.retakeButton}
                    onPress={() => clickPhoto(tripId ? setEndImage : setStartImage)}
                  >
                    <Ionicons name="camera" size={16} color="#fff" />
                    <Text style={styles.retakeText}>Retake Photo</Text>
                  </TouchableOpacity>
                </View>
              ) : (
                <TouchableOpacity
                  style={[styles.photoButton, { borderColor: theme.border, backgroundColor: theme.card }]}
                  onPress={() => clickPhoto(tripId ? setEndImage : setStartImage)}
                  disabled={isCompressing}
                >
                  <View style={[styles.cameraIconWrapper, { backgroundColor: theme.primary + '20' }]}>
                    <Ionicons name="camera" size={32} color={theme.primary} />
                  </View>
                  <Text style={[styles.photoButtonText, { color: theme.text }]}>
                    Capture Odometer
                  </Text>
                  <Text style={[styles.photoButtonSubtext, { color: theme.subText }]}>
                    Take a clear photo of your odometer reading
                  </Text>
                </TouchableOpacity>
              )}
            </View>

            {/* Action Buttons */}
            <View style={styles.actionButtons}>
              <TouchableOpacity
                style={[styles.cancelButton, { borderColor: theme.border }]}
                onPress={() => setShowTripModal(false)}
              >
                <Text style={[styles.cancelButtonText, { color: theme.text }]}>
                  Cancel
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.submitButton,
                  { backgroundColor: tripId ? '#ef4444' : theme.primary }
                ]}
                onPress={tripId ? handleEndTrip : handleStartTrip}
                disabled={isStartingTrip || isEndingTrip || isCompressing}
              >
                {(isStartingTrip || isEndingTrip) ? (
                  <>
                    <ActivityIndicator size="small" color="#fff" />
                    <Text style={styles.submitButtonText}>Processing...</Text>
                  </>
                ) : (
                  <>
                    <Ionicons
                      name={tripId ? "stop-circle" : "play-circle"}
                      size={20}
                      color="#fff"
                    />
                    <Text style={styles.submitButtonText}>
                      {tripId ? "End Trip" : "Start Trip"}
                    </Text>
                  </>
                )}
              </TouchableOpacity>
            </View>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );

  useEffect(() => {
    if (!user?.email) return;

    const fetchData = async () => {
      await Promise.all([
        restoreOpenTrip(),
        fetchRiderTasks(),
        fetchKilometersData()
      ]);
    };

    fetchData();
  }, [user?.email, fetchRiderTasks]);

  const onRefresh = async () => {
    setRefreshing(true);
    await Promise.all([
      restoreOpenTrip(),
      fetchRiderTasks(),
      fetchKilometersData()
    ]);
    setRefreshing(false);
  };

  useEffect(() => {
    return () => { };
  }, []);

  if (loading) {
    return (
      <ScrollView
        style={[styles.container, { backgroundColor: theme.background }]}
        contentContainerStyle={{ paddingTop: 18, paddingBottom: 120 }}
      >
        <View style={styles.topRow}>
          <Skeleton height={64} radius={12} style={{ width: CARD_WIDTH * 0.62 }} />
          <Skeleton height={40} radius={12} style={{ width: 80 }} />
        </View>
        <View style={{ paddingHorizontal: 16 }}>
          <Skeleton height={H_CARD} radius={14} style={{ marginTop: 12 }} />
        </View>
      </ScrollView>
    );
  }

  return (
    <>
      <FlatList
        style={{ flex: 1, backgroundColor: theme.background }}
        data={[]}
        keyExtractor={() => "dashboard-header"}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingTop: 8, paddingBottom: 24 }}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={theme.primary}
          />
        }
        ListHeaderComponent={
          <>
            {/* Location Status */}
            {renderLocationStatus()}

            {/* KPI Cards */}
            <Animated.View
              style={[
                styles.kpiContainer,
                {
                  opacity: kpi.opacity,
                  transform: [{ translateY: kpi.translateY }],
                },
              ]}
            >
              <KpiCard title="FULFILLED" value={String(fulfilledCount)} theme={theme} />
              <KpiCard title="DELIVERED" value={String(deliveredCount)} theme={theme} />
            </Animated.View>

            <Animated.View
              style={[
                styles.kpiContainer,
                {
                  opacity: kpi.opacity,
                  transform: [{ translateY: kpi.translateY }],
                },
              ]}
            >
              <KpiCard title="KM TODAY" value={`${dailyKm} km`} theme={theme} />
              <KpiCard title="TOTAL KM" value={`${totalKm} km`} theme={theme} />
            </Animated.View>

            {/* Trip Tracker Card */}
            <View style={styles.tripTrackerContainer}>
              <View
                style={[
                  styles.tripTrackerCard,
                  { backgroundColor: theme.card, borderColor: theme.border }
                ]}
              >
                <View style={styles.tripTrackerHeader}>
                  <View style={[styles.tripIconWrapper, { backgroundColor: theme.primary + '15' }]}>
                    <Ionicons name="speedometer" size={24} color={theme.primary} />
                  </View>
                  <View style={{ flex: 1, marginLeft: 12 }}>
                    <Text style={[styles.tripTrackerTitle, { color: theme.text }]}>
                      Daily Trip Tracker
                    </Text>
                    <Text style={[styles.tripTrackerSubtitle, { color: theme.subText }]}>
                      {tripId ? "Trip in progress" : "Ready to start tracking"}
                    </Text>
                  </View>
                  {tripId && (
                    <View style={styles.activeBadge}>
                      <View style={styles.pulseCircle} />
                      <Text style={styles.activeText}>ACTIVE</Text>
                    </View>
                  )}
                </View>

                {tripId && (
                  <View style={[styles.tripInfoBox, { backgroundColor: theme.background }]}>
                    <View style={styles.tripInfoItem}>
                      <Ionicons name="play-circle" size={16} color={theme.primary} />
                      <Text style={[styles.tripInfoLabel, { color: theme.subText }]}>
                        Started at
                      </Text>
                      <Text style={[styles.tripInfoValue, { color: theme.text }]}>
                        {startKm} km
                      </Text>
                    </View>
                  </View>
                )}

                <TouchableOpacity
                  style={[
                    styles.tripActionButton,
                    {
                      backgroundColor: tripId ? '#ef4444' : theme.primary,
                      borderColor: tripId ? '#dc2626' : theme.primary
                    }
                  ]}
                  onPress={() => setShowTripModal(true)}
                  activeOpacity={0.8}
                >
                  <Ionicons
                    name={tripId ? "stop-circle" : "play-circle"}
                    size={20}
                    color="#fff"
                  />
                  <Text style={styles.tripActionButtonText}>
                    {tripId ? "End Trip" : "Start New Trip"}
                  </Text>
                  <Ionicons name="arrow-forward" size={18} color="#fff" />
                </TouchableOpacity>
              </View>
            </View>
          </>
        }
        renderItem={null}
      />

      {/* Trip Modal */}
      {renderTripModal()}
    </>
  );
}

function KpiCard({ title, value, theme }: { title: string; value: string; theme: any }) {
  return (
    <View
      style={[
        styles.kpiCard,
        { backgroundColor: theme.card, borderColor: theme.border },
      ]}
    >
      <Text style={[styles.kpiTitle, { color: theme.subText }]}>{title}</Text>
      <Text style={[styles.kpiValue, { color: theme.text }]}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },

  // Location Status
  locationStatusContainer: {
    paddingHorizontal: 16,
    marginTop: 8,
    marginBottom: 8,
    alignItems: 'center',
  },
  locationStatusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
    borderWidth: 1,
    minWidth: 150,
    justifyContent: 'center',
    marginBottom: 6,
  },
  statusIndicator: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 8,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  statusText: {
    color: 'white',
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  lastUpdateText: {
    fontSize: 11,
    fontWeight: '600',
    marginTop: 2,
  },
  errorText: {
    fontSize: 11,
    color: '#ef4444',
    fontWeight: '600',
    marginTop: 2,
  },

  // KPI Cards
  topRow: {
    marginTop: 20,
    paddingHorizontal: 16,
    marginBottom: 10,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  kpiContainer: {
    paddingHorizontal: 16,
    marginTop: 6,
    flexDirection: "row",
    justifyContent: "space-between",
  },
  kpiCard: {
    width: "48%",
    padding: 14,
    borderRadius: 14,
    borderWidth: 1,
  },
  kpiTitle: {
    fontSize: 11,
    fontWeight: "700",
    marginBottom: 6,
    letterSpacing: 0.5
  },
  kpiValue: {
    fontSize: 20,
    fontWeight: "900"
  },

  // Trip Tracker
  tripTrackerContainer: {
    paddingHorizontal: 16,
    marginTop: 16,
  },
  tripTrackerCard: {
    borderRadius: 16,
    padding: 18,
    borderWidth: 1,
    shadowColor: "#000",
    shadowOpacity: 0.08,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 4,
  },
  tripTrackerHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  tripIconWrapper: {
    width: 48,
    height: 48,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tripTrackerTitle: {
    fontSize: 16,
    fontWeight: '800',
  },
  tripTrackerSubtitle: {
    fontSize: 13,
    marginTop: 2,
  },
  activeBadge: {
    backgroundColor: '#10b981',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
  },
  pulseCircle: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#fff',
    marginRight: 6,
  },
  activeText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  tripInfoBox: {
    borderRadius: 12,
    padding: 12,
    marginBottom: 16,
  },
  tripInfoItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  tripInfoLabel: {
    fontSize: 13,
  },
  tripInfoValue: {
    fontSize: 14,
    fontWeight: '700',
  },
  tripActionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    borderRadius: 12,
    borderWidth: 1,
    gap: 8,
  },
  tripActionButtonText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '800',
    letterSpacing: 0.3,
  },

  // Modal Styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingTop: 8,
    paddingBottom: 32,
    maxHeight: height * 0.85,
    shadowColor: "#000",
    shadowOpacity: 0.25,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: -4 },
    elevation: 10,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0, 0, 0, 0.05)',
  },
  modalTitle: {
    fontSize: 22,
    fontWeight: '800',
  },
  modalSubtitle: {
    fontSize: 14,
    marginTop: 4,
  },
  closeButton: {
    padding: 4,
  },

  // Input Section
  inputSection: {
    paddingHorizontal: 20,
    paddingTop: 24,
  },
  inputLabel: {
    fontSize: 14,
    fontWeight: '700',
    marginBottom: 10,
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 2,
    borderRadius: 12,
    paddingHorizontal: 14,
    height: 56,
  },
  inputIcon: {
    marginRight: 10,
  },
  textInput: {
    flex: 1,
    fontSize: 16,
    fontWeight: '600',
  },

  // Photo Section
  photoSection: {
    paddingHorizontal: 20,
    paddingTop: 24,
  },
  photoLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  compressingBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    backgroundColor: 'rgba(59, 130, 246, 0.1)',
  },
  compressingText: {
    fontSize: 11,
    fontWeight: '700',
  },
  photoButton: {
    borderWidth: 2,
    borderStyle: 'dashed',
    borderRadius: 16,
    padding: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cameraIconWrapper: {
    width: 72,
    height: 72,
    borderRadius: 36,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  photoButtonText: {
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 6,
  },
  photoButtonSubtext: {
    fontSize: 13,
    textAlign: 'center',
    marginBottom: 8,
  },
  compressionNote: {
    fontSize: 12,
    fontWeight: '600',
    marginTop: 4,
  },
  imagePreviewContainer: {
    position: 'relative',
  },
  imagePreview: {
    width: '100%',
    height: 220,
    borderRadius: 16,
    resizeMode: 'cover',
  },
  imageInfoOverlay: {
    position: 'absolute',
    top: 12,
    left: 12,
  },
  compressionBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(16, 185, 129, 0.9)',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 12,
    gap: 4,
  },
  compressionText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '700',
  },
  retakeButton: {
    position: 'absolute',
    bottom: 12,
    right: 12,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    gap: 6,
  },
  retakeText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '700',
  },

  // Action Buttons
  actionButtons: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    paddingTop: 28,
    gap: 12,
  },
  cancelButton: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelButtonText: {
    fontSize: 15,
    fontWeight: '700',
  },
  submitButton: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 8,
  },
  submitButtonText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '800',
    letterSpacing: 0.3,
  },
});