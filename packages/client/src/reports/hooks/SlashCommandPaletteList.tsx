/* eslint-disable i18next/no-literal-string */
import React, {
  RefObject,
  memo,
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { VariableSizeList, ListChildComponentProps } from "react-window";
import AutoSizer from "react-virtualized-auto-sizer";
import * as Popover from "@radix-ui/react-popover";
import { ChevronRightIcon } from "@radix-ui/react-icons";
import { EditorView } from "prosemirror-view";
import { CommandPaletteItem } from "../commandPalette/types";

/** Large overlay-widget group — may contain hundreds of layers. */
export const OVERLAY_WIDGETS_GROUP_ID = "layer-overlay-analysis";

export const VIRTUAL_LIST_COMMAND_THRESHOLD = 36;

export const DEFER_HEAVY_ROW_THRESHOLD = 48;

const HEADER_ROW_HEIGHT = 44;
const COMMAND_ROW_HEIGHT = 40;

export type CommandPalettePreviewItem = CommandPaletteItem & {
  screenshotSrc?: string;
  screenshotAlt?: string;
  muted?: boolean;
  activateOnHover?: boolean;
  popoverHeader?: React.ReactNode;
  popoverStatus?: React.ReactNode;
  popoverFooter?: React.ReactNode;
  children?: CommandPalettePreviewItem[];
  childGroups?: {
    id: string;
    label: string;
    items: CommandPalettePreviewItem[];
  }[];
};

export type SubmenuNav = {
  parentKey: string;
  flatChildren: CommandPalettePreviewItem[];
  activeChildIndex: number;
  hasFooter: boolean;
} | null;

export type PaletteEntry =
  | {
      type: "header";
      key: string;
      label: string;
      showSectionBorder: boolean;
    }
  | {
      type: "item";
      key: string;
      flatIndex: number;
      groupId: string;
      item: CommandPalettePreviewItem;
    };

export function buildPaletteEntries(
  groups: { id: string; label: string; items: CommandPalettePreviewItem[] }[]
): PaletteEntry[] {
  const out: PaletteEntry[] = [];
  for (let gi = 0; gi < groups.length; gi++) {
    const group = groups[gi];
    const showSectionBorder = gi < groups.length - 1;
    out.push({
      type: "header",
      key: `header-${group.id}`,
      label: group.label,
      showSectionBorder,
    });
    let fi = 0;
    for (let j = 0; j < gi; j++) {
      fi += groups[j].items.length;
    }
    for (const item of group.items) {
      out.push({
        type: "item",
        key: `item-${group.id}:${item.id}`,
        flatIndex: fi,
        groupId: group.id,
        item,
      });
      fi++;
    }
  }
  return out;
}

export function virtualIndexForFlatIndex(
  entries: PaletteEntry[],
  flatIndex: number
): number {
  for (let i = 0; i < entries.length; i++) {
    const e = entries[i];
    if (e.type === "item" && e.flatIndex === flatIndex) {
      return i;
    }
  }
  return -1;
}

export function flattenPaletteChildren(
  item: CommandPalettePreviewItem
): CommandPalettePreviewItem[] {
  const result: CommandPalettePreviewItem[] = [...(item.children || [])];
  if (item.childGroups) {
    for (const g of item.childGroups) {
      result.push(...g.items);
    }
  }
  return result;
}

export function shouldDeferHeavyPaletteChrome(
  groupId: string,
  totalCommands: number
): boolean {
  return (
    groupId === OVERLAY_WIDGETS_GROUP_ID &&
    totalCommands >= DEFER_HEAVY_ROW_THRESHOLD
  );
}

function ChildItemWithPreview({
  child,
  onApply,
  isKeyboardActive,
  onMouseEnter,
}: {
  child: CommandPalettePreviewItem;
  onApply: () => void;
  isKeyboardActive?: boolean;
  onMouseEnter?: () => void;
}) {
  const [hovered, setHovered] = useState(false);
  const showPreview = hovered || !!isKeyboardActive;
  const hasPreview = !!(child.screenshotSrc || child.description);
  const btnRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (isKeyboardActive) {
      btnRef.current?.scrollIntoView({ block: "nearest" });
    }
  }, [isKeyboardActive]);

  return (
    <Popover.Root modal={false} open={showPreview && hasPreview}>
      <Popover.Anchor asChild>
        <button
          ref={btnRef}
          type="button"
          className={`w-full px-3 py-1.5 text-left text-sm font-medium transition-colors ${
            isKeyboardActive
              ? "bg-blue-50 text-blue-900"
              : "text-gray-900 hover:bg-gray-50"
          }`}
          onClick={(e) => {
            e.preventDefault();
            onApply();
          }}
          onMouseEnter={() => {
            setHovered(true);
            onMouseEnter?.();
          }}
          onMouseLeave={() => setHovered(false)}
        >
          {child.label}
        </button>
      </Popover.Anchor>
      {hasPreview && showPreview && (
        <Popover.Portal>
          <Popover.Content
            side="right"
            align="center"
            sideOffset={8}
            collisionPadding={16}
            avoidCollisions
            data-report-command-palette-flyout="true"
            className="z-[60] outline-none focus:outline-none pointer-events-none"
            onOpenAutoFocus={(e) => e.preventDefault()}
            onCloseAutoFocus={(e) => e.preventDefault()}
          >
            <div className="w-56 rounded-lg border border-gray-700 bg-gray-800 shadow-xl overflow-hidden">
              {child.screenshotSrc && (
                <div className="p-3 pb-2">
                  <div
                    className="h-20 w-full overflow-hidden rounded bg-gray-700"
                    role="img"
                    aria-label={child.screenshotAlt || `${child.label} preview`}
                    style={{
                      backgroundImage: `url(${child.screenshotSrc})`,
                      backgroundSize: "cover",
                      backgroundPosition: "top",
                      backgroundRepeat: "no-repeat",
                    }}
                  />
                </div>
              )}
              {child.description && (
                <div className={child.screenshotSrc ? "px-3 pb-3" : "p-3"}>
                  <div className="text-xs text-gray-300 whitespace-pre-line">
                    {child.description}
                  </div>
                </div>
              )}
            </div>
          </Popover.Content>
        </Popover.Portal>
      )}
    </Popover.Root>
  );
}

