import { useAuth } from "@/context/useAuth";
import { Ionicons } from "@expo/vector-icons";
import { router, useLocalSearchParams } from "expo-router";
import { useEffect, useState } from "react";
import {
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useTheme } from "../../../../context/ThemeContext";


const API_URL = "https://api.drydash.in/api/v1";

export default function PickupDetails() {
  const { orderId } = useLocalSearchParams<{ orderId: string }>();
  const { theme } = useTheme();
  const {user} = useAuth()
  const [loading, setLoading] = useState(true);
  const [pickup, setPickup] = useState<{ Name: string, Address: string, Contact: string }>({ Name: '', Address: '', Contact: '' })



  const getPickup = async () => {
    setLoading(true)
    try {
      const res = await fetch(
        `${API_URL}/pickupbyId/${orderId}`,
        {
          method: "GET",
          headers: {
            "Content-Type": "application/json",
            "x-client-type": "mobile",
          },
        }
      );

      const data = await res.json();
      setPickup(data.data);
      setLoading(false)

      if (!res.ok) {
        throw new Error(data.message || "Failed to send OTP");
      }
    } catch (error) {
      setLoading(false)
    }
  };

  useEffect(() => {
    getPickup();
  }, []);


  console.log("data:", pickup)

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


    if (loading || !pickup) {
          return (
        <ScrollView
          style={{ flex: 1, backgroundColor: theme.background }}
          contentContainerStyle={{ padding: 16 }}
        >
          <SkeletonHeader />
          <SkeletonCard />
          <SkeletonCard />
          <SkeletonCard />
          <SkeletonCard />
          <SkeletonCard />
        </ScrollView>
      );
    }



  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: theme.background }}
      contentContainerStyle={{ paddingBottom: 120 }}
      showsVerticalScrollIndicator={false}
    >
      {/* TOP HEADER */}
      <View style={[styles.header, { backgroundColor: theme.primary }]}>
        <TouchableOpacity onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={22} color="#fff" />
        </TouchableOpacity>

        <Text style={styles.headerTitle}>Dry Dash</Text>

        <View style={styles.avatar}>
          <Text style={styles.avatarText}>{(user?.name)?.slice(0,1).toUpperCase().toUpperCase()}</Text>
        </View>
      </View>

      {/* ORDER STATUS */}
      <View style={styles.statusWrap}>
        <Text style={styles.statusLabel}>Pickup in Progress</Text>
        <Text style={styles.orderId}>{orderId ? `WZP-${orderId.slice(-5)}`.toUpperCase()
                  : "WZP-----"}</Text>
      </View>

      {/* PICKUP DETAILS */}
      <View style={[styles.card, { backgroundColor: theme.card }]}>
        <Text style={[styles.cardTitle, { color: theme.text }]}>
          Pickup Details
        </Text>

        <DetailRow
          icon="person-outline"
          label="Customer"
          value={pickup?.Name}
          theme={theme}
        />

        <DetailRow
          icon="location-outline"
          label="Address"
          value={pickup?.Address}
          theme={theme}
        />

        <DetailRow
          icon="time-outline"
          label="Phone"
          value={pickup?.Contact}
          theme={theme}
        />

        <TouchableOpacity
          style={[styles.navigateBtn, { backgroundColor: theme.primary }]}
        >
          <Ionicons name="navigate" size={18} color="#000" />
          <Text style={styles.navigateText}>Navigate</Text>
        </TouchableOpacity>
      </View>

<Text style={[styles.sectionTitle, { color: theme.text }]}>
  Select Items for Pickup
</Text>

<View style={styles.itemsRow}>
  <TouchableOpacity
    activeOpacity={0.85}
    onPress={() =>
      router.push({
        pathname: "/order/pickup/select-items/[type]",
        params: { type: "laundry", orderId : orderId },
      })
    }
    style={[styles.itemCard, { backgroundColor: theme.card }]}
  >
    <View style={styles.iconWrap}>
      <Ionicons name="shirt-outline" size={24} color={theme.primary} />
    </View>
    <Text style={[styles.itemText, { color: theme.text }]}>Laundry</Text>
  </TouchableOpacity>

  <TouchableOpacity
    activeOpacity={0.85}
    onPress={() =>
      router.push({
        pathname: "/order/pickup/select-items/[type]",
        params: { type: "shoe", orderId : orderId },
      })
    }
    style={[styles.itemCard, { backgroundColor: theme.card }]}
  >
    <View style={styles.iconWrap}>
      <Ionicons name="walk-outline" size={24} color={theme.primary} />
    </View>
    <Text style={[styles.itemText, { color: theme.text }]}>Shoe Spa</Text>
  </TouchableOpacity>

  <TouchableOpacity
    activeOpacity={0.85}
    onPress={() =>
      router.push({
        pathname: "/order/pickup/select-items/[type]",
        params: { type: "drywash", orderId : orderId },
      })
    }
    style={[styles.itemCard, { backgroundColor: theme.card }]}
  >
    <View style={styles.iconWrap}>
      <Ionicons name="water-outline" size={24} color={theme.primary} />
    </View>
    <Text style={[styles.itemText, { color: theme.text }]}>Drywash</Text>
  </TouchableOpacity>
