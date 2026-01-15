import { useAuth } from "@/context/useAuth";
import { router, useLocalSearchParams } from "expo-router";
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

export default function RiderOTP() {
  const { phone } = useLocalSearchParams<{ phone?: string }>();
  const { login } = useAuth();

  const [otp, setOtp] = useState("");
  const [loading, setLoading] = useState(false);
  const [resendLoading, setResendLoading] = useState(false);
  const [timer, setTimer] = useState(30);
  const [message, setMessage] = useState("");

  // Animations
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(40)).current;
  const scaleAnim = useRef(new Animated.Value(0.9)).current;
  const successAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 700,
        useNativeDriver: true,
      }),
      Animated.spring(slideAnim, {
        toValue: 0,
        friction: 7,
        tension: 40,
        useNativeDriver: true,
      }),
      Animated.spring(scaleAnim, {
        toValue: 1,
        friction: 8,
        useNativeDriver: true,
      }),
    ]).start();
  }, []);

  useEffect(() => {
    if (message) {
      Animated.sequence([
        Animated.spring(successAnim, {
          toValue: 1,
          friction: 6,
          useNativeDriver: true,
        }),
        Animated.delay(2500),
        Animated.timing(successAnim, {
          toValue: 0,
          duration: 300,
          useNativeDriver: true,
        }),
      ]).start(() => setMessage(""));
    }
  }, [message]);

  /* ================= SAME SEND / RESEND OTP API ================= */
  const handleGetOtp = async () => {
    try {
      setResendLoading(true);
      setMessage("");

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
        throw new Error(data.message || "Failed to resend OTP");
      }

      setTimer(30);
      setOtp("");
      setMessage("OTP sent successfully ✓");
    } catch (error: any) {
      Alert.alert("Error", error.message);
    } finally {
      setResendLoading(false);
    }
  };

  /* ================= TIMER ================= */
  useEffect(() => {
    if (timer === 0) return;
    const interval = setInterval(() => {
      setTimer((prev) => prev - 1);
    }, 1000);
    return () => clearInterval(interval);
  }, [timer]);

  /* ================= VERIFY OTP ================= */
  const handleVerifyOtp = async () => {
    if (otp.length !== 6) {
      Alert.alert("Invalid OTP", "Enter a valid 6 digit OTP");
      return;
    }

    try {
      setLoading(true);

      const res = await fetch(`${API_URL}/verifyOtp`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-client-type": "mobile",
        },
        body: JSON.stringify({ phoneNumber: phone, otp }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.message || "OTP verification failed");
      }

      await login(
        {
          id: data.data.user._id,
          name: data.data.user.name,
          email: data.data.user.email,
          phone: data.data.user.phone,
          role: data.data.user.role,
          plant: data.data.user.plant,
        },
        data.tokens.accessToken
      );

      router.replace("/(rider)/(tabs)/dashboard");
    } catch (error: any) {
      Alert.alert("Error", error.message);
    } finally {
      setLoading(false);
    }
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
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
          {/* Back Button */}
          <TouchableOpacity 
            style={styles.backButton}
            onPress={() => router.back()}
            activeOpacity={0.7}
          >
            <Text style={styles.backIcon}>←</Text>
          </TouchableOpacity>

          {/* Header */}
          <Animated.View
            style={[
              styles.headerSection,
              {
                opacity: fadeAnim,
                transform: [{ translateY: slideAnim }, { scale: scaleAnim }],
              },
            ]}
          >
            <View style={styles.iconWrapper}>
              <View style={styles.iconOuter}>
                <View style={styles.iconInner}>
                  <Text style={styles.lockIcon}>🔐</Text>
                </View>
              </View>
            </View>
            
            <Text style={styles.pageTitle}>Verify OTP</Text>
            <Text style={styles.pageSubtitle}>
              We've sent a verification code to
            </Text>
          </Animated.View>

          {/* Phone Display */}
          <Animated.View
            style={[
              styles.phoneSection,
              {
                opacity: fadeAnim,
                transform: [{ translateY: slideAnim }],
              },
            ]}
          >
            <View style={styles.phoneCard}>
              <View style={styles.phoneInfo}>
                <Text style={styles.phoneLabel}>Mobile Number</Text>
                <View style={styles.phoneRow}>
                  <Text style={styles.flagEmoji}>🇮🇳</Text>
                  <Text style={styles.phoneNumber}>+91 {phone}</Text>
                </View>
              </View>
              <TouchableOpacity 
                style={styles.editButton}
                onPress={() => router.back()}
                activeOpacity={0.8}
              >
                <Text style={styles.editIcon}>✏️</Text>
              </TouchableOpacity>
            </View>
          </Animated.View>

          {/* Success Message */}
          {message && (
            <Animated.View
              style={[
                styles.successCard,
                {
                  opacity: successAnim,
                  transform: [
                    { scale: successAnim },
                    {
                      translateY: successAnim.interpolate({
                        inputRange: [0, 1],
                        outputRange: [-20, 0],
                      }),
                    },
                  ],
                },
              ]}
            >
              <Text style={styles.successIcon}>✓</Text>
              <Text style={styles.successText}>{message}</Text>
            </Animated.View>
          )}

          {/* OTP Input Card */}
          <Animated.View
            style={[
              styles.otpCard,
              {
                opacity: fadeAnim,
                transform: [{ translateY: slideAnim }],
              },
            ]}
          >
            <View style={styles.otpHeader}>
              <Text style={styles.otpLabel}>Enter 6-Digit Code</Text>
              <View style={styles.timerBadge}>
                <Text style={styles.timerIcon}>⏱</Text>
                <Text style={styles.timerText}>{formatTime(timer)}</Text>
              </View>
            </View>

            <TextInput
              placeholder="000000"
              placeholderTextColor="#334155"
              style={styles.otpInput}
              keyboardType="number-pad"
              maxLength={6}
              value={otp}
              onChangeText={setOtp}
              autoFocus
            />

            <View style={styles.otpDots}>
              {[0, 1, 2, 3, 4, 5].map((index) => (
                <View
                  key={index}
                  style={[
                    styles.dot,
                    otp.length > index && styles.dotFilled,
                  ]}
                />
              ))}
            </View>

            <TouchableOpacity
              style={[styles.verifyButton, loading && styles.verifyButtonLoading]}
              onPress={handleVerifyOtp}
              disabled={loading}
              activeOpacity={0.9}
            >
              <View style={styles.buttonContent}>
                {loading ? (
                  <ActivityIndicator color="#0a0f0d" size="small" />
                ) : (
                  <>
                    <Text style={styles.verifyButtonText}>Verify & Continue</Text>
                    <View style={styles.buttonArrowCircle}>
                      <Text style={styles.buttonArrow}>→</Text>
                    </View>
                  </>
                )}
              </View>
            </TouchableOpacity>
          </Animated.View>

          {/* Resend Section */}
          <Animated.View
            style={[
              styles.resendSection,
              {
                opacity: fadeAnim,
                transform: [{ translateY: slideAnim }],
              },
            ]}
          >
            <Text style={styles.resendQuestion}>Didn't receive the code?</Text>
            <TouchableOpacity
              onPress={handleGetOtp}
              disabled={timer > 0 || resendLoading}
              style={styles.resendButton}
              activeOpacity={0.7}
            >
              <Text
                style={[
                  styles.resendText,
                  (timer > 0 || resendLoading) && styles.resendTextDisabled,
                ]}
              >
                {resendLoading
                  ? "Sending OTP..."
                  : timer > 0
                  ? `Resend in ${timer}s`
                  : "Resend OTP"}
              </Text>
            </TouchableOpacity>
          </Animated.View>

          {/* Info Card */}
          <Animated.View
            style={[
              styles.infoCard,
              {
                opacity: fadeAnim,
              },
            ]}
          >
            <Text style={styles.infoIcon}>💬</Text>
            <Text style={styles.infoText}>
              OTP will be sent via WhatsApp to your registered mobile number
            </Text>
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
    paddingTop: 50,
    paddingBottom: 30,
    justifyContent: "center",
  },
  backButton: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: "rgba(15, 23, 42, 0.6)",
    borderWidth: 2,
    borderColor: "rgba(16, 185, 129, 0.1)",
    alignItems: "center",
    justifyContent: "center",

  },
  backIcon: {
    fontSize: 22,
    color: "#10b981",
    fontWeight: "900",
  },
  headerSection: {
    alignItems: "center",
    marginBottom: 28,
  },
  iconWrapper: {
    marginBottom: 20,
  },
  iconOuter: {
    width: 80,
    height: 80,
    borderRadius: 24,
    backgroundColor: "rgba(16, 185, 129, 0.08)",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "rgba(16, 185, 129, 0.15)",
  },
  iconInner: {
    width: 64,
    height: 64,
    borderRadius: 20,
    backgroundColor: "rgba(16, 185, 129, 0.12)",
    alignItems: "center",
    justifyContent: "center",
  },
  lockIcon: {
    fontSize: 32,
  },
  pageTitle: {
    fontSize: 32,
    fontWeight: "900",
    color: "#ffffff",
    marginBottom: 8,
    letterSpacing: -0.5,
  },
  pageSubtitle: {
    fontSize: 14,
    color: "#94a3b8",
    textAlign: "center",
  },
  phoneSection: {
    marginBottom: 20,
  },
  phoneCard: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "rgba(15, 23, 42, 0.6)",
    borderRadius: 18,
    padding: 18,
    borderWidth: 1,
    borderColor: "rgba(16, 185, 129, 0.1)",
  },
  phoneInfo: {
    flex: 1,
  },
  phoneLabel: {
    fontSize: 11,
    color: "#64748b",
    fontWeight: "600",
    marginBottom: 6,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  phoneRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  flagEmoji: {
    fontSize: 18,
  },
  phoneNumber: {
    fontSize: 17,
    fontWeight: "700",
    color: "#10b981",
    letterSpacing: 0.5,
  },
  editButton: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: "rgba(16, 185, 129, 0.1)",
    alignItems: "center",
    justifyContent: "center",
  },
  editIcon: {
    fontSize: 16,
  },
  successCard: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(16, 185, 129, 0.12)",
    borderWidth: 1,
    borderColor: "rgba(16, 185, 129, 0.3)",
    borderRadius: 16,
    paddingVertical: 14,
    paddingHorizontal: 20,
    marginBottom: 20,
    gap: 10,
  },
  successIcon: {
    fontSize: 18,
    color: "#10b981",
  },
  successText: {
    color: "#10b981",
    fontWeight: "700",
    fontSize: 14,
  },
  otpCard: {
    backgroundColor: "rgba(15, 23, 42, 0.6)",
    borderRadius: 24,
    padding: 24,
    borderWidth: 1,
    borderColor: "rgba(16, 185, 129, 0.1)",
    marginBottom: 24,
  },
  otpHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 20,
  },
  otpLabel: {
    fontSize: 14,
    fontWeight: "700",
    color: "#e2e8f0",
    letterSpacing: 0.5,
  },
  timerBadge: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(16, 185, 129, 0.1)",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 10,
    gap: 6,
  },
  timerIcon: {
    fontSize: 12,
  },
  timerText: {
    fontSize: 13,
    fontWeight: "700",
    color: "#10b981",
  },
  otpInput: {
    height: 70,
    backgroundColor: "rgba(15, 23, 42, 0.8)",
    borderRadius: 16,
    borderWidth: 2,
    borderColor: "rgba(16, 185, 129, 0.2)",
    color: "#ffffff",
    fontSize: 32,
    fontWeight: "800",
    textAlign: "center",
    letterSpacing: 12,
    marginBottom: 16,
  },
  otpDots: {
    flexDirection: "row",
    justifyContent: "center",
    gap: 12,
    marginBottom: 24,
  },
  dot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: "rgba(16, 185, 129, 0.15)",
    borderWidth: 2,
    borderColor: "rgba(16, 185, 129, 0.2)",
  },
  dotFilled: {
    backgroundColor: "#10b981",
    borderColor: "#10b981",
  },
  verifyButton: {
    backgroundColor: "#10b981",
    borderRadius: 16,
    overflow: "hidden",
  },
  verifyButtonLoading: {
    opacity: 0.7,
  },
  buttonContent: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 18,
    gap: 12,
  },
  verifyButtonText: {
    fontSize: 17,
    fontWeight: "800",
    color: "#0a0f0d",
    letterSpacing: 0.3,
  },
  buttonArrowCircle: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: "rgba(10, 15, 13, 0.15)",
    alignItems: "center",
    justifyContent: "center",
  },
  buttonArrow: {
    fontSize: 16,
    color: "#0a0f0d",
    fontWeight: "900",
  },
  resendSection: {
    alignItems: "center",
    marginBottom: 20,
  },
  resendQuestion: {
    fontSize: 13,
    color: "#64748b",
    marginBottom: 10,
  },
  resendButton: {
    paddingVertical: 8,
    paddingHorizontal: 16,
  },
  resendText: {
    fontSize: 15,
    fontWeight: "700",
    color: "#10b981",
  },
  resendTextDisabled: {
    color: "#475569",
  },
  infoCard: {
    flexDirection: "row",
    alignItems: "flex-start",
    backgroundColor: "rgba(15, 23, 42, 0.4)",
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: "rgba(16, 185, 129, 0.08)",
    gap: 12,
  },
  infoIcon: {
    fontSize: 18,
    marginTop: 2,
  },
  infoText: {
    flex: 1,
    fontSize: 12,
    color: "#94a3b8",
    lineHeight: 18,
  },
});