// app/(rider)/settings/location.tsx
import { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Switch,
  TouchableOpacity,
  Alert,
} from 'react-native';
import { useTheme } from '@/context/ThemeContext';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { locationService } from '@/services/locationService';

export default function LocationSettings() {
  const { theme } = useTheme();
  const [isEnabled, setIsEnabled] = useState(false);
  const [updateInterval, setUpdateInterval] = useState(60); // seconds
  const [distanceFilter, setDistanceFilter] = useState(10); // meters

  const handleToggleLocation = async () => {
    if (!isEnabled) {
      const granted = await locationService.requestPermissions();
      if (granted) {
        setIsEnabled(true);
        Alert.alert('Success', 'Location tracking enabled');
      } else {
        Alert.alert(
          'Permission Required',
          'Please enable location permissions in your device settings to track your location.',
          [
            { text: 'Cancel', style: 'cancel' },
            { text: 'Open Settings', onPress: () => router.back() },
          ]
        );
      }
    } else {
      locationService.stopTracking();
      setIsEnabled(false);
    }
  };

  const updateTrackingSettings = () => {
    locationService.updateConfig({
      updateInterval: updateInterval * 1000,
      distanceFilter,
    });
    Alert.alert('Settings Updated', 'Your tracking preferences have been saved');
  };

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: theme.background }]}
      contentContainerStyle={styles.content}
    >
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => router.back()}
          style={styles.backButton}
        >
          <Ionicons name="arrow-back" size={24} color={theme.text} />
        </TouchableOpacity>
        <Text style={[styles.title, { color: theme.text }]}>
          Location Settings
        </Text>
      </View>

      {/* Main Toggle */}
      <View style={[styles.card, { backgroundColor: theme.card }]}>
        <View style={styles.cardHeader}>
          <Ionicons name="location" size={24} color="#10b981" />
          <Text style={[styles.cardTitle, { color: theme.text }]}>
            Live Location Tracking
          </Text>
        </View>
        
        <View style={styles.toggleRow}>
          <Text style={[styles.toggleLabel, { color: theme.subText }]}>
            Enable real-time location tracking
          </Text>
          <Switch
            value={isEnabled}
            onValueChange={handleToggleLocation}
            trackColor={{ false: '#767577', true: '#10b981' }}
            thumbColor={isEnabled ? '#f4f3f4' : '#f4f3f4'}
          />
        </View>
        
        <Text style={[styles.cardDescription, { color: theme.subText }]}>
          Your location will be shared with the admin dashboard every 60 seconds
          to track delivery progress. This helps in providing better service
          to customers.
        </Text>
      </View>

      {/* Tracking Settings */}
      <View style={[styles.card, { backgroundColor: theme.card }]}>
        <Text style={[styles.cardTitle, { color: theme.text }]}>
          Tracking Preferences
        </Text>

        {/* Update Interval */}
        <View style={styles.settingRow}>
          <Text style={[styles.settingLabel, { color: theme.text }]}>
            Update Interval
          </Text>
          <View style={styles.intervalOptions}>
            {[30, 60, 120, 300].map((seconds) => (
              <TouchableOpacity
                key={seconds}
                style={[
                  styles.intervalOption,
                  updateInterval === seconds && styles.intervalOptionActive,
                ]}
                onPress={() => setUpdateInterval(seconds)}
              >
                <Text
                  style={[
                    styles.intervalText,
                    updateInterval === seconds && styles.intervalTextActive,
                  ]}
                >
                  {seconds}s
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Distance Filter */}
        <View style={styles.settingRow}>
          <Text style={[styles.settingLabel, { color: theme.text }]}>
            Movement Sensitivity
          </Text>
          <View style={styles.distanceOptions}>
            {[5, 10, 25, 50].map((meters) => (
              <TouchableOpacity
                key={meters}
                style={[
                  styles.distanceOption,
                  distanceFilter === meters && styles.distanceOptionActive,
                ]}
                onPress={() => setDistanceFilter(meters)}
              >
                <Text
                  style={[
                    styles.distanceText,
                    distanceFilter === meters && styles.distanceTextActive,
                  ]}
                >
                  {meters}m
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        <TouchableOpacity
          style={[styles.saveButton, { backgroundColor: theme.primary }]}
          onPress={updateTrackingSettings}
        >
          <Text style={styles.saveButtonText}>Save Preferences</Text>
        </TouchableOpacity>
      </View>

      {/* Privacy Info */}
      <View style={[styles.card, { backgroundColor: theme.card }]}>
        <Text style={[styles.cardTitle, { color: theme.text }]}>
          Privacy & Battery
        </Text>
        <View style={styles.infoItem}>
          <Ionicons name="shield-checkmark" size={20} color="#10b981" />
          <Text style={[styles.infoText, { color: theme.subText }]}>
            Your location data is only visible to authorized admin personnel
          </Text>
        </View>
        <View style={styles.infoItem}>
          <Ionicons name="battery-charging" size={20} color="#f59e0b" />
          <Text style={[styles.infoText, { color: theme.subText }]}>
            Optimized for minimal battery usage
          </Text>
        </View>
        <View style={styles.infoItem}>
          <Ionicons name="cloud-upload" size={20} color="#8b5cf6" />
          <Text style={[styles.infoText, { color: theme.subText }]}>
            Location data is automatically deleted after 30 days
          </Text>
        </View>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    padding: 16,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 24,
  },
  backButton: {
    marginRight: 16,
  },
  title: {
    fontSize: 24,
    fontWeight: '900',
  },
  card: {
    borderRadius: 16,
    padding: 20,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.05)',
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: '800',
    marginLeft: 12,
  },
  toggleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  toggleLabel: {
    fontSize: 14,
    flex: 1,
    marginRight: 16,
  },
  cardDescription: {
    fontSize: 13,
    lineHeight: 20,
  },
  settingRow: {
    marginBottom: 24,
  },
  settingLabel: {
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 12,
  },
  intervalOptions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  intervalOption: {
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 12,
    backgroundColor: '#f1f5f9',
  },
  intervalOptionActive: {
    backgroundColor: '#10b981',
  },
  intervalText: {
    fontWeight: '700',
    color: '#64748b',
  },
  intervalTextActive: {
    color: '#ffffff',
  },
  distanceOptions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  distanceOption: {
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 12,
    backgroundColor: '#f1f5f9',
  },
  distanceOptionActive: {
    backgroundColor: '#8b5cf6',
  },
  distanceText: {
    fontWeight: '700',
    color: '#64748b',
  },
  distanceTextActive: {
    color: '#ffffff',
  },
  saveButton: {
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 8,
  },
  saveButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '800',
  },
  infoItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  infoText: {
    fontSize: 13,
    flex: 1,
    marginLeft: 12,
    lineHeight: 18,
  },
});