import { router } from "expo-router";
import { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Animated,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";

const API_URL = "https://api.drydash.in/api/v1/auth";

export default function RiderLogin() {
  const [phone, setPhone] = useState("");
  const [loading, setLoading] = useState(false);
  const [isFocused, setIsFocused] = useState(false);

  // Animations
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(40)).current;
  const scaleAnim = useRef(new Animated.Value(0.9)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 800,
        useNativeDriver: true,
      }),
      Animated.spring(slideAnim, {
        toValue: 0,
        friction: 6,
        tension: 40,
        useNativeDriver: true,
      }),
      Animated.spring(scaleAnim, {
        toValue: 1,
        friction: 7,
        tension: 40,
        useNativeDriver: true,
      }),
    ]).start();
  }, []);

  const handleGetOtp = async () => {
    if (phone.length !== 10) {
      Alert.alert(
        "Invalid Mobile Number",
        "Please enter a valid 10-digit mobile number."
      );
      return;
    }
    try {
      setLoading(true);
      const res = await fetch(`${API_URL}/loginthroughotp`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-client-type": "mobile",
        },
        body: JSON.stringify({ phoneNumber: phone }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.message);
      }
      router.push({
        pathname: "/(auth)/rider-otp",
        params: { phone },
      });
    } catch (error: any) {
      Alert.alert(
        "Unable to Send OTP",
        error.message || "Please try again after some time."
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#0a0f0d" />
      
      <KeyboardAvoidingView 
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={styles.keyboardView}
      >
        <ScrollView 
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {/* Header Section */}
          <Animated.View
            style={[
              styles.headerSection,
              {
                opacity: fadeAnim,
                transform: [{ translateY: slideAnim }, { scale: scaleAnim }],
              },
            ]}
          >
            {/* <View style={styles.logoWrapper}>
              <View style={styles.logoOuter}>
                <View style={styles.logoInner}>
                  <Text style={styles.sparkle}>✨</Text>
                </View>
              </View>
            </View> */}
            
            <Text style={styles.brandTitle}>DryDash</Text>
            <View style={styles.captainBadge}>
              <View style={styles.badgeDot} />
              <Text style={styles.captainText}>Captain Login</Text>
            </View>
          </Animated.View>

          {/* Main Content */}
          <Animated.View
            style={[
              styles.mainContent,
              {
                opacity: fadeAnim,
                transform: [{ translateY: slideAnim }],
              },
            ]}
          >
            <View style={styles.welcomeBox}>
              <Text style={styles.welcomeTitle}>Welcome Back! 👋</Text>
              <Text style={styles.welcomeDesc}>
                Enter your mobile number to get started.
              </Text>
            </View>

            {/* Input Card */}
            <View style={styles.inputCard}>
              <View style={styles.inputHeader}>
                <Text style={styles.inputLabel}>Mobile Number</Text>
              </View>
              
              <View style={[
                styles.phoneInputWrapper,
                isFocused && styles.phoneInputFocused
              ]}>
                <View style={styles.countryCodeBox}>
                  <Text style={styles.flagEmoji}>🇮🇳</Text>
                  <Text style={styles.countryCode}>+91</Text>
                </View>
                <TextInput
                  placeholder="00000 00000"
                  placeholderTextColor="#4a5568"
                  style={styles.phoneInput}
                  keyboardType="phone-pad"
                  value={phone}
                  maxLength={10}
                  onChangeText={setPhone}
                  onFocus={() => setIsFocused(true)}
                  onBlur={() => setIsFocused(false)}
                />
              </View>

              <TouchableOpacity
                style={[styles.otpButton, loading && styles.otpButtonLoading]}
                onPress={handleGetOtp}
                disabled={loading}
                activeOpacity={0.9}
              >
                <View style={styles.buttonContent}>
                  {loading ? (
                    <ActivityIndicator color="#0a0f0d" size="small" />
                  ) : (
                    <>
                      <Text style={styles.buttonText}>Get OTP</Text>
                      <View style={styles.arrowCircle}>
                        <Text style={styles.arrow}>→</Text>
                      </View>
                    </>
                  )}
                </View>
              </TouchableOpacity>
            </View>

          </Animated.View>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#0a0f0d",
  },
  keyboardView: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: 24,
    paddingTop: 30,
    paddingBottom: 20,
    justifyContent: "center",
  },
  headerSection: {
    alignItems: "center",
    marginBottom: 10,
  },
  logoWrapper: {
    marginBottom: 10,
  },
  logoOuter: {
    width: 90,
    height: 90,
    borderRadius: 28,
    backgroundColor: "rgba(16, 185, 129, 0.08)",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "rgba(16, 185, 129, 0.15)",
  },
  logoInner: {
    width: 70,
    height: 70,
    borderRadius: 22,
    backgroundColor: "rgba(16, 185, 129, 0.12)",
    alignItems: "center",
    justifyContent: "center",
  },
  sparkle: {
    fontSize: 36,
  },
  brandTitle: {
    fontSize: 36,
    fontWeight: "900",
    color: "#10b981",
    letterSpacing: -1.5,
    marginBottom: 12,
  },
  captainBadge: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(16, 185, 129, 0.1)",
    paddingHorizontal: 20,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "rgba(16, 185, 129, 0.2)",
    gap: 8,
  },
  badgeDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: "#10b981",
  },
  captainText: {
    color: "#10b981",
    fontSize: 8,
    fontWeight: "700",
    letterSpacing: 1,
    textTransform: "uppercase",
  },
  mainContent: {
    flex: 1,
    marginTop: 20,
    // justifyContent: "center",
  },
  welcomeBox: {
    marginBottom: 20,
  },
  welcomeTitle: {
    fontSize: 24,
    fontWeight: "800",
    color: "#ffffff",
    marginBottom: 4,
    letterSpacing: -0.5,
  },
  welcomeDesc: {
    fontSize: 12,
    color: "#94a3b8",
    lineHeight: 22,
  },
  inputCard: {
    backgroundColor: "rgba(15, 23, 42, 0.6)",
    borderRadius: 24,
    padding: 24,
    borderWidth: 1,
    borderColor: "rgba(16, 185, 129, 0.1)",
    marginBottom: 24,
  },
  inputHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 16,
  },
  inputLabel: {
    fontSize: 12,
    fontWeight: "700",
    color: "#e2e8f0",
    letterSpacing: 0.5,
  },
  securityBadge: {
    backgroundColor: "rgba(16, 185, 129, 0.1)",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  securityText: {
    fontSize: 11,
    color: "#10b981",
    fontWeight: "600",
  },
  phoneInputWrapper: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(15, 23, 42, 0.8)",
    borderRadius: 16,
    borderWidth: 2,
    borderColor: "rgba(16, 185, 129, 0.15)",
    marginBottom: 20,
    overflow: "hidden",
  },
  phoneInputFocused: {
    borderColor: "rgba(16, 185, 129, 0.4)",
    backgroundColor: "rgba(15, 23, 42, 1)",
  },
  countryCodeBox: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 10,
    paddingVertical: 16,
    backgroundColor: "rgba(16, 185, 129, 0.08)",
    gap: 8,
  },
  flagEmoji: {
    fontSize: 20,
    color: "#10b981",
  },
  countryCode: {
    fontSize: 17,
    fontWeight: "700",
    color: "#10b981",
  },
  phoneInput: {
    flex: 1,
    paddingHorizontal: 16,
    paddingVertical: 18,
    fontSize: 17,
    fontWeight: "600",
    color: "#ffffff",
    letterSpacing: 1,
  },
  otpButton: {
    backgroundColor: "#10b981",
    borderRadius: 16,
    overflow: "hidden",
  },
  otpButtonLoading: {
    opacity: 0.7,
  },
  buttonContent: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 18,
    paddingHorizontal: 24,
    gap: 12,
  },
  buttonText: {
    fontSize: 17,
    fontWeight: "800",
    color: "#0a0f0d",
    letterSpacing: 0.3,
  },
  arrowCircle: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: "rgba(10, 15, 13, 0.15)",
    alignItems: "center",
    justifyContent: "center",
  },
  arrow: {
    fontSize: 16,
    color: "#0a0f0d",
    fontWeight: "900",
  },
  featuresBox: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-around",
    backgroundColor: "rgba(15, 23, 42, 0.4)",
    borderRadius: 20,
    padding: 20,
    borderWidth: 1,
    borderColor: "rgba(16, 185, 129, 0.08)",
  },
  featureItem: {
    alignItems: "center",
    gap: 6,
  },
  featureIcon: {
    fontSize: 22,
  },
  featureText: {
    fontSize: 11,
    color: "#94a3b8",
    fontWeight: "600",
  },
  featureDivider: {
    width: 1,
    height: 40,
    backgroundColor: "rgba(16, 185, 129, 0.1)",
  },
});