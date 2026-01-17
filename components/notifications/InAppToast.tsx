import { Ionicons } from "@expo/vector-icons";
import React, { useEffect, useRef } from "react";
import {
    Animated,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from "react-native";

type Props = {
  visible: boolean;
  title: string;
  message: string;
  duration?: number; // ms
  onClose: () => void;
};

export default function InAppToast({
  visible,
  title,
  message,
  duration = 5000, // ✅ default 2 sec
  onClose,
}: Props) {
  const opacity = useRef(new Animated.Value(0)).current;
  const scale = useRef(new Animated.Value(0.95)).current;
  const progress = useRef(new Animated.Value(1)).current;

  const hideTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!visible) return;

    // ✅ clear old timer if any
    if (hideTimerRef.current) {
      clearTimeout(hideTimerRef.current);
      hideTimerRef.current = null;
    }

    // ✅ stop previous animations (important)
    opacity.stopAnimation();
    scale.stopAnimation();
    progress.stopAnimation();

    // reset progress
    progress.setValue(1);

    // animate in
    Animated.parallel([
      Animated.timing(opacity, {
        toValue: 1,
        duration: 150,
        useNativeDriver: true,
      }),
      Animated.timing(scale, {
        toValue: 1,
        duration: 150,
        useNativeDriver: true,
      }),
    ]).start();

    // animate progress bar
    Animated.timing(progress, {
      toValue: 0,
      duration,
      useNativeDriver: false,
    }).start();

    // ✅ manual timer to close after duration
    hideTimerRef.current = setTimeout(() => {
      onClose();
    }, duration);

    return () => {
      if (hideTimerRef.current) {
        clearTimeout(hideTimerRef.current);
        hideTimerRef.current = null;
      }
    };
  }, [visible, duration]);

  useEffect(() => {
    if (!visible) {
      // animate out
      Animated.parallel([
        Animated.timing(opacity, {
          toValue: 0,
          duration: 120,
          useNativeDriver: true,
        }),
        Animated.timing(scale, {
          toValue: 0.95,
          duration: 120,
          useNativeDriver: true,
        }),
      ]).start();
    }
  }, [visible]);

  if (!visible) return null;

  const progressWidth = progress.interpolate({
    inputRange: [0, 1],
    outputRange: ["0%", "100%"],
  });

  return (
    <View style={styles.overlay}>
      <Animated.View
        style={[
          styles.modal,
          {
            opacity,
            transform: [{ scale }],
          },
        ]}
      >
        <View style={styles.headerRow}>
          <View style={{ flex: 1 }}>
            <Text style={styles.title}>{title}</Text>
            <Text style={styles.message}>{message}</Text>
          </View>

          <TouchableOpacity
            onPress={() => {
              // ✅ clear timer on manual close
              if (hideTimerRef.current) {
                clearTimeout(hideTimerRef.current);
                hideTimerRef.current = null;
              }
              onClose();
            }}
            style={styles.closeBtn}
          >
            <Ionicons name="close" size={22} color="#fff" />
          </TouchableOpacity>
        </View>

        <View style={styles.progressTrack}>
          <Animated.View
            style={[styles.progressFill, { width: progressWidth }]}
          />
        </View>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: "center",
    justifyContent: "center",
    zIndex: 99999,
  },
  modal: {
    width: "92%",
    maxWidth: 420,
    paddingVertical: 22,
    paddingHorizontal: 20,
    borderRadius: 10, // ✅ more square
    backgroundColor: "#111827",
    borderWidth: 1,
    borderColor: "#374151",
  },
  headerRow: {
    flexDirection: "row",
    gap: 10,
    alignItems: "flex-start",
  },
closeBtn: {
  width: 40,
  height: 40,
  borderRadius: 8, // ✅ squarer button too
  backgroundColor: "#1F2937",
  alignItems: "center",
  justifyContent: "center",
},

  title: {
    fontSize: 18,
    fontWeight: "900",
    color: "#fff",
    marginBottom: 6,
  },
  message: {
    fontSize: 15,
    color: "#D1D5DB",
    lineHeight: 20,
  },
progressTrack: {
  height: 6,
  backgroundColor: "#374151",
  borderRadius: 999,
  overflow: "hidden",
  marginTop: 16,
},
progressFill: {
  height: 6,
  backgroundColor: "#22C55E",
},
});
