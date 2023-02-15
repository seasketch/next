import Button from "../../components/Button";
import DropdownButton from "../../components/DropdownButton";
import {
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
import useUpdateSketchTableOfContentsDraggable from "./useUpdateSketchTableOfContentsItem";
import TreeView, { parseTreeItemId, TreeItem } from "../../components/TreeView";
import { myPlansFragmentsToTreeItems } from ".";
import Skeleton from "../../components/Skeleton";
import LoginPrompt from "./LoginPrompt";
import decode from "jwt-decode";
import { SketchUIStateContext } from "./SketchUIStateContextProvider";

const Trans = (props: any) => <I18n ns="sketching" {...props} />;

export default memo(function SketchingTools({ hidden }: { hidden?: boolean }) {
  const { isSmall } = useContext(ProjectAppSidebarContext);
  const { user } = useAuth0();
  const onError = useGlobalErrorHandler();
  const {
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
    editorIsOpen,
    menuOptions,
    getMenuOptions,
    errors,
    loading: loadingSketches,
  } = useContext(SketchUIStateContext);

  const getContextMenuItems = useCallback(
    (item: TreeItem) => {
      if (item) {
        return getMenuOptions(
          [item.id],
          item.type === "Sketch"
            ? { sketch: true, folder: false, collection: !item.isLeaf }
            : { sketch: false, folder: true, collection: false }
        ).contextMenu;
      } else {
        return [];
      }
    },
    [getMenuOptions]
  );

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

  /**
   * Convert GraphQL fragment data into a flat list of TreeItemI elements for
   * feeding into TreeView
   */
  const treeItems = useMemo(() => {
    const sketches = data?.projectBySlug?.mySketches || [];
    const folders = data?.projectBySlug?.myFolders || [];
    const items = myPlansFragmentsToTreeItems([...sketches, ...folders]);
    return items.sort((a, b) => a.title.localeCompare(b.title));
  }, [data?.projectBySlug?.mySketches, data?.projectBySlug?.myFolders]);

  const onDragEnd = useCallback(
    (items: TreeItem[]) => {
      for (const item of items) {
        if (item.type === "Sketch" || item.type === "SketchFolder") {
          focusOnTableOfContentsItem(item.type, parseTreeItemId(item.id).id);
        }
      }
    },
    [focusOnTableOfContentsItem]
  );

  const [temporarilyHighlightedIds, setTemporarilyHighlightedIds] = useState<
    string[]
  >([]);

  // Disabled auto-expansion of folders as requested in
  // https://github.com/seasketch/next/issues/544
  const onDropEnd = useCallback(
    (item: TreeItem) => {
      setTemporarilyHighlightedIds((prev) => [...prev, item.id]);
      setTimeout(() => {
        setTemporarilyHighlightedIds((prev) =>
          prev.filter((i) => i !== item.id)
        );
      }, 100);
    },
    [setTemporarilyHighlightedIds]
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
      item: TreeItem,
      monitor: DropTargetMonitor<{ id: number; type: string }>
    ) => {
      if (!monitor.didDrop()) {
        (item.type === "SketchFolder" ? dropFolder : dropSketch)(
          parseTreeItemId(item.id).id,
          {
            folderId: null,
            collectionId: null,
          }
        );
      }
    },
  }));

  if (!user || (!loading && !data?.me)) {
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
              !menuOptions?.viewReports || menuOptions.viewReports.disabled
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
              items={treeItems}
              ariaLabel="My Sketches"
              clearSelection={clearSelection}
              onDragEnd={onDragEnd}
              onDropEnd={onDropEnd}
              checkedItems={visibleSketches}
              onChecked={onChecked}
              temporarilyHighlightedIds={temporarilyHighlightedIds}
              errors={errors}
              loadingItems={loadingSketches}
              getContextMenuItems={getContextMenuItems}
            />
          )}
        </div>
      </div>
    </div>
  );
});
