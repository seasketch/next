/* eslint-disable i18next/no-literal-string */
import mapboxgl, {
  Layer,
  Map,
  MapboxGeoJSONFeature,
  MapMouseEvent,
  Popup,
} from "mapbox-gl";
import {
  idForLayer,
  isSeaSketchLayerId,
  layerIdFromStyleLayerId,
  Tooltip,
} from "./MapContextManager";
import Mustache from "mustache";
import {
  BasemapDetailsFragment,
  DataLayerDetailsFragment,
  DataSourceDetailsFragment,
  DataSourceTypes,
  InteractivityType,
} from "../generated/graphql";
import { EventEmitter } from "eventemitter3";
import { CustomGLSource } from "@seasketch/mapbox-gl-esri-sources";
import { identifyLayers } from "../admin/data/arcgis/arcgis";
import {
  fetchInaturalistUtfgrid,
  renderInaturalistPopup,
} from "./inaturalistInteractivity";
import { normalizeInaturalistParams } from "./inaturalist";

const PopupNumberFormatter = Intl.NumberFormat(undefined, {
  maximumFractionDigits: 2,
});

export type InteractivityUIUpdate = Partial<{
  bannerMessages: string[];
  tooltip: Tooltip | undefined;
  fixedBlocks: string[];
  sidebarPopupContent: string | undefined;
  sidebarPopupTitle: string | undefined;
}>;

/** Active data-table proportional-symbol layer for value tooltips. */
export type DataTableInteractiveLayer = {
  /** Mapbox GL style layer id (`idForLayer(layer, 0)`). */
  glLayerId: string;
  sourceId: string;
  sourceLayer?: string;
  column: string;
  op: string;
};

/**
 * LayerInteractivityManager works in tandem with the MapContextManager to react
 * to user interaction which clicks, hovers, or otherwise interacts with map content
 * to show popups and other extra information. It operates on both vector layers and
 * image layers for which it is necessary to call an external service to retrieve
 * attribute information.
 */
export default class LayerInteractivityManager extends EventEmitter {
  private map: Map;
  private _onUIUpdate: (update: InteractivityUIUpdate) => void;
  private _previousUIState: InteractivityUIUpdate = {};

  /** List of interactive layers that are currently shown on the map. Update with setVisibleLayers() */
  private layers: { [layerId: string]: DataLayerDetailsFragment } = {};
  /**
   * List of image sources related to visible layers. Note only sources that
   * require api requests to display popups need to be stored
   */
  private imageSources: { [sourceId: string]: DataSourceDetailsFragment } = {};
  private previousInteractionTarget?: string;
  private debouncedMouseMoveListenerReference?: any;
  private popupAbortController: AbortController | undefined;
  private interactiveVectorLayerIds: string[] = [];
  private interactiveImageLayerIds: string[] = [];
  /** glLayerId → data-table value tooltip config (independent of admin interactivity). */
  private dataTableLayersByGlId: {
    [glLayerId: string]: DataTableInteractiveLayer;
  } = {};
  private basemap: BasemapDetailsFragment | undefined;
  private sketchLayerIds: string[] = [];
  private focusedSketchId?: number;
  private inaturalistConfigs: {
    params: ReturnType<typeof normalizeInaturalistParams>;
    sourceId: string;
    layerLabel?: string;
  }[] = [];
  private inaturalistPopup?: Popup;
  private customSources: { [sourceId: string]: CustomGLSource<any> } = {};
  private tocItemLabels: { [stableId: string]: { label?: string } } = {};
  private selectedFeature?: mapboxgl.FeatureIdentifier;
  private hoveredFeature?: mapboxgl.FeatureIdentifier;

  /**
   *
   * @param map Map that should support user interaction. Use #setMap to update
   * @param onUIUpdate Callback when UI state (tooltip, banner, popup) changes.
   */
  constructor(map: Map, onUIUpdate: (update: InteractivityUIUpdate) => void) {
    super();
    this.map = map;
    this.registerEventListeners(map);
    this._onUIUpdate = onUIUpdate;
  }

  /**
   * Update the map that supports user interaction. Will update all event listeners
   * @param map
   */
  setMap(map: Map) {
    if (this.map) {
      this.unregisterEventListeners(this.map);
    }
    this.map = map;
    this.registerEventListeners(map);
  }

  setCustomSources(sources: { [sourceId: string]: CustomGLSource<any> }) {
    this.customSources = sources;
  }

  setSketchLayerIds(ids: string[]) {
    this.sketchLayerIds = ids;
    this.syncMouseMoveListener();
  }

