import Button from "../../components/Button";
import DropdownButton from "../../components/DropdownButton";
import {
  currentSidebarState,
  ProjectAppSidebarContext,
  ProjectAppSidebarToolbar,
} from "../ProjectAppSidebar";
import { Trans as I18n } from "react-i18next";
import getSlug from "../../getSlug";
import {
  GetSketchForEditingDocument,
  GetSketchForEditingQuery,
  SketchEditorModalDetailsFragment,
  SketchingDetailsFragment,
  useSketchingQuery,
} from "../../generated/graphql";
import { useContext, useMemo, useState, useEffect, useCallback } from "react";
import SketchEditorModal from "./SketchEditorModal";
import { useHistory } from "react-router-dom";
import { memo } from "react";
import useSketchActions from "./useSketchActions";
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
import useExpandedIds from "./useExpandedIds";
import LoginPrompt from "./LoginPrompt";
import useSketchingSelectionState from "./useSketchingSelectionState";
import useSketchVisibilityState from "./useSketchVisibilityState";
import { useApolloClient } from "@apollo/client";
import { MapContext } from "../../dataLayers/MapContextManager";
import mapboxgl from "mapbox-gl";
import SketchReportWindow, { ReportWindowUIState } from "./SketchReportWindow";
import decode from "jwt-decode";

const Trans = (props: any) => <I18n ns="sketching" {...props} />;

type ItemType = FolderNodeDataProps | SketchNodeDataProps;

