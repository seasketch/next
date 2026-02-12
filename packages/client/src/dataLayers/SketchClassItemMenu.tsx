import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import React, { useContext, useEffect, useState } from "react";
import { Trans } from "react-i18next";
import {
  ArrowDownIcon,
  ArrowUpIcon,
  DotsHorizontalIcon,
} from "@radix-ui/react-icons";
import {
  MenuBarContentClasses,
  MenuBarItemClasses,
} from "../components/Menubar";
import clsx from "clsx";
import { MapManagerContext, SketchLayerContext } from "./MapContextManager";

export type SketchClassMenuItemType = {
  id: string;
};

export const SketchClassItemMenu = React.forwardRef<
  HTMLDivElement,
  {
    type: typeof DropdownMenu;
    item: SketchClassMenuItemType;
    top?: boolean;
    bottom?: boolean;
    sketchClassId: number;
  }
>(
  (
    { sketchClassId, top, bottom, type = DropdownMenu, item, ...props },
    forwardedRef
  ) => {
    const MenuType = type;

    const { sketchClassLayerStates } = useContext(SketchLayerContext);
    const { manager } = useContext(MapManagerContext);
    const [opacity, setOpacity] = useState(
      sketchClassLayerStates[sketchClassId]?.opacity || 1
    );

    const currentOpacity =
      sketchClassLayerStates[sketchClassId]?.opacity || 1;

    useEffect(() => {
      const setting = sketchClassLayerStates[sketchClassId]?.opacity;
      if (typeof setting === "number") {
        setOpacity(setting);
      } else {
        setOpacity(1);
      }
    }, [currentOpacity]);

    return (
      <MenuType.Content
        {...props}
        ref={forwardedRef}
        className={MenuBarContentClasses}
        side="bottom"
      >
        <MenuType.Item
          disabled={top}
          className={MenuBarItemClasses}
          onSelect={() => {
            manager?.moveLayerToTop(item.id, true);
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
            manager?.moveLayerToBottom(item.id, true);
          }}
        >
          <span>
            <Trans ns="homepage">Move to back</Trans>
          </span>
          <ArrowDownIcon className="w-3 h-3" />
        </MenuType.Item>
        <MenuType.Item
          className={`text-sm px-2`}
          onClick={(e) => e.preventDefault()}
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
              manager?.setSketchClassOpacity(sketchClassId, val);
            }}
            name="opacity"
            min="0"
            max="1"
            step="0.05"
          />
        </MenuType.Item>
      </MenuType.Content>
    );
  }
);
