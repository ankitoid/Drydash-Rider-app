import { useTheme } from "@/context/ThemeContext";
import { useAuth } from "@/context/useAuth";
import { router } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { useEffect, useRef } from "react";
import {
  Animated,
  StyleSheet,
  Text,
  View,
} from "react-native";

export default function Splash() {
  const { theme } = useTheme();
  const { isAuthenticated, isLoading, user } = useAuth();

  const scale = useRef(new Animated.Value(0.85)).current;
  const opacity = useRef(new Animated.Value(0)).current;

  // 🔒 Ensure navigation runs ONLY ONCE
  const hasNavigatedRef = useRef(false);



  useEffect(() => {
    // 🔑 Prevent auto hide ONLY once
    SplashScreen.preventAutoHideAsync();

    Animated.parallel([
      Animated.timing(opacity, {
        toValue: 1,
        duration: 1200,
        useNativeDriver: true,
      }),
      Animated.spring(scale, {
        toValue: 1,
        friction: 6,
        useNativeDriver: true,
      }),
    ]).start();
  }, []);

console.log("this is the user on top:: ", user)


  useEffect(() => {
    // ⏳ Wait until auth is resolved
    if (isLoading) return;
    if (hasNavigatedRef.current) return;

    hasNavigatedRef.current = true;

    const navigate = async () => {
      await SplashScreen.hideAsync();

      if (isAuthenticated) {
        router.replace("/(rider)/(tabs)/dashboard");
      } else {
        router.replace("/(auth)/rider-login");
      }
    };

    // small delay for UX smoothness
    const timer = setTimeout(navigate, 800);

    return () => clearTimeout(timer);
  }, [isLoading, isAuthenticated]);

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
