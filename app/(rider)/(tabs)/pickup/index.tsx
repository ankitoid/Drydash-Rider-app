import { useAuth } from "@/context/useAuth";
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import React, { useEffect, useRef, useState } from "react";
import {
  Animated,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View
} from "react-native";
import { useTheme } from "../../../../context/ThemeContext";

/* ---------- TYPES ---------- */
type Pickup = {
  _id: string;
  Name: string;
  Address: string;
};

/* ---------- MOCK DATA ---------- */
// const DATA: Pickup[] = [
//   {
//     id: "ORD123451",
//     name: "Mrs. Sharma",
//     address: "Green Valley Apts, MG Road, Bengaluru - 560001",
//     status: "New",
//   },
//   {
//     id: "ORD123452",
//     name: "Mr. Verma",
//     address: "Sunshine Towers, HSR Layout, Bengaluru - 560102",
//     status: "Scheduled",
//   },
//   {
//     id: "ORD123453",
//     name: "Ms. Pooja",
//     address: "Royal Residency, Koramangala, Bengaluru - 560034",
//     status: "Scheduled",
//   },
//   {
//     id: "ORD123454",
//     name: "Mr. Khan",
//     address: "Emerald Apartments, JP Nagar, Bengaluru - 560078",
//     status: "Scheduled",
//   },
// ];

const API_URL = "https://api.drydash.in/api/v1/rider";

/* ================= SCREEN ================= */

export default function Pickup() {
  const { user } = useAuth();

  console.log("user:: in pikuos", user)

  const { theme } = useTheme();

  const [loading, setLoading] = useState(true);
  const [pickups, setPickups] = useState<Pickup[]>([]);
  const [refreshing, setRefreshing] = useState(false);

  /* page animation */
  const pageOpacity = useRef(new Animated.Value(0)).current;
  const pageTranslate = useRef(new Animated.Value(16)).current;

  /* list animations */
  const itemOpacity = useRef<Animated.Value[]>([]);
  const itemTranslate = useRef<Animated.Value[]>([]);

  const getPickups = async () => {
    setLoading(true)
    try {
      const res = await fetch(
        `${API_URL}/getriderpickups?email=${user?.email}`,
        {
          method: "GET",
          headers: {
            "Content-Type": "application/json",
            "x-client-type": "mobile",
          },
        }
      );

      const data = await res.json();
      setPickups(data.Pickups);
      setLoading(false)

      if (!res.ok) {
        throw new Error(data.message || "Failed to send OTP");
      }
    } catch (error) {
      setLoading(false)
    }
  };

  useEffect(() => {
    getPickups();
  }, []);

  // useEffect(() => {
  //   setTimeout(() => {
  //     setPickups(DATA);
  //     setLoading(false);

  //     Animated.parallel([
  //       Animated.timing(pageOpacity, {
  //         toValue: 1,
  //         duration: 420,
  //         easing: Easing.out(Easing.cubic),
  //         useNativeDriver: true,
  //       }),
  //       Animated.timing(pageTranslate, {
  //         toValue: 0,
  //         duration: 520,
  //         easing: Easing.out(Easing.cubic),
  //         useNativeDriver: true,
  //       }),
  //     ]).start();

  //     DATA.forEach((_, i) => {
  //       itemOpacity.current[i] = new Animated.Value(0);
  //       itemTranslate.current[i] = new Animated.Value(20);
  //     });

  //     Animated.stagger(
  //       80,
  //       DATA.map((_, i) =>
  //         Animated.parallel([
  //           Animated.timing(itemOpacity.current[i], {
  //             toValue: 1,
  //             duration: 360,
  //             useNativeDriver: true,
  //           }),
  //           Animated.timing(itemTranslate.current[i], {
  //             toValue: 0,
  //             duration: 420,
  //             useNativeDriver: true,
  //           }),
  //         ])
  //       )
  //     ).start();
  //   }, 700);
  // }, []);

  /* ---------- LOADING ---------- */
  if (loading) {
    return (
      <ScrollView
        style={{ flex: 1, backgroundColor: theme.background }}
        contentContainerStyle={{ padding: 16 }}
      >
        <SkeletonHeader />
        <SkeletonCard />
        <SkeletonCard />
        <SkeletonCard />
      </ScrollView>
    );
  }

  /* ---------- UI ---------- */
  return (
    <Animated.ScrollView
      style={{ flex: 1, backgroundColor: theme.background }}
      contentContainerStyle={{ paddingTop: 16, paddingBottom: 140 }}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          // onRefresh={onRefresh}
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
        <View style={styles.pageHeader}>
          <Text style={[styles.pageTitle, { color: theme.text }]}>
            Ready for Action
          </Text>
          <Text style={[styles.pageSub, { color: theme.subText }]}>
            Your Pickup Queue
          </Text>
        </View>

        <View style={styles.sectionHeader}>
          <Text style={[styles.sectionTitle, { color: theme.text }]}>
            Upcoming Pickups
          </Text>
          <View style={styles.badge}>
            <Text style={styles.badgeText}>{pickups.length}</Text>
          </View>
        </View>
      </Animated.View>

      {pickups.map((item, i) => (
        <Animated.View
          key={item._id}
          style={{
            opacity: itemOpacity.current[i],
            transform: [{ translateY: itemTranslate.current[i] }],
          }}
        >
          <TouchableOpacity
            activeOpacity={0.9}
            style={[
              styles.card,
              { backgroundColor: theme.card, borderColor: theme.border },
            ]}
            onPress={() => router.push(`/(rider)/order/pickup/${item._id}`)}
          >
            <View style={styles.iconWrap}>
              <Ionicons name="location" size={20} color={theme.primary} />
            </View>

            <View style={styles.cardBody}>
              <View style={styles.cardHeader}>
                <Text style={[styles.orderId, { color: theme.text }]}>
                  {('wzp-'+(item._id).slice(item._id.length - 5)).toUpperCase()}
                </Text>
              </View>

              <Text style={[styles.name, { color: theme.text }]}>
                {item.Name}
              </Text>

              <View style={styles.addressRow}>
                <Ionicons
                  name="location-outline"
                  size={14}
                  color={theme.subText}
                />
                <Text
                  style={[styles.address, { color: theme.subText }]}
                  numberOfLines={2}
                >
                  {item.Address}
                </Text>
              </View>
            </View>
   <View
              style={[
                styles.actionBtn,
                {
                  backgroundColor:
                    1
                      ? theme.primary
                      : theme.border,
                },
              ]}
            >
              <Ionicons
                name="chevron-forward"
                size={18}
                color={1 ? "#000" : theme.subText}
              />
            </View>          </TouchableOpacity>
        </Animated.View>
      ))}
    </Animated.ScrollView>
  );
}