</View>

    
    </ScrollView>
  );
}

/* ---------- SMALL COMPONENTS ---------- */

function DetailRow({
  icon,
  label,
  value,
  theme,
}: {
  icon: any;
  label: string;
  value: string;
  theme: any;
}) {
  return (
    <View style={styles.detailRow}>
      <Ionicons name={icon} size={18} color={theme.primary} />
      <View style={{ marginLeft: 10 }}>
        <Text style={[styles.detailLabel, { color: theme.subText }]}>
          {label}
        </Text>
        <Text style={[styles.detailValue, { color: theme.text }]}>
          {value}
        </Text>
      </View>
    </View>
  );
}

function ItemCard({
  label,
  icon,
  theme,
}: {
  label: string;
  icon: any;
  theme: any;
}) {
  return (
    <View style={[styles.itemCard, { backgroundColor: theme.card }]}>
      <Ionicons name={icon} size={22} color={theme.primary} />
      <Text style={[styles.itemText, { color: theme.text }]}>
        {label}
      </Text>
    </View>
  );
}

function SummaryRow({
  label,
  price,
  theme,
  bold,
  green,
}: {
  label: string;
  price: string;
  theme: any;
  bold?: boolean;
  green?: boolean;
}) {
  return (
    <View style={styles.summaryRow}>
      <Text
        style={[
          styles.summaryLabel,
          { color: theme.text },
          bold && { fontWeight: "900" },
        ]}
      >
        {label}
      </Text>
      <Text
        style={[
          styles.summaryPrice,
          green && { color: "#22C55E" },
          bold && { fontWeight: "900" },
        ]}
      >
        {price}
      </Text>
    </View>
  );
}

/* ---------- STYLES ---------- */

const styles = StyleSheet.create({
  header: {
    paddingTop: 52,
    paddingHorizontal: 16,
    paddingBottom: 16,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  headerTitle: { color: "#fff", fontWeight: "900", fontSize: 16 },
  avatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "#ECFDF5",
    alignItems: "center",
    justifyContent: "center",
  },
  avatarText: { fontWeight: "800", color: "#16A34A" },

  statusWrap: {
    alignItems: "center",
    marginVertical: 14,
  },
  statusLabel: { color: "#16A34A", fontWeight: "800", fontSize: 13 },
  orderId: { fontSize: 20, fontWeight: "900", marginTop: 4 },

  card: {
    marginHorizontal: 16,
    marginBottom: 16,
    padding: 16,
    borderRadius: 18,
  },
  cardTitle: { fontSize: 16, fontWeight: "900", marginBottom: 12 },

  detailRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    marginBottom: 10,
  },
  detailLabel: { fontSize: 12 },
  detailValue: { fontSize: 14, fontWeight: "700" },

  navigateBtn: {
    marginTop: 14,
    height: 40,
    borderRadius: 14,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  navigateText: { fontWeight: "900", color: "#000" },

  sectionTitle: {
    fontSize: 16,
    fontWeight: "900",
    marginHorizontal: 16,
    marginBottom: 10,
  },
itemsRow: {
  flexDirection: "row",
  justifyContent: "space-between",
  marginHorizontal: 16,
  marginBottom: 16,
},

itemCard: {
  width: "30%",
  paddingVertical: 18,
  borderRadius: 18,
  alignItems: "center",
  elevation: 6, // Android shadow
},

iconWrap: {
  width: 54,
  height: 54,
  borderRadius: 14,
  alignItems: "center",
  justifyContent: "center",
  marginBottom: 8,
},

itemText: {
  fontSize: 13,
  fontWeight: "800",
},

  summaryRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 8,
  },
  summaryLabel: { fontSize: 14 },
  summaryPrice: { fontSize: 14, fontWeight: "800" },

  divider: {
    height: 1,
    backgroundColor: "#E5E7EB",
    marginVertical: 10,
  },

  completeBtn: {
    marginHorizontal: 16,
    height: 54,
    borderRadius: 16,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
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
  completeText: { fontWeight: "900", color: "#000" },
});
