import React, { useEffect, useRef } from "react";
import { Animated, StyleSheet } from "react-native";

export function Skeleton({ height = 16, radius = 10 }: any) {
  const opacity = useRef(new Animated.Value(0.3)).current;

  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, {
          toValue: 0.7,
          duration: 700,
          useNativeDriver: true,
        }),
        Animated.timing(opacity, {
          toValue: 0.3,
          duration: 700,
          useNativeDriver: true,
        }),
      ])
    ).start();
  }, []);

  return (
    <Animated.View
      style={[
        styles.skeleton,
        { height, borderRadius: radius, opacity },
      ]}
    />
  );
}

const styles = StyleSheet.create({
  skeleton: {
    width: "100%",
    backgroundColor: "#CBD5E1",
  },
});
