import { Ionicons } from "@expo/vector-icons";
import { Tabs } from "expo-router";
import { StyleSheet, View } from "react-native";
import { RiderHeader } from "../../../components/layout/RiderHeader";

export default function RiderTabsLayout() {
  return (
    < >
      <View style={styles.container}>
        {/* FIXED RIDER HEADER */}
        <RiderHeader />

        {/* RIDER TABS */}
        <Tabs
          screenOptions={{
            headerShown: false,
            tabBarStyle: {
              height: 64,
              backgroundColor: "#0B1F1A",
              borderTopWidth: 0,
            },
            tabBarActiveTintColor: "#34F5C5",
            tabBarInactiveTintColor: "#94a3b8",
            tabBarLabelStyle: {
              fontSize: 11,
              fontWeight: "600",
            },
          }}
        >
          <Tabs.Screen
            name="dashboard/index"
            options={{
              title: "Dashboard",
              tabBarLabel: "Dashboard",
              tabBarIcon: ({ color, focused }) => (
                <Ionicons
                  name={focused ? "grid" : "grid-outline"}
                  size={22}
                  color={color}
                />
              ),
            }}
          />

          <Tabs.Screen
            name="pickup/index"
            options={{
              title: "Pickup",
              tabBarLabel: "Pickup",
              tabBarIcon: ({ color, focused }) => (
                <Ionicons
                  name={focused ? "cube" : "cube-outline"}
                  size={22}
                  color={color}
                />
              ),
            }}
          />

          <Tabs.Screen
            name="delivered/index"
            options={{
              title: "Delivered",
              tabBarLabel: "Delivered",
              tabBarIcon: ({ color, focused }) => (
                <Ionicons
                  name={focused ? "checkmark-done" : "checkmark-done-outline"}
                  size={22}
                  color={color}
                />
              ),
            }}
          />

          <Tabs.Screen
            name="wallet/index"
            options={{
              title: "Wallet",
              tabBarLabel: "Wallet",
              tabBarIcon: ({ color, focused }) => (
                <Ionicons
                  name={focused ? "wallet" : "wallet-outline"}
                  size={22}
                  color={color}
                />
              ),
            }}
          />
        </Tabs>
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
});
