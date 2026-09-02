import { StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors } from './ui/theme';

type MapMember = {
  id: string;
  name: string;
  initials: string;
  color: string;
  latitude: number;
  longitude: number;
  isYou?: boolean;
};

type MapDestination = {
  name: string;
  latitude: number;
  longitude: number;
};

function position(latitude: number, longitude: number) {
  const left = Math.max(12, Math.min(86, 18 + ((longitude - 103.84) / 0.05) * 64));
  const top = Math.max(18, Math.min(68, 62 - ((latitude - 1.275) / 0.05) * 45));
  return { left: `${left}%` as `${number}%`, top: `${top}%` as `${number}%` };
}

export function GroupMap({ members, start, destination }: { members: MapMember[]; start: MapDestination; destination: MapDestination; follow?: boolean; fitKey?: number; onGesture?: () => void }) {
  return (
    <View style={StyleSheet.absoluteFill}>
      <View style={styles.map}>
        <View style={[styles.water, styles.waterOne]} />
        <View style={[styles.water, styles.waterTwo]} />
        <View style={[styles.road, styles.roadOne]} />
        <View style={[styles.road, styles.roadTwo]} />
        <View style={[styles.road, styles.roadThree]} />
        <View style={styles.park}><Text style={styles.parkText}>GARDENS BY THE BAY</Text></View>
        <Text style={[styles.mapLabel, { left: '12%', top: '39%' }]}>MARINA BAY</Text>
        <Text style={[styles.mapLabel, { right: '8%', top: '24%' }]}>KALLANG</Text>
        <View style={styles.routeLine} />
        <View style={[styles.startMarker, position(start.latitude, start.longitude)]}><Text style={styles.startMarkerText}>A</Text></View>
        <View style={[styles.destinationMarker, position(destination.latitude, destination.longitude)]}>
          <Ionicons name="flag" size={18} color={colors.ink} />
        </View>
        {members.map((member, index) => (
          <View key={member.id} style={[styles.memberPin, member.isYou && styles.memberPinYou, position(member.latitude, member.longitude), index > 0 && { marginLeft: index * 9, marginTop: index * 7 }]}>
            <View style={[styles.avatar, { backgroundColor: member.color }]}><Text style={styles.avatarText}>{member.initials}</Text></View>
            <Text style={styles.memberName}>{member.isYou ? 'YOU' : member.name.toUpperCase()}</Text>
          </View>
        ))}
        <View style={styles.previewBadge}><View style={styles.liveDot} /><Text style={styles.previewText}>LIVE GROUP MAP</Text></View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  map: { flex: 1, backgroundColor: colors.map, overflow: 'hidden' },
  water: { position: 'absolute', backgroundColor: colors.water, borderRadius: 180, opacity: 0.88 },
  waterOne: { width: '74%', height: '45%', right: '-20%', bottom: '20%', transform: [{ rotate: '-18deg' }] },
  waterTwo: { width: '50%', height: '24%', left: '-18%', top: '12%', transform: [{ rotate: '18deg' }] },
  road: { position: 'absolute', height: 5, backgroundColor: '#FFFFFF', borderRadius: 4, opacity: 0.85 },
  roadOne: { width: '110%', left: '-8%', top: '31%', transform: [{ rotate: '16deg' }] },
  roadTwo: { width: '95%', left: '5%', top: '53%', transform: [{ rotate: '-11deg' }] },
  roadThree: { width: '75%', left: '22%', top: '15%', transform: [{ rotate: '65deg' }] },
  park: { position: 'absolute', width: '34%', height: '22%', right: '12%', top: '12%', borderRadius: 60, backgroundColor: colors.park, alignItems: 'center', justifyContent: 'center', transform: [{ rotate: '-8deg' }] },
  parkText: { color: colors.soft, fontSize: 7, fontWeight: '900', letterSpacing: 1 },
  mapLabel: { position: 'absolute', color: colors.soft, fontSize: 8, fontWeight: '900', letterSpacing: 1.2 },
  routeLine: { position: 'absolute', width: '58%', height: 6, left: '24%', top: '43%', borderRadius: 4, backgroundColor: colors.accent, transform: [{ rotate: '-20deg' }], opacity: 0.9 },
  destinationMarker: { position: 'absolute', width: 42, height: 42, marginLeft: -21, marginTop: -21, borderRadius: 14, backgroundColor: colors.lime, borderWidth: 3, borderColor: colors.paper, alignItems: 'center', justifyContent: 'center', shadowColor: colors.ink, shadowOpacity: 0.18, shadowRadius: 7 },
  startMarker: { position: 'absolute', width: 34, height: 34, marginLeft: -17, marginTop: -17, borderRadius: 17, backgroundColor: colors.ink, borderWidth: 3, borderColor: colors.paper, alignItems: 'center', justifyContent: 'center' },
  startMarkerText: { color: colors.white, fontSize: 11, fontWeight: '900' },
  memberPin: { position: 'absolute', marginLeft: -22, marginTop: -22, alignItems: 'center' },
  memberPinYou: { padding: 3, borderRadius: 25, backgroundColor: colors.lime },
  avatar: { width: 40, height: 40, borderRadius: 20, borderWidth: 3, borderColor: colors.paper, alignItems: 'center', justifyContent: 'center' },
  avatarText: { color: colors.white, fontSize: 13, fontWeight: '900' },
  memberName: { marginTop: 3, backgroundColor: colors.paper, color: colors.ink, fontSize: 7, fontWeight: '900', paddingHorizontal: 5, paddingVertical: 2, borderRadius: 5, overflow: 'hidden' },
  previewBadge: { position: 'absolute', left: 16, top: 112, flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 10, paddingVertical: 7, borderRadius: 12, backgroundColor: 'rgba(247,251,248,0.92)' },
  liveDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: colors.accent },
  previewText: { color: colors.ink, fontSize: 8, fontWeight: '900', letterSpacing: 1 },
});
