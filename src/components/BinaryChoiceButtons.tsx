import { Pressable, StyleSheet, Text, View } from 'react-native';
import { BinaryChoice } from '@/types/domain';

interface Props {
  onSelect: (choice: BinaryChoice) => void;
  disabled?: boolean;
  selected?: BinaryChoice;
}

export function BinaryChoiceButtons({ onSelect, disabled, selected }: Props) {
  return (
    <View style={styles.row}>
      {(['YES', 'NO'] as BinaryChoice[]).map((choice) => (
        <Pressable
          key={choice}
          onPress={() => onSelect(choice)}
          style={[styles.button, selected === choice && styles.selected, disabled && styles.disabled]}
          disabled={disabled}
        >
          <Text style={styles.label}>{choice}</Text>
        </Pressable>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: 12 },
  button: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#00f6ff',
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    backgroundColor: '#0d1324',
  },
  selected: {
    shadowColor: '#00f6ff',
    shadowOpacity: 0.7,
    shadowRadius: 12,
    elevation: 5,
  },
  disabled: { opacity: 0.5 },
  label: { color: '#eff3ff', fontWeight: '700' },
});
