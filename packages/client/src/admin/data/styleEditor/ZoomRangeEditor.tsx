import { Cross1Icon } from "@radix-ui/react-icons";
import { Trans } from "react-i18next";
import * as Editor from "./Editors";

export function ZoomRangeEditor({
  minzoom,
  maxzoom,
  onChange,
}: {
  minzoom?: number;
  maxzoom?: number;
  onChange: (minzoom?: number, maxzoom?: number) => void;
}) {
  if (minzoom === undefined || maxzoom === undefined) {
    return null;
  }
  return (
    <div className="flex flex-1 items-center group text-sm h-10">
      <h3 className="capitalize text-sm flex-1 flex items-center space-x-2">
        <span>
          <Trans ns="admin:data">zoom range</Trans>
        </span>
        <button
          onClick={() => {
            onChange(undefined, undefined);
          }}
          className="opacity-0 group-hover:opacity-80 text-indigo-300"
        >
          <Cross1Icon />
        </button>
      </h3>
      <Editor.Control>
        <input
          type="number"
          className="bg-gray-700 rounded-l py-0.5 pr-0.5 w-14"
          value={minzoom}
          min={0}
          max={Math.min(maxzoom, 16)}
          step={1}
          onChange={(e) => onChange(parseFloat(e.target.value), maxzoom)}
        />
        <input
          type="number"
          className="bg-gray-700 rounded-r py-0.5 pr-0.5  w-14"
          value={maxzoom}
          min={Math.max(minzoom, 2)}
          max={22}
          step={1}
          onChange={(e) => onChange(minzoom, parseFloat(e.target.value))}
        />
      </Editor.Control>
    </div>
  );
}
