// services/batteryOptimization.ts
//
// Checks whether the app is exempt from Android's battery optimization (Doze mode).
// If not, opens the system settings page so the user can whitelist the app.
// Without this exemption, Android WILL kill the foreground service after a few minutes.

import { Platform, Alert, Linking } from "react-native";
import * as IntentLauncher from "expo-intent-launcher";
import Constants from "expo-constants";

/**
 * Check if we can open battery optimization settings and prompt the user.
 * This is the same thing Google Maps does — it asks you to disable battery
 * optimization so it can run in the background indefinitely.
 */
export async function requestBatteryOptimizationExemption(): Promise<void> {
  if (Platform.OS !== "android") return;

  try {
    // Get the app package name
    const packageName =
      Constants.expoConfig?.android?.package ??
      Constants.manifest?.android?.package ??
      "com.drydash.rider";

    // Try to open the battery optimization settings for this specific app
    // This shows the "Allow background activity" / "Unrestricted" dialog
    try {
      await IntentLauncher.startActivityAsync(
        IntentLauncher.ActivityAction.REQUEST_IGNORE_BATTERY_OPTIMIZATIONS,
        {
          data: `package:${packageName}`,
        }
      );
      console.log("✅ Battery optimization exemption dialog opened");
      return;
    } catch (directErr) {
      console.log("⚠️ Direct battery exemption dialog failed, trying settings page...", directErr);
    }

    // Fallback: open the general battery optimization list
    try {
      await IntentLauncher.startActivityAsync(
        IntentLauncher.ActivityAction.IGNORE_BATTERY_OPTIMIZATION_SETTINGS
      );
      console.log("✅ Battery optimization settings page opened");
      return;
    } catch (listErr) {
      console.log("⚠️ Battery optimization list failed, trying power settings...", listErr);
    }

    // Last fallback: open general battery/power settings
    try {
      await IntentLauncher.startActivityAsync(
        "android.settings.BATTERY_SAVER_SETTINGS" as any
      );
      return;
    } catch {
      // If all else fails, open app detail settings
      await Linking.openSettings();
    }
  } catch (err) {
    console.error("❌ Failed to open battery optimization settings:", err);
  }
}

/**
 * Show an alert explaining why battery optimization needs to be disabled,
 * then open the settings.
 */
export function promptBatteryOptimization(): Promise<boolean> {
  if (Platform.OS !== "android") return Promise.resolve(true);

  return new Promise((resolve) => {
    Alert.alert(
      "🔋 Disable Battery Optimization",
      'For uninterrupted location tracking (like Google Maps), you need to set this app to "Unrestricted" in battery settings.\n\n' +
      "Without this, Android will stop tracking after a few minutes in the background.",
      [
        {
          text: "Skip",
          style: "cancel",
          onPress: () => resolve(false),
        },
        {
          text: "Open Settings",
          onPress: async () => {
            await requestBatteryOptimizationExemption();
            resolve(true);
          },
        },
      ],
      { cancelable: false }
    );
  });
}
