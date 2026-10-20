import { useMemo } from 'react';
import { ScrollView, StyleSheet, Text } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useAppTheme, type ThemeColors } from '../lib/theme';

export default function AboutScreen() {
  const { colors } = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  return (
    <SafeAreaView edges={['bottom']} style={styles.screen}>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.eyebrow}>ABOUT PULSE</Text>
        <Text style={styles.title}>One world. One question. One answer today. No awkward profile form.</Text>
        <Text style={styles.body}>
          PULSE is a small experiment in finding out what people think today—not what an algorithm
          thinks they should think.
        </Text>
        <Text style={styles.body}>
          You can use PULSE without an account. An optional email account may be offered to protect
          your voting history across devices; a name is not required for that. There are no ads. If
          a question is sponsored, we will say so plainly.
        </Text>
        <Text style={styles.body}>
          Each daily question opens at 00:00 UTC and closes at the next 00:00 UTC. Results and the next
          question become available at that boundary. A verified email account is required to submit
          community questions or use the one daily community upvote.
        </Text>
        <Text style={styles.body}>
          Questions may repeat because people change. “Am I happy today?” can have a very different
          answer next month. Humans are inconveniently interesting like that.
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
  screen: { backgroundColor: colors.canvas, flex: 1 },
  content: { gap: 22, padding: 24, paddingBottom: 48 },
  eyebrow: { color: colors.accent, fontSize: 12, fontWeight: '700', letterSpacing: 1.2 },
  title: { color: colors.ink, fontSize: 32, fontWeight: '700', letterSpacing: -0.7, lineHeight: 39 },
  body: { color: colors.body, fontSize: 17, lineHeight: 27 }
});
}
