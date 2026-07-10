const trimTrailingSlash = (value: string) => value.replace(/\/+$/, "");

export const API_BASE_URL = trimTrailingSlash(
  process.env.EXPO_PUBLIC_API_BASE_URL || "https://api.shiptos.com",
);

export const API_V1_BASE_URL = `${API_BASE_URL}/api/v1`;
