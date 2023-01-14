import Button from "../../components/Button";
import DropdownButton from "../../components/DropdownButton";
import {
  currentSidebarState,
  ProjectAppSidebarContext,
  ProjectAppSidebarToolbar,
} from "../ProjectAppSidebar";
import { Trans as I18n } from "react-i18next";
import getSlug from "../../getSlug";
import { useSketchingQuery } from "../../generated/graphql";
import { useContext, useMemo, useState, useEffect, useCallback } from "react";
import { memo } from "react";
import { useGlobalErrorHandler } from "../../components/GlobalErrorHandler";
import { useAuth0 } from "@auth0/auth0-react";
import { DropTargetMonitor, useDrop } from "react-dnd";
import ContextMenuDropdown from "../../components/ContextMenuDropdown";
import useUpdateSketchTableOfContentsDraggable from "./useUpdateSketchTableOfContentsItem";
import TreeView, { TreeNodeProps } from "../../components/TreeView";
import FolderItem, { FolderNodeDataProps, isFolderNode } from "./FolderItem";
import SketchItem, { isSketchNode, SketchNodeDataProps } from "./SketchItem";
import { myPlansFragmentsToTreeItems, treeItemId } from ".";
import Skeleton from "../../components/Skeleton";
import LoginPrompt from "./LoginPrompt";
import { MapContext } from "../../dataLayers/MapContextManager";
import mapboxgl from "mapbox-gl";
import decode from "jwt-decode";
import { SketchUIStateContext } from "./SketchUIStateContextProvider";

const Trans = (props: any) => <I18n ns="sketching" {...props} />;

export type TreeItemType = FolderNodeDataProps | SketchNodeDataProps;

