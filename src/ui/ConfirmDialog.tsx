import { Ionicons } from '@expo/vector-icons';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { Button } from './Button';
import { colors } from './theme';

type Props = {
  visible: boolean;
  title: string;
  body: string;
  confirmLabel: string;
  icon?: keyof typeof Ionicons.glyphMap;
  destructive?: boolean;
  busy?: boolean;
  onCancel: () => void;
  onConfirm: () => void;
};

export function ConfirmDialog({ visible, title, body, confirmLabel, icon = 'alert-circle-outline', destructive, busy, onCancel, onConfirm }: Props) {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onCancel}>
      <View style={styles.backdrop}>
        <View accessibilityViewIsModal style={styles.card}>
          <View style={[styles.icon, destructive && styles.destructive]}><Ionicons name={icon} size={26} color={destructive ? colors.red : colors.ink} /></View>
          <Text accessibilityRole="header" style={styles.title}>{title}</Text>
          <Text style={styles.body}>{body}</Text>
          <View style={styles.actions}>
            <Button label="Not now" secondary disabled={busy} onPress={onCancel} />
            <Button label={busy ? 'Please wait…' : confirmLabel} disabled={busy} onPress={onConfirm} />
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, padding: 24, justifyContent: 'center', backgroundColor: 'rgba(18,53,36,0.46)' },
  card: { borderRadius: 26, backgroundColor: colors.cream, padding: 22 },
  icon: { width: 52, height: 52, borderRadius: 18, backgroundColor: colors.lime, alignItems: 'center', justifyContent: 'center', marginBottom: 18 },
  destructive: { backgroundColor: '#FCE5DE' },
  title: { color: colors.ink, fontSize: 26, fontWeight: '900' },
  body: { color: colors.soft, fontSize: 14, lineHeight: 21, marginTop: 9 },
  actions: { gap: 10, marginTop: 22 },
});
