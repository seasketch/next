import { ChevronDownIcon, ChevronRightIcon } from "@heroicons/react/solid";
import { FolderIcon, ViewListIcon } from "@heroicons/react/outline";
import { Link2Icon } from "@radix-ui/react-icons";
import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import * as Tooltip from "@radix-ui/react-tooltip";
import clsx from "clsx";
import { ReactNode, useEffect, useMemo, useRef, useState } from "react";
import { Trans, useTranslation } from "react-i18next";
import { useParams } from "react-router-dom";
import Modal from "../../components/Modal";
import Spinner from "../../components/Spinner";
import { useToast } from "../../components/Toast";
import {
  ChangeLogFieldGroup,
  DraftTableOfContentsDocument,
  LayersAndSourcesForItemsDocument,
  ProjectMetadataDocument,
  PublishedTableOfContentsDocument,
  SelectivePublishDetailsQuery,
  usePublishTableOfContentsItemsMutation,
  useSelectivePublishDetailsQuery,
} from "../../generated/graphql";
import useProjectId from "../../useProjectId";
import { CHANGE_LOG_INTRODUCTION_DATE } from "../changelogs/constants";
import LayerCartographyRevisionModal from "./LayerCartographyRevisionModal";
import LayerMetadataRevisionModal from "./LayerMetadataRevisionModal";
import {
  PublishBadge,
  SummaryMetaRow,
} from "./PublishSummarizedChangesPanel";
import {
  buildPublishChangeSummary,
  oldestChangeLogId,
  PublishSummaryRow,
  PublishZOrderSummary,
} from "./publishChangelogSummary";
import {
  ancestorCrumbs,
  bundleMates,
  checkableUnits,
  checkUnit,
  closureOf,
  CrumbSource,
  impliedCheckable,
  includedWithTitles,
  isPublishKind,
  isSharedSourceBundle,
  linkedRowIds,
  promoteImplied,
  PublishKind,
  SelectiveUnit,
  setSectionChecked,
  uncheckUnit,
} from "./selectivePublishSelection";

const Z_ORDER_KEY = "z-order";

type PendingRow = NonNullable<
  NonNullable<
    NonNullable<SelectivePublishDetailsQuery["projectBySlug"]>["pendingPublishItems"]
  >[number]
>;

export function PublishSplitButton({
  publishDisabled,
  lastPublished,
  onRequestPublish,
  onRequestSelectivePublish,
}: {
  publishDisabled?: boolean;
  lastPublished?: Date;
  onRequestPublish: () => void;
  onRequestSelectivePublish: () => void;
}) {
  const { t } = useTranslation("admin:data");
  const tone = publishDisabled
    ? "bg-white text-black opacity-80"
    : "bg-primary-500 text-white";

  return (
    <Tooltip.Provider>
      <Tooltip.Root delayDuration={200}>
        <Tooltip.Trigger asChild>
          <div className="inline-flex overflow-hidden rounded shadow-sm">
            <button
              id="publish-button"
              type="button"
              className={`${tone} px-2 py-0.5`}
              onClick={onRequestPublish}
            >
              <Trans ns="admin:data">Publish</Trans>
            </button>
            <DropdownMenu.Root modal={false}>
              <DropdownMenu.Trigger asChild>
                <button
                  type="button"
                  className={`${tone} border-l ${
                    publishDisabled ? "border-black/10" : "border-white/25"
                  } px-1 py-0.5 hover:bg-black/10 focus:outline-none focus-visible:ring-2 focus-visible:ring-white/70`}
                  aria-label={t("More publish options")}
                >
                  <ChevronDownIcon className="h-3.5 w-3.5" aria-hidden />
                </button>
              </DropdownMenu.Trigger>
              <DropdownMenu.Portal>
                <DropdownMenu.Content
                  align="end"
                  sideOffset={6}
                  onCloseAutoFocus={(event) => event.preventDefault()}
                  className="z-[80] min-w-[16rem] overflow-hidden rounded-md border border-black/5 bg-white p-1 text-left shadow-lg"
                >
                  <DropdownMenu.Item
                    className="cursor-pointer rounded px-3 py-2 outline-none data-[highlighted]:bg-slate-100"
                    onSelect={onRequestSelectivePublish}
                  >
                    <span className="block text-sm font-medium text-slate-900">
                      {t("Selective publish")}
                    </span>
                    <span className="mt-0.5 block text-xs leading-snug text-slate-500">
                      {t("Choose which draft changes to publish")}
                    </span>
                  </DropdownMenu.Item>
                </DropdownMenu.Content>
              </DropdownMenu.Portal>
            </DropdownMenu.Root>
          </div>
        </Tooltip.Trigger>
        <Tooltip.Portal>
          <Tooltip.Content
            style={{ maxWidth: 220 }}
            className="z-50 select-none rounded bg-white px-4 py-2 text-center shadow"
            side="right"
          >
            {publishDisabled ? (
              t("No changes")
            ) : lastPublished ? (
              t("Has changes since last publish on {{date}}", {
                date: lastPublished.toLocaleDateString(),
              })
            ) : (
              t("Has changes since last publish")
            )}
            <Tooltip.Arrow style={{ fill: "white" }} />
          </Tooltip.Content>
        </Tooltip.Portal>
      </Tooltip.Root>
    </Tooltip.Provider>
  );
}

