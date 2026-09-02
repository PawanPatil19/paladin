import { StatusBar } from 'expo-status-bar';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import * as Location from 'expo-location';
import * as Speech from 'expo-speech';
import { Ionicons } from '@expo/vector-icons';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Animated,
  Dimensions,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  SafeAreaView,
  ScrollView,
  Share,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from 'react-native';
import MapView, { Marker, Polyline, Region } from 'react-native-maps';
import { groupApi, type ApiGroup } from './src/api';

type Activity = 'run' | 'ride';
type Screen = 'home' | 'setup' | 'lobby' | 'active';
type Mode = 'create' | 'join';
type Coordinate = { latitude: number; longitude: number };
type Destination = Coordinate & { name: string; area: string; distance: string; icon: keyof typeof Ionicons.glyphMap };
type Member = Coordinate & { id: string; name: string; initials: string; color: string; pace: string; isYou?: boolean };

const C = {
  cream: '#F7F3EA',
  paper: '#FFFCF6',
  ink: '#18352C',
  inkSoft: '#527068',
  orange: '#FF6846',
  mint: '#BCE9D9',
  lime: '#D7F26D',
  blue: '#7CA8F8',
  line: '#DADDD4',
  white: '#FFFFFF',
};

const DESTINATIONS: Destination[] = [
  { name: 'Marina Barrage', area: 'Marina Bay', distance: '5.2 km', latitude: 1.2807, longitude: 103.8712, icon: 'water-outline' },
  { name: 'East Coast Park', area: 'Marine Cove', distance: '8.4 km', latitude: 1.3018, longitude: 103.9127, icon: 'leaf-outline' },
  { name: 'MacRitchie', area: 'Reservoir Park', distance: '10.1 km', latitude: 1.3448, longitude: 103.8224, icon: 'trail-sign-outline' },
  { name: 'Rail Corridor', area: 'Bukit Timah', distance: '7.8 km', latitude: 1.3324, longitude: 103.7817, icon: 'git-branch-outline' },
];

const CHEERS = [
  { emoji: '🔥', text: 'Steady lah, you’ve got this!' },
  { emoji: '💨', text: 'Nice pace! Keep it smooth.' },
  { emoji: '🙌', text: 'Almost there, kaki!' },
  { emoji: '💧', text: 'Hydration check, everyone.' },
  { emoji: '🚲', text: 'Clear road ahead. Let’s roll!' },
  { emoji: '🌴', text: 'Strong together, finish together.' },
];

const SG_REGION: Region = {
  latitude: 1.2903,
  longitude: 103.8612,
  latitudeDelta: 0.033,
  longitudeDelta: 0.033,
};

function distanceKmBetween(a: Coordinate, b: Coordinate) {
  const radiusKm = 6371;
  const radians = (degrees: number) => degrees * Math.PI / 180;
  const latDelta = radians(b.latitude - a.latitude);
  const lngDelta = radians(b.longitude - a.longitude);
  const value = Math.sin(latDelta / 2) ** 2
    + Math.cos(radians(a.latitude)) * Math.cos(radians(b.latitude)) * Math.sin(lngDelta / 2) ** 2;
  return radiusKm * 2 * Math.atan2(Math.sqrt(value), Math.sqrt(1 - value));
}

function livePace(speedMetresPerSecond: number | null, activity: Activity) {
  if (!speedMetresPerSecond || speedMetresPerSecond <= 0.3) return 'Moving';
  if (activity === 'ride') return `${(speedMetresPerSecond * 3.6).toFixed(1)}`;
  const paceSeconds = 1000 / speedMetresPerSecond;
  return `${Math.floor(paceSeconds / 60)}:${Math.round(paceSeconds % 60).toString().padStart(2, '0')}`;
}

function Logo({ compact = false }: { compact?: boolean }) {
  return (
    <View style={styles.logoRow}>
      <View style={[styles.logoMark, compact && styles.logoMarkCompact]}>
        <View style={styles.logoDot} />
        <View style={styles.logoTrail} />
      </View>
      <Text style={[styles.logoText, compact && styles.logoTextCompact]}>PALADIN</Text>
    </View>
  );
}

function PillButton({ label, icon, onPress, secondary = false, disabled = false }: { label: string; icon?: keyof typeof Ionicons.glyphMap; onPress: () => void; secondary?: boolean; disabled?: boolean }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [styles.pillButton, secondary && styles.pillButtonSecondary, disabled && styles.buttonDisabled, pressed && styles.pressed]}
    >
      <Text style={[styles.pillButtonText, secondary && styles.pillButtonTextSecondary]}>{label}</Text>
      {icon ? <Ionicons name={icon} size={19} color={secondary ? C.ink : C.white} /> : null}
    </Pressable>
  );
}

function HomeScreen({ onChoose }: { onChoose: (mode: Mode) => void }) {
  return (
    <LinearGradient colors={[C.cream, '#E8F2E6']} style={styles.fill}>
      <SafeAreaView style={styles.fill}>
        <View style={styles.homeWrap}>
          <View style={styles.homeTop}>
            <Logo />
            <View style={styles.sgBadge}><Text style={styles.sgBadgeText}>MADE FOR SG</Text><Text>🇸🇬</Text></View>
          </View>

          <View style={styles.heroArt}>
            <View style={styles.routeLoopOne} />
            <View style={styles.routeLoopTwo} />
            <View style={[styles.runnerDot, { top: 36, left: 44, backgroundColor: C.orange }]}><Text style={styles.runnerInitial}>M</Text></View>
            <View style={[styles.runnerDot, { right: 36, top: 118, backgroundColor: C.blue }]}><Text style={styles.runnerInitial}>D</Text></View>
            <View style={[styles.runnerDot, { bottom: 30, left: 110, backgroundColor: C.ink }]}><Ionicons name="flag" size={17} color={C.lime} /></View>
            <View style={styles.voiceBubble}><Ionicons name="volume-high" size={18} color={C.ink} /><Text style={styles.voiceBubbleText}>“Steady lah!”</Text></View>
          </View>

          <View>
            <Text style={styles.heroKicker}>YOUR PEOPLE. ONE ROUTE.</Text>
            <Text style={styles.heroTitle}>Move together.{`\n`}Never lose a <Text style={styles.heroAccent}>kaki.</Text></Text>
            <Text style={styles.heroCopy}>Create a group run or ride, share one code, and keep everyone close — from the first step to makan after.</Text>
          </View>

          <View style={styles.homeActions}>
            <PillButton label="Start a group" icon="arrow-forward" onPress={() => onChoose('create')} />
            <PillButton label="Join with a code" icon="keypad-outline" secondary onPress={() => onChoose('join')} />
          </View>
        </View>
      </SafeAreaView>
    </LinearGradient>
  );
}

