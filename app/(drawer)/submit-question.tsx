import { Pressable, Text, TextInput, View } from 'react-native';
import { useState } from 'react';
import { colors } from '@/constants/theme';

export default function SubmitQuestionScreen() {
  const [text, setText] = useState('');

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg, padding: 16, gap: 12 }}>
      <Text style={{ color: colors.text, fontSize: 20, fontWeight: '700' }}>Submit Question</Text>
      <TextInput
        value={text}
        onChangeText={setText}
        multiline
        placeholder="Write a global yes/no question"
        placeholderTextColor={colors.muted}
        style={{ minHeight: 120, borderWidth: 1, borderColor: '#24324a', borderRadius: 12, padding: 12, color: colors.text }}
      />
      <Pressable style={{ backgroundColor: colors.accent, borderRadius: 10, padding: 12 }}>
        <Text style={{ textAlign: 'center', fontWeight: '800', color: '#03141c' }}>Submit (1 per week)</Text>
      </Pressable>
    </View>
  );
}
