import SimpleSymbol from "./SimpleSymbol";
import { GLLegendListPanel } from "./LegendDataModel";
import { Map } from "mapbox-gl";

export default function LegendListPanel({
  panel,
  map,
}: {
  panel: GLLegendListPanel;
  map?: Map;
}) {
  return (
    <li key={panel.id} className="w-full">
      {panel.label && (
        <h3 className="text-xs font-mono my-1">{panel.label}</h3>
      )}
      <ul className="space-y-0.5 w-full">
        {panel.items.map((item) => {
          return (
            <li
              key={item.id}
              className={`flex items-center space-x-2 max-w-full`}
            >
              <div className="items-center justify-center bg-transparent">
                {item.symbol ? (
                  <SimpleSymbol map={map} data={item.symbol} />
                ) : null}
              </div>

              <span className="truncate flex-1">{item.label}</span>
            </li>
          );
        })}
      </ul>
    </li>
  );
}