export type PaletteRowSharedProps = {
  viewRef: RefObject<EditorView | undefined>;
  itemRefs: React.MutableRefObject<Map<string, HTMLButtonElement | null>>;
  footerRef: React.RefObject<HTMLDivElement>;
  submenuNav: SubmenuNav;
  previewKey: string | null;
  activatedKey: string | null;
  SHOW_PREVIEW_ON_KEYBOARD_FOCUS: boolean;
  applyCommand: (item?: CommandPaletteItem) => void;
  enterSubmenu: (item: CommandPalettePreviewItem, key: string) => void;
  setPreviewKey: (k: string | null) => void;
  setActivatedKey: (k: string | null) => void;
  setSubmenuNav: React.Dispatch<React.SetStateAction<SubmenuNav>>;
  setActiveIndex: React.Dispatch<React.SetStateAction<number>>;
  renderStatusIcon: (status?: CommandPaletteItem["status"]) => React.ReactNode;
  ensureRowHydrated: (refKey: string) => void;
};

type PopoverRowOuterProps = {
  groupId: string;
  previewItem: CommandPalettePreviewItem;
  itemIndex: number;
  refKey: string;
  isActive: boolean;
  useLiteRow: boolean;
  totalFlatCommands: number;
  shared: PaletteRowSharedProps;
};

