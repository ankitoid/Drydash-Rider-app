interface CreateFollowupPickupParams {
  apiBaseUrl?: string;
  orderId: string;
  riderId: string;
  riderName: string;
}

const DEFAULT_API_BASE = "https://api.shiptos.com/api/v1";

export const createFollowupPickupApi = async ({
  apiBaseUrl = DEFAULT_API_BASE,
  orderId,
  riderId,
  riderName,
}: CreateFollowupPickupParams) => {
  const res = await fetch(
    `${apiBaseUrl}/rider/orders/${orderId}/followup-pickup`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-client-type": "mobile",
      },
      body: JSON.stringify({ riderId, riderName }),
    },
  );

  const json = await res.json().catch(() => null);

  if (!res.ok) {
    throw new Error(json?.message || "Failed to create follow-up pickup");
  }

  return json;
};
