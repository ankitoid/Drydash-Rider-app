// components/LocationStatus.tsx
import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@/context/ThemeContext';
import { locationService } from '@/services/locationService';

interface LocationStatusProps {
  onPress?: () => void;
}

export const LocationStatus: React.FC<LocationStatusProps> = ({ onPress }) => {
  const { theme } = useTheme();
  const [isTracking, setIsTracking] = useState(false);
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);

  useEffect(() => {
    // Check tracking status periodically
    const interval = setInterval(() => {
      const status = locationService.getTrackingStatus();
      setIsTracking(status.isTracking);
      if (status.lastSentTime) {
        setLastUpdate(new Date(status.lastSentTime));
      }
    }, 5000);

    return () => clearInterval(interval);
  }, []);

  const getTimeAgo = () => {
    if (!lastUpdate) return 'Never';
    
    const diff = Date.now() - lastUpdate.getTime();
    const minutes = Math.floor(diff / 60000);
    
    if (minutes < 1) return 'Just now';
    if (minutes === 1) return '1 min ago';
    if (minutes < 60) return `${minutes} mins ago`;
    
    const hours = Math.floor(minutes / 60);
    return `${hours} hour${hours > 1 ? 's' : ''} ago`;
  };

  const handleToggleTracking = async () => {
    if (isTracking) {
      locationService.stopTracking();
      setIsTracking(false);
    } else {
      // You would need to pass user here, maybe from context
      // For now, just show message
      onPress?.();
    }
  };

  return (
    <TouchableOpacity
      style={[
        styles.container,
        { backgroundColor: theme.card, borderColor: theme.border },
      ]}
      onPress={handleToggleTracking}
      activeOpacity={0.8}
    >
      <View style={styles.content}>
        <View style={styles.statusRow}>
          <Ionicons
            name={isTracking ? 'location' : 'location-outline'}
            size={20}
            color={isTracking ? '#10b981' : theme.subText}
          />
          <Text style={[styles.statusText, { color: theme.text }]}>
            {isTracking ? 'Live Tracking ON' : 'Tracking OFF'}
          </Text>
        </View>
        
        <Text style={[styles.timeText, { color: theme.subText }]}>
          Last update: {getTimeAgo()}
        </Text>
        
        <View style={styles.indicatorContainer}>
          <View
            style={[
              styles.indicator,
              { backgroundColor: isTracking ? '#10b981' : '#ef4444' },
            ]}
          />
          <Text
            style={[
              styles.indicatorText,
              { color: isTracking ? '#10b981' : '#ef4444' },
            ]}
          >
            {isTracking ? '● LIVE' : '● OFFLINE'}
          </Text>
        </View>
      </View>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  container: {
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    marginHorizontal: 16,
    marginVertical: 8,
  },
  content: {
    flexDirection: 'column',
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  statusText: {
    fontSize: 16,
    fontWeight: '700',
    marginLeft: 10,
  },
  timeText: {
    fontSize: 12,
    marginBottom: 8,
  },
  indicatorContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  indicator: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 6,
  },
  indicatorText: {
    fontSize: 11,
    fontWeight: '700',
  },
});