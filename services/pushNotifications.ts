// services/PushNotifications.ts
import * as Notifications from "expo-notifications";
import * as Device from "expo-device";

export async function registerForPushNotifications() {
  if (!Device.isDevice) {
    console.warn("Must use physical device for push notifications");
    return null;
  }

  // Permission
  const { status: existingStatus } =
    await Notifications.getPermissionsAsync();

  let finalStatus = existingStatus;
  if (existingStatus !== "granted") {
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
  }

  if (finalStatus !== "granted") {
    console.warn("Notification permission not granted");
    return null;
  }

  const tokenResponse =
    await Notifications.getDevicePushTokenAsync();

  return tokenResponse.data;
}

// services/PushNotifications.ts
// import * as Notifications from "expo-notifications";
// import * as Device from "expo-device";
// import Constants from "expo-constants";

// export async function registerForPushNotifications() {
//   try {
//     if (Constants.appOwnership === "expo") {
//       console.warn("Skipping push registration in Expo Go");
//       return null;
//     }

//     if (!Device.isDevice) {
//       console.warn("Must use physical device for push notifications");
//       return null;
//     }

//     // Permission
//     const { status: existingStatus } =
//       await Notifications.getPermissionsAsync();

//     let finalStatus = existingStatus;

//     if (existingStatus !== "granted") {
//       const { status } = await Notifications.requestPermissionsAsync();

//       finalStatus = status;
//     }

//     if (finalStatus !== "granted") {
//       console.warn("Notification permission not granted");
//       return null;
//     }

//     const tokenResponse = await Notifications.getDevicePushTokenAsync();

//     return tokenResponse.data;
//   } catch (err) {
//     console.error("Push registration failed:", err);
//     return null;
//   }
// }