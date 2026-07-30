import { useTheme } from "@/context/ThemeContext";
import { useAuth } from "@/context/useAuth";
import { router } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { useEffect, useRef } from "react";
import { Animated, Image, StyleSheet, Text, View } from "react-native";

export default function Splash() {
  const { theme, isDark } = useTheme();
  const { isAuthenticated, isLoading } = useAuth();

  const scale = useRef(new Animated.Value(0.85)).current;
  const opacity = useRef(new Animated.Value(0)).current;

  const hasNavigatedRef = useRef(false);

  const logoSource = isDark
    ? require("../assets/images/shiptos_red_logo_new.png")
    : require("../assets/images/shiptos_red_logo_new.png");

  useEffect(() => {
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

  useEffect(() => {
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

    navigate();
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
        <Image source={logoSource} style={styles.logo} />

        <Text style={[styles.brand, { color: theme.text }]}>Shiptos</Text>
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


  logo: {
    width: 120,
    height: 120,
    resizeMode: "contain",
    marginBottom: 12,
  },

  brand: {
    fontSize: 24,
    fontWeight: "900",
    letterSpacing: 0.8,
  },
});