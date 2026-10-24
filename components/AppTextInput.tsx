import { StyleSheet, TextInput as NativeInput, type TextInputProps } from 'react-native';
import { usePreferences } from '../lib/preferences';
export function AppTextInput({ style, ...props }: TextInputProps) {
  const { preferences } = usePreferences(); const flat = StyleSheet.flatten(style);
  return <NativeInput {...props} allowFontScaling style={[style, preferences.largerText && { fontSize: (flat?.fontSize ?? 17) * 1.25 }]} />;
}
