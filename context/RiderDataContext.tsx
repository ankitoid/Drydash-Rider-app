import React, { createContext, useContext, useState } from "react";

/* ================= TYPES ================= */

export type Pickup = {
  _id: string;
  Name: string;
  Address: string;
};

export type Delivery = {
  id: string;
  orderId: string;
  name: string;
  address: string;
};

type RiderDataContextType = {
  pickups: Pickup[];
  setPickups: React.Dispatch<React.SetStateAction<Pickup[]>>;
  addPickupRealtime: (pickup: Pickup) => void;

  deliveries: Delivery[];
  setDeliveries: React.Dispatch<React.SetStateAction<Delivery[]>>;
  addDeliveryRealtime: (delivery: Delivery) => void;
};

const RiderDataContext = createContext<RiderDataContextType | null>(null);

/* ================= PROVIDER ================= */

export const RiderDataProvider = ({
  children,
}: {
  children: React.ReactNode;
}) => {
  const [pickups, setPickups] = useState<Pickup[]>([]);
  const [deliveries, setDeliveries] = useState<Delivery[]>([]);

  const addPickupRealtime = (pickup: Pickup) => {
    setPickups((prev) => {
      const exists = prev.some((p) => p._id === pickup._id);
      if (exists) return prev;
      return [pickup, ...prev];
    });
  };

  const addDeliveryRealtime = (delivery: Delivery) => {
    setDeliveries((prev) => {
      const exists = prev.some((d) => d.id === delivery.id);
      if (exists) return prev;
      return [delivery, ...prev];
    });
  };

  return (
    <RiderDataContext.Provider
      value={{
        pickups,
        setPickups,
        addPickupRealtime,
        deliveries,
        setDeliveries,
        addDeliveryRealtime,
      }}
    >
      {children}
    </RiderDataContext.Provider>
  );
};

/* ================= HOOK ================= */

export const useRiderData = () => {
  const ctx = useContext(RiderDataContext);
  if (!ctx) {
    throw new Error("useRiderData must be used inside RiderDataProvider");
  }
  return ctx;
};
