import { SparklesIcon, SwitchHorizontalIcon } from "@heroicons/react/outline";
import { QuestionMarkCircledIcon } from "@radix-ui/react-icons";
import * as Tooltip from "@radix-ui/react-tooltip";
import * as d3Chromatic from "d3-scale-chromatic";
import { ReactNode, useMemo, useState } from "react";
import { TFunction, Trans, useTranslation } from "react-i18next";
import {
  FullAdminSourceFragment,
  InteractivityType as GqlInteractivityType,
  VisualizationType as GqlVisualizationType,
} from "../../../generated/graphql";
import JsonPreview from "../../../components/JsonPreview";
import Modal from "../../../components/Modal";
import Warning from "../../../components/Warning";
import {
  VisualizationType as GuiVisualizationType,
  colorScales,
} from "../styleEditor/visualizationTypes";
import { GeostatsAttribute, GeostatsLayer } from "@seasketch/geostats-types";
import {
  piiRiskBadgeClass,
  piiRiskCategoryLabel,
  piiRiskDetected,
} from "../piiGeostatsDisplay";

export type AICartographerNotesSummaryProps = {
  /** GraphQL field: `source.aiDataAnalystNote` (singular). */
  aiDataAnalystNote?: FullAdminSourceFragment["aiDataAnalystNote"] | null;
  originalFilename?: string;
  /**
   * Vector geostats from the data source (a single {@link GeostatsLayer} or
   * `{ layers: GeostatsLayer[] }` as stored on `DataSource.geostats`).
   */
  geostats?: unknown;
};

/** Same pill styling as backtick attributes in {@link NotesWithBacktickCode}. */
const ATTRIBUTE_CODE_PILL =
  "rounded bg-gray-200/90 px-1 py-0.5 text-[0.85em] font-mono text-gray-900 align-baseline";

const PRESENTATION_TYPES_WITHOUT_COLUMN = new Set<string>([
  "SIMPLE_POLYGON",
  "SIMPLE_POINT",
  "SIMPLE_LINE",
  "RGB_RASTER",
  "MARKER_IMAGE",
]);

function resolveVectorGeostatsLayer(raw: unknown): GeostatsLayer | undefined {
  if (raw == null || typeof raw !== "object") {
    return undefined;
  }
  const r = raw as { layers?: GeostatsLayer[] } & Partial<GeostatsLayer>;
  if (Array.isArray(r.layers) && r.layers.length > 0) {
    return r.layers[0];
  }
  if (Array.isArray(r.attributes)) {
    return raw as GeostatsLayer;
  }
  return undefined;
}

function shouldAppendPresentationColumn(
  presentationType: GqlVisualizationType | string | undefined | null,
  column: string | null | undefined
): boolean {
  const c = column?.trim();
  if (!c) {
    return false;
  }
  const t = presentationType as string | undefined;
  if (!t) {
    return false;
  }
  return !PRESENTATION_TYPES_WITHOUT_COLUMN.has(t);
}

function hasUsableCustomPalette(value: unknown): boolean {
  if (value == null) {
    return false;
  }
  if (Array.isArray(value)) {
    return value.length > 0;
  }
  if (typeof value === "object") {
    return Object.keys(value as Record<string, unknown>).length > 0;
  }
  return false;
}

/** Resolve palette name to d3-scale-chromatic (same matching as gl-style-builder getColorScale). */
type ResolvedNamedPalette =
  | {
      kind: "continuous";
      interpolate: (t: number) => string;
      resolvedName: string;
    }
  | { kind: "categorical"; colors: readonly string[]; resolvedName: string };

