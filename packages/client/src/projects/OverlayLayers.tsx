import { useState, useEffect, useContext } from "react";
import TableOfContents, {
  ClientTableOfContentsItem,
  createBoundsRecursive,
  nestItems,
} from "../dataLayers/tableOfContents/TableOfContents";
import { Item } from "react-contexify";

import TableOfContentsMetadataModal from "../dataLayers/TableOfContentsMetadataModal";
import { TableOfContentsItem } from "../generated/graphql";
import useLocalStorage from "../useLocalStorage";
import { MapContext } from "../dataLayers/MapContextManager";

export default function OverlayLayers({
  items,
}: {
  items: TableOfContentsItem[];
}) {
  const mapContext = useContext(MapContext);
  const [nodes, setNodes] = useState<ClientTableOfContentsItem[]>([]);
  const [openMetadataViewerId, setOpenMetadataViewerId] = useState<number>();
  const [expansionState, setExpansionState] = useLocalStorage<{
    [id: number]: boolean;
  }>("overlays-expansion-state", {});
  useEffect(() => {
    setNodes(nestItems(items, expansionState));
  }, [items, expansionState]);

  return (
    <div className="mt-3">
      {openMetadataViewerId && (
        <TableOfContentsMetadataModal
          id={openMetadataViewerId}
          onRequestClose={() => setOpenMetadataViewerId(undefined)}
        />
      )}
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
        contextMenuId="layers-toc-editor"
        contextMenuItems={[
          <Item
            key="zoom-to"
            hidden={(args) => {
              return !args.props.item.isFolder && !args.props.item.bounds;
            }}
            className="text-sm hover:bg-primary-500"
            onClick={(args) => {
              let bounds: [number, number, number, number] | undefined;
              if (args.props.item.isFolder) {
                // bounds = null;
                bounds = createBoundsRecursive(args.props.item);
              } else {
                if (args.props.item.bounds) {
                  bounds = args.props.item.bounds.map((coord: string) =>
                    parseFloat(coord)
                  );
                }
              }
              if (
                bounds &&
                [180.0, 90.0, -180.0, -90.0].join(",") !== bounds.join(",")
              ) {
                mapContext.manager?.map?.fitBounds(bounds, {
                  padding: 40,
                });
              }
            }}
          >
            Zoom To
          </Item>,
          <Item
            key="2"
            hidden={(args) => args.props?.item?.isFolder}
            className="text-sm"
            onClick={(args) => {
              setOpenMetadataViewerId(args.props.item.id);
            }}
          >
            Metadata
          </Item>,
        ]}
      />
    </div>
  );
}
