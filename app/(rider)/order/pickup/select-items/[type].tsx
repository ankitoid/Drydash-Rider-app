import PickupWorkflowScreen from "../PickupWorkflowScreen";
import { useLocalSearchParams } from "expo-router";

export default function PickupSelectItemsRoute() {
  const { type, orderId } = useLocalSearchParams<{
    type?: string;
    orderId?: string;
  }>();

  if (!orderId) {
    return null;
  }

  return <PickupWorkflowScreen orderId={orderId} initialType={type} />;
}