function unitsFromPending(rows: readonly PendingRow[]): SelectiveUnit[] {
  const units: SelectiveUnit[] = [];
  for (const row of rows) {
    if (!row.stableId || !isPublishKind(row.kind)) {
      continue;
    }
    units.push({
      stableId: row.stableId,
      kind: row.kind,
      title: row.title || row.stableId,
      isFolder: Boolean(row.isFolder),
      parentStableId: row.parentStableId ?? null,
      requiresStableIds: (row.requiresStableIds || []).filter(
        (id): id is string => Boolean(id)
      ),
      bundleId: row.bundleId ?? null,
      includedInBundle: Boolean(row.includedInBundle),
      draftId: row.draftId ?? null,
    });
  }
  return units;
}

export default function SelectivePublishModal({
  onRequestClose,
}: {
  onRequestClose: () => void;
}) {
  const { t } = useTranslation("admin:data");
  const { t: adminT } = useTranslation("admin");
  const { toast } = useToast();
  const { slug } = useParams<{ slug: string }>();
  const projectId = useProjectId();
  const detailsQuery = useSelectivePublishDetailsQuery({
    variables: { slug },
    fetchPolicy: "cache-and-network",
  });
  const [publish, publishState] = usePublishTableOfContentsItemsMutation({
    refetchQueries: [
      PublishedTableOfContentsDocument,
      LayersAndSourcesForItemsDocument,
      ProjectMetadataDocument,
      DraftTableOfContentsDocument,
    ],
  });
  const [explicit, setExplicit] = useState<string[]>([]);
  const [includeZOrder, setIncludeZOrder] = useState(false);
  const [highlighted, setHighlighted] = useState<Set<string>>(new Set());
  const [focusedId, setFocusedId] = useState<string | null>(null);
  const [collapsedBundles, setCollapsedBundles] = useState<Set<string>>(
    new Set()
  );
  const [publishError, setPublishError] = useState<string | null>(null);
  const [metadataModal, setMetadataModal] = useState<{
    tocId: number;
    initialId?: string;
  } | null>(null);
  const [cartographyModal, setCartographyModal] = useState<{
    tocId: number;
    initialId?: string;
  } | null>(null);

  const project = detailsQuery.data?.projectBySlug;
  const units = useMemo(
    () => unitsFromPending(project?.pendingPublishItems || []),
    [project?.pendingPublishItems]
  );
  const stackPending = Boolean(project?.layerStackOrderPending);
  const summary = useMemo(
    () =>
      buildPublishChangeSummary({
        changeLogs: project?.changeLogsSinceLastPublish || [],
        draftItems: project?.draftTableOfContentsItems || [],
        tableOfContentsLastPublished: project?.tableOfContentsLastPublished,
      }),
    [
      project?.changeLogsSinceLastPublish,
      project?.draftTableOfContentsItems,
      project?.tableOfContentsLastPublished,
    ]
  );
  const crumbsById = useMemo(() => {
    const sources = new Map<string, CrumbSource>();
    for (const item of project?.tableOfContentsItems || []) {
      if (!item.stableId) {
        continue;
      }
      sources.set(item.stableId, {
        title: item.title,
        parentStableId: item.parentStableId ?? null,
        added: false,
      });
    }
    for (const item of project?.draftTableOfContentsItems || []) {
      if (!item.stableId) {
        continue;
      }
      sources.set(item.stableId, {
        title: item.title,
        parentStableId: item.parentStableId ?? null,
        added: false,
      });
    }
    for (const unit of units) {
      const existing = sources.get(unit.stableId);
      sources.set(unit.stableId, {
        title: unit.title,
        parentStableId: unit.parentStableId ?? existing?.parentStableId ?? null,
        added: unit.kind === "added",
      });
    }
    return sources;
  }, [project?.draftTableOfContentsItems, project?.tableOfContentsItems, units]);

  const selectionSignature = useMemo(() => {
    const ids = checkableUnits(units)
      .map(
        (unit) =>
          `${unit.stableId}:${unit.kind}:${unit.requiresStableIds.join(".")}`
      )
      .join("|");
    return `${ids}#${stackPending ? "z" : ""}`;
  }, [stackPending, units]);

  useEffect(() => {
    setExplicit(checkableUnits(units).map((unit) => unit.stableId));
    setIncludeZOrder(stackPending);
    setPublishError(null);
    // Reset when the pending set itself changes, not on every selection edit.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectionSignature]);

  useEffect(() => {
    if (!highlighted.size) {
      return;
    }
    const timer = window.setTimeout(() => setHighlighted(new Set()), 1600);
    return () => window.clearTimeout(timer);
  }, [highlighted]);

  const implied = useMemo(
    () => impliedCheckable(explicit, units),
    [explicit, units]
  );
  const checkedIds = useMemo(() => {
    const next = new Set(explicit);
    for (const unit of implied) {
      next.add(unit.stableId);
    }
    return next;
  }, [explicit, implied]);
  const linkedIds = useMemo(() => {
    if (!focusedId) {
      return new Set<string>();
    }
    return new Set(linkedRowIds(focusedId, explicit, units));
  }, [explicit, focusedId, units]);

  const selectedCount = explicit.length + (includeZOrder ? 1 : 0);
  const includedCount = implied.length;
  const loading = detailsQuery.loading && !detailsQuery.data;
  const lastPublished = project?.tableOfContentsLastPublished
    ? new Date(project.tableOfContentsLastPublished)
    : null;

  const flash = (ids: string[]) => {
    if (!ids.length) {
      return;
    }
    setHighlighted(new Set(ids));
  };

  const summaryFor = (unit: SelectiveUnit): PublishSummaryRow | undefined => {
    const rows = [...summary.added, ...summary.updated, ...summary.removed];
    if (unit.draftId != null) {
      const match = rows.find((row) => row.entityId === unit.draftId);
      if (match) {
        return match;
      }
    }
    return summary.removed.find(
      (row) => row.title === unit.title && row.isFolder === unit.isFolder
    );
  };

  const groupsFor = (kind: PublishKind) =>
    units
      .filter((unit) => unit.kind === kind && !unit.includedInBundle)
      .map((leader) => ({
        leader,
        mates: bundleMates(leader, units),
      }));

  const publishSelection = async () => {
    if (projectId == null) {
      return;
    }
    setPublishError(null);
    const stableIds = closureOf(explicit, units);
    const count = stableIds.length + (includeZOrder ? 1 : 0);
    try {
      const result = await publish({
        variables: {
          projectId,
          stableIds,
          includeZOrder,
        },
      });
      if (!result.errors) {
        toast(t("Published {{count}} changes", { count }));
        onRequestClose();
      }
    } catch (error) {
      console.error(error);
      setPublishError(t("Could not publish these changes"));
    }
  };

  return (
    <Modal
      title={t("Selective publish")}
      onRequestClose={onRequestClose}
      disableBackdropClick
      scrollable
      panelClassName="flex flex-col sm:max-w-3xl max-h-[min(90vh,52rem)]"
      bodyClassName="flex min-h-0 flex-1 flex-col overflow-hidden p-0"
      footer={[
        {
          autoFocus: true,
          label: t("Publish {{count}} selected", { count: selectedCount }),
          variant: "primary",
          disabled: loading || publishState.loading || selectedCount === 0,
          loading: publishState.loading,
          onClick: publishSelection,
        },
        {
          label: t("Cancel"),
          onClick: onRequestClose,
        },
      ]}
    >
      {loading ? (
        <div className="flex flex-1 items-center justify-center py-16">
          <Spinner />
        </div>
      ) : (
        <Tooltip.Provider delayDuration={200}>
          <div
            className="flex min-h-0 flex-1 flex-col"
            data-testid="selective-publish-state"
            data-explicit={explicit.join(" ")}
            data-implied={implied.map((unit) => unit.stableId).join(" ")}
          >
            <div className="shrink-0 space-y-3 border-b border-slate-100 px-6 pb-4 pt-4">
              <p className="text-sm leading-relaxed text-slate-600">
                <Trans ns="admin:data">
                  Choose which overlay list updates to include in this
                  publication. Layers and folders that are currently published
                  but not included in this update will remain unchanged.
                </Trans>
              </p>
              {lastPublished && !Number.isNaN(lastPublished.getTime()) ? (
                <p className="text-xs text-slate-500">
                  {t("Draft changes since {{date}}.", {
                    date: lastPublished.toLocaleDateString(undefined, {
                      dateStyle: "medium",
                    }),
                  })}
                </p>
              ) : null}
              {publishError ? (
                <p className="text-sm text-rose-700" role="alert">
                  {publishError}
                </p>
              ) : null}
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto px-6 py-5">
              {checkableUnits(units).length === 0 && !stackPending ? (
                <EmptyPendingNotice />
              ) : (
                <div className="flex flex-col gap-6 pb-1">
                  {(["added", "updated", "removed"] as PublishKind[]).map(
                    (kind) => (
                      <UnitSection
                        key={kind}
                        kind={kind}
                        title={sectionTitle(kind, adminT)}
                        groups={groupsFor(kind)}
                        units={units}
                        explicit={explicit}
                        checkedIds={checkedIds}
                        linkedIds={linkedIds}
                        highlighted={highlighted}
                        collapsedBundles={collapsedBundles}
                        showPlacementNote={!includeZOrder && stackPending}
                        crumbsById={crumbsById}
                        summaryFor={summaryFor}
                        t={t}
                        onToggleSection={(checked) => {
                          const ids = groupsFor(kind).map(
                            (group) => group.leader.stableId
                          );
                          const result = setSectionChecked(
                            explicit,
                            ids,
                            checked,
                            units
                          );
                          setExplicit(result.explicit);
                          flash(result.cascaded);
                        }}
                        onCheck={(stableId) =>
                          setExplicit(checkUnit(explicit, stableId))
                        }
                        onUncheck={(stableId) => {
                          const result = uncheckUnit(explicit, stableId, units);
                          setExplicit(result.explicit);
                          flash(result.cascaded);
                        }}
                        onPromote={(stableId) => {
                          const result = promoteImplied(
                            explicit,
                            stableId,
                            units
                          );
                          setExplicit(result.explicit);
                          flash(result.nudged);
                        }}
                        onFocusRow={setFocusedId}
                        onToggleBundle={(bundleId) => {
                          setCollapsedBundles((prev) => {
                            const next = new Set(prev);
                            if (next.has(bundleId)) {
                              next.delete(bundleId);
                            } else {
                              next.add(bundleId);
                            }
                            return next;
                          });
                        }}
                        onOpenMetadata={(tocId, initialId) =>
                          setMetadataModal({ tocId, initialId })
                        }
                        onOpenCartography={(tocId, initialId) =>
                          setCartographyModal({ tocId, initialId })
                        }
                      />
                    )
                  )}
                  {stackPending ? (
                    <SelectableSection
                      tone="other"
                      title={adminT("Other Changes")}
                      keys={[Z_ORDER_KEY]}
                      selected={
                        includeZOrder
                          ? new Set([Z_ORDER_KEY])
                          : new Set<string>()
                      }
                      onToggleSection={setIncludeZOrder}
                    >
                      <StackingRow
                        summary={summary.zOrderSummary}
                        checked={includeZOrder}
                        onCheckedChange={setIncludeZOrder}
                        t={t}
                      />
                    </SelectableSection>
                  ) : null}
                </div>
              )}
            </div>
            {includedCount > 0 ? (
              <p className="shrink-0 border-t border-slate-100 px-6 py-2 text-xs text-slate-500">
                {t("+ {{count}} included", { count: includedCount })}
              </p>
            ) : null}
          </div>
        </Tooltip.Provider>
      )}
      {metadataModal && (
        <LayerMetadataRevisionModal
          tableOfContentsItemId={metadataModal.tocId}
          initialChangeLogId={metadataModal.initialId}
          onRequestClose={() => setMetadataModal(null)}
        />
      )}
      {cartographyModal && (
        <LayerCartographyRevisionModal
          tableOfContentsItemId={cartographyModal.tocId}
          initialChangeLogId={cartographyModal.initialId}
          onRequestClose={() => setCartographyModal(null)}
        />
      )}
    </Modal>
  );
}

function sectionTitle(
  kind: PublishKind,
  adminT: (key: string) => string
): string {
  if (kind === "added") {
    return adminT("Added");
  }
  if (kind === "removed") {
    return adminT("Removed");
  }
  return adminT("Updated");
}

function EmptyPendingNotice() {
  const { t } = useTranslation("admin:data");
  const daysSinceIntroduction = Math.floor(
    (Date.now() - CHANGE_LOG_INTRODUCTION_DATE.getTime()) /
      (1000 * 60 * 60 * 24)
  );
  return (
    <div className="rounded-lg border border-gray-200 bg-gray-50 px-4 py-6 text-center text-sm text-gray-500">
      {daysSinceIntroduction < 90
        ? t(
            "No unpublished changes were found. Change logging was introduced on {{date}}, so any changes made before that date were not logged. In the future, you can look forward to seeing detailed change history for layer list updates.",
            { date: CHANGE_LOG_INTRODUCTION_DATE.toLocaleDateString() }
          )
        : t(
            "Nothing here is waiting as its own update. Reordering siblings, and fields the changelog does not record, ship with Publish."
          )}
    </div>
  );
}

function UnitSection({
  kind,
  title,
  groups,
  units,
  explicit,
  checkedIds,
  linkedIds,
  highlighted,
  collapsedBundles,
  showPlacementNote,
  crumbsById,
  summaryFor,
  t,
  onToggleSection,
  onCheck,
  onUncheck,
  onPromote,
  onFocusRow,
  onToggleBundle,
  onOpenMetadata,
  onOpenCartography,
}: {
  kind: PublishKind;
  title: string;
  groups: { leader: SelectiveUnit; mates: SelectiveUnit[] }[];
  units: SelectiveUnit[];
  explicit: string[];
  checkedIds: Set<string>;
  linkedIds: Set<string>;
  highlighted: Set<string>;
  collapsedBundles: Set<string>;
  showPlacementNote: boolean;
  crumbsById: Map<string, CrumbSource>;
  summaryFor: (unit: SelectiveUnit) => PublishSummaryRow | undefined;
  t: (key: string, options?: Record<string, unknown>) => string;
  onToggleSection: (checked: boolean) => void;
  onCheck: (stableId: string) => void;
  onUncheck: (stableId: string) => void;
  onPromote: (stableId: string) => void;
  onFocusRow: (stableId: string | null) => void;
  onToggleBundle: (bundleId: string) => void;
  onOpenMetadata: (tocId: number, initialId?: string) => void;
  onOpenCartography: (tocId: number, initialId?: string) => void;
}) {
  if (!groups.length) {
    return null;
  }
  const impliedIds = new Set(
    impliedCheckable(explicit, units).map((unit) => unit.stableId)
  );
  const keys = groups.map((group) => group.leader.stableId);
  return (
    <SelectableSection
      tone={kind === "added" ? "added" : kind === "removed" ? "removed" : "updated"}
      title={title}
      keys={keys}
      selected={checkedIds}
      onToggleSection={onToggleSection}
    >
      {groups.map((group) => {
        const shared = isSharedSourceBundle(group.leader.bundleId);
        const collapsed =
          group.leader.bundleId != null &&
          collapsedBundles.has(group.leader.bundleId);
        return (
          <li key={group.leader.stableId} className="list-none">
            {shared ? (
              <div className="border-b border-slate-100 bg-slate-50/70 px-4 py-2 text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">
                <Trans ns="admin:data">Shared source</Trans>
              </div>
            ) : null}
            <UnitRow
              unit={group.leader}
              implied={impliedIds.has(group.leader.stableId)}
              checked={checkedIds.has(group.leader.stableId)}
              highlighted={
                highlighted.has(group.leader.stableId) ||
                linkedIds.has(group.leader.stableId)
              }
              includedWith={includedWithTitles(
                group.leader.stableId,
                explicit,
                units
              )}
              insideCount={
                group.leader.kind === "removed" ? group.mates.length : 0
              }
              bundleCollapsed={collapsed}
              showPlacementNote={
                showPlacementNote &&
                group.leader.kind === "added" &&
                !group.leader.isFolder &&
                checkedIds.has(group.leader.stableId)
              }
              crumbs={ancestorCrumbs(group.leader.parentStableId, crumbsById)}
              summary={summaryFor(group.leader)}
              t={t}
              onCheck={() => onCheck(group.leader.stableId)}
              onUncheck={() => onUncheck(group.leader.stableId)}
              onPromote={() => onPromote(group.leader.stableId)}
              onFocus={() => onFocusRow(group.leader.stableId)}
              onBlur={() => onFocusRow(null)}
              onToggleBundle={
                group.mates.length && group.leader.bundleId
                  ? () => onToggleBundle(group.leader.bundleId as string)
                  : undefined
              }
              onOpenMetadata={onOpenMetadata}
              onOpenCartography={onOpenCartography}
            />
            {!collapsed
              ? group.mates.map((mate) => (
                  <NestedMate
                    key={mate.stableId}
                    mate={mate}
                    leaderTitle={group.leader.title}
                    t={t}
                  />
                ))
              : null}
          </li>
        );
      })}
    </SelectableSection>
  );
}

function UnitRow({
  unit,
  implied,
  checked,
  highlighted,
  includedWith,
  insideCount,
  bundleCollapsed,
  showPlacementNote,
  crumbs,
  summary,
  t,
  onCheck,
  onUncheck,
  onPromote,
  onFocus,
  onBlur,
  onToggleBundle,
  onOpenMetadata,
  onOpenCartography,
}: {
  unit: SelectiveUnit;
  implied: boolean;
  checked: boolean;
  highlighted: boolean;
  includedWith: string[];
  insideCount: number;
  bundleCollapsed: boolean;
  showPlacementNote: boolean;
  crumbs: { stableId: string; title: string; added: boolean }[];
  summary?: PublishSummaryRow;
  t: (key: string, options?: Record<string, unknown>) => string;
  onCheck: () => void;
  onUncheck: () => void;
  onPromote: () => void;
  onFocus: () => void;
  onBlur: () => void;
  onToggleBundle?: () => void;
  onOpenMetadata: (tocId: number, initialId?: string) => void;
  onOpenCartography: (tocId: number, initialId?: string) => void;
}) {
  // eslint-disable-next-line i18next/no-literal-string
  const inputId = `selective-publish-${unit.stableId}`;
  // eslint-disable-next-line i18next/no-literal-string
  const captionId = `${inputId}-caption`;
  const removed = unit.kind === "removed";
  const includedLabel =
    implied && includedWith.length
      ? t("Included with {{name}}", {
          name: includedWith.join(", "),
        })
      : "";
  const placementLabel = showPlacementNote
    ? t("Placed next to its draft neighbours")
    : "";

  return (
    <div
      className={clsx(
        "px-4 py-3.5 transition-colors",
        !checked && "opacity-60",
        highlighted && "bg-amber-50"
      )}
      onMouseEnter={onFocus}
      onMouseLeave={onBlur}
    >
      <div className="flex items-start gap-3">
        {implied ? (
          <button
            type="button"
            className="mt-0.5 inline-flex h-5 w-5 shrink-0 items-center justify-center rounded text-sky-700 hover:bg-sky-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-500"
            aria-label={includedLabel || t("Included with this publish")}
            aria-describedby={captionId}
            onClick={onPromote}
            onFocus={onFocus}
            onBlur={onBlur}
          >
            <Link2Icon className="h-4 w-4" aria-hidden />
          </button>
        ) : (
          <input
            id={inputId}
            type="checkbox"
            checked={checked}
            onChange={(event) =>
              event.target.checked ? onCheck() : onUncheck()
            }
            onFocus={onFocus}
            onBlur={onBlur}
            className="mt-1 h-4 w-4 shrink-0 rounded border-gray-300 text-primary-600 focus:ring-primary-500"
          />
        )}
        <div className="min-w-0 flex-1 space-y-1.5">
          <div className="flex flex-wrap items-center gap-2">
            {implied ? (
              <span
                className={clsx(
                  "text-base font-semibold leading-snug",
                  removed ? "text-slate-400 line-through" : "text-slate-900"
                )}
              >
                <ItemTitle unit={unit} />
              </span>
            ) : (
              <label
                htmlFor={inputId}
                className={clsx(
                  "cursor-pointer text-base font-semibold leading-snug",
                  removed ? "text-slate-400 line-through" : "text-slate-900"
                )}
              >
                <ItemTitle unit={unit} />
              </label>
            )}
            {insideCount > 0 ? (
              <button
                type="button"
                className="inline-flex items-center gap-1 rounded-full bg-rose-50 px-2 py-0.5 text-xs font-medium text-rose-800"
                onClick={onToggleBundle}
                aria-expanded={!bundleCollapsed}
              >
                {bundleCollapsed ? (
                  <ChevronRightIcon className="h-3.5 w-3.5" aria-hidden />
                ) : (
                  <ChevronDownIcon className="h-3.5 w-3.5" aria-hidden />
                )}
                {t("and {{count}} items inside", { count: insideCount })}
              </button>
            ) : null}
          </div>
          {crumbs.length ? (
            <p className="text-xs text-slate-500">
              {crumbs.map((crumb, index) => (
                <span key={crumb.stableId}>
                  {index > 0 ? (
                    <ChevronRightIcon
                      className="mx-0.5 inline h-3 w-3 text-slate-300"
                      aria-hidden
                    />
                  ) : null}
                  {crumb.added ? (
                    <span className="rounded bg-emerald-50 px-1.5 py-0.5 font-medium text-emerald-800">
                      {crumb.title}
                    </span>
                  ) : (
                    crumb.title
                  )}
                </span>
              ))}
            </p>
          ) : null}
          {includedLabel || placementLabel ? (
            <p id={captionId} className="text-xs text-slate-500">
              {includedLabel || placementLabel}
            </p>
          ) : (
            <span id={captionId} className="sr-only" />
          )}
          {summary && (summary.editors.length > 0 || summary.changeCount > 0) ? (
            <SummaryMetaRow
              editors={summary.editors}
              primaryEditor={summary.primaryEditor}
              changeCount={summary.changeCount}
              lastChangeAt={summary.lastChangeAt}
              dataLibraryTemplateId={summary.dataLibraryTemplateId}
              t={t}
            />
          ) : null}
          {!removed && summary && summary.badges.length > 0 && unit.draftId != null ? (
            <div className="flex flex-wrap gap-1.5 pt-1">
              {summary.badges.map((badge) => (
                <PublishBadge
                  key={badge.key}
                  badgeKey={badge.key}
                  logs={badge.logs}
                  t={t}
                  isFolder={unit.isFolder}
                  tableOfContentsItemId={unit.draftId as number}
                  dataLibraryTemplateId={summary.dataLibraryTemplateId}
                  onOpenMetadata={() =>
                    onOpenMetadata(
                      unit.draftId as number,
                      oldestChangeLogId(
                        badge.logs,
                        ChangeLogFieldGroup.LayerMetadata
                      )
                    )
                  }
                  onOpenCartography={() =>
                    onOpenCartography(
                      unit.draftId as number,
                      oldestChangeLogId(
                        badge.logs,
                        ChangeLogFieldGroup.LayerCartography
                      )
                    )
                  }
                />
              ))}
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}

function ItemTitle({ unit }: { unit: SelectiveUnit }) {
  if (!unit.isFolder) {
    return <span className="min-w-0">{unit.title}</span>;
  }
  return (
    <span className="inline-flex min-w-0 items-center gap-2">
      <FolderIcon
        className="h-[1.125rem] w-[1.125rem] flex-none text-slate-400"
        aria-hidden
      />
      <span className="min-w-0">{unit.title}</span>
    </span>
  );
}

function NestedMate({
  mate,
  leaderTitle,
  t,
}: {
  mate: SelectiveUnit;
  leaderTitle: string;
  t: (key: string, options?: Record<string, unknown>) => string;
}) {
  const removed = mate.kind === "removed";
  return (
    <div className="border-t border-slate-50 bg-slate-50/40 py-2 pl-12 pr-4">
      <p
        className={clsx(
          "text-sm",
          removed ? "text-slate-400 line-through" : "text-slate-600"
        )}
      >
        {mate.isFolder ? (
          <FolderIcon
            className="mr-1.5 inline h-3.5 w-3.5 text-slate-300"
            aria-hidden
          />
        ) : null}
        {mate.title}
      </p>
      <p className="text-xs text-slate-400">
        {t("Included with {{name}}", { name: leaderTitle })}
      </p>
    </div>
  );
}

function StackingRow({
  summary,
  checked,
  t,
  onCheckedChange,
}: {
  summary: PublishZOrderSummary | null;
  checked: boolean;
  t: (key: string, options?: Record<string, unknown>) => string;
  onCheckedChange: (checked: boolean) => void;
}) {
  const inputId = "selective-publish-z-order";
  return (
    <li className={clsx("px-4 py-4", !checked && "opacity-60")}>
      <div className="flex items-start gap-3">
        <input
          id={inputId}
          type="checkbox"
          checked={checked}
          onChange={(event) => onCheckedChange(event.target.checked)}
          className="mt-1 h-4 w-4 shrink-0 rounded border-gray-300 text-primary-600 focus:ring-primary-500"
        />
        <div className="min-w-0 flex-1 space-y-2">
          <label
            htmlFor={inputId}
            className="cursor-pointer text-base font-semibold leading-snug text-slate-900"
          >
            <span className="inline-flex min-w-0 items-center gap-2">
              <ViewListIcon
                className="h-[1.125rem] w-[1.125rem] flex-none text-indigo-500"
                aria-hidden
              />
              <span className="min-w-0">
                <Trans ns="admin:data">Layer stacking order</Trans>
              </span>
            </span>
          </label>
          <p className="text-sm text-slate-500">
            <Trans ns="admin:data">
              Published layers take their draft stacking order
            </Trans>
          </p>
          {summary ? (
            <SummaryMetaRow
              editors={summary.editors}
              primaryEditor={summary.primaryEditor}
              changeCount={summary.changeCount}
              lastChangeAt={summary.lastChangeAt}
              t={t}
            />
          ) : null}
        </div>
      </div>
    </li>
  );
}

function SelectableSection({
  tone,
  title,
  keys,
  selected,
  onToggleSection,
  children,
}: {
  tone: "added" | "removed" | "updated" | "other";
  title: string;
  keys: string[];
  selected: Set<string>;
  onToggleSection: (checked: boolean) => void;
  children: ReactNode;
}) {
  const { t } = useTranslation("admin:data");
  if (!keys.length) {
    return null;
  }
  const accentDot =
    tone === "added"
      ? "bg-emerald-500"
      : tone === "removed"
      ? "bg-rose-500"
      : tone === "updated"
      ? "bg-sky-500"
      : "bg-violet-500";

  return (
    <section className="overflow-hidden rounded-xl border border-slate-200/90 bg-white shadow-sm ring-1 ring-slate-950/5">
      <header className="flex items-center justify-between gap-3 border-b border-slate-100 bg-slate-50/90 px-4 py-2.5">
        <div className="flex min-w-0 items-center gap-2.5">
          <SectionCheckbox
            keys={keys}
            selected={selected}
            label={t("Select all in {{section}}", { section: title })}
            onChange={onToggleSection}
          />
          <span
            className={`h-2 w-2 shrink-0 rounded-full ${accentDot}`}
            aria-hidden
          />
          <h3 className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
            {title}
          </h3>
        </div>
        <span className="shrink-0 text-xs font-medium tabular-nums text-slate-700">
          {keys.length}
        </span>
      </header>
      <ul className="divide-y divide-slate-100">{children}</ul>
    </section>
  );
}

function SectionCheckbox({
  keys,
  selected,
  label,
  onChange,
}: {
  keys: string[];
  selected: Set<string>;
  label: string;
  onChange: (checked: boolean) => void;
}) {
  const ref = useRef<HTMLInputElement>(null);
  const checkedCount = keys.filter((key) => selected.has(key)).length;
  const all = keys.length > 0 && checkedCount === keys.length;
  const some = checkedCount > 0 && !all;

  useEffect(() => {
    if (ref.current) {
      ref.current.indeterminate = some;
    }
  }, [some]);

  return (
    <input
      ref={ref}
      type="checkbox"
      checked={all}
      onChange={(event) => onChange(event.target.checked)}
      aria-label={label}
      className="h-4 w-4 rounded border-gray-300 text-primary-600 focus:ring-primary-500"
    />
  );
}
