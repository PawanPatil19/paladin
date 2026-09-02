import { useState } from 'react';
import { Ionicons } from '@expo/vector-icons';
import { KeyboardAvoidingView, Platform, Pressable, SafeAreaView, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { ACTIVITY, type ActivityKind } from '../../domain/activity';
import { DEFAULT_ROUTE, ROUTE_POINTS, routeDistanceKm, routeIsValid, type ActivityRoute, type RoutePoint } from '../../domain/route';
import type { Profile } from '../../storage';
import { Button } from '../../ui/Button';
import { colors } from '../../ui/theme';

export type SetupMode = 'create' | 'join';
export type ActivitySetupValue = {
  name: string;
  code: string;
  activity: ActivityKind;
  activityName: string;
  groupName: string;
  route: ActivityRoute;
};

type Props = {
  mode: SetupMode;
  profile: Profile;
  busy: boolean;
  error: string;
  onBack: () => void;
  onSubmit: (value: ActivitySetupValue) => void;
};

function PointPicker({ label, marker, value, onChange }: { label: string; marker: 'A' | 'B'; value: RoutePoint; onChange: (point: RoutePoint) => void }) {
  return (
    <View style={styles.field}>
      <View style={styles.routeLabelRow}>
        <View style={[styles.routeMarker, marker === 'B' && styles.endMarker]}><Text style={styles.routeMarkerText}>{marker}</Text></View>
        <Text style={styles.fieldLabel}>{label}</Text>
      </View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.pointList}>
        {ROUTE_POINTS.map((point) => {
          const active = point.id === value.id;
          return (
            <Pressable key={point.id} accessibilityRole="button" accessibilityLabel={`${label}: ${point.name}`} onPress={() => onChange(point)} style={[styles.pointCard, active && styles.pointCardActive]}>
              <Ionicons name={point.icon} size={21} color={active ? colors.white : colors.ink} />
              <Text style={[styles.pointName, active && styles.pointTextActive]}>{point.name}</Text>
              <Text style={[styles.pointAddress, active && styles.pointAddressActive]} numberOfLines={2}>{point.address}</Text>
            </Pressable>
          );
        })}
      </ScrollView>
    </View>
  );
}

