import SimpleSymbol from "./SimpleSymbol";
import { GLLegendSimpleSymbolPanel } from "./LegendDataModel";
import { Map } from "mapbox-gl";

export default function LegendSimpleSymbolPanel({
  panel,
  map,
}: {
  panel: GLLegendSimpleSymbolPanel;
  map?: Map;
}) {
  return (
    <li key={panel.id} className="w-full">
      {panel.label && (
        // eslint-disable-next-line i18next/no-literal-string
        <h3 className="text-xs font-mono pl-2 my-1">simple - {panel.label}</h3>
      )}
      <ul className="space-y-0.5 w-full pl-2">
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
              {item.label && (
                <span className="truncate flex-1">{item.label}</span>
              )}
            </li>
          );
        })}
      </ul>
    </li>
  );
}
