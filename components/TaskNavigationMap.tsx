import { useTheme } from "@/context/ThemeContext";
import { promptBatteryOptimization } from "@/services/batteryOptimization";
import { locationService } from "@/services/locationService";
import { socket } from "@/services/socket";
import {
  TrackingCoordinate,
  TrackingLegType,
  getDistanceKm,
  trackingLegService,
} from "@/services/trackingLegService";
import { Ionicons } from "@expo/vector-icons";
import Constants from "expo-constants";
import * as Haptics from "expo-haptics";
import * as Location from "expo-location";
import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Platform,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import MapView, { Marker, Polyline, PROVIDER_GOOGLE } from "react-native-maps";

type Props = {
  taskId: string;
  taskType: TrackingLegType;
  rider?: {
    _id?: string;
    name?: string;
    phone?: string;
  } | null;
  destination?: TrackingCoordinate | null;
  destinationLabel?: string;
  onReached?: () => void;
};

type DirectionStep = {
  instruction: string;
  distanceText?: string;
  durationText?: string;
  maneuver?: string;
  startLocation: TrackingCoordinate;
  endLocation: TrackingCoordinate;
};

type RouteInfo = {
  coordinates: TrackingCoordinate[];
  distanceText?: string;
  durationText?: string;
  steps: DirectionStep[];
  mode: "two_wheeler" | "driving";
};

type RouteArrow = {
  coordinate: TrackingCoordinate;
  rotation: number;
};

const GOOGLE_DIRECTIONS_KEY =
  Constants.expoConfig?.android?.config?.googleMaps?.apiKey ||
  (Constants.expoConfig?.extra?.googleMapsDirectionsApiKey as string) ||
  "";
const API_BASE = "https://api.shiptos.com/api/v1";

const OFF_ROUTE_THRESHOLD_METERS = 250;
const REROUTE_COOLDOWN_MS = 120000;

const MANEUVER_ICON: Record<string, keyof typeof Ionicons.glyphMap> = {
  "turn-left": "arrow-back",
  "turn-right": "arrow-forward",
  "turn-slight-left": "return-up-back",
  "turn-slight-right": "return-up-forward",
  "turn-sharp-left": "arrow-undo",
  "turn-sharp-right": "arrow-redo",
  "uturn-left": "arrow-undo",
  "uturn-right": "arrow-redo",
  merge: "git-merge-outline",
  "fork-left": "git-branch-outline",
  "fork-right": "git-branch-outline",
  "ramp-left": "return-down-back",
  "ramp-right": "return-down-forward",
  "roundabout-left": "refresh-outline",
  "roundabout-right": "refresh-outline",
  TURN_LEFT: "arrow-back",
  TURN_RIGHT: "arrow-forward",
  TURN_SLIGHT_LEFT: "return-up-back",
  TURN_SLIGHT_RIGHT: "return-up-forward",
  TURN_SHARP_LEFT: "arrow-undo",
  TURN_SHARP_RIGHT: "arrow-redo",
  STRAIGHT: "arrow-up",
  DEPART: "navigate-outline",
  ARRIVE: "location",
};

const getManeuverIcon = (maneuver?: string): keyof typeof Ionicons.glyphMap => {
  const icon = maneuver ? MANEUVER_ICON[maneuver] : undefined;
  return icon ?? "navigate-circle-outline";
};

// ─── Helpers ──────────────────────────────────────────────────────────────────
const stripHtml = (value: string) =>
  value
    .replace(/<[^>]*>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/\s+/g, " ")
    .trim();

const decodePolyline = (encoded: string): TrackingCoordinate[] => {
  const points: TrackingCoordinate[] = [];
  let index = 0;
  let lat = 0;
  let lng = 0;

  while (index < encoded.length) {
    let b;
    let shift = 0;
    let result = 0;
    do {
      b = encoded.charCodeAt(index++) - 63;
      result |= (b & 0x1f) << shift;
      shift += 5;
    } while (b >= 0x20);
    const dLat = result & 1 ? ~(result >> 1) : result >> 1;
    lat += dLat;
    shift = 0;
    result = 0;
    do {
      b = encoded.charCodeAt(index++) - 63;
      result |= (b & 0x1f) << shift;
      shift += 5;
    } while (b >= 0x20);
    const dLng = result & 1 ? ~(result >> 1) : result >> 1;
    lng += dLng;
    points.push({ latitude: lat / 1e5, longitude: lng / 1e5 });
  }

  return points;
};

