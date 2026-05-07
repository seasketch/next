import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import { DotsHorizontalIcon } from "@radix-ui/react-icons";
import { useCallback, useContext } from "react";
import { useTranslation } from "react-i18next";
import { collectReportCardTitle } from "../../admin/sketchClasses/SketchClassReportsAdmin";
import { BaseReportContext } from "../context/BaseReportContext";
import { ReportDependenciesContext } from "../context/ReportDependenciesContext";
import { useSubjectReportContext } from "../context/SubjectReportContext";
import {
  collectCardExportSections,
  packageSectionsAsCsvBlob,
} from "../widgets/exports";
import { download } from "../../download";

function slugifyFilenamePart(value: string): string {
  return String(value || "")
    .trim()
    .replace(/[^a-zA-Z0-9_-]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 60);
}

/**
 * Print + results export parity with sketch report popup; safe under
 * SubjectReportContext + ReportDependenciesContext + BaseReportContext.
 */
export function useReportWindowExports(): {
  reportDataReady: boolean;
  exportReport: (format: "csv" | "json") => Promise<void>;
} {
  const { t } = useTranslation("admin:sketching");
  const base = useContext(BaseReportContext);
  const subject = useSubjectReportContext();
  const deps = useContext(ReportDependenciesContext);

  const reportDataReady =
    !!base.data &&
    !!subject.data &&
    !deps.loading &&
    !deps.dependenciesAwaitingRefresh;

  const exportReport = useCallback(
    async (format: "csv" | "json") => {
      if (!base.data || !subject.data) {
        return;
      }
      const sketchClassForExport = subject.data.sketch.sketchClass;
      if (!sketchClassForExport) {
        return;
      }

      const metricById = new Map(deps.metrics.map((m) => [m.id, m]));
      const sourceByStableId = new Map(
        deps.overlaySources
          .filter((s) => !!s.stableId)
          .map((s) => [s.stableId as string, s])
      );

      const sections: ReturnType<typeof collectCardExportSections> = [];
      const cards: Array<{
        tabId: number;
        tabTitle: string;
        cardId: number;
        cardTitle: string;
        sections: ReturnType<typeof collectCardExportSections>;
      }> = [];

      const sortedTabs = [...(base.data.report.tabs || [])].sort(
        (a, b) => a.position - b.position
      );

      for (const tab of sortedTabs) {
        const sortedCards = [...(tab.cards || [])].sort(
          (a, b) => a.position - b.position
        );
        for (const card of sortedCards) {
          const list = deps.cardDependencyLists.find(
            (l) => l.cardId === card.id
          );
          const cardMetrics = (list?.metrics || [])
            .map((metricId) => metricById.get(metricId))
            .filter((m): m is NonNullable<typeof m> => m != null);
          const cardSources = (list?.overlaySources || [])
            .map((stableId) => sourceByStableId.get(stableId))
            .filter((s): s is NonNullable<typeof s> => s != null);
          const cardTitle =
            collectReportCardTitle(card.body) || `${t("Card")} ${card.id}`;
          const cardSections = collectCardExportSections({
            reportId: base.data.report.id,
            cardId: card.id,
            cardTitle,
            body: card.body as any,
            metrics: cardMetrics,
            sources: cardSources,
            geographies: base.data.geographies,
            sketchClass: sketchClassForExport,
            subject: {
              sketchId: subject.data.sketch.id,
              sketchName: subject.data.sketch.name,
              isCollection: subject.data.isCollection,
              childSketches: (subject.data.childSketches || []).map((c) => ({
                id: c.id,
                name: c.name,
              })),
            },
            relatedFragments: (subject.data.relatedFragments || []).map(
              (f) => ({
                hash: f.hash,
                geographies: f.geographies,
                sketches: f.sketches,
              })
            ),
            primaryGeographyId: undefined,
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            t: ((k: string) => k) as any,
          });

          sections.push(
            ...cardSections.map((section, index) => ({
              ...section,
              /* eslint-disable i18next/no-literal-string */
              id:
                `${slugifyFilenamePart(cardTitle) || "card"}-` +
                `${slugifyFilenamePart(section.title) || "section"}-` +
                `t${tab.id}-c${card.id}-s${index + 1}`,
              /* eslint-enable i18next/no-literal-string */
              // eslint-disable-next-line i18next/no-literal-string
              title:
                `${cardTitle} / ${section.title}` +
                ` (${t("Tab")} ${tab.id}, ${t("Card")} ${card.id}, ${t(
                  "Section"
                )} ${index + 1})`,
            }))
          );
          cards.push({
            tabId: tab.id,
            tabTitle: tab.title,
            cardId: card.id,
            cardTitle,
            sections: cardSections,
          });
        }
      }

      const filenameBase =
        // eslint-disable-next-line i18next/no-literal-string
        `${subject.data.sketch.id}-` +
        `${
          slugifyFilenamePart(subject.data.sketch.name) ||
          subject.data.sketch.id
        }` +
        // eslint-disable-next-line i18next/no-literal-string
        `-report-${base.data.report.id}`;

      if (format === "json") {
        const body = {
          schemaVersion: 1,
          exportedAt: new Date().toISOString(),
          format: "seasketch-report-export",
          meta: {
            reportId: base.data.report.id,
            subjectSketchId: subject.data.sketch.id,
            subjectSketchName: subject.data.sketch.name,
            isCollection: subject.data.isCollection,
          },
          cards,
        };
        const blob = new Blob([JSON.stringify(body, null, 2)], {
          // eslint-disable-next-line i18next/no-literal-string
          type: "application/json",
        });
        const url = URL.createObjectURL(blob);
        // eslint-disable-next-line i18next/no-literal-string
        download(url, `${filenameBase}.json`);
        URL.revokeObjectURL(url);
        return;
      }

      const { blob } = await packageSectionsAsCsvBlob(sections);
      const url = URL.createObjectURL(blob);
      // eslint-disable-next-line i18next/no-literal-string
      download(url, `${filenameBase}.zip`);
      URL.revokeObjectURL(url);
    },
    [
      base.data,
      subject.data,
      deps.metrics,
      deps.overlaySources,
      deps.cardDependencyLists,
      t,
    ]
  );

  return { reportDataReady, exportReport };
}

