import { Pressable, Text, View } from 'react-native';
import { colors } from '@/constants/theme';
import { BinaryChoice } from '@/types/domain';

type Props = {
  disabled: boolean;
  onVote: (vote: BinaryChoice) => void;
};

export function VoteCard({ disabled, onVote }: Props) {
  return (
    <View style={{ backgroundColor: colors.card, padding: 16, borderRadius: 14, gap: 12, borderWidth: 1, borderColor: colors.border }}>
      <Text style={{ color: colors.text, fontSize: 18, fontWeight: '700' }}>Cast your vote</Text>
      <Text style={{ color: colors.muted }}>
        {disabled ? 'Submit prediction first to unlock voting.' : 'Your vote updates global results instantly.'}
      </Text>
      <View style={{ flexDirection: 'row', gap: 12 }}>
        {(['YES', 'NO'] as BinaryChoice[]).map((value) => (
          <Pressable
            key={value}
            disabled={disabled}
            onPress={() => onVote(value)}
            style={{
              flex: 1,
              borderRadius: 12,
              padding: 14,
              alignItems: 'center',
              backgroundColor: disabled ? colors.accentSoft : colors.accent,
              opacity: disabled ? 0.6 : 1
            }}
          >
            <Text style={{ color: '#ffffff', fontWeight: '800' }}>{value}</Text>
          </Pressable>
        ))}
      </View>
    </View>
  );
}
