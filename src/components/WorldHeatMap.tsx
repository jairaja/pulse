import MapView, { Circle } from 'react-native-maps';
import { View } from 'react-native';

type HeatPoint = { lat: number; lon: number; yesRatio: number };

const points: HeatPoint[] = [
  { lat: 51.5, lon: -0.1, yesRatio: 0.62 },
  { lat: 40.7, lon: -74.0, yesRatio: 0.44 },
  { lat: 35.7, lon: 139.7, yesRatio: 0.73 },
  { lat: -33.9, lon: 151.2, yesRatio: 0.51 },
];

export function WorldHeatMap() {
  return (
    <View style={{ height: 240, borderRadius: 16, overflow: 'hidden' }}>
      <MapView
        style={{ flex: 1 }}
        initialRegion={{ latitude: 20, longitude: 0, latitudeDelta: 120, longitudeDelta: 120 }}
        mapType="mutedStandard"
      >
        {points.map((p, idx) => {
          const color = p.yesRatio >= 0.5 ? 'rgba(0,245,212,0.5)' : 'rgba(255,77,109,0.5)';
          return <Circle key={idx} center={{ latitude: p.lat, longitude: p.lon }} radius={450000} fillColor={color} strokeColor={color} />;
        })}
      </MapView>
    </View>
  );
}
