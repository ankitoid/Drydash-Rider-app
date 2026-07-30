// app/(rider)/wallet/index.tsx
import { useAuth } from "@/context/useAuth";
import { Ionicons } from "@expo/vector-icons";
import React, { useState } from "react";
import {
  Alert,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useTheme } from "@/context/ThemeContext";

type Transaction = {
  id: string;
  title: string;
  date: string;
  amount: string;
  balance: string;
};

const WITHDRAWAL_HISTORY: Transaction[] = [
  {
    id: "w_1",
    title: "Bank Withdrawal",
    date: "Jun 7, 2026",
    amount: "-₹200.00",
    balance: "₹2600",
  },
  {
    id: "w_2",
    title: "Bank Withdrawal",
    date: "May 31, 2026",
    amount: "-₹200.00",
    balance: "₹2800",
  },
  {
    id: "w_3",
    title: "Bank Withdrawal",
    date: "May 26, 2026",
    amount: "-₹200.00",
    balance: "₹3000",
  },
];

const EARNING_HISTORY: Transaction[] = [
  {
    id: "e_1",
    title: "Order Delivery Commission",
    date: "Today, 02:45 PM",
    amount: "+₹112.50",
    balance: "₹2450.00",
  },
  {
    id: "e_2",
    title: "Weekly Bonus Incentive",
    date: "Yesterday, 06:00 PM",
    amount: "+₹500.00",
    balance: "₹2337.50",
  },
];

