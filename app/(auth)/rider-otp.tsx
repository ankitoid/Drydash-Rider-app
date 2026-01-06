import { router, useLocalSearchParams } from "expo-router";
import { useEffect, useRef, useState } from "react";
import {
  Animated,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";

export default function RiderOTP() {
  const { phone } = useLocalSearchParams<{ phone?: string }>();
  const [otp, setOtp] = useState("");

  // animations
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

  return (
    <View style={styles.container}>
      <Animated.View
        style={{
          width: "100%",
          transform: [{ translateY }],
          opacity,
        }}
      >
        <Text style={styles.heading}>Verify OTP</Text>

        <Text style={styles.subText}>
          OTP sent to{" "}
          <Text style={styles.phone}>
            +91 {phone || "XXXXXXXXXX"}
          </Text>
        </Text>

        <TextInput
          placeholder="Enter 6-digit OTP"
          placeholderTextColor="#94a3b8"
          style={styles.input}
          keyboardType="number-pad"
          maxLength={6}
          value={otp}
          onChangeText={setOtp}
        />

        <TouchableOpacity
          style={styles.button}
          onPress={() =>
            router.replace("/(rider)/(tabs)/dashboard")
          }
        >
          <Text style={styles.buttonText}>Verify & Login</Text>
        </TouchableOpacity>

        {/* WRONG NUMBER */}
        <TouchableOpacity
          onPress={() => router.back()}
          style={styles.wrongBtn}
        >
          <Text style={styles.wrongText}>
            Wrong number? Change
          </Text>
        </TouchableOpacity>

        {/* RESEND */}
        <TouchableOpacity>
          <Text style={styles.resend}>Resend OTP</Text>
        </TouchableOpacity>
      </Animated.View>
    </View>
  );
}
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#0B1F1A",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 20,
  },

  heading: {
    color: "#fff",
    fontSize: 22,
    fontWeight: "900",
    marginBottom: 10,
    textAlign: "center",
  },

  subText: {
    color: "#94a3b8",
    fontSize: 13,
    textAlign: "center",
    marginBottom: 24,
  },

  phone: {
    color: "#34F5C5",
    fontWeight: "700",
  },

  input: {
    width: "100%",
    height: 54,
    backgroundColor: "#102B25",
    borderRadius: 14,
    paddingHorizontal: 16,
    color: "#fff",
    marginBottom: 20,
    textAlign: "center",
    fontSize: 18,
    letterSpacing: 4,
  },

  button: {
    width: "100%",
    height: 54,
    backgroundColor: "#34F5C5",
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
  },

  buttonText: {
    fontWeight: "800",
    color: "#000",
    fontSize: 16,
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
