import { Suspense, useCallback, useContext, useEffect, useState } from "react";
import { Route, useHistory, useParams } from "react-router-dom";
import { Trans, useTranslation } from "react-i18next";
import Spinner from "../../components/Spinner";
import { MapContext } from "../../dataLayers/MapContextManager";
import {
  useDraftStatusSubscription,
  useDraftTableOfContentsQuery,
  useLayersAndSourcesForItemsQuery,
  useSearchOverlaysQuery,
  useUpdateTableOfContentsItemChildrenMutation,
} from "../../generated/graphql";
import EditFolderModal from "./EditFolderModal";
import LayerTableOfContentsItemEditor from "./LayerTableOfContentsItemEditor";
import TableOfContentsMetadataEditor from "./TableOfContentsMetadataEditor";
import PublishTableOfContentsModal from "./PublishTableOfContentsModal";
import FolderEditor from "./FolderEditor";
import TreeView, {
  TreeItem,
  TreeItemHighlights,
} from "../../components/TreeView";
import { useOverlayState } from "../../components/TreeView";
import { SortingState } from "../../projects/Sketches/TreeItemComponent";
import { OverlayFragment } from "../../generated/queries";
import * as Menubar from "@radix-ui/react-menubar";
import {
  MenuBarContent,
  MenuBarItem,
  MenuBarLabel,
  MenuBarSeparator,
  MenuBarSubmenu,
  MenubarRadioItem,
  MenubarTrigger,
} from "../../components/Menubar";
import bbox from "@turf/bbox";
import { DataUploadDropzoneContext } from "../uploads/DataUploadDropzone";
import { Feature } from "geojson";
import { Map } from "mapbox-gl";
import * as Tooltip from "@radix-ui/react-tooltip";
import React from "react";
import { ZIndexEditableList } from "./ZIndexEditableList";
import { LayerEditingContext } from "./LayerEditingContext";
import FullScreenLoadingSpinner from "./FullScreenLoadingSpinner";
import { TableOfContentsItemMenu } from "./TableOfContentsItemMenu";
import * as ContextMenu from "@radix-ui/react-context-menu";
import { XCircleIcon, XIcon } from "@heroicons/react/solid";
import useDebounce from "../../useDebounce";
import { SearchIcon } from "@heroicons/react/outline";
import useCurrentLang from "../../useCurrentLang";

const LazyArcGISCartModal = React.lazy(
  () =>
    import(
      /* webpackChunkName: "AdminArcGISBrowser" */ "./arcgis/ArcGISCartModal"
    )
);