export default memo(function SketchingTools({
  hidden,
  hideFullSidebar,
}: {
  hidden?: boolean;
  hideFullSidebar?: () => void;
}) {
  const { isSmall } = useContext(ProjectAppSidebarContext);
  const { user } = useAuth0();
  const [toolbarRef, setToolbarRef] = useState<HTMLElement | null>(null);
  const onError = useGlobalErrorHandler();
  const history = useHistory();
  const client = useApolloClient();
  const mapContext = useContext(MapContext);
  const [openReports, setOpenReports] = useState<
    { sketchId: number; uiState: ReportWindowUIState; sketchClassId: number }[]
  >([]);
  const onRequestReportClose = useCallback(
    (id: number) => {
      setOpenReports((prev) => prev.filter((i) => i.sketchId !== id));
    },
    [setOpenReports]
  );

  const { data, loading, refetch } = useSketchingQuery({
    variables: {
      slug: getSlug(),
    },
    onError,
    skip: !user,
  });

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
          if (expiresInHours < 2) {
            refetch();
          }
        };
        checker();
        const intervalId = setInterval(checker, 120000);
        return () => clearInterval(intervalId);
      }
    }
  }, [data?.projectBySlug?.sketchGeometryToken, refetch]);

  const { dropFolder, dropSketch } = useUpdateSketchTableOfContentsDraggable();
  const { visibleSketches, setVisibleSketches, onChecked } =
    useSketchVisibilityState(data?.projectBySlug?.mySketches || []);

  const { expandedIds, setExpandedIds, onExpand } = useExpandedIds(
    getSlug(),
    data?.projectBySlug?.myFolders,
    data?.projectBySlug?.mySketches
  );

  const [editor, setEditor] = useState<
    | false
    | {
        sketch?: SketchEditorModalDetailsFragment;
        sketchClass: SketchingDetailsFragment;
        folderId?: number;
        loading?: boolean;
        loadingTitle?: string;
      }
  >(false);

  const editSketch = useCallback(
    async (id: number) => {
      setOpenReports([]);
      const sketch = (data?.projectBySlug?.mySketches || []).find(
        (s) => s.id === id
      );
      if (sketch) {
        history.replace(`/${getSlug()}/app`);
        if (hideFullSidebar) {
          hideFullSidebar();
        }
        setEditor({
          loadingTitle: sketch.name,
          loading: true,
          sketchClass: (data?.projectBySlug?.sketchClasses || []).find(
            (sc) => sc.id === sketch.sketchClassId
          )!,
        });
        // load the sketch
        try {
          const response = await client.query<GetSketchForEditingQuery>({
            query: GetSketchForEditingDocument,
            variables: {
              id,
            },
            fetchPolicy: "cache-first",
          });
          // then set editor state again with sketch, loading=false
          if (response.data.sketch) {
            setEditor((prev) => {
              if (prev) {
                return {
                  ...prev,
                  sketch: response.data.sketch!,
                  loading: false,
                  loadingTitle: undefined,
                };
              } else {
                return false;
              }
            });
          } else {
            if (response.error) {
              throw new Error(response.error.message);
            } else {
              throw new Error(
                "Unknown query error when retrieving sketch data"
              );
            }
          }
        } catch (e) {
          onError(e);
          setEditor(false);
        }
      }
    },
    [
      client,
      data?.projectBySlug?.mySketches,
      data?.projectBySlug?.sketchClasses,
      history,
      onError,
      hideFullSidebar,
      setOpenReports,
    ]
  );

  const {
    selectedIds,
    clearSelection,
    selectedSketchClasses,
    onSelect,
    focusOnTableOfContentsItem,
  } = useSketchingSelectionState({
    mySketches: data?.projectBySlug?.mySketches,
    toolbarRef,
    setExpandedIds,
    setVisibleSketches,
    editSketch,
  });

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

  const zoomTo = useCallback(
    (bbox: number[]) => {
      const boundsLike = [
        [bbox[0], bbox[1]],
        [bbox[2], bbox[3]],
      ];
      const sidebar = currentSidebarState();
      if (mapContext.manager?.map) {
        mapContext.manager.map.fitBounds(
          boundsLike as mapboxgl.LngLatBoundsLike,
          {
            animate: true,
            padding: {
              bottom: 100,
              top: 100,
              left: sidebar.open ? sidebar.width + 100 : 100,
              right: 100,
            },
          }
        );
      }
    },
    [mapContext.manager?.map]
  );

  const openSketchReport = useCallback(
    (sketchId: number, uiState?: "left" | "right" | "docked") => {
      const sketch = (data?.projectBySlug?.mySketches || []).find(
        (s) => s.id === sketchId
      );
      if (sketch) {
        setOpenReports([
          { sketchId, uiState: "right", sketchClassId: sketch?.sketchClassId },
        ]);
      }
    },
    [setOpenReports, data?.projectBySlug?.mySketches]
  );

  const clearOpenSketchReports = useCallback(() => {
    setOpenReports([]);
  }, [setOpenReports]);
  /**
   * List of "actions" like edit, delete, zoom to, that are relevent to the
   * current selection. These are used directly by the toolbar, and also bundled
   * up into DropdownOptions for the context menu.
   *
   * There's a lot of context passed to this hook! It would probably make equal
   * sense to have this functionality just embedded in the component but moving
   * it to a hook organizes functionality a bit more.
   */
  const { menuOptions, keyboardShortcuts, callAction } = useSketchActions({
    folderSelected: Boolean(selectedIds.find((id) => /SketchFolder:/.test(id))),
    selectedSketchClasses,
    multiple: selectedIds.length > 1,
    sketchClasses: data?.projectBySlug?.sketchClasses,
    clearSelection,
    focusOnTableOfContentsItem,
    selectedIds,
    setContextMenu,
    setEditor,
    setExpandedIds,
    folders: data?.projectBySlug?.myFolders,
    sketches: data?.projectBySlug?.mySketches,
    zoomTo,
    openSketchReport,
    clearOpenSketchReports,
  });

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      // @ts-ignore
      const tagName = e.target?.tagName || "";
      if (["INPUT", "BUTTON", "TEXTAREA"].indexOf(tagName) !== -1) {
        return;
      }
      if (keyboardShortcuts.length) {
        const shortcut = keyboardShortcuts.find(
          (action) => action.keycode === e.key
        );
        if (shortcut) {
          callAction(shortcut);
        }
      }
    };
    document.body.addEventListener("keydown", handler);
    return () => {
      document.body.removeEventListener("keydown", handler);
    };
  }, [keyboardShortcuts, callAction]);

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
    (items: ItemType[]) => {
      for (const item of items) {
        focusOnTableOfContentsItem(item.type, item.id);
      }
    },
    [focusOnTableOfContentsItem]
  );

  const onDropEnd = useCallback(
    (item: ItemType) => {
      const id = treeItemId(item.id, item.type);
      setExpandedIds((prev) => {
        return [...prev.filter((eid) => eid !== id), id];
      });
    },
    [setExpandedIds]
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
    ({ node, ...props }: TreeNodeProps<ItemType>) => {
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
            options={menuOptions.create}
            disabled={editor !== false}
          />
          <DropdownButton
            small
            disabled={menuOptions.edit.length === 0}
            alignment="left"
            label={<Trans>Edit</Trans>}
            options={menuOptions.edit}
          />
          <Button
            disabled={
              menuOptions.viewReports ? menuOptions.viewReports.disabled : true
            }
            small
            onClick={menuOptions.viewReports?.onClick}
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
        {contextMenu?.target && (
          <ContextMenuDropdown
            options={menuOptions.contextMenu}
            target={contextMenu.target}
            offsetX={contextMenu.offsetX}
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
      {editor !== false && (
        <SketchEditorModal
          sketchClass={editor?.sketchClass}
          sketch={editor?.sketch}
          loading={editor?.loading}
          loadingTitle={editor?.loading ? editor.loadingTitle : undefined}
          folderId={editor?.folderId}
          onComplete={(item) => {
            history.replace(`/${getSlug()}/app/sketches`);
            setEditor(false);
            focusOnTableOfContentsItem(
              "Sketch",
              item.id,
              item.folderId || undefined,
              item.collectionId || undefined,
              true
            );
          }}
          onCancel={() => {
            history.replace(`/${getSlug()}/app/sketches`);
            setEditor(false);
          }}
        />
      )}
      {openReports.map(({ sketchId, uiState, sketchClassId }) => (
        <SketchReportWindow
          key={sketchId}
          sketchId={sketchId}
          sketchClassId={sketchClassId}
          onRequestClose={onRequestReportClose}
          uiState={uiState}
          selected={selectedIds.indexOf(`Sketch:${sketchId}`) !== -1}
          reportingAccessToken={data?.projectBySlug?.sketchGeometryToken}
        />
      ))}
    </div>
  );
});
