import {
  useMemo,
  useCallback,
  useState,
  useEffect,
  useContext,
  ReactNode,
  useRef,
} from "react";
import { MapContext } from "../dataLayers/MapContextManager";
import { OverlayFragment } from "../generated/graphql";
import TreeItemComponent, {
  SortingState,
} from "../projects/Sketches/TreeItemComponent";
import useLocalStorage from "../useLocalStorage";
import ContextMenuDropdown, {
  DropdownDividerProps,
} from "./ContextMenuDropdown";
import { DropdownOption } from "./DropdownButton";
import { useTranslatedProps } from "./TranslatedPropControl";
import * as ContextMenu from "@radix-ui/react-context-menu";
require("../admin/data/GLStyleEditor/RadixDropdown.css");

export interface TreeItemHighlights {
  title?: string;
  metadata?: string;
}
export interface TreeItem {
  id: string;
  /** label shown in tree */
  title: string;
  parentId?: string | null;
  /** If false, will be treated as a folder or collection */
  isLeaf: boolean;
  /** If enabled, cannot be used to turn on checkbox for children */
  checkOffOnly?: boolean;
  /** Only allow one child to be selected at a time */
  radioFolder?: boolean;
  /** Will appear as a leaf node */
  hideChildren?: boolean;
  /** Used for drag & drop */
  type: string;
  /** References TreeItem.type */
  dropAcceptsTypes?: string[];
  bbox?: number[];
}

interface TreeViewProps {
  /** Items to display in the tree */
  items: TreeItem[];
  /** Defaults to false */
  multipleSelect?: boolean;
  ariaLabel: string;
  /** Array of string IDs to select. Acts as a controlled component */
  selection?: string[];
  /** Array of string IDs to expand (if children are present). Acts as a controlled component */
  expanded?: string[];
  /** Items that should be checked. Mostly for map viewers */
  checkedItems?: string[];
  /** Items that are loading. Mostly for map viewers */
  loadingItems?: string[];
  /** Errors to display for items, keyed by id */
  errors?: { [id: string]: string };
  /* Should update selection prop */
  onSelect?: (metaKey: boolean, node: TreeItem, isSelected: boolean) => void;
  /* Should update expanded prop */
  onExpand?: (node: TreeItem, isExpanded: boolean) => void;
  onChecked?: (ids: string[], isChecked: boolean) => void;
  clearSelection?: () => void;
  onDragEnd?: (items: TreeItem[]) => void;
  onDropEnd?: (item: TreeItem) => void;
  onDrop?: (item: TreeItem, target: TreeItem) => void;
  /** Amount of padding to give child lists. Defaults to 35px */
  childGroupPadding?: number;
  disableEditing?: boolean;
  hideCheckboxes?: boolean;
  temporarilyHighlightedIds?: string[];
  getContextMenuItems?: (
    item: TreeItem
  ) => (DropdownOption | DropdownDividerProps)[];
  sortable?: boolean;
  onSortEnd?: (
    draggable: TreeItem,
    target: TreeItem,
    state: SortingState
  ) => void;
  getContextMenuContent?: (id: string, event: React.MouseEvent) => ReactNode;
  hiddenItems?: string[];
  onUnhide?: (stableId: string) => void;
  highlights?: { [id: string]: TreeItemHighlights };
  showContextMenuButtons?: (node: TreeItem) => boolean;
}

export interface TreeNodeComponentProps {
  highlights?: { [id: string]: TreeItemHighlights };
  node: TreeItem;
  numChildren: number;
  onSelect?: (metaKey: boolean, node: TreeItem, isSelected: boolean) => void;
  onExpand?: (node: TreeItem, isExpanded: boolean) => void;
  children?: TreeNode[];
  isSelected: boolean;
  isExpanded: boolean;
  level: number;
  isContextMenuTarget: boolean;
  onContextMenu?: (
    node: TreeItem,
    target: HTMLElement,
    offsetX: number,
    clickEvent: React.MouseEvent
  ) => void;
  updateContextMenuTargetRef: (el: HTMLElement) => void;
  onDragEnd?: (items: TreeItem[]) => void;
  onDropEnd?: (item: TreeItem) => void;
  onChecked?: (
    node: TreeItem,
    isChecked: boolean,
    children?: TreeNode[]
  ) => void;
  checked: CheckState;
  isLoading: boolean;
  disableEditing: boolean;
  hideCheckboxes: boolean;
  highlighted: boolean;
  parentIsRadioFolder: boolean;
  error: string | null;
  clearSelection?: () => void;
  childGroupPadding?: number;
  parents: string[];
  onDrop?: (item: TreeItem, target: TreeItem) => void;
  sortable: boolean;
  index: number;
  nextSiblingId?: string;
  previousSiblingId?: string;
  onSortEnd?: (
    draggable: TreeItem,
    target: TreeItem,
    state: SortingState
  ) => void;
  allowContextMenuDefault?: boolean;
  isHidden: boolean;
  onUnhide?: (stableId: string) => void;
  showContextMenuButtons?: (node: TreeItem) => boolean;
}
export enum CheckState {
  CHECKED,
  PARTIAL,
  UNCHECKED,
}