function resolveNamedPaletteForPreview(
  rawName: string | null | undefined
): ResolvedNamedPalette | null {
  const name = rawName?.trim();
  if (!name) {
    return null;
  }
  const continuousCandidates = [
    ...colorScales.continuous.sequential,
    ...colorScales.continuous.diverging,
    ...colorScales.continuous.cyclical,
  ];
  const contMatch = continuousCandidates.find((candidate) =>
    candidate.toLowerCase().includes(name.toLowerCase())
  );
  if (contMatch && contMatch in d3Chromatic) {
    const scale = d3Chromatic[contMatch as keyof typeof d3Chromatic];
    if (typeof scale === "function") {
      return {
        kind: "continuous",
        interpolate: scale as (t: number) => string,
        resolvedName: contMatch,
      };
    }
  }
  const catMatch = colorScales.categorical.find((candidate) =>
    candidate.toLowerCase().includes(name.toLowerCase())
  );
  if (catMatch && catMatch in d3Chromatic) {
    const scale = d3Chromatic[catMatch as keyof typeof d3Chromatic];
    if (
      Array.isArray(scale) &&
      scale.length > 0 &&
      typeof scale[0] === "string"
    ) {
      return {
        kind: "categorical",
        colors: scale as readonly string[],
        resolvedName: catMatch,
      };
    }
  }
  if (name in d3Chromatic) {
    const scale = d3Chromatic[name as keyof typeof d3Chromatic];
    if (typeof scale === "function") {
      return {
        kind: "continuous",
        interpolate: scale as (t: number) => string,
        resolvedName: name,
      };
    }
    if (
      Array.isArray(scale) &&
      scale.length > 0 &&
      typeof scale[0] === "string"
    ) {
      return {
        kind: "categorical",
        colors: scale as readonly string[],
        resolvedName: name,
      };
    }
  }
  return null;
}

function formatEnumForDisplay(value: string | undefined | null): string | null {
  if (value == null || value === "") {
    return null;
  }
  // eslint-disable-next-line i18next/no-literal-string
  return value.replace(/_/g, " ");
}

/** Map `chosenPresentationType` API values to the same labels as the graphical style editor. */
function presentationTypeLabel(
  gqlValue: GqlVisualizationType | string | undefined | null,
  t: TFunction<"admin:data">
): string | null {
  if (gqlValue == null || gqlValue === "") {
    return null;
  }
  const key = gqlValue as string;
  const labels: Record<string, string> = {
    SIMPLE_POLYGON: GuiVisualizationType.SIMPLE_POLYGON,
    CATEGORICAL_POLYGON: GuiVisualizationType.CATEGORICAL_POLYGON,
    CONTINUOUS_POLYGON: GuiVisualizationType.CONTINUOUS_POLYGON,
    SIMPLE_POINT: GuiVisualizationType.SIMPLE_POINT,
    MARKER_IMAGE: GuiVisualizationType.MARKER_IMAGE,
    CATEGORICAL_POINT: GuiVisualizationType.CATEGORICAL_POINT,
    PROPORTIONAL_SYMBOL: GuiVisualizationType.PROPORTIONAL_SYMBOL,
    CONTINUOUS_POINT: GuiVisualizationType.CONTINUOUS_POINT,
    HEATMAP: GuiVisualizationType.HEATMAP,
    RGB_RASTER: GuiVisualizationType.RGB_RASTER,
    CATEGORICAL_RASTER: GuiVisualizationType.CATEGORICAL_RASTER,
    CONTINUOUS_RASTER: GuiVisualizationType.CONTINUOUS_RASTER,
    SIMPLE_LINE: t("Simple Line"),
    CATEGORICAL_LINE: t("Categories"),
    CONTINUOUS_LINE: t("Color Range"),
  };
  return labels[key] ?? formatEnumForDisplay(key);
}

/** Labels aligned with `InteractivitySettings.tsx` (layer interactivity radio options). */
function interactivityTypeLabel(
  gqlValue: GqlInteractivityType | string | undefined | null,
  t: TFunction<"admin:data">
): string | null {
  if (gqlValue == null || gqlValue === "") {
    return null;
  }
  const key = gqlValue as string;
  switch (key) {
    case "NONE":
      return t("None", { ns: "admin" });
    case "BANNER":
      return t("Banner", { ns: "admin" });
    case "TOOLTIP":
      return t("Tooltip", { ns: "admin" });
    case "POPUP":
      return t("Custom Popup");
    case "ALL_PROPERTIES_POPUP":
      return t("Popup with all columns");
    case "SIDEBAR_OVERLAY":
      return t("Sidebar");
    case "FIXED_BLOCK":
      return t("Fixed Block");
    default:
      return formatEnumForDisplay(key);
  }
}