function SetupScreen({ mode, busy, error, onBack, onContinue }: { mode: Mode; busy: boolean; error: string; onBack: () => void; onContinue: (data: { name: string; code: string; activity: Activity; destination: Destination }) => Promise<void> }) {
  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [activity, setActivity] = useState<Activity>('run');
  const [destination, setDestination] = useState(DESTINATIONS[0]);
  const valid = name.trim().length >= 2 && (mode === 'create' || code.length === 6);

  return (
    <SafeAreaView style={styles.screen}>
      <KeyboardAvoidingView style={styles.fill} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={styles.navBar}>
          <Pressable accessibilityRole="button" accessibilityLabel="Go back" style={styles.iconButton} onPress={onBack}><Ionicons name="arrow-back" size={21} color={C.ink} /></Pressable>
          <Logo compact />
          <View style={styles.iconButtonGhost} />
        </View>
        <ScrollView contentContainerStyle={styles.setupContent} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
          <View>
            <Text style={styles.stepLabel}>{mode === 'create' ? 'NEW OUTING' : 'JOIN THE CREW'}</Text>
            <Text style={styles.pageTitle}>{mode === 'create' ? 'Where are we\ngoing?' : 'Your kaki are\nwaiting.'}</Text>
            <Text style={styles.pageSubtitle}>{mode === 'create' ? 'Set the plan. Everyone joins with one simple code.' : 'Enter the six-character code from your group leader.'}</Text>
          </View>

          <View style={styles.formBlock}>
            <Text style={styles.inputLabel}>YOUR NAME</Text>
            <TextInput value={name} onChangeText={setName} placeholder="What should we call you?" placeholderTextColor="#9AA8A1" style={styles.input} autoCapitalize="words" returnKeyType="done" />
          </View>

          {mode === 'join' ? (
            <View style={styles.formBlock}>
              <Text style={styles.inputLabel}>GROUP CODE</Text>
              <TextInput value={code} onChangeText={(value) => setCode(value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6))} placeholder="SG482K" placeholderTextColor="#9AA8A1" style={[styles.input, styles.codeInput]} autoCapitalize="characters" maxLength={6} />
              <View style={styles.helperRow}><Ionicons name="information-circle-outline" size={16} color={C.inkSoft} /><Text style={styles.helperText}>Ask your group leader for their live code</Text></View>
            </View>
          ) : (
            <>
              <View style={styles.formBlock}>
                <Text style={styles.inputLabel}>ACTIVITY</Text>
                <View style={styles.segment}>
                  {(['run', 'ride'] as Activity[]).map((item) => (
                    <Pressable key={item} onPress={() => setActivity(item)} style={[styles.segmentItem, activity === item && styles.segmentItemActive]}>
                      <Ionicons name={item === 'run' ? 'walk-outline' : 'bicycle-outline'} size={19} color={activity === item ? C.white : C.ink} />
                      <Text style={[styles.segmentText, activity === item && styles.segmentTextActive]}>{item === 'run' ? 'Group run' : 'Group ride'}</Text>
                    </Pressable>
                  ))}
                </View>
              </View>

              <View style={styles.formBlock}>
                <Text style={styles.inputLabel}>DESTINATION</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.destinationRow}>
                  {DESTINATIONS.map((item) => {
                    const selected = destination.name === item.name;
                    return (
                      <Pressable key={item.name} onPress={() => setDestination(item)} style={[styles.destinationCard, selected && styles.destinationCardActive]}>
                        <View style={[styles.destinationIcon, selected && styles.destinationIconActive]}><Ionicons name={item.icon} size={21} color={selected ? C.white : C.ink} /></View>
                        <Text style={styles.destinationName}>{item.name}</Text>
                        <Text style={styles.destinationMeta}>{item.area} · {item.distance}</Text>
                        {selected ? <View style={styles.checkCircle}><Ionicons name="checkmark" size={13} color={C.white} /></View> : null}
                      </Pressable>
                    );
                  })}
                </ScrollView>
              </View>
            </>
          )}
        </ScrollView>
        <View style={styles.stickyAction}>
          {error ? <View style={styles.apiError}><Ionicons name="alert-circle" size={16} color="#A33D2C" /><Text style={styles.apiErrorText}>{error}</Text></View> : null}
          <PillButton disabled={!valid || busy} label={busy ? 'Connecting…' : mode === 'create' ? 'Create group' : 'Join group'} icon={busy ? undefined : 'arrow-forward'} onPress={async () => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); await onContinue({ name: name.trim(), code, activity, destination }); }} />
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function MemberAvatar({ member, size = 44 }: { member: Member; size?: number }) {
  return <View style={[styles.avatar, { width: size, height: size, borderRadius: size / 2, backgroundColor: member.color }]}><Text style={[styles.avatarText, { fontSize: size * 0.34 }]}>{member.initials}</Text></View>;
}

