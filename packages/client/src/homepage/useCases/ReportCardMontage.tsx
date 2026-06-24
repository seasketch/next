/* eslint-disable i18next/no-literal-string */
import React, { useEffect, useMemo, useRef, useState } from "react";
import "./ReportCardMontage.css";

const COLUMN_COUNT = 5;

const CLOUDFLARE_IMAGES = "https://imagedelivery.net/UvAJR8nUVV-h3iWaqOVMkw";

type ReportCardItem = {
  src: string;
  alt: string;
  /** height / width at render size — used to balance column stacks */
  aspectRatio: number;
};

function ReportCardFrame({ src, alt }: { src: string; alt: string }) {
  return (
    <div className="overflow-hidden rounded-lg border border-slate-200/90 bg-white shadow-sm shadow-slate-300/25 ring-1 ring-slate-200/50">
      <img src={src} alt={alt} className="block h-auto w-full" loading="lazy" />
    </div>
  );
}

const REPORT_CARDS: ReportCardItem[] = [
  {
    src: `${CLOUDFLARE_IMAGES}/465c0142-8c47-48d8-66c1-c4b3fa46bb00/public`,
    alt: "Anchoring sites report card from Blue Azores",
    aspectRatio: 1158 / 956,
  },
  {
    src: `${CLOUDFLARE_IMAGES}/75739ea5-1f92-4a72-f49e-6f200a5d7600/public`,
    alt: "Degree heating weeks histogram report card from Vanuatu",
    aspectRatio: 1114 / 956,
  },
  {
    src: `${CLOUDFLARE_IMAGES}/b9337859-9528-4fe5-c6c0-535434d8d200/public`,
    alt: "Fish density report card from Fiji",
    aspectRatio: 1018 / 956,
  },
  {
    src: `${CLOUDFLARE_IMAGES}/ef487329-c9dc-4d40-ca45-ef275f89c200/public`,
    alt: "Marxan prioritization histogram report card from Fiji",
    aspectRatio: 998 / 956,
  },
  {
    src: `${CLOUDFLARE_IMAGES}/6e9cc665-95ec-4497-2fd5-775ae740b700/public`,
    alt: "Geomorphology overlap table report card from Fiji",
    aspectRatio: 942 / 956,
  },
  {
    src: `${CLOUDFLARE_IMAGES}/17ca0019-c6d3-4f2f-a132-9ab1e4f15700/public`,
    alt: "Bathymetry report card from Blue Azores",
    aspectRatio: 936 / 956,
  },
  {
    src: `${CLOUDFLARE_IMAGES}/e1d9aece-c1de-4a3f-3972-b911f09c6e00/public`,
    alt: "Depth bathymetry histogram report card from Fiji",
    aspectRatio: 850 / 956,
  },
  {
    src: `${CLOUDFLARE_IMAGES}/65a73c87-4caf-4fcd-1ea4-2dec71ac9000/public`,
    alt: "Planning objectives report card from Samoa",
    aspectRatio: 810 / 956,
  },
  {
    src: `${CLOUDFLARE_IMAGES}/e0279279-41af-4146-8c64-912550a77c00/public`,
    alt: "Size objectives table report card from Samoa",
    aspectRatio: 690 / 956,
  },
  {
    src: `${CLOUDFLARE_IMAGES}/7a7f3a3e-3f84-4772-0f51-bbf903dd5f00/public`,
    alt: "EEZ size summary report card from Fiji",
    aspectRatio: 628 / 956,
  },
];

/**
 * Pair the tallest cards with the shortest so each column stack ends up
 * with a similar total height.
 */
function balanceCardsIntoColumns(
  cards: ReportCardItem[],
  columnCount: number
): ReportCardItem[][] {
  const sorted = [...cards].sort((a, b) => b.aspectRatio - a.aspectRatio);
  const columns: ReportCardItem[][] = Array.from(
    { length: columnCount },
    () => []
  );
  const columnHeights = new Array(columnCount).fill(0);

  for (let i = 0; i < columnCount && i < sorted.length; i++) {
    columns[i].push(sorted[i]);
    columnHeights[i] += sorted[i].aspectRatio;
  }

  for (let i = columnCount; i < sorted.length; i++) {
    const card = sorted[i];
    let shortestColumn = 0;
    for (let col = 1; col < columnCount; col++) {
      if (columnHeights[col] < columnHeights[shortestColumn]) {
        shortestColumn = col;
      }
    }
    columns[shortestColumn].push(card);
    columnHeights[shortestColumn] += card.aspectRatio;
  }

  return columns;
}