export default function TableOfContentsEditor() {
  const history = useHistory();
  const { slug } = useParams<{ slug: string }>();
  const [search, setSearch] = useState<string>();
  const debouncedSearch = useDebounce(search, 100);
  const currentLanguage = useCurrentLang();

  const setSelectedView = useCallback(
    (view: string) => {
      if (view === "order") {
        // eslint-disable-next-line i18next/no-literal-string
        history.push(`/${slug}/admin/data/zindex`);
      } else {
        // eslint-disable-next-line i18next/no-literal-string
        history.push(`/${slug}/admin/data`);
      }
    },
    [history, slug]
  );

  const selectedView = /zindex/.test(history.location.pathname)
    ? "order"
    : "tree";
  const { manager } = useContext(MapContext);

  const tocQuery = useDraftTableOfContentsQuery({
    variables: { slug },
  });

  const searchResults = useSearchOverlaysQuery({
    skip:
      !tocQuery.data?.projectBySlug?.id ||
      (debouncedSearch ? debouncedSearch.length < 2 : true),
    variables: {
      projectId: tocQuery.data?.projectBySlug?.id!,
      search: debouncedSearch || "",
      lang: currentLanguage.code,
      draft: true,
      limit: 100,
    },
    fetchPolicy: "network-only",
  });

  const [previousSearchTerm, setPreviousSearchTerm] = useState(search);
  useEffect(() => {
    if (searchResults.data && searchResults.variables?.search.length) {
      setPreviousSearchTerm(searchResults.variables.search);
    }
  }, [searchResults.data, searchResults.variables?.search]);

  const [createNewFolderModalOpen, setCreateNewFolderModalOpen] =
    useState<boolean>(false);
  const [updateChildrenMutation] =
    useUpdateTableOfContentsItemChildrenMutation();
  const [folderId, setFolderId] = useState<number>();
  const [publishOpen, setPublishOpen] = useState(false);
  const mapContext = useContext(MapContext);
  const [arcgisCartOpen, setArcgisCartOpen] = useState(false);
  useDraftStatusSubscription({
    variables: {
      slug,
    },
    shouldResubscribe: true,
  });

  const layerEditingContext = useContext(LayerEditingContext);

  const layersAndSources = useLayersAndSourcesForItemsQuery({
    variables: {
      slug,
      tableOfContentsItemIds:
        tocQuery.data?.projectBySlug?.draftTableOfContentsItems?.map(
          (item) => item.id
        ) || [],
    },
  });

  useEffect(() => {
    const layers = layersAndSources?.data?.projectBySlug?.dataLayersForItems;
    const sources = layersAndSources?.data?.projectBySlug?.dataSourcesForItems;
    if (layers && sources && manager) {
      manager.reset(
        sources,
        layers,
        tocQuery.data?.projectBySlug?.draftTableOfContentsItems || []
      );
    }
  }, [
    layersAndSources.data,
    manager,
    tocQuery.data?.projectBySlug?.draftTableOfContentsItems,
  ]);

  useEffect(() => {
    tocQuery.refetch();
  }, [slug]);

  const {
    expandedIds,
    onExpand,
    setExpandedIds,
    checkedItems,
    onChecked,
    loadingItems,
    overlayErrors,
    treeItems: treeNodes,
    hiddenItems,
    onUnhide,
    hasLocalState,
    resetLocalState,
  } = useOverlayState(
    tocQuery.data?.projectBySlug?.draftTableOfContentsItems,
    true,
    "admin"
  );

  // When filtering tree, the expansion state of items is temporarily updated
  // to ensure that all highlighted items are visible. This state is reset
  // when the filter is cleared. To do this, we need to keep track of the
  // original state of the tree, as well as the user's changes to the tree.
  // When the search filter is cleared, we want to reset the tree to its
  // original state, but we also want to preserve any user changes to the
  // expansion state.
  const [searchState, setSearchState] = useState<{
    originalState?: string[];
    highlights?: { [id: string]: TreeItemHighlights };
  }>({});

  const onSortEnd: (
    draggedTreeItem: TreeItem,
    target: TreeItem,
    state: SortingState
  ) => void = useCallback(
    (draggable, targetTreeItem, state) => {
      const items =
        tocQuery.data?.projectBySlug?.draftTableOfContentsItems || [];
      if (
        state === SortingState.OVER_EXISTING_POSITION ||
        state === SortingState.NONE
      ) {
        return;
      }
      if (state === SortingState.DIRECTLY_OVER_FOLDER) {
        // Stick item at the end of the list of this folder's children
        const folder = items.find(
          (item) => item.stableId === targetTreeItem.id
        );
        const draggedItem = items.find(
          (item) => item.stableId === draggable.id
        );
        if (!folder) {
          throw new Error("Folder not found");
        }
        if (!draggedItem) {
          throw new Error("Dragged item not found");
        }
        const siblings = items
          .filter((item) => item.parentStableId === folder.stableId)
          .sort((a, b) => a.sortIndex - b.sortIndex)
          .map((item) => item.id);
        updateChildrenMutation({
          variables: {
            id: folder.id,
            childIds: [...siblings, draggedItem.id],
          },
          optimisticResponse: (data) => {
            return {
              __typename: "Mutation",
              updateTableOfContentsItemChildren: {
                __typename: "UpdateTableOfContentsItemChildrenPayload",
                tableOfContentsItems: ((data.childIds || []) as number[]).map(
                  (id, sortIndex) => {
                    return {
                      __typename: "TableOfContentsItem",
                      id,
                      sortIndex,
                      parentStableId: folder.stableId || null,
                    };
                  }
                ),
              },
            };
          },
        });
      } else {
        // Position item before or after target sibling, based on LEADING or TRAILING state
        const target = items.find(
          (item) => item.stableId === targetTreeItem.id
        );
        if (!target) {
          throw new Error("Could not find target item");
        }
        const draggedItem = items.find(
          (item) => item.stableId === draggable.id
        );
        if (!draggedItem) {
          throw new Error("Dragged item not found");
        }
        let siblings: OverlayFragment[] = [];
        let parent: OverlayFragment | undefined = undefined;
        if (target.parentStableId) {
          parent = items.find(
            (item) => item.stableId === target.parentStableId
          );
          if (!parent) {
            throw new Error("Could not find parent");
          }
          siblings = items.filter(
            (item) => item.parentStableId === parent!.stableId
          );
        } else {
          siblings = items.filter((item) => !item.parentStableId);
        }
        siblings = siblings
          .filter((item) => item.stableId !== draggedItem.stableId)
          .sort((a, b) => a.sortIndex - b.sortIndex);

        const targetIdx = siblings.findIndex(
          (item) => item.stableId === target.stableId
        );
        if (targetIdx === -1) {
          throw new Error("Could not find index of drag target");
        }
        const children = [
          ...siblings.slice(
            0,
            state === SortingState.TRAILING_EDGE ? targetIdx + 1 : targetIdx
          ),
          draggedItem,
          ...siblings.slice(
            state === SortingState.TRAILING_EDGE ? targetIdx + 1 : targetIdx
          ),
        ];
        updateChildrenMutation({
          variables: {
            id: parent?.id || undefined,
            childIds: children.map((item) => item.id),
          },
          optimisticResponse: (data) => {
            return {
              __typename: "Mutation",
              updateTableOfContentsItemChildren: {
                __typename: "UpdateTableOfContentsItemChildrenPayload",
                tableOfContentsItems: ((data.childIds || []) as number[]).map(
                  (id, sortIndex) => {
                    return {
                      __typename: "TableOfContentsItem",
                      id,
                      sortIndex,
                      parentStableId: parent?.stableId || null,
                    };
                  }
                ),
              },
            };
          },
        });
      }
    },
    [
      tocQuery.data?.projectBySlug?.draftTableOfContentsItems,
      updateChildrenMutation,
    ]
  );

  const [filteredTreeNodes, setFilteredTreeNodes] = useState(treeNodes);

  useEffect(() => {
    if (search?.length === 0) {
      if (searchState.originalState) {
        setExpandedIds(searchState.originalState);
        setSearchState((prev) => {
          return {
            ...prev,
            originalState: undefined,
            highlights: undefined,
          };
        });
      }
    } else if (!searchState.originalState) {
      setSearchState((prev) => {
        return {
          ...prev,
          originalState: [...expandedIds],
        };
      });
    }
  }, [search?.length]);

  useEffect(() => {
    if (!search?.length) {
      setFilteredTreeNodes(treeNodes);
    } else {
      const highlights: { [id: string]: TreeItemHighlights } = {};
      const newExpandedIds = new Set<string>();
      const addedNodes = new Set<string>();
      const filteredNodes: typeof treeNodes = [];
      const addChildren = (parent: TreeItem) => {
        for (const child of treeNodes.filter((n) => n.parentId === parent.id)) {
          if (!addedNodes.has(child.id)) {
            add(child);
            if (!child.isLeaf) {
              addChildren(child);
            }
          }
        }
      };
      const add = (node: TreeItem) => {
        filteredNodes.push(node);
        addedNodes.add(node.id);
      };
      const addParents = (node: TreeItem) => {
        if (node.parentId && !addedNodes.has(node.parentId)) {
          const parent = treeNodes.find((n) => n.id === node.parentId);
          if (parent) {
            if (!parent.isLeaf) {
              newExpandedIds.add(parent.id);
            }
            add(parent);
            addParents(parent);
          }
        }
      };
      let overlays = searchResults.data?.searchOverlays || [];
      if (
        searchResults.loading &&
        previousSearchTerm &&
        (search.indexOf(previousSearchTerm) === 0 ||
          previousSearchTerm.indexOf(search) === 0) &&
        searchResults.previousData?.searchOverlays
      ) {
        overlays = searchResults.previousData.searchOverlays;
      }
      for (const result of overlays) {
        const node = treeNodes.find((node) => node.id === result.stableId);
        if (node) {
          highlights[node.id] = {
            title:
              result.titleHeadline && result.titleHeadline.indexOf("<<") !== -1
                ? result.titleHeadline
                : undefined,
            metadata:
              result.metadataHeadline &&
              result.metadataHeadline.indexOf("<<") !== -1
                ? result.metadataHeadline
                : undefined,
          };
        }
        if (node && filteredNodes.indexOf(node) === -1) {
          add(node);
          // if node is a child, add its parent
          addParents(node);
        }
        if (node && !node.isLeaf) {
          addChildren(node);
        }
      }
      setSearchState((prev) => {
        return {
          ...prev,
          highlights,
        };
      });
      setExpandedIds([...newExpandedIds]);
      setFilteredTreeNodes(filteredNodes);
    }
  }, [treeNodes, searchResults.data, search?.length]);

  const isFiltered = filteredTreeNodes.length !== treeNodes.length;
  const searching = Boolean(
    searchResults.loading ||
      (searchResults.called &&
        search !== undefined &&
        search.length > 1 &&
        searchResults.variables?.search !== search)
  );
  return (
    <>
      {createNewFolderModalOpen && (
        <EditFolderModal
          className="z-30"
          folderId={folderId}
          onRequestClose={async (created) => {
            if (created) {
              await tocQuery.refetch();
            }
            setFolderId(undefined);
            setCreateNewFolderModalOpen(false);
          }}
          createNew={createNewFolderModalOpen}
        />
      )}
      {folderId && (
        <FolderEditor
          id={folderId}
          onRequestClose={() => {
            setFolderId(undefined);
          }}
        />
      )}
      {publishOpen && (
        <PublishTableOfContentsModal
          onRequestClose={() => {
            setPublishOpen(false);
            // Hack so that tooltip doesn't reappear after publishing
            document.getElementById("publish-button")?.blur();
            setTimeout(() => {
              document.getElementById("publish-button")?.blur();
            }, 10);
          }}
        />
      )}
      {tocQuery.data?.projectBySlug?.id && (
        <Header
          searchLoading={searching}
          search={search}
          onSearchChange={setSearch}
          hasLocalState={hasLocalState}
          resetLocalState={resetLocalState}
          openArcGISCart={() => {
            setArcgisCartOpen(true);
          }}
          onRequestOpenFolder={() => {
            setCreateNewFolderModalOpen(true);
          }}
          map={mapContext.manager?.map}
          region={tocQuery.data?.projectBySlug?.region.geojson}
          selectedView={selectedView}
          setSelectedView={setSelectedView}
          onRequestPublish={() => setPublishOpen(true)}
          publishDisabled={
            tocQuery.data?.projectBySlug?.draftTableOfContentsHasChanges ===
            false
          }
          lastPublished={
            tocQuery.data?.projectBySlug?.tableOfContentsLastPublished
              ? new Date(
                  tocQuery.data.projectBySlug.tableOfContentsLastPublished!
                )
              : undefined
          }
        />
      )}
      <div
        className="flex-1 overflow-y-auto p-2 px-8"
        onContextMenu={(e) => e.preventDefault()}
      >
        {tocQuery.loading && !tocQuery.data?.projectBySlug && <Spinner />}

        <Route exact path={`/${slug}/admin/data`}>
          <>
            {search &&
              search.length > 1 &&
              filteredTreeNodes.length === 0 &&
              searchResults.loading &&
              !searchResults.error && (
                <div className="w-72 mx-auto flex items-center space-x-2 text-gray-400 py-12 justify-center">
                  <SearchIcon className="w-8 h-8" />
                  <div>
                    <Trans ns="homepage">Searching for overlays...</Trans>
                  </div>
                </div>
              )}
            {search &&
              search.length > 1 &&
              filteredTreeNodes.length === 0 &&
              !searchResults.loading &&
              !searchResults.error && (
                <div className="w-72 mx-auto flex justify-center items-center space-x-2 text-gray-400 py-12">
                  {/* <SearchIcon className="w-8 h-8" /> */}
                  <XIcon className="w-8 h-8" />
                  <div>
                    <Trans ns="homepage">No matching overlays found</Trans>
                  </div>
                </div>
              )}
            {searchResults.error && (
              <div className="w-72 mx-auto text-red-500 py-12">
                <div className="flex items-center space-x-2">
                  <XCircleIcon className="w-8 h-8" />
                  <div>
                    <Trans ns="homepage">Error searching overlays</Trans>
                  </div>
                </div>
                <p className="text-sm mt-2">{searchResults.error.message}</p>
              </div>
            )}
            <div
              className={
                "transition-opacity " +
                (searching ? "opacity-50" : "opacity-100")
              }
            >
              <TreeView
                highlights={searchState.highlights}
                loadingItems={loadingItems}
                errors={overlayErrors}
                expanded={expandedIds}
                disableEditing={isFiltered}
                onExpand={onExpand}
                checkedItems={checkedItems}
                onChecked={onChecked}
                hiddenItems={hiddenItems}
                onUnhide={onUnhide}
                items={filteredTreeNodes}
                ariaLabel="Draft overlays"
                onSortEnd={onSortEnd}
                getContextMenuContent={(treeItemId, clickEvent) => {
                  const item =
                    tocQuery.data?.projectBySlug?.draftTableOfContentsItems?.find(
                      (item) => item.stableId === treeItemId
                    );
                  const sorted =
                    mapContext.manager?.getVisibleLayersByZIndex() || [];
                  if (item) {
                    return (
                      <TableOfContentsItemMenu
                        items={[item]}
                        type={ContextMenu}
                        editable
                        transform={{
                          x: clickEvent.clientX,
                          y: clickEvent.clientY,
                        }}
                        top={sorted[0].tocId === item.stableId}
                        bottom={
                          sorted[sorted.length - 1].tocId === item.stableId
                        }
                      />
                    );
                  } else {
                    return null;
                  }
                }}
              />
            </div>
          </>
        </Route>
        <Route path={`/${slug}/admin/data/zindex`}>
          <ZIndexEditableList // @ts-ignore
            tableOfContentsItems={
              tocQuery.data?.projectBySlug?.draftTableOfContentsItems
            }
            // @ts-ignore
            dataLayers={
              layersAndSources.data?.projectBySlug?.dataLayersForItems
            }
            // @ts-ignore
            dataSources={
              layersAndSources.data?.projectBySlug?.dataSourcesForItems
            }
          />
        </Route>
      </div>
      {layerEditingContext.openEditor && (
        <LayerTableOfContentsItemEditor
          onRequestClose={() => layerEditingContext.setOpenEditor(undefined)}
          itemId={layerEditingContext.openEditor}
        />
      )}
      {layerEditingContext.openMetadataEditor && (
        <TableOfContentsMetadataEditor
          id={layerEditingContext.openMetadataEditor}
          onRequestClose={() =>
            layerEditingContext.setOpenMetadataEditor(undefined)
          }
        />
      )}
      {arcgisCartOpen && (
        <Suspense fallback={<FullScreenLoadingSpinner />}>
          <LazyArcGISCartModal
            projectId={tocQuery.data?.projectBySlug?.id as number}
            region={tocQuery.data?.projectBySlug?.region.geojson}
            onRequestClose={() => setArcgisCartOpen(false)}
            importedArcGISServices={
              (tocQuery.data?.projectBySlug?.importedArcgisServices ||
                []) as string[]
            }
          />
        </Suspense>
      )}
    </>
  );
}

