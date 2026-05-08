import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import { ChevronDownIcon, CheckIcon } from "@radix-ui/react-icons";
import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import Skeleton from "../../components/Skeleton";
import { Sketch } from "../../generated/graphql";

type DemoSketch = Pick<Sketch, "id" | "name" | "sketchClassId" | "createdAt">;

/** localStorage key for recently chosen demonstration sketches (per project + report draft). */
export function reportDemonstrationSketchStorageKey(
  projectId: number,
  reportId: number
) {
  // eslint-disable-next-line i18next/no-literal-string -- stable storage namespace
  return `seasketch-report-demo-sketches-${projectId}-r${reportId}`;
}

function demoSketchMatchesSearch(
  sketch: DemoSketch,
  q: string,
  sketchClassLabelsById?: Record<number, string>
) {
  if (!q) {
    return true;
  }
  if (sketch.name.toLowerCase().includes(q)) {
    return true;
  }
  const cls =
    sketch.sketchClassId != null
      ? sketchClassLabelsById?.[sketch.sketchClassId]
      : undefined;
  return cls ? cls.toLowerCase().includes(q) : false;
}

function loadRecentSketchIds(storageKey: string): number[] {
  try {
    const raw = localStorage.getItem(storageKey);
    if (!raw) {
      return [];
    }
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed)
      ? parsed.filter((x: unknown) => typeof x === "number")
      : [];
  } catch {
    return [];
  }
}

function rememberSketchSelection(storageKey: string, sketchId: number) {
  const prev = loadRecentSketchIds(storageKey).filter((id) => id !== sketchId);
  prev.unshift(sketchId);
  localStorage.setItem(storageKey, JSON.stringify(prev.slice(0, 20)));
}

type NamedSketchGroup = { label: string; sketches: DemoSketch[] };

function sortSketchesNewestFirst(sketches: DemoSketch[]) {
  return [...sketches].sort((a, b) => {
    const tb = new Date(b.createdAt).getTime();
    const ta = new Date(a.createdAt).getTime();
    return tb - ta;
  });
}