/** Renders `backtick-wrapped` spans as inline <code>. Unpaired trailing ` is shown as plain text. */
function NotesWithBacktickCode({ text }: { text: string }) {
  const nodes: ReactNode[] = [];
  let i = 0;
  let key = 0;
  while (i < text.length) {
    const open = text.indexOf("`", i);
    if (open === -1) {
      if (i < text.length) {
        nodes.push(<span key={`t-${key++}`}>{text.slice(i)}</span>);
      }
      break;
    }
    if (open > i) {
      nodes.push(<span key={`t-${key++}`}>{text.slice(i, open)}</span>);
    }
    const close = text.indexOf("`", open + 1);
    if (close === -1) {
      nodes.push(<span key={`t-${key++}`}>{text.slice(open)}</span>);
      break;
    }
    nodes.push(
      <code key={`c-${key++}`} className={`mx-0.5 ${ATTRIBUTE_CODE_PILL}`}>
        {text.slice(open + 1, close)}
      </code>
    );
    i = close + 1;
  }
  return <p className="whitespace-pre-wrap text-gray-800">{nodes}</p>;
}

function NoteRow({ label, children }: { label: string; children: ReactNode }) {
  if (children === null || children === undefined || children === "") {
    return null;
  }
  return (
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-1 sm:gap-2 py-2  text-sm">
      <div className="font-medium text-gray-600">{label}</div>
      <div className="sm:col-span-2 text-gray-900 break-words">{children}</div>
    </div>
  );
}

/**
 * Compact redacted-column chip for this tooltip only: column name + category
 * labels, with the same color treatment as {@link GeostatsModal} PII pills.
 */
function RedactedColumnTooltipPill({
  name,
  attribute,
  t,
}: {
  name: string;
  attribute?: GeostatsAttribute;
  t: TFunction<"admin:data">;
}) {
  const categoriesText =
    attribute?.piiRiskCategories && attribute.piiRiskCategories.length > 0
      ? attribute.piiRiskCategories
          .map((c) => piiRiskCategoryLabel(c, t))
          .join(", ")
      : null;
  const dot = String.fromCharCode(0x00b7);
  const tone =
    attribute && piiRiskDetected(attribute.piiRisk)
      ? piiRiskBadgeClass(attribute.piiRisk)
      : "box-border border border-slate-200/80 bg-slate-100 text-slate-700";

  return (
    <span
      className={`inline-flex max-w-[min(100%,14rem)] items-baseline gap-x-1 rounded-full px-2.5 py-0.5 text-xs font-medium leading-5 ${tone}`}
    >
      <span className="min-w-0 break-all font-mono">{name}</span>
      {categoriesText ? (
        <>
          <span className="shrink-0 opacity-70" aria-hidden>
            {dot}
          </span>
          <span className="shrink-0">{categoriesText}</span>
        </>
      ) : null}
    </span>
  );
}

