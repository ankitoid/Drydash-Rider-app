// services/backgroundLocationTask.ts
import { locationService } from "@/services/locationService";
import { socket } from "@/services/socket";
import * as TaskManager from "expo-task-manager";

export const LOCATION_TASK_NAME = "BACKGROUND_LOCATION_TASK";

TaskManager.defineTask(LOCATION_TASK_NAME, async ({ data, error }: any) => {
  if (error) {
    console.error("❌ Background location task error:", error);
    return;
  }

  if (!data?.locations?.length) return;

  const location = data.locations[0];
  const user = locationService.getCachedUser();

  if (!user?._id) {
    console.log("⚠️ No cached user in background task");
    return;
  }

  if (!socket.connected) {
    console.log("🔌 Reconnecting socket from background...");
    socket.connect();
    socket.emit("joinRider", user._id);
  }

  const payload = locationService.formatLocationForBackend(
    location,
    user._id,
    user.name || "Unknown Rider",
    user.phone || "N/A",
    "active",
  );

  console.log("📡 BG sending location:", payload.location);

  socket.emit("riderLocationUpdate", payload);
});
