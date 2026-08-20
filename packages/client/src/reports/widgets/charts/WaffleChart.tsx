import { useLayoutEffect, useRef, useState } from "react";
import { CompositionChartDatum } from "./PieChart";

/**
 * Presentational SVG waffle chart used by ClassCompositionChart. 20×10 grid
 * (200 cells, 0.5% each) filled row-major, modeled on the legacy "Habitat
 * Composition" geoprocessing chart. Pure component — labels/formatting come
 * from the caller. Hovering a class's cells shows a floating tooltip that
 * follows the cursor.
 */

const COLS = 20;
const ROWS = 10;
const CELL = 10;
const CELL_INSET = 0.6;
const TOTAL_CELLS = COLS * ROWS;

/** Cursor offset / flip threshold for the hover tooltip, in px. */
const TOOLTIP_GAP = 12;
const TOOLTIP_FLIP_THRESHOLD = 48;

/**
 * Largest-remainder allocation of grid cells so counts always sum to the
 * number of cells representing the data's total fraction.
 */
function allocateCells(data: CompositionChartDatum[]): number[] {
  const targets = data.map((d) => Math.max(0, d.fraction) * TOTAL_CELLS);
  const counts = targets.map((v) => Math.floor(v));
  let remaining = Math.min(
    TOTAL_CELLS,
    Math.round(targets.reduce((sum, v) => sum + v, 0))
  );
  remaining -= counts.reduce((sum, v) => sum + v, 0);
  const order = targets
    .map((v, i) => ({ i, remainder: v - Math.floor(v) }))
    .sort((a, b) => b.remainder - a.remainder);
  for (let n = 0; n < order.length && remaining > 0; n++) {
    counts[order[n].i] += 1;
    remaining -= 1;
  }
  return counts;
}

function cellOrigin(index: number) {
  return {
    x: (index % COLS) * CELL,
    y: Math.floor(index / COLS) * CELL,
  };
}

function cellRect(index: number) {
  const { x, y } = cellOrigin(index);
  return {
    x: x + CELL_INSET,
    y: y + CELL_INSET,
    size: CELL - CELL_INSET * 2,
  };
}

type HoverState = {
  datum: CompositionChartDatum;
  /** Cursor position relative to the chart container, in px. */
  x: number;
  y: number;
};

export function WaffleChart({
  data,
  className,
}: {
  data: CompositionChartDatum[];
  className?: string;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const tooltipRef = useRef<HTMLDivElement>(null);
  const [hover, setHover] = useState<HoverState | null>(null);
  const [tooltipWidth, setTooltipWidth] = useState(0);

  const hoverKey = hover?.datum.key;
  // Measure before paint so the horizontal clamp below uses the real width
  // (it varies with label length) instead of a guess that lets it clip.
  useLayoutEffect(() => {
    if (hoverKey && tooltipRef.current) {
      setTooltipWidth(tooltipRef.current.offsetWidth);
    }
  }, [hoverKey]);

  const visible = data.filter((d) => d.fraction > 0);
  const counts = allocateCells(visible);
  let cursor = 0;

  const handleMouseMove =
    (datum: CompositionChartDatum) =>
    (e: React.MouseEvent<SVGGElement>) => {
      const bounds = containerRef.current?.getBoundingClientRect();
      if (!bounds) return;
      setHover({
        datum,
        x: e.clientX - bounds.left,
        y: e.clientY - bounds.top,
      });
    };

  // Keep the tooltip inside the card: flip below the cursor near the top edge
  // and clamp horizontally so it doesn't spill past the container.
  const tooltipStyle = hover
    ? (() => {
        const width = containerRef.current?.clientWidth ?? 0;
        const halfTip = tooltipWidth / 2 + 4;
        const left = Math.min(
          Math.max(hover.x, halfTip),
          Math.max(width - halfTip, halfTip)
        );
        const flipBelow = hover.y < TOOLTIP_FLIP_THRESHOLD;
        return {
          left,
          top: flipBelow ? hover.y + TOOLTIP_GAP : hover.y - TOOLTIP_GAP,
          transform: flipBelow
            ? "translate(-50%, 0)"
            : "translate(-50%, -100%)",
        };
      })()
    : undefined;

  return (
    <div ref={containerRef} className="relative">
      <svg
        viewBox={`0 0 ${COLS * CELL} ${ROWS * CELL}`}
        role="img"
        className={className ? `w-full h-auto ${className}` : "w-full h-auto"}
      >
        {/* Background cells so unfilled remainder still reads as a grid. */}
        {Array.from({ length: TOTAL_CELLS }, (_, i) => {
          const { x, y, size } = cellRect(i);
          return (
            <rect
              key={`bg-${i}`}
              x={x}
              y={y}
              width={size}
              height={size}
              rx={1}
              fill="#e5e7eb"
            />
          );
        })}
        {visible.map((d, di) => {
          const count = counts[di];
          const start = cursor;
          cursor += count;
          if (count === 0) return null;
          return (
            <g
              key={d.key}
              onMouseMove={handleMouseMove(d)}
              onMouseLeave={() => setHover(null)}
            >
              {Array.from({ length: count }, (_, i) => {
                const index = start + i;
                const origin = cellOrigin(index);
                const { x, y, size } = cellRect(index);
                return (
                  <g key={index}>
                    {/* Full cell, including the visual gutter, so panning
                        across a class does not mouseleave in the gaps. */}
                    <rect
                      x={origin.x}
                      y={origin.y}
                      width={CELL}
                      height={CELL}
                      fill="transparent"
                    />
                    <rect
                      x={x}
                      y={y}
                      width={size}
                      height={size}
                      rx={1}
                      fill={d.color}
                      pointerEvents="none"
                    />
                  </g>
                );
              })}
            </g>
          );
        })}
      </svg>
      {hover && (
        <div
          ref={tooltipRef}
          className="absolute z-10 pointer-events-none whitespace-nowrap rounded-md border border-gray-200 bg-white px-2.5 py-1.5 shadow-lg flex items-center gap-2 text-sm"
          style={tooltipStyle}
          role="tooltip"
        >
          <span
            className="inline-block flex-none w-3 h-3 rounded-sm"
            style={{ backgroundColor: hover.datum.color }}
            aria-hidden
          />
          <span className="text-gray-800">{hover.datum.label}</span>
          <span className="tabular-nums font-semibold text-gray-900">
            {hover.datum.formattedPercent}
          </span>
          {hover.datum.formattedValue && (
            <span className="tabular-nums text-gray-500 text-xs">
              {hover.datum.formattedValue}
            </span>
          )}
        </div>
      )}
    </div>
  );
}
