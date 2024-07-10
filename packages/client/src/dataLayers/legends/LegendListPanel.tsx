import SimpleSymbol from "./SimpleSymbol";
import { GLLegendListPanel } from "./LegendDataModel";
import { Map } from "mapbox-gl";
import { useState } from "react";
import { Trans } from "react-i18next";
import { CaretDownIcon, CaretUpIcon } from "@radix-ui/react-icons";

const THRESHOLD = 12;
export default function LegendListPanel({
  panel,
  map,
}: {
  panel: GLLegendListPanel;
  map?: Map;
}) {
  const [showAll, setShowAll] = useState(panel.items.length <= THRESHOLD);
  return (
    <li key={panel.id} className="w-full">
      {panel.label && <h3 className="text-xs font-mono my-1">{panel.label}</h3>}
      <ul className="space-y-0.5 w-full">
        {panel.items
          .slice(0, showAll ? panel.items.length : THRESHOLD)
          .map((item) => {
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
        {!showAll && (
          <button
            className="text-xs text-gray-500 space-x-2 flex items-center py-1 px-2 border border-opacity-0 hover:border-opacity-100 hover:border-gray-200 rounded-full"
            onClick={() => setShowAll(true)}
          >
            <span>
              <Trans ns="homepage">
                Show all ({(panel.items.length - THRESHOLD).toString()} more)
              </Trans>
            </span>
            <CaretDownIcon className="w-5 h-5" />
          </button>
        )}
        {showAll && panel.items.length > THRESHOLD && (
          <button
            className="text-xs text-gray-500 space-x-2 flex items-center py-1 px-2 border border-opacity-0 hover:border-opacity-100 hover:border-gray-200 rounded-full"
            onClick={() => setShowAll(false)}
          >
            <span>
              <Trans ns="homepage">Show less</Trans>
            </span>
            <CaretUpIcon className="w-5 h-5" />
          </button>
        )}
      </ul>
    </li>
  );
}
