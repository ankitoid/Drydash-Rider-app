import { router } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { useEffect, useRef } from "react";
// import "react-native-gesture-handler";

import {
  Animated,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useTheme } from "../context/ThemeContext";

SplashScreen.preventAutoHideAsync(); // IMPORTANT

export default function Splash() {
  const { theme } = useTheme();

  const scale = useRef(new Animated.Value(0.85)).current;
  const opacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(opacity, {
        toValue: 1,
        duration: 1500,
        useNativeDriver: true,
      }),
      Animated.spring(scale, {
        toValue: 1,
        friction: 6,
        useNativeDriver: true,
      }),
    ]).start(async () => {
      setTimeout(async () => {
        await SplashScreen.hideAsync();
        router.replace("/(auth)/rider-login");
      }, 2000);
    });
  }, []);

  return (
    <View
      style={[
        styles.container,
        { backgroundColor: theme.background },
      ]}
    >
      <Animated.View
        style={{
          transform: [{ scale }],
          opacity,
          alignItems: "center",
        }}
      >
        <View
          style={[
            styles.logoCircle,
            { backgroundColor: theme.primary },
          ]}
        >
          <Text style={styles.logoText}>Dry</Text>
        </View>

        <Text style={[styles.brand, { color: theme.text }]}>
          Dry Dash
        </Text>

        <Text
          style={[
            styles.tagline,
            { color: theme.subText },
          ]}
        >
          Rider App
        </Text>
      </Animated.View>
    </View>
  );
}
const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },

  logoCircle: {
    width: 84,
    height: 84,
    borderRadius: 42,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 14,
  },

  logoText: {
    fontSize: 28,
    fontWeight: "900",
    color: "#000",
  },

  brand: {
    fontSize: 24,
    fontWeight: "900",
    letterSpacing: 0.8,
  },

  tagline: {
    fontSize: 13,
    marginTop: 6,
  },
});
