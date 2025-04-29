import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import * as ContextMenu from "@radix-ui/react-context-menu";
import * as MenuBar from "@radix-ui/react-menubar";
import React, { Suspense, useContext, useEffect, useState } from "react";
import { TableOfContentsItem } from "../../generated/graphql";
import { Trans } from "react-i18next";
import { MapContext } from "../../dataLayers/MapContextManager";
import {
  MenuBarContentClasses,
  MenuBarItemClasses,
  MenuBarSeparatorProps,
} from "../../components/Menubar";
import { TableOfContentsMetadataModalContext } from "../../dataLayers/TableOfContentsMetadataModal";
import Skeleton from "../../components/Skeleton";
import { ArrowDownIcon, ArrowUpIcon } from "@radix-ui/react-icons";
import { createPortal } from "react-dom";
import DataDownloadModal, {
  DataDownloadModalContext,
} from "../../dataLayers/DataDownloadModal";
import { TreeItem } from "../../components/TreeView";
const LazyAdminItems = React.lazy(
  () =>
    import(
      /* webpackChunkName: "TableOfContentsItemAdminMenuItems" */ "./TableOfContentsItemAdminMenuItems"
    )
);

export const TableOfContentsItemMenu = React.forwardRef<
  HTMLDivElement,
  {
    type: typeof DropdownMenu | typeof ContextMenu | typeof MenuBar;
    items: TocMenuItemType[];
    editable?: boolean;
    transform?: { x: number; y: number };
    top?: boolean;
    bottom?: boolean;
    onExpand?: (node: TreeItem, isExpanded: boolean) => void;
  }
