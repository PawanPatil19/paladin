import { useEffect, useMemo, useRef, useState } from 'react';
import { Ionicons } from '@expo/vector-icons';
import * as Location from 'expo-location';
import * as Speech from 'expo-speech';
import { ActivityIndicator, Linking, Modal, Platform, Pressable, SafeAreaView, ScrollView, StyleSheet, Text, View } from 'react-native';
import { activityCopy, distanceText, primaryMetricText } from '../../domain/activity';
import { GroupMap } from '../../GroupMap';
import { requestRideLocation, startBackgroundTracking } from '../../locationTracking';
import { acceptedMovement, elapsedSeconds, formatDuration, freshness } from '../../rideUtils';
import { activityService, type ApiGroup, type ApiMember } from '../../services/activityService';
import { storage, type Profile } from '../../storage';
import { Button } from '../../ui/Button';
import { colors } from '../../ui/theme';

const CHEERS = ['Let’s go!', 'Wait up!', 'Nice!', 'I’m behind', 'All good', 'Stop ahead'];

type Props = {
  group: ApiGroup;
  participantId: string;
  profile: Profile;
  online: boolean;
  reconnecting: boolean;
  onLeave: () => void;
  onEnd: (distance: number) => void;
  onStats: (distance: number, maxSpeed: number) => void;
};

function NetworkPill({ online, connecting }: { online: boolean; connecting: boolean }) {
  if (online && !connecting) return null;
  return <View style={styles.networkPill}><ActivityIndicator size="small" color={colors.ink} /><Text style={styles.networkText}>{online ? 'Reconnecting…' : 'Offline · activity stays active'}</Text></View>;
}

function Stat({ label, value }: { label: string; value: string }) {
  return <View style={styles.stat}><Text style={styles.statLabel}>{label}</Text><Text style={styles.statValue}>{value}</Text></View>;
}

