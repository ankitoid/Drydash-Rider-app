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

  let isMounted = true;
  console.log("🔌 [SocketProvider] Initializing socket for rider:", riderId);

  // helper to safely (re)attach a listener (removes previous to avoid duplicates)
  const safeOn = (event: string, handler: (...args: any[]) => void) => {
    try {
      socket.off(event);
      socket.on(event, handler);
    } catch (err) {
      console.warn(`[SocketProvider] safeOn error for ${event}:`, err);
    }
  };

  // --- Connection lifecycle handlers ---
  safeOn("connect", () => {
    if (!isMounted) return;
    console.log("✅ [SocketProvider] connected:", socket.id);
    socket.emit("joinRider", { riderId });
    console.log("✅ [SocketProvider] joinRider emitted:", riderId);

    // optionally join admin room only once
    socket.emit("joinAdmin");
  });

  safeOn("connect_error", (err: any) => {
    console.error("❌ [SocketProvider] connect_error:", err?.message ?? err);
    // lightweight reconnect attempt (socket.io will also try automatically)
    setTimeout(() => {
      if (!socket.connected) {
        console.log("🔄 [SocketProvider] attempting manual reconnect...");
        socket.connect();
      }
    }, 3000);
  });

  safeOn("disconnect", (reason: any) => {
    console.log("⚠️ [SocketProvider] disconnected:", reason);
    // If server forcibly disconnected, tell socket to try reconnecting
    if (reason === "io server disconnect") {
      socket.connect();
    }
  });

  safeOn("reconnect", (attemptNumber: number) => {
    console.log(`🔄 [SocketProvider] reconnected after ${attemptNumber} attempts`);
    if (user?._id) socket.emit("joinRider", { riderId: user._id });
  });

  // Optional: more detailed reconnect logs
  safeOn("reconnect_attempt", (attempt: number) => console.log(`🔄 reconnect attempt ${attempt}`));
  safeOn("reconnect_error", (err: any) => console.error("❌ reconnect_error:", err));
  safeOn("reconnect_failed", () => console.error("❌ reconnect_failed"));

  // --- Domain events (remove previous first to avoid duplicates) ---
  safeOn("riderAssignedPickup", async ({ pickup }: { pickup: any }) => {
    if (!isMounted) return;
    try {
      console.log("🔥 [SocketProvider] riderAssignedPickup received:", pickup);
      const shortId = pickup?._id ? pickup._id.slice(-5).toUpperCase() : "-----";

      // in-app UI notify (your notify API)
      notify?.({
        title: "New Pickup Assigned 🚀",
        message: `Pickup ID: WZP-${shortId}`,
        duration: 5000,
      });

      // play sound but don't crash if it fails
      try { await playNotificationSound?.(); } catch (e) { console.warn("🔊 play sound failed", e); }

      // update global list
      addPickupRealtime?.(pickup);
    } catch (err) {
      console.error("❌ Error handling riderAssignedPickup:", err);
    }
  });

  safeOn("assignOrder", async ({ order }: { order: any }) => {
    if (!isMounted) return;
    try {
      console.log("🔥 [SocketProvider] assignOrder received:", order);

      const mapped = {
        id: order._id,
        orderId: order.order_id,
        name: order.customerName,
        phone: order.contactNo,
        address: order.address,
      };

      notify?.({
        title: "New Delivery Assigned 📦",
        message: `Order ID: ${mapped.orderId ?? mapped.id?.slice(-5)}`,
        duration: 5000,
      });

      try { await playNotificationSound?.(); } catch (e) { console.warn("🔊 play sound failed", e); }

      addDeliveryRealtime?.(mapped);
    } catch (err) {
      console.error("❌ Error handling assignOrder:", err);
    }
  });

  safeOn("locationUpdateAck", ({ success, message }: { success: boolean; message?: string }) => {
    if (!isMounted) return;
    if (success) {
      console.log("📍 [SocketProvider] locationUpdateAck:", message);
    } else {
      console.warn("⚠️ [SocketProvider] locationUpdate failed:", message);
    }
  });

  // Make sure socket is connected (avoid double connect)
  if (!socket.connected) {
    console.log("🔌 [SocketProvider] connecting socket...");
    socket.connect();
  } else {
    // Re-join rooms if the socket was already connected (e.g. hot reload)
    socket.emit("joinRider", { riderId });
    socket.emit("joinAdmin");
  }

  // cleanup
  return () => {
    isMounted = false;
    console.log("🧹 [SocketProvider] cleaning up socket listeners");
    // turn off only the events we attached
    [
      "connect",
      "connect_error",
      "disconnect",
      "reconnect",
      "reconnect_attempt",
      "reconnect_error",
      "reconnect_failed",
      "riderAssignedPickup",
      "assignOrder",
      "locationUpdateAck",
    ].forEach((ev) => {
      try { socket.off(ev); } catch (e) { /* ignore */ }
    });

    // Do NOT forcibly disconnect here — allow socket.io to manage reconnection
    // socket.disconnect();
  };
  // eslint-disable-next-line react-hooks/exhaustive-deps
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