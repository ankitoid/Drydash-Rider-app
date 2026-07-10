import { NativeModules } from 'react-native';
import { API_BASE_URL } from "@/constants/apiConfig";

const { RiderTrackingModule } = NativeModules;

export const startNativeLocationTracking = async (riderId: string) => {
  try {
    if (RiderTrackingModule) {
      const result = await RiderTrackingModule.startTrip(riderId, API_BASE_URL);
      console.log('Location Tracking Started ss:', result);
      return result;
    } else {
      console.warn('RiderTrackingModule is not available. Are you running on Expo Go?');
    }
  } catch (error) {
    console.error('Failed to start native tracking', error);
  }
};

export const stopNativeLocationTracking = async () => {
  try {
    if (RiderTrackingModule) {
      const result = await RiderTrackingModule.stopTrip();
      console.log('Location Tracking Stopped:', result);
      return result;
    }
  } catch (error) {
    console.error('Failed to stop native tracking', error);
  }
};
