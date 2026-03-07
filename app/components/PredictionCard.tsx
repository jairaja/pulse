import { Pressable, Text, View } from 'react-native';
import { colors } from '@/constants/theme';
import { BinaryChoice } from '@/types/domain';

type Props = { onSelect: (value: BinaryChoice) => void; disabled?: boolean };

export function PredictionCard({ onSelect, disabled }: Props) {
  return (
    <View style={{ backgroundColor: colors.card, padding: 16, borderRadius: 14, gap: 12 }}>
      <Text style={{ color: colors.text, fontSize: 18, fontWeight: '700' }}>
        What do you predict the world will say?
      </Text>
      <View style={{ flexDirection: 'row', gap: 12 }}>
        {(['YES', 'NO'] as BinaryChoice[]).map((value) => (
          <Pressable
            key={value}
            disabled={disabled}
            onPress={() => onSelect(value)}
            style={{
              flex: 1,
              borderWidth: 1,
              borderColor: colors.accent,
              borderRadius: 12,
              padding: 14,
              alignItems: 'center'
            }}
          >
            <Text style={{ color: colors.accent, fontWeight: '700' }}>{value}</Text>
          </Pressable>
        ))}
      </View>
    </View>
  );
}
