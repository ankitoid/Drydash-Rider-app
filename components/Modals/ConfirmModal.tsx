import { BlurView } from "expo-blur";
import React from "react";
import {
    Modal,
    Platform,
    Pressable,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from "react-native";

interface ConfirmModalProps {
  visible: boolean;
  title?: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  onConfirm: () => void;
  onCancel: () => void;
}

export default function ConfirmModal({
  visible,
  title = "Confirm Action",
  message,
  confirmText = "Yes, Confirm",
  cancelText = "Cancel",
  onConfirm,
  onCancel,
}: ConfirmModalProps) {
  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      statusBarTranslucent
      onRequestClose={onCancel}
    >
      {/* ================= BACKGROUND ================= */}

      {/* ✅ REAL BLUR → iOS + Web */}
      {(Platform.OS === "ios" || Platform.OS === "web") && (
        <BlurView
          intensity={60}
          tint="dark"
          style={StyleSheet.absoluteFill}
        />
      )}

      {/* ✅ ANDROID FALLBACK (industry standard) */}
      <Pressable style={styles.overlay} onPress={onCancel}>
        {/* Stop propagation so modal itself is clickable */}
        <Pressable style={styles.modal}>
          <Text style={styles.title}>{title}</Text>

          <Text style={styles.message}>{message}</Text>

          <View style={styles.actions}>
            <TouchableOpacity
              style={[styles.btn, styles.cancelBtn]}
              onPress={onCancel}
              activeOpacity={0.8}
            >
              <Text style={styles.cancelText}>{cancelText}</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.btn, styles.confirmBtn]}
              onPress={onConfirm}
              activeOpacity={0.8}
            >
              <Text style={styles.confirmText}>{confirmText}</Text>
            </TouchableOpacity>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

/* ================= STYLES ================= */

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor:
      Platform.OS === "android"
        ? "rgba(0,0,0,0.55)" // 🔥 Android blur substitute
        : "transparent",
    alignItems: "center",
    justifyContent: "center",
  },

  modal: {
    width: "86%",
    backgroundColor: "#fff",
    borderRadius: 18,
    padding: 20,
    elevation: 10, // Android shadow
    shadowColor: "#000", // iOS shadow
    shadowOpacity: 0.2,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
  },

  title: {
    fontSize: 18,
    fontWeight: "900",
    marginBottom: 8,
    color: "#111",
  },

  message: {
    fontSize: 14,
    color: "#555",
    lineHeight: 20,
    marginBottom: 22,
  },

  actions: {
    flexDirection: "row",
    justifyContent: "flex-end",
    gap: 10,
  },

  btn: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 12,
    minWidth: 90,
    alignItems: "center",
  },

  cancelBtn: {
    backgroundColor: "#E5E7EB",
  },

  confirmBtn: {
    backgroundColor: "#22C55E",
  },

  cancelText: {
    color: "#111",
    fontWeight: "700",
  },

  confirmText: {
    color: "#000",
    fontWeight: "900",
  },
});
