import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import * as ContextMenu from "@radix-ui/react-context-menu";
import * as MenuBar from "@radix-ui/react-menubar";
import React, { Suspense, useContext } from "react";
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
    const intersectsBottom = (transform?.y || 0) > window.innerHeight - 160;
    const metadataContext = useContext(TableOfContentsMetadataModalContext);
    if (!mapContext.manager || !mapContext.ready) {
      return (
        <MenuType.Content
          {...props}
          ref={forwardedRef}
          className={MenuBarContentClasses}
          style={{
            // @ts-ignore
            ...(props.style || {}),
            ...(transform
              ? { transform: `translate(${transform.x}px, ${transform.y}px)` }
              : {}),
            backdropFilter: "blur(3px)",
            marginTop: intersectsBottom ? "-90%" : 0,
          }}
        >
          <MenuType.Label>
            <Trans ns="admin">MapContext is not ready</Trans>
          </MenuType.Label>
        </MenuType.Content>
      );
    }
    const manager = mapContext.manager;
    if (items.length > 1) {
      return (
        <MenuType.Content
          {...props}
          ref={forwardedRef}
          className={MenuBarContentClasses}
          style={{
            // @ts-ignore
            ...(props.style || {}),
            ...(transform
              ? { transform: `translate(${transform.x}px, ${transform.y}px)` }
              : {}),
            backdropFilter: "blur(3px)",
            marginTop: intersectsBottom ? "-90%" : 0,
          }}
        >
          <MenuType.Label>
            <Trans ns="admin">
              Menus for multiple-selections not yet supported
            </Trans>
          </MenuType.Label>
        </MenuType.Content>
      );
    }
    const item = items[0];
    return (
      <MenuType.Content
        {...props}
        ref={forwardedRef}
        style={{
          // @ts-ignore
          ...(props.style || {}),
          ...(transform
            ? { transform: `translate(${transform.x}px, ${transform.y}px)` }
            : {}),
          backdropFilter: "blur(3px)",
          marginTop: intersectsBottom ? "-90%" : 0,
        }}
        className={MenuBarContentClasses}
        {...(type === ContextMenu || type === DropdownMenu
          ? {
              align: "start",
              sideOffset: 5,
            }
          : {})}
      >
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
          {!item.isFolder && (
            <>
              <MenuType.Item
                onSelect={() => {
                  manager.zoomToTocItem(item.stableId);
                }}
                className={MenuBarItemClasses}
              >
                <Trans ns="homepage">Zoom to bounds</Trans>
              </MenuType.Item>
              <MenuType.Item
                className={MenuBarItemClasses}
                onSelect={() => {
                  metadataContext.open(item.id);
                }}
              >
                <Trans ns="homepage">View metadata</Trans>
              </MenuType.Item>
            </>
          )}
          {editable && (
            <>
              {!item.isFolder && (
                <MenuType.Separator {...MenuBarSeparatorProps} />
              )}
              <LazyAdminItems type={type} items={items} />
            </>
          )}
        </Suspense>
      </MenuType.Content>
    );
  }
);

export type TocMenuItemType = Pick<
  TableOfContentsItem,
  "stableId" | "isFolder" | "enableDownload" | "id" | "title"
>;