export function ExampleSketchSelector({
  demonstrationSketches,
  selectedSketchId,
  setSelectedSketchId,
  sketchClassLabelsById,
  recentSketchIdsStorageKey,
  /** Sketch classes linked to this report (primary assignment); listed first. */
  reportAssociatedSketchClassIds,
}: {
  demonstrationSketches: DemoSketch[];
  selectedSketchId: number | null;
  setSelectedSketchId: (sketchId: number | null) => void;
  /** When set, sketches are grouped by class and search/recents are enabled. */
  sketchClassLabelsById?: Record<number, string>;
  recentSketchIdsStorageKey?: string;
  reportAssociatedSketchClassIds?: number[];
}) {
  const { t } = useTranslation("admin:sketching");
  const [sketchDropdownOpen, setSketchDropdownOpen] = useState(false);
  const [search, setSearch] = useState("");

  const selectedSketch = demonstrationSketches.find(
    (sketch) => sketch.id === selectedSketchId
  );

  const enhanced =
    Boolean(sketchClassLabelsById) && demonstrationSketches.length > 0;

  const recentIds = useMemo(() => {
    if (!recentSketchIdsStorageKey || !enhanced) {
      return [];
    }
    return loadRecentSketchIds(recentSketchIdsStorageKey).slice(0, 8);
  }, [recentSketchIdsStorageKey, enhanced, sketchDropdownOpen]);

  const sketchById = useMemo(() => {
    const m = new Map<number, DemoSketch>();
    for (const s of demonstrationSketches) {
      m.set(s.id, s);
    }
    return m;
  }, [demonstrationSketches]);

  const q = search.trim().toLowerCase();

  const filteredSketches = useMemo(() => {
    return demonstrationSketches.filter((sketch) =>
      demoSketchMatchesSearch(sketch, q, sketchClassLabelsById)
    );
  }, [demonstrationSketches, q, sketchClassLabelsById]);

  const recentSketchesForDisplay = useMemo(() => {
    if (!enhanced || !recentSketchIdsStorageKey) {
      return [];
    }
    const out: DemoSketch[] = [];
    for (const id of recentIds) {
      const s = sketchById.get(id);
      if (
        s &&
        demoSketchMatchesSearch(s, q, sketchClassLabelsById)
      ) {
        out.push(s);
      }
      if (out.length >= 5) {
        break;
      }
    }
    return out;
  }, [
    enhanced,
    recentIds,
    sketchById,
    q,
    sketchClassLabelsById,
    recentSketchIdsStorageKey,
  ]);

  /** Associated sketch-class groups first, then optional "Other Sketch Classes" subtree. */
  const partitionedGroups = useMemo(() => {
    if (!enhanced || !sketchClassLabelsById) {
      return null;
    }
    const skipIds = new Set(recentSketchesForDisplay.map((s) => s.id));
    const pool = filteredSketches.filter((s) => !skipIds.has(s.id));

    const associatedIdsOrdered = [
      ...new Set(reportAssociatedSketchClassIds || []),
    ];
    const associatedIdSet = new Set(associatedIdsOrdered);

    const buildLabel = (cid: number | null | undefined) =>
      cid != null
        ? sketchClassLabelsById[cid] || t("Unknown sketch class")
        : t("Unknown sketch class");

    if (associatedIdsOrdered.length === 0) {
      const groups = new Map<string, DemoSketch[]>();
      for (const sketch of pool) {
        const label = buildLabel(sketch.sketchClassId ?? undefined);
        const list = groups.get(label) || [];
        list.push(sketch);
        groups.set(label, list);
      }
      const flat = [...groups.entries()]
        .sort(([a], [b]) => a.localeCompare(b, undefined, { sensitivity: "base" }))
        .map(([label, sketches]) => ({
          label,
          sketches: sortSketchesNewestFirst(sketches),
        }));
      return {
        associatedGroups: flat,
        otherGroups: [] as NamedSketchGroup[],
        showOtherHeading: false,
      };
    }

    const associatedGroups: NamedSketchGroup[] = [];
    for (const cid of associatedIdsOrdered) {
      const sketches = pool.filter((s) => s.sketchClassId === cid);
      if (sketches.length === 0) {
        continue;
      }
      associatedGroups.push({
        label: buildLabel(cid),
        sketches: sortSketchesNewestFirst(sketches),
      });
    }

    const remaining = pool.filter(
      (s) =>
        s.sketchClassId == null || !associatedIdSet.has(s.sketchClassId)
    );

    const otherMap = new Map<string, DemoSketch[]>();
    for (const sketch of remaining) {
      const label = buildLabel(sketch.sketchClassId ?? undefined);
      const list = otherMap.get(label) || [];
      list.push(sketch);
      otherMap.set(label, list);
    }

    const otherGroups = [...otherMap.entries()]
      .sort(([a], [b]) => a.localeCompare(b, undefined, { sensitivity: "base" }))
      .map(([label, sketches]) => ({
        label,
        sketches: sortSketchesNewestFirst(sketches),
      }));

    return {
      associatedGroups,
      otherGroups,
      showOtherHeading: otherGroups.length > 0,
    };
  }, [
    enhanced,
    sketchClassLabelsById,
    filteredSketches,
    recentSketchesForDisplay,
    reportAssociatedSketchClassIds,
    t,
  ]);

  const flatListForSimpleMode = useMemo(() => {
    return [...demonstrationSketches].sort((a, b) => {
      const tb = new Date(b.createdAt).getTime();
      const ta = new Date(a.createdAt).getTime();
      return tb - ta;
    });
  }, [demonstrationSketches]);

  const renderSketchRow = (
    sketch: DemoSketch,
    options?: { showClassSubtitle?: boolean }
  ) => {
    const isSelected = sketch.id === selectedSketchId;
    const clsLabel =
      sketch.sketchClassId != null
        ? sketchClassLabelsById?.[sketch.sketchClassId]
        : undefined;
    const showClassSubtitle =
      options?.showClassSubtitle !== false &&
      enhanced &&
      Boolean(clsLabel);
    return (
      <DropdownMenu.Item
        key={sketch.id}
        className="px-3 py-2 text-sm text-gray-700 hover:bg-gray-100 cursor-pointer outline-none flex items-center justify-between gap-2"
        onSelect={() => {
          setSelectedSketchId(sketch.id);
          if (recentSketchIdsStorageKey) {
            rememberSketchSelection(recentSketchIdsStorageKey, sketch.id);
          }
          setSketchDropdownOpen(false);
          setSearch("");
        }}
      >
        <span className="min-w-0 flex-1 text-left">
          <span
            className={`block truncate ${
              isSelected ? "font-medium text-gray-900" : ""
            }`}
          >
            {sketch.name}
          </span>
          {showClassSubtitle && (
            <span className="block text-xs text-gray-500 truncate mt-0.5">
              {clsLabel}
            </span>
          )}
        </span>
        {isSelected && (
          <CheckIcon className="w-4 h-4 text-blue-600 flex-shrink-0" />
        )}
      </DropdownMenu.Item>
    );
  };

  return (
    <DropdownMenu.Root
      open={sketchDropdownOpen}
      onOpenChange={(open) => {
        setSketchDropdownOpen(open);
        if (!open) {
          setSearch("");
        }
      }}
    >
      <DropdownMenu.Trigger asChild>
        <button className="flex items-center gap-1.5 text-lg text-gray-900 hover:text-gray-900 focus:outline-none transition-colors max-w-full">
          <span className="font-normal truncate">
            {selectedSketchId ? (
              selectedSketch?.name
            ) : (
              <Skeleton className="w-36 h-5" />
            )}
          </span>
          {selectedSketchId && (
            <ChevronDownIcon className="w-4 h-4 text-gray-400" />
          )}
        </button>
      </DropdownMenu.Trigger>
      <DropdownMenu.Portal>
        <DropdownMenu.Content
          className="bg-white rounded-md shadow-lg border border-gray-200 py-1 min-w-[260px] max-w-[380px] z-50 flex flex-col max-h-[min(480px,70vh)]"
          side="bottom"
          align="start"
          sideOffset={5}
          onCloseAutoFocus={(e) => e.preventDefault()}
        >
          <div className="px-3 py-2 border-b border-gray-100 flex-shrink-0">
            <p className="text-xs text-gray-500 mb-2">
              {t("Select a sketch to preview the report")}
            </p>
            {enhanced && (
              <input
                type="search"
                autoComplete="off"
                placeholder={t("Search sketches")}
                className="w-full border border-gray-200 rounded px-2 py-1.5 text-sm"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                onKeyDown={(e) => e.stopPropagation()}
              />
            )}
          </div>
          <div className="overflow-y-auto flex-1 min-h-0 py-1">
            {!enhanced && (
              <>
                {flatListForSimpleMode.map((sketch) =>
                  renderSketchRow(sketch)
                )}
              </>
            )}
            {enhanced && recentSketchesForDisplay.length > 0 && (
              <>
                <div className="px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wide text-gray-400">
                  {t("Recent")}
                </div>
                {recentSketchesForDisplay.map((sketch) =>
                  renderSketchRow(sketch, { showClassSubtitle: true })
                )}
                <DropdownMenu.Separator className="h-px bg-gray-100 my-1" />
              </>
            )}
            {enhanced &&
              partitionedGroups &&
              partitionedGroups.otherGroups.length > 0 &&
              reportAssociatedSketchClassIds &&
              reportAssociatedSketchClassIds.length > 0 && (
                <div className="px-3 py-2 text-[11px] font-semibold uppercase tracking-wide text-gray-500 border-t border-gray-100 mt-1 pt-2">
                  {t("Linked sketch classes")}
                </div>
              )}
            {enhanced &&
              partitionedGroups &&
              partitionedGroups.associatedGroups.map((group, i) => (
                <div key={`assoc-${i}-${group.label}`}>
                  <div className="px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wide text-gray-400">
                    {group.label}
                  </div>
                  {group.sketches.map((sketch) =>
                    renderSketchRow(sketch, { showClassSubtitle: false })
                  )}
                </div>
              ))}
            {enhanced &&
              partitionedGroups?.showOtherHeading &&
              partitionedGroups.otherGroups.length > 0 && (
                <>
                  <div className="px-3 py-2 text-[11px] font-semibold uppercase tracking-wide text-gray-500 border-t border-gray-100 mt-1 pt-2">
                    {t("Other Sketch Classes")}
                  </div>
                  {partitionedGroups.otherGroups.map((group, i) => (
                    <div key={`other-${i}-${group.label}`}>
                      <div className="px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wide text-gray-400">
                        {group.label}
                      </div>
                      {group.sketches.map((sketch) =>
                        renderSketchRow(sketch, { showClassSubtitle: false })
                      )}
                    </div>
                  ))}
                </>
              )}
          </div>
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );
}
