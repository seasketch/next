import { ChevronDownIcon, ChevronRightIcon } from "@heroicons/react/solid";
import { FolderIcon } from "@heroicons/react/outline";
import { Link2Icon } from "@radix-ui/react-icons";
import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import * as Popover from "@radix-ui/react-popover";
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
} from "./publishChangelogSummary";
import {
  ancestorCrumbs,
  bundleMates,
  checkableUnits,
  checkUnit,
  closureOf,
  coPublishGroup,
  CrumbSource,
  impliedCheckable,
  isPublishKind,
  isSharedSourceBundle,
  promoteImplied,
  PublishKind,
  SelectiveUnit,
  setSectionChecked,
  uncheckUnit,
} from "./selectivePublishSelection";

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
  // A cached list could offer changes that were published since, so the
  // modal always waits for the current pending items.
  const detailsQuery = useSelectivePublishDetailsQuery({
    variables: { slug },
    fetchPolicy: "network-only",
  });
  const [publish, publishState] = usePublishTableOfContentsItemsMutation({
    refetchQueries: [
      PublishedTableOfContentsDocument,
      LayersAndSourcesForItemsDocument,
      ProjectMetadataDocument,
      DraftTableOfContentsDocument,
    ],
    update: (cache) => {
      if (projectId == null) {
        return;
      }
      const id = cache.identify({ __typename: "Project", id: projectId });
      for (const fieldName of [
        "changeLogsSinceLastPublish",
        "commentsSinceLastPublish",
        "pendingPublishItems",
      ]) {
        cache.evict({ id, fieldName });
      }
      cache.gc();
    },
  });
  const [explicit, setExplicit] = useState<string[]>([]);
  const [highlighted, setHighlighted] = useState<Set<string>>(new Set());
  const [publishError, setPublishError] = useState<{
    detail?: string;
  } | null>(null);
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
    return ids;
  }, [units]);

  useEffect(() => {
    setExplicit(checkableUnits(units).map((unit) => unit.stableId));
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

  const selectedCount = explicit.length;
  const loading = detailsQuery.loading || !project;
  const lastPublished = project?.tableOfContentsLastPublished
    ? new Date(project.tableOfContentsLastPublished)
    : null;

  const flash = (ids: string[]) => {
    if (!ids.length) {
      return;
    }
    setHighlighted(new Set(ids));
  };

  const summaryByEntityId = useMemo(() => {
    const rows = new Map<number, PublishSummaryRow>();
    for (const row of [...summary.added, ...summary.updated, ...summary.removed]) {
      if (!rows.has(row.entityId)) {
        rows.set(row.entityId, row);
      }
    }
    return rows;
  }, [summary]);

  const summaryFor = (unit: SelectiveUnit): PublishSummaryRow | undefined => {
    if (unit.draftId != null) {
      const match = summaryByEntityId.get(unit.draftId);
      if (match) {
        return match;
      }
    }
    if (unit.kind !== "removed") {
      return undefined;
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
    const count = stableIds.length;
    try {
      const result = await publish({
        variables: {
          projectId,
          stableIds,
        },
      });
      if (!result.errors) {
        toast(t("Published {{count}} changes", { count }));
        onRequestClose();
      }
    } catch (error) {
      console.error(error);
      setPublishError({
        detail: error instanceof Error ? error.message : undefined,
      });
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
          label: t("Publish"),
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
                <div
                  className="rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-800"
                  role="alert"
                >
                  <p className="font-medium">
                    {t("Could not publish these changes")}
                  </p>
                  {publishError.detail ? (
                    <p className="mt-0.5 text-rose-700">
                      {publishError.detail}
                    </p>
                  ) : null}
                </div>
              ) : null}
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto px-6 py-5">
              {checkableUnits(units).length === 0 ? (
                <EmptyPendingNotice
                  orderPending={Boolean(project?.overlayOrderPending)}
                />
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
                        highlighted={highlighted}
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
                        onOpenMetadata={(tocId, initialId) =>
                          setMetadataModal({ tocId, initialId })
                        }
                        onOpenCartography={(tocId, initialId) =>
                          setCartographyModal({ tocId, initialId })
                        }
                      />
                    )
                  )}
                </div>
              )}
            </div>
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

