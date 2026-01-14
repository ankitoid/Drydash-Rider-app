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
  const {user} = useAuth()

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
        <Image
          source={require("../../assets/images/logo.png")}
          style={styles.logo}
        />
        <Text style={[styles.title, { color: theme.text }]}>Dry Dash</Text>
      </View>

      {/* RIGHT */}
      <View style={styles.right}>
        <TouchableOpacity style={styles.iconBtn}>
          <Ionicons name="notifications-outline" size={16} color="#000" />
        </TouchableOpacity>

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
          <Text style={[styles.avatarText, { color: theme.primary }]}>{(user?.name)?.slice(0,1).toUpperCase()}</Text>
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
});
