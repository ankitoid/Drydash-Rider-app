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
import { openOverlaySettingsDirectly } from "@/services/OverlayManager";

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
  const { theme, isDark } = useTheme();
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

      {/* HERO CARD */}
      <View
        style={[
          styles.heroCard,
          { backgroundColor: theme.card, borderColor: theme.border },
        ]}
      >
        <View style={styles.heroRow}>
          <View
            style={[
              styles.heroIcon,
              { backgroundColor: theme.primary + "1A" },
            ]}
          >
            <Ionicons name="location" size={24} color={theme.primary} />
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
          style={[styles.primaryButton, { backgroundColor: theme.primary }]}
          onPress={handleEnableTracking}
          disabled={isBusy}
          activeOpacity={0.88}
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

      {/* DEVICE CHECK CARD */}
      <View
        style={[
          styles.card,
          { backgroundColor: theme.card, borderColor: theme.border },
        ]}
      >
        <View style={styles.cardTitleRow}>
          <Text style={[styles.cardTitle, { color: theme.text }]}>
            Device check
          </Text>
          <TouchableOpacity
            onPress={refreshStatus}
            style={[styles.refreshButton, { backgroundColor: theme.primary + "15" }]}
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

      {/* QUICK PHONE SETTINGS CARD */}
      <View
        style={[
          styles.card,
          { backgroundColor: theme.card, borderColor: theme.border },
        ]}
      >
        <Text style={[styles.cardTitle, { color: theme.text }]}>
          Quick phone settings
        </Text>

        <SettingAction
          icon="layers-outline"
          title="Display Over Other Apps"
          subtitle="Allow floating mini-window tracking overlay when using other apps."
          onPress={openOverlaySettingsDirectly}
        />
        <SettingAction
          icon="phone-portrait-outline"
          title="Open App Info"
          subtitle="Turn on notifications, background activity, and check permissions."
          onPress={openAppDetails}
        />
        <SettingAction
          icon="battery-charging-outline"
          title="Open Battery Settings"
          subtitle="Set this app to Unrestricted / Don't optimize."
          onPress={() => {
            void promptBatteryOptimization();
          }}
        />
        <SettingAction
          icon="navigate-outline"
          title="Open Location Settings"
          subtitle="Make sure GPS and location services are enabled."
          onPress={openLocationSettings}
        />
        <SettingAction
          icon="settings-outline"
          title="Open All Settings"
          subtitle="Access system settings page if needed."
          onPress={openAllSettings}
        />
      </View>

      {/* TRACKING PREFERENCES CARD */}
      <View
        style={[
          styles.card,
          { backgroundColor: theme.card, borderColor: theme.border },
        ]}
      >
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
                  { backgroundColor: isDark ? "#334155" : "#f1f5f9" },
                  updateInterval === seconds && { backgroundColor: theme.primary },
                ]}
                onPress={() => setUpdateInterval(seconds)}
              >
                <Text
                  style={[
                    styles.optionText,
                    { color: theme.subText },
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
                  { backgroundColor: isDark ? "#334155" : "#f1f5f9" },
                  distanceFilter === meters && { backgroundColor: "#8b5cf6" },
                ]}
                onPress={() => setDistanceFilter(meters)}
              >
                <Text
                  style={[
                    styles.optionText,
                    { color: theme.subText },
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
          activeOpacity={0.88}
        >
          <Text style={styles.secondaryButtonText}>Save Preferences</Text>
        </TouchableOpacity>
      </View>

      {/* WHY THIS MATTERS CARD */}
      <View
        style={[
          styles.card,
          { backgroundColor: theme.card, borderColor: theme.border },
        ]}
      >
        <Text style={[styles.cardTitle, { color: theme.text }]}>
          Why this matters
        </Text>
        <Text style={[styles.infoText, { color: theme.subText }]}>
          Android can pause background work aggressively when the screen is off. A foreground service, battery exemption, and auto-start approval are the practical way to keep live location sharing running.
        </Text>
      </View>

      <TouchableOpacity
        style={[
          styles.footerButton,
          { backgroundColor: isDark ? "#1E293B" : "#0F172A" },
        ]}
        onPress={() => router.push("/(rider)/(tabs)/dashboard" as any)}
        activeOpacity={0.88}
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
}: {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  subtitle: string;
  onPress: () => Promise<void> | void;
}) {
  const { theme } = useTheme();
  return (
    <TouchableOpacity
      style={[styles.actionRow, { borderTopColor: theme.border }]}
      activeOpacity={0.82}
      onPress={onPress}
    >
      <View style={[styles.actionIcon, { backgroundColor: theme.primary + "15" }]}>
        <Ionicons name={icon} size={20} color={theme.primary} />
      </View>
      <View style={styles.actionCopy}>
        <Text style={[styles.actionTitle, { color: theme.text }]}>{title}</Text>
        <Text style={[styles.actionSubtitle, { color: theme.subText }]}>{subtitle}</Text>
      </View>
      <Ionicons name="chevron-forward" size={20} color={theme.subText} />
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
  const { theme } = useTheme();
  return (
    <View style={[styles.statusRow, { borderTopColor: theme.border }]}>
      <View
        style={[
          styles.statusDotWrap,
          { backgroundColor: ok ? "#10b98118" : "#ef444418" },
        ]}
      >
        <Ionicons
          name={ok ? "checkmark" : "close"}
          size={14}
          color={ok ? "#10b981" : "#ef4444"}
        />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={[styles.statusTitle, { color: theme.text }]}>{title}</Text>
        <Text style={[styles.statusSubtitle, { color: theme.subText }]}>
          {subtitle}
        </Text>
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
    marginTop: 5,
    fontSize: 20,
    fontWeight: "900",
  },
  heroCard: {
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
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
  },
  actionIcon: {
    width: 38,
    height: 38,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
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
    lineHeight: 17,
  },
  statusRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingVertical: 10,
    borderTopWidth: 1,
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
  },
  statusSubtitle: {
    fontSize: 12,
    lineHeight: 16,
    marginTop: 2,
  },
  statusLabel: {
    fontSize: 11,
    fontWeight: "900",
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
  },
  optionText: {
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