  setFocusedSketchId(id: number | null) {
    this.focusedSketchId = id || undefined;
  }

  /**
   * Layers with an active data-table visualization. Hover shows a value
   * tooltip from `rawValue` feature-state. Works alongside popup / sidebar /
   * banner interactivity; overrides an admin Tooltip (and SidebarOverlay
   * short-template hover tooltip) because both compete for the same UI slot.
   */
  setDataTableLayers(layers: DataTableInteractiveLayer[]) {
    const next: { [glLayerId: string]: DataTableInteractiveLayer } = {};
    for (const layer of layers) {
      next[layer.glLayerId] = layer;
    }
    this.dataTableLayersByGlId = next;
    this.syncMouseMoveListener();
  }

  private syncMouseMoveListener() {
    this.map.off("mousemove", this.debouncedMouseMoveListener);
    if (
      this.interactiveVectorLayerIds.length > 0 ||
      this.sketchLayerIds.length > 0 ||
      this.inaturalistConfigs.length > 0 ||
      Object.keys(this.dataTableLayersByGlId).length > 0
    ) {
      this.map.on("mousemove", this.debouncedMouseMoveListener);
    }
  }

  /** Layer ids that currently exist on the map (queryRenderedFeatures throws otherwise). */
  private existingLayerIds(ids: string[]) {
    return ids.filter((id) => Boolean(this.map.getLayer(id)));
  }

  /**
   * Should be called by the MapContextManager whenever visible layers change so
   * that this module can update it's internal list of visible interactive layers.
   * @param dataLayers
   */
  async setVisibleLayers(
    dataLayers: DataLayerDetailsFragment[],
    dataSources: { [dataSourceId: string]: DataSourceDetailsFragment },
    basemap: BasemapDetailsFragment,
    tocItemLabels: {
      [stableId: string]: {
        label?: string;
      };
    }
  ) {
    this.tocItemLabels = tocItemLabels;
    const newActiveLayers: { [layerId: string]: DataLayerDetailsFragment } = {};
    const newActiveImageSources: {
      [sourceId: string]: DataSourceDetailsFragment;
    } = {};
    const newInteractiveImageLayerIds: string[] = [];
    let newInteractiveVectorLayerIds: string[] = [];
    const newInaturalistConfigs: {
      params: ReturnType<typeof normalizeInaturalistParams>;
      sourceId: string;
      layerLabel?: string;
    }[] = [];
    for (const layer of dataLayers) {
      if (layer && layer.dataSourceId) {
        const source = dataSources[layer.dataSourceId];
        if (source) {
          if (source.type === DataSourceTypes.Inaturalist) {
            newInaturalistConfigs.push({
              params: normalizeInaturalistParams(
                (source.queryParameters as any) || {}
              ),
              sourceId: source.id.toString(),
              layerLabel:
                (this.tocItemLabels || {})[
                  (layer as any).tocId || layer.id.toString()
                ]?.label ||
                (layer as any).tocId ||
                layer.id.toString(),
            });
          }
          if (
            layer.interactivitySettings &&
            layer.interactivitySettings.type !== InteractivityType.None
          ) {
            if (layer.sublayer) {
              newInteractiveImageLayerIds.push(layer.id.toString());
              newActiveImageSources[source.id] = source;
              newActiveLayers[layer.id] = layer;
            } else {
              let GLStyles: Layer[];
              if (layer.mapboxGlStyles && Array.isArray(layer.mapboxGlStyles)) {
                GLStyles = layer.mapboxGlStyles;
                newInteractiveVectorLayerIds = [
                  ...newInteractiveVectorLayerIds,
                  ...GLStyles.map((s, i) => idForLayer(layer, i)),
                ];
                newActiveLayers[layer.id] = layer;
              } else if (source.type === DataSourceTypes.ArcgisVector) {
                const customSource = this.customSources[source.id];
                if (customSource) {
                  const { layers } = await customSource.getGLStyleLayers();
                  newInteractiveVectorLayerIds = [
                    ...newInteractiveVectorLayerIds,
                    ...layers.map((l) => l.id),
                  ];
                  for (const lyr of layers) {
                    newActiveLayers[lyr.id] = layer;
                  }
                  // newActiveLayers[layer.id] = layer;
                }
              }
            }
          }
        }
      }
    }
    if (
      basemap &&
      basemap.interactivitySettings &&
      basemap.interactivitySettings.type !== InteractivityType.None &&
      basemap.interactivitySettings.layers?.length
    ) {
      newInteractiveVectorLayerIds = [
        ...newInteractiveVectorLayerIds,
        ...(basemap.interactivitySettings.layers as string[]),
      ];
    } else {
      // delete this.basemap;
    }
    this.basemap = basemap;
    this.interactiveImageLayerIds = newInteractiveImageLayerIds;
    this.interactiveVectorLayerIds = newInteractiveVectorLayerIds;
    this.inaturalistConfigs = newInaturalistConfigs;
    if (!this.inaturalistConfigs.length && this.inaturalistPopup) {
      this.inaturalistPopup.remove();
      this.inaturalistPopup = undefined;
    }
    this.layers = newActiveLayers;
    this.imageSources = newActiveImageSources;
    this.syncMouseMoveListener();
  }