function EmptyPendingNotice({ orderPending }: { orderPending: boolean }) {
  const { t } = useTranslation("admin:data");
  return (
    <div
      className="rounded-lg border border-gray-200 bg-gray-50 px-4 py-6 text-center text-sm text-gray-500"
      data-testid="selective-publish-empty"
    >
      {orderPending
        ? t(
            "No changes are available to selectively publish. Some changes, like to z-order or ordering in the list, must be published as a full update."
          )
        : t("The published overlay list matches the draft.")}
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
  highlighted,
  crumbsById,
  summaryFor,
  t,
  onToggleSection,
  onCheck,
  onUncheck,
  onPromote,
  onOpenMetadata,
  onOpenCartography,
}: {
  kind: PublishKind;
  title: string;
  groups: { leader: SelectiveUnit; mates: SelectiveUnit[] }[];
  units: SelectiveUnit[];
  explicit: string[];
  checkedIds: Set<string>;
  highlighted: Set<string>;
  crumbsById: Map<string, CrumbSource>;
  summaryFor: (unit: SelectiveUnit) => PublishSummaryRow | undefined;
  t: (key: string, options?: Record<string, unknown>) => string;
  onToggleSection: (checked: boolean) => void;
  onCheck: (stableId: string) => void;
  onUncheck: (stableId: string) => void;
  onPromote: (stableId: string) => void;
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
        const inside =
          group.leader.kind === "removed" ? group.mates : [];
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
              highlighted={highlighted.has(group.leader.stableId)}
              together={coPublishGroup(
                group.leader.stableId,
                explicit,
                units
              )}
              inside={inside}
              crumbs={ancestorCrumbs(
                group.leader.parentStableId,
                crumbsById
              ).filter((crumb) => !crumb.added)}
              summary={summaryFor(group.leader)}
              t={t}
              onCheck={() => onCheck(group.leader.stableId)}
              onUncheck={() => onUncheck(group.leader.stableId)}
              onPromote={() => onPromote(group.leader.stableId)}
              onOpenMetadata={onOpenMetadata}
              onOpenCartography={onOpenCartography}
            />
            {shared
              ? group.mates.map((mate) => (
                  <NestedMate
                    key={mate.stableId}
                    mate={mate}
                    together={coPublishGroup(mate.stableId, explicit, units)}
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
  together,
  inside,
  crumbs,
  summary,
  t,
  onCheck,
  onUncheck,
  onPromote,
  onOpenMetadata,
  onOpenCartography,
}: {
  unit: SelectiveUnit;
  implied: boolean;
  checked: boolean;
  highlighted: boolean;
  together: SelectiveUnit[];
  inside: SelectiveUnit[];
  crumbs: { stableId: string; title: string; added: boolean }[];
  summary?: PublishSummaryRow;
  t: (key: string, options?: Record<string, unknown>) => string;
  onCheck: () => void;
  onUncheck: () => void;
  onPromote: () => void;
  onOpenMetadata: (tocId: number, initialId?: string) => void;
  onOpenCartography: (tocId: number, initialId?: string) => void;
}) {
  // eslint-disable-next-line i18next/no-literal-string
  const inputId = `selective-publish-${unit.stableId}`;
  const removed = unit.kind === "removed";
  const linked = together.length > 1;

  return (
    <div
      className={clsx(
        "px-4 py-3.5",
        !checked && "opacity-60",
        highlighted && "bg-amber-50"
      )}
    >
      <div className="flex items-start gap-3">
        {implied ? (
          <PublishTogetherIcon group={together} onClick={onPromote} />
        ) : (
          <input
            id={inputId}
            type="checkbox"
            checked={checked}
            onChange={(event) =>
              event.target.checked ? onCheck() : onUncheck()
            }
            className="mt-1 h-4 w-4 shrink-0 rounded border-gray-300 text-primary-600 focus:ring-primary-500"
          />
        )}
        <div className="min-w-0 flex-1 space-y-1.5">
          <div className="flex flex-wrap items-center gap-2">
            {!implied && linked && inside.length === 0 ? (
              <PublishTogetherIcon group={together} />
            ) : null}
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
            {inside.length > 0 ? (
              <InsideItemsPopover
                mates={inside}
                label={t("and {{count}} items inside", {
                  count: inside.length,
                })}
              />
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
                  {crumb.title}
                </span>
              ))}
            </p>
          ) : null}
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
          ) : unit.kind === "updated" ? (
            <div className="flex flex-wrap gap-1.5 pt-1">
              <span
                className="inline-flex items-center rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-600"
                title={t(
                  "This item differs from its published copy in a way the change history does not describe."
                )}
              >
                {t("Other changes")}
              </span>
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

function PublishTogetherIcon({
  group,
  onClick,
}: {
  group: SelectiveUnit[];
  /** Replaces the checkbox on a row that was pulled in by another selection. */
  onClick?: () => void;
}) {
  const { t } = useTranslation("admin:data");
  if (!onClick && group.length < 2) {
    return null;
  }
  const names = group.map((item) => item.title).join(", ");
  const label = names
    ? t("Must be published with {{names}}", { names })
    : t("Must be published together");
  return (
    <Tooltip.Root>
      <Tooltip.Trigger asChild>
        <button
          type="button"
          className={clsx(
            "inline-flex h-5 w-5 shrink-0 items-center justify-center rounded text-sky-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-500",
            onClick ? "mt-0.5 hover:bg-sky-50" : null
          )}
          aria-label={label}
          data-together={group.map((item) => item.stableId).join(" ")}
          onClick={onClick}
        >
          <Link2Icon className="h-4 w-4" aria-hidden />
        </button>
      </Tooltip.Trigger>
      <Tooltip.Portal>
        <Tooltip.Content
          side="top"
          sideOffset={6}
          className="z-[100] max-w-xs select-none rounded-md bg-neutral-950 px-3 py-2 text-left text-xs leading-snug text-zinc-100 shadow-xl outline-none"
        >
          <p className="font-medium text-white">
            {t("Must be published together")}
          </p>
          {group.length > 0 ? (
            <ul className="mt-1 space-y-0.5 text-zinc-300">
              {group.map((item) => (
                <li key={item.stableId}>{item.title}</li>
              ))}
            </ul>
          ) : null}
          <Tooltip.Arrow className="fill-neutral-950" />
        </Tooltip.Content>
      </Tooltip.Portal>
    </Tooltip.Root>
  );
}

function InsideItemsPopover({
  mates,
  label,
}: {
  mates: SelectiveUnit[];
  label: string;
}) {
  const [open, setOpen] = useState(false);
  const closeTimer = useRef<number>();

  useEffect(() => () => window.clearTimeout(closeTimer.current), []);

  // Closing the popover returns focus to this button. A focus handler would
  // open it again, so hover uses pointer events only.
  const cancelClose = () => window.clearTimeout(closeTimer.current);
  const show = () => {
    cancelClose();
    setOpen(true);
  };
  const scheduleHide = () => {
    cancelClose();
    closeTimer.current = window.setTimeout(() => setOpen(false), 80);
  };

  return (
    <Popover.Root open={open} onOpenChange={setOpen}>
      <Popover.Trigger asChild>
        <button
          type="button"
          onPointerEnter={show}
          onPointerLeave={scheduleHide}
          className="inline-flex items-center rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-600 focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-400"
        >
          {label}
        </button>
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content
          side="top"
          align="start"
          sideOffset={8}
          collisionPadding={12}
          onPointerEnter={cancelClose}
          onPointerLeave={scheduleHide}
          onOpenAutoFocus={(event) => event.preventDefault()}
          onCloseAutoFocus={(event) => event.preventDefault()}
          className="z-[200] max-h-64 w-max max-w-xs overflow-y-auto rounded-md border border-slate-200 bg-white py-1 text-sm shadow-lg outline-none"
        >
          <ul>
            {mates.map((mate) => (
              <li
                key={mate.stableId}
                className={clsx(
                  "flex items-center gap-2 px-3 py-1.5",
                  mate.kind === "removed"
                    ? "text-slate-400 line-through"
                    : "text-slate-700"
                )}
              >
                {mate.isFolder ? (
                  <FolderIcon
                    className="h-3.5 w-3.5 flex-none text-slate-300"
                    aria-hidden
                  />
                ) : null}
                <span className="min-w-0">{mate.title}</span>
              </li>
            ))}
          </ul>
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}

function NestedMate({
  mate,
  together,
}: {
  mate: SelectiveUnit;
  together: SelectiveUnit[];
}) {
  const removed = mate.kind === "removed";
  return (
    <div className="border-t border-slate-50 bg-slate-50/40 py-2 pl-12 pr-4">
      <p
        className={clsx(
          "flex items-center gap-2 text-sm",
          removed ? "text-slate-400 line-through" : "text-slate-600"
        )}
      >
        <PublishTogetherIcon group={together} />
        {mate.isFolder ? (
          <FolderIcon
            className="h-3.5 w-3.5 flex-none text-slate-300"
            aria-hidden
          />
        ) : null}
        <span className="min-w-0">{mate.title}</span>
      </p>
    </div>
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
