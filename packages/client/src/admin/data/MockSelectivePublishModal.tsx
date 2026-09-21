import { ChevronDownIcon } from "@heroicons/react/solid";
import { FolderIcon, ViewListIcon } from "@heroicons/react/outline";
import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import * as Tooltip from "@radix-ui/react-tooltip";
import clsx from "clsx";
import { ReactNode, useEffect, useMemo, useRef, useState } from "react";
import { Trans, useTranslation } from "react-i18next";
import { useParams } from "react-router-dom";
import Modal from "../../components/Modal";
import Spinner from "../../components/Spinner";
import {
  ChangeLogFieldGroup,
  useChangeLogsSinceLastPublishQuery,
} from "../../generated/graphql";
import { CHANGE_LOG_INTRODUCTION_DATE } from "../changelogs/constants";
import {
  PublishBadge,
  SummaryMetaRow,
} from "./PublishSummarizedChangesPanel";
import LayerCartographyRevisionModal from "./LayerCartographyRevisionModal";
import LayerMetadataRevisionModal from "./LayerMetadataRevisionModal";
import {
  buildPublishChangeSummary,
  oldestChangeLogId,
  PublishSummaryRow,
  PublishZOrderSummary,
} from "./publishChangelogSummary";

const Z_ORDER_KEY = "z-order";

function rowKey(category: PublishSummaryRow["category"], entityId: number) {
  return `${category}:${entityId}`;
}

