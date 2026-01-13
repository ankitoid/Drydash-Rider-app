import { router } from "expo-router";
import { useState } from "react";
import {
  ActivityIndicator,
  Alert,
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
 
  const handleGetOtp = async () => {
    if (phone.length !== 10) {
      Alert.alert("Invalid Number", "Enter a valid 10 digit mobile number");
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
        throw new Error(data.message || "Failed to send OTP");
      }
 
      router.push({
        pathname: "/(auth)/rider-otp",
        params: { phone },
      });
    } catch (error: any) {
      Alert.alert("Error", error.message);
    } finally {
      setLoading(false);
    }
  };
 
  return (
    <View style={styles.container}>
      <Text style={styles.brand}>Dry Dash</Text>
      <Text style={styles.heading}>Login to your Account</Text>
 
      <TextInput
        placeholder="Enter your mobile number"
        placeholderTextColor="#94a3b8"
        style={styles.input}
        keyboardType="phone-pad"
        value={phone}
        maxLength={10}
        onChangeText={setPhone}
      />
 
      <TouchableOpacity
        style={styles.button}
        onPress={handleGetOtp}
        disabled={loading}
      >
        {loading ? (
          <ActivityIndicator color="#000" />
        ) : (
          <Text style={styles.buttonText}>Get OTP</Text>
        )}
      </TouchableOpacity>
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
  brand: {
    color: "#34F5C5",
    fontSize: 26,
    fontWeight: "900",
    marginBottom: 10,
  },
  heading: {
    color: "#fff",
    fontSize: 18,
    fontWeight: "700",
    marginBottom: 30,
  },
  input: {
    width: "100%",
    height: 54,
    backgroundColor: "#102B25",
    borderRadius: 14,
    paddingHorizontal: 16,
    color: "#fff",
    marginBottom: 20,
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
  },
});