/* ---------- SKELETON ---------- */

function SkeletonHeader() {
  return (
    <View style={{ paddingHorizontal: 16, marginBottom: 12 }}>
      <View style={styles.skeletonTitle} />
      <View style={styles.skeletonSub} />
    </View>
  );
}

function SkeletonCard() {
  return <View style={styles.skeletonCard} />;
}

/* ---------- STYLES ---------- */

const styles = StyleSheet.create({
  pageHeader: { paddingHorizontal: 16, marginBottom: 14 },
  pageTitle: { fontSize: 22, fontWeight: "900" },
  pageSub: { fontSize: 13, marginTop: 4 },

  sectionHeader: {
    paddingHorizontal: 16,
    marginBottom: 10,
    flexDirection: "row",
    justifyContent: "space-between",
  },
  sectionTitle: { fontSize: 16, fontWeight: "800" },

  badge: {
    backgroundColor: "#DCFCE7",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
  },
  badgeText: {
    fontWeight: "800",
    color: "#16A34A",
    fontSize: 12,
  },

  card: {
    marginHorizontal: 16,
    padding: 14,
    borderRadius: 16,
    borderWidth: 1,
    flexDirection: "row",
    marginBottom: 12,
  },

  iconWrap: {
    width: 42,
    height: 42,
    borderRadius: 12,
    backgroundColor: "#ECFEFF",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
  },

  cardBody: { flex: 1 },
  cardHeader: { flexDirection: "row", gap: 8, marginBottom: 4 },
  orderId: { fontWeight: "800", fontSize: 14 },

  newBadge: {
    backgroundColor: "#DCFCE7",
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 999,
  },
  newText: { color: "#16A34A", fontSize: 11, fontWeight: "800" },
  scheduledText: { fontSize: 11, color: "#64748B", fontWeight: "700" },

  name: { fontSize: 14, fontWeight: "700", marginBottom: 6 },

  addressRow: { flexDirection: "row", gap: 6 },
  address: { fontSize: 12, lineHeight: 16, flex: 1 },

  actionBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
  },

  skeletonTitle: {
    width: 160,
    height: 22,
    borderRadius: 8,
    backgroundColor: "#CBD5E1",
    opacity: 0.3,
    marginBottom: 8,
  },
  skeletonSub: {
    width: 220,
    height: 14,
    borderRadius: 6,
    backgroundColor: "#CBD5E1",
    opacity: 0.25,
  },
  skeletonCard: {
    height: 86,
    borderRadius: 16,
    backgroundColor: "#CBD5E1",
    opacity: 0.3,
    marginHorizontal: 16,
    marginBottom: 12,
  },
});
