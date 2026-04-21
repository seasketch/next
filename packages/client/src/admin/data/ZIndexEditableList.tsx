import {
  CSSProperties,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import {
  DataLayerDetailsFragment,
  DataSourceDetailsFragment,
  OverlayFragment,
  RenderUnderType,
  useUpdateRenderUnderTypeMutation,
  useUpdateZIndexesMutation,
} from "../../generated/graphql";
import {
  LayerState,
  LayerTreeContext,
  MapManagerContext,
} from "../../dataLayers/MapContextManager";
import { Trans } from "react-i18next";
import VisibilityCheckboxAnimated from "../../dataLayers/tableOfContents/VisibilityCheckboxAnimated";
import { FontSizeIcon, HamburgerMenuIcon } from "@radix-ui/react-icons";
import { useTranslation } from "react-i18next";
import { useDrag, useDrop } from "react-dnd";
import { DndProvider } from "react-dnd";
import { HTML5Backend } from "react-dnd-html5-backend";
import type { Identifier, XYCoord } from "dnd-core";
import { FixedSizeList as List } from "react-window";
import AutoSizer from "react-virtualized-auto-sizer";
import { useGlobalErrorHandler } from "../../components/GlobalErrorHandler";

interface DragItem {
  index: number;
  id: string;
  type: string;
  stableId: string;
}

interface SortableItem {
  id: number;
  stableId: string;
  isBasemapLayer: boolean;
  zIndex: number;
  renderUnder: RenderUnderType;
  title?: string;
  dataLayerId: number;
}

export function ZIndexEditableList(props: {
  dataLayers?: DataLayerDetailsFragment[] | null;
  dataSources?: DataSourceDetailsFragment[] | null;
  tableOfContentsItems?: OverlayFragment[];
}) {
  const onError = useGlobalErrorHandler();

  const [sortedItems, setSortedItems] = useState<SortableItem[]>([]);
  const [dropped, setDropped] = useState(false);

  const [updateZIndexes] = useUpdateZIndexesMutation({
    onError,
    optimisticResponse: (data) => {
      let z = 0;
      const layers: { id: number; zIndex: number; __typename: "DataLayer" }[] =
        [];
      for (const id of data.dataLayerIds as number[]) {
        layers.push({ id, zIndex: z++, __typename: "DataLayer" });
      }
      return {
        __typename: "Mutation",
        updateZIndexes: {
          __typename: "UpdateZIndexesPayload",
          dataLayers: layers,
        },
      };
    },
  });
  const [updateRenderUnder] = useUpdateRenderUnderTypeMutation({
    onError,
    optimisticResponse: (data) => {
      return {
        __typename: "Mutation",
        updateDataLayer: {
          __typename: "UpdateDataLayerPayload",
          dataLayer: {
            __typename: "DataLayer",
            id: data.layerId,
            renderUnder: data.renderUnder!,
          },
        },
      };
    },
  });

  useEffect(() => {
    if (dropped) {
      let currentIndex = 0;
      const zIndexes: { [layerId: number]: number } = {};
      const layerIdsInOrder: number[] = [];
      let underLabels = false;
      for (const item of sortedItems) {
        if (item.stableId === "basemapLabels") {
          underLabels = true;
        } else {
          zIndexes[item.id] = currentIndex++;
          layerIdsInOrder.push(item.dataLayerId);
          if (
            (underLabels && item.renderUnder !== RenderUnderType.Labels) ||
            (!underLabels && item.renderUnder !== RenderUnderType.None)
          ) {
            updateRenderUnder({
              variables: {
                layerId: item.dataLayerId,
                renderUnder: underLabels
                  ? RenderUnderType.Labels
                  : RenderUnderType.None,
              },
            });
          }
        }
      }
      updateZIndexes({
        variables: {
          dataLayerIds: layerIdsInOrder,
        },
      });
      setDropped(false);
    }
  }, [dropped, sortedItems, updateRenderUnder, updateZIndexes]);

  const onDrop = useCallback(() => {
    setDropped(true);
  }, [setDropped]);

  useEffect(() => {
    const dataLayers = props.dataLayers || [];
    const tocItems = props.tableOfContentsItems || [];
    if (dataLayers.length === 0 || tocItems.length === 0) {
      setSortedItems([]);
      return;
    }
    let items: SortableItem[] = [];
    for (const item of tocItems) {
      if (!item.dataLayerId) {
        continue;
      }
      const layer = dataLayers.find((layer) => layer.id === item.dataLayerId);
      items.push({
        id: item.id,
        stableId: item.stableId,
        isBasemapLayer: false,
        zIndex: layer?.zIndex || 0,
        renderUnder: layer?.renderUnder || RenderUnderType.Labels,
        title: item.title,
        dataLayerId: item.dataLayerId,
      });
    }
    items.sort((a, b) => {
      if (
        a.renderUnder === RenderUnderType.Labels &&
        b.renderUnder !== RenderUnderType.Labels
      ) {
        return 1;
      } else if (
        b.renderUnder === RenderUnderType.Labels &&
        a.renderUnder !== RenderUnderType.Labels
      ) {
        return -1;
      } else {
        return a.zIndex - b.zIndex;
      }
    });
    // Insert basemap labels indicator in the list
    // first, find the position of the first item that should render under labels
    const idx = items.findIndex(
      (item) => item.renderUnder === RenderUnderType.Labels
    );
    // then insert the basemap labels item before that position
    setSortedItems([
      ...items.slice(0, idx),
      {
        id: -1,
        stableId: "basemapLabels",
        isBasemapLayer: true,
        zIndex: 0,
        renderUnder: RenderUnderType.Labels,
        dataLayerId: -1,
      },
      ...items.slice(idx),
    ]);
  }, [props.tableOfContentsItems, props.dataLayers]);

  const move = useCallback(
    (dragStableId: string, hoverStableId: string) => {
      setSortedItems((items) => {
        const dragIndex = items.findIndex(
          (item) => item.stableId === dragStableId
        );
        const hoverIndex = items.findIndex(
          (item) => item.stableId === hoverStableId
        );
        if (dragIndex === -1 || hoverIndex === -1) {
          console.warn(
            "Could not find items in list",
            dragStableId,
            hoverStableId,
            dragIndex,
            hoverIndex
          );
          return items;
        }
        const newItems = [...items];
        newItems.splice(dragIndex, 1);
        newItems.splice(hoverIndex, 0, items[dragIndex]);
        return newItems;
      });
    },
    [setSortedItems]
  );

  const mapContext = useContext(LayerTreeContext);
  const { manager } = useContext(MapManagerContext);
  const layerStates = mapContext.layerStatesByTocStaticId;

  const Row = useCallback(
    ({
      style,
      data,
      index,
    }: {
      data: SortableItem[];
      index: number;
      style: CSSProperties;
    }) => {
      const { title, isBasemapLayer, stableId } = data[index];
      const state = layerStates[stableId];
      return (
        <ZItem
          style={style}
          state={state}
          onDrop={onDrop}
          move={move}
          title={title}
          isBasemapLayer={isBasemapLayer}
          stableId={stableId}
          index={index}
          isLast={index === data.length - 1}
          toggleItemVisibility={(makeVisible, id) => {
            if (makeVisible) {
              manager?.showTocItems([stableId]);
            } else {
              manager?.hideTocItems([stableId]);
            }
          }}
        />
      );
    },
    [move, layerStates, onDrop, manager]
  );

  if (sortedItems.length < 2) {
    return null;
  }
  return (
    <DndProvider backend={HTML5Backend}>
      <AutoSizer>
        {({ width, height }) => {
          return (
            <List
              className="List"
              height={height}
              itemCount={sortedItems.length}
              itemSize={40}
              width={width}
              itemData={sortedItems}
              itemKey={(index, data) => data[index].stableId}
            >
              {Row}
            </List>
          );
        }}
      </AutoSizer>
    </DndProvider>
  );
}

function ZItem({
  toggleItemVisibility,
  state,
  style,
  title,
  stableId,
  isBasemapLayer,
  index,
  move,
  onDrop,
  isLast,
}: {
  title?: string;
  stableId: string;
  isBasemapLayer: boolean;
  onDrop: () => void;
  style?: CSSProperties;
  toggleItemVisibility: (visible: boolean, id: string) => void;
  state: LayerState;
  index: number;
  move: (dragItemStableId: string, hoverItemStableId: string) => void;
  isLast?: boolean;
}) {
  const { t } = useTranslation("admin:data");
  const ref = useRef<HTMLDivElement>(null);

  const [originalIndex, setOriginalIndex] = useState<number>(index);

  const [{ handlerId }, drop] = useDrop<
    DragItem,
    void,
    { handlerId: Identifier | null }
  >({
    accept: "toc",
    collect(monitor) {
      return {
        handlerId: monitor.getHandlerId(),
      };
    },
    hover(item: DragItem, monitor) {
      if (!ref.current) {
        return;
      }
      const dragIndex = item.index;
      const hoverIndex = index;

      // Don't replace items with themselves
      if (dragIndex === hoverIndex) {
        return;
      }

      // Determine rectangle on screen
      const hoverBoundingRect = ref.current?.getBoundingClientRect();

      // Get vertical middle
      const hoverMiddleY =
        (hoverBoundingRect.bottom - hoverBoundingRect.top) / 2;

      // Determine mouse position
      const clientOffset = monitor.getClientOffset();

      // Get pixels to the top
      const hoverClientY = (clientOffset as XYCoord).y - hoverBoundingRect.top;

      // Only perform the move when the mouse has crossed half of the items height
      // When dragging downwards, only move when the cursor is below 50%
      // When dragging upwards, only move when the cursor is above 50%

      // Dragging downwards
      if (dragIndex < hoverIndex && hoverClientY < hoverMiddleY) {
        return;
      }

      // Dragging upwards
      if (dragIndex > hoverIndex && hoverClientY > hoverMiddleY) {
        return;
      }

      // Time to actually perform the action
      move(item.stableId, stableId);

      // Note: we're mutating the monitor item here!
      // Generally it's better to avoid mutations,
      // but it's good here for the sake of performance
      // to avoid expensive index searches.
      item.index = hoverIndex;
    },
  });

  const [{ isDragging }, drag] = useDrag({
    type: "toc",
    canDrag: !isBasemapLayer,
    item: () => {
      return { stableId, index };
    },
    collect: (monitor: any) => ({
      isDragging: monitor.isDragging(),
    }),
    end: (item, monitor) => {
      // @ts-ignore
      const didDrop = monitor.didDrop();
      if (didDrop) {
        setOriginalIndex(item.index);
        onDrop();
      } else {
        // move back
        // move(stableId, originalIndex)
      }
    },
  });

  drag(drop(ref));

  const borderClass = isLast ? "" : "border-b border-gray-100";

  if (isBasemapLayer) {
    return (
      <div
        data-handler-id={handlerId}
        // @ts-ignore
        ref={ref}
        style={style}
        className={`flex select-none items-center gap-2 border-y border-gray-200 bg-gray-200 px-3 text-[11px] font-semibold uppercase tracking-wider text-gray-500`}
        aria-label={t("Basemap labels divider")}
      >
        <FontSizeIcon
          className="h-3.5 w-3.5 shrink-0 text-gray-400"
          aria-hidden
        />
        <span className="truncate">
          <Trans ns="admin:data">Basemap Labels</Trans>
        </span>
      </div>
    );
  }

  return (
    <div
      data-handler-id={handlerId}
      // @ts-ignore
      ref={ref}
      style={style}
      className={`group flex cursor-grab items-center gap-2 bg-white px-3 text-sm text-gray-900 transition-colors hover:bg-gray-50 active:cursor-grabbing ${borderClass} ${
        isDragging ? "opacity-40" : ""
      }`}
    >
      <HamburgerMenuIcon
        className="h-4 w-4 shrink-0 text-gray-300 transition-colors group-hover:text-gray-500"
        aria-hidden
      />
      <span className="flex-1 truncate select-none" title={title || stableId}>
        {title || stableId}
      </span>
      <span className="flex-none">
        <VisibilityCheckboxAnimated
          onClick={() => {
            toggleItemVisibility(!Boolean(state?.visible), stableId);
          }}
          id={stableId}
          visibility={Boolean(state?.visible)}
          loading={state?.loading}
          disabled={false}
        />
      </span>
    </div>
  );
}