/** Matches sketch report popup "…" actions (print + export). */
export function ReportWindowActionsMenu({
  onPrint,
}: {
  onPrint: () => void;
}) {
  const { t } = useTranslation("admin:sketching");
  const { reportDataReady, exportReport } = useReportWindowExports();

  return (
    <DropdownMenu.Root>
      <DropdownMenu.Trigger asChild>
        <button
          type="button"
          className="flex-shrink-0 p-1.5 rounded-full text-gray-500 hover:text-gray-700 hover:bg-black/5"
          aria-label={t("Report actions")}
          title={t("Report actions")}
        >
          <DotsHorizontalIcon className="w-4 h-4" />
        </button>
      </DropdownMenu.Trigger>
      <DropdownMenu.Portal>
        <DropdownMenu.Content
          side="bottom"
          align="end"
          sideOffset={8}
          className="z-50 min-w-[180px] rounded-md border border-black/5 bg-white p-1 shadow-lg"
        >
          <DropdownMenu.Item
            className="flex cursor-pointer select-none items-center rounded px-2 py-1.5 text-sm outline-none text-gray-700 data-[highlighted]:bg-gray-100"
            onSelect={() => onPrint()}
          >
            {t("Print report")}
          </DropdownMenu.Item>
          <DropdownMenu.Separator className="my-1 h-px bg-black/10" />
          <DropdownMenu.Item
            disabled={!reportDataReady}
            className="flex cursor-pointer select-none items-center rounded px-2 py-1.5 text-sm outline-none text-gray-700 data-[highlighted]:bg-gray-100 data-[disabled]:opacity-50 data-[disabled]:cursor-not-allowed"
            onSelect={() => void exportReport("csv")}
          >
            {t("Export results (CSV)")}
          </DropdownMenu.Item>
          <DropdownMenu.Item
            disabled={!reportDataReady}
            className="flex cursor-pointer select-none items-center rounded px-2 py-1.5 text-sm outline-none text-gray-700 data-[highlighted]:bg-gray-100 data-[disabled]:opacity-50 data-[disabled]:cursor-not-allowed"
            onSelect={() => void exportReport("json")}
          >
            {t("Export results (JSON)")}
          </DropdownMenu.Item>
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );
}
