import { useAuth } from "@/context/useAuth";
import { router, useLocalSearchParams } from "expo-router";
import { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Animated,
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

  // animation
  const translateY = useRef(new Animated.Value(30)).current;
  const opacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(opacity, {
        toValue: 1,
        duration: 500,
        useNativeDriver: true,
      }),
      Animated.spring(translateY, {
        toValue: 0,
        friction: 7,
        useNativeDriver: true,
      }),
    ]).start();
  }, []);

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
      setMessage("OTP sent successfully ✔️");
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

  return (
    <View style={styles.container}>
      <Animated.View
        style={{ width: "100%", opacity, transform: [{ translateY }] }}
      >
        <Text style={styles.heading}>Verify OTP</Text>

        <Text style={styles.subText}>
          OTP sent to <Text style={styles.phone}>+91 {phone}</Text>
        </Text>

        {message ? <Text style={styles.success}>{message}</Text> : null}

        <TextInput
          placeholder="Enter 6-digit OTP"
          placeholderTextColor="#94a3b8"
          style={styles.input}
          keyboardType="number-pad"
          maxLength={6}
          value={otp}
          onChangeText={setOtp}
        />

        <TouchableOpacity style={styles.button} onPress={handleVerifyOtp}>
          {loading ? (
            <ActivityIndicator color="#000" />
          ) : (
            <Text style={styles.buttonText}>Verify & Login</Text>
          )}
        </TouchableOpacity>

        <TouchableOpacity onPress={() => router.back()} style={styles.wrongBtn}>
          <Text style={styles.wrongText}>Wrong number? Change</Text>
        </TouchableOpacity>

        <TouchableOpacity
          onPress={handleGetOtp}
          disabled={timer > 0 || resendLoading}
        >
          <Text
            style={[
              styles.resend,
              (timer > 0 || resendLoading) && { opacity: 0.5 },
            ]}
          >
            {resendLoading
              ? "Sending OTP..."
              : timer > 0
              ? `Resend OTP in ${timer}s`
              : "Resend OTP"}
          </Text>
        </TouchableOpacity>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#0B1F1A",
    justifyContent: "center",
    paddingHorizontal: 20,
  },
  heading: {
    color: "#fff",
    fontSize: 22,
    fontWeight: "900",
    textAlign: "center",
    marginBottom: 10,
  },
  subText: {
    color: "#94a3b8",
    textAlign: "center",
    marginBottom: 8,
  },
  phone: {
    color: "#34F5C5",
    fontWeight: "700",
  },
  success: {
    textAlign: "center",
    color: "#4ADE80",
    fontWeight: "700",
    marginBottom: 12,
  },
  input: {
    height: 54,
    backgroundColor: "#102B25",
    borderRadius: 14,
    color: "#fff",
    textAlign: "center",
    fontSize: 18,
    letterSpacing: 4,
    marginBottom: 20,
  },
  button: {
    height: 54,
    backgroundColor: "#34F5C5",
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  buttonText: {
    fontWeight: "800",
    color: "#000",
  },
  wrongBtn: {
    marginTop: 18,
    alignItems: "center",
  },
  wrongText: {
    color: "#FCA5A5",
    fontWeight: "600",
  },
  resend: {
    marginTop: 14,
    textAlign: "center",
    color: "#34F5C5",
    fontWeight: "700",
  },
});