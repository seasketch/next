import { GLLegendGradientPanel } from "./LegendDataModel";
import { stopsToLinearGradient } from "./utils";

export default function LegendGradientPanel({
  panel,
}: {
  panel: GLLegendGradientPanel;
}) {
  const vals = panel.stops.map((stop) => stop.value);
  const maxVal = Math.max(...vals);
  const maxStop = panel.stops[vals.indexOf(maxVal)];
  const firstStop = panel.stops[0];
  return (
    <li key={panel.id} className="">
      {panel.label && <h3 className="text-xs font-mono my-1">{panel.label}</h3>}
      <div
        className="w-full h-3"
        style={{
          background: stopsToLinearGradient(panel.stops),
        }}
      ></div>
      <div className="flex justify-between text-xs">
        <span className="text-left">
          {firstStop.label ? firstStop.label : firstStop.value.toLocaleString()}
        </span>
        <span className="text-right">
          {maxStop.label ? maxStop.label : maxStop.value.toLocaleString()}
        </span>
      </div>
    </li>
  );
}
