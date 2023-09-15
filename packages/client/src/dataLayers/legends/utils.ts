/**
 * Converts a set of stops to a css linear-gradient
 * @param stops { color: string; value: number}
 */
export function stopsToLinearGradient(
  stops: { color: string; value: number }[]
): string {
  const sortedStops = [...stops].sort((a, b) => a.value - b.value);
  const colors = sortedStops.map((stop) => stop.color);
  const values = sortedStops.map((stop) => stop.value);
  const max = Math.max(...values);
  const min = Math.min(...values);
  const percentages = values.map((val) => (val - min) / (max - min));
  const stopStrings = colors.map(
    (color, i) => `${color} ${percentages[i] * 100}%`
  );
  // eslint-disable-next-line i18next/no-literal-string
  return `linear-gradient(90deg, ${stopStrings.join(", ")})`;
}
