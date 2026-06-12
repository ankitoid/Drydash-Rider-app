import TaskNavigationScreen from "../../TaskNavigationScreen";
import { useLocalSearchParams } from "expo-router";

export default function DeliveryNavigationRoute() {
  const { orderId } = useLocalSearchParams<{ orderId: string }>();
  if (!orderId) return null;

  return <TaskNavigationScreen orderId={orderId} type="delivery" />;
}
