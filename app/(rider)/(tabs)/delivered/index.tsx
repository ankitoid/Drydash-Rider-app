// app/(rider)/(tabs)/delivered/index.tsx
import { useAuth } from "@/context/useAuth";
import { Ionicons } from "@expo/vector-icons";
import { router, useFocusEffect, useLocalSearchParams } from "expo-router";
import React, { useCallback, useEffect, useRef, useState } from "react";
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

/* ================= TYPES ================= */

type Pickup = {
  id: string;
  orderId: string;
  name: string;
  address: string;
};

const API_URL = "https://api.drydash.in/api/v1";

/* ================= SCREEN ================= */

export default function Pickup() {
  const { theme } = useTheme();
  const { user, token } = useAuth();


  const [loading, setLoading] = useState(true);
  const [pickups, setPickups] = useState<Pickup[]>([]); // need to make it deleveries
  const [refreshing, setRefreshing] = useState(false);

  /* page animation */
  const pageOpacity = useRef(new Animated.Value(0)).current;
  const pageTranslate = useRef(new Animated.Value(16)).current;

  /* list animations */
  const itemOpacity = useRef<Animated.Value[]>([]);
  const itemTranslate = useRef<Animated.Value[]>([]);  
  const { completedOrderId } = useLocalSearchParams<{
  completedOrderId?: string;
}>();


useEffect(() => {
  if (!completedOrderId) return;

  setPickups((prev) => prev.filter((p) => p.id !== completedOrderId));
  router.setParams({ completedOrderId: undefined });
}, [completedOrderId]);
  


  
  

  /* ================= API ================= */

  const fetchPickups = async () => {      // need to make it fetchDeleveries
    if (!user?.email) return;

    try {
      setLoading(true);

const res = await fetch(
      `${API_URL}/getOrdersByFilter?email=${encodeURIComponent(
        user.email
      )}&status=delivery+rider+assigned&limit=1000&page=1`,
      {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
          "x-client-type": "mobile",
        },
      }
    );

      const data = await res.json();


      console.log("this is the dataa==>>>",data)

      if (!res.ok) {
        throw new Error(data.message || "Failed to fetch orders");
      }

      const mapped: Pickup[] = data.orders.map((o: any) => ({
        id: o._id,
        orderId: o.order_id,
        name: o.customerName,
        phone: o.contactNo,
        address: o.address,
      }));

      setPickups(mapped);

      /* prepare animations */
      itemOpacity.current = mapped.map(() => new Animated.Value(0));
      itemTranslate.current = mapped.map(() => new Animated.Value(20));

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

      Animated.stagger(
        80,
        mapped.map((_, i) =>
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
    } catch (err) {
      console.error("Pickup fetch error:", err);
      setPickups([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  // useEffect(() => {
  //   fetchPickups();
  // }, [user?.email, router]);

  useFocusEffect(
  useCallback(() => {
    fetchPickups();
  }, [user?.email])
);



  const onRefresh = () => {
    setRefreshing(true);
    fetchPickups();
  };

  /* ================= LOADING ================= */

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
        <SkeletonCard/>
      </ScrollView>
    );
  }

  /* ================= EMPTY STATE ================= */

if (!loading && pickups.length === 0) {
  return (
    <View
      style={[
        styles.emptyWrap,
        { backgroundColor: theme.background },
      ]}
    >
      <Ionicons
        name="bicycle-outline"
        size={52}
        color={theme.subText}
        style={{ marginBottom: 14 }}
      />

      <Text style={[styles.emptyTitle, { color: theme.text }]}>
        No deliveries assigned
      </Text>

      <Text style={[styles.emptySub, { color: theme.subText }]}>
        You’re all caught up. New deliveries will appear here once assigned.
      </Text>
    </View>
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
          <View style={styles.countBadge}>
            <Text style={[styles.countText, { color: theme.primary }]}>
              {pickups.length}
            </Text>
          </View>
        </View>
      </Animated.View>

      {pickups.map((p, i) => (
        <Animated.View
          key={p.id}
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
            onPress={() =>
              router.push(`/(rider)/order/delivered/${p.id}`)
            }
          >
            <View style={styles.iconWrap}>
              <Ionicons name="location" size={20} color={theme.primary} />
            </View>

            <View style={styles.cardBody}>
              <View style={styles.cardHeader}>
                <Text style={[styles.orderId, { color: theme.text }]}>
                  {p.orderId}
                </Text>
              </View>

              <Text style={[styles.name, { color: theme.text }]}>
                {p.name}
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
                  {p.address}
                </Text>
              </View>
            </View>

            <View
              style={[
                styles.actionBtn,
                { backgroundColor: theme.primary },
              ]}
            >
              <Ionicons
                name="chevron-forward"
                size={18}
                color="#000"
              />
            </View>
          </TouchableOpacity>
        </Animated.View>
      ))}
    </Animated.ScrollView>
  );
}

/* ================= SKELETON ================= */

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

/* ================= STYLES ================= */

const styles = StyleSheet.create({
  pageHeader: { paddingHorizontal: 16, marginBottom: 12 },
  pageTitle: { fontSize: 22, fontWeight: "900" },
  pageSub: { fontSize: 13, marginTop: 4 },

  sectionHeader: {
    paddingHorizontal: 16,
    marginBottom: 10,
    flexDirection: "row",
    justifyContent: "space-between",
  },
  sectionTitle: { fontSize: 16, fontWeight: "800" },

  countBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    borderWidth: 1,
  },
  countText: { fontWeight: "800", fontSize: 12 },

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
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#ECFEFF",
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
  emptyWrap: {
  flex: 1,
  alignItems: "center",
  justifyContent: "center",
  paddingHorizontal: 32,
},

emptyTitle: {
  fontSize: 16,
  fontWeight: "800",
  marginBottom: 6,
},

emptySub: {
  fontSize: 13,
  textAlign: "center",
  lineHeight: 18,
},

});
