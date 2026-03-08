import { VictoryBar, VictoryChart, VictoryTheme } from 'victory-native';

type Props = { worldYesPct: number; countryYesPct: number };

export function ResultChart({ worldYesPct, countryYesPct }: Props) {
  const data = [
    { x: 'World YES', y: worldYesPct },
    { x: 'Country YES', y: countryYesPct },
  ];

  return (
    <VictoryChart theme={VictoryTheme.material} domain={{ y: [0, 100] }}>
      <VictoryBar data={data} style={{ data: { fill: '#00F5D4' } }} />
    </VictoryChart>
  );
}
