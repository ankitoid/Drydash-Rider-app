import { router } from "expo-router";
import { useState } from "react";
import { StyleSheet, Text, TextInput, TouchableOpacity, View } from "react-native";

export default function RiderLogin() {
  const [phone, setPhone] = useState("");

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
        onChangeText={setPhone}
        maxLength={10}
      />

      <TouchableOpacity
        style={styles.button}
        onPress={() =>
          router.push({
            pathname: "/(auth)/rider-otp",
            params: { phone },
          })
        }
      >
        <Text style={styles.buttonText}>Get OTP</Text>
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
