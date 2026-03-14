import { Alert, Pressable, Share, Text, View } from 'react-native';
import { env } from '@/config/env';
import { colors } from '@/constants/theme';

type Props = {
  question: string;
  worldResult: string;
  countryResult: string;
  userVote: string;
};

export function ShareCard({ question, worldResult, countryResult, userVote }: Props) {
  const onShare = async () => {
    try {
      await Share.share({
        message: `${question}\nWorld: ${worldResult}\nCountry: ${countryResult}\nMy vote: ${userVote}\n\nGet the NO LOGIN required app.\nCheck out the world's pulse and get yours heard.\n${env.pulseWebsiteUrl}`
      });
    } catch {
      Alert.alert('Share failed', 'Please try again.');
    }
  };

  return (
    <View style={{ backgroundColor: colors.card, padding: 16, borderRadius: 14, gap: 12, borderWidth: 1, borderColor: colors.border }}>
      <Text style={{ color: colors.text, fontWeight: '700' }}>Share today’s pulse</Text>
      <Pressable onPress={() => void onShare()} style={{ padding: 12, borderRadius: 10, backgroundColor: colors.accent }}>
        <Text style={{ textAlign: 'center', fontWeight: '800', color: '#ffffff' }}>Share</Text>
      </Pressable>
    </View>
  );
}
