import * as Notifications from "expo-notifications";

// ✅ Show notifications even when app is foreground
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,

    // ✅ NEW REQUIRED FIELDS (Expo SDK update)
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

export const requestNotificationPermission = async () => {
  const { status } = await Notifications.getPermissionsAsync();

  if (status !== "granted") {
    const res = await Notifications.requestPermissionsAsync();
    return res.status === "granted";
  }

  return true;
};

export const showSystemNotification = async (title: string, body: string) => {
  try {
    await Notifications.scheduleNotificationAsync({
      content: {
        title,
        body,
        sound: true,
      },
      trigger: null, // immediate
    });
  } catch (error) {
    console.log("❌ showSystemNotification error:", error);
  }
};
