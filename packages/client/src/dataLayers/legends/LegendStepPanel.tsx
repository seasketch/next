import MarkerSymbol from "./MarkerSymbol";
import { Map } from "mapbox-gl";
import { GLLegendStepPanel } from "./glLegends";
import SimpleSymbol from "./SimpleSymbol";

export default function LegendStepPanel({
  panel,
  map,
}: {
  panel: GLLegendStepPanel;
  map?: Map;
}) {
  return (
    <li key={panel.id} className="w-full">
      {panel.label && (
        <h3 className="text-xs font-mono pl-2 my-1">{panel.label}</h3>
      )}
      <ul className="space-y-0.5 w-full pl-2">
        {panel.steps.map((step) => {
          return (
            <li
              key={step.id}
              className={`flex items-center space-x-2 max-w-full`}
            >
              <div className="items-center justify-center bg-transparent">
                {map && <SimpleSymbol map={map} data={step.symbol} />}
              </div>
              <span className="truncate flex-1 text-right">{step.label}</span>
            </li>
          );
        })}
      </ul>
    </li>
  );
}
