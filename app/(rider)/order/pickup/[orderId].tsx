import PickupWorkflowScreen from "./PickupWorkflowScreen";
import { useLocalSearchParams } from "expo-router";
export default function PickupDetailsRoute() {
  const { orderId } = useLocalSearchParams<{ orderId: string }>();
  if (!orderId) {
    return null;
  }

  return <PickupWorkflowScreen orderId={orderId} />;
}
