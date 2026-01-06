// app/(rider)/(tabs)/pickup/index.tsx
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
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

/* --------- Types & Mock Data --------- */
type Pickup = {
  id: string;
  name: string;
  address: string;
  status: "New" | "Scheduled";
};

const DATA: Pickup[] = [
  {
    id: "ORD123451",
    name: "Mrs. Sharma",
    address: "Green Valley Apts, MG Road, Bengaluru - 560001",
    status: "New",
  },
  {
    id: "ORD123452",
    name: "Mr. Verma",
    address: "Sunshine Towers, HSR Layout, Bengaluru - 560102",
    status: "Scheduled",
  },
  {
    id: "ORD123453",
    name: "Ms. Pooja",
    address: "Royal Residency, Koramangala, Bengaluru - 560034",
    status: "Scheduled",
  },
  {
    id: "ORD123454",
    name: "Mr. Khan",
    address: "Emerald Apartments, JP Nagar, Bengaluru - 560078",
    status: "Scheduled",
  },
];

/* ================= SCREEN ================= */

export default function Pickup() {
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

  useEffect(() => {
    // simulate API fetch
    setTimeout(() => {
      setPickups(DATA);
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

      // prepare list anim values
      DATA.forEach((_, i) => {
        itemOpacity.current[i] = new Animated.Value(0);
        itemTranslate.current[i] = new Animated.Value(20);
      });

      Animated.stagger(
        80,
        DATA.map((_, i) =>
          Animated.parallel([
            Animated.timing(itemOpacity.current[i], {
              toValue: 1,
              duration: 380,
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
    }, 700);
  }, []);

  const onRefresh = () => {
    setRefreshing(true);
    setTimeout(() => {
      // here you'd re-fetch; we reassign mock data for demo
      setPickups(DATA);
      setRefreshing(false);
    }, 900);
  };

  /* ================= LOADING / SKELETON ================= */

  if (loading) {
    return (
      <ScrollView
        style={{ flex: 1, backgroundColor: theme.background }}
        contentContainerStyle={{ padding: 16 }}
        showsVerticalScrollIndicator={false}
      >
        <SkeletonHeader />
        <SkeletonCard />
        <SkeletonCard />
        <SkeletonCard />
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
        <View style={styles.pageHeader}>
          <Text style={[styles.pageTitle, { color: theme.text }]}>
            Ready for Action
          </Text>
          <Text style={[styles.pageSub, { color: theme.subText }]}>
            Your Delivery Queue
          </Text>
        </View>

        <View style={styles.sectionHeader}>
          <Text style={[styles.sectionTitle, { color: theme.text }]}>
            Upcoming Delivery
          </Text>
          <View style={[styles.countBadge, { backgroundColor: theme.card, borderColor: theme.border }]}>
            <Text style={[styles.countText, { color: theme.primary }]}>
              {pickups.length}
            </Text>
          </View>
        </View>
      </Animated.View>

      {/* list */}
      {pickups.map((p, i) => (
        <Animated.View
          key={p.id}
          style={{
            opacity: itemOpacity.current[i],
            transform: [{ translateY: itemTranslate.current[i] }],
          }}
        >
          <View
            style={[
              styles.card,
              { backgroundColor: theme.card, borderColor: theme.border },
            ]}
          >
            <View style={styles.iconWrap}>
              <Ionicons name="location" size={20} color={theme.primary} />
            </View>

            <View style={styles.cardBody}>
              <View style={styles.cardHeader}>
                <Text style={[styles.orderId, { color: theme.text }]}>
                  {p.id}
                </Text>

                {p.status === "New" ? (
                  <View style={styles.newBadge}>
                    <Text style={styles.newText}>New</Text>
                  </View>
                ) : (
                  <Text style={[styles.scheduledText, { color: theme.subText }]}>
                    Scheduled
                  </Text>
                )}
              </View>

              <Text style={[styles.name, { color: theme.text }]}>{p.name}</Text>

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
                  {p.address}
                </Text>
              </View>
            </View>

            <TouchableOpacity
              activeOpacity={0.85}
              onPress={() =>
                // navigate to pickup details — change path if you use other folder names
                router.push(`/(rider)/order/delivered/${p.id}`)
              }
              style={[
                styles.actionBtn,
                {
                  backgroundColor: p.status === "New" ? theme.primary : theme.border,
                },
              ]}
            >
              <Ionicons
                name="chevron-forward"
                size={18}
                color={p.status === "New" ? "#000" : theme.subText}
              />
            </TouchableOpacity>
          </View>
        </Animated.View>
      ))}
    </Animated.ScrollView>
  );
}

/* ================= SKELETON COMPONENTS ================= */

function SkeletonHeader() {
  return (
    <View style={{ paddingHorizontal: 16, marginBottom: 12 }}>
      <View style={{ width: 160, height: 22, borderRadius: 8, backgroundColor: "#CBD5E1", opacity: 0.3, marginBottom: 8 }} />
      <View style={{ width: 220, height: 14, borderRadius: 6, backgroundColor: "#CBD5E1", opacity: 0.25 }} />
    </View>
  );
}

function SkeletonCard() {
  return (
    <View style={{ marginHorizontal: 16, marginBottom: 12 }}>
      <View style={{ height: 86, borderRadius: 14, backgroundColor: "#CBD5E1", opacity: 0.3 }} />
    </View>
  );
}

/* ================= STYLES ================= */

const styles = StyleSheet.create({
  pageHeader: {
    paddingHorizontal: 16,
    marginBottom: 12,
  },
  pageTitle: {
    fontSize: 22,
    fontWeight: "900",
  },
  pageSub: {
    fontSize: 13,
    marginTop: 4,
  },

  sectionHeader: {
    paddingHorizontal: 16,
    marginBottom: 10,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: "800",
  },
  countBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    borderWidth: 1,
  },
  countText: {
    fontWeight: "800",
    fontSize: 12,
  },

  card: {
    marginHorizontal: 16,
    padding: 14,
    borderRadius: 16,
    borderWidth: 1,
    flexDirection: "row",
    alignItems: "flex-start",
    marginBottom: 12,
  },

  iconWrap: {
    width: 42,
    height: 42,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#ECFEFF",
    marginRight: 12,
  },

  cardBody: {
    flex: 1,
  },

  cardHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 4,
  },

  orderId: {
    fontWeight: "800",
    fontSize: 14,
  },

  newBadge: {
    backgroundColor: "#DCFCE7",
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 999,
  },
  newText: {
    color: "#16A34A",
    fontSize: 11,
    fontWeight: "800",
  },

  scheduledText: {
    fontSize: 11,
    fontWeight: "700",
  },

  name: {
    fontSize: 14,
    fontWeight: "700",
    marginBottom: 6,
  },

  addressRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 6,
  },
  address: {
    fontSize: 12,
    lineHeight: 16,
    flex: 1,
  },

  actionBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
    marginLeft: 10,
  },
});
