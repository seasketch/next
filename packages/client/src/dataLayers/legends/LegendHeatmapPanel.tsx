import { GLLegendHeatmapPanel } from "./LegendDataModel";
import { stopsToLinearGradient } from "./utils";

export default function LegendHeatmapPanel({
  panel,
}: {
  panel: GLLegendHeatmapPanel;
}) {
  return (
    <li key={panel.id} className="flex rounded overflow-hidden mb-1">
      <div
        className="w-1/2 h-3"
        style={{
          background: stopsToLinearGradient(panel.stops),
        }}
      ></div>
      <div
        className="w-1/2 h-3 transform rotate-180"
        style={{
          background: stopsToLinearGradient(panel.stops),
        }}
      ></div>
    </li>
  );
}