function PiiRedactedColumnsTooltipButton({
  t,
  columns,
}: {
  t: TFunction<"admin:data">;
  columns: { name: string; attribute?: GeostatsAttribute }[];
}) {
  return (
    <Tooltip.Root delayDuration={10}>
      <Tooltip.Trigger asChild>
        <button
          type="button"
          className="-m-0.5 inline-flex shrink-0 rounded p-0.5 text-current opacity-75 transition-opacity hover:opacity-100 focus:outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-primary-400"
          aria-label={t("About redacted columns for AI")}
        >
          <QuestionMarkCircledIcon className="h-4 w-4" aria-hidden />
        </button>
      </Tooltip.Trigger>
      <Tooltip.Portal>
        <Tooltip.Content
          side="right"
          className="TooltipContent z-[60] max-w-md"
          sideOffset={6}
        >
          <div className="space-y-3 text-sm">
            <p>
              <Trans ns="admin:data">
                Columns suspected to contain personally identifiable information
                (PII) are redacted before being sent to AI services. Column
                names and data types are shared, not sample values.
              </Trans>
            </p>
            <div className="flex flex-wrap gap-1.5 border-t border-slate-200/80 pt-3">
              {columns.map(({ name, attribute }) => (
                <RedactedColumnTooltipPill
                  key={name}
                  name={name}
                  attribute={attribute}
                  t={t}
                />
              ))}
            </div>
          </div>
          <Tooltip.Arrow className="TooltipArrow" />
        </Tooltip.Content>
      </Tooltip.Portal>
    </Tooltip.Root>
  );
}

function PaletteReversedIndicator({ t }: { t: TFunction<"admin:data"> }) {
  return (
    <Tooltip.Root delayDuration={10}>
      <Tooltip.Trigger asChild>
        <span className="inline-flex shrink-0 text-slate-500" tabIndex={0}>
          <SwitchHorizontalIcon
            className="h-3 w-3"
            aria-label={t("Color palette order reversed")}
          />
        </span>
      </Tooltip.Trigger>
      <Tooltip.Portal>
        <Tooltip.Content
          side="right"
          className="TooltipContent z-[60] max-w-xs"
          sideOffset={6}
        >
          <p className="text-sm">{t("Palette colors are reversed.")}</p>
          <Tooltip.Arrow className="TooltipArrow" />
        </Tooltip.Content>
      </Tooltip.Portal>
    </Tooltip.Root>
  );
}

function NamedPalettePreview({
  paletteName,
  reverse,
}: {
  paletteName: string;
  reverse?: boolean | null;
}) {
  const { t } = useTranslation("admin:data");
  const isReversed = Boolean(reverse);
  const preview = useMemo(() => {
    const resolved = resolveNamedPaletteForPreview(paletteName);
    if (!resolved) {
      return { kind: "text" as const };
    }
    if (resolved.kind === "continuous") {
      const n = 32;
      const rev = Boolean(reverse);
      const parts: string[] = [];
      for (let i = 0; i < n; i++) {
        const p = i / (n - 1);
        const f = rev ? 1 - p : p;
        parts.push(`${resolved.interpolate(f)} ${(p * 100).toFixed(2)}%`);
      }
      return {
        kind: "continuous" as const,
        // eslint-disable-next-line i18next/no-literal-string -- CSS linear-gradient syntax
        background: `linear-gradient(to right, ${parts.join(", ")})`,
        resolvedName: resolved.resolvedName,
      };
    }
    const colors = reverse
      ? [...resolved.colors].reverse()
      : [...resolved.colors];
    return {
      kind: "categorical" as const,
      colors,
      resolvedName: resolved.resolvedName,
    };
  }, [paletteName, reverse]);

  if (preview.kind === "text") {
    return (
      <div className="flex flex-wrap items-center gap-x-1.5 gap-y-0.5">
        <span className="font-mono text-[13px] text-slate-700">
          {paletteName}
        </span>
        {isReversed ? <PaletteReversedIndicator t={t} /> : null}
      </div>
    );
  }
  if (preview.kind === "continuous") {
    return (
      <div className="w-fit max-w-full space-y-1">
        <div
          className="h-3.5 w-80 max-w-full rounded-sm border border-slate-300/90 shadow-[inset_0_1px_2px_rgba(15,23,42,0.06)]"
          style={{ background: preview.background }}
          title={preview.resolvedName}
        />
        <div className="flex flex-wrap items-center gap-x-1.5">
          <span className="font-mono text-[11px] text-slate-500">
            {preview.resolvedName}
          </span>
          {isReversed ? <PaletteReversedIndicator t={t} /> : null}
        </div>
      </div>
    );
  }
  return (
    <div className="w-fit max-w-full space-y-1">
      <div
        className="inline-flex max-w-[min(20rem,100%)] flex-wrap gap-px rounded-sm border border-slate-300/90 p-px shadow-[inset_0_1px_2px_rgba(15,23,42,0.04)]"
        title={preview.resolvedName}
      >
        {preview.colors.map((c, i) => (
          <span
            key={i}
            className="h-3.5 w-3.5 shrink-0 border border-slate-900/10"
            style={{ backgroundColor: c }}
          />
        ))}
      </div>
      <div className="flex flex-wrap items-center gap-x-1.5">
        <span className="font-mono text-[11px] text-slate-500">
          {preview.resolvedName}
        </span>
        {isReversed ? <PaletteReversedIndicator t={t} /> : null}
      </div>
    </div>
  );
}

