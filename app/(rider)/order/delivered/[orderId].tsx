import { Ionicons } from "@expo/vector-icons";
import { router, useLocalSearchParams } from "expo-router";
import React from "react";
import {
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useTheme } from "../../../../context/ThemeContext";

export default function DeliveredOrderDetails() {
  const { orderId } = useLocalSearchParams<{ orderId: string }>();
  const { theme, isDark } = useTheme();

  const successGreen = "#22C55E";

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: theme.background }}
      contentContainerStyle={{ paddingBottom: 120 }}
      showsVerticalScrollIndicator={false}
    >
      {/* HEADER */}
      <View
        style={[
          styles.header,
          {
            backgroundColor: isDark
              ? theme.card
              : theme.primary,
            borderBottomColor: theme.border,
          },
        ]}
      >
        <TouchableOpacity onPress={() => router.back()}>
          <Ionicons
            name="arrow-back"
            size={22}
            color={isDark ? theme.text : "#fff"}
          />
        </TouchableOpacity>

        <Text
          style={[
            styles.headerTitle,
            { color: isDark ? theme.text : "#fff" },
          ]}
        >
          Dry Dash
        </Text>

        <View
          style={[
            styles.avatar,
            { backgroundColor: theme.primarySoft },
          ]}
        >
          <Text
            style={[
              styles.avatarText,
              { color: theme.primary },
            ]}
          >
            A
          </Text>
        </View>
      </View>

      {/* STATUS */}
      <View style={styles.statusWrap}>
        <View
          style={[
            styles.statusBadge,
            {
              backgroundColor: isDark
                ? successGreen + "22"
                : "#DCFCE7",
            },
          ]}
        >
          <Ionicons
            name="checkmark-circle"
            size={18}
            color={successGreen}
          />
          <Text
            style={[
              styles.statusText,
              { color: successGreen },
            ]}
          >
            Delivered
          </Text>
        </View>

        <Text
          style={[
            styles.orderId,
            { color: theme.text },
          ]}
        >
          {orderId}
        </Text>
      </View>

      {/* DELIVERY DETAILS */}
      <View style={[styles.card, { backgroundColor: theme.card }]}>
        <Text style={[styles.cardTitle, { color: theme.text }]}>
          Delivery Details
        </Text>

        <DetailRow
          icon="person-outline"
          label="Customer"
          value="Mrs. Sharma"
          theme={theme}
        />

        <DetailRow
          icon="location-outline"
          label="Delivered To"
          value="Green Valley Apartments, MG Road, Bengaluru"
          theme={theme}
        />

        <DetailRow
          icon="time-outline"
          label="Delivered At"
          value="Today, 6:30 PM"
          theme={theme}
        />
      </View>

      {/* ITEMS */}
      <View style={[styles.card, { backgroundColor: theme.card }]}>
        <Text style={[styles.cardTitle, { color: theme.text }]}>
          Items Delivered
        </Text>

        <ItemRow label="Shirt (2)" price="₹150" theme={theme} />
        <ItemRow label="Shoe Cleaning (1)" price="₹200" theme={theme} />
        <ItemRow label="Saree Dry Cleaning (1)" price="₹300" theme={theme} />
      </View>

      {/* PAYMENT */}
      <View style={[styles.card, { backgroundColor: theme.card }]}>
        <Text style={[styles.cardTitle, { color: theme.text }]}>
          Payment Summary
        </Text>

        <SummaryRow label="Subtotal" price="₹650" theme={theme} />
        <SummaryRow
          label="Discount"
          price="-₹50"
          green
          theme={theme}
        />

        <View
          style={[
            styles.divider,
            { backgroundColor: theme.border },
          ]}
        />

        <SummaryRow
          label="Total Paid"
          price="₹600"
          bold
          theme={theme}
        />
        <SummaryRow
          label="Payment Mode"
          price="Online (UPI)"
          theme={theme}
        />
      </View>

      {/* CONFIRMATION */}
      <View style={[styles.card, { backgroundColor: theme.card }]}>
        <Text style={[styles.cardTitle, { color: theme.text }]}>
          Delivery Confirmation
        </Text>

        <ConfirmRow
          icon="camera-outline"
          text="Delivery Photo Uploaded"
          theme={theme}
        />

        <ConfirmRow
          icon="person-circle-outline"
          text="Customer Signature Captured"
          theme={theme}
        />
      </View>
    </ScrollView>
  );
}

/* ---------- SMALL COMPONENTS ---------- */

function DetailRow({ icon, label, value, theme }: any) {
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

function ItemRow({ label, price, theme }: any) {
  return (
    <View style={styles.itemRow}>
      <Text style={[styles.itemLabel, { color: theme.text }]}>
        {label}
      </Text>
      <Text style={[styles.itemPrice, { color: theme.text }]}>
        {price}
      </Text>
    </View>
  );
}

function SummaryRow({ label, price, bold, green, theme }: any) {
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

function ConfirmRow({ icon, text, theme }: any) {
  return (
    <View style={styles.confirmRow}>
      <Ionicons name={icon} size={20} color={theme.primary} />
      <Text style={[styles.confirmText, { color: theme.text }]}>
        {text}
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
    borderBottomWidth: 1,
  },
  headerTitle: { fontWeight: "900", fontSize: 16 },

  avatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarText: { fontWeight: "800" },

  statusWrap: {
    alignItems: "center",
    marginVertical: 14,
  },
  statusBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
  },
  statusText: { fontWeight: "900", fontSize: 13 },
  orderId: { fontSize: 20, fontWeight: "900", marginTop: 6 },

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

  itemRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 8,
  },
  itemLabel: { fontSize: 14, fontWeight: "700" },
  itemPrice: { fontSize: 14, fontWeight: "800" },

  summaryRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 8,
  },
  summaryLabel: { fontSize: 14 },
  summaryPrice: { fontSize: 14, fontWeight: "800" },

  divider: {
    height: 1,
    marginVertical: 10,
  },

  confirmRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginBottom: 10,
  },
  confirmText: { fontWeight: "700", fontSize: 14 },
});
