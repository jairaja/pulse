import MapView, { Circle } from 'react-native-maps';
import { HeatMapCountry } from '@/types/domain';

type Props = { points: HeatMapCountry[] };

export function WorldHeatMap({ points }: Props) {
  return (
    <MapView
      style={{ height: 240, borderRadius: 14 }}
      initialRegion={{ latitude: 20, longitude: 0, latitudeDelta: 100, longitudeDelta: 100 }}
    >
      {points.map((country) => (
        <Circle
          key={country.code}
          center={{ latitude: country.latitude, longitude: country.longitude }}
          radius={200000}
          strokeColor={country.yesRatio >= 0.5 ? '#4cf0ff' : '#ff3f79'}
          fillColor={country.yesRatio >= 0.5 ? 'rgba(76,240,255,0.3)' : 'rgba(255,63,121,0.3)'}
        />
      ))}
    </MapView>
  );
}
