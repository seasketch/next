import { useState } from "react";
import { CaretDownIcon, CaretRightIcon } from "@radix-ui/react-icons";

export type HistogramSketchBreakdownRow = {
  sketchId: number;
  sketchName: string;
  values: Record<string, string>;
};

/**
 * Collapsible per-sketch footer for histogram widgets. Sketch names truncate
 * so a long collection child does not widen the stat columns.
 */
export default function HistogramSketchBreakdown({
  forceExpanded = false,
  showLabel,
  sketchHeader,
  columns,
  rows,
}: {
  forceExpanded?: boolean;
  showLabel: string;
  sketchHeader: string;
  columns: Array<{ key: string; label: string }>;
  rows: HistogramSketchBreakdownRow[];
}) {
  const [open, setOpen] = useState(false);
  const expanded = forceExpanded || open;
  if (!rows.length || !columns.length) return null;

  return (
    <div className="border-t border-gray-200/80">
      <button
        type="button"
        aria-expanded={expanded}
        className="flex w-full items-center gap-1 px-3 py-1.5 text-left text-[10px] font-medium uppercase tracking-wide text-gray-500 hover:text-gray-800"
        onClick={() => setOpen((current) => !current)}
      >
        {expanded ? (
          <CaretDownIcon className="h-3 w-3 shrink-0" aria-hidden />
        ) : (
          <CaretRightIcon className="h-3 w-3 shrink-0" aria-hidden />
        )}
        {showLabel}
      </button>
      {expanded && (
        <div className="overflow-x-auto px-3 pb-2.5">
          <table className="w-full text-xs">
            <thead>
              <tr className="text-[10px] font-medium uppercase tracking-wide text-gray-500">
                <th className="pb-1 pr-3 text-left font-medium">{sketchHeader}</th>
                {columns.map((column) => (
                  <th
                    key={column.key}
                    className="w-px pb-1 pl-3 text-right font-medium whitespace-nowrap last:pl-4"
                  >
                    {column.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.sketchId} className="border-t border-gray-200/80">
                  <td className="w-full max-w-0 py-1.5 pr-3">
                    <div className="truncate font-medium text-gray-800" title={row.sketchName}>
                      {row.sketchName}
                    </div>
                  </td>
                  {columns.map((column) => (
                    <td
                      key={column.key}
                      className="w-px py-1.5 pl-3 text-right font-semibold tabular-nums text-gray-900 whitespace-nowrap last:pl-4"
                    >
                      {row.values[column.key] ?? "—"}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
