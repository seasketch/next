import { useMemo, FC, useCallback, SetStateAction } from "react";

export interface TreeItemI<T> {
  id: string;
  parentId?: string | null;
  data: T;
  isLeaf: boolean;
  /** Assigned by treeview. Supply an empty */
  parents: string[];
  checkOffOnly?: boolean;
  radioFolder?: boolean;
  hideChildren?: boolean;
}

interface TreeViewProps<T> {
  /** Items to display in the tree */
  items: TreeItemI<T>[];
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
  onSelect?: (
    metaKey: boolean,
    node: TreeItemI<T>,
    isSelected: boolean
  ) => void;
  /* Should update expanded prop */
  onExpand?: (node: TreeItemI<T>, isExpanded: boolean) => void;
  onChecked?: (ids: string[], isChecked: boolean) => void;
  contextMenuItemId?: string;
  setContextMenu?: (
    value: SetStateAction<
      | {
          id: string;
          target: HTMLElement;
          offsetX: number;
        }
      | undefined
    >
  ) => void;
  render: FC<TreeNodeProps<T>>;
  clearSelection?: () => void;
  onDragEnd?: (items: T[]) => void;
  onDropEnd?: (item: T) => void;
  /** Amount of padding to give child lists. Defaults to 35px */
  childGroupPadding?: number;
  disableEditing?: boolean;
  hideCheckboxes?: boolean;
  temporarilyHighlightedIds?: string[];
}

type ChildGroupRenderer<T> = FC<{
  items: TreeNode<T>[];
}>;

export interface TreeNodeProps<T> {
  node: TreeItemI<T>;
  numChildren: number;
  onSelect?: (
    metaKey: boolean,
    node: TreeItemI<T>,
    isSelected: boolean
  ) => void;
  onExpand?: (node: TreeItemI<T>, isExpanded: boolean) => void;
  ChildGroup: ChildGroupRenderer<any>;
  children?: TreeNode<any>[];
  isSelected: boolean;
  isExpanded: boolean;
  level: number;
  isContextMenuTarget: boolean;
  onContextMenu?: (
    node: TreeItemI<T>,
    target: HTMLElement,
    offsetX: number
  ) => void;
  updateContextMenuTargetRef: (el: HTMLElement) => void;
  onDragEnd?: (items: T[]) => void;
  onDropEnd?: (item: T) => void;
  onChecked?: (
    node: TreeItemI<T>,
    isChecked: boolean,
    children?: TreeNode<T>[]
  ) => void;
  checked: CheckState;
  isLoading: boolean;
  disableEditing: boolean;
  hideCheckboxes: boolean;
  highlighted: boolean;
  parentIsRadioFolder: boolean;
  error: string | null;
}
export enum CheckState {
  CHECKED,
  PARTIAL,
  UNCHECKED,
}

interface TreeNode<T> {
  isSelected: boolean;
  isExpanded: boolean;
  node: TreeItemI<T>;
  level: number;
  children: TreeNode<T>[];
  isContextMenuTarget: boolean;
  checked: CheckState;
  loading: boolean;
  isLeaf: boolean;
  highlighted: boolean;
  parentIsRadioFolder: boolean;
  radioFolder: boolean;
  error?: string;
}

export default function TreeView<T>({
  onSelect,
  onExpand,
  setContextMenu,
  contextMenuItemId,
  clearSelection,
  onDragEnd,
  onDropEnd,
  childGroupPadding,
  checkedItems,
  loadingItems,
  onChecked,
  disableEditing,
  hideCheckboxes,
  ...props
}: TreeViewProps<T>) {
  const Render = props.render;
  const data = useMemo(() => {
    const nodesById = props.items.reduce((map, item) => {
      const node = {
        isExpanded: props.expanded
          ? props.expanded.indexOf(item.id) !== -1
          : false,
        isSelected: props.selection
          ? props.selection.indexOf(item.id) !== -1
          : false,
        node: { ...item, parents: [] },
        level: 1,
        children: [],
        isContextMenuTarget: contextMenuItemId === item.id,
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
      } as TreeNode<T>;
      map.set(item.id, node);
      return map;
    }, new Map<string, TreeNode<T>>());

    const nodes: TreeNode<T>[] = [];
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
    function addParentsAndGetVisibility(
      node: TreeNode<any>,
      parents: string[]
    ) {
      node.node.parents.push(...parents);
      let anyVisibleChildren = false;
      let anyHiddenChildren = false;
      for (const child of node.children) {
        addParentsAndGetVisibility(child, [...node.node.parents, node.node.id]);
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
    contextMenuItemId,
    checkedItems,
    loadingItems,
    props.errors,
  ]);

  const handleChecked = useCallback(
    (item: TreeItemI<T>, isChecked: boolean, children?: TreeNode<T>[]) => {
      if (onChecked) {
        function getIds(item: TreeNode<T>, ids: string[]) {
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
          const parent = data.find((i) => i.node.id === item.parentId);
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
    (node: TreeItemI<T>, target: HTMLElement, offsetX: number) => {
      if (setContextMenu) {
        setContextMenu({
          id: node.id,
          offsetX,
          target,
        });
      }
    },
    [setContextMenu]
  );

  const ChildGroup: ChildGroupRenderer<any> = useCallback(
    (props: { items: TreeNode<any>[] }) => {
      return (
        <ul
          role="group"
          onClick={(e) => {
            if (clearSelection) {
              clearSelection();
            }
          }}
          style={{
            paddingLeft: childGroupPadding || 35,
          }}
        >
          {props.items.map((item) => (
            <Render
              key={item.node.id}
              {...item}
              numChildren={item.children.length}
              onExpand={onExpand}
              onSelect={onSelect}
              onContextMenu={onContextMenu}
              level={item.level}
              ChildGroup={ChildGroup}
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
            />
          ))}
        </ul>
      );
    },
    [
      childGroupPadding,
      clearSelection,
      Render,
      onExpand,
      onSelect,
      onContextMenu,
      updateContextMenuTargetRef,
      onDragEnd,
      onDropEnd,
      handleChecked,
      disableEditing,
      hideCheckboxes,
    ]
  );

  return (
    <ul
      aria-multiselectable={Boolean(props.multipleSelect)}
      role="tree"
      aria-label={props.ariaLabel}
    >
      {data.map((item) => (
        <Render
          key={item.node.id}
          {...item}
          numChildren={item.children.length}
          onExpand={onExpand}
          onSelect={onSelect}
          onContextMenu={onContextMenu}
          level={1}
          children={item.children}
          ChildGroup={ChildGroup}
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
        />
      ))}
    </ul>
  );
}