>(
  (
    {
      top,
      bottom,
      transform,
      type = DropdownMenu,
      items,
      editable,
      onExpand,
      ...props
    },
    forwardedRef
  ) => {
    const MenuType = type;
    const mapContext = useContext(MapContext);
    const dataDownloadModalContext = useContext(DataDownloadModalContext);

    const [opacity, setOpacity] = useState(
      mapContext.layerStatesByTocStaticId[items[0]?.stableId]?.opacity || 1
    );

    const currentOpacity =
      mapContext.layerStatesByTocStaticId[items[0]?.stableId]?.opacity;

    const firstItem = items[0];
    useEffect(() => {
      const setting =
        mapContext.layerStatesByTocStaticId[firstItem.stableId]?.opacity;
      if (typeof setting === "number") {
        setOpacity(setting);
      } else {
        setOpacity(1);
      }
    }, [currentOpacity]);

    // TODO: adjust this value as context menu grows in size
    const intersectsBottom = (transform?.y || 0) > window.innerHeight - 260;
    const metadataContext = useContext(TableOfContentsMetadataModalContext);
    const manager = mapContext.manager;
    return (
      <MenuType.Content
        // avoidCollisions={false}
        {...props}
        ref={forwardedRef}
        style={{
          // @ts-ignore
          ...(props.style || {}),
          ...(transform
            ? {
                transform: `translate(${transform.x}px, ${transform.y}px)${
                  intersectsBottom ? ` translateY(-100%)` : ""
                }`,
              }
            : {}),
          backdropFilter: "blur(3px)",
        }}
        className={MenuBarContentClasses}
        {...(type === ContextMenu || type === DropdownMenu
          ? {
              align: "start",
              sideOffset: 5,
            }
          : {})}
      >
        {dataDownloadModalContext.dataDownloadModal &&
          createPortal(
            <DataDownloadModal
              tocId={dataDownloadModalContext.dataDownloadModal}
              //@ts-ignore
              onRequestClose={dataDownloadModalContext.setDataDownloadModal}
            />,
            document.body
          )}
        {!manager ||
          (!mapContext.ready && (
            <MenuType.Label>
              <Trans ns="admin">MapContext is not ready</Trans>
            </MenuType.Label>
          ))}
        {manager && mapContext.ready && items.length > 1 && (
          <MenuType.Label>
            <Trans ns="admin">
              Menus for multiple-selections not yet supported
            </Trans>
          </MenuType.Label>
        )}
        {items.length === 1 && manager && mapContext.ready && (
          <Suspense
            fallback={
              <>
                <MenuType.Item className={MenuBarItemClasses}>
                  <Skeleton className="w-32 h-4" />
                </MenuType.Item>
                <MenuType.Item className={MenuBarItemClasses}>
                  <Skeleton className="w-32 h-4" />
                </MenuType.Item>
                <MenuType.Item className={MenuBarItemClasses}>
                  <Skeleton className="w-32 h-4" />
                </MenuType.Item>
                <MenuType.Item className={MenuBarItemClasses}>
                  <Skeleton className="w-32 h-4" />
                </MenuType.Item>
              </>
            }
          >
            <>
              {!firstItem.isFolder && (
                <>
                  <MenuType.Item
                    onSelect={() => {
                      manager.zoomToTocItem(firstItem.stableId);
                    }}
                    className={MenuBarItemClasses}
                  >
                    <Trans ns="homepage">Zoom to bounds</Trans>
                  </MenuType.Item>
                  <MenuType.Item
                    className={MenuBarItemClasses}
                    onSelect={() => {
                      metadataContext.open(firstItem.id, firstItem.title);
                    }}
                  >
                    <Trans ns="homepage">View metadata</Trans>
                  </MenuType.Item>
                  {firstItem.enableDownload && firstItem.primaryDownloadUrl && (
                    <MenuType.Item
                      className={MenuBarItemClasses}
                      onSelect={(e) => {
                        dataDownloadModalContext.setDataDownloadModal(
                          firstItem.id
                        );
                      }}
                    >
                      <Trans ns="homepage">Download...</Trans>
                    </MenuType.Item>
                  )}
                  <MenuType.Item
                    disabled={top}
                    className={MenuBarItemClasses}
                    onSelect={() => {
                      mapContext?.manager?.moveLayerToTop(firstItem.stableId);
                    }}
                  >
                    <span>
                      <Trans ns="homepage">Move to front</Trans>
                    </span>
                    <ArrowUpIcon className="w-3 h-3" />
                  </MenuType.Item>
                  <MenuType.Item
                    disabled={bottom}
                    className={MenuBarItemClasses}
                    onSelect={() => {
                      mapContext?.manager?.moveLayerToBottom(
                        firstItem.stableId
                      );
                    }}
                  >
                    <span>
                      <Trans ns="homepage">Move to back</Trans>
                    </span>
                    <ArrowDownIcon className="w-3 h-3" />
                  </MenuType.Item>
                  {mapContext.layerStatesByTocStaticId[firstItem?.stableId]
                    ?.visible === true && (
                    <MenuType.Item
                      className={`text-sm px-2`}
                      onClick={(e) => e.preventDefault()}
                      disabled={
                        mapContext.layerStatesByTocStaticId[firstItem?.stableId]
                          ?.visible !== true
                      }
                    >
                      <div>
                        <Trans ns="homepage">Opacity</Trans>
                      </div>
                      <input
                        type="range"
                        id="opacity"
                        value={opacity}
                        onChange={(e) => {
                          const val = parseFloat(e.target.value);
                          setOpacity(val);
                          mapContext.manager?.setLayerOpacity(
                            firstItem.stableId,
                            val
                          );
                        }}
                        name="opacity"
                        min="0"
                        max="1"
                        step="0.05"
                      />
                    </MenuType.Item>
                  )}
                </>
              )}
              {editable && (
                <>
                  {!firstItem.isFolder && (
                    <MenuType.Separator {...MenuBarSeparatorProps} />
                  )}
                  <LazyAdminItems
                    type={type}
                    items={items}
                    onExpand={onExpand}
                  />
                </>
              )}
            </>
          </Suspense>
        )}
      </MenuType.Content>
    );
  }
);

export type TocMenuItemType = Pick<
  TableOfContentsItem,
  | "stableId"
  | "isFolder"
  | "enableDownload"
  | "id"
  | "title"
  | "primaryDownloadUrl"
  | "dataSourceType"
>;