export function LiveActivityScreen({ group, participantId, profile, online, reconnecting, onLeave, onEnd, onStats }: Props) {
  const [now, setNow] = useState(Date.now());
  const [voice, setVoice] = useState(profile.voiceEnabled);
  const [cheerOpen, setCheerOpen] = useState(false);
  const [confirmEnd, setConfirmEnd] = useState(false);
  const [toast, setToast] = useState('');
  const [locationError, setLocationError] = useState('');
  const [distance, setDistance] = useState(0);
  const [maxSpeed, setMaxSpeed] = useState(0);
  const [currentSpeed, setCurrentSpeed] = useState(0);
  const [follow, setFollow] = useState(true);
  const [fitKey, setFitKey] = useState(0);
  const seen = useRef(new Set(group.cheers.map((item) => item.id)));
  const queue = useRef<{ sender: string; message: string }[]>([]);
  const speaking = useRef(false);
  const previousPoint = useRef<{ latitude: number; longitude: number; timestamp: number } | null>(null);
  const host = group.hostId === participantId;
  const copy = activityCopy(group.activity);
  const elapsed = elapsedSeconds(group.startedAt, now);
  const averageSpeed = elapsed ? distance / (elapsed / 3600) : 0;
  const mapMembers = useMemo(
    () => group.members
      .filter((member): member is ApiMember & { latitude: number; longitude: number } => member.latitude != null && member.longitude != null)
      .map((member) => ({ ...member, isYou: member.id === participantId })),
    [group.members, participantId],
  );

  const playNext = () => {
    const next = queue.current.shift();
    if (!next) { speaking.current = false; return; }
    speaking.current = true;
    setToast(`${next.sender}: ${next.message}`);
    if (voice) Speech.speak(`${next.sender} says ${next.message}`, { language: 'en-SG', onDone: playNext, onStopped: playNext, onError: playNext });
    else setTimeout(playNext, 1800);
  };

  useEffect(() => { const timer = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(timer); }, []);
  useEffect(() => { storage.rideStats(group.code).then((stats) => { setDistance(stats.distanceKm); setMaxSpeed(stats.maxSpeedKmh); }); }, [group.code]);
  useEffect(() => { const timer = setInterval(async () => { const stats = await storage.rideStats(group.code); setDistance(stats.distanceKm); setMaxSpeed(stats.maxSpeedKmh); onStats(stats.distanceKm, stats.maxSpeedKmh); }, 3000); return () => clearInterval(timer); }, [group.code]);

  useEffect(() => {
    let watcher: Location.LocationSubscription | undefined;
    let demoTimer: ReturnType<typeof setInterval> | undefined;
    let cancelled = false;
    (async () => {
      if (__DEV__ && profile.demoMode) {
        setLocationError('');
        setToast('Development demo location active');
        let step = 0;
        const speedKmh = group.activity === 'run' ? 10 : 22;
        demoTimer = setInterval(async () => {
          step += 1;
          const startLat = group.start.latitude ?? 1.304;
          const startLon = group.start.longitude ?? 103.8746;
          const latitude = startLat + Math.sin(step / 5) * 0.002;
          const longitude = startLon + step * 0.00022;
          const stats = await storage.rideStats(group.code);
          const nextStats = { ...stats, distanceKm: stats.distanceKm + (group.activity === 'run' ? 0.012 : 0.025), maxSpeedKmh: Math.max(stats.maxSpeedKmh, speedKmh), lastCoordinate: { latitude, longitude, timestamp: Date.now() } };
          await storage.saveRideStats(nextStats);
          setDistance(nextStats.distanceKm); setCurrentSpeed(speedKmh); setMaxSpeed(nextStats.maxSpeedKmh);
          await activityService.updateLocation(group.code, participantId, { latitude, longitude, accuracy: 5 }, primaryMetricText(group.activity, speedKmh, profile.units), speedKmh / 3.6).catch(() => undefined);
        }, 2500);
        return;
      }
      const permission = await Location.getForegroundPermissionsAsync();
      if (permission.status !== 'granted') { setLocationError(`Location access is required so ${copy.participants} can see you.`); return; }
      setLocationError('');
      const backgroundOwnsStats = await startBackgroundTracking().catch(() => false);
      watcher = await Location.watchPositionAsync({ accuracy: Location.Accuracy.High, distanceInterval: 8, timeInterval: 4000 }, async (update) => {
        if (cancelled) return;
        const speedKmh = Math.max(0, Math.min(75, (update.coords.speed || 0) * 3.6));
        const point = { latitude: update.coords.latitude, longitude: update.coords.longitude, timestamp: update.timestamp };
        const stats = await storage.rideStats(group.code);
        const moved = !backgroundOwnsStats && previousPoint.current ? acceptedMovement(previousPoint.current, point, update.coords.accuracy) : 0;
        previousPoint.current = point;
        const nextStats = { ...stats, distanceKm: stats.distanceKm + moved, maxSpeedKmh: Math.max(stats.maxSpeedKmh, speedKmh), lastCoordinate: point };
        await storage.saveRideStats(nextStats);
        setDistance(nextStats.distanceKm); setCurrentSpeed(speedKmh); setMaxSpeed(nextStats.maxSpeedKmh);
        await activityService.updateLocation(group.code, participantId, { latitude: update.coords.latitude, longitude: update.coords.longitude, accuracy: update.coords.accuracy }, primaryMetricText(group.activity, speedKmh, profile.units), update.coords.speed || 0).catch(() => undefined);
      });
    })();
    return () => { cancelled = true; if (demoTimer) clearInterval(demoTimer); watcher?.remove(); };
  }, [group.code, group.activity, group.start.latitude, group.start.longitude, participantId, profile.demoMode, profile.units, copy.participants]);

  useEffect(() => {
    for (const cheer of group.cheers) if (!seen.current.has(cheer.id)) {
      seen.current.add(cheer.id);
      if (cheer.senderId !== participantId) queue.current.push({ sender: cheer.senderName, message: cheer.message });
    }
    if (!speaking.current && queue.current.length) playNext();
  }, [group.cheers, participantId, voice]);
  useEffect(() => () => { Speech.stop(); }, []);

  const sendCheer = async (message: string) => {
    setCheerOpen(false);
    try { await activityService.cheer(group.code, participantId, message); setToast(`Sent: ${message}`); }
    catch { setToast('Cheer not sent. Check your connection.'); }
  };

  return (
    <View style={styles.fill}>
      <GroupMap
        members={mapMembers}
        start={{ ...group.start, latitude: group.start.latitude ?? 1.304, longitude: group.start.longitude ?? 103.8746 }}
        destination={{ ...group.destination, latitude: group.destination.latitude ?? 1.3018, longitude: group.destination.longitude ?? 103.9127 }}
        follow={follow}
        fitKey={fitKey}
        onGesture={() => setFollow(false)}
      />
      <SafeAreaView style={styles.overlay} pointerEvents="box-none">
        <View pointerEvents="box-none">
          <View style={styles.header}>
            <Pressable accessibilityRole="button" accessibilityLabel={host ? `End ${copy.noun}` : `Leave ${copy.noun}`} onPress={host ? () => setConfirmEnd(true) : onLeave} style={styles.mapButton}><Ionicons name="close" size={22} color={colors.ink} /></Pressable>
            <View style={styles.liveBadge}><View style={styles.liveDot} /><Ionicons name={ACTIVITY_ICON[group.activity]} size={14} color={colors.white} /><Text style={styles.liveText}>{group.code} · LIVE</Text></View>
            <Pressable accessibilityRole="button" accessibilityLabel={voice ? 'Mute voice cheers' : 'Enable voice cheers'} onPress={() => { const next = !voice; setVoice(next); storage.saveProfile({ ...profile, voiceEnabled: next }); if (voice) Speech.stop(); }} style={[styles.mapButton, voice && styles.mapButtonActive]}><Ionicons name={voice ? 'headset' : 'headset-outline'} size={21} color={voice ? colors.white : colors.ink} /></Pressable>
          </View>
          <NetworkPill online={online} connecting={reconnecting} />
          {toast ? <View style={styles.toast}><Ionicons name="volume-high" size={18} color={colors.ink} /><Text style={styles.toastText}>{toast}</Text><Pressable accessibilityLabel="Dismiss message" onPress={() => setToast('')}><Ionicons name="close" size={16} color={colors.soft} /></Pressable></View> : null}
        </View>
        <View style={styles.mapTools}>
          <Pressable accessibilityRole="button" accessibilityLabel="Recenter map" onPress={() => setFollow(true)} style={[styles.mapTool, follow && styles.mapToolActive]}><Ionicons name="locate" size={19} color={colors.ink} /><Text style={styles.mapToolText}>Recenter</Text></Pressable>
          <Pressable accessibilityRole="button" accessibilityLabel="Show whole group" onPress={() => { setFollow(false); setFitKey((key) => key + 1); }} style={styles.mapTool}><Ionicons name="people" size={19} color={colors.ink} /><Text style={styles.mapToolText}>Group</Text></Pressable>
        </View>
        <View style={styles.bottomPanel}>
          {locationError ? <View style={styles.permissionCard}><Ionicons name="location-outline" size={22} color={colors.red} /><View style={styles.flex}><Text style={styles.memberName}>Location needed</Text><Text style={styles.meta}>{locationError}</Text></View><Pressable onPress={async () => { const result = await requestRideLocation(); if (result.foreground.status === 'granted') setLocationError(''); else if (!result.foreground.canAskAgain) Linking.openSettings(); }}><Text style={styles.link}>Fix</Text></Pressable></View> : null}
          <View style={styles.routeStrip}>
            <View style={styles.routePoint}><View style={styles.startDot} /><View style={styles.flex}><Text style={styles.routeEyebrow}>START</Text><Text style={styles.routeName} numberOfLines={1}>{group.start.name}</Text></View></View>
            <Ionicons name="arrow-forward" size={17} color={colors.mint} />
            <View style={styles.routePoint}><Ionicons name="flag" size={16} color={colors.lime} /><View style={styles.flex}><Text style={styles.routeEyebrow}>FINISH</Text><Text style={styles.routeName} numberOfLines={1}>{group.destination.name}</Text></View></View>
          </View>
          <View style={styles.stats}>
            <Stat label="TIME" value={formatDuration(elapsed)} />
            <Stat label="DISTANCE" value={distanceText(distance, profile.units)} />
            <Stat label={copy.primaryMetric} value={primaryMetricText(group.activity, currentSpeed, profile.units)} />
            <Stat label={group.activity === 'run' ? 'AVG PACE' : 'AVERAGE'} value={primaryMetricText(group.activity, averageSpeed, profile.units)} />
          </View>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.riderStrip}>{group.members.map((member) => { const live = freshness(member.lastSeen, now); return <View key={member.id} style={styles.riderChip}><View style={[styles.statusDot, { backgroundColor: live.state === 'live' ? '#59B87C' : live.state === 'delayed' ? '#E4A83A' : '#9CA7A2' }]} /><Text style={styles.memberName}>{member.name}</Text><Text style={styles.meta}>{live.label}</Text></View>; })}</ScrollView>
          <Button label="Cheer" icon="megaphone" onPress={() => setCheerOpen(true)} />
        </View>
      </SafeAreaView>

      <Modal visible={cheerOpen} transparent animationType="slide" onRequestClose={() => setCheerOpen(false)}><Pressable style={styles.backdrop} onPress={() => setCheerOpen(false)} /><SafeAreaView style={styles.sheet}><View style={styles.sheetHandle} /><Text style={styles.sheetTitle}>Quick cheer</Text><Text style={styles.sheetBody}>One tap sends a spoken message to the group.</Text><View style={styles.cheerGrid}>{CHEERS.map((cheer) => <Pressable accessibilityRole="button" key={cheer} onPress={() => sendCheer(cheer)} style={styles.cheer}><Ionicons name="volume-high" size={18} color={colors.ink} /><Text style={styles.cheerText}>{cheer}</Text></Pressable>)}</View></SafeAreaView></Modal>
      <Modal visible={confirmEnd} transparent animationType="fade" onRequestClose={() => setConfirmEnd(false)}><View style={styles.confirmBackdrop}><View style={styles.confirmCard}><View style={styles.confirmIcon}><Ionicons name="flag" size={26} color={colors.ink} /></View><Text style={styles.confirmTitle}>Finish this {copy.noun}?</Text><Text style={styles.confirmBody}>Location sharing will stop for everyone and the group will receive its activity summary.</Text><View style={styles.confirmActions}><Button label={`Keep ${group.activity === 'run' ? 'running' : 'riding'}`} secondary onPress={() => setConfirmEnd(false)} /><Button label={`Finish ${copy.noun}`} onPress={() => { setConfirmEnd(false); onEnd(distance); }} /></View></View></View></Modal>
    </View>
  );
}