function PaletteRowContent({
  note,
}: {
  note: NonNullable<FullAdminSourceFragment["aiDataAnalystNote"]>;
}) {
  if (hasUsableCustomPalette(note.customPalette)) {
    return <CustomPalettePreview value={note.customPalette} />;
  }
  const named = note.palette?.trim();
  if (named) {
    return (
      <NamedPalettePreview paletteName={named} reverse={note.reversePalette} />
    );
  }
  return null;
}

function CustomPalettePreview({ value }: { value: unknown }) {
  const { t } = useTranslation("admin:data");
  if (value === null || value === undefined) {
    return null;
  }
  if (typeof value !== "object" || Array.isArray(value)) {
    return (
      <pre className="text-xs font-mono whitespace-pre-wrap break-all">
        {JSON.stringify(value, null, 2)}
      </pre>
    );
  }
  const entries = Object.entries(value as Record<string, unknown>);
  if (entries.length === 0) {
    return null;
  }
  const showKeys = entries.length > 1;
  /** Map legend–style square: slight radius, thin edge. */
  const swatchBox =
    "h-3.5 w-3.5 shrink-0 rounded-[3px] border border-slate-900/25 shadow-[inset_0_0_0_1px_rgba(255,255,255,0.2)]";
  const pill =
    "inline-flex max-w-full items-center gap-1.5 rounded-md border border-slate-200 bg-white py-0.5 pl-1 pr-2.5 shadow-[0_1px_2px_rgba(15,23,42,0.06)]";
  return (
    <ul className="m-0 flex list-none flex-wrap items-center gap-1.5 p-0">
      {entries.map(([key, color]) => {
        const isHex = typeof color === "string";
        const hex = isHex ? color : null;
        const labelText = showKeys ? key : t("Default");
        return (
          <li key={key} className="inline-flex">
            {isHex ? (
              <div className={pill} title={hex ?? undefined}>
                <span
                  className={swatchBox}
                  style={{ backgroundColor: hex! }}
                  aria-hidden
                />
                <span className="min-w-0 max-w-[12rem] truncate pr-0.5 text-[11px] font-semibold leading-none tracking-tight text-slate-800">
                  {labelText}
                </span>
              </div>
            ) : (
              <div className={`${pill} px-2 py-1`}>
                <span className="flex max-w-[16rem] flex-wrap items-baseline gap-x-1.5 gap-y-0.5 font-mono text-[11px] leading-snug text-slate-600">
                  <span className="shrink-0 font-sans font-semibold text-slate-800">
                    {labelText}
                  </span>
                  <span className="min-w-0 break-all">
                    {JSON.stringify(color)}
                  </span>
                </span>
              </div>
            )}
          </li>
        );
      })}
    </ul>
  );
}