export function MockPublishSplitButton({
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

export default function MockSelectivePublishModal({
  onRequestClose,
}: {
  onRequestClose: () => void;
}) {
  const { t } = useTranslation("admin:data");
  const { t: adminT } = useTranslation("admin");
  const { slug } = useParams<{ slug: string }>();
  const changeLogsQuery = useChangeLogsSinceLastPublishQuery({
    variables: { slug },
    fetchPolicy: "cache-and-network",
  });
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [metadataModal, setMetadataModal] = useState<{
    tocId: number;
    initialId?: string;
  } | null>(null);
  const [cartographyModal, setCartographyModal] = useState<{
    tocId: number;
    initialId?: string;
  } | null>(null);

  const project = changeLogsQuery.data?.projectBySlug;
  const changeLogs = useMemo(
    () => project?.changeLogsSinceLastPublish || [],
    [project?.changeLogsSinceLastPublish]
  );
  const draftItems = useMemo(
    () => project?.draftTableOfContentsItems || [],
    [project?.draftTableOfContentsItems]
  );
  const summary = useMemo(
    () =>
      buildPublishChangeSummary({
        changeLogs,
        draftItems,
        tableOfContentsLastPublished: project?.tableOfContentsLastPublished,
      }),
    [changeLogs, draftItems, project?.tableOfContentsLastPublished]
  );

  const selectableKeys = useMemo(() => {
    const keys: string[] = [];
    for (const row of summary.added) {
      keys.push(rowKey("added", row.entityId));
    }
    for (const row of summary.updated) {
      keys.push(rowKey("updated", row.entityId));
    }
    for (const row of summary.removed) {
      keys.push(rowKey("removed", row.entityId));
    }
    if (summary.zOrderSummary) {
      keys.push(Z_ORDER_KEY);
    }
    return keys;
  }, [summary]);

  const selectableKeySignature = selectableKeys.join(",");

  useEffect(() => {
    setSelected(new Set(selectableKeys));
    // Reset whenever the real unpublished set changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectableKeySignature]);

  const selectedCount = selectableKeys.filter((key) => selected.has(key)).length;
  const loading = changeLogsQuery.loading && !changeLogsQuery.data;
  const lastPublished = project?.tableOfContentsLastPublished
    ? new Date(project.tableOfContentsLastPublished)
    : null;

  const setKeys = (keys: string[], checked: boolean) => {
    setSelected((prev) => {
      const next = new Set(prev);
      for (const key of keys) {
        if (checked) {
          next.add(key);
        } else {
          next.delete(key);
        }
      }
      return next;
    });
  };

  const toggleKey = (key: string, checked: boolean) => {
    setKeys([key], checked);
  };

  const openMetadata = (tocId: number, initialId?: string) => {
    setMetadataModal({ tocId, initialId });
  };
  const openCartography = (tocId: number, initialId?: string) => {
    setCartographyModal({ tocId, initialId });
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
          disabled: loading || selectedCount === 0,
          onClick: onRequestClose,
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
        <Tooltip.Provider delayDuration={120} skipDelayDuration={300}>
        <div className="flex min-h-0 flex-1 flex-col">
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
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto px-6 py-5">
            {selectableKeys.length === 0 ? (
              <EmptyChangelogNotice />
            ) : (
              <div className="flex flex-col gap-6 pb-1">
                <SelectableSection
                  tone="added"
                  title={adminT("Added")}
                  keys={summary.added.map((row) =>
                    rowKey("added", row.entityId)
                  )}
                  selected={selected}
                  onToggleSection={(checked) =>
                    setKeys(
                      summary.added.map((row) =>
                        rowKey("added", row.entityId)
                      ),
                      checked
                    )
                  }
                >
                  {summary.added.map((row) => (
                    <SelectableChangeRow
                      key={row.entityId}
                      row={row}
                      checked={selected.has(rowKey("added", row.entityId))}
                      onCheckedChange={(checked) =>
                        toggleKey(rowKey("added", row.entityId), checked)
                      }
                      t={t}
                      onOpenMetadata={openMetadata}
                      onOpenCartography={openCartography}
                    />
                  ))}
                </SelectableSection>

                <SelectableSection
                  tone="updated"
                  title={adminT("Updated")}
                  keys={summary.updated.map((row) =>
                    rowKey("updated", row.entityId)
                  )}
                  selected={selected}
                  onToggleSection={(checked) =>
                    setKeys(
                      summary.updated.map((row) =>
                        rowKey("updated", row.entityId)
                      ),
                      checked
                    )
                  }
                >
                  {summary.updated.map((row) => (
                    <SelectableChangeRow
                      key={row.entityId}
                      row={row}
                      checked={selected.has(rowKey("updated", row.entityId))}
                      onCheckedChange={(checked) =>
                        toggleKey(rowKey("updated", row.entityId), checked)
                      }
                      t={t}
                      onOpenMetadata={openMetadata}
                      onOpenCartography={openCartography}
                    />
                  ))}
                </SelectableSection>

                <SelectableSection
                  tone="removed"
                  title={adminT("Removed")}
                  keys={summary.removed.map((row) =>
                    rowKey("removed", row.entityId)
                  )}
                  selected={selected}
                  onToggleSection={(checked) =>
                    setKeys(
                      summary.removed.map((row) =>
                        rowKey("removed", row.entityId)
                      ),
                      checked
                    )
                  }
                >
                  {summary.removed.map((row) => (
                    <SelectableChangeRow
                      key={row.entityId}
                      row={row}
                      removed
                      checked={selected.has(rowKey("removed", row.entityId))}
                      onCheckedChange={(checked) =>
                        toggleKey(rowKey("removed", row.entityId), checked)
                      }
                      t={t}
                      onOpenMetadata={openMetadata}
                      onOpenCartography={openCartography}
                    />
                  ))}
                </SelectableSection>

                {summary.zOrderSummary ? (
                  <SelectableSection
                    tone="other"
                    title={adminT("Other Changes")}
                    keys={[Z_ORDER_KEY]}
                    selected={selected}
                    onToggleSection={(checked) => setKeys([Z_ORDER_KEY], checked)}
                  >
                    <SelectableZOrderRow
                      summary={summary.zOrderSummary}
                      checked={selected.has(Z_ORDER_KEY)}
                      onCheckedChange={(checked) =>
                        toggleKey(Z_ORDER_KEY, checked)
                      }
                      t={t}
                    />
                  </SelectableSection>
                ) : null}
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

function EmptyChangelogNotice() {
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
            {
              date: CHANGE_LOG_INTRODUCTION_DATE.toLocaleDateString(),
            }
          )
        : t(
            "No unpublished changes were found in the changelog. There may still be changes not recorded by the changelog system that need publishing."
          )}
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

function SelectableChangeRow({
  row,
  checked,
  removed,
  t,
  onCheckedChange,
  onOpenMetadata,
  onOpenCartography,
}: {
  row: PublishSummaryRow;
  checked: boolean;
  removed?: boolean;
  t: (key: string) => string;
  onCheckedChange: (checked: boolean) => void;
  onOpenMetadata: (tocId: number, initialId?: string) => void;
  onOpenCartography: (tocId: number, initialId?: string) => void;
}) {
  // eslint-disable-next-line i18next/no-literal-string
  const inputId = `selective-publish-${row.category}-${row.entityId}`;
  const metaRow = (
    <SummaryMetaRow
      editors={row.editors}
      primaryEditor={row.primaryEditor}
      changeCount={row.changeCount}
      lastChangeAt={row.lastChangeAt}
      dataLibraryTemplateId={row.dataLibraryTemplateId}
      t={t}
    />
  );

  return (
    <li className={clsx("px-4 py-3.5", !checked && "opacity-60")}>
      <div className="flex items-start gap-3">
        <input
          id={inputId}
          type="checkbox"
          checked={checked}
          onChange={(event) => onCheckedChange(event.target.checked)}
          className="mt-1 h-4 w-4 shrink-0 rounded border-gray-300 text-primary-600 focus:ring-primary-500"
        />
        <div className="min-w-0 flex-1">
          {removed ? (
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between sm:gap-6">
              <label
                htmlFor={inputId}
                className="min-w-0 cursor-pointer text-sm font-medium leading-snug text-slate-400 line-through"
              >
                {row.isFolder ? (
                  <span className="inline-flex min-w-0 items-center gap-2">
                    <FolderIcon
                      className="h-4 w-4 flex-none text-slate-300"
                      aria-hidden
                    />
                    <span className="min-w-0 truncate">{row.title}</span>
                  </span>
                ) : (
                  <span className="min-w-0 truncate">{row.title}</span>
                )}
              </label>
              <div className="shrink-0 sm:text-right">{metaRow}</div>
            </div>
          ) : (
            <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between lg:gap-8">
              <div className="min-w-0 flex-1 space-y-2">
                <label
                  htmlFor={inputId}
                  className="cursor-pointer text-base font-semibold leading-snug text-slate-900"
                >
                  {row.isFolder ? (
                    <span className="inline-flex min-w-0 items-center gap-2">
                      <FolderIcon
                        className="h-[1.125rem] w-[1.125rem] flex-none text-slate-400"
                        aria-hidden
                      />
                      <span className="min-w-0">{row.title}</span>
                    </span>
                  ) : (
                    <span className="min-w-0">{row.title}</span>
                  )}
                </label>
                {metaRow}
              </div>
              {row.badges.length > 0 ? (
                <div className="flex shrink-0 flex-wrap gap-1.5 lg:max-w-[min(24rem,48%)] lg:justify-end lg:pt-0.5">
                  {row.badges.map((badge) => (
                    <PublishBadge
                      key={badge.key}
                      badgeKey={badge.key}
                      logs={badge.logs}
                      t={t}
                      isFolder={row.isFolder}
                      tableOfContentsItemId={row.entityId}
                      dataLibraryTemplateId={row.dataLibraryTemplateId}
                      onOpenMetadata={() =>
                        onOpenMetadata(
                          row.entityId,
                          oldestChangeLogId(
                            badge.logs,
                            ChangeLogFieldGroup.LayerMetadata
                          )
                        )
                      }
                      onOpenCartography={() =>
                        onOpenCartography(
                          row.entityId,
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
          )}
        </div>
      </div>
    </li>
  );
}

function SelectableZOrderRow({
  summary,
  checked,
  t,
  onCheckedChange,
}: {
  summary: PublishZOrderSummary;
  checked: boolean;
  t: (key: string) => string;
  onCheckedChange: (checked: boolean) => void;
}) {
  // eslint-disable-next-line i18next/no-literal-string
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
                <Trans ns="admin:data">Layer z-order stacking updated</Trans>
              </span>
            </span>
          </label>
          <p className="text-sm text-slate-500">
            <Trans ns="admin:data">
              Publish the current overlay list order without publishing other
              selected layer changes.
            </Trans>
          </p>
          <SummaryMetaRow
            editors={summary.editors}
            primaryEditor={summary.primaryEditor}
            changeCount={summary.changeCount}
            lastChangeAt={summary.lastChangeAt}
            t={t}
          />
        </div>
      </div>
    </li>
  );
}