const PalettePopoverRow = memo(function PalettePopoverRow(
  props: PopoverRowOuterProps
) {
  const {
    groupId,
    previewItem,
    itemIndex,
    refKey,
    isActive,
    useLiteRow,
    totalFlatCommands,
    shared,
  } = props;
  const {
    viewRef,
    itemRefs,
    footerRef,
    submenuNav,
    previewKey,
    activatedKey,
    SHOW_PREVIEW_ON_KEYBOARD_FOCUS,
    applyCommand,
    enterSubmenu,
    setPreviewKey,
    setActivatedKey,
    setSubmenuNav,
    setActiveIndex,
    renderStatusIcon,
    ensureRowHydrated,
  } = shared;

  const hasChildren =
    !!previewItem.children?.length ||
    !!previewItem.childGroups?.length ||
    !!previewItem.customPopoverContent;
  const isActivated = activatedKey === refKey;
  const isDisabled = previewItem.disabled;
  const isMuted = previewItem.muted;
  const inlineStatus = renderStatusIcon(previewItem.status);

  const closePopover = () => {
    setPreviewKey(null);
    setActivatedKey(null);
    setSubmenuNav(null);
  };
  const focusPalette = () => viewRef.current?.focus();

  const showKeyboardPreview =
    SHOW_PREVIEW_ON_KEYBOARD_FOCUS &&
    isActive &&
    !hasChildren &&
    !submenuNav &&
    !!(previewItem.screenshotSrc || previewItem.description);

  useEffect(() => {
    if (isActive || previewKey === refKey || activatedKey === refKey) {
      ensureRowHydrated(refKey);
    }
  }, [isActive, previewKey, activatedKey, refKey, ensureRowHydrated]);

  const deferHeavy =
    shouldDeferHeavyPaletteChrome(groupId, totalFlatCommands) && useLiteRow;

  useEffect(() => {
    if (submenuNav?.parentKey === refKey) {
      ensureRowHydrated(refKey);
    }
  }, [submenuNav?.parentKey, refKey, ensureRowHydrated]);

  const setBtnRef = (el: HTMLButtonElement | null) => {
    if (el) {
      itemRefs.current.set(refKey, el);
    } else {
      itemRefs.current.delete(refKey);
    }
  };

  if (deferHeavy) {
    return (
      <div className="w-full">
        <button
          type="button"
          ref={setBtnRef}
          className={`w-full px-3 py-1.5 text-left transition-colors ${
            isActive
              ? isMuted
                ? "bg-gray-100 text-gray-500"
                : "bg-blue-50 text-blue-900"
              : isMuted
              ? "text-gray-400 hover:bg-gray-50"
              : "hover:bg-gray-50 text-gray-900"
          } ${isDisabled ? "opacity-60 cursor-not-allowed" : ""}`}
          disabled={isDisabled}
          onClick={(e) => {
            e.preventDefault();
            if (isDisabled) return;
            ensureRowHydrated(refKey);
            if (hasChildren) {
              enterSubmenu(previewItem, refKey);
            } else {
              applyCommand(previewItem);
            }
          }}
          onMouseEnter={() => {
            ensureRowHydrated(refKey);
            setActiveIndex(itemIndex);
            setPreviewKey(refKey);
            setSubmenuNav(null);
            if (previewItem.activateOnHover && hasChildren) {
              setActivatedKey(refKey);
            } else {
              setActivatedKey(null);
            }
          }}
          onFocus={() => {
            ensureRowHydrated(refKey);
            if (hasChildren) {
              setActiveIndex(itemIndex);
              setPreviewKey(refKey);
            }
          }}
        >
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2 min-w-0">
              {previewItem.icon ? (
                <span className="text-gray-500 flex-shrink-0">
                  {previewItem.icon}
                </span>
              ) : null}
              <span className="text-sm truncate">{previewItem.label}</span>
            </div>
            <div className="flex items-center gap-1 flex-shrink-0">
              {!previewItem.activateOnHover && inlineStatus}
              {hasChildren && (
                <ChevronRightIcon className="w-4 h-4 text-gray-400" />
              )}
            </div>
          </div>
        </button>
      </div>
    );
  }

  return (
    <Popover.Root
      modal={false}
      open={previewKey === refKey || showKeyboardPreview}
      onOpenChange={(open) => {
        if (!open) setPreviewKey(null);
      }}
    >
      <Popover.Anchor asChild>
        <button
          type="button"
          ref={setBtnRef}
          className={`w-full px-3 py-1.5 text-left transition-colors ${
            isActive
              ? isMuted
                ? "bg-gray-100 text-gray-500"
                : "bg-blue-50 text-blue-900"
              : isMuted
              ? "text-gray-400 hover:bg-gray-50"
              : "hover:bg-gray-50 text-gray-900"
          } ${isDisabled ? "opacity-60 cursor-not-allowed" : ""}`}
          disabled={isDisabled}
          onClick={(e) => {
            e.preventDefault();
            if (isDisabled) return;
            if (hasChildren) {
              enterSubmenu(previewItem, refKey);
            } else {
              applyCommand(previewItem);
            }
          }}
          onMouseEnter={() => {
            setActiveIndex(itemIndex);
            setPreviewKey(refKey);
            setSubmenuNav(null);
            if (previewItem.activateOnHover && hasChildren) {
              setActivatedKey(refKey);
            } else {
              setActivatedKey(null);
            }
          }}
          onFocus={() => {
            if (hasChildren) {
              setActiveIndex(itemIndex);
              setPreviewKey(refKey);
            }
          }}
        >
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2 min-w-0">
              {previewItem.icon ? (
                <span className="text-gray-500 flex-shrink-0">
                  {previewItem.icon}
                </span>
              ) : null}
              <span className="text-sm truncate">{previewItem.label}</span>
            </div>
            <div className="flex items-center gap-1 flex-shrink-0">
              {!previewItem.activateOnHover && inlineStatus}
              {hasChildren && (
                <ChevronRightIcon className="w-4 h-4 text-gray-400" />
              )}
            </div>
          </div>
        </button>
      </Popover.Anchor>
      {/* Portal so Content escapes react-window row transforms + list overflow (Radix Content is not portaled by default). */}
      <Popover.Portal>
        <Popover.Content
          side="right"
          align="center"
          sideOffset={12}
          collisionPadding={12}
          className="z-[60] outline-none focus:outline-none"
          data-popover-content
          data-report-command-palette-flyout="true"
        onOpenAutoFocus={(event) => {
          event.preventDefault();
          viewRef.current?.focus();
        }}
        onCloseAutoFocus={(event) => {
          event.preventDefault();
          viewRef.current?.focus();
        }}
        onMouseEnter={() => setPreviewKey(refKey)}
        onMouseLeave={(event) => {
          const relatedTarget = event.relatedTarget as HTMLElement;
          if (relatedTarget?.closest?.("[data-popover-content]")) {
            return;
          }
          setPreviewKey(null);
        }}
      >
        <div data-popover-content>
          {(() => {
            if (isActivated && previewItem.customPopoverContent) {
              return previewItem.customPopoverContent({
                closePopover: () => {
                  closePopover();
                },
                focusPalette,
                apply: applyCommand,
              });
            }
            if (isActivated && hasChildren) {
              return (
                <div className="w-64 rounded-md border border-gray-200 bg-white shadow-xl">
                  <div className="px-3 py-2.5 border-b border-gray-100">
                    <div className="text-sm font-semibold text-gray-800">
                      {previewItem.label}
                    </div>
                    {previewItem.popoverHeader}
                    {previewItem.popoverStatus}
                    {previewItem.description ? (
                      <div className="mt-1 text-xs text-gray-600">
                        {previewItem.description}
                      </div>
                    ) : null}
                  </div>
                  {previewItem.children?.length ? (
                    <div className="py-1">
                      {previewItem.children.map((child, ci) => (
                        <ChildItemWithPreview
                          key={child.id}
                          child={child}
                          isKeyboardActive={
                            submenuNav?.parentKey === refKey &&
                            submenuNav?.flatChildren[submenuNav.activeChildIndex]
                              ?.id === child.id
                          }
                          onMouseEnter={() => {
                            if (submenuNav?.parentKey === refKey) {
                              setSubmenuNav((prev) =>
                                prev
                                  ? { ...prev, activeChildIndex: ci }
                                  : prev
                              );
                            }
                          }}
                          onApply={() => {
                            applyCommand(child);
                            setPreviewKey(null);
                            setSubmenuNav(null);
                          }}
                        />
                      ))}
                    </div>
                  ) : null}
                  {previewItem.childGroups
                    ? previewItem.childGroups.map((grp) => {
                        const groupStartIndex =
                          (previewItem.children?.length ?? 0) +
                          (previewItem.childGroups ?? [])
                            .slice(
                              0,
                              previewItem.childGroups!.indexOf(grp)
                            )
                            .reduce((sum, g) => sum + g.items.length, 0);
                        return (
                          <div key={grp.id}>
                            <div className="px-3 pt-2 pb-1 text-[11px] font-medium text-gray-400 tracking-wide uppercase">
                              {grp.label}
                            </div>
                            <div className="pb-1">
                              {grp.items.map((child, ci) => (
                                <ChildItemWithPreview
                                  key={child.id}
                                  child={child}
                                  isKeyboardActive={
                                    submenuNav?.parentKey === refKey &&
                                    submenuNav?.flatChildren[
                                      submenuNav.activeChildIndex
                                    ]?.id === child.id
                                  }
                                  onMouseEnter={() => {
                                    if (submenuNav?.parentKey === refKey) {
                                      setSubmenuNav((prev) =>
                                        prev
                                          ? {
                                              ...prev,
                                              activeChildIndex:
                                                groupStartIndex + ci,
                                            }
                                          : prev
                                      );
                                    }
                                  }}
                                  onApply={() => {
                                    applyCommand(child);
                                    setPreviewKey(null);
                                    setSubmenuNav(null);
                                  }}
                                />
                              ))}
                            </div>
                          </div>
                        );
                      })
                    : null}
                  {previewItem.popoverFooter &&
                    (() => {
                      const isFooterActive =
                        submenuNav?.parentKey === refKey &&
                        submenuNav?.hasFooter &&
                        submenuNav.activeChildIndex >=
                          submenuNav.flatChildren.length;
                      return (
                        <div
                          ref={
                            submenuNav?.parentKey === refKey
                              ? footerRef
                              : undefined
                          }
                          className={
                            isFooterActive
                              ? "ring-2 ring-blue-500 ring-inset rounded-b-md"
                              : ""
                          }
                          onMouseEnter={() => {
                            if (
                              submenuNav?.parentKey === refKey &&
                              submenuNav?.hasFooter
                            ) {
                              setSubmenuNav((prev) =>
                                prev
                                  ? {
                                      ...prev,
                                      activeChildIndex: prev.flatChildren.length,
                                    }
                                  : prev
                              );
                            }
                          }}
                        >
                          {previewItem.popoverFooter}
                        </div>
                      );
                    })()}
                </div>
              );
            }
            if (previewItem.muted) {
              return (
                <div className="w-56 rounded-md border border-gray-200 bg-white shadow-lg overflow-hidden p-3">
                  <p className="text-xs text-gray-500">
                    {previewItem.description ||
                      "Not yet processed for reporting."}
                  </p>
                </div>
              );
            }
            return (
              <div className="w-56 rounded-lg outline-none border border-gray-700 bg-gray-800 shadow-xl focus:outline-none ring-0 overflow-hidden">
                <div className="p-3 pb-2">
                  <div
                    className="h-20 w-full overflow-hidden rounded bg-gray-700"
                    role="img"
                    aria-label={
                      previewItem.screenshotSrc
                        ? previewItem.screenshotAlt ||
                          `${previewItem.label} preview`
                        : undefined
                    }
                    style={
                      previewItem.screenshotSrc
                        ? {
                            backgroundImage: `url(${previewItem.screenshotSrc})`,
                            backgroundSize: "cover",
                            backgroundPosition: "center",
                            backgroundRepeat: "no-repeat",
                          }
                        : undefined
                    }
                  >
                    {!previewItem.screenshotSrc && (
                      <div className="flex h-full w-full items-center justify-center text-xs text-gray-500">
                        Screenshot coming soon
                      </div>
                    )}
                  </div>
                </div>
                <div className="px-3 pb-3">
                  <div className="text-xs text-gray-300 whitespace-pre-line">
                    {previewItem.description ||
                      "No description provided yet."}
                  </div>
                </div>
              </div>
            );
          })()}
        </div>
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
});

export type SlashCommandPaletteListProps = {
  filteredGroups: {
    id: string;
    label: string;
    items: CommandPalettePreviewItem[];
  }[];
  flatItemsLength: number;
  activeIndex: number;
  paletteMaxHeight: number;
  listContainerRef: React.RefObject<HTMLDivElement>;
  virtualListRef: React.RefObject<
    VariableSizeList<SlashCommandPaletteVirtualItemData>
  >;
  itemRefs: React.MutableRefObject<Map<string, HTMLButtonElement | null>>;
  footerRef: React.RefObject<HTMLDivElement>;
  /** Keys explicitly hydrated (full row); lite placeholders otherwise for heavy overlay group. */
  hydratedKeyVersion: number;
  hydratedKeysRef: React.MutableRefObject<Set<string>>;
  ensureRowHydrated: (refKey: string) => void;
  shared: PaletteRowSharedProps;
};

export type SlashCommandPaletteVirtualItemData = SlashCommandPaletteListProps & {
  filteredEntries: PaletteEntry[];
};

function VirtualPaletteRow({
  index,
  style,
  data,
}: ListChildComponentProps<SlashCommandPaletteVirtualItemData>) {
  const entry = data.filteredEntries[index];
  if (!entry) {
    return <div style={style} />;
  }
  if (entry.type === "header") {
    return (
      <div style={style}>
        <div
          className={
            entry.showSectionBorder
              ? "border-b border-gray-100 pt-1 pb-2"
              : "pt-1 pb-2"
          }
        >
          <div className="px-3 pt-2 pb-2 text-xs font-semibold text-gray-500">
            {entry.label}
          </div>
        </div>
      </div>
    );
  }

  const previewItem = entry.item;
  const refKey = `${entry.groupId}:${previewItem.id}`;
  const isActive = entry.flatIndex === data.activeIndex;
  const hydrated = data.hydratedKeysRef.current.has(refKey);
  const useLiteRow =
    shouldDeferHeavyPaletteChrome(entry.groupId, data.flatItemsLength) &&
    !hydrated;

  return (
    <div style={style} className="w-72 box-border">
      <PalettePopoverRow
        groupId={entry.groupId}
        previewItem={previewItem}
        itemIndex={entry.flatIndex}
        refKey={refKey}
        isActive={isActive}
        useLiteRow={useLiteRow}
        totalFlatCommands={data.flatItemsLength}
        shared={data.shared}
      />
    </div>
  );
}

export function SlashCommandPaletteVirtualList(
  props: SlashCommandPaletteListProps
) {
  const {
    filteredGroups,
    flatItemsLength,
    activeIndex,
    paletteMaxHeight,
    listContainerRef,
    virtualListRef,
    hydratedKeyVersion,
  } = props;

  const filteredEntries = useMemo(
    () => buildPaletteEntries(filteredGroups),
    [filteredGroups]
  );

  const getItemSize = useCallback(
    (index: number) => {
      const e = filteredEntries[index];
      if (!e) return COMMAND_ROW_HEIGHT;
      return e.type === "header" ? HEADER_ROW_HEIGHT : COMMAND_ROW_HEIGHT;
    },
    [filteredEntries]
  );

  const itemData: SlashCommandPaletteVirtualItemData = useMemo(
    () => ({
      ...props,
      filteredEntries,
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps -- intentional: refresh row cells when hydration/version changes
    [
      props.filteredGroups,
      props.flatItemsLength,
      props.activeIndex,
      props.paletteMaxHeight,
      props.hydratedKeyVersion,
      props.shared,
      filteredEntries,
    ]
  );

  useLayoutEffect(() => {
    virtualListRef.current?.resetAfterIndex(0);
  }, [filteredEntries, virtualListRef, hydratedKeyVersion]);

  useLayoutEffect(() => {
    if (flatItemsLength === 0) return;
    const v = virtualIndexForFlatIndex(filteredEntries, activeIndex);
    if (v >= 0) {
      virtualListRef.current?.scrollToItem(v, "smart");
    }
  }, [activeIndex, flatItemsLength, filteredEntries, virtualListRef]);

  return (
    <div
      ref={listContainerRef}
      className="w-72 overflow-hidden rounded-md border border-gray-200 bg-white shadow-xl"
      style={{ height: paletteMaxHeight }}
    >
      <AutoSizer>
        {({ height, width }) => (
          <VariableSizeList<SlashCommandPaletteVirtualItemData>
            ref={virtualListRef}
            height={height}
            width={width}
            itemCount={filteredEntries.length}
            itemSize={getItemSize}
            itemData={itemData}
            overscanCount={10}
          >
            {VirtualPaletteRow}
          </VariableSizeList>
        )}
      </AutoSizer>
    </div>
  );
}

export function SlashCommandPaletteSimpleList(
  props: Pick<
    SlashCommandPaletteListProps,
    | "filteredGroups"
    | "flatItemsLength"
    | "activeIndex"
    | "hydratedKeysRef"
    | "ensureRowHydrated"
    | "shared"
  >
) {
  const {
    filteredGroups,
    flatItemsLength,
    activeIndex,
    hydratedKeysRef,
    ensureRowHydrated,
    shared,
  } = props;

  return (
    <>
      {filteredGroups.map((group, groupIdx) => (
        <div
          key={group.id}
          className={
            groupIdx < filteredGroups.length - 1
              ? "border-b border-gray-100 pt-1 pb-2"
              : ""
          }
        >
          <div className="px-3 pt-2 pb-2 text-xs font-semibold text-gray-500">
            {group.label}
          </div>
          {group.items.map((item, itemIdx) => {
            const previewItem = item as CommandPalettePreviewItem;
            const refKey = `${group.id}:${previewItem.id}`;
            let fi = 0;
            for (let i = 0; i < groupIdx; i++) {
              fi += filteredGroups[i].items.length;
            }
            fi += itemIdx;
            const isActive = fi === activeIndex;
            const hydrated = hydratedKeysRef.current.has(refKey);
            const useLiteRow =
              shouldDeferHeavyPaletteChrome(group.id, flatItemsLength) &&
              !hydrated;

            return (
              <PalettePopoverRow
                key={refKey}
                groupId={group.id}
                previewItem={previewItem}
                itemIndex={fi}
                refKey={refKey}
                isActive={isActive}
                useLiteRow={useLiteRow}
                totalFlatCommands={flatItemsLength}
                shared={shared}
              />
            );
          })}
        </div>
      ))}
    </>
  );
}
