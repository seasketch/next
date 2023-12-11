import { GLLegendGradientPanel } from "./LegendDataModel";
import { stopsToLinearGradient } from "./utils";

export default function LegendGradientPanel({
  panel,
}: {
  panel: GLLegendGradientPanel;
}) {
  const vals = panel.stops.map((stop) => stop.value);
  const maxVal = Math.max(...vals);
  const firstVal = vals[0];
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
        <span className="text-left">{firstVal?.toLocaleString()}</span>
        <span className="text-right">{maxVal?.toLocaleString()}</span>
      </div>
    </li>
  );
}
