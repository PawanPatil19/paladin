import { Platform } from 'react-native';
import * as Location from 'expo-location';
import * as TaskManager from 'expo-task-manager';
import { activityService } from './services/activityService';
import { primaryMetricText } from './domain/activity';
import { acceptedMovement } from './rideUtils';
import { storage } from './storage';

export const LOCATION_TASK = 'paladin-active-ride-location';

if (Platform.OS !== 'web' && !TaskManager.isTaskDefined(LOCATION_TASK)) {
  TaskManager.defineTask(LOCATION_TASK, async ({ data, error }) => {
    if (error || !data) return;
    const locations = (data as { locations: Location.LocationObject[] }).locations;
    const latest = locations.at(-1);
    const session = await storage.session();
    if (!latest || !session || session.sharingEnabled === false) return;
    const stats = await storage.rideStats(session.code);
    const next = { latitude: latest.coords.latitude, longitude: latest.coords.longitude, timestamp: latest.timestamp };
    const moved = stats.lastCoordinate ? acceptedMovement(stats.lastCoordinate, next, latest.coords.accuracy) : 0;
    const speedKmh = Math.max(0, (latest.coords.speed || 0) * 3.6);
    await storage.saveRideStats({ ...stats, distanceKm: stats.distanceKm + moved, maxSpeedKmh: Math.max(stats.maxSpeedKmh, speedKmh), lastCoordinate: next });
    await activityService.updateLocation(session.code, session.participantId, { latitude: next.latitude, longitude: next.longitude, accuracy: latest.coords.accuracy }, primaryMetricText(session.group?.activity || 'ride', speedKmh, 'metric'), latest.coords.speed || 0).catch(() => undefined);
  });
}

export async function locationPermissionStatus() {
  const foreground = await Location.getForegroundPermissionsAsync();
  const background = Platform.OS === 'web' ? null : await Location.getBackgroundPermissionsAsync();
  return { foreground, background };
}

export async function requestRideLocation() {
  const foreground = await Location.requestForegroundPermissionsAsync();
  if (foreground.status !== 'granted') return { foreground, background: null };
  const background = Platform.OS === 'web' ? null : await Location.requestBackgroundPermissionsAsync();
  return { foreground, background };
}

export async function startBackgroundTracking() {
  if (Platform.OS === 'web') return false;
  const permission = await locationPermissionStatus();
  if (permission.foreground.status !== 'granted' || permission.background?.status !== 'granted') return false;
  const alreadyStarted = await Location.hasStartedLocationUpdatesAsync(LOCATION_TASK);
  if (!alreadyStarted) {
    await Location.startLocationUpdatesAsync(LOCATION_TASK, {
      accuracy: Location.Accuracy.High, distanceInterval: 10, timeInterval: 5000,
      pausesUpdatesAutomatically: false, showsBackgroundLocationIndicator: true,
      foregroundService: { notificationTitle: 'Paladin activity active', notificationBody: 'Sharing your live location with your group.', notificationColor: '#123524' },
    });
  }
  return true;
}

export async function stopBackgroundTracking() {
  if (Platform.OS === 'web') return;
  if (await Location.hasStartedLocationUpdatesAsync(LOCATION_TASK)) await Location.stopLocationUpdatesAsync(LOCATION_TASK);
}