export default function WalletScreen() {
  const { theme } = useTheme();
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<"earning" | "withdrawal">("withdrawal");
  const [refreshing, setRefreshing] = useState<boolean>(false);

  const onRefresh = () => {
    setRefreshing(true);
    setTimeout(() => setRefreshing(false), 800);
  };

  const handleWithdraw = () => {
    Alert.alert(
      "Minimum Withdrawal Amount",
      "Minimum withdrawal amount is ₹5,000. Your current available balance is ₹2,450.00.",
      [{ text: "OK" }]
    );
  };

  const currentList = activeTab === "withdrawal" ? WITHDRAWAL_HISTORY : EARNING_HISTORY;

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: theme.background }]}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={onRefresh}
          tintColor={theme.primary}
        />
      }
    >
      {/* HEADER TITLE FROM FIGMA TOPAPPBAR */}
      <View style={styles.topAppBar}>
        <Text style={[styles.topAppBarTitle, { color: theme.text }]}>Withdraw Funds</Text>
      </View>

      {/* BALANCE CARD FROM FIGMA */}
      <View
        style={[
          styles.balanceCard,
          {
            backgroundColor: theme.card,
            borderColor: theme.border,
          },
        ]}
      >
        <Text style={[styles.balanceSub, { color: theme.subText }]}>Available Balance</Text>
        <Text style={[styles.balanceAmount, { color: theme.text }]}>₹2,450.00</Text>

        <View style={styles.securityRow}>
          <Ionicons name="shield-checkmark" size={14} color={theme.primary} />
          <Text style={[styles.securityText, { color: theme.primary }]}>
            Your earnings are safe with us
          </Text>
        </View>
      </View>

      {/* TODAY'S EARNINGS TILE FROM FIGMA */}
      <View
        style={[
          styles.earningsTile,
          {
            backgroundColor: theme.card,
            borderColor: theme.border,
          },
        ]}
      >
        <View style={styles.earningsTileHeader}>
          <Ionicons name="cash-outline" size={18} color={theme.text} />
          <Text style={[styles.earningsTileLabel, { color: theme.text }]}>
            Today's Earnings
          </Text>
        </View>
        <Text style={[styles.earningsTileAmount, { color: theme.text }]}>₹112.50</Text>
        <Text style={[styles.earningsTileNote, { color: theme.primary }]}>
          Average earnings per order: ₹30
        </Text>
      </View>

      {/* WITHDRAWAL NOTICE & CTA FROM FIGMA */}
      <View style={styles.withdrawalSection}>
        <View style={styles.noticeRow}>
          <Ionicons name="information-circle-outline" size={16} color={theme.text} />
          <Text style={[styles.noticeText, { color: theme.text }]}>
            Minimum withdrawal amount is ₹5,000
          </Text>
        </View>

        <TouchableOpacity
          style={[styles.withdrawBtn, { backgroundColor: theme.primary }]}
          onPress={handleWithdraw}
        >
          <Ionicons name="card-outline" size={18} color="#FFFFFF" />
          <Text style={styles.withdrawBtnText}>Withdraw ₹2,450.00</Text>
        </TouchableOpacity>
      </View>

      {/* TRANSACTIONS TABS FROM FIGMA */}
      <View style={styles.tabsRow}>
        <TouchableOpacity
          style={[
            styles.tabBtn,
            activeTab === "earning" && { backgroundColor: theme.primarySoft },
          ]}
          onPress={() => setActiveTab("earning")}
        >
          <Ionicons
            name="hand-left-outline"
            size={16}
            color={activeTab === "earning" ? theme.primary : theme.text}
          />
          <Text
            style={[
              styles.tabBtnText,
              { color: activeTab === "earning" ? theme.primary : theme.text },
            ]}
          >
            Earning History
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[
            styles.tabBtn,
            activeTab === "withdrawal" && { backgroundColor: theme.primarySoft },
          ]}
          onPress={() => setActiveTab("withdrawal")}
        >
          <Ionicons
            name="wallet-outline"
            size={16}
            color={activeTab === "withdrawal" ? theme.primary : theme.text}
          />
          <Text
            style={[
              styles.tabBtnText,
              { color: activeTab === "withdrawal" ? theme.primary : theme.text },
            ]}
          >
            Withdrawal History
          </Text>
        </TouchableOpacity>
      </View>

      {/* HISTORY LIST FROM FIGMA */}
      <View style={styles.historyList}>
        {currentList.map((item) => (
          <View
            key={item.id}
            style={[
              styles.historyItem,
              {
                backgroundColor: theme.card,
                borderColor: theme.border,
              },
            ]}
          >
            <View style={styles.itemLeft}>
              <View style={[styles.itemIconBg, { backgroundColor: theme.primarySoft }]}>
                <Ionicons
                  name={activeTab === "withdrawal" ? "arrow-up" : "arrow-down"}
                  size={16}
                  color={theme.primary}
                />
              </View>
              <View>
                <Text style={[styles.itemTitle, { color: theme.text }]}>{item.title}</Text>
                <Text style={[styles.itemDate, { color: theme.subText }]}>{item.date}</Text>
              </View>
            </View>

            <View style={styles.itemRight}>
              <Text
                style={[
                  styles.itemAmount,
                  { color: activeTab === "withdrawal" ? theme.text : theme.success },
                ]}
              >
                {item.amount}
              </Text>
              <Text style={[styles.itemBalance, { color: theme.subText }]}>
                *Balance: {item.balance}
              </Text>
            </View>
          </View>
        ))}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingHorizontal: 16,
    paddingTop: 16,
  },

  topAppBar: {
    marginBottom: 16,
  },

  topAppBarTitle: {
    fontSize: 18,
    fontWeight: "800",
  },

  balanceCard: {
    padding: 20,
    borderRadius: 20,
    borderWidth: 1,
    marginBottom: 12,
  },

  balanceSub: {
    fontSize: 14,
    fontWeight: "500",
  },

  balanceAmount: {
    fontSize: 36,
    fontWeight: "900",
    marginVertical: 4,
  },

  securityRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginTop: 4,
  },

  securityText: {
    fontSize: 12,
    fontWeight: "600",
  },

  earningsTile: {
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
    marginBottom: 16,
    gap: 4,
  },

  earningsTileHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },

  earningsTileLabel: {
    fontSize: 12,
    fontWeight: "600",
  },

  earningsTileAmount: {
    fontSize: 18,
    fontWeight: "800",
  },

  earningsTileNote: {
    fontSize: 10,
    fontWeight: "600",
  },

  withdrawalSection: {
    marginBottom: 20,
    gap: 10,
  },

  noticeRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },

  noticeText: {
    fontSize: 11,
    fontWeight: "500",
  },

  withdrawBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 14,
    borderRadius: 14,
  },

  withdrawBtnText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "800",
  },

  tabsRow: {
    flexDirection: "row",
    gap: 8,
    marginBottom: 16,
  },

  tabBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 10,
    borderRadius: 12,
  },

  tabBtnText: {
    fontSize: 13,
    fontWeight: "700",
  },

  historyList: {
    gap: 10,
    paddingBottom: 32,
  },

  historyItem: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: 14,
    borderRadius: 14,
    borderWidth: 1,
  },

  itemLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },

  itemIconBg: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
  },

  itemTitle: {
    fontSize: 14,
    fontWeight: "700",
  },

  itemDate: {
    fontSize: 12,
    marginTop: 2,
  },

  itemRight: {
    alignItems: "flex-end",
  },

  itemAmount: {
    fontSize: 14,
    fontWeight: "800",
  },

  itemBalance: {
    fontSize: 10,
    marginTop: 2,
  },
});