function VoiceControl({ enabled, onToggle }: { enabled: boolean; onToggle: (value: boolean) => void }) {
  return (
    <View style={[styles.voiceCard, enabled && styles.voiceCardActive]}>
      <View style={[styles.voiceIcon, enabled && styles.voiceIconActive]}><Ionicons name={enabled ? 'headset' : 'headset-outline'} size={24} color={enabled ? C.white : C.ink} /></View>
      <View style={styles.voiceCopy}>
        <View style={styles.voiceTitleRow}><Text style={styles.voiceTitle}>Voice cheers</Text>{enabled ? <View style={styles.liveTag}><View style={styles.liveDot} /><Text style={styles.liveText}>LIVE</Text></View> : null}</View>
        <Text style={styles.voiceSubtitle}>{enabled ? 'Cheers will play automatically in your earphones.' : 'Hear encouragement without looking at your phone.'}</Text>
      </View>
      <Switch value={enabled} onValueChange={onToggle} trackColor={{ false: '#C9D0CB', true: C.ink }} thumbColor={enabled ? C.lime : C.white} />
    </View>
  );
}

function LobbyScreen({ group, participantId, starting, onBack, onStart }: { group: ApiGroup; participantId: string; starting: boolean; onBack: () => void; onStart: (voice: boolean) => Promise<void> }) {
  const [voice, setVoice] = useState(true);
  const members: Member[] = group.members.map((member) => ({ ...member, isYou: member.id === participantId }));
  const { activity, destination, code } = group;

  const toggleVoice = (value: boolean) => {
    setVoice(value);
    Haptics.selectionAsync();
    if (value) Speech.speak('Voice cheers on. Let’s move together!', { language: 'en-SG', rate: 0.95 });
    else Speech.stop();
  };

  return (
    <SafeAreaView style={styles.screen}>
      <View style={styles.navBar}>
        <Pressable accessibilityRole="button" accessibilityLabel="Go back" style={styles.iconButton} onPress={onBack}><Ionicons name="arrow-back" size={21} color={C.ink} /></Pressable>
        <Text style={styles.navTitle}>GROUP LOBBY</Text>
        <Pressable accessibilityRole="button" accessibilityLabel="More options" style={styles.iconButton}><Ionicons name="ellipsis-horizontal" size={21} color={C.ink} /></Pressable>
      </View>
      <ScrollView contentContainerStyle={styles.lobbyContent} showsVerticalScrollIndicator={false}>
        <View style={styles.codeCard}>
          <Text style={styles.codeEyebrow}>SHARE THIS CODE</Text>
          <Text style={styles.groupCode}>{code}</Text>
          <View style={styles.codeRule} />
          <View style={styles.codeShareRow}><Text style={styles.codeHint}>Your kaki can join from the home screen</Text><Pressable accessibilityRole="button" accessibilityLabel="Share group code" onPress={() => Share.share({ message: `Join my Paladin ${activity} to ${destination.name}. Use code ${code}.` })} style={styles.shareIcon}><Ionicons name="share-outline" size={20} color={C.ink} /></Pressable></View>
        </View>

        <View style={styles.planCard}>
          <View style={styles.planIcon}><Ionicons name={activity === 'run' ? 'walk' : 'bicycle'} size={25} color={C.white} /></View>
          <View style={styles.planCopy}><Text style={styles.planLabel}>{activity === 'run' ? 'GROUP RUN' : 'GROUP RIDE'} · TODAY</Text><Text style={styles.planTitle}>{destination.name}</Text><Text style={styles.planMeta}>Meet at Marina Bay · {destination.distance}</Text></View>
          <Ionicons name="chevron-forward" size={20} color={C.inkSoft} />
        </View>

        <VoiceControl enabled={voice} onToggle={toggleVoice} />

        <View style={styles.sectionTitleRow}><Text style={styles.sectionTitle}>KAKI ON DECK</Text><View style={styles.countBadge}><Text style={styles.countText}>{members.length}</Text></View></View>
        <View style={styles.memberList}>
          {members.map((member, index) => (
            <View key={member.id} style={[styles.memberRow, index < members.length - 1 && styles.memberRowBorder]}>
              <MemberAvatar member={member} />
              <View style={styles.memberCopy}><Text style={styles.memberName}>{member.name}{member.isYou ? ' (you)' : ''}</Text><Text style={styles.memberStatus}>{member.isYou ? 'Group leader' : 'Ready to move'}</Text></View>
              <View style={styles.readyDot}><Ionicons name="checkmark" size={13} color={C.white} /></View>
            </View>
          ))}
        </View>
      </ScrollView>
      <View style={styles.stickyAction}>
        <PillButton disabled={starting} label={starting ? 'Starting…' : `Start ${activity}`} icon={starting ? undefined : 'arrow-forward'} onPress={async () => { Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success); await onStart(voice); }} />
        <Text style={styles.actionFinePrint}>Location is shared only while this outing is active.</Text>
      </View>
    </SafeAreaView>
  );
}

