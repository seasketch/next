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
  }
>(
  (
    { transform, type = DropdownMenu, items, editable, ...props },
    forwardedRef
  ) => {
    const MenuType = type;
    const mapContext = useContext(MapContext);

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

    const intersectsBottom = (transform?.y || 0) > window.innerHeight - 160;
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
                      metadataContext.open(firstItem.id);
                    }}
                  >
                    <Trans ns="homepage">View metadata</Trans>
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
                  <LazyAdminItems type={type} items={items} />
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
  "stableId" | "isFolder" | "enableDownload" | "id" | "title"
>;
