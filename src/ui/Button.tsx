import type { ComponentProps } from 'react';
import { Pressable, StyleSheet, Text } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors } from './theme';

type ButtonProps = {
  label: string;
  onPress: () => void;
  secondary?: boolean;
  danger?: boolean;
  disabled?: boolean;
  icon?: ComponentProps<typeof Ionicons>['name'];
};

export function Button({ label, onPress, secondary, danger, disabled, icon }: ButtonProps) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [styles.button, secondary && styles.secondary, danger && styles.danger, disabled && styles.disabled, pressed && styles.pressed]}
    >
      <Text style={[styles.label, secondary && styles.secondaryLabel]}>{label}</Text>
      {icon ? <Ionicons name={icon} size={19} color={secondary ? colors.ink : colors.white} /> : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: { minHeight: 58, borderRadius: 29, backgroundColor: colors.orange, paddingHorizontal: 22, flexDirection: 'row', gap: 10, alignItems: 'center', justifyContent: 'center' },
  secondary: { backgroundColor: colors.paper, borderWidth: 1, borderColor: colors.line },
  danger: { backgroundColor: colors.red },
  disabled: { opacity: 0.45 },
  pressed: { opacity: 0.78, transform: [{ scale: 0.985 }] },
  label: { color: colors.white, fontSize: 16, fontWeight: '800' },
  secondaryLabel: { color: colors.ink },
});
