import React, { useEffect, useRef } from "react";
import { Animated, StyleSheet, View } from "react-native";

interface UniversalLoaderProps {
  size?: number;
  fullscreen?: boolean;
}

export default function UniversalLoader({
  size = 48,
  fullscreen = true,
}: UniversalLoaderProps) {
  const rotateAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.loop(
      Animated.timing(rotateAnim, {
        toValue: 1,
        duration: 900,
        useNativeDriver: true,
      })
    ).start();
  }, []);

  const rotate = rotateAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ["0deg", "360deg"],
  });

  return (
    <View
      style={[
        styles.container,
        fullscreen && styles.fullscreen,
      ]}
    >
      <Animated.View
        style={[
          styles.loader,
          {
            width: size,
            height: size,
            borderRadius: size / 2,
            transform: [{ rotate }],
          },
        ]}
      />
    </View>
  );
}

/* ================= STYLES ================= */

const styles = StyleSheet.create({
  container: {
    alignItems: "center",
    justifyContent: "center",
  },

  fullscreen: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.08)",
  },

  loader: {
    borderWidth: 4,
    borderColor: "#A7F3D0",        // light teal
    borderTopColor: "#14B8A6",     // main teal
  },
});
