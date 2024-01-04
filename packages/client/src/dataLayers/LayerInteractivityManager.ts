import {
  FilterOptions,
  GeoJSONSource,
  Layer,
  Map,
  MapboxGeoJSONFeature,
  MapMouseEvent,
  Popup,
} from "mapbox-gl";
import {
  CROSSHAIR_IMAGE_ID,
  idForLayer,
  isSeaSketchLayerId,
  layerIdFromStyleLayerId,
  MapContextInterface,
  POPUP_CLICK_LOCATION_SOURCE,
  Tooltip,
} from "./MapContextManager";
import Mustache from "mustache";
import { Dispatch, SetStateAction } from "react";
import {
  BasemapDetailsFragment,
  DataLayerDetailsFragment,
  DataSourceDetailsFragment,
  DataSourceTypes,
  InteractivityType,
} from "../generated/graphql";
import // getDynamicArcGISStyle,
// identifyLayers,
"../admin/data/arcgis/arcgis";
import { EventEmitter } from "eventemitter3";
import { CustomGLSource } from "@seasketch/mapbox-gl-esri-sources";
import { identifyLayers } from "../admin/data/arcgis/arcgis";
import { EMPTY_FEATURE_COLLECTION } from "../draw/useMapboxGLDraw";
import { GeoJsonProperties } from "geojson";

const PopupNumberFormatter = Intl.NumberFormat(undefined, {
  maximumFractionDigits: 2,
});

/**
 * LayerInteractivityManager works in tandem with the MapContextManager to react
 * to user interaction which clicks, hovers, or otherwise interacts with map content
 * to show popups and other extra information. It operates on both vector layers and
 * image layers for which it is necessary to call an external service to retrieve
 * attribute information.
 */
export default class LayerInteractivityManager extends EventEmitter {
  private map: Map;
  private _setState: Dispatch<SetStateAction<MapContextInterface>>;
  private _setHighlightedLayer: (
    layerId: string | undefined,
    filter?: FilterOptions
  ) => void;
  private previousState?: MapContextInterface;

  /** List of interactive layers that are currently shown on the map. Update with setVisibleLayers() */
  private layers: { [layerId: string]: DataLayerDetailsFragment } = {};
  /**
   * List of image sources related to visible layers. Note only sources that
   * require api requests to display popups need to be stored
   */
  private imageSources: { [sourceId: string]: DataSourceDetailsFragment } = {};
  private previousInteractionTarget?: string;
  private debouncedMouseMoveListenerReference?: NodeJS.Timeout;
  private popupAbortController: AbortController | undefined;
  private interactiveVectorLayerIds: string[] = [];
  private interactiveImageLayerIds: string[] = [];
  private basemap: BasemapDetailsFragment | undefined;
  private sketchLayerIds: string[] = [];
  private focusedSketchId?: number;
  private customSources: { [sourceId: string]: CustomGLSource<any> } = {};
  private tocItemLabels: { [stableId: string]: string } = {};

  /**
   *
   * @param map Map that should support user interaction. Use #setMap to update
   * @param setState The state of banner and tooltip messages is held in the
   * MapContext. Use this function to set it.
   */
  constructor(
    map: Map,
    setState: Dispatch<SetStateAction<MapContextInterface>>,
    setHighlightedLayer: (
      layerId: string | undefined,
      filter?: FilterOptions
    ) => void
  ) {
    super();
    this.map = map;
    this.registerEventListeners(map);
    this._setState = setState;
    this._setHighlightedLayer = setHighlightedLayer;
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
    this.map.off("mousemove", this.debouncedMouseMoveListener);
    if (
      this.interactiveVectorLayerIds.length > 0 ||
      this.sketchLayerIds.length > 0
    ) {
      this.map.on("mousemove", this.debouncedMouseMoveListener);
    }
  }