function ActiveScreen({ group, participantId, initialVoice, onEnd }: { group: ApiGroup; participantId: string; initialVoice: boolean; onEnd: () => void }) {
  const [voice, setVoice] = useState(initialVoice);
  const me = group.members.find((member) => member.id === participantId);
  const [location, setLocation] = useState<Coordinate>({ latitude: me?.latitude ?? 1.2903, longitude: me?.longitude ?? 103.852 });
  const [locationNote, setLocationNote] = useState('Finding your location…');
  const [seconds, setSeconds] = useState(0);
  const [distance, setDistance] = useState(0);
  const [cheerOpen, setCheerOpen] = useState(false);
  const [toast, setToast] = useState<{ sender: string; text: string } | null>(null);
  const fade = useRef(new Animated.Value(0)).current;
  const mapRef = useRef<MapView>(null);
  const previousLocation = useRef(location);
  const seenCheers = useRef(new Set(group.cheers.map((cheer) => cheer.id)));
  const { activity, destination, code } = group;
  const members = useMemo<Member[]>(() => group.members.map((member) => member.id === participantId
    ? { ...member, ...location, isYou: true }
    : member), [group.members, participantId, location]);

  const route = useMemo(() => [...members.map(({ latitude, longitude }) => ({ latitude, longitude })), { latitude: destination.latitude, longitude: destination.longitude }], [members, destination]);

  useEffect(() => {
    if (route.length < 2) return;
    mapRef.current?.fitToCoordinates(route, { animated: true, edgePadding: { top: 120, right: 60, bottom: 310, left: 60 } });
  }, [group.members.length, destination.latitude, destination.longitude]);

  useEffect(() => {
    let watcher: Location.LocationSubscription | undefined;
    (async () => {
      const permission = await Location.requestForegroundPermissionsAsync();
      if (permission.status !== 'granted') {
        setLocationNote('Demo location · allow access for live tracking');
        return;
      }
      const current = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      const coordinate = { latitude: current.coords.latitude, longitude: current.coords.longitude };
      previousLocation.current = coordinate;
      setLocation(coordinate);
      groupApi.updateLocation(code, participantId, coordinate, livePace(current.coords.speed, activity)).catch(() => setLocationNote('Location is live locally · reconnecting to group'));
      setLocationNote('Live location · visible to this group');
      watcher = await Location.watchPositionAsync({ accuracy: Location.Accuracy.Balanced, distanceInterval: 10, timeInterval: 5000 }, (update) => {
        const next = { latitude: update.coords.latitude, longitude: update.coords.longitude };
        const travelled = distanceKmBetween(previousLocation.current, next);
        if (travelled < 0.25) setDistance((value) => value + travelled);
        previousLocation.current = next;
        setLocation(next);
        groupApi.updateLocation(code, participantId, next, livePace(update.coords.speed, activity)).catch(() => setLocationNote('Location is live locally · reconnecting to group'));
      });
    })();
    return () => watcher?.remove();
  }, [activity, code, participantId]);

  useEffect(() => {
    const timer = setInterval(() => {
      setSeconds((value) => value + 1);
    }, 1000);
    return () => clearInterval(timer);
  }, [activity]);

  useEffect(() => {
    for (const cheer of group.cheers) {
      if (seenCheers.current.has(cheer.id)) continue;
      seenCheers.current.add(cheer.id);
      if (cheer.senderId !== participantId) receiveCheer(cheer.senderName, cheer.message);
    }
  }, [group.cheers, participantId]);

  useEffect(() => () => { Speech.stop(); }, []);

  const receiveCheer = (sender: string, text: string) => {
    setToast({ sender, text });
    fade.setValue(0);
    Animated.sequence([
      Animated.timing(fade, { toValue: 1, duration: 260, useNativeDriver: true }),
      Animated.delay(4200),
      Animated.timing(fade, { toValue: 0, duration: 260, useNativeDriver: true }),
    ]).start(() => setToast(null));
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    if (voice) Speech.speak(`${sender} says: ${text}`, { language: 'en-SG', rate: 0.96, pitch: 1.02 });
  };

  const sendCheer = async (text: string) => {
    setCheerOpen(false);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    try {
      await groupApi.cheer(code, participantId, text);
      setToast({ sender: 'Sent to everyone', text });
      fade.setValue(1);
      Animated.sequence([Animated.delay(2200), Animated.timing(fade, { toValue: 0, duration: 250, useNativeDriver: true })]).start(() => setToast(null));
    } catch {
      setToast({ sender: 'Cheer not sent', text: 'Check your connection and try again.' });
      fade.setValue(1);
    }
  };

  const minutes = Math.floor(seconds / 60).toString().padStart(2, '0');
  const secs = (seconds % 60).toString().padStart(2, '0');
  const averageSpeed = seconds > 0 ? distance / (seconds / 3600) : 0;
  const averagePaceSeconds = distance > 0.02 ? seconds / distance : 0;
  const averagePace = averagePaceSeconds
    ? `${Math.floor(averagePaceSeconds / 60)}:${Math.round(averagePaceSeconds % 60).toString().padStart(2, '0')}`
    : '--:--';

  return (
    <View style={styles.activeFill}>
      <StatusBar style="dark" />
      <MapView ref={mapRef} style={StyleSheet.absoluteFill} initialRegion={SG_REGION} showsCompass={false} showsPointsOfInterests={false} toolbarEnabled={false} onMapReady={() => mapRef.current?.fitToCoordinates(route, { animated: false, edgePadding: { top: 120, right: 60, bottom: 310, left: 60 } })}>
        <Polyline coordinates={route} strokeColor={C.orange} strokeWidth={5} lineDashPattern={[2, 1]} />
        <Marker coordinate={{ latitude: destination.latitude, longitude: destination.longitude }} title={destination.name}>
          <View style={styles.destinationMarker}><Ionicons name="flag" size={18} color={C.ink} /></View>
        </Marker>
        {members.map((member) => (
          <Marker key={member.id} coordinate={{ latitude: member.latitude, longitude: member.longitude }} title={member.name} description={member.isYou ? 'You' : `${member.pace} pace`}>
            <View style={[styles.mapAvatarRing, member.isYou && styles.mapAvatarRingYou]}><MemberAvatar member={member} size={38} /></View>
          </Marker>
        ))}
      </MapView>

      <SafeAreaView style={styles.activeOverlay} pointerEvents="box-none">
        <View style={styles.activeHeader}>
          <Pressable accessibilityRole="button" accessibilityLabel="Leave outing" style={styles.mapRoundButton} onPress={onEnd}><Ionicons name="close" size={22} color={C.ink} /></Pressable>
          <View style={styles.activeCode}><View style={styles.liveDotOrange} /><Text style={styles.activeCodeText}>{code} · LIVE</Text></View>
          <Pressable accessibilityRole="button" accessibilityLabel="Voice settings" style={[styles.mapRoundButton, voice && styles.mapRoundButtonActive]} onPress={() => { setVoice((value) => !value); if (voice) Speech.stop(); }}><Ionicons name={voice ? 'headset' : 'headset-outline'} size={21} color={voice ? C.white : C.ink} /></Pressable>
        </View>

        {toast ? (
          <Animated.View style={[styles.cheerToast, { opacity: fade, transform: [{ translateY: fade.interpolate({ inputRange: [0, 1], outputRange: [-12, 0] }) }] }]}>
            <View style={styles.cheerToastIcon}><Ionicons name="volume-high" size={19} color={C.ink} /></View>
            <View style={styles.cheerToastCopy}><Text style={styles.cheerToastSender}>{toast.sender}</Text><Text style={styles.cheerToastText}>{toast.text}</Text></View>
          </Animated.View>
        ) : null}

        <View style={styles.activeBottom}>
          <View style={styles.destinationStrip}>
            <View style={styles.flagCircle}><Ionicons name="flag" size={17} color={C.white} /></View>
            <View style={styles.destinationStripCopy}><Text style={styles.destinationStripLabel}>DESTINATION</Text><Text style={styles.destinationStripTitle}>{destination.name}</Text></View>
            <Text style={styles.remainingDistance}>{Math.max(0.1, Number(destination.distance.split(' ')[0]) - distance).toFixed(1)} <Text style={styles.km}>km</Text></Text>
          </View>
          <View style={styles.statCard}>
            <View style={styles.statsRow}>
              <View style={styles.stat}><Text style={styles.statLabel}>TIME</Text><Text style={styles.statValue}>{minutes}:{secs}</Text></View>
              <View style={styles.statRule} />
              <View style={styles.stat}><Text style={styles.statLabel}>DISTANCE</Text><Text style={styles.statValue}>{distance.toFixed(2)} <Text style={styles.statUnit}>km</Text></Text></View>
              <View style={styles.statRule} />
              <View style={styles.stat}><Text style={styles.statLabel}>{activity === 'run' ? 'PACE' : 'SPEED'}</Text><Text style={styles.statValue}>{activity === 'run' ? averagePace : averageSpeed.toFixed(1)} <Text style={styles.statUnit}>{activity === 'run' ? '/km' : 'km/h'}</Text></Text></View>
            </View>
            <View style={styles.locationLine}><View style={styles.liveDot} /><Text style={styles.locationText}>{locationNote}</Text></View>
            <Pressable accessibilityRole="button" accessibilityLabel="Send a voice cheer" onPress={() => setCheerOpen(true)} style={({ pressed }) => [styles.cheerButton, pressed && styles.pressed]}>
              <Ionicons name="megaphone" size={21} color={C.ink} /><Text style={styles.cheerButtonText}>Cheer your kaki</Text><Ionicons name="chevron-up" size={18} color={C.ink} />
            </Pressable>
          </View>
        </View>
      </SafeAreaView>

      <Modal visible={cheerOpen} transparent animationType="slide" onRequestClose={() => setCheerOpen(false)}>
        <Pressable style={styles.modalBackdrop} onPress={() => setCheerOpen(false)} />
        <SafeAreaView style={styles.cheerSheet}>
          <View style={styles.sheetHandle} />
          <View style={styles.sheetHeader}><View><Text style={styles.sheetKicker}>VOICE MODE</Text><Text style={styles.sheetTitle}>Send some energy</Text></View><Pressable style={styles.iconButton} onPress={() => setCheerOpen(false)}><Ionicons name="close" size={21} color={C.ink} /></Pressable></View>
          <Text style={styles.sheetSubtitle}>Tap a cheer. It’ll play automatically for everyone with voice mode on.</Text>
          <View style={styles.cheerGrid}>
            {CHEERS.map((cheer) => (
              <Pressable key={cheer.text} onPress={() => sendCheer(cheer.text)} style={({ pressed }) => [styles.cheerOption, pressed && styles.cheerOptionPressed]}>
                <Text style={styles.cheerEmoji}>{cheer.emoji}</Text><Text style={styles.cheerOptionText}>{cheer.text}</Text>
              </Pressable>
            ))}
          </View>
        </SafeAreaView>
      </Modal>
    </View>
  );
}

