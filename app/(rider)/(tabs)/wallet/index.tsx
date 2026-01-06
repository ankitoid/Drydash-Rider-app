import { Ionicons } from "@expo/vector-icons";
import React, { useEffect, useRef, useState } from "react";
import {
  Animated,
  Easing,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useTheme } from "../../../../context/ThemeContext";

/* ---------------- TYPES ---------------- */

type Bank = {
  name: string;
  subtitle: string;
};

/* ---------------- DATA ---------------- */

const BANKS: Bank[] = [
  { name: "State Bank of India", subtitle: "Popular choice" },
  { name: "HDFC Bank", subtitle: "Fast processing" },
  { name: "ICICI Bank", subtitle: "Secure transactions" },
];

/* ================= SCREEN ================= */

export default function Wallet() {
  const { theme } = useTheme();

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  /* page animation */
  const pageOpacity = useRef(new Animated.Value(0)).current;
  const pageTranslate = useRef(new Animated.Value(16)).current;

  /* item animations */
  const itemOpacity = useRef<Animated.Value[]>([]);
  const itemTranslate = useRef<Animated.Value[]>([]);

  useEffect(() => {
    setTimeout(() => {
      setLoading(false);

      Animated.parallel([
        Animated.timing(pageOpacity, {
          toValue: 1,
          duration: 420,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
        Animated.timing(pageTranslate, {
          toValue: 0,
          duration: 520,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
      ]).start();

      BANKS.forEach((_, i) => {
        itemOpacity.current[i] = new Animated.Value(0);
        itemTranslate.current[i] = new Animated.Value(20);
      });

      Animated.stagger(
        90,
        BANKS.map((_, i) =>
          Animated.parallel([
            Animated.timing(itemOpacity.current[i], {
              toValue: 1,
              duration: 360,
              useNativeDriver: true,
            }),
            Animated.timing(itemTranslate.current[i], {
              toValue: 0,
              duration: 420,
              useNativeDriver: true,
            }),
          ])
        )
      ).start();
    }, 600);
  }, []);

  const onRefresh = () => {
    setRefreshing(true);
    setTimeout(() => setRefreshing(false), 900);
  };

  /* ================= LOADING ================= */

  if (loading) {
    return (
      <ScrollView
        style={{ flex: 1, backgroundColor: theme.background }}
        contentContainerStyle={{ padding: 16 }}
      >
        <SkeletonCard />
        <SkeletonCard />
        <SkeletonRow />
        <SkeletonRow />
      </ScrollView>
    );
  }

  /* ================= UI ================= */

  return (
    <Animated.ScrollView
      style={{ flex: 1, backgroundColor: theme.background }}
      contentContainerStyle={{ paddingTop: 16, paddingBottom: 140 }}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={onRefresh}
          tintColor={theme.primary}
        />
      }
      showsVerticalScrollIndicator={false}
    >
      <Animated.View
        style={{
          opacity: pageOpacity,
          transform: [{ translateY: pageTranslate }],
        }}
      >
        {/* STATS */}
        <View style={styles.statsRow}>
          <StatCard title="TOTAL EARNINGS" value="₹18,250" icon="wallet" theme={theme} />
          <StatCard title="LAST PAYOUT" value="₹5,000" icon="cash" theme={theme} />
          <StatCard title="PENDING FUNDS" value="₹1,200" icon="time" theme={theme} />
        </View>

        {/* TODAY */}
        <View style={[styles.featureCard, { backgroundColor: theme.card, borderColor: theme.border }]}>
          <View>
            <Text style={[styles.featureTitle, { color: theme.subText }]}>
              Today's Earnings
            </Text>
            <Text style={[styles.featureAmount, { color: theme.primary }]}>
              ₹2,450
            </Text>
            <Text style={[styles.featureSub, { color: theme.subText }]}>
              Includes delivery pay + tips
            </Text>
          </View>

          <View style={[styles.iconCircle, { backgroundColor: theme.primarySoft }]}>
            <Ionicons name="cash-outline" size={22} color={theme.primary} />
          </View>
        </View>

        {/* BANK */}
        <View style={[styles.bankCard, { backgroundColor: theme.card, borderColor: theme.border }]}>
          <Text style={[styles.bankTitle, { color: theme.text }]}>
            Linked Bank Accounts
          </Text>
          <Text style={[styles.bankSub, { color: theme.subText }]}>
            No accounts linked yet
          </Text>

          <TouchableOpacity
            activeOpacity={0.85}
            style={[styles.linkBtn, { backgroundColor: theme.primary }]}
          >
            <Ionicons name="add-circle" size={18} color="#000" />
            <Text style={styles.linkText}>Link a New Bank Account</Text>
          </TouchableOpacity>
        </View>

        {/* HEADER */}
        <View style={styles.sectionHeader}>
          <Text style={[styles.sectionTitle, { color: theme.text }]}>
            Available Banks
          </Text>
        </View>
      </Animated.View>

      {/* BANK LIST */}
      {BANKS.map((bank, i) => (
        <Animated.View
          key={bank.name}
          style={{
            opacity: itemOpacity.current[i],
            transform: [{ translateY: itemTranslate.current[i] }],
          }}
        >
          <TouchableOpacity
            activeOpacity={0.9}
            style={[styles.bankRow, { backgroundColor: theme.card, borderColor: theme.border }]}
          >
            <View style={styles.bankLeft}>
              <View style={[styles.bankIcon, { backgroundColor: theme.primarySoft }]}>
                <Ionicons name="business-outline" size={18} color={theme.primary} />
              </View>

              <View>
                <Text style={[styles.bankName, { color: theme.text }]}>
                  {bank.name}
                </Text>
                <Text style={[styles.bankDesc, { color: theme.subText }]}>
                  {bank.subtitle}
                </Text>
              </View>
            </View>

            <Text style={[styles.linkSmall, { color: theme.primary }]}>
              Link →
            </Text>
          </TouchableOpacity>
        </Animated.View>
      ))}
    </Animated.ScrollView>
  );
}

/* ================= COMPONENTS ================= */

function StatCard({ title, value, icon, theme }: any) {
  return (
    <View style={[styles.statCard, { backgroundColor: theme.card, borderColor: theme.border }]}>
      <View style={[styles.iconCircleSmall, { backgroundColor: theme.primarySoft }]}>
        <Ionicons name={icon} size={16} color={theme.primary} />
      </View>
      <Text style={[styles.statTitle, { color: theme.subText }]}>{title}</Text>
      <Text style={[styles.statValue, { color: theme.text }]}>{value}</Text>
    </View>
  );
}

/* ================= SKELETON ================= */

function SkeletonCard() {
  return <View style={styles.skeletonCard} />;
}
function SkeletonRow() {
  return <View style={styles.skeletonRow} />;
}

/* ================= STYLES ================= */

const styles = StyleSheet.create({
  statsRow: { paddingHorizontal: 16, gap: 10, marginBottom: 14 },

  statCard: {
    padding: 14,
    borderRadius: 14,
    borderWidth: 1,
  },
  statTitle: { fontSize: 11, fontWeight: "700", marginTop: 6 },
  statValue: { fontSize: 18, fontWeight: "900" },

  iconCircleSmall: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
  },

  featureCard: {
    marginHorizontal: 16,
    padding: 16,
    borderRadius: 14,
    borderWidth: 1,
    flexDirection: "row",
    justifyContent: "space-between",
  },

  iconCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
  },

  featureTitle: { fontSize: 12, fontWeight: "700" },
  featureAmount: { fontSize: 22, fontWeight: "900", marginTop: 6 },
  featureSub: { fontSize: 12, marginTop: 4 },

  bankCard: {
    marginHorizontal: 16,
    marginTop: 14,
    padding: 16,
    borderRadius: 14,
    borderWidth: 1,
  },

  bankTitle: { fontSize: 14, fontWeight: "800" },
  bankSub: { fontSize: 12, marginTop: 4 },

  linkBtn: {
    marginTop: 14,
    height: 46,
    borderRadius: 12,
    flexDirection: "row",
    gap: 8,
    alignItems: "center",
    justifyContent: "center",
  },
  linkText: { fontWeight: "800", color: "#000" },

  sectionHeader: {
    paddingHorizontal: 16,
    marginTop: 18,
    marginBottom: 10,
  },
  sectionTitle: { fontSize: 16, fontWeight: "800" },

  bankRow: {
    marginHorizontal: 16,
    padding: 14,
    borderRadius: 14,
    borderWidth: 1,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 10,
  },

  bankLeft: { flexDirection: "row", alignItems: "center", gap: 12 },

  bankIcon: {
    width: 36,
    height: 36,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },

  bankName: { fontSize: 14, fontWeight: "700" },
  bankDesc: { fontSize: 12 },

  linkSmall: { fontSize: 13, fontWeight: "800" },

  skeletonCard: {
    height: 120,
    borderRadius: 16,
    backgroundColor: "#CBD5E1",
    opacity: 0.3,
    marginBottom: 12,
  },
  skeletonRow: {
    height: 70,
    borderRadius: 14,
    backgroundColor: "#CBD5E1",
    opacity: 0.25,
    marginBottom: 10,
  },
});
