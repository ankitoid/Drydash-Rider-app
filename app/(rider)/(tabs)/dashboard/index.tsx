// app/(rider)/(tabs)/dashboard/index.tsx
import { useLocation } from "@/context/LocationContext";
import { useAuth } from "@/context/useAuth";
import { useRiderData } from "@/context/RiderDataContext";
import { VRPStop } from "@/services/api/vrpTripService";
import { openMapsNavigation } from "@/utils/navigationHelper";
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import moment from "moment";
import React, { useCallback, useEffect, useState } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import {
  Alert,
  Dimensions,
  Modal,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useTheme } from "../../../../context/ThemeContext";

const { width } = Dimensions.get("window");

export default function Dashboard() {
  const { theme, isDark } = useTheme();
  const { user } = useAuth();
  const { activeTrip, refreshActiveTrip } = useRiderData();

  const [isOnline, setIsOnline] = useState<boolean>(true);
  const [refreshing, setRefreshing] = useState<boolean>(false);
  const [confirmModalVisible, setConfirmModalVisible] = useState<boolean>(false);
  const [currentTime, setCurrentTime] = useState<Date>(new Date());

  // Realtime clock interval
  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const fetchTripData = useCallback(async () => {
    if (user?._id) {
      await refreshActiveTrip(user._id, user.email);
    }
  }, [user?._id, user?.email, refreshActiveTrip]);

  useEffect(() => {
    fetchTripData();
  }, [fetchTripData]);

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchTripData();
    setRefreshing(false);
  };

  const handleStartWorkflow = (stop: VRPStop) => {
    if (stop.type === "depot") return;
    const targetId = stop.id || (stop as any)._id || "";
    if (stop.type === "pickup") {
      router.push({
        pathname: "/(rider)/order/pickup/[orderId]",
        params: { orderId: targetId },
      });
    } else {
      router.push({
        pathname: "/(rider)/order/delivered/[orderId]",
        params: { orderId: targetId },
      });
    }
  };

  const getTimeIndicator = (date: Date) => {
    const hour = date.getHours();
    if (hour >= 5 && hour < 12) {
      return { label: "Morning", icon: "sunny-outline", color: "#F59E0B" };
    } else if (hour >= 12 && hour < 17) {
      return { label: "Afternoon", icon: "sunny", color: "#F97316" };
    } else if (hour >= 17 && hour < 20) {
      return { label: "Evening", icon: "partly-sunny-outline", color: "#E11D48" };
    } else {
      return { label: "Night", icon: "moon-outline", color: "#6366F1" };
    }
  };

  const timeInfo = getTimeIndicator(currentTime);

  const isStopCompleted = (s: VRPStop) => s.status === "completed" || s.completed === true;
  const nonDepotStops = activeTrip?.stops?.filter((s) => s.type !== "depot") || [];
  const currentTask = nonDepotStops.find((s) => !isStopCompleted(s)) || nonDepotStops[0];
  const taskIsDone = currentTask ? isStopCompleted(currentTask) : false;

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: theme.background }]}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={onRefresh}
          tintColor={theme.primary}
        />
      }
    >
      {/* GREETING & REALTIME TIME CARD FROM FIGMA */}
      <View
        style={[
          styles.greetingCard,
          {
            backgroundColor: theme.card,
            borderColor: theme.border,
          },
        ]}
      >
        <View style={styles.greetingHeader}>
          <View style={{ flex: 1 }}>
            <Text style={[styles.greetingTitle, { color: theme.text }]}>
              Hello, {user?.name || "Rider"}
            </Text>
            
            {/* REALTIME CLOCK & SUN/MOON INDICATOR */}
            <View style={styles.clockRow}>
              <Ionicons name={timeInfo.icon as any} size={16} color={timeInfo.color} />
              <Text style={[styles.clockText, { color: theme.text }]}>
                {moment(currentTime).format("hh:mm:ss A")}
              </Text>
              <View style={[styles.timeTag, { backgroundColor: `${timeInfo.color}15` }]}>
                <Text style={[styles.timeTagText, { color: timeInfo.color }]}>
                  {timeInfo.label}
                </Text>
              </View>
            </View>

            <Text style={[styles.greetingSubtitle, { color: theme.subText }]}>
              {isOnline ? "You're online and ready to receive tasks" : "You are currently offline"}
            </Text>
          </View>

          {/* ONLINE TOGGLE SWITCH */}
          <View style={styles.toggleContainer}>
            <Text style={[styles.toggleText, { color: isOnline ? theme.primary : theme.subText }]}>
              {isOnline ? "Online" : "OffLine"}
            </Text>
            <Switch
              value={isOnline}
              onValueChange={() => setConfirmModalVisible(true)}
              trackColor={{ false: "#CBD5E1", true: theme.primary }}
              thumbColor="#FFFFFF"
            />
          </View>
        </View>

        {isOnline && (
          <View style={[styles.statusBanner, { backgroundColor: theme.primarySoft }]}>
            <Ionicons name="location-sharp" size={16} color={theme.primary} />
            <Text style={[styles.statusBannerText, { color: theme.primary }]}>
              Live location tracking active
            </Text>
          </View>
        )}
      </View>

      {/* ROUTE SUMMARY STATS CARD */}
      {activeTrip ? (
        <View
          style={[
            styles.statsCard,
            {
              backgroundColor: theme.card,
              borderColor: theme.border,
            },
          ]}
        >
          <View style={styles.statsHeader}>
            <Text style={[styles.statsTitle, { color: theme.text }]}>
              Assigned Route #{activeTrip.routeIndex || 1}
            </Text>
            <View style={[styles.statusBadge, { backgroundColor: theme.primarySoft }]}>
              <Text style={[styles.statusBadgeText, { color: theme.primary }]}>
                {activeTrip.status.toUpperCase()}
              </Text>
            </View>
          </View>

          <View style={styles.statsGrid}>
            <View style={styles.statItem}>
              <Text style={[styles.statValue, { color: theme.text }]}>
                {activeTrip.distanceKm} km
              </Text>
              <Text style={[styles.statLabel, { color: theme.subText }]}>Total Distance</Text>
            </View>

            <View style={styles.statDivider} />

            <View style={styles.statItem}>
              <Text style={[styles.statValue, { color: theme.text }]}>
                {activeTrip.durationHours} hrs
              </Text>
              <Text style={[styles.statLabel, { color: theme.subText }]}>Est. Duration</Text>
            </View>

            <View style={styles.statDivider} />

            <View style={styles.statItem}>
              <Text style={[styles.statValue, { color: theme.text }]}>
                {activeTrip.stopCount}
              </Text>
              <Text style={[styles.statLabel, { color: theme.subText }]}>Total Stops</Text>
            </View>
          </View>
        </View>
      ) : (
        <View style={[styles.emptyCard, { backgroundColor: theme.card, borderColor: theme.border }]}>
          <Ionicons name="bicycle-outline" size={40} color={theme.muted} />
          <Text style={[styles.emptyTitle, { color: theme.text }]}>No Active Trip Assigned</Text>
          <Text style={[styles.emptySubtitle, { color: theme.subText }]}>
            Pull down to refresh or wait for dispatcher assignment.
          </Text>
        </View>
      )}

      {/* CURRENT ACTIVE TASK CARD WITH ADDRESS */}
      {currentTask && (
        <View style={styles.sectionContainer}>
          <Text style={[styles.sectionTitle, { color: theme.text }]}>Current Active Task</Text>

          <View
            style={[
              styles.taskCard,
              {
                backgroundColor: taskIsDone ? (isDark ? "#1E293B" : "#F1F5F9") : theme.card,
                borderColor: taskIsDone ? "#CBD5E1" : theme.border,
                opacity: taskIsDone ? 0.65 : 1,
              },
            ]}
          >
            <View style={styles.taskCardHeader}>
              <View style={styles.badgeRow}>
                <View
                  style={[
                    styles.sequenceBadge,
                    { backgroundColor: taskIsDone ? "#64748B" : theme.primary },
                  ]}
                >
                  <Text style={styles.sequenceText}>#{currentTask.index || 1}</Text>
                </View>
                <View
                  style={[
                    styles.typeBadge,
                    { backgroundColor: taskIsDone ? "#E2E8F0" : theme.primarySoft },
                  ]}
                >
                  <Text
                    style={[
                      styles.typeBadgeText,
                      { color: taskIsDone ? "#64748B" : theme.primary },
                    ]}
                  >
                    {currentTask.type.toUpperCase()}
                  </Text>
                </View>
              </View>

              {taskIsDone ? (
                <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
                  <Ionicons name="checkmark-circle" size={18} color={theme.success} />
                  <Text style={{ fontSize: 12, fontWeight: "800", color: theme.success }}>
                    COMPLETED
                  </Text>
                </View>
              ) : currentTask.price > 0 ? (
                <Text style={[styles.taskPrice, { color: theme.primary }]}>
                  {currentTask.type === "pickup" ? "Estimated :" : "Collect :"} ₹{currentTask.price.toLocaleString("en-IN")}
                </Text>
              ) : null}
            </View>

            <Text style={[styles.taskName, { color: taskIsDone ? theme.subText : theme.text }]}>
              {currentTask.name}
            </Text>

            {/* ENHANCED ADDRESS DISPLAY */}
            <View style={[styles.addressBox, { backgroundColor: theme.background, borderColor: theme.border }]}>
              <Ionicons
                name="location"
                size={16}
                color={taskIsDone ? "#94A3B8" : theme.primary}
                style={{ marginTop: 2 }}
              />
              <Text
                style={[
                  styles.addressText,
                  { color: taskIsDone ? theme.subText : theme.text },
                ]}
                numberOfLines={2}
              >
                {currentTask.address || `Stop #${currentTask.index} Location Address`}
              </Text>
            </View>

            <View style={{ flexDirection: "row", gap: 10, marginTop: 12 }}>
              <TouchableOpacity
                style={[
                  styles.workflowBtn,
                  { flex: 1, backgroundColor: theme.primarySoft, borderWidth: 1, borderColor: theme.border },
                ]}
                onPress={() => openMapsNavigation(currentTask.lat, currentTask.lng, currentTask.address, currentTask.name)}
                activeOpacity={0.8}
              >
                <Ionicons name="navigate-circle" size={18} color={theme.primary} />
                <Text style={[styles.workflowBtnText, { color: theme.primary }]}>Navigate</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.workflowBtn,
                  { flex: 1.5, backgroundColor: taskIsDone ? "#64748B" : theme.primary },
                ]}
                onPress={() => handleStartWorkflow(currentTask)}
                activeOpacity={0.8}
              >
                <Ionicons
                  name={taskIsDone ? "eye-outline" : "arrow-forward"}
                  size={16}
                  color="#FFFFFF"
                />
                <Text style={styles.workflowBtnText}>
                  {taskIsDone ? "View Details" : "Start Workflow"}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      )}

      {/* LOCATION TOGGLE CONFIRMATION MODAL */}
      <Modal
        visible={confirmModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setConfirmModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalBox, { backgroundColor: theme.card, borderColor: theme.border }]}>
            <View style={[styles.modalIconBg, { backgroundColor: theme.primarySoft }]}>
              <Ionicons name="location-outline" size={28} color={theme.primary} />
            </View>
            <Text style={[styles.modalTitle, { color: theme.text }]}>
              {isOnline ? "Disable Location Tracking?" : "Enable Location Tracking?"}
            </Text>
            <Text style={[styles.modalSubtitle, { color: theme.subText }]}>
              {isOnline
                ? "Are you sure you want to go Offline? You will stop receiving new trip assignments."
                : "Are you sure you want to go Online? Your live GPS location will be tracked for active dispatch."}
            </Text>

            <View style={styles.modalBtnRow}>
              <TouchableOpacity
                style={[styles.modalCancelBtn, { borderColor: theme.border }]}
                onPress={() => setConfirmModalVisible(false)}
              >
                <Text style={[styles.modalCancelText, { color: theme.text }]}>Cancel</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.modalConfirmBtn, { backgroundColor: theme.primary }]}
                onPress={() => {
                  setIsOnline(!isOnline);
                  setConfirmModalVisible(false);
                }}
              >
                <Text style={styles.modalConfirmText}>Confirm</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingHorizontal: 16,
    paddingTop: 16,
  },

  greetingCard: {
    padding: 20,
    borderRadius: 20,
    borderWidth: 1,
    marginBottom: 16,
  },
  guideOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.55)",
    justifyContent: "center",
    padding: 16,
  },
  guideCard: {
    borderRadius: 18,
    padding: 18,
  },
  guideHeader: {
    flexDirection: "row",
    gap: 12,
    alignItems: "flex-start",
    marginBottom: 14,
  },
  guideIcon: {
    width: 44,
    height: 44,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  guideTitle: {
    fontSize: 18,
    fontWeight: "900",
    marginBottom: 4,
  },
  guideSub: {
    fontSize: 13,
    lineHeight: 18,
  },
  guideStepRow: {
    flexDirection: "row",
    gap: 10,
    alignItems: "flex-start",
    marginBottom: 10,
  },
  guideBullet: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginTop: 6,
    backgroundColor: "#10B981",
  },
  guideStepText: {
    flex: 1,
    fontSize: 13,
    lineHeight: 19,
  },
  guideActions: {
    flexDirection: "row",
    gap: 10,
    marginTop: 14,
  },
  guideAction: {
    flex: 1,
    minHeight: 46,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 8,
  },
  guideActionText: {
    fontSize: 13,
    fontWeight: "800",
  },
  guidePrimary: {
    flex: 1,
    minHeight: 46,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 8,
  },
  guidePrimaryText: {
    color: "#fff",
    fontSize: 13,
    fontWeight: "800",
  },

  greetingHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
  },

  greetingTitle: {
    fontSize: 20,
    fontWeight: "900",
  },

  clockRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginVertical: 4,
  },

  clockText: {
    fontSize: 13,
    fontWeight: "800",
  },

  timeTag: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 8,
  },

  timeTagText: {
    fontSize: 10,
    fontWeight: "800",
  },

  greetingSubtitle: {
    fontSize: 12,
    marginTop: 2,
  },

  toggleContainer: {
    alignItems: "center",
    gap: 2,
    marginLeft: 8,
  },

  toggleText: {
    fontSize: 11,
    fontWeight: "800",
  },

  statusBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 12,
    marginTop: 14,
  },

  statusBannerText: {
    fontSize: 12,
    fontWeight: "700",
  },

  statsCard: {
    padding: 18,
    borderRadius: 20,
    borderWidth: 1,
    marginBottom: 20,
  },

  statsHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 16,
  },

  statsTitle: {
    fontSize: 16,
    fontWeight: "800",
  },

  statusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },

  statusBadgeText: {
    fontSize: 11,
    fontWeight: "800",
  },

  statsGrid: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-around",
  },

  statItem: {
    alignItems: "center",
  },

  statValue: {
    fontSize: 18,
    fontWeight: "900",
  },

  statLabel: {
    fontSize: 11,
    marginTop: 2,
  },

  statDivider: {
    width: 1,
    height: 28,
    backgroundColor: "#EBE2E2",
  },

  emptyCard: {
    padding: 32,
    borderRadius: 20,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 20,
  },

  emptyTitle: {
    fontSize: 16,
    fontWeight: "800",
    marginTop: 12,
  },

  emptySubtitle: {
    fontSize: 13,
    textAlign: "center",
    marginTop: 4,
  },

  sectionContainer: {
    marginBottom: 32,
  },

  sectionTitle: {
    fontSize: 16,
    fontWeight: "800",
    marginBottom: 12,
  },

  taskCard: {
    padding: 18,
    borderRadius: 20,
    borderWidth: 1,
    gap: 10,
  },

  taskCardHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },

  badgeRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },

  sequenceBadge: {
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },

  sequenceText: {
    color: "#FFFFFF",
    fontSize: 11,
    fontWeight: "900",
  },

  typeBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },

  typeBadgeText: {
    fontSize: 11,
    fontWeight: "900",
  },

  taskPrice: {
    fontSize: 14,
    fontWeight: "900",
  },

  taskName: {
    fontSize: 17,
    fontWeight: "800",
  },

  addressBox: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 6,
    padding: 10,
    borderRadius: 12,
    borderWidth: 1,
  },

  addressText: {
    flex: 1,
    fontSize: 13,
    lineHeight: 18,
    fontWeight: "500",
  },

  workflowBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 12,
    borderRadius: 14,
    marginTop: 6,
  },

  workflowBtnText: {
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "800",
  },

  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
  },

  modalBox: {
    width: "100%",
    borderRadius: 20,
    borderWidth: 1,
    padding: 20,
    alignItems: "center",
    gap: 12,
  },

  modalIconBg: {
    width: 54,
    height: 54,
    borderRadius: 27,
    alignItems: "center",
    justifyContent: "center",
  },

  modalTitle: {
    fontSize: 17,
    fontWeight: "800",
    textAlign: "center",
  },

  modalSubtitle: {
    fontSize: 13,
    textAlign: "center",
    lineHeight: 18,
  },

  modalBtnRow: {
    flexDirection: "row",
    gap: 12,
    marginTop: 8,
    width: "100%",
  },

  modalCancelBtn: {
    flex: 1,
    height: 44,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },

  modalCancelText: {
    fontSize: 14,
    fontWeight: "700",
  },

  modalConfirmBtn: {
    flex: 1,
    height: 44,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },

  modalConfirmText: {
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "800",
  },
});