function Header({
  selectedView,
  setSelectedView,
  region,
  map,
  onRequestOpenFolder,
  onRequestPublish,
  publishDisabled,
  lastPublished,
  openArcGISCart,
  hasLocalState,
  resetLocalState,
  search,
  onSearchChange,
  searchLoading,
}: {
  selectedView: string;
  setSelectedView: (view: string) => void;
  region?: Feature<any>;
  map?: Map;
  onRequestOpenFolder: () => void;
  onRequestPublish: () => void;
  publishDisabled?: boolean;
  lastPublished?: Date;
  openArcGISCart: () => void;
  hasLocalState?: boolean;
  resetLocalState?: () => void;
  onSearchChange?: (search: string) => void;
  search?: string;
  searchLoading?: boolean;
}) {
  const inputRef = React.useRef<HTMLInputElement>(null);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (
        (e.key === "/" || e.key === "?") &&
        // @ts-ignore
        "tagName" in e.target &&
        e.target.tagName !== "INPUT"
      ) {
        e.preventDefault();
        inputRef.current?.focus();
      }
    };
    document.body.addEventListener("keydown", handler);
    return () => {
      document.body.removeEventListener("keydown", handler);
    };
  }, [inputRef]);

  const uploadContext = useContext(DataUploadDropzoneContext);
  const { t } = useTranslation("admin:data");
  return (
    <header className="w-128 z-20 flex-none border-b shadow-sm bg-gray-100 mt-2 text-sm border-t px-1">
      <Menubar.Root className="flex p-1 py-0.5 rounded-md z-50 items-center">
        <Menubar.Menu>
          <MenubarTrigger>{t("View")}</MenubarTrigger>
          <Menubar.Portal>
            <MenuBarContent>
              <Menubar.RadioGroup
                value={selectedView}
                onValueChange={setSelectedView}
              >
                <MenubarRadioItem value="tree">
                  <Trans ns="admin:data">Table of Contents</Trans>
                </MenubarRadioItem>
                <MenubarRadioItem value="order">
                  <Trans ns="admin:data">Layer Z-Ordering</Trans>
                </MenubarRadioItem>
              </Menubar.RadioGroup>
              <MenuBarSeparator />
              <MenuBarItem
                disabled={!region || !map}
                onClick={() => {
                  if (region && map) {
                    map.fitBounds(
                      bbox(region) as [number, number, number, number],
                      {
                        padding: {
                          top: 20,
                          bottom: 20,
                          left: 150,
                          right: 20,
                        },
                      }
                    );
                  }
                }}
              >
                <Trans ns="admin:data">Zoom to Project Bounds</Trans>
              </MenuBarItem>
              {resetLocalState && (
                <MenuBarItem
                  disabled={!hasLocalState}
                  onClick={() => {
                    resetLocalState();
                  }}
                >
                  <Trans ns="homepage">Reset overlays</Trans>
                </MenuBarItem>
              )}
            </MenuBarContent>
          </Menubar.Portal>
        </Menubar.Menu>
        <Menubar.Menu>
          <MenubarTrigger>{t("Edit")}</MenubarTrigger>
          <Menubar.Portal>
            <MenuBarContent>
              <MenuBarItem onClick={onRequestOpenFolder}>
                <Trans ns="admin:data">Add Folder</Trans>
              </MenuBarItem>
              <MenuBarSubmenu label={t("Add Data")}>
                <MenuBarLabel>{t("Host data on SeaSketch")}</MenuBarLabel>
                <MenuBarItem
                  onClick={() => {
                    const fileInput = document.createElement("input");
                    fileInput.type = "file";
                    fileInput.accept = ".zip,.json,.geojson,.fgb,.tif,.tiff";
                    fileInput.multiple = true;
                    fileInput.onchange = async (e) => {
                      const files = (e.target as HTMLInputElement).files;
                      if (!files) {
                        return;
                      }
                      uploadContext.handleFiles([...files]);
                    };
                    fileInput.click();
                  }}
                >
                  {t("Upload spatial data files")}
                </MenuBarItem>
                <MenuBarSeparator />
                <MenuBarLabel>{t("Connect to data services")}</MenuBarLabel>
                <MenuBarItem
                  onClick={() => {
                    openArcGISCart();
                  }}
                >
                  {t("Esri ArcGIS Service...")}
                </MenuBarItem>
              </MenuBarSubmenu>
            </MenuBarContent>
          </Menubar.Portal>
        </Menubar.Menu>
        <div className="flex items-center relative">
          <input
            ref={inputRef}
            value={search}
            onChange={
              onSearchChange ? (e) => onSearchChange(e.target.value) : undefined
            }
            type="text"
            id="search"
            placeholder={t("search layers")}
            className="ml-3 text-sm h-6 rounded bg-gray-50 outline-none border-gray-300 pr-12"
          />
          <div className="w-10 h-6 -ml-12 relative flex items-center">
            <div
              className={
                (searchLoading ? "opacity-100" : "opacity-0") +
                " transition-opacity duration-300 delay-100 flex items-center"
              }
            >
              <Spinner className={`z-10 scale-90 transform`} />
            </div>
            {Boolean(search?.length) && (
              <button
                onClick={onSearchChange ? () => onSearchChange("") : undefined}
              >
                <XCircleIcon className="w-4 h-4 text-gray-500 right-0 top-1 absolute" />
              </button>
            )}
          </div>
        </div>
        <div className="flex-1 text-right">
          <Tooltip.Provider>
            <Tooltip.Root delayDuration={200}>
              <Tooltip.Trigger asChild>
                <button
                  id="publish-button"
                  className={`${
                    publishDisabled
                      ? "bg-white text-black opacity-80"
                      : "bg-primary-500 text-white"
                  } rounded px-2 py-0.5 mx-1 shadow-sm`}
                  onClick={onRequestPublish}
                >
                  <Trans ns="admin:data">Publish</Trans>
                </button>
              </Tooltip.Trigger>
              <Tooltip.Portal>
                <Tooltip.Content
                  style={{ maxWidth: 220 }}
                  className="z-50 select-none rounded bg-white px-4 py-2 shadow text-center"
                  // sideOffset={-200}
                  side="right"
                >
                  {publishDisabled ? (
                    t("No changes")
                  ) : (
                    <span>
                      {t("Has changes since last publish")}
                      {lastPublished
                        ? " on " + lastPublished.toLocaleDateString()
                        : null}
                    </span>
                  )}
                  <Tooltip.Arrow className="" style={{ fill: "white" }} />
                </Tooltip.Content>
              </Tooltip.Portal>
            </Tooltip.Root>
          </Tooltip.Provider>
        </div>
      </Menubar.Root>
    </header>
  );
}
