import { MouseEvent, useCallback, useEffect } from "react";
import VisibilityCheckbox from "../../dataLayers/tableOfContents/VisibilityCheckbox";

export default function SketchItem({
  nodeProps,
  handleSelect,
  level,
  isDisabled,
  isSelected,
  onContextMenu,
  id,
  name,
  parentFolderId,
  parentCollectionId,
}: {
  id: number;
  name: string;
  nodeProps: any;
  handleSelect: (e: MouseEvent) => void;
  level: number;
  isDisabled?: boolean;
  isSelected?: boolean;
  onContextMenu: (e: MouseEvent<HTMLDivElement, globalThis.MouseEvent>) => void;
  parentFolderId?: number | null;
  parentCollectionId?: number | null;
}) {
  return (
    <div
      // onFocus={(e) => {
      //   setFocused({
      //     type: data.__typename === "SketchFolder" ? "folder" : "sketch",
      //     id: data.id,
      //   });
      // }}
      // onBlur={() => setFocused(null)}
      {...nodeProps}
      onClick={nodeProps.onClick}
      style={{
        marginLeft: 40 * (level - 1) - 3,
        opacity: isDisabled ? 0.5 : 1,
        paddingLeft: 3,
      }}
      className={`py-0.5 ${isSelected ? "bg-blue-200" : ""}`}
      onContextMenu={onContextMenu}
    >
      <span className="flex items-center text-sm space-x-0.5">
        <VisibilityCheckbox
          disabled={Boolean(isDisabled)}
          id={id}
          visibility={false}
        />
        <span className="px-1 cursor-default select-none">{name}</span>
      </span>
    </div>
  );
}
