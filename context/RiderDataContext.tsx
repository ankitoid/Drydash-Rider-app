import React, { createContext, useContext, useState, useCallback } from "react";
import { VRPTrip, VRPStop, vrpTripService } from "@/services/api/vrpTripService";
import { API_V1_BASE_URL } from "@/constants/apiConfig";

/* ================= TYPES ================= */

export type Pickup = {
  _id: string;
  Name: string;
  Address: string;
  Contact?: string;
  item_types?: string[];
  price?: number;
  status?: string;
  completed?: boolean;
};

export type Delivery = {
  id: string;
  orderId: string;
  name: string;
  address: string;
  lat: number;
  lng: number;
  price?: number;
  delivery_weight?: number;
  item_types?: string[];
  status?: string;
  completed?: boolean;
};

type RiderDataContextType = {
  // VRP Trip State
  activeTrip: VRPTrip | null;
  setActiveTrip: React.Dispatch<React.SetStateAction<VRPTrip | null>>;
  loadingTrip: boolean;
  refreshActiveTrip: (riderId: string, email?: string) => Promise<VRPTrip | null>;
  checkIsTripStartedToday: (riderId: string) => Promise<boolean>;
  
  // Legacy / Filtered Lists
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
  const [activeTrip, setActiveTrip] = useState<VRPTrip | null>(null);
  const [loadingTrip, setLoadingTrip] = useState<boolean>(false);
  const [pickups, setPickups] = useState<Pickup[]>([]);
  const [deliveries, setDeliveries] = useState<Delivery[]>([]);

  const refreshActiveTrip = useCallback(async (riderId: string, email?: string) => {
    if (!riderId) return null;
    setLoadingTrip(true);
    try {
      const trip = await vrpTripService.getAssignedTrip(riderId, email);
      setActiveTrip(trip);

      if (trip && trip.stops) {
        // Map VRP stops to Pickups state
        const tripPickups: Pickup[] = trip.stops
          .filter((s) => s.type === "pickup")
          .map((s) => ({
            _id: s.id,
            Name: s.name,
            Address: s.address || `Stop #${s.index} Location`,
            item_types: s.item_types,
            price: s.price,
            status: s.status,
            completed: s.completed,
          }));
        setPickups(tripPickups);

        // Map VRP stops to Deliveries state
        const tripDeliveries: Delivery[] = trip.stops
          .filter((s) => s.type === "delivery")
          .map((s) => ({
            id: s.id,
            orderId: s.id,
            name: s.name,
            address: s.address || `Stop #${s.index} Delivery Point`,
            lat: s.lat,
            lng: s.lng,
            price: s.price,
            delivery_weight: s.delivery_weight,
            item_types: s.item_types,
            status: s.status,
            completed: s.completed,
          }));
        setDeliveries(tripDeliveries);
      }
      return trip;
    } catch (e) {
      console.error("refreshActiveTrip error:", e);
      return null;
    } finally {
      setLoadingTrip(false);
    }
  }, []);

  const checkIsTripStartedToday = useCallback(async (riderId: string): Promise<boolean> => {
    if (!riderId) return false;
    try {
      const res = await fetch(`${API_V1_BASE_URL}/shifts/active/${riderId}`);
      if (!res.ok) return false;
      const json = await res.json();
      return Boolean(json.hasActiveTrip && json.trip);
    } catch (e) {
      console.warn("checkIsTripStartedToday error:", e);
      return false;
    }
  }, []);

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
        activeTrip,
        setActiveTrip,
        loadingTrip,
        refreshActiveTrip,
        checkIsTripStartedToday,
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