export interface TreeNode {
  isSelected: boolean;
  isExpanded: boolean;
  node: TreeItem;
  level: number;
  children: TreeNode[];
  isContextMenuTarget: boolean;
  checked: CheckState;
  loading: boolean;
  isLeaf: boolean;
  highlighted: boolean;
  parentIsRadioFolder: boolean;
  radioFolder: boolean;
  error?: string;
  parents: string[];
  hidden: boolean;
}

export default function TreeView({
  onSelect,
  onExpand,
  clearSelection,
  onDragEnd,
  onDropEnd,
  childGroupPadding,
  checkedItems,
  loadingItems,
  onChecked,
  disableEditing,
  hideCheckboxes,
  getContextMenuItems,
  onDrop,
  sortable,
  onSortEnd,
  showContextMenuButtons,
  ...props
}: TreeViewProps) {
  const treeRef = useRef<HTMLDivElement>(null);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (!treeRef.current) return;

    if (e.key === "Home") {
      const firstItem = treeRef.current.querySelector('[role="treeitem"]');
      if (firstItem instanceof HTMLElement) {
        firstItem.focus();
        e.preventDefault();
      }
    } else if (e.key === "End") {
      const items = treeRef.current.querySelectorAll('[role="treeitem"]');
      const lastItem = items[items.length - 1];
      if (lastItem instanceof HTMLElement) {
        lastItem.focus();
        e.preventDefault();
      }
    }
  }, []);

  const [contextMenu, setContextMenu] = useState<
    | {
        id: string;
        target: HTMLElement;
        offsetX: number;
        clickEvent: React.MouseEvent;
      }
    | undefined
  >();

  const [contextMenuOptions, setContextMenuOptions] = useState<
    (DropdownOption | DropdownDividerProps)[]
  >([]);

  useEffect(() => {
    if (getContextMenuItems) {
      const onClick = () => setContextMenu(undefined);
      if (contextMenu) {
        document.addEventListener("click", onClick);
        return () => document.removeEventListener("click", onClick);
      }
    }
  }, [setContextMenu, contextMenu]);

  const data = useMemo(() => {
    const nodesById = props.items.reduce((map, item) => {
      const node = {
        isExpanded: props.expanded
          ? props.expanded.indexOf(item.id) !== -1
          : false,
        isSelected: props.selection
          ? props.selection.indexOf(item.id) !== -1
          : false,
        node: item,
        level: 1,
        children: [],
        isContextMenuTarget: contextMenu?.id === item.id,
        checked: Boolean(
          item.isLeaf && checkedItems && checkedItems?.indexOf(item.id) !== -1
        )
          ? CheckState.CHECKED
          : CheckState.UNCHECKED,
        loading:
          Boolean(loadingItems?.length) &&
          loadingItems?.indexOf(item.id) !== -1,
        isLeaf: item.isLeaf,
        checkOffOnly: item.checkOffOnly,
        radioFolder: item.radioFolder,
        hideChildren: item.hideChildren,
        error: props.errors ? props.errors[item.id] : undefined,
        highlighted: props.temporarilyHighlightedIds
          ? props.temporarilyHighlightedIds.indexOf(item.id) !== -1
          : false,
        parentIsRadioFolder: false,
        parents: [],
        hidden: (props.hiddenItems || []).indexOf(item.id) !== -1,
      } as TreeNode;
      map.set(item.id, node);
      return map;
    }, new Map<string, TreeNode>());

    const nodes: TreeNode[] = [];
    for (const item of props.items) {
      const node = nodesById.get(item.id);
      if (node) {
        if (!item.parentId) {
          nodes.push(node);
        } else {
          const parent = nodesById.get(item.parentId);
          if (parent) {
            parent.children.push(node);
            node.level = parent.level + 1;
            node.parentIsRadioFolder = parent.radioFolder;
          }
        }
      }
    }

    // recursively set node.parents, hasCheckedChildren, and parentIsRadioFolder
    function addParentsAndGetVisibility(node: TreeNode, parents: string[]) {
      node.parents.push(...parents);
      let anyVisibleChildren = false;
      let anyHiddenChildren = false;
      for (const child of node.children) {
        addParentsAndGetVisibility(child, [...node.parents, node.node.id]);
        if (child.isLeaf) {
          if (child.checked === CheckState.CHECKED) {
            anyVisibleChildren = true;
          } else {
            anyHiddenChildren = true;
          }
        } else {
          if (child.checked === CheckState.CHECKED) {
            anyVisibleChildren = true;
          } else if (child.checked === CheckState.PARTIAL) {
            anyHiddenChildren = true;
            anyVisibleChildren = true;
          } else if (child.checked === CheckState.UNCHECKED) {
            anyHiddenChildren = true;
          }
        }
      }
      if (anyVisibleChildren) {
        if (anyHiddenChildren) {
          node.checked = CheckState.PARTIAL;
        } else {
          node.checked = CheckState.CHECKED;
        }
      }
    }

    for (const node of nodes) {
      addParentsAndGetVisibility(node, []);
    }
    return nodes;
  }, [
    props.items,
    props.expanded,
    props.selection,
    props.temporarilyHighlightedIds,
    contextMenu?.id,
    checkedItems,
    loadingItems,
    props.errors,
    props.hiddenItems,
  ]);

  const handleChecked = useCallback(
    (item: TreeItem, isChecked: boolean, children?: TreeNode[]) => {
      if (onChecked) {
        function getIds(item: TreeNode, ids: string[]) {
          if (item.isLeaf) {
            ids.push(item.node.id);
          }
          if (item.children && item.children.length > 0) {
            if (item.radioFolder && isChecked) {
              const toggledChild = item.children.find(
                (child) => child.checked !== CheckState.UNCHECKED
              );
              if (toggledChild) {
                // if any children are checked,
                // do nothing
              } else {
                // else, toggle the first child and it's children
                getIds(item.children[0], ids);
              }
            } else {
              for (const child of item.children) {
                getIds(child, ids);
              }
            }
          }
          return ids;
        }
        const ids = item.isLeaf ? [item.id] : [];
        if (children && children.length > 0) {
          if (item.radioFolder && isChecked) {
            const toggledChild = children.find(
              (child) => child.checked !== CheckState.UNCHECKED
            );
            if (toggledChild) {
              // if any children are checked,
              // do nothing
            } else {
              // else, toggle the first child and it's children
              getIds(children[0], ids);
            }
          } else {
            for (const child of children) {
              getIds(child, ids);
            }
          }
        }
        onChecked(ids, isChecked);
        if (isChecked && item.parentId) {
          const parent = findTreeNodeRecursive(data, item.parentId);
          if (parent?.radioFolder) {
            // Find and hide any visible siblings and their children
            const siblings = parent.children.filter(
              (i) => i.node.id !== item.id
            );
            const idsToHide: string[] = [];
            for (const sibling of siblings) {
              if (sibling.checked !== CheckState.UNCHECKED) {
                if (sibling.isLeaf) {
                  idsToHide.push(sibling.node.id);
                } else if (sibling.children) {
                  for (const child of sibling.children) {
                    getIds(child, idsToHide);
                  }
                }
              }
            }
            onChecked(idsToHide, false);
          }
        }
      }
    },
    [onChecked, data]
  );

  const updateContextMenuTargetRef = useCallback(
    (el: HTMLElement | null) => {
      if (setContextMenu && el) {
        setContextMenu((prev) => {
          if (prev) {
            return {
              ...prev,
              target: el,
            };
          } else {
            return prev;
          }
        });
      }
    },
    [setContextMenu]
  );

  const onContextMenu = useCallback(
    (
      node: TreeItem,
      target: HTMLElement,
      offsetX: number,
      clickEvent: React.MouseEvent
    ) => {
      if (getContextMenuItems || props.getContextMenuContent) {
        setContextMenu({
          id: node.id,
          offsetX,
          target,
          clickEvent,
        });
        if (props.getContextMenuContent) {
          if (props.getContextMenuContent(node.id, clickEvent) === null) {
            setContextMenu(undefined);
          }
        }
        if (getContextMenuItems) {
          setContextMenuOptions(getContextMenuItems(node));
        }
      }
    },
    [setContextMenu, getContextMenuItems, props.getContextMenuContent, onSelect]
  );

  useEffect(() => {
    setContextMenu((prev) => {
      if (prev && props.selection && props.selection.indexOf(prev.id) !== -1) {
        return prev;
      } else {
        return undefined;
      }
    });
  }, [props.selection]);

  return (
    <div
      ref={treeRef}
      role="tree"
      aria-label={props.ariaLabel}
      aria-multiselectable={Boolean(props.multipleSelect)}
      tabIndex={0}
      onKeyDown={handleKeyDown}
    >
      <ContextMenu.Root
        onOpenChange={(open) => {
          if (!open) {
            setContextMenu(undefined);
          }
        }}
      >
        <ContextMenu.Portal>
          <div className="ToCMenuContent">
            {contextMenu?.id &&
              props.getContextMenuContent &&
              props.getContextMenuContent(
                contextMenu.id,
                contextMenu.clickEvent
              )}
          </div>
        </ContextMenu.Portal>

        {!props.getContextMenuContent &&
          contextMenu?.target &&
          contextMenuOptions?.length > 0 && (
            <ContextMenuDropdown
              options={contextMenuOptions}
              target={contextMenu.target}
              offsetX={contextMenu.offsetX}
              onClick={() => {
                setContextMenu(undefined);
              }}
            />
          )}

        {data.map((item, index) => (
          <TreeItemComponent
            highlights={props.highlights}
            index={index}
            clearSelection={clearSelection}
            key={item.node.id}
            {...item}
            numChildren={item.children.length}
            onExpand={onExpand}
            onSelect={onSelect}
            onContextMenu={onContextMenu}
            level={1}
            children={item.children}
            isContextMenuTarget={item.isContextMenuTarget}
            updateContextMenuTargetRef={updateContextMenuTargetRef}
            onDragEnd={onDragEnd}
            onDropEnd={onDropEnd}
            onChecked={handleChecked}
            disableEditing={disableEditing || false}
            hideCheckboxes={hideCheckboxes || false}
            checked={item.checked}
            highlighted={item.highlighted}
            isLoading={item.loading}
            error={item.error || null}
            onDrop={onDrop}
            sortable={Boolean(sortable)}
            nextSiblingId={data[index + 1]?.node.id}
            previousSiblingId={data[index - 1]?.node.id}
            onSortEnd={onSortEnd}
            allowContextMenuDefault={Boolean(props.getContextMenuContent)}
            isHidden={item.hidden}
            onUnhide={props.onUnhide}
            showContextMenuButtons={showContextMenuButtons}
          />
        ))}
      </ContextMenu.Root>
    </div>
  );
}

