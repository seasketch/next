import { useMemo, useState } from "react";
import {
  AdminOverlayFragment,
  DataLayerDetailsFragment,
  DataSourceTypes,
  DataUploadOutputType,
  OverlayFragment,
  useQuotaUsageDetailsQuery,
} from "../../generated/graphql";
import { Trans } from "react-i18next";
import bytes from "bytes";
import { hierarchy, treemap as d3Treemap } from "d3-hierarchy";
import { scaleSequential } from "d3-scale";
import { interpolateBlues as interpolateColor } from "d3-scale-chromatic";
import { TableOfContentsItemFolderBreadcrumbs } from "./LayerTableOfContentsItemEditor";

interface Node {
  type: "node" | "leaf";
  name: string;
  value: number;
  children?: Node[];
  stableId?: string;
  id: string;
  items: AdminOverlayFragment[];
  quotaDetails: {
    bytes: number;
    id: number;
    isOriginal?: boolean;
    type: DataUploadOutputType;
  }[];
}

export default function QuotaUsageTreemap({
  slug,
  tableOfContentsItems,
  layers,
  width,
  height,
}: {
  slug: string;
  tableOfContentsItems: AdminOverlayFragment[];
  layers: DataLayerDetailsFragment[];
  width: number;
  height: number;
}) {
  const [hovered, setHovered] = useState<null | {
    x: number;
    y: number;
    tableOfContentsItems: AdminOverlayFragment[];
    quotaDetails: {
      bytes: number;
      id: number;
      isOriginal?: boolean;
      type: DataUploadOutputType;
    }[];
  }>(null);
  const { data, loading, error } = useQuotaUsageDetailsQuery({
    variables: {
      slug,
    },
  });

  const treeLayout = useMemo(() => {
    const root: Node = {
      type: "node",
      name: "",
      value: 0,
      children: [],
      id: "root",
      items: [],
      quotaDetails: [],
    };

    if (!tableOfContentsItems?.length || !layers?.length) {
      return null;
    }
    function addFolder(node: Node) {
      const childFolders = tableOfContentsItems.filter(
        (i) =>
          ((!node.stableId && !i.parentStableId) ||
            i.parentStableId === node.stableId) &&
          i.isFolder
      );
      for (const folder of childFolders) {
        const child: Node = {
          type: "node",
          name: folder.title,
          items: [folder],
          value: 0,
          children: [],
          stableId: folder.stableId,
          id: "folder-" + folder.id,
          quotaDetails: [],
        };
        node.children!.push(child);
        addFolder(child);
      }
      // add layers with matching type
      const childItems = tableOfContentsItems.filter(
        (i) =>
          ((!node.stableId && !i.parentStableId) ||
            i.parentStableId === node.stableId) &&
          !i.isFolder &&
          (i.dataSourceType === DataSourceTypes.SeasketchMvt ||
            i.dataSourceType === DataSourceTypes.SeasketchVector ||
            i.dataSourceType === DataSourceTypes.SeasketchRaster)
      );
      const dataSourceDetails = {} as {
        [sourceId: number]: {
          sourceId: number;
          tableOfContentsItems: AdminOverlayFragment[];
          quotaDetails: {
            bytes: number;
            id: number;
            isOriginal?: boolean;
            type: DataUploadOutputType;
          }[];
        };
      };
      for (const item of childItems) {
        const layer = layers.find((l) => l.id === item.dataLayerId);
        if (layer && layer.dataSourceId) {
          const quotaDetails = (
            data?.projectBySlug?.uploadedDraftDataSources || []
          ).find((d) => d.id === layer.dataSourceId);
          if (quotaDetails) {
            if (!dataSourceDetails[layer.dataSourceId]) {
              dataSourceDetails[layer.dataSourceId] = {
                sourceId: layer.dataSourceId,
                tableOfContentsItems: [],
                quotaDetails: (quotaDetails.quotaUsed || []).map((q) => ({
                  bytes: parseInt(q.bytes),
                  id: q.id as number,
                  isOriginal: q.isOriginal as boolean,
                  type: q.type as DataUploadOutputType,
                })),
              };
            }
            dataSourceDetails[layer.dataSourceId].tableOfContentsItems.push(
              item
            );
          }
        } else {
          // console.error(`Layer ${item.id} has no dataSourceId`);
          throw new Error(`Layer ${item.id} has no dataSourceId`);
        }
      }
      for (const sourceId in dataSourceDetails) {
        const source = dataSourceDetails[sourceId];
        const child: Node = {
          type: "leaf",
          name: source.tableOfContentsItems.map((i) => i.title).join(", "),
          value: source.quotaDetails.reduce((acc, q) => acc + q.bytes, 0),
          id: "source-" + source.sourceId,
          items: source.tableOfContentsItems,
          quotaDetails: source.quotaDetails,
        };
        node.children!.push(child);
        node.value += child.value;
      }
    }
    if (tableOfContentsItems) {
      addFolder(root);
    }
    // Recursively go through each node and sort children by value, then set the
    // value to zero for nodes which have children
    function sortChildren(node: Node) {
      if (node.children) {
        // nodes without children should go at top of the list, otherwise sort
        // by value
        node.children = node.children.sort((a, b) => {
          if (a.type === "node" && b.type === "leaf") {
            return -1;
          }
          if (a.type === "leaf" && b.type === "node") {
            return 1;
          }
          return b.value - a.value;
        });
        for (const child of node.children) {
          sortChildren(child);
        }
        node.value = 0;
      }
    }
    sortChildren(root);
    const treemap = d3Treemap<{
      name: string;
      value: number;
      id: string;
      items: AdminOverlayFragment[];
      quotaDetails: {
        bytes: number;
        id: number;
        isOriginal?: boolean;
        type: DataUploadOutputType;
      }[];
    }>()
      .size([width, height])
      .paddingOuter(4)
      .paddingTop(24)
      .paddingInner(1)
      .round(true);
    const h = hierarchy<{
      name: string;
      value: number;
      id: string;
      items: AdminOverlayFragment[];
      quotaDetails: {
        bytes: number;
        id: number;
        isOriginal?: boolean;
        type: DataUploadOutputType;
      }[];
    }>(root)
      .sum((d) => d.value)
      .sort((a, b) => a.data.value - b.data.value);
    // @ts-ignore
    const treeLayout = treemap(h);

    const color = scaleSequential([8, 1], interpolateColor);

    const uid = (id: string) => {
      return new URL(`#${id}`, window.location.toString()).href;
    };
    const rects = treeLayout.descendants().map((d) => {
      return (
        <g
          className="text-xs"
          key={d.data.id}
          transform={`translate(${d.x0},${d.y0})`}
          style={d.data.name === "" ? { display: "none" } : undefined}
        >
          <rect
            onMouseOut={
              !d.children
                ? (e) => {
                    setHovered(null);
                  }
                : undefined
            }
            onMouseOver={
              !d.children
                ? (e) => {
                    setHovered({
                      x: e.clientX,
                      y: e.clientY,
                      tableOfContentsItems: d.data.items,
                      quotaDetails: d.data.quotaDetails,
                    });
                  }
                : undefined
            }
            // onMouseMove={
            //   !d.children
            //     ? (e) => {
            //         setHovered({
            //           x: e.clientX,
            //           y: e.clientY,
            //           tableOfContentsItems: d.data.items,
            //           quotaDetails: d.data.quotaDetails,
            //         });
            //       }
            //     : undefined
            // }
            className={`opacity-95 ${!d.children ? "cursor-pointer" : ""}`}
            id={"node-" + d.data.id}
            fill={d.height === 0 ? "#eee" : color(d.height)}
            width={d.x1 - d.x0}
            height={d.y1 - d.y0}
          ></rect>

          <clipPath id={`clip-${d.data.id}`}>
            <use href={uid(`node-${d.data.id}`)} />
          </clipPath>
          <text
            style={{
              pointerEvents: "none",
            }}
            clipPath={`url(${uid(`clip-${d.data.id}`)})`}
            fill={d.height === 0 ? "black" : "white"}
            x={3}
            y={d.children ? 16 : 13}
          >
            <tspan>
              {d.data.name}{" "}
              {d.children
                ? bytes(d.value || 0, {
                    decimalPlaces: 1,
                  })
                : null}
            </tspan>
            {!d.children && (
              <tspan x={3} y={27} className="opacity-60">
                {bytes(d.value || 0, {
                  decimalPlaces: 1,
                  unitSeparator: " ",
                })}
              </tspan>
            )}
          </text>
        </g>
      );
    });
    if (rects.length === 1) {
      return null;
    } else {
      return rects;
    }
  }, [data, layers, tableOfContentsItems, height, width]);

  if (!tableOfContentsItems || !layers) {
    return null;
  }

  return (
    <>
      {treeLayout ? (
        <svg
          width={width}
          height={height}
          style={{ marginLeft: -4, marginTop: -10 }}
        >
          {treeLayout}
        </svg>
      ) : null}
      {hovered && (
        <div
          className="absolute z-30 bg-white rounded shadow border p-2 text-sm w-72"
          style={{
            bottom: window.innerHeight - hovered.y,
            left: hovered.x - 220,
          }}
        >
          <div>
            {hovered.tableOfContentsItems.map((item) => {
              const parents: OverlayFragment[] = [];
              let i = item;
              while (i.parentStableId) {
                const parent = tableOfContentsItems.find(
                  (p) => p.stableId === i.parentStableId
                );
                if (parent) {
                  parents.push(parent);
                  i = parent;
                } else {
                  break;
                }
              }
              parents.reverse();
              return (
                <div className="">
                  <div className="truncate font-semibold mb-1">
                    {item.title}
                  </div>
                  <div className="-ml-1.5 text-xs text-gray-500 truncate">
                    {parents.length > 0 && (
                      <TableOfContentsItemFolderBreadcrumbs parents={parents} />
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {hovered.quotaDetails
            .sort((a, b) => b.type.localeCompare(a.type))
            .map((q) => (
              <div className="flex w-full">
                <div className="flex-1">
                  {humanizeOutputType(q.type)} {q.isOriginal && "(Original)"}
                </div>
                <div>
                  {bytes(q.bytes, {
                    decimalPlaces: 1,
                    unitSeparator: " ",
                  })}
                </div>
              </div>
            ))}
          <div className="flex w-full border-t mt-0.5 pt-0.5">
            <div className="flex-1">
              <Trans ns="admin:data">Total</Trans>
            </div>
            <div>
              {bytes(
                hovered.quotaDetails.reduce((acc, q) => acc + q.bytes, 0),
                {
                  decimalPlaces: 1,
                  unitSeparator: " ",
                }
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}

export function humanizeOutputType(type: DataUploadOutputType) {
  switch (type) {
    case DataUploadOutputType.FlatGeobuf:
      return "FlatGeoBuf";
    case DataUploadOutputType.GeoJson:
      return "GeoJSON";
    case DataUploadOutputType.GeoTiff:
      return "GeoTiff";
    case DataUploadOutputType.Pmtiles:
      return "Map Tiles";
    case DataUploadOutputType.ZippedShapefile:
      return "Shapefile";
    case DataUploadOutputType.Png:
      return "PNG Image";
    default:
      return type;
  }
}