export function ActivitySetupScreen({ mode, profile, busy, error, onBack, onSubmit }: Props) {
  const [name, setName] = useState(profile.displayName);
  const [code, setCode] = useState('');
  const [activity, setActivity] = useState<ActivityKind>('ride');
  const [activityName, setActivityName] = useState('');
  const [groupName, setGroupName] = useState('');
  const [route, setRoute] = useState(DEFAULT_ROUTE);
  const validRoute = routeIsValid(route);
  const valid = name.trim().length >= 2 && (mode === 'join' ? code.length === 6 : validRoute);
  const copy = ACTIVITY[activity];

  return (
    <SafeAreaView style={styles.screen}>
      <KeyboardAvoidingView style={styles.fill} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={styles.header}>
          <Pressable accessibilityRole="button" accessibilityLabel="Go back" onPress={onBack} style={styles.iconButton}><Ionicons name="arrow-back" size={21} color={colors.ink} /></Pressable>
          <Text style={styles.headerTitle}>{mode === 'create' ? 'CREATE ACTIVITY' : 'JOIN ACTIVITY'}</Text>
          <View style={styles.headerSpacer} />
        </View>
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <Text style={styles.kicker}>{mode === 'create' ? 'PLAN TOGETHER' : 'ENTER YOUR CODE'}</Text>
          <Text style={styles.pageTitle}>{mode === 'create' ? 'Choose your route.' : 'Your group is waiting.'}</Text>
          <Text style={styles.body}>{mode === 'create' ? 'Pick running or cycling, then choose where everyone starts and finishes.' : 'Codes are six letters or numbers and are not case-sensitive.'}</Text>

          <View style={styles.field}><Text style={styles.fieldLabel}>DISPLAY NAME</Text><TextInput value={name} onChangeText={setName} placeholder="What should we call you?" placeholderTextColor="#97A59F" style={styles.input} maxLength={24} /></View>

          {mode === 'join' ? (
            <View style={styles.field}><Text style={styles.fieldLabel}>GROUP CODE</Text><TextInput value={code} onChangeText={(value) => setCode(value.trim().toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6))} placeholder="CCAM34" placeholderTextColor="#97A59F" style={[styles.input, styles.codeInput]} autoCapitalize="characters" /></View>
          ) : (
            <>
              <View style={styles.field}>
                <Text style={styles.fieldLabel}>ACTIVITY</Text>
                <View style={styles.activityTabs}>
                  {(Object.keys(ACTIVITY) as ActivityKind[]).map((kind) => {
                    const selected = activity === kind;
                    return <Pressable key={kind} accessibilityRole="button" accessibilityLabel={`Choose ${ACTIVITY[kind].label}`} onPress={() => setActivity(kind)} style={[styles.activityTab, selected && styles.activityTabActive]}><Ionicons name={ACTIVITY[kind].icon} size={22} color={selected ? colors.white : colors.ink} /><View><Text style={[styles.activityTitle, selected && styles.pointTextActive]}>{ACTIVITY[kind].label}</Text><Text style={[styles.activityHint, selected && styles.pointAddressActive]}>{kind === 'run' ? 'Track pace' : 'Track speed'}</Text></View></Pressable>;
                  })}
                </View>
              </View>
              <View style={styles.field}><Text style={styles.fieldLabel}>{copy.noun.toUpperCase()} NAME · OPTIONAL</Text><TextInput value={activityName} onChangeText={setActivityName} placeholder={activity === 'run' ? 'Saturday park run' : 'Sunday morning ride'} placeholderTextColor="#97A59F" style={styles.input} maxLength={50} /></View>
              <View style={styles.field}><Text style={styles.fieldLabel}>GROUP NAME · OPTIONAL</Text><TextInput value={groupName} onChangeText={setGroupName} placeholder="East Side Kaki" placeholderTextColor="#97A59F" style={styles.input} maxLength={40} /></View>
              <PointPicker label="START POINT" marker="A" value={route.start} onChange={(start) => setRoute({ ...route, start })} />
              <PointPicker label="END POINT" marker="B" value={route.end} onChange={(end) => setRoute({ ...route, end })} />
              <View style={[styles.routeSummary, !validRoute && styles.routeSummaryError]}><Ionicons name={validRoute ? 'navigate-outline' : 'alert-circle-outline'} size={21} color={validRoute ? colors.ink : colors.red} /><View style={styles.flex}><Text style={styles.routeSummaryTitle}>{validRoute ? `${route.start.name} → ${route.end.name}` : 'Choose two different points'}</Text>{validRoute ? <Text style={styles.routeSummaryText}>Approximately {routeDistanceKm(route).toFixed(1)} km point to point</Text> : null}</View></View>
            </>
          )}
          {error ? <View style={styles.error}><Ionicons name="alert-circle" size={19} color={colors.red} /><Text style={styles.errorText}>{error}</Text></View> : null}
        </ScrollView>
        <View style={styles.sticky}><Button disabled={!valid || busy} label={busy ? (mode === 'create' ? 'Creating…' : 'Joining…') : mode === 'create' ? `Create ${copy.label} Group` : 'Join Activity'} icon="arrow-forward" onPress={() => onSubmit({ name: name.trim(), code, activity, activityName: activityName.trim(), groupName: groupName.trim(), route })} /></View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 }, flex: { flex: 1 }, screen: { flex: 1, backgroundColor: colors.cream },
  header: { minHeight: 66, paddingHorizontal: 20, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  iconButton: { width: 42, height: 42, borderRadius: 21, backgroundColor: colors.paper, borderWidth: 1, borderColor: colors.line, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { fontSize: 11, fontWeight: '900', color: colors.ink, letterSpacing: 1.5 }, headerSpacer: { width: 42 },
  content: { padding: 24, paddingBottom: 132 }, kicker: { color: colors.orange, fontSize: 10, fontWeight: '900', letterSpacing: 1.6, marginBottom: 9 },
  pageTitle: { color: colors.ink, fontSize: 36, lineHeight: 39, fontWeight: '900', letterSpacing: -1.2 }, body: { color: colors.soft, fontSize: 15, lineHeight: 22, marginTop: 13 },
  field: { marginTop: 26 }, fieldLabel: { color: colors.ink, fontSize: 10, fontWeight: '900', letterSpacing: 1.4, marginBottom: 9 },
  input: { height: 58, borderRadius: 17, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.paper, paddingHorizontal: 16, color: colors.ink, fontSize: 16, fontWeight: '600' },
  codeInput: { textAlign: 'center', letterSpacing: 7, fontSize: 23, fontWeight: '900' },
  activityTabs: { flexDirection: 'row', gap: 10 }, activityTab: { flex: 1, minHeight: 78, borderRadius: 19, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.paper, padding: 14, flexDirection: 'row', gap: 10, alignItems: 'center' }, activityTabActive: { backgroundColor: colors.ink, borderColor: colors.ink },
  activityTitle: { color: colors.ink, fontSize: 14, fontWeight: '900' }, activityHint: { color: colors.soft, fontSize: 10, marginTop: 2 },
  routeLabelRow: { flexDirection: 'row', alignItems: 'center', gap: 8 }, routeMarker: { width: 22, height: 22, borderRadius: 11, backgroundColor: colors.ink, alignItems: 'center', justifyContent: 'center', marginBottom: 9 }, endMarker: { backgroundColor: colors.orange }, routeMarkerText: { color: colors.white, fontWeight: '900', fontSize: 10 },
  pointList: { gap: 10, paddingRight: 24 }, pointCard: { width: 168, minHeight: 126, padding: 14, borderRadius: 20, backgroundColor: colors.paper, borderWidth: 1, borderColor: colors.line, gap: 7 }, pointCardActive: { backgroundColor: colors.ink, borderColor: colors.ink },
  pointName: { color: colors.ink, fontWeight: '800', fontSize: 14 }, pointTextActive: { color: colors.white }, pointAddress: { color: colors.soft, fontSize: 10, lineHeight: 14 }, pointAddressActive: { color: '#D9E9E3' },
  routeSummary: { marginTop: 20, borderRadius: 18, backgroundColor: colors.mint, padding: 14, flexDirection: 'row', alignItems: 'center', gap: 11 }, routeSummaryError: { backgroundColor: '#FCE5DE' }, routeSummaryTitle: { color: colors.ink, fontWeight: '800', fontSize: 13 }, routeSummaryText: { color: colors.soft, fontSize: 10, marginTop: 3 },
  error: { marginTop: 20, padding: 13, borderRadius: 14, backgroundColor: '#FCE5DE', flexDirection: 'row', alignItems: 'center', gap: 9 }, errorText: { flex: 1, color: colors.red, fontSize: 12, lineHeight: 17 },
  sticky: { paddingHorizontal: 24, paddingTop: 12, paddingBottom: Platform.OS === 'android' ? 22 : 12, backgroundColor: colors.cream, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.line },
});
