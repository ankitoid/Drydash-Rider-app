import UniversalLoader from "@/components/Loader/UniversalLoader";
import { TaskNavigationMap } from "@/components/TaskNavigationMap";
import { useAuth } from "@/context/useAuth";
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { useLowPowerMode } from "expo-battery";
import * as KeepAwake from "expo-keep-awake";
import { useCallback, useEffect, useState } from "react";
import {
  Alert,
  AppState,
  AppStateStatus,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useTheme } from "../../../context/ThemeContext";

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

        <Text style={[styles.note, { color: theme.subText }]}>
          KM is counted only after Start Navigation and stops when you tap
          Reached Location.
        </Text>
      </ScrollView>
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
});
