import AsyncStorage from "@react-native-async-storage/async-storage";
import type * as Location from "expo-location";

export type TrackingLegType = "pickup" | "delivery" | "return_to_plant";

export type TrackingCoordinate = {
  latitude: number;
  longitude: number;
};

export type TrackingLeg = {
  id: string;
  taskId: string;
  riderId: string;
  type: TrackingLegType;
  destination: TrackingCoordinate;
  destinationLabel?: string;
  startedAt: string;
  endedAt?: string;
  status: "active" | "completed";
  startLocation?: TrackingCoordinate;
  endLocation?: TrackingCoordinate;
  lastLocation?: TrackingCoordinate;
  totalDistanceKm: number;
  pointsCount: number;
};

type RecordLocationResult = {
  leg: TrackingLeg | null;
  distanceFromPreviousKm: number;
};

const ACTIVE_LEG_KEY = "active_tracking_leg_v1";
const COMPLETED_LEGS_KEY = "completed_tracking_legs_v1";
const DAILY_DISTANCE_PREFIX = "daily_task_distance_km_";

const toDateKey = (date = new Date()) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

const toCoordinate = (
  location: Location.LocationObject | TrackingCoordinate,
): TrackingCoordinate => {
  if ("coords" in location) {
    return {
      latitude: location.coords.latitude,
      longitude: location.coords.longitude,
    };
  }

  return location;
};

export const getDistanceKm = (
  from: TrackingCoordinate,
  to: TrackingCoordinate,
) => {
  const radiusKm = 6371;
  const toRad = (value: number) => (value * Math.PI) / 180;
  const dLat = toRad(to.latitude - from.latitude);
  const dLon = toRad(to.longitude - from.longitude);
  const lat1 = toRad(from.latitude);
  const lat2 = toRad(to.latitude);

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1) *
      Math.cos(lat2) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);

  return 2 * radiusKm * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
};

class TrackingLegService {
  async startLeg(params: {
    taskId: string;
    riderId: string;
    type: TrackingLegType;
    destination: TrackingCoordinate;
    destinationLabel?: string;
    startLocation?: TrackingCoordinate;
  }) {
    const activeLeg = await this.getActiveLeg();
    if (activeLeg) {
      if (activeLeg.taskId === params.taskId && activeLeg.type === params.type) {
        return activeLeg;
      }

      throw new Error("Another task navigation is already active");
    }

    const now = new Date().toISOString();
    const leg: TrackingLeg = {
      id: `${params.type}_${params.taskId}_${Date.now()}`,
      taskId: params.taskId,
      riderId: params.riderId,
      type: params.type,
      destination: params.destination,
      destinationLabel: params.destinationLabel,
      startedAt: now,
      status: "active",
      startLocation: params.startLocation,
      lastLocation: params.startLocation,
      totalDistanceKm: 0,
      pointsCount: params.startLocation ? 1 : 0,
    };

    await AsyncStorage.setItem(ACTIVE_LEG_KEY, JSON.stringify(leg));
    return leg;
  }

  async getActiveLeg(): Promise<TrackingLeg | null> {
    const raw = await AsyncStorage.getItem(ACTIVE_LEG_KEY);
    if (!raw) return null;

    try {
      const leg = JSON.parse(raw) as TrackingLeg;
      return leg.status === "active" ? leg : null;
    } catch {
      return null;
    }
  }

  async recordLocation(
    location: Location.LocationObject,
  ): Promise<RecordLocationResult> {
    const leg = await this.getActiveLeg();
    if (!leg) return { leg: null, distanceFromPreviousKm: 0 };

    const coords = toCoordinate(location);
    const accuracy = location.coords.accuracy ?? 999;

    let distanceFromPreviousKm = 0;
    if (leg.lastLocation && accuracy <= 100) {
      const candidateDistance = getDistanceKm(leg.lastLocation, coords);
      const timeSinceStartMs =
        Date.now() - new Date(leg.startedAt).getTime();

      // Ignore tiny GPS jitter and impossible large jumps.
      if (candidateDistance >= 0.01 && candidateDistance <= 5) {
        distanceFromPreviousKm = candidateDistance;
      } else if (leg.pointsCount <= 1 && timeSinceStartMs < 180000) {
        distanceFromPreviousKm = 0;
      }
    }

    const nextLeg: TrackingLeg = {
      ...leg,
      startLocation: leg.startLocation ?? coords,
      lastLocation: coords,
      totalDistanceKm: Number(
        (leg.totalDistanceKm + distanceFromPreviousKm).toFixed(3),
      ),
      pointsCount: leg.pointsCount + 1,
    };

    await AsyncStorage.setItem(ACTIVE_LEG_KEY, JSON.stringify(nextLeg));
    return { leg: nextLeg, distanceFromPreviousKm };
  }

  async completeActiveLeg(endLocation?: TrackingCoordinate) {
    const leg = await this.getActiveLeg();
    if (!leg) return null;

    const finalDistanceKm =
      endLocation && leg.lastLocation
        ? getDistanceKm(leg.lastLocation, endLocation)
        : 0;
    const safeFinalDistanceKm =
      finalDistanceKm >= 0.01 && finalDistanceKm <= 25 ? finalDistanceKm : 0;
    const totalDistanceKm = Number(
      (leg.totalDistanceKm + safeFinalDistanceKm).toFixed(3),
    );

    const completed: TrackingLeg = {
      ...leg,
      status: "completed",
      endedAt: new Date().toISOString(),
      endLocation: endLocation ?? leg.lastLocation,
      lastLocation: endLocation ?? leg.lastLocation,
      totalDistanceKm,
      pointsCount: endLocation ? leg.pointsCount + 1 : leg.pointsCount,
    };

    const rawCompleted = await AsyncStorage.getItem(COMPLETED_LEGS_KEY);
    const completedLegs = rawCompleted
      ? (JSON.parse(rawCompleted) as TrackingLeg[])
      : [];

    await AsyncStorage.multiSet([
      [COMPLETED_LEGS_KEY, JSON.stringify([completed, ...completedLegs])],
      [
        DAILY_DISTANCE_PREFIX + toDateKey(),
        String(
          Number(
            (
              (await this.getTodayDistanceKm()) + completed.totalDistanceKm
            ).toFixed(3),
          ),
        ),
      ],
    ]);
    await AsyncStorage.removeItem(ACTIVE_LEG_KEY);

    return completed;
  }

  async cancelActiveLeg() {
    await AsyncStorage.removeItem(ACTIVE_LEG_KEY);
  }

  async getTodayDistanceKm() {
    const raw = await AsyncStorage.getItem(DAILY_DISTANCE_PREFIX + toDateKey());
    return raw ? Number(raw) || 0 : 0;
  }
}

export const trackingLegService = new TrackingLegService();
