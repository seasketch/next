import type { ClassTableRow } from "./ClassTableRows";

/**
 * Returns true if the row has any color information to show in a swatch
 * (single color or colors array).
 */
export function classTableRowHasSwatch(row: ClassTableRow): boolean {
  return !!(row.color || (row.colors && row.colors.length > 0));
}

type SwatchForClassTableRowProps = {
  row: ClassTableRow;
};

/**
 * Renders a small color swatch for a ClassTableRow. Returns null if the row
 * has no color info. Chooses presentation automatically: single solid color
 * for `row.color`, or a grid of all stops for `row.colors`.
 */
export function SwatchForClassTableRow({ row }: SwatchForClassTableRowProps) {
  if (!classTableRowHasSwatch(row)) {
    return null;
  }

  if (row.color) {
    return (
      <div className="flex-none w-4 flex justify-center">
        <span
          className="inline-block w-4 h-4 rounded-sm overflow-hidden"
          style={{ backgroundColor: row.color }}
          aria-hidden
        />
      </div>
    );
  }

  if (row.colors && row.colors.length > 0) {
    const colors = row.colors;
    const cols = Math.ceil(Math.sqrt(colors.length));
    const rows = Math.ceil(colors.length / cols);
    const cellCount = cols * rows;
    const paddedColors =
      cellCount > colors.length
        ? [
            ...colors,
            ...Array(cellCount - colors.length).fill(colors[colors.length - 1]),
          ]
        : colors;

    return (
      <div className="flex-none w-4 flex justify-center">
        <span
          className="inline-grid w-4 h-4 rounded-sm overflow-hidden"
          style={{
            gridTemplateColumns: `repeat(${cols}, 1fr)`,
            gridTemplateRows: `repeat(${rows}, 1fr)`,
          }}
          aria-hidden
        >
          {paddedColors.map((c, i) => (
            <span
              key={i}
              className="min-w-0 min-h-0"
              style={{
                backgroundColor: typeof c === "string" ? c : String(c),
              }}
            />
          ))}
        </span>
      </div>
    );
  }

  return null;
}
