import PickupWorkflowScreen from "./PickupWorkflowScreen";
import { useLocalSearchParams } from "expo-router";
import { View, Text, ActivityIndicator } from "react-native";

export default function PickupDetailsRoute() {
  const params = useLocalSearchParams<{ orderId?: string }>();
  const orderId = params?.orderId;

  if (!orderId) {
    return (
      <View style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
        <Text style={{ fontSize: 16, fontWeight: "700", color: "#292929" }}>
          Order ID not found
        </Text>
      </View>
    );
  }

  return <PickupWorkflowScreen orderId={orderId} />;
}
