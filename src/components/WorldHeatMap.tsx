import MapView, { Circle } from 'react-native-maps';
import { StyleSheet, View } from 'react-native';

interface CountryPulse {
  lat: number;
  lng: number;
  yesRatio: number;
}

interface Props {
  data: CountryPulse[];
}

export function WorldHeatMap({ data }: Props) {
  return (
    <View style={styles.container}>
      <MapView
        style={StyleSheet.absoluteFill}
        initialRegion={{ latitude: 15, longitude: 0, latitudeDelta: 130, longitudeDelta: 130 }}
      >
        {data.map((point, idx) => (
          <Circle
            key={idx}
            center={{ latitude: point.lat, longitude: point.lng }}
            radius={70000}
            fillColor={point.yesRatio >= 0.5 ? 'rgba(107,255,180,0.5)' : 'rgba(255,107,157,0.5)'}
            strokeColor={point.yesRatio >= 0.5 ? '#6bffb4' : '#ff6b9d'}
          />
        ))}
      </MapView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    height: 240,
    borderRadius: 16,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#00f6ff',
  },
});