  setFocusedSketchId(id: number | null) {
    this.focusedSketchId = id || undefined;
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
    tocItemLabels: { [stableId: string]: string }
  ) {
    this.tocItemLabels = tocItemLabels;
    const newActiveLayers: { [layerId: string]: DataLayerDetailsFragment } = {};
    const newActiveImageSources: {
      [sourceId: string]: DataSourceDetailsFragment;
    } = {};
    const newInteractiveImageLayerIds: string[] = [];
    let newInteractiveVectorLayerIds: string[] = [];
    for (const layer of dataLayers) {
      if (layer && layer.dataSourceId) {
        const source = dataSources[layer.dataSourceId];
        if (source) {
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
    this.layers = newActiveLayers;
    this.imageSources = newActiveImageSources;
    this.map.off("mousemove", this.debouncedMouseMoveListener);
    if (
      this.interactiveVectorLayerIds.length > 0 ||
      this.sketchLayerIds.length > 0
    ) {
      this.map.on("mousemove", this.debouncedMouseMoveListener);
    }
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

  private setState(action: SetStateAction<MapContextInterface>) {
    let newState: MapContextInterface;
    if (this.previousState && typeof action === "function") {
      newState = action(this.previousState);
      if (this.statesDiffer(this.previousState, newState)) {
        this.previousState = newState;
        this._setState(action);
      }
    } else if (this.previousState && typeof action !== "function") {
      if (this.statesDiffer(this.previousState, action)) {
        this.previousState = action;
        this._setState(action);
      }
    } else {
      if (typeof action === "function") {
        this.previousState = action({} as unknown as MapContextInterface);
      } else {
        this.previousState = action;
      }
      this._setState(action);
    }
  }

  private statesDiffer(prev: MapContextInterface, next: MapContextInterface) {
    return (
      prev.bannerMessages?.join("") !== next.bannerMessages?.join("") ||
      prev.fixedBlocks?.join("") !== next.fixedBlocks?.join("") ||
      prev.tooltip !== next.tooltip ||
      prev.sidebarPopupContent !== next.sidebarPopupContent ||
      prev.sidebarPopupTitle !== next.sidebarPopupTitle
    );
  }

  private onMoveStart = () => {
    if (this.paused) {
      return;
    }
    this.setState((prev) => ({
      ...prev,
      bannerMessages: [],
      fixedBlocks: [],
      tooltip: undefined,
    }));
    delete this.previousInteractionTarget;
    this.moving = true;
  };

  private onMoveEnd = () => {
    if (this.paused) {
      return;
    }
    this.moving = false;
    if (this.lastMouseEvent) {
      this.mouseMoveListener(this.lastMouseEvent);
    }
  };

  private onMouseOut = () => {
    if (this.paused) {
      return;
    }
    setTimeout(() => {
      delete this.previousInteractionTarget;
      this.setState((prev) => ({
        ...prev,
        tooltip: undefined,
        bannerMessages: [],
        fixedBlocks: [],
      }));
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
    const sketchFeatures = this.map!.queryRenderedFeatures(e.point, {
      layers: this.sketchLayerIds || [],
    });
    if (sketchFeatures.length) {
      const feature = sketchFeatures[0];
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
    const features = this.map!.queryRenderedFeatures(e.point, {
      layers: this.interactiveVectorLayerIds,
    });
    const top = features[0];
    let vectorPopupOpened = false;
    if (top) {
      const interactivitySetting = this.getInteractivitySettingForFeature(top);
      if (
        interactivitySetting &&
        (interactivitySetting.type === InteractivityType.Popup ||
          interactivitySetting.type === InteractivityType.SidebarOverlay)
      ) {
        vectorPopupOpened = true;
        const content = Mustache.render(
          interactivitySetting.longTemplate || "",
          {
            ...mustacheHelpers,
            ...top.properties,
          }
        );
        if (interactivitySetting.type === InteractivityType.Popup) {
          const popupSource = this.map.getSource(
            POPUP_CLICK_LOCATION_SOURCE
          ) as GeoJSONSource;
          popupSource?.setData(EMPTY_FEATURE_COLLECTION);
          this.setState((prev) => ({
            ...prev,
            sidebarPopupContent: undefined,
            sidebarPopupTitle: undefined,
          }));
          new Popup({ closeOnClick: true, closeButton: true })
            .setLngLat([e.lngLat.lng, e.lngLat.lat])
            .setHTML(content)
            .addTo(this.map!);
        } else {
          if (this.map) {
            const popupSource = this.map.getSource(
              POPUP_CLICK_LOCATION_SOURCE
            ) as GeoJSONSource;
            popupSource.setData({
              type: "Feature",
              properties: {},
              geometry: {
                type: "Point",
                coordinates: [e.lngLat.lng, e.lngLat.lat],
              },
            });
          }
          const titleContent = Mustache.render(
            interactivitySetting.title || "",
            {
              ...mustacheHelpers,
              ...top.properties,
            }
          );
          this.setState((prev) => ({
            ...prev,
            sidebarPopupContent: content,
            sidebarPopupTitle: titleContent,
          }));
          const idProperty = getIdProperty(top.properties);
          if (idProperty) {
            this._setHighlightedLayer(top.layer.id, [
              "==",
              ["get", idProperty],
              top.properties![idProperty],
            ] as FilterOptions);
          } else {
            this._setHighlightedLayer(undefined);
          }
        }
      } else if (
        interactivitySetting &&
        interactivitySetting.type === InteractivityType.AllPropertiesPopup
      ) {
        this.setState((prev) => ({
          ...prev,
          sidebarPopupContent: undefined,
          sidebarPopupTitle: undefined,
        }));
        const popupSource = this.map.getSource(
          POPUP_CLICK_LOCATION_SOURCE
        ) as GeoJSONSource;
        popupSource.setData({
          type: "Feature",
          properties: {},
          geometry: {
            type: "Point",
            coordinates: [e.lngLat.lng, e.lngLat.lat],
          },
        });
        const lyr = this.layers[top.layer.id];
        // @ts-ignore
        const layerLabel = (this.tocItemLabels || {})[lyr?.tocId];
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
      const popupSource = this.map?.getSource(POPUP_CLICK_LOCATION_SOURCE) as
        | GeoJSONSource
        | undefined;
      if (popupSource) {
        popupSource.setData(EMPTY_FEATURE_COLLECTION);
      }
      this.setState((prev) => ({
        ...prev,
        sidebarPopupContent: undefined,
        sidebarPopupTitle: undefined,
      }));
      this._setHighlightedLayer(undefined);
    }
    if (!vectorPopupOpened) {
      // Are any image layers active that support identify tools?
      const interactiveImageLayers = this.interactiveImageLayerIds.map(
        (id) => this.layers[id]
      );
      interactiveImageLayers.sort((a, b) => a.zIndex - b.zIndex);
      if (interactiveImageLayers.length) {
        // throw new Error("Not implemented");
        this.openImageServicePopups(
          [e.lngLat.lng, e.lngLat.lat],
          interactiveImageLayers
        );
      }
    }
  };

  clearSidebarPopup = () => {
    this.setState((prev) => ({
      ...prev,
      sidebarPopupContent: undefined,
      sidebarPopupTitle: undefined,
    }));
    this._setHighlightedLayer(undefined);
    const popupSource = this.map?.getSource(POPUP_CLICK_LOCATION_SOURCE) as
      | GeoJSONSource
      | undefined;
    if (popupSource) {
      popupSource.setData(EMPTY_FEATURE_COLLECTION);
    }
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
            let layerLabel: undefined | string;
            if (data) {
              const lyr = layers.find(
                (l) =>
                  l.sublayer?.toString() === data.sublayer.toString() &&
                  l.dataSourceId === data.sourceId
              );
              // @ts-ignore
              layerLabel = (this.tocItemLabels || {})[lyr?.tocId];
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
      this.mouseMoveListener(e);
    }, backoff);
  };

  private mouseMoveListener = (e: MapMouseEvent) => {
    if (this.moving) {
      return;
    }
    const clear = () => {
      this.map!.getCanvas().style.cursor = "";
      this.setState((prev) => ({
        ...prev,
        bannerMessages: [],
        tooltip: undefined,
        fixedBlocks: [],
      }));
      delete this.previousInteractionTarget;
    };
    // First, check sketch layers
    const sketchFeatures = this.map!.queryRenderedFeatures(e.point, {
      layers: this.sketchLayerIds,
    });
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
    const layerIds = this.interactiveVectorLayerIds;
    const features = this.map!.queryRenderedFeatures(e.point, {
      layers: layerIds,
    });
    if (features.length && layerIds.indexOf(features[0].layer.id) > -1) {
      const top = features[0];
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
            break;
          case InteractivityType.Tooltip:
            cursor = "default";
            tooltip = {
              x: e.originalEvent.x,
              y: e.originalEvent.y,
              messages: [
                Mustache.render(interactivitySetting.shortTemplate || "", {
                  ...mustacheHelpers,
                  ...(top.properties || {}),
                }),
              ],
            };
            break;
          case InteractivityType.Popup:
          case InteractivityType.AllPropertiesPopup:
          case InteractivityType.SidebarOverlay:
            cursor = "pointer";
            if (
              interactivitySetting.type === InteractivityType.SidebarOverlay &&
              interactivitySetting.title?.length
            ) {
              tooltip = {
                x: e.originalEvent.x,
                y: e.originalEvent.y,
                messages: [
                  Mustache.render(interactivitySetting.title, {
                    ...mustacheHelpers,
                    ...(top.properties || {}),
                  }) +
                    // eslint-disable-next-line i18next/no-literal-string
                    `<span class="font-italics text-xs">${`<svg class="inline-block" width="25" height="25" viewBox="0 0 25 25" xmlns="http://www.w3.org/2000/svg" xmlns:svg="http://www.w3.org/2000/svg">
                    <g class="layer">
                     <title>Layer 1</title>
                     
                     <ellipse cx="12.55" cy="13.5" fill="#ffffff" id="svg_2" rx="3.45" ry="3.35" stroke="#ffffff"/>
                     <ellipse cx="10.6" cy="8.59" fill="#ffffff" id="svg_6" rx="3.2" ry="3.26" stroke="#000000" stroke-opacity="0.55" stroke-width="0.7"/>
                     <ellipse cx="11.7" cy="11.87" fill="#ffffff" id="svg_8" rx="2.85" ry="2.77" stroke="#ffffff"/>
                     <g id="svg_7">
                      <path clip-rule="evenodd" d="m10.29,8.05c0.18,-0.08 0.39,-0.05 0.54,0.08l9.03,7.82c0.15,0.13 0.21,0.35 0.14,0.54c-0.06,0.2 -0.24,0.33 -0.45,0.34l-3.33,0.14l1.93,4.25c0.11,0.25 0,0.55 -0.25,0.66l-2.15,0.98c-0.25,0.12 -0.55,0 -0.66,-0.25l-1.94,-4.24l-2.29,2.42c-0.14,0.14 -0.36,0.19 -0.55,0.12c-0.19,-0.08 -0.31,-0.26 -0.31,-0.47l0,-11.94c0,-0.19 0.11,-0.37 0.29,-0.45zm0.71,1.55l0,9.59l1.94,-2.05c0.11,-0.12 0.28,-0.17 0.44,-0.14c0.17,0.02 0.31,0.13 0.38,0.28l2.03,4.46l1.24,-0.56l-2.03,-4.47c-0.07,-0.15 -0.06,-0.32 0.03,-0.46c0.09,-0.15 0.24,-0.23 0.41,-0.24l2.81,-0.13l-7.25,-6.28z" fill="currentColor" fill-rule="evenodd" stroke-opacity="1" id="svg_1"/>
                      <path d="m10.9,9.15l0.1,7.95l6.1,-2.2l-6.2,-5.75z" fill="#ffffff" id="svg_4"/>
                     </g>
                    </g>
                   </svg>`}</span>`,
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
            break;
          default:
            break;
        }
        if (interactivitySetting.cursor !== "AUTO") {
          cursor = interactivitySetting.cursor.toString().toLowerCase();
        }
        this.map!.getCanvas().style.cursor = cursor;
        const currentInteractionTarget = `${top.id}-${interactivitySetting.id}`;
        if (
          this.previousInteractionTarget === currentInteractionTarget &&
          (interactivitySetting.type === InteractivityType.Banner ||
            interactivitySetting.type === InteractivityType.FixedBlock ||
            interactivitySetting.type === InteractivityType.Popup ||
            interactivitySetting.type === InteractivityType.AllPropertiesPopup)
        ) {
          // Don't waste cycles on a state update
        } else {
          this.previousInteractionTarget = currentInteractionTarget;
          this.setState((prev) => {
            return {
              ...prev,
              bannerMessages,
              tooltip,
              fixedBlocks,
            };
          });
        }
      } else {
        clear();
      }
    } else {
      clear();
    }
  };

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

const orderedPotentialIdProperties = [
  "id",
  "ID",
  "Id",
  "OBJECTID",
  "FID",
  "fid",
  "OBJECT_ID",
  "ISO_SOV1",
];

function getIdProperty(properties: GeoJsonProperties) {
  if (properties === null) {
    return undefined;
  }
  let idProperty: string | undefined;
  for (const potentialIdProperty of orderedPotentialIdProperties) {
    if (properties[potentialIdProperty]) {
      idProperty = potentialIdProperty;
      break;
    }
  }
  return idProperty;
}
