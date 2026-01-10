import { useAuth } from "@/context/useAuth";
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import React from "react";
import {
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useTheme } from "../../../context/ThemeContext";

export default function RiderProfile() {
  const { theme, isDark, toggleTheme } = useTheme();
  const { user, logout } = useAuth();

  const TEXT = isDark ? "#FFFFFF" : theme.text;
  const SUBTEXT = isDark ? "#CBD5E1" : theme.subText;

  // ✅ LOGOUT HANDLER
  const handleLogout = async () => {
    try {
      await logout();
      router.replace("/(auth)/rider-login"); // 🔒 Reset navigation stack
    } catch (error) {
      console.log("Logout error:", error);
    }
  };

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: theme.background }}
      contentContainerStyle={{ paddingBottom: 140 }}
      showsVerticalScrollIndicator={false}
    >
      {/* BACK HEADER */}
      <View style={styles.backHeader}>
        <TouchableOpacity
          activeOpacity={0.7}
          onPress={() => router.back()}
          style={styles.backBtn}
        >
          <Ionicons name="chevron-back" size={22} color={TEXT} />
          <Text style={[styles.backText, { color: TEXT }]}>Back</Text>
        </TouchableOpacity>
      </View>

      {/* PROFILE CARD */}
      <View
        style={[
          styles.profileCard,
          {
            backgroundColor: theme.card,
            borderColor: isDark ? "#1F2937" : "transparent",
          },
        ]}
      >
        <View
          style={[
            styles.avatarLarge,
            {
              backgroundColor: theme.primarySoft,
              shadowColor: theme.primary,
            },
          ]}
        >
          <Text style={[styles.avatarText, { color: theme.primary }]}>
            {user?.name?.slice(0, 1)}
          </Text>
        </View>

        <Text style={[styles.name, { color: TEXT }]}>{user?.name}</Text>

        <Text style={[styles.phone, { color: SUBTEXT }]}>
          {user?.phone}
        </Text>

        <View style={styles.ratingRow}>
          <Ionicons name="star" size={16} color="#FACC15" />
          <Text style={[styles.rating, { color: TEXT }]}>4.8 Rating</Text>
        </View>
      </View>

      {/* STATS */}
      <View style={styles.statsRow}>
        <StatCard title="Orders" value="1,247" theme={theme} text={TEXT} sub={SUBTEXT} />
        <StatCard title="Delivered" value="1,128" theme={theme} text={TEXT} sub={SUBTEXT} />
        <StatCard title="Earnings" value="₹18,250" theme={theme} text={TEXT} sub={SUBTEXT} />
      </View>

      {/* MENU */}
      <View style={[styles.menuCard, { backgroundColor: theme.card }]}>
        <MenuRow icon="person-outline" label="Edit Profile" text={TEXT} />
        <MenuRow icon="document-text-outline" label="Documents" text={TEXT} />
        <MenuRow icon="wallet-outline" label="Bank & Payouts" text={TEXT} />
        <MenuRow icon="shield-checkmark-outline" label="Safety & Support" text={TEXT} />
        <MenuRow icon="notifications-outline" label="Notifications" text={TEXT} />
      </View>

      {/* THEME SWITCH */}
      <View style={[styles.menuCard, { backgroundColor: theme.card }]}>
        <TouchableOpacity
          style={styles.menuRow}
          activeOpacity={0.8}
          onPress={toggleTheme}
        >
          <View style={[styles.iconPill, { backgroundColor: theme.primarySoft }]}>
            <Ionicons
              name={isDark ? "sunny-outline" : "moon-outline"}
              size={18}
              color={theme.primary}
            />
          </View>
          <Text style={[styles.menuText, { color: TEXT }]}>
            {isDark ? "Switch to Light Mode" : "Switch to Dark Mode"}
          </Text>
        </TouchableOpacity>
      </View>

      {/* LOGOUT */}
      <TouchableOpacity
        activeOpacity={0.85}
        onPress={handleLogout}
        style={[
          styles.logoutBtn,
          { backgroundColor: isDark ? "#3B1F1F" : "#FEE2E2" },
        ]}
      >
        <Ionicons name="log-out-outline" size={18} color="#EF4444" />
        <Text style={styles.logoutText}>Log Out</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

/* ---------- SMALL COMPONENTS ---------- */

function StatCard({ title, value, theme, text, sub }: any) {
  return (
    <View style={[styles.statCard, { backgroundColor: theme.card }]}>
      <Text style={[styles.statValue, { color: text }]}>{value}</Text>
      <Text style={[styles.statTitle, { color: sub }]}>{title}</Text>
    </View>
  );
}

function MenuRow({ icon, label, text }: any) {
  return (
    <TouchableOpacity style={styles.menuRow} activeOpacity={0.8}>
      <View style={styles.iconPill}>
        <Ionicons name={icon} size={18} color="#34F5C5" />
      </View>
      <Text style={[styles.menuText, { color: text }]}>{label}</Text>
      <Ionicons name="chevron-forward" size={18} color="#94A3B8" />
    </TouchableOpacity>
  );
}

/* ---------- STYLES ---------- */

const styles = StyleSheet.create({
  backHeader: {
    paddingHorizontal: 16,
    marginTop: 44,
    marginBottom: 6,
  },
  backBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    width: 90,
  },
  backText: {
    fontSize: 16,
    fontWeight: "700",
  },
  profileCard: {
    marginHorizontal: 16,
    marginTop: 8,
    padding: 18,
    borderRadius: 22,
    alignItems: "center",
    borderWidth: 1,
  },
  avatarLarge: {
    width: 84,
    height: 84,
    borderRadius: 42,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 12,
    shadowOpacity: 0.25,
    shadowRadius: 12,
  },
  avatarText: {
    fontSize: 30,
    fontWeight: "900",
  },
  name: {
    fontSize: 18,
    fontWeight: "900",
  },
  phone: {
    fontSize: 13,
    marginTop: 4,
  },
  ratingRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 8,
    gap: 6,
  },
  rating: {
    fontWeight: "800",
  },
  statsRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginHorizontal: 16,
    marginVertical: 16,
  },
  statCard: {
    width: "31%",
    padding: 14,
    borderRadius: 16,
    alignItems: "center",
  },
  statValue: {
    fontSize: 16,
    fontWeight: "900",
  },
  statTitle: {
    fontSize: 12,
    marginTop: 4,
  },
  menuCard: {
    marginHorizontal: 16,
    borderRadius: 18,
    marginBottom: 14,
    overflow: "hidden",
  },
  menuRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    height: 56,
    gap: 12,
  },
  iconPill: {
    width: 34,
    height: 34,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#0F172A",
  },
  menuText: {
    flex: 1,
    fontSize: 14,
    fontWeight: "700",
  },
  logoutBtn: {
    marginHorizontal: 16,
    marginTop: 10,
    height: 52,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 10,
  },
  logoutText: {
    fontWeight: "900",
    color: "#EF4444",
  },
});
