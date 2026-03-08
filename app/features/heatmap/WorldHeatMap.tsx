import MapView, { Circle } from 'react-native-maps';

type CountrySignal = {
  countryCode: string;
  latitude: number;
  longitude: number;
  yesRatio: number;
};

const demo: CountrySignal[] = [
  { countryCode: 'GB', latitude: 51.5072, longitude: -0.1276, yesRatio: 0.62 },
  { countryCode: 'US', latitude: 40.7128, longitude: -74.006, yesRatio: 0.51 },
  { countryCode: 'IN', latitude: 28.6139, longitude: 77.209, yesRatio: 0.71 }
];

export function WorldHeatMap() {
  return (
    <MapView style={{ height: 260, borderRadius: 12 }}>
      {demo.map((country) => (
        <Circle
          key={country.countryCode}
          center={{ latitude: country.latitude, longitude: country.longitude }}
          radius={500000}
          fillColor={country.yesRatio >= 0.5 ? 'rgba(0,230,255,0.25)' : 'rgba(255,40,110,0.25)'}
          strokeColor={country.yesRatio >= 0.5 ? '#00E6FF' : '#FF286E'}
        />
      ))}
    </MapView>
  );
}