export default function AICartographerNotesSummary({
  aiDataAnalystNote,
  originalFilename,
  geostats,
}: AICartographerNotesSummaryProps) {
  const { t } = useTranslation("admin:data");
  const note = aiDataAnalystNote;

  const geostatsLayer = useMemo(
    () => resolveVectorGeostatsLayer(geostats),
    [geostats]
  );

  /** Names persisted from the AI pipeline when value histograms were withheld from the LLM. */
  const piiRedactedColumnNames = useMemo(() => {
    return (
      note?.piiRedactedColumns
        ?.map((c) => c?.trim())
        .filter((c): c is string => Boolean(c)) ?? []
    );
  }, [note?.piiRedactedColumns]);

  const redactedPiiTooltipColumns = useMemo(() => {
    return piiRedactedColumnNames.map((name) => ({
      name,
      attribute: geostatsLayer?.attributes?.find((a) => a.attribute === name),
    }));
  }, [piiRedactedColumnNames, geostatsLayer]);

  const noteJsonPayload = useMemo(() => {
    if (!aiDataAnalystNote) {
      return null;
    }
    const plain: Record<string, unknown> = {
      ...(aiDataAnalystNote as Record<string, unknown>),
    };
    delete plain.__typename;
    return plain;
  }, [aiDataAnalystNote]);

  const [showRawNoteJsonModal, setShowRawNoteJsonModal] = useState(false);

  if (!note) {
    return null;
  }

  return (
    <Tooltip.Provider delayDuration={200}>
      <section
        className="relative overflow-hidden rounded-lg border border-gray-200 bg-[radial-gradient(ellipse_90%_65%_at_100%_-5%,rgba(99,102,241,0.058),transparent_55%),radial-gradient(ellipse_80%_55%_at_-8%_102%,rgba(167,139,250,0.045),transparent_52%),linear-gradient(155deg,rgb(255_255_255)_0%,rgb(249_250_255)_40%,rgb(254_254_254)_100%)] p-4 shadow-sm"
        aria-label={t("AI Cartographer Notes")}
      >
        <Tooltip.Root delayDuration={10}>
          <Tooltip.Trigger asChild>
            <button
              type="button"
              className="absolute top-4 right-4 z-10 -m-0.5 inline-flex shrink-0 rounded p-0.5 text-gray-500 transition-colors hover:text-gray-800 focus:outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-primary-400"
              aria-label={t("About AI Cartographer Notes")}
            >
              <QuestionMarkCircledIcon className="h-4 w-4" aria-hidden />
            </button>
          </Tooltip.Trigger>
          <Tooltip.Portal>
            <Tooltip.Content
              side="right"
              className="TooltipContent z-[60] max-w-md"
              sideOffset={6}
            >
              <div className="space-y-2 text-sm">
                <span className=" bg-yellow-300/70 px-2 rounded text-sm py-1 my-1 inline-block">
                  {t("New!")}
                </span>
                <p>
                  {t(
                    "After you upload spatial data, the AI Cartographer inspects your layer (for example attributes, geometry, or raster bands) and the filename."
                  )}
                </p>
                <p>
                  {t(
                    "It suggests a readable map title, attribution if clear from the metadata, and cartographic recommendations such as presentation type, palette, labels, and interactivity."
                  )}
                </p>
                <p>
                  <Trans ns="admin:data">
                    Read{" "}
                    <a
                      href="https://docs.seasketch.org/seasketch-documentation/administrators-guide/overlay-layers/ai-cartographer"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-primary-500 underline"
                    >
                      the documentation
                    </a>{" "}
                    for more information.
                  </Trans>
                </p>
                {noteJsonPayload ? (
                  <div className="border-t border-slate-200/80 pt-2">
                    <button
                      type="button"
                      className="text-left text-sm font-medium text-primary-600 hover:text-primary-800 hover:underline focus:outline-none focus-visible:rounded focus-visible:ring-2 focus-visible:ring-primary-400 focus-visible:ring-offset-1"
                      onClick={() => setShowRawNoteJsonModal(true)}
                    >
                      {t("View full output data")}
                    </button>
                  </div>
                ) : null}
              </div>
              <Tooltip.Arrow className="TooltipArrow" />
            </Tooltip.Content>
          </Tooltip.Portal>
        </Tooltip.Root>
        <h3 className="mb-1 flex flex-wrap items-center gap-x-1.5 gap-y-1 pr-9 text-base text-gray-900">
          <SparklesIcon
            className="h-5 w-5 shrink-0 text-indigo-900"
            aria-hidden
          />
          {t("AI Cartographer Notes")}
        </h3>
        {originalFilename && note.bestLayerTitle && (
          <p className="mt-2 text-sm text-gray-700">
            <span className="line-through">{originalFilename}</span>{" "}
            <span aria-hidden>{String.fromCharCode(0x2192)}</span>{" "}
            <span className="font-medium">{note.bestLayerTitle}</span>
          </p>
        )}
        <div className="py-2 text-sm text-gray-700">
          {note.notes ? <NotesWithBacktickCode text={note.notes} /> : null}
        </div>

        <dl className="">
          <NoteRow label={t("Attribution")}>{note.attribution}</NoteRow>
          <NoteRow label={t("Map Style")}>
            <span className="inline-flex flex-wrap items-center gap-x-1.5 gap-y-1">
              <span>
                {presentationTypeLabel(
                  note.chosenPresentationType ?? undefined,
                  t
                )}
              </span>
              {shouldAppendPresentationColumn(
                note.chosenPresentationType ?? undefined,
                note.chosenPresentationColumn ?? undefined
              ) ? (
                <code className={`${ATTRIBUTE_CODE_PILL} mx-0`}>
                  {note.chosenPresentationColumn!.trim()}
                </code>
              ) : null}
            </span>
          </NoteRow>
          <NoteRow label={t("Color Palette")}>
            <PaletteRowContent note={note} />
          </NoteRow>
          <NoteRow label={t("Show labels")}>
            {note.showLabels ? t("Yes") : t("No")}
          </NoteRow>
          {/* <NoteRow label={t("Labels min zoom")}>
            {note.labelsMinZoom != null ? String(note.labelsMinZoom) : null}
          </NoteRow> */}
          {/* <NoteRow label={t("Value steps")}>
            {formatEnumForDisplay(note.valueSteps ?? undefined)}
          </NoteRow>
          <NoteRow label={t("Value steps (n)")}>
            {note.valueStepsN != null ? String(note.valueStepsN) : null}
          </NoteRow> */}

          <NoteRow label={t("Interactivity")}>
            {interactivityTypeLabel(note.interactivityType, t)}
          </NoteRow>
          {piiRedactedColumnNames.length > 0 ? (
            <NoteRow label={t("Redacted columns")}>
              <div className="inline-flex flex-wrap items-center gap-x-1.5 gap-y-0.5 text-gray-900">
                <span>
                  {t("{{count}} columns with PII", {
                    count: piiRedactedColumnNames.length,
                  })}
                </span>
                <PiiRedactedColumnsTooltipButton
                  t={t}
                  columns={redactedPiiTooltipColumns}
                />
              </div>
            </NoteRow>
          ) : null}
          {/* <NoteRow label={t("Group by column")}>{note.bestGroupByColumn}</NoteRow> */}
        </dl>

        {note.errors ? (
          <Warning level="warning" className="mt-3">
            <p className="text-sm font-medium">{t("AI processing warnings")}</p>
            <pre className="mt-1 text-xs whitespace-pre-wrap break-words">
              {note.errors}
            </pre>
          </Warning>
        ) : null}

        {showRawNoteJsonModal && noteJsonPayload ? (
          <Modal
            open={true}
            scrollable={true}
            title={t("AI Cartographer JSON Output")}
            onRequestClose={() => setShowRawNoteJsonModal(false)}
            panelClassName="max-w-3xl w-[min(100%,calc(100vw-2rem))]"
            footer={[
              {
                label: t("Close"),
                variant: "secondary",
                onClick: () => setShowRawNoteJsonModal(false),
              },
            ]}
          >
            <JsonPreview
              value={noteJsonPayload}
              className="max-h-[min(70vh,36rem)] min-h-[12rem]"
            />
          </Modal>
        ) : null}
      </section>
    </Tooltip.Provider>
  );
}
