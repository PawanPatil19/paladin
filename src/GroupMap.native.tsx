import { useEffect, useMemo, useRef } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import MapView, { Marker, Polyline } from 'react-native-maps';
import { Ionicons } from '@expo/vector-icons';
import { colors } from './ui/theme';

type MapMember = {
  id: string;
  name: string;
  initials: string;
  color: string;
  pace: string;
  latitude: number;
  longitude: number;
  isYou?: boolean;
};

type MapDestination = {
  name: string;
  latitude: number;
  longitude: number;
};

type MapPoint = { latitude: number; longitude: number };

const SG_REGION = {
  latitude: 1.2903,
  longitude: 103.8612,
  latitudeDelta: 0.033,
  longitudeDelta: 0.033,
};

export function GroupMap({ members, start, destination, route: plannedRoute = [], follow = true, fitKey = 0, onGesture }: { members: MapMember[]; start: MapDestination; destination: MapDestination; route?: MapPoint[]; follow?: boolean; fitKey?: number; onGesture?: () => void }) {
  const mapRef = useRef<MapView>(null);
  const route = useMemo(
    () => plannedRoute.length >= 2 ? plannedRoute : [{ latitude: start.latitude, longitude: start.longitude }, { latitude: destination.latitude, longitude: destination.longitude }],
    [plannedRoute, start, destination],
  );

  useEffect(() => {
    if (route.length < 2) return;
    mapRef.current?.fitToCoordinates(route, {
      animated: true,
      edgePadding: { top: 120, right: 60, bottom: 310, left: 60 },
    });
  }, [fitKey]);

  const me = members.find((member) => member.isYou);
  useEffect(() => {
    if (!follow || !me) return;
    mapRef.current?.animateCamera({ center: { latitude: me.latitude, longitude: me.longitude } }, { duration: 500 });
  }, [follow, me?.latitude, me?.longitude]);

  return (
    <MapView
      ref={mapRef}
      style={StyleSheet.absoluteFill}
      initialRegion={SG_REGION}
      showsCompass={false}
      showsPointsOfInterests={false}
      toolbarEnabled={false}
      onPanDrag={onGesture}
      onMapReady={() => mapRef.current?.fitToCoordinates(route, { animated: false, edgePadding: { top: 120, right: 60, bottom: 310, left: 60 } })}
    >
      <Polyline coordinates={route} strokeColor={colors.accent} strokeWidth={5} />
      <Marker coordinate={{ latitude: start.latitude, longitude: start.longitude }} title={`Start: ${start.name}`}>
        <View style={styles.startMarker}><Text style={styles.startMarkerText}>A</Text></View>
      </Marker>
      <Marker coordinate={{ latitude: destination.latitude, longitude: destination.longitude }} title={destination.name}>
        <View style={styles.destinationMarker}><Ionicons name="flag" size={18} color={colors.ink} /></View>
      </Marker>
      {members.map((member) => (
        <Marker key={member.id} coordinate={{ latitude: member.latitude, longitude: member.longitude }} title={member.name} description={member.isYou ? 'You' : `${member.pace} pace`}>
          <View style={[styles.avatarRing, member.isYou && styles.avatarRingYou]}>
            <View style={[styles.avatar, { backgroundColor: member.color }]}><Text style={styles.avatarText}>{member.initials}</Text></View>
          </View>
        </Marker>
      ))}
    </MapView>
  );
}

const styles = StyleSheet.create({
  avatarRing: { borderRadius: 24, borderWidth: 3, borderColor: colors.paper, shadowColor: colors.ink, shadowOpacity: 0.22, shadowRadius: 4, elevation: 5 },
  avatarRingYou: { borderColor: colors.lime, borderWidth: 4 },
  avatar: { width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center' },
  avatarText: { color: colors.white, fontSize: 13, fontWeight: '900' },
  destinationMarker: { width: 42, height: 42, borderRadius: 14, backgroundColor: colors.lime, borderWidth: 3, borderColor: colors.paper, alignItems: 'center', justifyContent: 'center' },
  startMarker: { width: 34, height: 34, borderRadius: 17, backgroundColor: colors.ink, borderWidth: 3, borderColor: colors.paper, alignItems: 'center', justifyContent: 'center' },
  startMarkerText: { color: colors.white, fontSize: 11, fontWeight: '900' },
});
