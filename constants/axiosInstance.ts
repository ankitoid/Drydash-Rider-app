import AsyncStorage from "@react-native-async-storage/async-storage";
import axios from "axios";

export const apiClient = axios.create({
  baseURL: "https://live.drydash.in", // new backend
  // baseURL: "http://localhost:3000",
  headers: { "Content-Type": "application/json" },
});

export const oldApiClient = axios.create({
  baseURL: "https://api.shiptos.com/api", // old backend
  // baseURL: "http://localhost:5001/api/",
  headers: { "Content-Type": "application/json" },
});

apiClient.interceptors.request.use(async (config) => {
  const token = await AsyncStorage.getItem("accessToken");
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});
