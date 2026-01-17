import { Audio } from "expo-av";

let sound: Audio.Sound | null = null;

export const playNotificationSound = async () => {
  try {
    if (sound) {
      await sound.unloadAsync();
      sound = null;
    }

    const { sound: newSound } = await Audio.Sound.createAsync(
      require("../assets/sounds/notification-sound.mp3"),
      { shouldPlay: true }
    );

    sound = newSound;

    sound.setOnPlaybackStatusUpdate(async (status) => {
      if (!status.isLoaded) return;

      if (status.didJustFinish) {
        await sound?.unloadAsync();
        sound = null;
      }
    });
  } catch (error) {
    console.log("❌ Sound play error:", error);
  }
};
