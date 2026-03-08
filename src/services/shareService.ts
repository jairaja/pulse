import * as Sharing from 'expo-sharing';

export async function shareCard(path: string) {
  if (await Sharing.isAvailableAsync()) {
    await Sharing.shareAsync(path);
  }
}
