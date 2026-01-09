import { Ionicons } from "@expo/vector-icons";
import { router, useLocalSearchParams } from "expo-router";
import React, { useEffect, useState } from "react";
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
  const [loading, setLoading] = useState(true);
  const [pickup, setPickup] = useState<{ Name: string, Address: string, Contact: string }>({Name: '', Address: '', Contact: ''})



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


    console.log("data:" , pickup)



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
          <Text style={styles.avatarText}>A</Text>
        </View>
      </View>

      {/* ORDER STATUS */}
      <View style={styles.statusWrap}>
        <Text style={styles.statusLabel}>Pickup in Progress</Text>
        <Text style={styles.orderId}>{orderId}</Text>
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

      {/* SELECT ITEMS */}
      <Text style={[styles.sectionTitle, { color: theme.text }]}>
        Select Items for Pickup
      </Text>

      <View style={styles.itemsRow}>
        <ItemCard label="Laundry" icon="shirt-outline" theme={theme} />
        <ItemCard label="Shoe Spa" icon="walk-outline" theme={theme} />
        <ItemCard label="Drywash" icon="water-outline" theme={theme} />
      </View>

      {/* ORDER SUMMARY */}
      <View style={[styles.card, { backgroundColor: theme.card }]}>
        <Text style={[styles.cardTitle, { color: theme.text }]}>
          Order Summary
        </Text>

        <SummaryRow label="Shirt (2)" price="₹150" theme={theme} />
        <SummaryRow label="Shoe Cleaning (1)" price="₹200" theme={theme} />
        <SummaryRow label="Saree Dry Cleaning (1)" price="₹300" theme={theme} />

        <View style={styles.divider} />

        <SummaryRow label="Estimated Total" price="₹650" theme={theme} />
        <SummaryRow label="Discount" price="-₹50" theme={theme} green />
        <SummaryRow
          label="Total Payable"
          price="₹600"
          theme={theme}
          bold
        />
      </View>

      {/* COMPLETE PICKUP */}
      <TouchableOpacity
        activeOpacity={0.9}
        style={[styles.completeBtn, { backgroundColor: theme.primary }]}
      >
        <Ionicons name="checkmark-circle" size={20} color="#000" />
        <Text style={styles.completeText}>Complete Pickup Checklist</Text>
      </TouchableOpacity>
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
    height: 46,
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
    paddingVertical: 16,
    borderRadius: 16,
    alignItems: "center",
  },
  itemText: { marginTop: 6, fontWeight: "700", fontSize: 12 },

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
  completeText: { fontWeight: "900", color: "#000" },
});
