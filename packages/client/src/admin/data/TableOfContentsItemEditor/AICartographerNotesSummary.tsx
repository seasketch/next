import { ReactNode } from "react";
import { useTranslation } from "react-i18next";
import type { FullAdminSourceFragment } from "../../../generated/graphql";
import Warning from "../../../components/Warning";

export type AICartographerNotesSummaryProps = {
  /** GraphQL field: `source.aiDataAnalystNote` (singular). */
  aiDataAnalystNote?: FullAdminSourceFragment["aiDataAnalystNote"] | null;
};

function formatEnumForDisplay(value: string | undefined | null): string | null {
  if (value == null || value === "") {
    return null;
  }
  // eslint-disable-next-line i18next/no-literal-string
  return value.replace(/_/g, " ");
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
      <code
        key={`c-${key++}`}
        className="mx-0.5 rounded bg-gray-200/90 px-1 py-0.5 text-[0.85em] font-mono text-gray-900 align-baseline"
      >
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
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-1 sm:gap-2 py-2 border-b border-gray-100 last:border-0 text-sm">
      <div className="font-medium text-gray-600">{label}</div>
      <div className="sm:col-span-2 text-gray-900 break-words">{children}</div>
    </div>
  );
}

function CustomPalettePreview({ value }: { value: unknown }) {
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
  return (
    <ul className="flex flex-col gap-2">
      {entries.map(([key, color]) => (
        <li key={key} className="flex items-center gap-2 text-xs">
          <span className="font-mono truncate max-w-[12rem]" title={key}>
            {key}
          </span>
          {typeof color === "string" ? (
            <>
              <span
                className="w-5 h-5 rounded border border-gray-300 shrink-0"
                style={{ backgroundColor: color }}
              />
              <span className="font-mono text-gray-600">{color}</span>
            </>
          ) : (
            <span className="font-mono">{JSON.stringify(color)}</span>
          )}
        </li>
      ))}
    </ul>
  );
}

export default function AICartographerNotesSummary({
  aiDataAnalystNote,
}: AICartographerNotesSummaryProps) {
  const { t } = useTranslation("admin:data");
  const note = aiDataAnalystNote;
  if (!note) {
    return null;
  }

  const junk =
    note.junkColumns?.filter(
      (c): c is string => typeof c === "string" && c.length > 0
    ) ?? [];

  return (
    <section
      className="rounded-lg border border-gray-200 bg-gray-50/80 p-4"
      aria-label={t("AI Cartographer Notes")}
    >
      <h3 className="text-sm font-semibold text-gray-900 mb-1">
        {t("AI Cartographer Notes")}
      </h3>
      <p className="text-xs text-gray-500 mb-3">
        {t(
          "Automated cartography hints generated when this layer was processed."
        )}
      </p>

      <dl className="border-t border-gray-200 pt-1">
        <NoteRow label={t("Suggested title")}>{note.bestLayerTitle}</NoteRow>
        <NoteRow label={t("Attribution")}>{note.attribution}</NoteRow>
        <NoteRow label={t("Presentation type")}>
          {formatEnumForDisplay(note.chosenPresentationType ?? undefined)}
        </NoteRow>
        <NoteRow label={t("Presentation column")}>
          {note.chosenPresentationColumn}
        </NoteRow>
        <NoteRow label={t("Palette")}>{note.palette}</NoteRow>
        <NoteRow label={t("Custom palette")}>
          <CustomPalettePreview value={note.customPalette} />
        </NoteRow>
        <NoteRow label={t("Show labels")}>
          {note.showLabels ? t("Yes") : t("No")}
        </NoteRow>
        <NoteRow label={t("Labels min zoom")}>
          {note.labelsMinZoom != null ? String(note.labelsMinZoom) : null}
        </NoteRow>
        <NoteRow label={t("Value steps")}>
          {formatEnumForDisplay(note.valueSteps ?? undefined)}
        </NoteRow>
        <NoteRow label={t("Value steps (n)")}>
          {note.valueStepsN != null ? String(note.valueStepsN) : null}
        </NoteRow>
        {/* <NoteRow label={t("Label column")}>{note.bestLabelColumn}</NoteRow>
        <NoteRow label={t("Category column")}>{note.bestCategoryColumn}</NoteRow>
        <NoteRow label={t("Numeric column")}>{note.bestNumericColumn}</NoteRow>
        <NoteRow label={t("Date column")}>{note.bestDateColumn}</NoteRow>
        <NoteRow label={t("Popup description column")}>
          {note.bestPopupDescriptionColumn}
        </NoteRow>
        <NoteRow label={t("ID column")}>{note.bestIdColumn}</NoteRow>
        <NoteRow label={t("Group by column")}>{note.bestGroupByColumn}</NoteRow>
        {junk.length > 0 && (
          <NoteRow label={t("Junk columns")}>
            <ul className="flex flex-wrap gap-1">
              {junk.map((col) => (
                <li
                  key={col}
                  className="px-1.5 py-0.5 rounded bg-gray-200 text-xs font-mono"
                >
                  {col}
                </li>
              ))}
            </ul>
          </NoteRow>
        )} */}
        <NoteRow label={t("Interactivity")}>
          {formatEnumForDisplay(note.interactivityType)}
        </NoteRow>

        <NoteRow label={t("Notes")}>
          {note.notes ? <NotesWithBacktickCode text={note.notes} /> : null}
        </NoteRow>
      </dl>

      {note.errors ? (
        <Warning level="warning" className="mt-3">
          <p className="text-sm font-medium">{t("AI processing warnings")}</p>
          <pre className="mt-1 text-xs whitespace-pre-wrap break-words">
            {note.errors}
          </pre>
        </Warning>
      ) : null}
    </section>
  );
}
