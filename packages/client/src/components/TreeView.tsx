import { useMemo, FC, useCallback, SetStateAction } from "react";

export interface TreeItemI<T> {
  id: string;
  parentId?: string | null;
  parents: string[];
  data: T;
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
  /* Should update selection prop */
  onSelect?: (
    metaKey: boolean,
    node: TreeItemI<T>,
    isSelected: boolean
  ) => void;
  /* Should update expanded prop */
  onExpand?: (node: TreeItemI<T>, isExpanded: boolean) => void;
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
}

interface TreeNode<T> {
  isSelected: boolean;
  isExpanded: boolean;
  node: TreeItemI<T>;
  level: number;
  children: TreeNode<T>[];
  isContextMenuTarget: boolean;
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
      };
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
          }
        }
      }
    }

    // recursively set node.parents
    function addParents(node: TreeNode<any>, parents: string[]) {
      node.node.parents.push(...parents);
      for (const child of node.children) {
        addParents(child, [...node.node.parents, node.node.id]);
      }
    }

    for (const node of nodes) {
      addParents(node, []);
    }
    return nodes;
  }, [props.items, props.selection, props.expanded, contextMenuItemId]);

  const updateContextMenuTargetRef = useCallback(
    (el: HTMLElement) => {
      if (setContextMenu) {
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
        />
      ))}
    </ul>
  );
}
