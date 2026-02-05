// context/NotificationContext.tsx
import InAppToast from "@/components/notifications/InAppToast";
import { useAuth } from "@/context/useAuth";
import { setupNotificationChannel } from "@/services/notificationSetup";
import { playNotificationSound } from "@/services/notificationSound";
import { registerForPushNotifications } from "@/services/pushNotifications";
import * as Notifications from "expo-notifications";
import { router } from "expo-router";
import { createContext, useContext, useEffect, useRef, useState } from "react";

type NotifyPayload = {
  title: string;
  message: string;
  duration?: number;
};

type NotificationContextType = {
  notify: (payload: NotifyPayload) => void;
  hide: () => void;
};

const NotificationContext = createContext<NotificationContextType | null>(null);

export const NotificationProvider = ({ children }: { children: React.ReactNode }) => {
  const { user, token } = useAuth();
  const [visible, setVisible] = useState(false);
  const [title, setTitle] = useState("");
  const [message, setMessage] = useState("");
  const [duration, setDuration] = useState(500);

  const fcmTokenRef = useRef<string | null>(null);
  const handledInitialResponseRef = useRef(false);

  const notify = ({ title, message, duration = 500 }: NotifyPayload) => {
    setTitle(title);
    setMessage(message);
    setDuration(duration);
    setVisible(true);
  };

  const hide = () => {
    setVisible(false);
  };

  const handleNavigationFromData = (data: any) => {
    try {
      if (!data) return;

      const orderId = data?.orderId ?? data?.order_id ?? data?.id;

      const isPickup =
        data?.screen === "pickup" ||
        data?.type === "pickup" ||
        data?.target === "pickup" ||
        Boolean(data?.pickupId) ||
        Boolean(data?.pickup_id);

      const pickupId = data?.pickupId ?? data?.pickup_id ?? orderId;

      if (isPickup && pickupId) {
        router.push(`/(rider)/order/pickup/${String(pickupId)}`);
        return;
      }

      if (orderId) {
        router.push(`/(rider)/order/delivered/${String(orderId)}`);
        return;
      }

      if (data?.deep_link) {
        router.push(String(data.deep_link) as any);
        return;
      }
    } catch (err) {
      console.warn("handleNavigationFromData error:", err);
    }
  };

  useEffect(() => {
    let mounted = true;
    const init = async () => {
      if (!user || !token) return;

      try {
        await setupNotificationChannel();

        const fcmToken = await registerForPushNotifications();
        if (!fcmToken) return;

        fcmTokenRef.current = fcmToken;

        await fetch("https://api.drydash.in/api/v1/rider/push-tokens", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            token: fcmToken,
            platform: "android",
          }),
        });
      } catch (err) {
        console.warn("Notification registration failed:", err);
      }
    };

    if (mounted) init();

    return () => {
      mounted = false;
    };
  }, [user?._id, token]);

  useEffect(() => {
    if (user || token) return;

    const cleanup = async () => {
      const t = fcmTokenRef.current;
      if (!t) return;

      try {
        await fetch("https://api.drydash.in/api/v1/rider/push-tokens", {
          method: "DELETE",
          headers: {
            "Content-Type": "application/json",
            // no auth header because token is gone; if you require auth, handle this from logout flow instead
          },
          body: JSON.stringify({ token: t }),
        });
      } catch (err) {
        console.warn("Failed to remove push token on logout:", err);
      } finally {
        fcmTokenRef.current = null;
      }
    };

    cleanup();
  }, [user, token]);


  useEffect(() => {
    // foreground: show in-app toast + play sound
    const receivedSub = Notifications.addNotificationReceivedListener((notification) => {
      try {
        const content = notification.request.content;
        const t = content.title ?? "Notification";
        const b = content.body ?? "";
        // show your in-app toast
        notify({ title: String(t), message: String(b), duration: 3000 });

        // play sound (best-effort)
        playNotificationSound().catch(() => {});
      } catch (err) {
        console.warn("notification received handler error:", err);
      }
    });

    
    const responseSub = Notifications.addNotificationResponseReceivedListener((response) => {
      try {
        if (handledInitialResponseRef.current) {
        }
        const data = response.notification.request.content.data as any;

        if (handledInitialResponseRef.current) {
          return;
        }

        handleNavigationFromData(data);
      } catch (err) {
        console.warn("notification response handler error:", err);
      }
    });

    (async () => {
      try {
        const lastResponse = await Notifications.getLastNotificationResponseAsync();
        if (lastResponse) {
          handledInitialResponseRef.current = true;
          const data = lastResponse.notification.request.content.data as any;
          handleNavigationFromData(data);
        }
      } catch (err) {
        console.warn("Error checking initial notification response:", err);
      }
    })();

    return () => {
      receivedSub.remove();
      responseSub.remove();
    };
  }, []);

  return (
    <NotificationContext.Provider value={{ notify, hide }}>
      {children}

      <InAppToast
        visible={visible}
        title={title}
        message={message}
        duration={duration}
        onClose={hide}
      />
    </NotificationContext.Provider>
  );
};

export const useNotification = () => {
  const ctx = useContext(NotificationContext);
  if (!ctx) throw new Error("useNotification must be used inside NotificationProvider");
  return ctx;
};