const distanceToSegmentMeters = (
  point: TrackingCoordinate,
  start: TrackingCoordinate,
  end: TrackingCoordinate,
) => {
  const dx = end.longitude - start.longitude;
  const dy = end.latitude - start.latitude;
  if (dx === 0 && dy === 0) return getDistanceKm(point, start) * 1000;
  const t = Math.max(
    0,
    Math.min(
      1,
      ((point.longitude - start.longitude) * dx + (point.latitude - start.latitude) * dy) /
        (dx * dx + dy * dy),
    ),
  );
  return (
    getDistanceKm(point, {
      latitude: start.latitude + t * dy,
      longitude: start.longitude + t * dx,
    }) * 1000
  );
};

const distanceToRouteMeters = (
  point: TrackingCoordinate,
  route: TrackingCoordinate[],
) => {
  if (route.length < 2) return Number.POSITIVE_INFINITY;
  let min = Number.POSITIVE_INFINITY;
  for (let i = 0; i < route.length - 1; i += 1)
    min = Math.min(min, distanceToSegmentMeters(point, route[i], route[i + 1]));
  return min;
};

const toCoordinate = (value: any): TrackingCoordinate => ({
  latitude: value.lat,
  longitude: value.lng,
});

const toRoutesCoordinate = (value: any): TrackingCoordinate => ({
  latitude: value?.latLng?.latitude ?? value?.latitude,
  longitude: value?.latLng?.longitude ?? value?.longitude,
});

const formatDistance = (meters?: number) => {
  if (!Number.isFinite(meters)) return undefined;
  if ((meters as number) >= 1000)
    return `${((meters as number) / 1000).toFixed(1)} km`;
  return `${Math.round(meters as number)} m`;
};

const formatDuration = (value?: string) => {
  const seconds = Number(value?.replace("s", "") ?? NaN);
  if (!Number.isFinite(seconds)) return undefined;
  const minutes = Math.max(1, Math.round(seconds / 60));
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  const rem = minutes % 60;
  return rem ? `${hours} hr ${rem} min` : `${hours} hr`;
};

const pickBestRoute = (routes: any[]) =>
  [...routes].sort((a, b) => {
    const dA = Number(String(a.duration ?? "").replace("s", "")) || Infinity;
    const dB = Number(String(b.duration ?? "").replace("s", "")) || Infinity;
    if (dA !== dB) return dA - dB;
    return (a.distanceMeters ?? Infinity) - (b.distanceMeters ?? Infinity);
  })[0];

const getBearing = (from: TrackingCoordinate, to: TrackingCoordinate) => {
  const toRad = (v: number) => (v * Math.PI) / 180;
  const toDeg = (v: number) => (v * 180) / Math.PI;
  const startLat = toRad(from.latitude);
  const endLat = toRad(to.latitude);
  const deltaLng = toRad(to.longitude - from.longitude);
  const y = Math.sin(deltaLng) * Math.cos(endLat);
  const x =
    Math.cos(startLat) * Math.sin(endLat) -
    Math.sin(startLat) * Math.cos(endLat) * Math.cos(deltaLng);
  return (toDeg(Math.atan2(y, x)) + 360) % 360;
};

const buildRouteArrows = (coordinates: TrackingCoordinate[]) => {
  const arrows: RouteArrow[] = [];
  if (coordinates.length < 2) return arrows;
  let distanceSinceArrow = 0;
  for (let i = 0; i < coordinates.length - 1; i += 1) {
    const from = coordinates[i];
    const to = coordinates[i + 1];
    distanceSinceArrow += getDistanceKm(from, to) * 1000;
    if (distanceSinceArrow >= 350) {
      arrows.push({ coordinate: to, rotation: getBearing(from, to) });
      distanceSinceArrow = 0;
    }
  }
  return arrows.slice(0, 18);
};

type CacheEntry = {
  route: RouteInfo;
  timestamp: number;
};
const routeCache = new Map<string, CacheEntry>();
const CACHE_TTL_MS = 60 * 60 * 1000;

