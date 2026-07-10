import { useEffect, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  Platform,
  Linking,
  ActivityIndicator,
} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useTheme } from "@/context/ThemeContext";
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import * as Notifications from "expo-notifications";
import * as IntentLauncher from "expo-intent-launcher";
import Constants from "expo-constants";
import { locationService } from "@/services/locationService";
import { promptBatteryOptimization } from "@/services/batteryOptimization";

const getPackageName = () =>
  Constants.expoConfig?.android?.package ??
  Constants.manifest?.android?.package ??
  "com.shiptos.captain";

async function openAppDetails() {
  const packageName = getPackageName();
  try {
    await IntentLauncher.startActivityAsync(
      "android.settings.APPLICATION_DETAILS_SETTINGS" as any,
      {
        data: `package:${packageName}`,
      },
    );
  } catch {
    await Linking.openSettings();
  }
}

async function openLocationSettings() {
  try {
    await IntentLauncher.startActivityAsync(
      "android.settings.LOCATION_SOURCE_SETTINGS" as any,
    );
  } catch {
    await Linking.openSettings();
  }
}

async function openAllSettings() {
  try {
    await IntentLauncher.startActivityAsync("android.settings.SETTINGS" as any);
  } catch {
    await Linking.openSettings();
  }
}

export default function LocationSettings() {
  const { theme } = useTheme();
  const [isEnabled, setIsEnabled] = useState(false);
  const [isBusy, setIsBusy] = useState(false);
  const [isRefreshingStatus, setIsRefreshingStatus] = useState(false);
  const [updateInterval, setUpdateInterval] = useState(60);
  const [distanceFilter, setDistanceFilter] = useState(10);
  const [deviceCheck, setDeviceCheck] = useState({
    location: false,
    backgroundLocation: false,
    notifications: false,
    trackingRunning: false,
    batteryPrompted: false,
  });

  useEffect(() => {
    let mounted = true;
    const load = async () => {
      try {
        const status = await locationService.getTrackingStatus();
        if (!mounted) return;
        setIsEnabled(status.isTracking);
      } catch {
        // leave defaults
      }
    };
    void load();
    void refreshStatus();
    return () => {
      mounted = false;
    };
  }, []);

  const refreshStatus = async () => {
    try {
      setIsRefreshingStatus(true);
      const permissionState = await locationService.checkPermissions();
      const notificationPerm = await Notifications.getPermissionsAsync();
      const tracking = await locationService.getTrackingStatus();
      const batteryPrompted = (await AsyncStorage.getItem("battery_opt_prompted")) === "true";

      setDeviceCheck({
        location: permissionState !== "denied",
        backgroundLocation: permissionState === "background",
        notifications: notificationPerm.status === "granted",
        trackingRunning: tracking.isTracking,
        batteryPrompted,
      });
    } catch (err) {
      console.warn("Failed to refresh device check:", err);
    } finally {
      setIsRefreshingStatus(false);
    }
  };

  const handleEnableTracking = async () => {
      try {
        setIsBusy(true);

      const permissionState = await locationService.checkPermissions();
      if (permissionState === "denied") {
        Alert.alert(
          "Location permission required",
          "Please allow location access so the rider app can keep sharing location in the background.",
        );
        return;
      }

      if (permissionState === "foreground") {
        const granted = await locationService.requestBackgroundPermission();
        if (!granted) {
          Alert.alert(
            "Background permission needed",
            "Allow location access all the time, then come back here and start tracking again.",
          );
          return;
        }
      }

      const batteryOk = await promptBatteryOptimization();
      if (!batteryOk) {
        Alert.alert(
          "Battery settings",
          "Please set the app to Unrestricted and allow auto-start if the option exists.",
        );
      }

      const status = await locationService.getTrackingStatus();
      if (!status.isTracking) {
        Alert.alert(
          "Tracking not started yet",
          "Use the Start Location Sharing button on the dashboard after these settings are enabled.",
        );
      } else {
        setIsEnabled(true);
        Alert.alert("Ready", "Your device is now prepared for live location sharing.");
      }
      } finally {
        setIsBusy(false);
      }
  };

  const handleSavePreferences = async () => {
    await locationService.updateConfig({
      updateInterval: updateInterval * 1000,
      distanceFilter,
    });
    Alert.alert("Saved", "Tracking preferences have been updated.");
  };



  return (
    <ScrollView
      style={[styles.container, { backgroundColor: theme.background }]}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
    >
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color={theme.text} />
        </TouchableOpacity>
        <Text style={[styles.title, { color: theme.text }]}>Tracking Setup</Text>
      </View>

      <View style={[styles.heroCard, { backgroundColor: theme.card }]}>
        <View style={styles.heroRow}>
          <View style={[styles.heroIcon, { backgroundColor: "#10b98120" }]}>
            <Ionicons name="location" size={24} color="#10b981" />
          </View>
          <View style={styles.heroCopy}>
            <Text style={[styles.heroTitle, { color: theme.text }]}>
              Keep live location running
            </Text>
            <Text style={[styles.heroSub, { color: theme.subText }]}>
              This screen gives you the phone settings that matter for background sharing on your device.
            </Text>
          </View>
        </View>

        <TouchableOpacity
          style={[styles.primaryButton, { backgroundColor: "#10b981" }]}
          onPress={handleEnableTracking}
          disabled={isBusy}
        >
          {isBusy ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <>
              <Ionicons name="play" size={18} color="#fff" />
              <Text style={styles.primaryButtonText}>
                Prepare Device for Tracking
              </Text>
            </>
          )}
        </TouchableOpacity>
      </View>

      <View style={[styles.card, { backgroundColor: theme.card }]}>
        <View style={styles.cardTitleRow}>
          <Text style={[styles.cardTitle, { color: theme.text }]}>
            Device check
          </Text>
          <TouchableOpacity
            onPress={refreshStatus}
            style={styles.refreshButton}
            activeOpacity={0.8}
          >
            {isRefreshingStatus ? (
              <ActivityIndicator size="small" color={theme.primary} />
            ) : (
              <Ionicons name="refresh" size={16} color={theme.primary} />
            )}
            <Text style={[styles.refreshText, { color: theme.primary }]}>
              Refresh
            </Text>
          </TouchableOpacity>
        </View>

        <StatusRow
          ok={deviceCheck.location}
          title="Location access"
          subtitle="The app can read location on this phone."
        />
        <StatusRow
          ok={deviceCheck.backgroundLocation}
          title="Background location"
          subtitle="The app can keep sharing when the screen is off."
        />
        <StatusRow
          ok={deviceCheck.notifications}
          title="Notifications"
          subtitle="The live tracking notification can stay visible."
        />
        <StatusRow
          ok={deviceCheck.trackingRunning}
          title="Tracking service"
          subtitle="Live sharing is currently running."
        />
        <StatusRow
          ok={deviceCheck.batteryPrompted}
          title="Battery exemption"
          subtitle="You already opened the battery optimization flow once."
        />
      </View>

      <View style={[styles.card, { backgroundColor: theme.card }]}>
        <Text style={[styles.cardTitle, { color: theme.text }]}>
          Quick phone settings
        </Text>

        <SettingAction
          icon="phone-portrait-outline"
          title="Open App Info"
          subtitle="Turn on notifications, background activity, and check permissions."
          onPress={openAppDetails}
          themeColor={theme.text}
        />
        <SettingAction
          icon="battery-charging-outline"
          title="Open Battery Settings"
          subtitle="Set this app to Unrestricted / Don't optimize."
          onPress={() => {
            void promptBatteryOptimization();
          }}
          themeColor={theme.text}
        />
        <SettingAction
          icon="navigate-outline"
          title="Open Location Settings"
          subtitle="Make sure GPS and location services are enabled."
          onPress={openLocationSettings}
          themeColor={theme.text}
        />
        <SettingAction
          icon="settings-outline"
          title="Open All Settings"
          subtitle="Access system settings page if needed."
          onPress={openAllSettings}
          themeColor={theme.text}
        />
      </View>

      <View style={[styles.card, { backgroundColor: theme.card }]}>
        <Text style={[styles.cardTitle, { color: theme.text }]}>
          Tracking preferences
        </Text>

        <View style={styles.settingRow}>
          <Text style={[styles.settingLabel, { color: theme.text }]}>
            Update Interval
          </Text>
          <View style={styles.optionRow}>
            {[30, 60, 120, 300].map((seconds) => (
              <TouchableOpacity
                key={seconds}
                style={[
                  styles.optionPill,
                  updateInterval === seconds && styles.optionPillActive,
                ]}
                onPress={() => setUpdateInterval(seconds)}
              >
                <Text
                  style={[
                    styles.optionText,
                    updateInterval === seconds && styles.optionTextActive,
                  ]}
                >
                  {seconds}s
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        <View style={styles.settingRow}>
          <Text style={[styles.settingLabel, { color: theme.text }]}>
            Movement Sensitivity
          </Text>
          <View style={styles.optionRow}>
            {[5, 10, 25, 50].map((meters) => (
              <TouchableOpacity
                key={meters}
                style={[
                  styles.optionPill,
                  distanceFilter === meters && styles.optionPillActivePurple,
                ]}
                onPress={() => setDistanceFilter(meters)}
              >
                <Text
                  style={[
                    styles.optionText,
                    distanceFilter === meters && styles.optionTextActive,
                  ]}
                >
                  {meters}m
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        <TouchableOpacity
          style={[styles.secondaryButton, { backgroundColor: theme.primary }]}
          onPress={handleSavePreferences}
        >
          <Text style={styles.secondaryButtonText}>Save Preferences</Text>
        </TouchableOpacity>
      </View>

      <View style={[styles.card, { backgroundColor: theme.card }]}>
        <Text style={[styles.cardTitle, { color: theme.text }]}>
          Why this matters
        </Text>
        <Text style={[styles.infoText, { color: theme.subText }]}>
          Android can pause background work aggressively when the screen is off. A foreground service, battery exemption, and auto-start approval are the practical way to keep live location sharing running.
        </Text>
      </View>

      <TouchableOpacity
        style={[styles.footerButton, { backgroundColor: "#0f172a" }]}
        onPress={() => router.push("/(rider)/(tabs)/dashboard" as any)}
      >
        <Ionicons name="speedometer-outline" size={18} color="#fff" />
        <Text style={styles.footerButtonText}>Go to Dashboard</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

function SettingAction({
  icon,
  title,
  subtitle,
  onPress,
  themeColor,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  subtitle: string;
  onPress: () => Promise<void> | void;
  themeColor: string;
}) {
  return (
    <TouchableOpacity style={styles.actionRow} activeOpacity={0.82} onPress={onPress}>
      <View style={styles.actionIcon}>
        <Ionicons name={icon} size={20} color="#10b981" />
      </View>
      <View style={styles.actionCopy}>
        <Text style={[styles.actionTitle, { color: themeColor }]}>{title}</Text>
        <Text style={styles.actionSubtitle}>{subtitle}</Text>
      </View>
      <Ionicons name="chevron-forward" size={20} color="#94a3b8" />
    </TouchableOpacity>
  );
}

function StatusRow({
  ok,
  title,
  subtitle,
}: {
  ok: boolean;
  title: string;
  subtitle: string;
}) {
  return (
    <View style={styles.statusRow}>
      <View style={[styles.statusDotWrap, { backgroundColor: ok ? "#10b98118" : "#ef444418" }]}>
        <Ionicons name={ok ? "checkmark" : "close"} size={14} color={ok ? "#10b981" : "#ef4444"} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={styles.statusTitle}>{title}</Text>
        <Text style={styles.statusSubtitle}>{subtitle}</Text>
      </View>
      <Text style={[styles.statusLabel, { color: ok ? "#10b981" : "#ef4444" }]}>
        {ok ? "OK" : "Needs work"}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    padding: 16,
    paddingBottom: 36,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 18,
  },
  backButton: {
    marginRight: 12,
  },
  title: {
    fontSize: 24,
    fontWeight: "900",
  },
  heroCard: {
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
  },
  heroRow: {
    flexDirection: "row",
    gap: 12,
    alignItems: "flex-start",
    marginBottom: 16,
  },
  heroIcon: {
    width: 48,
    height: 48,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  heroCopy: {
    flex: 1,
  },
  heroTitle: {
    fontSize: 17,
    fontWeight: "900",
    marginBottom: 4,
  },
  heroSub: {
    fontSize: 13,
    lineHeight: 19,
  },
  primaryButton: {
    minHeight: 48,
    borderRadius: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingHorizontal: 16,
  },
  primaryButtonText: {
    color: "#fff",
    fontSize: 15,
    fontWeight: "800",
  },
  card: {
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: "rgba(0,0,0,0.05)",
  },
  cardTitle: {
    fontSize: 17,
    fontWeight: "900",
    marginBottom: 12,
  },
  cardTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
    marginBottom: 12,
  },
  refreshButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 10,
    backgroundColor: "#10b98114",
  },
  refreshText: {
    fontSize: 12,
    fontWeight: "800",
  },
  actionRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 14,
    borderTopWidth: 1,
    borderTopColor: "rgba(148,163,184,0.18)",
  },
  actionIcon: {
    width: 38,
    height: 38,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#10b98114",
  },
  actionCopy: {
    flex: 1,
  },
  actionTitle: {
    fontSize: 14,
    fontWeight: "800",
    marginBottom: 3,
  },
  actionSubtitle: {
    fontSize: 12,
    color: "#64748b",
    lineHeight: 17,
  },
  statusRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingVertical: 10,
    borderTopWidth: 1,
    borderTopColor: "rgba(148,163,184,0.15)",
  },
  statusDotWrap: {
    width: 28,
    height: 28,
    borderRadius: 9,
    alignItems: "center",
    justifyContent: "center",
  },
  statusTitle: {
    fontSize: 13,
    fontWeight: "800",
    color: "#0f172a",
  },
  statusSubtitle: {
    fontSize: 12,
    lineHeight: 16,
    color: "#64748b",
    marginTop: 2,
  },
  statusLabel: {
    fontSize: 11,
    fontWeight: "900",
  },
  stepRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
    marginBottom: 12,
  },
  stepIndex: {
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 1,
  },
  stepIndexText: {
    color: "#fff",
    fontSize: 11,
    fontWeight: "900",
  },
  stepText: {
    flex: 1,
    fontSize: 13,
    lineHeight: 19,
  },
  settingRow: {
    marginBottom: 20,
  },
  settingLabel: {
    fontSize: 15,
    fontWeight: "800",
    marginBottom: 10,
  },
  optionRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  optionPill: {
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 12,
    backgroundColor: "#f1f5f9",
  },
  optionPillActive: {
    backgroundColor: "#10b981",
  },
  optionPillActivePurple: {
    backgroundColor: "#8b5cf6",
  },
  optionText: {
    color: "#64748b",
    fontWeight: "800",
    fontSize: 12,
  },
  optionTextActive: {
    color: "#ffffff",
  },
  secondaryButton: {
    minHeight: 48,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  secondaryButtonText: {
    color: "#fff",
    fontSize: 15,
    fontWeight: "800",
  },
  infoText: {
    fontSize: 13,
    lineHeight: 20,
  },
  footerButton: {
    minHeight: 50,
    borderRadius: 14,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  footerButtonText: {
    color: "#fff",
    fontSize: 14,
    fontWeight: "800",
  },
});
