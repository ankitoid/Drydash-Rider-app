// src/services/notificationSetup.ts
import * as Notifications from "expo-notifications";
import { Platform } from "react-native";

export async function setupNotificationChannel() {
  if (Platform.OS !== "android") return;

  await Notifications.setNotificationChannelAsync("assignments", {
    name: "Assignments",
    importance: Notifications.AndroidImportance.HIGH,
    vibrationPattern: [0, 250, 250, 250],
    sound: "default",
    lockscreenVisibility:
      Notifications.AndroidNotificationVisibility.PUBLIC,
  });
}