// ─── Component ────────────────────────────────────────────────────────────────
export const TaskNavigationMap = ({
  taskId,
  taskType,
  rider,
  destination,
  destinationLabel,
  onReached,
}: Props) => {
  const { theme, isDark } = useTheme();
  const mapRef = useRef<MapView>(null);
  const lastRouteFetchRef = useRef(0);
  const pendingRoutePromise = useRef<Promise<void> | null>(null);
  const lastRerouteCheckRef = useRef(0);

  const [currentLocation, setCurrentLocation] = useState<TrackingCoordinate | null>(null);
  const [currentHeading, setCurrentHeading] = useState(0);
  const [route, setRoute] = useState<RouteInfo | null>(null);
  const [routeStatus, setRouteStatus] = useState<
    "idle" | "loading" | "rerouting" | "unavailable"
  >("idle");
  const [active, setActive] = useState(false);
  const [distanceKm, setDistanceKm] = useState(0);
  const [loading, setLoading] = useState(false);
  const [pendingFinish, setPendingFinish] = useState<{ message: string; onConfirm: () => void } | null>(null);

  const fitMap = useCallback((origin: TrackingCoordinate, target: TrackingCoordinate) => {
    mapRef.current?.fitToCoordinates([origin, target], {
      edgePadding: { top: 80, right: 60, bottom: 80, left: 60 },
      animated: true,
    });
  }, []);

  const focusOnRider = useCallback(
    (coords: TrackingCoordinate, heading = currentHeading) => {
      mapRef.current?.animateCamera(
        { center: coords, heading, pitch: 30, zoom: 17 },
        { duration: 650 },
      );
    },
    [currentHeading],
  );

  const fetchRoute = useCallback(
    async (origin: TrackingCoordinate, reason: "initial" | "reroute") => {
      if (!destination) return;
      if (!GOOGLE_DIRECTIONS_KEY || GOOGLE_DIRECTIONS_KEY.startsWith("ADD_")) {
        setRoute(null);
        setRouteStatus("unavailable");
        return;
      }

      const distanceToDestMeters = getDistanceKm(origin, destination) * 1000;
      if (distanceToDestMeters < 500) {
        setRoute(null);
        setRouteStatus("idle");
        return;
      }

      const cacheKey = `${origin.latitude},${origin.longitude}|${destination.latitude},${destination.longitude}`;
      const cached = routeCache.get(cacheKey);
      if (cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
        setRoute(cached.route);
        setRouteStatus("idle");
        lastRouteFetchRef.current = Date.now();
        return;
      }

      if (pendingRoutePromise.current) {
        await pendingRoutePromise.current;
        return;
      }

      setRouteStatus(reason === "reroute" ? "rerouting" : "loading");

      pendingRoutePromise.current = (async () => {
        try {
          const routesRes = await fetch(
            "https://routes.googleapis.com/directions/v2:computeRoutes",
            {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                "X-Goog-Api-Key": GOOGLE_DIRECTIONS_KEY,
                "X-Goog-FieldMask":
                  "routes.distanceMeters,routes.duration,routes.polyline.encodedPolyline,routes.legs.steps.distanceMeters,routes.legs.steps.staticDuration,routes.legs.steps.navigationInstruction,routes.legs.steps.startLocation,routes.legs.steps.endLocation",
              },
              body: JSON.stringify({
                origin: {
                  location: {
                    latLng: { latitude: origin.latitude, longitude: origin.longitude },
                  },
                },
                destination: {
                  location: {
                    latLng: { latitude: destination.latitude, longitude: destination.longitude },
                  },
                },
                travelMode: "TWO_WHEELER",
                routingPreference: "TRAFFIC_AWARE",
                computeAlternativeRoutes: true,
                polylineQuality: "OVERVIEW",
                polylineEncoding: "ENCODED_POLYLINE",
                languageCode: "en-IN",
                units: "METRIC",
              }),
            },
          );
          const routesJson = await routesRes.json().catch(() => null);
          const bestTwoWheelerRoute = pickBestRoute(routesJson?.routes ?? []);
          const twoWheelerPolyline = bestTwoWheelerRoute?.polyline?.encodedPolyline;
          const twoWheelerSteps = bestTwoWheelerRoute?.legs?.[0]?.steps ?? [];

          if (twoWheelerPolyline && twoWheelerSteps.length) {
            const steps: DirectionStep[] = twoWheelerSteps.map((step: any) => ({
              instruction:
                step.navigationInstruction?.instructions ||
                step.navigationInstruction?.maneuver ||
                "Continue",
              distanceText: formatDistance(step.distanceMeters),
              durationText: formatDuration(step.staticDuration),
              maneuver: step.navigationInstruction?.maneuver,
              startLocation: toRoutesCoordinate(step.startLocation),
              endLocation: toRoutesCoordinate(step.endLocation),
            }));
            const newRoute: RouteInfo = {
              coordinates: decodePolyline(twoWheelerPolyline),
              distanceText: formatDistance(bestTwoWheelerRoute.distanceMeters),
              durationText: formatDuration(bestTwoWheelerRoute.duration),
              steps,
              mode: "two_wheeler",
            };
            setRoute(newRoute);
            routeCache.set(cacheKey, { route: newRoute, timestamp: Date.now() });
            setRouteStatus("idle");
            lastRouteFetchRef.current = Date.now();
            return;
          }

          const originParam = `${origin.latitude},${origin.longitude}`;
          const destParam = `${destination.latitude},${destination.longitude}`;
          const url =
            "https://maps.googleapis.com/maps/api/directions/json" +
            `?origin=${originParam}&destination=${destParam}` +
            `&mode=driving&alternatives=true&departure_time=now&traffic_model=best_guess&key=${GOOGLE_DIRECTIONS_KEY}`;
          const res = await fetch(url);
          const json = await res.json();
          const firstRoute = [...(json.routes ?? [])].sort((a: any, b: any) => {
            const legA = a.legs?.[0];
            const legB = b.legs?.[0];
            const dA = legA?.duration_in_traffic?.value ?? legA?.duration?.value ?? Infinity;
            const dB = legB?.duration_in_traffic?.value ?? legB?.duration?.value ?? Infinity;
            if (dA !== dB) return dA - dB;
            return (legA?.distance?.value ?? Infinity) - (legB?.distance?.value ?? Infinity);
          })[0];
          const leg = firstRoute?.legs?.[0];
          const polyline = firstRoute?.overview_polyline?.points;

          if (!polyline || !leg?.steps?.length) {
            setRoute(null);
            setRouteStatus("unavailable");
            return;
          }

          const steps: DirectionStep[] = leg.steps.map((step: any) => ({
            instruction: stripHtml(step.html_instructions || "Continue"),
            distanceText: step.distance?.text,
            durationText: step.duration?.text,
            maneuver: step.maneuver,
            startLocation: toCoordinate(step.start_location),
            endLocation: toCoordinate(step.end_location),
          }));
          const fallbackRoute: RouteInfo = {
            coordinates: decodePolyline(polyline),
            distanceText: leg.distance?.text,
            durationText: leg.duration_in_traffic?.text ?? leg.duration?.text,
            steps,
            mode: "driving",
          };
          setRoute(fallbackRoute);
          routeCache.set(cacheKey, { route: fallbackRoute, timestamp: Date.now() });
          setRouteStatus("idle");
          lastRouteFetchRef.current = Date.now();
        } catch (err) {
          console.warn("Failed to load directions route", err);
          setRoute(null);
          setRouteStatus("unavailable");
        } finally {
          pendingRoutePromise.current = null;
        }
      })();

      await pendingRoutePromise.current;
    },
    [destination],
  );

  const getNextStep = useCallback(() => {
    if (!route?.steps?.length || !currentLocation) return null;
    return (
      route.steps.find(
        (step) => getDistanceKm(currentLocation, step.endLocation) * 1000 > 70,
      ) ?? route.steps[route.steps.length - 1]
    );
  }, [currentLocation, route?.steps]);

  const checkReroute = useCallback(
    (coords: TrackingCoordinate) => {
      if (!active || !route?.coordinates?.length) return;
      const now = Date.now();
      if (now - lastRerouteCheckRef.current < 15000) return;
      lastRerouteCheckRef.current = now;

      const distanceFromRoute = distanceToRouteMeters(coords, route.coordinates);
      const canReroute = now - lastRouteFetchRef.current > REROUTE_COOLDOWN_MS;
      if (distanceFromRoute > OFF_ROUTE_THRESHOLD_METERS && canReroute)
        fetchRoute(coords, "reroute");
    },
    [active, fetchRoute, route?.coordinates],
  );

  useEffect(() => {
    let mounted = true;
    let sub: Location.LocationSubscription | null = null;

    const loadLocation = async () => {
      const permission = await Location.requestForegroundPermissionsAsync();
      if (permission.status !== "granted") return;

      const lastKnown = await Location.getLastKnownPositionAsync();
      if (mounted && lastKnown?.coords) {
        setCurrentLocation({
          latitude: lastKnown.coords.latitude,
          longitude: lastKnown.coords.longitude,
        });
      }

      const current = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });
      if (mounted) {
        setCurrentLocation({
          latitude: current.coords.latitude,
          longitude: current.coords.longitude,
        });
        setCurrentHeading(current.coords.heading ?? 0);
      }

      sub = await Location.watchPositionAsync(
        { accuracy: Location.Accuracy.Balanced, distanceInterval: 20, timeInterval: 8000 },
        async (location) => {
          const coords = {
            latitude: location.coords.latitude,
            longitude: location.coords.longitude,
          };
          setCurrentLocation(coords);
          if (location.coords.heading != null) setCurrentHeading(location.coords.heading);
          if (active) focusOnRider(coords, location.coords.heading ?? currentHeading);
          checkReroute(coords);

          const leg = await trackingLegService.getActiveLeg();
          if (leg?.taskId === taskId) {
            setActive(true);
            setDistanceKm(leg.totalDistanceKm);
          }
        },
      );
    };

    loadLocation();
    return () => {
      mounted = false;
      sub?.remove();
    };
  }, [active, checkReroute, currentHeading, focusOnRider, taskId]);

  useEffect(() => {
    if (!currentLocation || !destination) return;
    if (active) focusOnRider(currentLocation);
    else fitMap(currentLocation, destination);
    if (!route && routeStatus === "idle") fetchRoute(currentLocation, "initial");
  }, [active, currentLocation, destination, fetchRoute, fitMap, focusOnRider, route, routeStatus]);

  useEffect(() => {
    const syncActiveLeg = async () => {
      const leg = await trackingLegService.getActiveLeg();
      if (leg?.taskId === taskId) {
        setActive(true);
        setDistanceKm(leg.totalDistanceKm);
      }
    };
    syncActiveLeg();
    const id = setInterval(syncActiveLeg, 15000);
    return () => clearInterval(id);
  }, [taskId]);

  const saveAndSwitch = async (existingLeg: any) => {
    if (!rider?._id || !destination || !currentLocation) {
      Alert.alert("Location unavailable", "Please wait for location to load.");
      return;
    }
    setLoading(true);
    try {
      const completed = await trackingLegService.completeActiveLeg(
        currentLocation ?? undefined,
      );
      await locationService.stopTracking();
      socket.emit("taskNavigationEnded", {
        riderId: rider._id,
        trackingLegId: completed?.id,
        taskId: existingLeg.taskId,
        taskType: existingLeg.type,
        totalDistanceKm: completed?.totalDistanceKm ?? existingLeg.totalDistanceKm,
      });

      if (completed?.id) {
        fetch(`${API_BASE}/location/tracking/complete`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            riderId: rider._id,
            trackingLegId: completed.id,
            taskId: existingLeg.taskId,
            taskType: existingLeg.type,
            totalDistanceKm: completed.totalDistanceKm,
            endLocation: completed.endLocation ?? currentLocation,
          }),
        }).catch((httpErr) => {
          console.warn("Tracking completion sync failed", httpErr);
        });
      }

      const batteryPrompted = await AsyncStorage.getItem("battery_opt_prompted");
      if (Platform.OS === "android" && !batteryPrompted) {
        await promptBatteryOptimization();
        await AsyncStorage.setItem("battery_opt_prompted", "true");
      }

      await locationService.updateConfig({ updateInterval: 120000, distanceFilter: 50 });
      await locationService.setCachedUser(rider);
      const leg = await trackingLegService.startLeg({
        taskId,
        riderId: rider._id,
        type: taskType,
        destination,
        destinationLabel,
        startLocation: currentLocation,
      });
      await locationService.startTracking();
      await fetchRoute(currentLocation, "initial");
      focusOnRider(currentLocation);
      socket.emit("taskNavigationStarted", {
        riderId: rider._id,
        trackingLegId: leg.id,
        taskId,
        taskType,
        destination,
      });
      setActive(true);
      setDistanceKm(0);
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    } catch (err) {
      console.error("Save and switch navigation failed", err);
      Alert.alert("Tracking Error", "Could not switch navigation tasks.");
    } finally {
      setLoading(false);
    }
  };

  const startNavigation = async () => {
    if (!rider?._id || !destination || !currentLocation) {
      Alert.alert("Location unavailable", "Please wait for location to load.");
      return;
    }
    setLoading(true);
    try {
      const permissionState = await locationService.checkPermissions();
      if (permissionState === "foreground") {
        const granted = await locationService.requestBackgroundPermission();
        if (!granted) {
          Alert.alert(
            "Background location needed",
            "Allow background location so KM can be counted while the phone is locked.",
          );
          return;
        }
      }

      const existingLeg = await trackingLegService.getActiveLeg();
      if (existingLeg) {
        if (existingLeg.taskId !== taskId || existingLeg.type !== taskType) {
          Alert.alert(
            "Navigation already active",
            "Another task is already being tracked. Do you want to switch to this task? This will save the distance travelled for the current active task.",
            [
              { text: "Cancel", style: "cancel" },
              {
                text: "Switch Task",
                onPress: () => {
                  saveAndSwitch(existingLeg);
                },
              },
            ],
            { cancelable: true }
          );
          return;
        }

        await locationService.setCachedUser(rider);
        await locationService.startTracking();
        await fetchRoute(currentLocation, "initial");
        setActive(true);
        setDistanceKm(existingLeg.totalDistanceKm);
        focusOnRider(currentLocation);
        return;
      }

      const batteryPrompted = await AsyncStorage.getItem("battery_opt_prompted");
      if (Platform.OS === "android" && !batteryPrompted) {
        await promptBatteryOptimization();
        await AsyncStorage.setItem("battery_opt_prompted", "true");
      }

      await locationService.updateConfig({ updateInterval: 120000, distanceFilter: 50 });
      await locationService.setCachedUser(rider);
      const leg = await trackingLegService.startLeg({
        taskId,
        riderId: rider._id,
        type: taskType,
        destination,
        destinationLabel,
        startLocation: currentLocation,
      });
      await locationService.startTracking();
      await fetchRoute(currentLocation, "initial");
      focusOnRider(currentLocation);
      socket.emit("taskNavigationStarted", {
        riderId: rider._id,
        trackingLegId: leg.id,
        taskId,
        taskType,
        destination,
      });
      setActive(true);
      setDistanceKm(0);
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    } catch (err) {
      console.error("Start navigation failed", err);
      Alert.alert("Tracking Error", "Could not start task navigation.");
    } finally {
      setLoading(false);
    }
  };

  const completeNavigation = async () => {
    if (!active) return;

    const remainingMeters =
      currentLocation && destination
        ? getDistanceKm(currentLocation, destination) * 1000
        : 0;

    const finish = async () => {
      setPendingFinish(null);
      setLoading(true);
      try {
        const completed = await trackingLegService.completeActiveLeg(
          currentLocation ?? undefined,
        );
        await locationService.stopTracking();
        socket.emit("taskNavigationEnded", {
          riderId: rider?._id,
          trackingLegId: completed?.id,
          taskId,
          taskType,
          totalDistanceKm: completed?.totalDistanceKm ?? distanceKm,
        });
        if (completed?.id) {
          fetch(`${API_BASE}/location/tracking/complete`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              riderId: rider?._id,
              trackingLegId: completed.id,
              taskId,
              taskType,
              totalDistanceKm: completed.totalDistanceKm,
              endLocation: completed.endLocation ?? currentLocation,
            }),
          }).catch((httpErr) => {
            console.warn("Tracking completion sync failed", httpErr);
          });
        }
        setActive(false);
        setDistanceKm(completed?.totalDistanceKm ?? distanceKm);
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        onReached?.();
      } catch (err) {
        console.error("Complete navigation failed", err);
        Alert.alert("Tracking Error", "Could not save task distance.");
      } finally {
        setLoading(false);
      }
    };

    if (remainingMeters > 300) {
      setPendingFinish({
        message: `~${Math.round(remainingMeters)}m away. Complete anyway?`,
        onConfirm: finish,
      });
      return;
    }

    finish();
  };

  if (!destination) {
    return (
      <View style={[styles.card, { backgroundColor: theme.card }]}>
        <Text style={[styles.title, { color: theme.text }]}>Navigation</Text>
        <Text style={[styles.muted, { color: theme.subText }]}>
          Destination location is not available for this task.
        </Text>
      </View>
    );
  }

  const nextStep = getNextStep();
  const polyline = route?.coordinates ?? [];
  const routeArrows = buildRouteArrows(polyline);
  const isLoadingRoute = routeStatus === "loading" || routeStatus === "rerouting";
  const routeSubtitle = isLoadingRoute
    ? routeStatus === "rerouting"
      ? "Rerouting..."
      : "Loading road route..."
    : route?.distanceText
      ? `${route.mode === "two_wheeler" ? "Bike route" : "Car route fallback"} • ${route.distanceText} • ${route.durationText ?? ""}`
      : "Road route unavailable";

  return (
    <View
      style={[styles.card, { backgroundColor: theme.card, borderColor: theme.border }]}
    >
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerCopy}>
          <Text style={[styles.title, { color: theme.text }]}>Navigation</Text>
          <View style={styles.subtitleRow}>
            {isLoadingRoute && (
              <ActivityIndicator
                size="small"
                color={theme.subText}
                style={styles.subtitleSpinner}
              />
            )}
            <Text style={[styles.muted, { color: theme.subText }]} numberOfLines={1}>
              {routeSubtitle}
            </Text>
          </View>
        </View>
        <View
          style={[
            styles.badge,
            { backgroundColor: active ? "#DCFCE7" : theme.primarySoft },
          ]}
        >
          <Text
            style={[styles.badgeText, { color: active ? "#15803D" : theme.primary }]}
          >
            {active ? `${distanceKm.toFixed(2)} km` : "Ready"}
          </Text>
        </View>
      </View>

      {/* Turn card */}
      {nextStep && (
        <View
          style={[
            styles.turnCard,
            { backgroundColor: theme.background, borderColor: theme.border },
          ]}
        >
          <Ionicons
            name={getManeuverIcon(nextStep.maneuver)}
            size={24}
            color={theme.primary}
          />
          <View style={styles.turnCopy}>
            <Text style={[styles.turnInstruction, { color: theme.text }]}>
              {nextStep.instruction}
            </Text>
            <Text style={[styles.muted, { color: theme.subText }]}>
              {nextStep.distanceText}
              {nextStep.durationText ? ` • ${nextStep.durationText}` : ""}
            </Text>
          </View>
        </View>
      )}

      {/* Map */}
      <View style={styles.mapWrap}>
        {currentLocation ? (
          <>
            <MapView
              ref={mapRef}
              provider={PROVIDER_GOOGLE}
              style={styles.map}
              initialRegion={{
                latitude: currentLocation.latitude,
                longitude: currentLocation.longitude,
                latitudeDelta: 0.02,
                longitudeDelta: 0.02,
              }}
              followsUserLocation={active}
              loadingEnabled
              moveOnMarkerPress={false}
              toolbarEnabled={false}
              showsCompass
              showsTraffic={active}
              showsUserLocation={false}
            >
              {polyline.length > 1 && (
                <>
                  <Polyline
                    coordinates={polyline}
                    strokeColor={isDark ? "#E0F2FE" : "#FFFFFF"}
                    strokeWidth={9}
                  />
                  <Polyline
                    coordinates={polyline}
                    strokeColor="#440DFA"
                    strokeWidth={5}
                  />
                </>
              )}
              {routeArrows.map((arrow, index) => (
                <Marker
                  key={`${arrow.coordinate.latitude}-${arrow.coordinate.longitude}-${index}`}
                  coordinate={arrow.coordinate}
                  anchor={{ x: 0.5, y: 0.5 }}
                  tracksViewChanges={false}
                >
                  <View
                    style={[
                      styles.routeArrow,
                      {
                        backgroundColor: isDark ? "#064E3B" : "#FFFFFF",
                        borderColor: "#2563EB",
                        transform: [{ rotate: `${arrow.rotation}deg` }],
                      },
                    ]}
                  >
                    <Ionicons name="arrow-up" size={14} color="#2563EB" />
                  </View>
                </Marker>
              ))}
              <Marker
                coordinate={destination}
                title={destinationLabel ?? "Destination"}
              >
                <View style={styles.destinationMarker}>
                  <Ionicons name="location" size={22} color="#FFFFFF" />
                </View>
              </Marker>
              <Marker coordinate={currentLocation} anchor={{ x: 0.5, y: 0.5 }}>
                <View
                  style={[
                    styles.riderMarker,
                    {
                      backgroundColor: theme.primary,
                      transform: [{ rotate: `${currentHeading}deg` }],
                    },
                  ]}
                >
                  <Ionicons name="navigate" size={18} color="#fff" />
                </View>
              </Marker>
            </MapView>
            <TouchableOpacity
              style={[styles.recenterBtn, { backgroundColor: theme.card }]}
              onPress={() => focusOnRider(currentLocation)}
              activeOpacity={0.85}
            >
              <Ionicons name="locate-outline" size={20} color={theme.primary} />
            </TouchableOpacity>
            {active && (
              <View style={styles.activePill}>
                <View style={styles.liveDot} />
                <Text style={styles.activePillText}>Tracking task route</Text>
              </View>
            )}
          </>
        ) : (
          <View style={[styles.mapFallback, { backgroundColor: theme.background }]}>
            <ActivityIndicator color={theme.primary} />
            <Text style={[styles.muted, { color: theme.subText }]}>
              Loading location...
            </Text>
          </View>
        )}
      </View>

      {/* Inline confirm — replaces the button when pending, no extra height */}
      {pendingFinish ? (
        <View
          style={[
            styles.confirmStrip,
            { backgroundColor: "#FEF3C7", borderColor: "#FCD34D" },
          ]}
        >
          <Ionicons name="warning-outline" size={16} color="#92400E" style={{ flexShrink: 0 }} />
          <Text style={[styles.confirmText, { color: "#92400E" }]} numberOfLines={2}>
            {pendingFinish.message}
          </Text>
          <TouchableOpacity
            onPress={() => setPendingFinish(null)}
            style={styles.confirmCancelBtn}
            activeOpacity={0.8}
          >
            <Text style={styles.confirmCancelText}>Cancel</Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={pendingFinish.onConfirm}
            style={styles.confirmOkBtn}
            activeOpacity={0.8}
          >
            <Text style={styles.confirmOkText}>Complete</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <TouchableOpacity
          style={[
            styles.primaryBtn,
            { backgroundColor: active ? "#F59E0B" : theme.primary },
          ]}
          onPress={active ? completeNavigation : startNavigation}
          disabled={loading || !currentLocation}
          activeOpacity={0.85}
        >
          {loading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <>
              <Ionicons
                name={active ? "checkmark-done-outline" : "navigate-outline"}
                size={18}
                color="#fff"
              />
              <Text style={styles.primaryText}>
                {active ? "Reached Location" : "Start Navigation"}
              </Text>
            </>
          )}
        </TouchableOpacity>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  card: {
    borderRadius: 8,
    borderWidth: 1,
    padding: 14,
    gap: 12,
  },
  header: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 12,
  },
  headerCopy: { flex: 1 },
  subtitleRow: { flexDirection: "row", alignItems: "center", gap: 4, marginTop: 2 },
  subtitleSpinner: { transform: [{ scale: 0.7 }] },
  title: { fontSize: 16, fontWeight: "800" },
  muted: { fontSize: 12 },
  badge: { borderRadius: 999, paddingHorizontal: 10, paddingVertical: 6 },
  badgeText: { fontSize: 12, fontWeight: "800" },
  turnCard: {
    alignItems: "center",
    borderRadius: 8,
    borderWidth: 1,
    flexDirection: "row",
    gap: 10,
    padding: 12,
  },
  turnCopy: { flex: 1 },
  turnInstruction: { fontSize: 14, fontWeight: "800", lineHeight: 19 },
  mapWrap: {
    borderRadius: 10,
    height: 360,
    overflow: "hidden",
    position: "relative",
  },
  map: { flex: 1 },
  riderMarker: {
    alignItems: "center",
    borderColor: "#FFFFFF",
    borderRadius: 18,
    borderWidth: 2,
    height: 36,
    justifyContent: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    width: 36,
  },
  routeArrow: {
    alignItems: "center",
    borderRadius: 12,
    borderWidth: 1,
    height: 24,
    justifyContent: "center",
    width: 24,
  },
  destinationMarker: {
    alignItems: "center",
    backgroundColor: "#EF4444",
    borderColor: "#FFFFFF",
    borderRadius: 18,
    borderWidth: 2,
    height: 36,
    justifyContent: "center",
    width: 36,
  },
  recenterBtn: {
    alignItems: "center",
    borderRadius: 20,
    bottom: 16,
    elevation: 6,
    height: 40,
    justifyContent: "center",
    position: "absolute",
    right: 16,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    width: 40,
  },
  activePill: {
    alignItems: "center",
    backgroundColor: "rgba(5, 46, 22, 0.9)",
    borderRadius: 999,
    flexDirection: "row",
    gap: 8,
    left: 12,
    paddingHorizontal: 12,
    paddingVertical: 8,
    position: "absolute",
    top: 12,
  },
  activePillText: { color: "#FFFFFF", fontSize: 12, fontWeight: "800" },
  liveDot: { backgroundColor: "#22C55E", borderRadius: 4, height: 8, width: 8 },
  mapFallback: {
    alignItems: "center",
    flex: 1,
    gap: 8,
    justifyContent: "center",
  },
  // Confirm strip swaps in place of the primary button — same minHeight
  confirmStrip: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 8,
    borderWidth: 1,
    gap: 8,
    minHeight: 48,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  confirmText: { flex: 1, fontSize: 12, lineHeight: 16 },
  confirmCancelBtn: { paddingHorizontal: 8, paddingVertical: 4 },
  confirmCancelText: { fontSize: 13, fontWeight: "700", color: "#92400E" },
  confirmOkBtn: {
    backgroundColor: "#F59E0B",
    borderRadius: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  confirmOkText: { fontSize: 13, fontWeight: "700", color: "#fff" },
  primaryBtn: {
    alignItems: "center",
    borderRadius: 8,
    flexDirection: "row",
    gap: 8,
    justifyContent: "center",
    minHeight: 48,
    paddingHorizontal: 16,
  },
  primaryText: { color: "#fff", fontSize: 15, fontWeight: "800" },
});