  /**
   * Call to remove all event listeners from a map.
   */
  destroy() {
    this.unregisterEventListeners(this.map);
  }

  private unregisterEventListeners(map: Map) {
    map.off("mouseout", this.onMouseOut);
    map.off("mousemove", this.debouncedMouseMoveListener);
    map.off("click", this.onMouseClick);
    map.on("movestart", this.onMoveStart);
    map.on("moveend", this.onMoveEnd);
  }

  private registerEventListeners(map: Map) {
    map.on("mouseout", this.onMouseOut);
    map.on("click", this.onMouseClick);
    map.on("movestart", this.onMoveStart);
    map.on("moveend", this.onMoveEnd);
  }

  private paused = false;

  /**
   * Pause interactivity manager so that it doesn't interfere with other map
   * interactions, such as when using the measure tool.
   */
  pause() {
    this.paused = true;
  }

  /**
   * Resume interactivity manager after pausing it.
   */
  resume() {
    this.paused = false;
  }

  private moving = false;
  private lastMouseEvent: MapMouseEvent | undefined = undefined;

  private updateUI(update: InteractivityUIUpdate) {
    const next = { ...this._previousUIState, ...update };
    const prev = this._previousUIState;
    if (
      prev.bannerMessages?.join("") !== next.bannerMessages?.join("") ||
      prev.fixedBlocks?.join("") !== next.fixedBlocks?.join("") ||
      prev.tooltip !== next.tooltip ||
      prev.sidebarPopupContent !== next.sidebarPopupContent ||
      prev.sidebarPopupTitle !== next.sidebarPopupTitle
    ) {
      this._previousUIState = next;
      this._onUIUpdate(update);
    }
  }

  private onMoveStart = () => {
    if (this.paused) {
      return;
    }
    this.updateUI({
      bannerMessages: [],
      fixedBlocks: [],
      tooltip: undefined,
    });
    delete this.previousInteractionTarget;
    this.moving = true;
  };

  private onMoveEnd = () => {
    if (this.paused) {
      return;
    }
    this.moving = false;
    if (this.lastMouseEvent) {
      void this.mouseMoveListener(this.lastMouseEvent);
    }
  };

  private onMouseOut = () => {
    if (this.paused) {
      return;
    }
    if (this.hoveredFeature) {
      this.map.setFeatureState(this.hoveredFeature, {
        hovered: false,
        selected:
          this.selectedFeature &&
          this.selectedFeature?.id === this.hoveredFeature?.id &&
          this.selectedFeature?.source === this.hoveredFeature?.source &&
          this.selectedFeature?.sourceLayer ===
            this.hoveredFeature?.sourceLayer,
      });
    }
    setTimeout(() => {
      delete this.previousInteractionTarget;
      this.updateUI({
        tooltip: undefined,
        bannerMessages: [],
        fixedBlocks: [],
      });
    }, 7);
  };