export default function App() {
  const [screen, setScreen] = useState<Screen>('home');
  const [mode, setMode] = useState<Mode>('create');
  const [name, setName] = useState('');
  const [activity, setActivity] = useState<Activity>('run');
  const [destination, setDestination] = useState(DESTINATIONS[0]);
  const [code, setCode] = useState('');
  const [voice, setVoice] = useState(true);
  const [group, setGroup] = useState<ApiGroup | null>(null);
  const [participantId, setParticipantId] = useState('');
  const [setupBusy, setSetupBusy] = useState(false);
  const [setupError, setSetupError] = useState('');
  const [starting, setStarting] = useState(false);

  const chooseMode = (nextMode: Mode) => { setMode(nextMode); setSetupError(''); setScreen('setup'); };
  const continueSetup = async (data: { name: string; code: string; activity: Activity; destination: Destination }) => {
    setSetupBusy(true);
    setSetupError('');
    try {
      const result = mode === 'create'
        ? await groupApi.create({ name: data.name, activity: data.activity, destination: data.destination })
        : await groupApi.join(data.code, data.name);
      setName(data.name);
      setActivity(result.group.activity);
      setDestination({ ...result.group.destination, icon: 'flag-outline' });
      setCode(result.group.code);
      setGroup(result.group);
      setParticipantId(result.participantId);
      setScreen(result.group.status === 'active' ? 'active' : 'lobby');
    } catch (error) {
      const detail = error instanceof Error ? error.message : 'Could not reach the group service.';
      setSetupError(`${detail} Make sure “npm run server” is running and EXPO_PUBLIC_API_URL points to it.`);
    } finally {
      setSetupBusy(false);
    }
  };

  useEffect(() => {
    if (!group || !code || (screen !== 'lobby' && screen !== 'active')) return;
    let cancelled = false;
    const refresh = async () => {
      try {
        const result = await groupApi.snapshot(code);
        if (!cancelled) {
          setGroup(result.group);
          if (screen === 'lobby' && result.group.status === 'active') setScreen('active');
        }
      } catch {
        // Keep the last known map and retry on the next polling interval.
      }
    };
    const timer = setInterval(refresh, 2000);
    refresh();
    return () => { cancelled = true; clearInterval(timer); };
  }, [code, screen]);

  const startOuting = async (enabled: boolean) => {
    if (!group) return;
    setStarting(true);
    try {
      const result = await groupApi.start(group.code, participantId);
      setGroup(result.group);
      setVoice(enabled);
      setScreen('active');
    } finally {
      setStarting(false);
    }
  };

  if (screen === 'home') return <><StatusBar style="dark" /><HomeScreen onChoose={chooseMode} /></>;
  if (screen === 'setup') return <><StatusBar style="dark" /><SetupScreen mode={mode} busy={setupBusy} error={setupError} onBack={() => setScreen('home')} onContinue={continueSetup} /></>;
  if (screen === 'lobby' && group) return <><StatusBar style="dark" /><LobbyScreen group={group} participantId={participantId} starting={starting} onBack={() => setScreen('setup')} onStart={startOuting} /></>;
  if (screen === 'active' && group) return <ActiveScreen group={group} participantId={participantId} initialVoice={voice} onEnd={() => setScreen('lobby')} />;
  return <><StatusBar style="dark" /><HomeScreen onChoose={chooseMode} /></>;
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  screen: { flex: 1, backgroundColor: C.cream },
  activeFill: { flex: 1, backgroundColor: '#DDE7DD' },
  pressed: { opacity: 0.78, transform: [{ scale: 0.985 }] },
  buttonDisabled: { opacity: 0.35 },
  homeWrap: { flex: 1, paddingHorizontal: 24, paddingBottom: 22, justifyContent: 'space-between' },
  homeTop: { paddingTop: Platform.OS === 'android' ? 24 : 8, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  logoRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  logoMark: { width: 38, height: 38, borderRadius: 19, backgroundColor: C.ink, justifyContent: 'center', alignItems: 'center', overflow: 'hidden' },
  logoMarkCompact: { width: 31, height: 31, borderRadius: 16 },
  logoDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: C.lime, position: 'absolute', top: 9, right: 9 },
  logoTrail: { width: 25, height: 4, borderRadius: 2, backgroundColor: C.orange, transform: [{ rotate: '-35deg' }], position: 'absolute', bottom: 9, left: 5 },
  logoText: { color: C.ink, fontSize: 17, fontWeight: '900', letterSpacing: 1.4 },
  logoTextCompact: { fontSize: 13, letterSpacing: 1.1 },
  sgBadge: { flexDirection: 'row', gap: 6, alignItems: 'center', borderWidth: 1, borderColor: C.line, borderRadius: 20, paddingVertical: 8, paddingHorizontal: 11, backgroundColor: 'rgba(255,255,255,0.5)' },
  sgBadgeText: { fontSize: 9, fontWeight: '800', color: C.ink, letterSpacing: 1 },
  heroArt: { height: Math.min(250, Dimensions.get('window').height * 0.29), marginTop: 14, position: 'relative', alignSelf: 'stretch' },
  routeLoopOne: { width: 195, height: 145, borderRadius: 90, borderWidth: 2, borderStyle: 'dashed', borderColor: C.inkSoft, position: 'absolute', top: 35, left: '18%', transform: [{ rotate: '22deg' }] },
  routeLoopTwo: { width: 145, height: 105, borderRadius: 70, borderWidth: 6, borderColor: C.mint, position: 'absolute', bottom: 15, right: '15%', transform: [{ rotate: '-30deg' }] },
  runnerDot: { width: 48, height: 48, borderRadius: 24, borderWidth: 4, borderColor: C.paper, alignItems: 'center', justifyContent: 'center', position: 'absolute', shadowColor: C.ink, shadowOpacity: 0.12, shadowRadius: 8, shadowOffset: { width: 0, height: 3 }, elevation: 3 },
  runnerInitial: { color: C.white, fontSize: 16, fontWeight: '900' },
  voiceBubble: { position: 'absolute', top: 52, right: 12, flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: C.lime, borderRadius: 18, borderBottomLeftRadius: 4, paddingHorizontal: 11, paddingVertical: 9, transform: [{ rotate: '4deg' }] },
  voiceBubbleText: { color: C.ink, fontSize: 12, fontWeight: '800' },
  heroKicker: { color: C.orange, fontSize: 10, fontWeight: '900', letterSpacing: 1.8, marginBottom: 11 },
  heroTitle: { color: C.ink, fontSize: 43, lineHeight: 45, fontWeight: '900', letterSpacing: -1.8 },
  heroAccent: { color: C.orange, fontStyle: 'italic' },
  heroCopy: { color: C.inkSoft, fontSize: 15, lineHeight: 22, marginTop: 16, maxWidth: 350 },
  homeActions: { gap: 11, marginTop: 20 },
  pillButton: { height: 57, borderRadius: 29, backgroundColor: C.orange, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, paddingHorizontal: 22, shadowColor: C.orange, shadowOpacity: 0.18, shadowRadius: 12, shadowOffset: { width: 0, height: 5 }, elevation: 3 },
  pillButtonSecondary: { backgroundColor: C.paper, borderWidth: 1, borderColor: C.line, shadowOpacity: 0 },
  pillButtonText: { color: C.white, fontSize: 15, fontWeight: '800' },
  pillButtonTextSecondary: { color: C.ink },
  navBar: { height: 64, paddingHorizontal: 20, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  navTitle: { color: C.ink, fontSize: 11, fontWeight: '900', letterSpacing: 1.5 },
  iconButton: { width: 42, height: 42, borderRadius: 21, backgroundColor: C.paper, borderWidth: 1, borderColor: C.line, alignItems: 'center', justifyContent: 'center' },
  iconButtonGhost: { width: 42 },
  setupContent: { paddingHorizontal: 24, paddingTop: 18, paddingBottom: 120 },
  stepLabel: { color: C.orange, fontSize: 10, fontWeight: '900', letterSpacing: 1.7, marginBottom: 12 },
  pageTitle: { color: C.ink, fontSize: 41, lineHeight: 42, fontWeight: '900', letterSpacing: -1.5 },
  pageSubtitle: { color: C.inkSoft, fontSize: 15, lineHeight: 22, marginTop: 14, maxWidth: 340 },
  formBlock: { marginTop: 30 },
  inputLabel: { color: C.ink, fontSize: 10, fontWeight: '900', letterSpacing: 1.4, marginBottom: 10 },
  input: { height: 58, borderRadius: 17, borderWidth: 1, borderColor: C.line, backgroundColor: C.paper, paddingHorizontal: 17, color: C.ink, fontSize: 16, fontWeight: '600' },
  codeInput: { fontSize: 24, letterSpacing: 8, fontWeight: '900', textAlign: 'center' },
  helperRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 9 },
  helperText: { color: C.inkSoft, fontSize: 12 },
  apiError: { flexDirection: 'row', alignItems: 'flex-start', gap: 7, backgroundColor: '#FCE5DE', borderRadius: 12, padding: 10, marginBottom: 10 },
  apiErrorText: { flex: 1, color: '#8D3528', fontSize: 11, lineHeight: 15 },
  segment: { flexDirection: 'row', padding: 4, backgroundColor: '#E7E8E0', borderRadius: 18 },
  segmentItem: { flex: 1, height: 48, borderRadius: 14, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7 },
  segmentItemActive: { backgroundColor: C.ink },
  segmentText: { color: C.ink, fontSize: 14, fontWeight: '700' },
  segmentTextActive: { color: C.white },
  destinationRow: { gap: 11, paddingRight: 24 },
  destinationCard: { width: 180, minHeight: 139, borderRadius: 19, backgroundColor: C.paper, borderWidth: 1, borderColor: C.line, padding: 15, position: 'relative' },
  destinationCardActive: { borderColor: C.orange, borderWidth: 2, padding: 14 },
  destinationIcon: { width: 40, height: 40, borderRadius: 13, backgroundColor: C.mint, alignItems: 'center', justifyContent: 'center', marginBottom: 13 },
  destinationIconActive: { backgroundColor: C.orange },
  destinationName: { color: C.ink, fontSize: 15, fontWeight: '800' },
  destinationMeta: { color: C.inkSoft, fontSize: 11, marginTop: 5 },
  checkCircle: { position: 'absolute', right: 11, top: 11, width: 22, height: 22, borderRadius: 11, backgroundColor: C.orange, alignItems: 'center', justifyContent: 'center' },
  stickyAction: { paddingHorizontal: 24, paddingTop: 12, paddingBottom: Platform.OS === 'android' ? 22 : 12, backgroundColor: C.cream, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: C.line },
  actionFinePrint: { color: C.inkSoft, fontSize: 10, textAlign: 'center', marginTop: 9 },
  lobbyContent: { paddingHorizontal: 24, paddingTop: 10, paddingBottom: 120 },
  codeCard: { backgroundColor: C.ink, borderRadius: 25, padding: 22, overflow: 'hidden' },
  codeEyebrow: { color: C.mint, fontSize: 9, fontWeight: '900', letterSpacing: 1.7, textAlign: 'center' },
  groupCode: { color: C.white, fontSize: 42, fontWeight: '900', letterSpacing: 8, textAlign: 'center', marginVertical: 14 },
  codeRule: { height: 1, backgroundColor: '#36534A' },
  codeShareRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingTop: 14 },
  codeHint: { color: '#B6C6C0', fontSize: 11 },
  shareIcon: { width: 34, height: 34, borderRadius: 17, backgroundColor: C.lime, alignItems: 'center', justifyContent: 'center' },
  planCard: { marginTop: 15, padding: 15, borderRadius: 20, backgroundColor: C.paper, borderWidth: 1, borderColor: C.line, flexDirection: 'row', alignItems: 'center', gap: 13 },
  planIcon: { width: 48, height: 48, borderRadius: 16, backgroundColor: C.orange, alignItems: 'center', justifyContent: 'center' },
  planCopy: { flex: 1 },
  planLabel: { color: C.orange, fontSize: 8, fontWeight: '900', letterSpacing: 1.1 },
  planTitle: { color: C.ink, fontSize: 16, fontWeight: '800', marginTop: 4 },
  planMeta: { color: C.inkSoft, fontSize: 11, marginTop: 3 },
  voiceCard: { marginTop: 15, padding: 15, borderRadius: 20, backgroundColor: C.paper, borderWidth: 1, borderColor: C.line, flexDirection: 'row', alignItems: 'center', gap: 12 },
  voiceCardActive: { backgroundColor: '#E5F3C1', borderColor: '#C2D99A' },
  voiceIcon: { width: 47, height: 47, borderRadius: 16, backgroundColor: C.mint, alignItems: 'center', justifyContent: 'center' },
  voiceIconActive: { backgroundColor: C.ink },
  voiceCopy: { flex: 1 },
  voiceTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  voiceTitle: { color: C.ink, fontSize: 15, fontWeight: '800' },
  voiceSubtitle: { color: C.inkSoft, fontSize: 10, lineHeight: 14, marginTop: 4 },
  liveTag: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: C.ink, paddingVertical: 3, paddingHorizontal: 6, borderRadius: 8 },
  liveDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#59D48D' },
  liveText: { color: C.white, fontSize: 7, fontWeight: '900', letterSpacing: 0.7 },
  sectionTitleRow: { flexDirection: 'row', alignItems: 'center', marginTop: 28, marginBottom: 10, gap: 8 },
  sectionTitle: { color: C.ink, fontSize: 10, fontWeight: '900', letterSpacing: 1.4 },
  countBadge: { width: 22, height: 22, borderRadius: 11, backgroundColor: C.mint, alignItems: 'center', justifyContent: 'center' },
  countText: { color: C.ink, fontSize: 10, fontWeight: '900' },
  memberList: { borderRadius: 20, backgroundColor: C.paper, borderWidth: 1, borderColor: C.line, paddingHorizontal: 15 },
  memberRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 13 },
  memberRowBorder: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: C.line },
  avatar: { alignItems: 'center', justifyContent: 'center' },
  avatarText: { color: C.white, fontWeight: '900' },
  memberCopy: { flex: 1, marginLeft: 12 },
  memberName: { color: C.ink, fontSize: 14, fontWeight: '800' },
  memberStatus: { color: C.inkSoft, fontSize: 10, marginTop: 3 },
  readyDot: { width: 22, height: 22, borderRadius: 11, backgroundColor: '#59B87C', alignItems: 'center', justifyContent: 'center' },
  activeOverlay: { flex: 1, justifyContent: 'space-between' },
  activeHeader: { paddingHorizontal: 18, paddingTop: Platform.OS === 'android' ? 20 : 4, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  mapRoundButton: { width: 46, height: 46, borderRadius: 23, backgroundColor: C.paper, borderWidth: 1, borderColor: C.line, alignItems: 'center', justifyContent: 'center', shadowColor: C.ink, shadowOpacity: 0.13, shadowRadius: 9, shadowOffset: { width: 0, height: 3 }, elevation: 4 },
  mapRoundButtonActive: { backgroundColor: C.ink, borderColor: C.ink },
  activeCode: { backgroundColor: C.paper, borderRadius: 18, paddingVertical: 9, paddingHorizontal: 13, flexDirection: 'row', alignItems: 'center', gap: 6, shadowColor: C.ink, shadowOpacity: 0.11, shadowRadius: 7, elevation: 3 },
  activeCodeText: { color: C.ink, fontSize: 10, fontWeight: '900', letterSpacing: 1 },
  liveDotOrange: { width: 7, height: 7, borderRadius: 4, backgroundColor: C.orange },
  mapAvatarRing: { borderRadius: 24, borderWidth: 3, borderColor: C.paper, shadowColor: C.ink, shadowOpacity: 0.22, shadowRadius: 4, elevation: 5 },
  mapAvatarRingYou: { borderColor: C.lime, borderWidth: 4 },
  destinationMarker: { width: 42, height: 42, borderRadius: 14, backgroundColor: C.lime, borderWidth: 3, borderColor: C.paper, alignItems: 'center', justifyContent: 'center' },
  cheerToast: { position: 'absolute', top: Platform.OS === 'android' ? 88 : 76, left: 22, right: 22, flexDirection: 'row', alignItems: 'center', gap: 11, padding: 12, borderRadius: 18, backgroundColor: C.lime, borderWidth: 1, borderColor: '#BED45E', shadowColor: C.ink, shadowOpacity: 0.15, shadowRadius: 10, elevation: 5 },
  cheerToastIcon: { width: 38, height: 38, borderRadius: 13, backgroundColor: C.paper, alignItems: 'center', justifyContent: 'center' },
  cheerToastCopy: { flex: 1 },
  cheerToastSender: { color: C.ink, fontSize: 10, fontWeight: '900' },
  cheerToastText: { color: C.ink, fontSize: 13, fontWeight: '700', marginTop: 2 },
  activeBottom: { paddingHorizontal: 15, paddingBottom: Platform.OS === 'android' ? 14 : 2 },
  destinationStrip: { marginHorizontal: 8, marginBottom: 9, borderRadius: 18, padding: 11, backgroundColor: C.paper, flexDirection: 'row', alignItems: 'center', shadowColor: C.ink, shadowOpacity: 0.12, shadowRadius: 8, elevation: 3 },
  flagCircle: { width: 38, height: 38, borderRadius: 13, backgroundColor: C.orange, alignItems: 'center', justifyContent: 'center' },
  destinationStripCopy: { flex: 1, marginLeft: 10 },
  destinationStripLabel: { color: C.inkSoft, fontSize: 7, fontWeight: '900', letterSpacing: 1 },
  destinationStripTitle: { color: C.ink, fontSize: 13, fontWeight: '800', marginTop: 2 },
  remainingDistance: { color: C.ink, fontSize: 18, fontWeight: '900' },
  km: { fontSize: 10, color: C.inkSoft },
  statCard: { backgroundColor: C.ink, borderRadius: 27, padding: 17, shadowColor: C.ink, shadowOpacity: 0.25, shadowRadius: 13, elevation: 7 },
  statsRow: { flexDirection: 'row', alignItems: 'center' },
  stat: { flex: 1, alignItems: 'center' },
  statLabel: { color: '#8DA39B', fontSize: 7, fontWeight: '900', letterSpacing: 1.1 },
  statValue: { color: C.white, fontSize: 20, fontWeight: '800', marginTop: 4 },
  statUnit: { color: '#8DA39B', fontSize: 8 },
  statRule: { height: 31, width: 1, backgroundColor: '#3B574E' },
  locationLine: { marginTop: 13, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6 },
  locationText: { color: '#9BB0A8', fontSize: 9 },
  cheerButton: { marginTop: 13, height: 49, borderRadius: 17, backgroundColor: C.lime, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  cheerButtonText: { flex: 1, color: C.ink, fontSize: 14, fontWeight: '900', textAlign: 'center', marginLeft: 18 },
  modalBackdrop: { flex: 1, backgroundColor: 'rgba(24,53,44,0.38)' },
  cheerSheet: { backgroundColor: C.cream, borderTopLeftRadius: 30, borderTopRightRadius: 30, paddingHorizontal: 22, paddingBottom: 14 },
  sheetHandle: { width: 42, height: 5, borderRadius: 3, backgroundColor: '#C9CEC7', alignSelf: 'center', marginTop: 10, marginBottom: 17 },
  sheetHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  sheetKicker: { color: C.orange, fontSize: 8, fontWeight: '900', letterSpacing: 1.4 },
  sheetTitle: { color: C.ink, fontSize: 26, fontWeight: '900', letterSpacing: -0.7, marginTop: 4 },
  sheetSubtitle: { color: C.inkSoft, fontSize: 12, lineHeight: 18, marginTop: 9, marginBottom: 16, maxWidth: 330 },
  cheerGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 9 },
  cheerOption: { width: '48.6%', minHeight: 95, borderRadius: 18, padding: 13, backgroundColor: C.paper, borderWidth: 1, borderColor: C.line },
  cheerOptionPressed: { backgroundColor: C.lime, borderColor: C.lime },
  cheerEmoji: { fontSize: 22 },
  cheerOptionText: { color: C.ink, fontSize: 12, lineHeight: 16, fontWeight: '700', marginTop: 7 },
});
