import React from "react";
import {
  ActivityIndicator,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";

interface FollowupPickupModalProps {
  visible: boolean;
  customerName?: string;
  loading?: boolean;
  onCreatePickup: () => void;
  onSkip: () => void;
}

export default function FollowupPickupModal({
  visible,
  customerName,
  loading = false,
  onCreatePickup,
  onSkip,
}: FollowupPickupModalProps) {
  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      statusBarTranslucent
      onRequestClose={onSkip}
    >
      <Pressable style={styles.overlay} onPress={onSkip}>
        <Pressable style={styles.sheet}>
          <Text style={styles.badge}>Delivery Completed</Text>
          <Text style={styles.title}>Create next pickup?</Text>
          <Text style={styles.message}>
            {customerName
              ? `Do you want to create a new pickup for ${customerName}?`
              : "Do you want to create a new pickup for this customer?"}
          </Text>

          <View style={styles.actions}>
            <TouchableOpacity
              style={[styles.button, styles.secondaryButton]}
              onPress={onSkip}
              activeOpacity={0.85}
              disabled={loading}
            >
              <Text style={styles.secondaryText}>No, Back</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.button, styles.primaryButton, loading && styles.disabledButton]}
              onPress={onCreatePickup}
              activeOpacity={0.85}
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator color="#FFFFFF" />
              ) : (
                <Text style={styles.primaryText}>Create Pickup</Text>
              )}
            </TouchableOpacity>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(15, 23, 42, 0.45)",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 24,
  },
  sheet: {
    width: "100%",
    maxWidth: 360,
    backgroundColor: "#FFFFFF",
    borderRadius: 24,
    paddingHorizontal: 22,
    paddingVertical: 24,
  },
  badge: {
    alignSelf: "flex-start",
    backgroundColor: "#DCFCE7",
    color: "#166534",
    fontSize: 12,
    fontWeight: "800",
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    marginBottom: 14,
  },
  title: {
    fontSize: 22,
    fontWeight: "900",
    color: "#0F172A",
    marginBottom: 10,
  },
  message: {
    fontSize: 14,
    lineHeight: 21,
    color: "#475569",
    marginBottom: 22,
  },
  actions: {
    flexDirection: "row",
    gap: 12,
  },
  button: {
    flex: 1,
    minHeight: 48,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  primaryButton: {
    backgroundColor: "#0F172A",
  },
  secondaryButton: {
    backgroundColor: "#E2E8F0",
  },
  disabledButton: {
    opacity: 0.75,
  },
  primaryText: {
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "800",
  },
  secondaryText: {
    color: "#0F172A",
    fontSize: 14,
    fontWeight: "800",
  },
});
