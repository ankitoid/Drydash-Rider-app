import { useNotification } from "@/context/NotificationContext";
import { useAuth } from "@/context/useAuth";
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import React from "react";
import { Image, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTheme } from "../../context/ThemeContext";

export function RiderHeader() {
  const insets = useSafeAreaInsets();
  const { theme, isDark, toggleTheme } = useTheme();
  const { user } = useAuth();
  const { unreadCount } = useNotification();
  const logoSource = isDark
    ? require("../../assets/images/logo_dark.png")
    : require("../../assets/images/logo.png");

  return (
    <View
      style={[
        styles.container,
        {
          paddingTop: insets.top + 12,
          backgroundColor: theme.header,
          borderBottomColor: theme.border,
        },
      ]}
    >
      {/* LEFT */}
      <View style={styles.left}>
        <Image source={logoSource} style={styles.logo} />
        <Text style={[styles.title, { color: theme.text }]}>Shiptos</Text>
      </View>

      {/* RIGHT */}
      <View style={styles.right}>
        <View style={{ position: "relative" }}>
          <TouchableOpacity
            style={styles.iconBtn}
            onPress={() => router.push("/(rider)/notifications")}
          >
            <Ionicons
              name="notifications-outline"
              size={20}
              color={theme.text}
            />
          </TouchableOpacity>

          {unreadCount > 0 && (
            <View style={styles.badge}>
              <Text style={styles.badgeText}>
                {unreadCount > 99 ? "99+" : unreadCount}
              </Text>
            </View>
          )}
        </View>

        {/* THEME TOGGLE */}
        <TouchableOpacity
          onPress={toggleTheme}
          style={[
            styles.iconBtn,
            {
              backgroundColor: theme.primarySoft,
              borderRadius: 20,
            },
          ]}
        >
          <Ionicons
            name={isDark ? "sunny-outline" : "moon-outline"}
            size={16}
            color={theme.primary}
          />
        </TouchableOpacity>

        {/* AVATAR */}
        <TouchableOpacity
          activeOpacity={0.85}
          onPress={() => router.push("/(rider)/profile")}
          style={[styles.avatar, { backgroundColor: theme.primarySoft }]}
        >
          <Text style={[styles.avatarText, { color: theme.primary }]}>
            {user?.name?.slice(0, 1).toUpperCase()}
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}
const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 24,
    paddingBottom: 8,
    borderBottomWidth: 1,
    zIndex: 100,
  },

  left: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },

  logo: {
    width: 24,
    height: 24,
    resizeMode: "contain",
  },

  title: {
    fontSize: 20,
    fontWeight: "900",
    letterSpacing: 0.4,
  },

  right: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },

  iconBtn: {
    padding: 8,
  },

  avatar: {
    width: 32,
    height: 32,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
  },

  avatarText: {
    fontWeight: "900",
  },
  badge: {
    position: "absolute",
    top: 2,
    right: 2,
    backgroundColor: "#EF4444",
    borderRadius: 10,
    minWidth: 16,
    height: 16,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 4,
  },

  badgeText: {
    color: "#fff",
    fontSize: 10,
    fontWeight: "800",
  },
});