export function treeItemIdForFragment(fragment: {
  id: number;
  __typename?: string;
}) {
  return treeItemId(fragment.id, fragment.__typename!);
}

export function treeItemId(id: number, typeName?: string) {
  return `${typeName}:${id}`;
}

export function parseTreeItemId(id: string) {
  if (!/\w+:\d+/.test(id)) {
    return {
      __typename: "TableOfContentsItem",
      id,
    };
    // throw new Error("Does not appear to be a tree item ID");
  } else {
    const [__typename, _id] = id.split(":");
    return {
      __typename,
      id: parseInt(_id),
    };
  }
}

export function useOverlayState(
  items?: OverlayFragment[] | null,
  editable?: boolean,
  localStoragePrefix?: string
) {
  const getTranslatedProp = useTranslatedProps();
  const mapContext = useContext(MapContext);
  const [expandedIds, setExpandedIds] = useLocalStorage<string[]>(
    `${localStoragePrefix}-overlays-expanded-ids`,
    []
  );

  const treeItems = useMemo(() => {
    return overlayLayerFragmentsToTreeItems(
      [...(items || [])].sort((a, b) => a.sortIndex - b.sortIndex),
      editable,
      (propName: string, record: OverlayFragment) => {
        return getTranslatedProp(propName, record)!;
      }
    );
  }, [items, editable, getTranslatedProp]);

  const { checkedItems, loadingItems, overlayErrors, hiddenItems } =
    useMemo(() => {
      const checkedItems: string[] = [];
      const loadingItems: string[] = [];
      const hiddenItems: string[] = [];
      const overlayErrors: { [id: string]: string } = {};
      for (const item of items || []) {
        if (item.dataLayerId) {
          const record = mapContext.layerStatesByTocStaticId[item.stableId];
          if (record) {
            if (record.visible) {
              checkedItems.push(item.stableId);
            }
            if (record.loading) {
              loadingItems.push(item.stableId);
            }
            if (record.error) {
              overlayErrors[item.stableId] = record.error.toString();
            }
            if (record.hidden) {
              hiddenItems.push(item.stableId);
            }
          }
        }
      }
      return {
        checkedItems,
        loadingItems,
        overlayErrors,
        hiddenItems,
      };
    }, [items, mapContext.layerStatesByTocStaticId]);

  const onExpand = useCallback(
    (node: TreeItem, isExpanded: boolean) => {
      if (isExpanded) {
        setExpandedIds((prev) => [
          ...prev.filter((id) => id !== node.id),
          node.id,
        ]);
      } else {
        setExpandedIds((prev) => [...prev.filter((id) => id !== node.id)]);
      }
    },
    [setExpandedIds]
  );

  const onChecked = useCallback(
    (ids: string[], isChecked: boolean) => {
      const staticIds = (items || [])
        .filter((item) => ids.indexOf(item.stableId) !== -1)
        .filter((item) => Boolean(item.dataLayerId))
        .map((item) => item.stableId);
      if (isChecked) {
        mapContext.manager?.showTocItems(staticIds);
      } else {
        mapContext.manager?.hideTocItems(staticIds);
      }
    },
    [items, mapContext.manager]
  );

  const onUnhide = useCallback(
    (stableId: string) => {
      if (mapContext.manager) {
        mapContext.manager.showHiddenLayer(stableId);
      }
    },
    [mapContext.manager]
  );

  const hasLocalState = useMemo(() => {
    return (
      expandedIds.length > 0 ||
      checkedItems.length > 0 ||
      hiddenItems.length > 0
    );
  }, [expandedIds, checkedItems, hiddenItems]);

  const resetLocalState = useCallback(() => {
    mapContext.manager?.resetLayers();
    setExpandedIds([]);
    window.localStorage.removeItem(
      // eslint-disable-next-line i18next/no-literal-string
      `${localStoragePrefix}-overlays-expanded-ids`
    );
  }, [setExpandedIds, mapContext.manager, localStoragePrefix]);

  return {
    expandedIds,
    onExpand,
    setExpandedIds,
    checkedItems,
    onChecked,
    treeItems,
    loadingItems,
    overlayErrors,
    onUnhide,
    hiddenItems,
    hasLocalState,
    resetLocalState,
  };
}

export function overlayLayerFragmentsToTreeItems(
  fragments: OverlayFragment[],
  editable?: boolean,
  getTranslatedProp?: (propName: string, fragment: OverlayFragment) => string
) {
  const items: TreeItem[] = [];
  for (const fragment of fragments) {
    items.push({
      id: fragment.stableId,
      isLeaf: !fragment.isFolder,
      parentId: fragment.parentStableId || null,
      checkOffOnly: fragment.isClickOffOnly,
      radioFolder: fragment.showRadioChildren,
      hideChildren: fragment.hideChildren,
      title: getTranslatedProp
        ? getTranslatedProp("title", fragment)
        : fragment.title,
      type: fragment.__typename!,
      dropAcceptsTypes: editable ? ["TableOfContentsItem"] : [],
    });
  }
  return items;
}

function findTreeNodeRecursive(data: TreeNode[], id: string): TreeNode | null {
  for (const node of data) {
    if (node.node.id === id) {
      return node;
    }
    const found = findTreeNodeRecursive(node.children, id);
    if (found) {
      return found;
    }
  }
  return null;
}
