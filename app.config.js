module.exports = ({ config }) => {
  const googleMapsApiKey =
    process.env.GOOGLE_MAPS_API_KEY ||
    process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY ||
    "";

  // Create the base config structure if it doesn't exist
  const android = config.android || {};
  const androidConfig = android.config || {};
  const extra = config.extra || {};

  const updatedConfig = {
    ...config,
    android: {
      ...android,
      config: {
        ...androidConfig,
      },
    },
    extra: {
      ...extra,
    },
  };

  // Only configure googleMaps if the API key is not empty to avoid startup crashes
  if (googleMapsApiKey) {
    updatedConfig.android.config.googleMaps = {
      ...androidConfig.googleMaps,
      apiKey: googleMapsApiKey,
    };
    updatedConfig.extra.googleMapsDirectionsApiKey = googleMapsApiKey;
  }

  return updatedConfig;
};

