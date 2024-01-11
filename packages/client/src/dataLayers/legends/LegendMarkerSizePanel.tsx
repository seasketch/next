import MarkerSymbol from "./MarkerSymbol";
import { GLMarkerSizePanel } from "./LegendDataModel";
import { Map } from "mapbox-gl";

export default function LegendMarkerSizePanel({
  panel,
  map,
}: {
  panel: GLMarkerSizePanel;
  map?: Map;
}) {
  return (
    <li key={panel.id} className="w-full">
      {panel.label && (
        <h3 className="text-xs font-mono my-1">{panel.label}</h3>
      )}
      <ul className="space-y-0.5 w-full">
        {panel.stops.map((stop) => {
          return (
            <li
              key={stop.imageId}
              className={`flex items-center space-x-2 max-w-full`}
            >
              <div className="items-center justify-center bg-transparent">
                {map && stop.imageId ? (
                  <MarkerSymbol
                    iconSize={stop.iconSize}
                    imageId={stop.imageId}
                    map={map}
                    fullSize
                  />
                ) : null}
              </div>

              <span className="truncate flex-1 text-right">
                {stop.value.toLocaleString()}
              </span>
            </li>
          );
        })}
      </ul>
    </li>
  );
}