const ACTIVITY_ICON = { run: 'walk' as const, ride: 'bicycle' as const };

const styles = StyleSheet.create({
  fill: { flex: 1 }, flex: { flex: 1 }, overlay: { position: 'relative', flex: 1, justifyContent: 'space-between', zIndex: 1000 },
  header: { paddingHorizontal: 16, paddingTop: Platform.OS === 'android' ? 16 : 8, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  mapButton: { width: 46, height: 46, borderRadius: 23, backgroundColor: colors.paper, borderWidth: 1, borderColor: 'rgba(18,53,36,0.10)', alignItems: 'center', justifyContent: 'center' }, mapButtonActive: { backgroundColor: colors.ink },
  liveBadge: { minHeight: 40, backgroundColor: colors.ink, borderRadius: 20, paddingHorizontal: 13, flexDirection: 'row', alignItems: 'center', gap: 6 }, liveDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: colors.accent }, liveText: { color: colors.white, fontWeight: '900', fontSize: 10, letterSpacing: 1 },
  networkPill: { alignSelf: 'center', marginTop: 10, paddingHorizontal: 12, paddingVertical: 7, borderRadius: 14, backgroundColor: colors.lime, flexDirection: 'row', alignItems: 'center', gap: 7 }, networkText: { color: colors.ink, fontWeight: '800', fontSize: 11 },
  toast: { marginHorizontal: 16, marginTop: 10, backgroundColor: colors.lime, borderRadius: 16, paddingHorizontal: 13, paddingVertical: 11, flexDirection: 'row', alignItems: 'center', gap: 9 }, toastText: { flex: 1, color: colors.ink, fontSize: 12, fontWeight: '700' },
  mapTools: { position: 'absolute', right: 16, top: Platform.OS === 'android' ? 128 : 112, gap: 10 }, mapTool: { minWidth: 62, backgroundColor: colors.paper, borderRadius: 18, paddingHorizontal: 10, paddingVertical: 9, alignItems: 'center', borderWidth: 1, borderColor: 'rgba(18,53,36,0.10)' }, mapToolActive: { backgroundColor: colors.lime }, mapToolText: { color: colors.ink, fontSize: 8, fontWeight: '800', marginTop: 3 },
  bottomPanel: { marginHorizontal: 10, marginBottom: Platform.OS === 'android' ? 10 : 6, padding: 12, gap: 10, borderRadius: 27, backgroundColor: 'rgba(234,242,238,0.97)', borderWidth: 1, borderColor: 'rgba(18,53,36,0.10)' },
  permissionCard: { backgroundColor: '#FCE5DE', borderRadius: 16, padding: 12, flexDirection: 'row', alignItems: 'center', gap: 9 }, link: { color: colors.accent, fontSize: 12, fontWeight: '800' },
  routeStrip: { backgroundColor: colors.ink, borderRadius: 18, paddingHorizontal: 13, paddingVertical: 11, flexDirection: 'row', alignItems: 'center', gap: 10 }, routePoint: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8 }, startDot: { width: 11, height: 11, borderRadius: 6, backgroundColor: colors.white, borderWidth: 3, borderColor: colors.accent }, routeEyebrow: { color: colors.mint, fontSize: 7, fontWeight: '900', letterSpacing: 1.2 }, routeName: { color: colors.white, fontWeight: '800', fontSize: 11, marginTop: 2 },
  stats: { backgroundColor: colors.paper, borderRadius: 20, padding: 8, flexDirection: 'row', flexWrap: 'wrap', borderWidth: 1, borderColor: colors.line }, stat: { width: '50%', minHeight: 53, paddingVertical: 7, paddingHorizontal: 10, justifyContent: 'center' }, statLabel: { color: colors.soft, fontSize: 8, fontWeight: '900', letterSpacing: 1 }, statValue: { color: colors.ink, fontSize: 16, fontWeight: '900', marginTop: 3 },
  riderStrip: { gap: 8, paddingRight: 8 }, riderChip: { minWidth: 134, backgroundColor: colors.paper, borderRadius: 15, paddingHorizontal: 11, paddingVertical: 9, borderWidth: 1, borderColor: colors.line }, statusDot: { width: 7, height: 7, borderRadius: 4, position: 'absolute', right: 10, top: 10 }, memberName: { color: colors.ink, fontSize: 12, fontWeight: '800' }, meta: { color: colors.soft, fontSize: 9, lineHeight: 14, marginTop: 2 },
  backdrop: { position: 'absolute', left: 0, right: 0, top: 0, bottom: 0, backgroundColor: 'rgba(18,53,36,0.35)' }, sheet: { position: 'absolute', left: 0, right: 0, bottom: 0, backgroundColor: colors.cream, paddingHorizontal: 20, paddingTop: 12, paddingBottom: Platform.OS === 'android' ? 24 : 32, borderTopLeftRadius: 28, borderTopRightRadius: 28 }, sheetHandle: { width: 42, height: 5, borderRadius: 3, backgroundColor: colors.line, alignSelf: 'center', marginBottom: 22 }, sheetTitle: { color: colors.ink, fontSize: 30, fontWeight: '900' }, sheetBody: { color: colors.soft, fontSize: 14, lineHeight: 20, marginTop: 8 }, cheerGrid: { flexDirection: 'row', flexWrap: 'wrap', columnGap: 10, rowGap: 10, marginTop: 22 }, cheer: { flexBasis: '47%', flexGrow: 1, minHeight: 64, backgroundColor: colors.paper, borderWidth: 1, borderColor: colors.line, borderRadius: 17, paddingHorizontal: 14, paddingVertical: 12, flexDirection: 'row', alignItems: 'center', gap: 10 }, cheerText: { flexShrink: 1, color: colors.ink, fontSize: 13, lineHeight: 18, fontWeight: '800' },
  confirmBackdrop: { flex: 1, padding: 24, justifyContent: 'center', backgroundColor: 'rgba(18,53,36,0.46)' }, confirmCard: { borderRadius: 26, backgroundColor: colors.cream, padding: 22 }, confirmIcon: { width: 52, height: 52, borderRadius: 18, backgroundColor: colors.lime, alignItems: 'center', justifyContent: 'center', marginBottom: 18 }, confirmTitle: { color: colors.ink, fontSize: 26, fontWeight: '900' }, confirmBody: { color: colors.soft, fontSize: 14, lineHeight: 21, marginTop: 9 }, confirmActions: { gap: 10, marginTop: 22 },
});