  private onMouseClick = async (e: MapMouseEvent) => {
    if (this.paused) {
      return;
    }
    if (this.popupAbortController) {
      this.popupAbortController.abort();
      delete this.popupAbortController;
    }
    const sketchLayerIds = this.existingLayerIds(this.sketchLayerIds || []);
    const vectorLayerIds = this.existingLayerIds(
      this.interactiveVectorLayerIds
    );
    const sketchFeatures = sketchLayerIds.length
      ? this.map!.queryRenderedFeatures(e.point, {
          layers: sketchLayerIds,
        })
      : [];
    const features = vectorLayerIds.length
      ? this.map!.queryRenderedFeatures(e.point, {
          layers: vectorLayerIds,
        })
      : [];
    const allFeatures = [...sketchFeatures, ...features];
    sortFeaturesByLayer(allFeatures, this.map.getStyle());
    const top = allFeatures[0];
    if (sketchFeatures.includes(top)) {
      const feature = top;
      if (this.focusedSketchId) {
        const id = feature.id?.toString();
        if (id) {
          if (this.focusedSketchId === parseInt(id)) {
            this.emit("click:focused-sketch", feature, e);
          }
          e.preventDefault();
          return;
        } else {
          throw new Error("Sketch display GeoJSON does not have ID assigned.");
        }
      } else {
        this.emit("click:sketch", feature, e);
        e.preventDefault();
        return;
      }
    }
    let vectorPopupOpened = false;
    const inatHit = await this.getTopInaturalistHit(e);
    const inatDrawIndex = inatHit ? inatHit.layerIndex : -Infinity;

    if (top) {
      const topVectorIndex = this.getLayerDrawIndex(top.layer.id);

      if (inatHit && inatDrawIndex >= topVectorIndex) {
        if (this.inaturalistPopup) {
          this.inaturalistPopup.remove();
          this.inaturalistPopup = undefined;
        }
        this.inaturalistPopup = await renderInaturalistPopup(
          this.map,
          inatHit.hit!
        );
        return;
      }
      const interactivitySetting = this.getInteractivitySettingForFeature(top);
      if (
        interactivitySetting &&
        (interactivitySetting.type === InteractivityType.Popup ||
          interactivitySetting.type === InteractivityType.SidebarOverlay)
      ) {
        vectorPopupOpened = true;
        const props = top.properties;
        // Special handling for esriAttachments
        if (
          props &&
          "esriAttachments" in props &&
          typeof props.esriAttachments === "string"
        ) {
          try {
            props.esriAttachments = JSON.parse(props.esriAttachments);
          } catch (e) {
            // do nothing
          }
        }
        const content = Mustache.render(
          interactivitySetting.longTemplate || "",
          {
            ...mustacheHelpers,
            ...props,
          }
        );
        if (interactivitySetting.type === InteractivityType.Popup) {
          this.updateUI({
            sidebarPopupContent: undefined,
            sidebarPopupTitle: undefined,
          });
          new Popup({ closeOnClick: true, closeButton: true })
            .setLngLat([e.lngLat.lng, e.lngLat.lat])
            .setHTML(content)
            .addTo(this.map!);
        } else {
          const titleContent = Mustache.render(
            interactivitySetting.title || "",
            {
              ...mustacheHelpers,
              ...top.properties,
            }
          );
          this.updateUI({
            sidebarPopupContent: content,
            sidebarPopupTitle: titleContent,
          });
          this.setSelectedFeature(top);
        }
      } else if (
        interactivitySetting &&
        interactivitySetting.type === InteractivityType.AllPropertiesPopup
      ) {
        this.updateUI({
          sidebarPopupContent: undefined,
          sidebarPopupTitle: undefined,
        });
        const lyr = this.layers[top.layer.id];
        // @ts-ignore
        const layerLabel = (this.tocItemLabels || {})[lyr?.tocId]?.label;
        new Popup({ closeOnClick: true, closeButton: true })
          .setLngLat([e.lngLat.lng, e.lngLat.lat])
          .setHTML(
            Mustache.render(
              `
              <div class="">
              ${
                layerLabel
                  ? `<h3 class="font-medium p-1">${layerLabel}</h3>`
                  : ""
              }
              <div class="zebra-stripe-child-div max-h-72 overflow-y-auto">
              ${Object.keys(top.properties || {})
                .map((key) => {
                  const value = (top.properties || {})[key];
                  const isNumber = typeof value === "number";
                  const strValue = isNumber
                    ? PopupNumberFormatter.format(value)
                    : value.toString();
                  return `
                      <div class="flex space-x-3 px-1 py-0.5">
                        <div class="flex-1 truncate">${key}</div>
                        <div class="truncate ${
                          isNumber ? "font-mono" : ""
                        }">${strValue}
                        </div>
                      </div>`;
                })
                .join("\n")}
                </div>
              </div>
            `,
              {
                ...mustacheHelpers,
                properties: top.properties,
              }
            )
          )
          .addTo(this.map!);
        vectorPopupOpened = true;
      }
    } else {
      this.updateUI({
        sidebarPopupContent: undefined,
        sidebarPopupTitle: undefined,
      });
      this.setSelectedFeature(undefined);
    }
    let popupOpened = vectorPopupOpened;

