import { VictoryBar, VictoryChart, VictoryTheme } from 'victory-native';

export function ResultsChart({ yes, no }: { yes: number; no: number }) {
  return (
    <VictoryChart domainPadding={24} theme={VictoryTheme.material}>
      <VictoryBar
        data={[
          { x: 'YES', y: yes },
          { x: 'NO', y: no }
        ]}
        style={{ data: { fill: ({ datum }) => (datum.x === 'YES' ? '#00E6FF' : '#FF286E') } }}
      />
    </VictoryChart>
  );
}
