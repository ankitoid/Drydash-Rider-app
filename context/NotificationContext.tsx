import InAppToast from "@/components/notifications/InAppToast";
import React, { createContext, useContext, useState } from "react";

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
  const [visible, setVisible] = useState(false);
  const [title, setTitle] = useState("");
  const [message, setMessage] = useState("");
  const [duration, setDuration] = useState(500);

  const notify = ({ title, message, duration = 500 }: NotifyPayload) => {
    setTitle(title);
    setMessage(message);
    setDuration(duration);
    setVisible(true);
  };

  const hide = () => {
    setVisible(false);
  };

  return (
    <NotificationContext.Provider value={{ notify, hide }}>
      {children}

      {/* GLOBAL POPUP OVERLAY */}
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
