import { Ionicons } from "@expo/vector-icons";
import { Tabs } from "expo-router";
import { StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { RiderHeader } from "../../../components/layout/RiderHeader";
import { useTheme } from "../../../context/ThemeContext";

export default function RiderTabsLayout() {
  const insets = useSafeAreaInsets();
  const { theme } = useTheme();

  return (
    <View style={styles.container}>
      {/* FIXED RIDER HEADER */}
      <RiderHeader />

      {/* 3 EQUAL, PERFECTLY CENTERED TABS: HOME | TASKS | PROFILE */}
      <Tabs
        screenOptions={{
          headerShown: false,
          tabBarStyle: {
            height: 62 + insets.bottom,
            paddingBottom: insets.bottom + 6,
            paddingTop: 8,
            paddingHorizontal: 0,
            backgroundColor: theme.card,
            borderTopColor: theme.border,
            borderTopWidth: 1,
            elevation: 10,
            shadowColor: "#000",
            shadowOffset: { width: 0, height: -2 },
            shadowOpacity: 0.06,
            shadowRadius: 8,
          },
          tabBarActiveTintColor: theme.primary,
          tabBarInactiveTintColor: theme.muted,
          tabBarItemStyle: {
            flex: 1,
            alignItems: "center",
            justifyContent: "center",
            paddingHorizontal: 0,
            marginHorizontal: 0,
          },
          tabBarLabelStyle: {
            fontSize: 11,
            fontWeight: "700",
            marginTop: 2,
            textAlign: "center",
          },
        }}
      >
        {/* TAB 1: HOME */}
        <Tabs.Screen
          name="dashboard/index"
          options={{
            title: "Home",
            tabBarLabel: "Home",
            tabBarIcon: ({ color, focused }) => (
              <Ionicons
                name={focused ? "home" : "home-outline"}
                size={22}
                color={color}
              />
            ),
          }}
        />

        {/* TAB 2: TASKS (PERFECTLY DEAD-CENTERED) */}
        <Tabs.Screen
          name="tasks/index"
          options={{
            title: "Tasks",
            tabBarLabel: "Tasks",
            tabBarIcon: ({ color, focused }) => (
              <Ionicons
                name={focused ? "list" : "list-outline"}
                size={22}
                color={color}
              />
            ),
          }}
        />

        {/* TAB 3: PROFILE */}
        <Tabs.Screen
          name="profile/index"
          options={{
            title: "Profile",
            tabBarLabel: "Profile",
            tabBarIcon: ({ color, focused }) => (
              <Ionicons
                name={focused ? "person" : "person-outline"}
                size={22}
                color={color}
              />
            ),
          }}
        />

        {/* HIDE PICKUP TAB FROM BOTTOM NAVIGATION BAR */}
        <Tabs.Screen
          name="pickup/index"
          options={{
            href: null,
          }}
        />
      </Tabs>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
});