    if (!popupOpened && this.inaturalistConfigs.length) {
      if (inatHit?.hit) {
        if (this.inaturalistPopup) {
          this.inaturalistPopup.remove();
        }
        this.inaturalistPopup = await renderInaturalistPopup(
          this.map,
          inatHit.hit
        );
        popupOpened = true;
      }
    }

    if (!popupOpened) {
      // Are any image layers active that support identify tools?
      const interactiveImageLayers = this.interactiveImageLayerIds.map(
        (id) => this.layers[id]
      );
      interactiveImageLayers.sort((a, b) => a.zIndex - b.zIndex);
      if (interactiveImageLayers.length) {
        this.openImageServicePopups(
          [e.lngLat.lng, e.lngLat.lat],
          interactiveImageLayers
        );
      }
    }
  };

  setSelectedFeature(feature?: mapboxgl.FeatureIdentifier) {
    if (this.selectedFeature?.id === feature?.id) {
      return;
    }
    if (this.selectedFeature) {
      this.map.setFeatureState(this.selectedFeature, {
        selected: false,
        hovered:
          this.hoveredFeature &&
          this.hoveredFeature?.id === this.selectedFeature?.id &&
          this.hoveredFeature?.source === this.selectedFeature?.source &&
          this.hoveredFeature?.sourceLayer ===
            this.selectedFeature?.sourceLayer,
      });
    }
    if (feature) {
      this.map.setFeatureState(feature, {
        selected: true,
        hovered:
          this.hoveredFeature &&
          this.hoveredFeature?.id === feature?.id &&
          this.hoveredFeature?.source === feature?.source &&
          this.hoveredFeature?.sourceLayer === feature?.sourceLayer,
      });
    }
    this.selectedFeature = feature;
  }

  setHoveredFeature(feature?: mapboxgl.FeatureIdentifier) {
    if (this.hoveredFeature?.id === feature?.id) {
      return;
    }
    if (this.hoveredFeature) {
      this.map.setFeatureState(this.hoveredFeature, {
        hovered: false,
        selected:
          this.selectedFeature &&
          this.selectedFeature?.id === this.hoveredFeature?.id &&
          this.selectedFeature?.source === this.hoveredFeature?.source &&
          this.selectedFeature?.sourceLayer ===
            this.hoveredFeature?.sourceLayer,
      });
    }
    if (feature) {
      this.map.setFeatureState(feature, {
        hovered: true,
        selected:
          this.selectedFeature &&
          this.selectedFeature?.id === feature?.id &&
          this.selectedFeature?.source === feature?.source &&
          this.selectedFeature?.sourceLayer === feature?.sourceLayer,
      });
    }
    this.hoveredFeature = feature;
  }

  clearSidebarPopup = () => {
    this.updateUI({
      sidebarPopupContent: undefined,
      sidebarPopupTitle: undefined,
    });
    this.setSelectedFeature(undefined);
  };

  // Note, this will only work with ArcGIS Server
  // TODO: refactor this at some point to support CustomGLSources
  // more generally
  private async openImageServicePopups(
    position: [number, number],
    layers: DataLayerDetailsFragment[]
  ) {
    if (this.popupAbortController) {
      this.popupAbortController.abort();
      delete this.popupAbortController;
    }
    this.popupAbortController = new AbortController();
    const requests: {
      sublayers: string[];
      source: DataSourceDetailsFragment;
    }[] = [];
    for (const layer of layers) {
      let existingRequest = requests.find(
        (r) => r.source.id === layer.dataSourceId
      );
      if (!existingRequest) {
        const source = this.imageSources[layer.dataSourceId];
        if (!source) {
          /* eslint-disable-next-line */
          throw new Error(`Could not find source id=${layer.dataSourceId}`);
        }
        existingRequest = {
          sublayers: [],
          source: source,
        };
        requests.push(existingRequest);
      }
      existingRequest.sublayers.push(layer.sublayer!);
    }
    const bounds = this.map!.getBounds();
    const extent = [
      bounds.getWest(),
      bounds.getSouth(),
      bounds.getEast(),
      bounds.getNorth(),
    ] as [number, number, number, number];
    const width = this.map!.getCanvas().width;
    const height = this.map!.getCanvas().height;
    const dpi = window.devicePixelRatio * 96;
    this.map!.getCanvas().style.cursor = "progress";
    const data = await Promise.all(
      requests.map((request) => {
        return identifyLayers(
          position,
          request.source,
          request.sublayers,
          extent,
          width,
          height,
          dpi,
          this.popupAbortController
        );
      })
    );
    this.map!.getCanvas().style.cursor = "";
    if (!this.popupAbortController.signal.aborted) {
      for (const sublayerData of data) {
        if (sublayerData.length) {
          const interactivitySetting = layers.find(
            (l) =>
              l.sublayer?.toString() === sublayerData[0].sublayer.toString() &&
              l.dataSourceId === sublayerData[0].sourceId
          )?.interactivitySettings;
          if (
            interactivitySetting?.type === InteractivityType.AllPropertiesPopup
          ) {
            const data = sublayerData[0];
            let layerLabel: string | undefined;
            if (data) {
              const lyr = layers.find(
                (l) =>
                  l.sublayer?.toString() === data.sublayer.toString() &&
                  l.dataSourceId === data.sourceId
              );
              // @ts-ignore
              layerLabel = (this.tocItemLabels || {})[lyr?.tocId]?.label;
            }

            const properties = sublayerData[0]?.attributes || {};
            new Popup({ closeOnClick: true, closeButton: true })
              .setLngLat(position)
              .setHTML(
                Mustache.render(
                  `
                  ${
                    layerLabel
                      ? `<h3 class="font-medium p-1">${layerLabel}</h3>`
                      : ""
                  }    
              <div class="">
              <div class="zebra-stripe-child-div max-h-72 overflow-y-auto">
              ${Object.keys(properties)
                .map((key) => {
                  const value = properties[key];
                  const isNumber = typeof value === "number";
                  const strValue = isNumber
                    ? PopupNumberFormatter.format(value)
                    : value.toString();
                  return `
                      <div class="flex space-x-3 px-1 py-0.5">
                        <div class="flex-1 truncate">${key}</div>
                        <div class="truncate ${
                          isNumber ? "font-mono" : ""
                        }">${strValue}
                        </div>
                      </div>`;
                })
                .join("\n")}
                </div>
              </div>
            `,
                  {
                    ...mustacheHelpers,
                    properties,
                  }
                )
              )
              .addTo(this.map!);
          } else {
            new Popup({ closeOnClick: true, closeButton: true })
              .setLngLat(position)
              .setHTML(
                Mustache.render(interactivitySetting!.longTemplate || "", {
                  ...mustacheHelpers,
                  ...sublayerData[0].attributes,
                })
              )
              .addTo(this.map!);
          }
          break;
        }
      }
    }
  }

  private debouncedMouseMoveListener = (e: MapMouseEvent, backoff = 4) => {
    if (this.paused) {
      return;
    }
    if (this.moving) {
      this.lastMouseEvent = e;
      return;
    }
    if (this.debouncedMouseMoveListenerReference) {
      clearTimeout(this.debouncedMouseMoveListenerReference);
    }
    this.debouncedMouseMoveListenerReference = setTimeout(() => {
      delete this.debouncedMouseMoveListenerReference;
      if (this.moving) {
        return;
      }
      void this.mouseMoveListener(e);
    }, backoff);
  };

  private mouseMoveListener = async (e: MapMouseEvent) => {
    if (this.moving) {
      return;
    }
    const clear = () => {
      this.map!.getCanvas().style.cursor = "";
      this.updateUI({
        bannerMessages: [],
        tooltip: undefined,
        fixedBlocks: [],
      });
      delete this.previousInteractionTarget;
    };
    const inatHit = await this.getTopInaturalistHit(e);
    const inatDrawIndex = inatHit ? inatHit.layerIndex : -Infinity;

    // First, check sketch layers
    const sketchLayerIds = this.existingLayerIds(this.sketchLayerIds);
    const sketchFeatures = sketchLayerIds.length
      ? this.map!.queryRenderedFeatures(e.point, {
          layers: sketchLayerIds,
        })
      : [];
    if (sketchFeatures.length) {
      clear();
      if (
        !this.focusedSketchId ||
        sketchFeatures[0].id === this.focusedSketchId
      ) {
        this.map!.getCanvas().style.cursor = "pointer";
      }
      return;
    }
    const dataTableLayerIds = Object.keys(this.dataTableLayersByGlId);
    const layerIds = this.existingLayerIds([
      ...dataTableLayerIds,
      ...this.interactiveVectorLayerIds,
    ]);
    // Deduplicate while preserving order (data-table ids first for lookup).
    const seen = new Set<string>();
    const uniqueLayerIds = layerIds.filter((id) => {
      if (seen.has(id)) {
        return false;
      }
      seen.add(id);
      return true;
    });
    const features = uniqueLayerIds.length
      ? this.map!.queryRenderedFeatures(e.point, {
          layers: uniqueLayerIds,
        })
      : [];
    let topVectorIndex = -Infinity;
    if (features.length && uniqueLayerIds.indexOf(features[0].layer.id) > -1) {
      const top = features[0];
      topVectorIndex = this.getLayerDrawIndex(top.layer.id);
      this.setHoveredFeature(top);
      const dataTableConfig = this.dataTableLayersByGlId[top.layer.id];
      const dataTableTooltip = dataTableConfig
        ? this.buildDataTableValueTooltip(top, dataTableConfig, e)
        : undefined;
      const interactivitySetting = this.getInteractivitySettingForFeature(top);
      if (interactivitySetting) {
        let cursor = "";
        this.map!.getCanvas().style.cursor = cursor;
        let bannerMessages: string[] = [];
        let tooltip: Tooltip | undefined = undefined;
        let fixedBlocks: string[] = [];
        switch (interactivitySetting.type) {
          case InteractivityType.Banner:
            cursor = "default";
            bannerMessages = [
              Mustache.render(interactivitySetting.shortTemplate || "", {
                ...mustacheHelpers,
                ...(top.properties || {}),
              }),
            ];
            // Data-table value tooltip sits alongside the banner.
            tooltip = dataTableTooltip;
            break;
          case InteractivityType.Tooltip:
            cursor = "default";
            // Data-table value wins over an admin Tooltip template.
            tooltip =
              dataTableTooltip ??
              ({
                x: e.originalEvent.x,
                y: e.originalEvent.y,
                messages: [
                  Mustache.render(interactivitySetting.shortTemplate || "", {
                    ...mustacheHelpers,
                    ...(top.properties || {}),
                  }),
                ],
              } as Tooltip);
            break;
          case InteractivityType.Popup:
          case InteractivityType.AllPropertiesPopup:
          case InteractivityType.SidebarOverlay:
            cursor = "pointer";
            if (dataTableTooltip) {
              // Hover value inspection alongside click popup / sidebar.
              tooltip = dataTableTooltip;
            } else if (
              interactivitySetting.type === InteractivityType.SidebarOverlay &&
              interactivitySetting.shortTemplate?.length
            ) {
              tooltip = {
                x: e.originalEvent.x,
                y: e.originalEvent.y,
                messages: [
                  Mustache.render(interactivitySetting.shortTemplate, {
                    ...mustacheHelpers,
                    ...(top.properties || {}),
                  }),
                ],
              };
            }
            break;
          case InteractivityType.FixedBlock:
            cursor = "pointer";
            fixedBlocks = [
              Mustache.render(interactivitySetting.longTemplate || "", {
                ...mustacheHelpers,
                ...(top.properties || {}),
              }),
            ];
            tooltip = dataTableTooltip;
            break;
          default:
            tooltip = dataTableTooltip;
            break;
        }
        if (interactivitySetting.cursor !== "AUTO") {
          cursor = interactivitySetting.cursor.toString().toLowerCase();
        }
        this.map!.getCanvas().style.cursor = cursor;
        const currentInteractionTarget = `${top.id}-${interactivitySetting.id}`;
        // Skip redundant banner/popup updates for the same feature — but always
        // refresh when a data-table tooltip needs to follow the pointer.
        if (
          this.previousInteractionTarget === currentInteractionTarget &&
          !dataTableTooltip &&
          (interactivitySetting.type === InteractivityType.Banner ||
            interactivitySetting.type === InteractivityType.FixedBlock ||
            interactivitySetting.type === InteractivityType.Popup ||
            interactivitySetting.type === InteractivityType.AllPropertiesPopup)
        ) {
          // Don't waste cycles on a state update
        } else {
          this.previousInteractionTarget = currentInteractionTarget;
          this.updateUI({
            bannerMessages,
            tooltip,
            fixedBlocks,
          });
        }
      } else if (dataTableTooltip) {
        this.map!.getCanvas().style.cursor = "default";
        this.previousInteractionTarget = `${top.id}-data-table`;
        this.updateUI({
          bannerMessages: [],
          tooltip: dataTableTooltip,
          fixedBlocks: [],
        });
      } else {
        clear();
      }
    } else {
      this.setHoveredFeature(undefined);
      if (inatHit && inatDrawIndex >= topVectorIndex) {
        this.map!.getCanvas().style.cursor = "pointer";
        return;
      }
      clear();
    }
  };

  /**
   * Hover tooltip for a data-table proportional symbol, using `rawValue`
   * feature-state written by DataTableQueryManager.
   */
  private buildDataTableValueTooltip(
    feature: MapboxGeoJSONFeature,
    config: DataTableInteractiveLayer,
    e: MapMouseEvent
  ): Tooltip | undefined {
    if (feature.id === undefined || feature.id === null) {
      return undefined;
    }
    const state = this.map.getFeatureState({
      source: config.sourceId,
      id: feature.id,
      ...(config.sourceLayer ? { sourceLayer: config.sourceLayer } : {}),
    }) as {
      rawValue?: number | null;
      loading?: boolean;
      scaledValue?: number | null;
    };
    const position = {
      x: e.originalEvent.x,
      y: e.originalEvent.y,
    };
    if (state.loading) {
      return { ...position, messages: ["Loading…"] };
    }
    if (!("rawValue" in state) && !("scaledValue" in state)) {
      // Feature-state not applied yet (style still settling).
      return undefined;
    }
    if (state.rawValue === null || state.rawValue === undefined) {
      return { ...position, messages: ["No data"] };
    }
    const formatted = PopupNumberFormatter.format(state.rawValue);
    return {
      ...position,
      messages: [`${config.op}(${config.column}): ${formatted}`],
    };
  }

  private async getTopInaturalistHit(e: MapMouseEvent) {
    if (!this.inaturalistConfigs.length) {
      return null;
    }
    let best: {
      hit: Awaited<ReturnType<typeof fetchInaturalistUtfgrid>>;
      layerIndex: number;
    } | null = null;

    for (const config of this.inaturalistConfigs) {
      const hit = await fetchInaturalistUtfgrid(
        this.map,
        config.params,
        e as any,
        config.layerLabel
      );
      if (!hit) {
        continue;
      }
      const layerIndex = this.getInatLayerDrawIndex(config.sourceId);
      if (best === null || layerIndex > best.layerIndex) {
        best = { hit, layerIndex };
      }
    }

    return best;
  }

  private getInatLayerDrawIndex(sourceId: string) {
    const layers = this.map.getStyle().layers || [];
    // eslint-disable-next-line i18next/no-literal-string
    const candidateSources = [
      sourceId,
      `${sourceId}-points`,
      `${sourceId}-heatmap`,
      `${sourceId}-grid`,
    ];
    return layers.reduce((max, l, idx) => {
      const src: string | undefined =
        // @ts-ignore
        "source" in l ? (l as any).source?.toString() : undefined;
      if (src && candidateSources.includes(src)) {
        return Math.max(max, idx);
      }
      return max;
    }, -Infinity);
  }

  getInteractivitySettingForFeature(feature: MapboxGeoJSONFeature) {
    if (isSeaSketchLayerId(feature.layer.id)) {
      const dataLayer = this.layers[layerIdFromStyleLayerId(feature.layer.id)];
      if (!dataLayer) {
        return;
      }
      return dataLayer.interactivitySettings;
    } else if (this.layers[feature.layer.id]) {
      const dataLayer = this.layers[feature.layer.id];
      if (!dataLayer) {
        return;
      }
      return dataLayer.interactivitySettings;
    } else {
      if (
        this.basemap &&
        this.basemap.interactivitySettings?.layers &&
        this.basemap.interactivitySettings?.layers.indexOf(feature.layer.id) !==
          -1
      ) {
        return this.basemap.interactivitySettings;
      } else {
      }
    }
  }

  private getLayerDrawIndex(layerId: string) {
    const layers = this.map.getStyle().layers || [];
    return layers.findIndex((l) => l.id === layerId);
  }
}

const mustacheHelpers = {
  round: () => (text: string, render: (str: string) => string) => {
    return `${Math.round(parseFloat(render(text)))}`;
  },
  round1Digit: () => (text: string, render: (str: string) => string) => {
    return `${Math.round(parseFloat(render(text)) * 10) / 10}`;
  },
  round2Digits: () => (text: string, render: (str: string) => string) => {
    return `${Math.round(parseFloat(render(text)) * 100) / 100}`;
  },
};

function sortFeaturesByLayer(
  features: mapboxgl.MapboxGeoJSONFeature[],
  style: mapboxgl.Style
) {
  // sort features by their index in the style's layer list
  return features.sort((a, b) => {
    const aLayerIndex = style.layers.findIndex(
      (layer) => layer.id === a.layer.id
    );
    const bLayerIndex = style.layers.findIndex(
      (layer) => layer.id === b.layer.id
    );
    return bLayerIndex - aLayerIndex;
  });
}
