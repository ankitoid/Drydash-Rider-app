import { Alert, Linking, Platform } from "react-native";

/**
 * Open Google Maps / Native Maps app for turn-by-turn navigation from rider's current location
 */
export const openMapsNavigation = async (
  lat?: number,
  lng?: number,
  address?: string,
  label?: string
) => {
  let url = "";

  if (lat && lng && lat !== 0 && lng !== 0) {
    if (Platform.OS === "android") {
      url = `google.navigation:q=${lat},${lng}`;
    } else if (Platform.OS === "ios") {
      url = `maps://app?daddr=${lat},${lng}&dirflg=d`;
    } else {
      url = `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}&travelmode=driving`;
    }
  } else if (address && address.trim().length > 0) {
    const encodedAddress = encodeURIComponent(address.trim());
    url = `https://www.google.com/maps/search/?api=1&query=${encodedAddress}`;
  } else {
    Alert.alert(
      "Navigation Unavailable",
      "Location coordinates or address are missing for this task."
    );
    return;
  }

  try {
    const supported = await Linking.canOpenURL(url);
    if (supported) {
      await Linking.openURL(url);
    } else {
      // Fallback web URL
      const webUrl =
        lat && lng && lat !== 0 && lng !== 0
          ? `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}&travelmode=driving`
          : `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
              address || ""
            )}`;
      await Linking.openURL(webUrl);
    }
  } catch (error) {
    const webUrl =
      lat && lng && lat !== 0 && lng !== 0
        ? `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}&travelmode=driving`
        : `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
            address || ""
          )}`;
    Linking.openURL(webUrl).catch(() => {
      Alert.alert("Error", "Could not open maps application.");
    });
  }
};
