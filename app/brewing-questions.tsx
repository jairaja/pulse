import { useMemo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useAppTheme, type ThemeColors } from '../lib/theme';

export default function BrewingQuestionsScreen() {
  const { colors } = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  return (
    <SafeAreaView edges={['bottom']} style={styles.screen}>
      <View style={styles.content}>
        <Text style={styles.eyebrow}>BREWING QUESTIONS</Text>
        <View style={styles.message}>
          <Text style={styles.title}>Tomorrow’s question starts here.</Text>
          <Text style={styles.body}>Community questions and voting are coming in a later step.</Text>
        </View>
        <Pressable
          accessibilityRole="button"
          disabled
          style={styles.button}
        >
          <Text style={styles.buttonText}>Ask a question · Coming soon</Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
  screen: { backgroundColor: colors.canvas, flex: 1 },
  content: { flex: 1, justifyContent: 'space-between', padding: 24 },
  eyebrow: { color: colors.accent, fontSize: 12, fontWeight: '700', letterSpacing: 1.2 },
  message: { gap: 12 },
  title: { color: colors.ink, fontSize: 32, fontWeight: '700', letterSpacing: -0.7, lineHeight: 39 },
  body: { color: colors.muted, fontSize: 16, lineHeight: 24 },
  button: {
    alignItems: 'center',
    backgroundColor: colors.disabledSurface,
    borderColor: colors.disabledBorder,
    borderRadius: 18,
    borderWidth: 1,
    minHeight: 58,
    justifyContent: 'center'
  },
  buttonText: { color: colors.disabledText, fontSize: 15, fontWeight: '700' }
});
}
