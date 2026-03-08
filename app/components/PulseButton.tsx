import { Pressable, StyleSheet, Text } from 'react-native';

type Props = {
  title: string;
  onPress: () => void;
  disabled?: boolean;
};

export function PulseButton({ title, onPress, disabled }: Props) {
  return (
    <Pressable onPress={onPress} disabled={disabled} style={[styles.button, disabled && styles.disabled]}>
      <Text style={styles.text}>{title}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    backgroundColor: '#00E6FF',
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: 'center'
  },
  disabled: {
    opacity: 0.5
  },
  text: {
    color: '#08111F',
    fontWeight: '700'
  }
});
