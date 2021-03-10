import React, { useState, useEffect } from "react";
import TableOfContents, {
  ClientTableOfContentsItem,
  nestItems,
} from "../dataLayers/tableOfContents/TableOfContents";
import { TableOfContentsItem } from "../generated/graphql";
import useLocalStorage from "../useLocalStorage";

export default function OverlayLayers({
  items,
}: {
  items: TableOfContentsItem[];
}) {
  const [nodes, setNodes] = useState<ClientTableOfContentsItem[]>([]);
  const [expansionState, setExpansionState] = useLocalStorage<{
    [id: number]: boolean;
  }>("overlays-expansion-state", {});
  useEffect(() => {
    setNodes(nestItems(items, expansionState));
  }, [items]);

  return (
    <div className="mt-3">
      <TableOfContents
        nodes={nodes}
        onChange={(n) => setNodes(n)}
        onVisibilityToggle={(data) => {
          setExpansionState((prev) => {
            return {
              ...prev,
              [data.node.id]: data.expanded,
            };
          });
        }}
      />
    </div>
  );
}