export default memo(function SketchingTools({ hidden }: { hidden?: boolean }) {
  const { isSmall } = useContext(ProjectAppSidebarContext);
  const { user } = useAuth0();
  const onError = useGlobalErrorHandler();
  const mapContext = useContext(MapContext);
  const {
    expandItem,
    expandedIds,
    onExpand,
    selectedIds,
    clearSelection,
    onSelect,
    focusOnTableOfContentsItem,
    setToolbarRef,
    visibleSketches,
    onChecked,
    updateFromCache,
    setOpenReports,
    editorIsOpen,
    menuOptions,
  } = useContext(SketchUIStateContext);

  const { data, loading, refetch } = useSketchingQuery({
    variables: {
      slug: getSlug(),
    },
    onError,
    skip: !user,
  });

  // Necesssary for SketchUIStateContext to display up-to-date sketches
  useEffect(() => {
    if (data?.projectBySlug?.mySketches) {
      updateFromCache();
    }
  }, [data?.projectBySlug?.mySketches, updateFromCache]);

  useEffect(() => {
    if (data?.projectBySlug?.sketchGeometryToken) {
      const claims = decode(data.projectBySlug.sketchGeometryToken) as any;
      if (claims && claims.exp) {
        const expiresAt = new Date(claims.exp * 1000);
        const checker = () => {
          const expiresInHours =
            (expiresAt.getTime() - new Date().getTime()) / 36e5;
          if (expiresInHours < 2) {
            console.warn("sketch access token is expiring. refetching...");
            refetch();
          }
        };
        checker();
        const intervalId = setInterval(checker, 1000 * 60 * 5);
        return () => clearInterval(intervalId);
      }
    }
  }, [data?.projectBySlug?.sketchGeometryToken, refetch]);

  const { dropFolder, dropSketch } = useUpdateSketchTableOfContentsDraggable();

  const [contextMenu, setContextMenu] = useState<
    | {
        id: string;
        // options: (DropdownOption | DropdownDividerProps)[];
        target: HTMLElement;
        offsetX: number;
      }
    | undefined
  >();

  // Clear the context menu if selection changes
  useEffect(() => {
    setContextMenu((prev) => {
      if (prev && selectedIds.indexOf(prev.id) !== -1) {
        return prev;
      } else {
        return undefined;
      }
    });
  }, [selectedIds]);

  // TODO: Hoist this into SketchUIStateContextProvider
  // useEffect(() => {
  //   const handler = (e: KeyboardEvent) => {
  //     // @ts-ignore
  //     const tagName = e.target?.tagName || "";
  //     if (["INPUT", "TEXTAREA"].indexOf(tagName) !== -1) {
  //       return;
  //     }
  //     if (keyboardShortcuts.length) {
  //       const shortcut = keyboardShortcuts.find(
  //         (action) => action.keycode === e.key
  //       );
  //       if (shortcut) {
  //         callAction(shortcut);
  //       } else if (e.key === "x" && selectedIds.length && openReports.length) {
  //         const ids = selectedIds
  //           .filter((s) => /Sketch:/.test(s))
  //           .map((s) => parseInt(s.split(":")[1]));
  //         setOpenReports((prev) =>
  //           prev.filter((r) => ids.indexOf(r.sketchId) === -1)
  //         );
  //       }
  //     }
  //   };
  //   document.body.addEventListener("keydown", handler);
  //   return () => {
  //     document.body.removeEventListener("keydown", handler);
  //   };
  // }, [keyboardShortcuts, callAction, selectedIds, openReports]);

  /**
   * Convert GraphQL fragment data into a flat list of TreeItemI elements for
   * feeding into TreeView
   */
  const treeItems = useMemo(() => {
    const sketches = data?.projectBySlug?.mySketches || [];
    const folders = data?.projectBySlug?.myFolders || [];
    const items = myPlansFragmentsToTreeItems([...sketches, ...folders]);
    return items.sort((a, b) => a.data.name.localeCompare(b.data.name));
  }, [data?.projectBySlug?.mySketches, data?.projectBySlug?.myFolders]);

  const onDragEnd = useCallback(
    (items: TreeItemType[]) => {
      for (const item of items) {
        focusOnTableOfContentsItem(item.type, item.id);
      }
    },
    [focusOnTableOfContentsItem]
  );

  const onDropEnd = useCallback(
    (item: TreeItemType) => {
      const id = treeItemId(item.id, item.type);
      expandItem({ id });
    },
    [expandItem]
  );

  const [{ canDrop, isOver }, drop] = useDrop(() => ({
    // The type (or types) to accept - strings or symbols
    accept: ["SketchFolder", "Sketch"],
    canDrop: (item, monitor) => {
      return (
        monitor.isOver({ shallow: true }) === true // &&
        // (Boolean(item.collectionId) || Boolean(item.folderId))
      );
    },
    // Props to collect
    collect: (monitor) => ({
      isOver: monitor.isOver({ shallow: true }),
      canDrop: monitor.canDrop(),
    }),
    drop: (
      item: {
        id: number;
        type: string;
        folderId?: number | null;
        collectionId?: number | null;
      },
      monitor: DropTargetMonitor<{ id: number; type: string }>
    ) => {
      if (!monitor.didDrop()) {
        (item.type === "SketchFolder" ? dropFolder : dropSketch)(item.id, {
          folderId: null,
          collectionId: null,
        });
      }
    },
  }));

  const treeRenderFn = useCallback(
    ({ node, ...props }: TreeNodeProps<TreeItemType>) => {
      if (isFolderNode(node) && props.children) {
        return <FolderItem {...props} node={node} />;
      } else if (isSketchNode(node)) {
        return <SketchItem {...props} node={node} />;
      } else {
        // eslint-disable-next-line i18next/no-literal-string
        return <div>Unimplemented</div>;
      }
    },
    []
  );

  if (!user) {
    return <LoginPrompt hidden={hidden} />;
  }

  return (
    <div style={{ display: hidden ? "none" : "block" }}>
      {!hidden && (
        <ProjectAppSidebarToolbar ref={(el) => setToolbarRef(el)}>
          <DropdownButton
            small
            alignment="left"
            label={
              isSmall ? <Trans>Create</Trans> : <Trans>Create New...</Trans>
            }
            options={menuOptions?.create || []}
            disabled={
              editorIsOpen || !menuOptions || menuOptions.create.length === 0
            }
          />
          <DropdownButton
            small
            disabled={
              !menuOptions ||
              (menuOptions.update.length === 0 && menuOptions.read.length === 0)
            }
            alignment="left"
            label={<Trans>Edit</Trans>}
            options={[
              ...(menuOptions?.update || []),
              ...(menuOptions?.read || []),
            ]}
          />
          <Button
            disabled={
              menuOptions
                ? menuOptions.viewReports
                  ? menuOptions.viewReports.disabled
                  : true
                : true
            }
            small
            onClick={menuOptions?.viewReports?.onClick}
            label={
              isSmall ? (
                <Trans>View Attributes</Trans>
              ) : (
                <Trans>View Attributes and Reports</Trans>
              )
            }
          />
        </ProjectAppSidebarToolbar>
      )}
      <div
        ref={drop}
        className={`pl-6 pt-4 pr-4 pb-8 border-l-8 border-transparent ${
          isOver && canDrop ? " bg-blue-100 border-blue-500" : ""
        }`}
      >
        {contextMenu?.target && menuOptions && (
          <ContextMenuDropdown
            options={menuOptions.contextMenu}
            target={contextMenu.target}
            offsetX={contextMenu.offsetX}
            onClick={() => {
              setContextMenu(undefined);
            }}
          />
        )}
        <div>
          {!data && loading && (
            <div className="pt-2 space-y-2">
              <Skeleton className="w-1/2 h-5" />
              <Skeleton className="w-2/3 h-5" />
              <Skeleton className="w-1/2 h-5" />
              <Skeleton className="w-2/3 h-5" />
              <Skeleton className="w-1/2 h-5" />
              <Skeleton className="w-2/3 h-5" />
              <Skeleton className="w-1/2 h-5" />
              <Skeleton className="w-2/3 h-5" />
            </div>
          )}
          {data && (
            <TreeView
              onExpand={onExpand}
              expanded={expandedIds}
              onSelect={onSelect}
              selection={selectedIds}
              setContextMenu={setContextMenu}
              contextMenuItemId={contextMenu?.id}
              items={treeItems}
              render={treeRenderFn}
              ariaLabel="My Sketches"
              clearSelection={clearSelection}
              onDragEnd={onDragEnd}
              onDropEnd={onDropEnd}
              checkedItems={visibleSketches}
              onChecked={onChecked}
            />
          )}
        </div>
      </div>
    </div>
  );
});
