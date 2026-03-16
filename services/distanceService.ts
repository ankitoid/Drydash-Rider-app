import axios from "axios";

const API_BASE_URL = "https://api.drydash.in";

export const getBatchDistances = async (
  origin: { lat: number; lng: number },
  destinations: { id: string; lat: number; lng: number }[],
) => {
  try {
    const response = await axios.post(
      `${API_BASE_URL}/api/v1/osrm/batch-distances`,
      { origin, destinations },
      { timeout: 15000 },
    );

    if (response.data?.success) {
      return response.data.data;
    }

    return [];
  } catch (error) {
    console.error("Distance API error:", error);
    return [];
  }
};