function MasonryStrip({
  stripId,
  measureRef,
  ariaHidden,
}: {
  stripId: string;
  measureRef?: React.RefObject<HTMLDivElement>;
  ariaHidden?: boolean;
}) {
  const columns = useMemo(
    () => balanceCardsIntoColumns(REPORT_CARDS, COLUMN_COUNT),
    []
  );

  return (
    <div
      ref={measureRef}
      className="shrink-0 px-2 md:px-3"
      aria-hidden={ariaHidden || undefined}
    >
      <div className="report-card-masonry">
        {columns.map((column, columnIndex) => (
          <div
            key={`${stripId}-col-${columnIndex}`}
            className="report-card-masonry-column"
          >
            {column.map((card) => (
              <div key={`${stripId}-${card.src}`}>
                <ReportCardFrame src={card.src} alt={card.alt} />
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

export default function ReportCardMontage() {
  const stripMeasureRef = useRef<HTMLDivElement>(null);
  const [stripWidth, setStripWidth] = useState(0);
  const [viewportWidth, setViewportWidth] = useState(
    typeof window !== "undefined" ? window.innerWidth : 0
  );

  useEffect(() => {
    const stripEl = stripMeasureRef.current;
    if (!stripEl) {
      return;
    }

    const measure = () => {
      setStripWidth(stripEl.offsetWidth);
      setViewportWidth(window.innerWidth);
    };

    measure();

    const resizeObserver = new ResizeObserver(measure);
    resizeObserver.observe(stripEl);
    window.addEventListener("resize", measure);

    return () => {
      resizeObserver.disconnect();
      window.removeEventListener("resize", measure);
    };
  }, []);

  const copyCount = useMemo(() => {
    if (stripWidth <= 0) {
      return 2;
    }
    // Enough copies so the viewport is always covered across one loop shift.
    return Math.max(2, Math.ceil(viewportWidth / stripWidth) + 1);
  }, [stripWidth, viewportWidth]);

  return (
    <div className="relative mt-20 md:mt-28 lg:mt-32">
      <div className="relative mx-auto max-w-3xl px-4 text-center sm:px-6">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-sky-600">
          Endless Customization
        </p>
        <h2 className="mt-3 text-balance text-2xl font-semibold tracking-tight text-slate-900 md:text-3xl lg:text-4xl">
          A growing library of metrics and visualizations
        </h2>
        <p className="mt-4 text-base leading-7 text-slate-600 md:text-lg">
          Overlap tables, depth profiles, histograms, distance from shore,
          prioritization scores. Everything you need to evaluate your spatial
          plans. All based on <i className="font-semibold">your</i> data.
        </p>
      </div>

      <div className="report-card-marquee relative mt-10 w-screen max-w-[100vw] -translate-x-1/2 left-1/2 overflow-hidden sm:mt-12 lg:mt-14">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-y-0 left-0 z-10 w-10 bg-gradient-to-r from-slate-100 via-slate-100/80 to-transparent sm:w-16 md:w-24"
        />
        <div
          aria-hidden
          className="pointer-events-none absolute inset-y-0 right-0 z-10 w-10 bg-gradient-to-l from-slate-100 via-slate-100/80 to-transparent sm:w-16 md:w-24"
        />

        <div className="overflow-hidden py-2">
          <div
            className="report-card-marquee-track flex w-max items-start"
            style={
              {
                "--marquee-duration": "110s",
                "--marquee-shift": stripWidth > 0 ? `${stripWidth}px` : "50%",
              } as React.CSSProperties
            }
          >
            {Array.from({ length: copyCount }, (_, index) => (
              <MasonryStrip
                key={`strip-${index}`}
                stripId={`strip-${index}`}
                measureRef={index === 0 ? stripMeasureRef : undefined}
                ariaHidden={index > 0}
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
