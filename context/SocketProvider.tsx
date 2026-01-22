import { useNotification } from "@/context/NotificationContext";
import { useRiderData } from "@/context/RiderDataContext";
import { useAuth } from "@/context/useAuth";
import { playNotificationSound } from "@/services/notificationSound";
import { socket } from "@/services/socket";
import React, { useEffect } from "react";
import { AppState } from "react-native";

export const SocketProvider = ({ children }: { children: React.ReactNode }) => {
  const { user } = useAuth();
  const { notify } = useNotification();
  const { addPickupRealtime, addDeliveryRealtime } = useRiderData();

  useEffect(() => {
    const riderId = user?._id;
    if (!riderId) return;

    socket.connect();

    socket.on("connect", () => {
      socket.emit("joinRider", { riderId });
      console.log("✅ [SOCKET PROVIDER] joined rider room:", riderId);
      
      socket.emit("joinAdmin");
    });

    // ✅ IMPORTANT: prevent duplicate listener
    socket.off("riderAssignedPickup");
    socket.off("assignOrder");
    
    // Support backend event named "riderAssignedPickups"
    socket.on("riderAssignedPickup", async ({ pickup }) => {
      console.log("🔥 [SOCKET PROVIDER] riderAssignedPickup received:", pickup);

      const shortId = pickup?._id ? pickup._id.slice(-5).toUpperCase() : "-----";

      // In-app popup
      notify({
        title: "New Pickup Assigned 🚀",
        message: `Pickup ID: WZP-${shortId}`,
        duration: 5000,
      });

      // Sound
      await playNotificationSound();

      // ✅ MAIN FIX: Update list globally
      addPickupRealtime(pickup);
    });

    // Support backend event named "assignOrder"
    socket.on("assignOrder", async ({ order }) => {
      console.log("🔥 [SOCKET PROVIDER] assignOrder received:", order);

      const mapped = {
        id: order._id,
        orderId: order.order_id,
        name: order.customerName,
        phone: order.contactNo,
        address: order.address,
      };

      notify({
        title: "New Delivery Assigned 📦",
        message: `Order ID: ${mapped.orderId || mapped.id.slice(-5)}`,
        duration: 5000,
      });

      await playNotificationSound();

      addDeliveryRealtime(mapped);
    });

    // Listen for location update acknowledgments
    socket.on("locationUpdateAck", ({ success, message }) => {
      if (success) {
        console.log("📍 Location update acknowledged:", message);
      } else {
        console.warn("⚠️ Location update failed:", message);
      }
    });

    socket.on("disconnect", (reason) => {
      console.log("⚠️ [SOCKET PROVIDER] disconnected:", reason);
    });

    socket.on("connect_error", (err) => {
      console.log("❌ [SOCKET PROVIDER] connect_error:", err?.message || err);
    });

    return () => {
      socket.off("connect");
      socket.off("disconnect");
      socket.off("connect_error");
      socket.off("riderAssignedPickup");
      socket.off("assignOrder");
      socket.off("locationUpdateAck");
    };
  }, [user?._id]);

  // Handle app foreground reconnect
  useEffect(() => {
    const sub = AppState.addEventListener("change", (state) => {
      if (state === "active") {
        const riderId = user?._id;
        if (!riderId) return;

        if (!socket.connected) {
          socket.connect();
          socket.emit("joinRider", { riderId });
          socket.emit("joinAdmin");
        }
      }
    });

    return () => sub.remove();
  }, [user?._id]);

  return <>{children}</>;
};