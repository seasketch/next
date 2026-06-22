import mapboxgl, { AnySourceData, Map } from "mapbox-gl";
import { CustomSourceType } from "./CustomGLSource";
import { WMSBaseSource, WMSCommonOptions, debounced } from "./WMSBaseSource";
import { getMapViewportCoordinates } from "./util";

export interface WMSDynamicSourceOptions extends WMSCommonOptions {}

export class WMSDynamicSource extends WMSBaseSource {
  type: CustomSourceType = "WMSDynamicSource";
  private debouncedUpdate = debounced(() => this.updateSource(), 50);

  protected onLayersUpdated(): void {
    this.debouncedUpdate();
  }

  async getGLSource(map: Map): Promise<AnySourceData> {
    const meta = await this.getComputedMetadata();
    const coordinates = getMapViewportCoordinates(map);
    const url = this.getMapUrl(map);
    return {
      type: "image",
      url,
      coordinates,
      attribution: meta.attribution,
    } as AnySourceData;
  }

  async addToMap(map: Map): Promise<string> {
    const sourceData = await this.getGLSource(map);
    map.addSource(this.sourceId, sourceData);
    this.addEventListeners(map);
    return this.sourceId;
  }

  addEventListeners(map: Map): void {
    if (!this.map || this.map !== map) {
      if (this.map) {
        this.removeEventListeners(this.map);
      }
      this.map = map;
      map.on("moveend", this.debouncedUpdate);
      map.on("data", this.onMapData);
      map.on("error", this.onMapError);
    }
  }

  removeEventListeners(map: Map): void {
    map.off("moveend", this.debouncedUpdate);
    map.off("data", this.onMapData);
    map.off("error", this.onMapError);
    if (this.map === map) {
      this.map = undefined;
    }
  }

  private updateSource(): void {
    const source = this.map?.getSource(this.sourceId);
    if (!source || !this.map) {
      return;
    }
    if (source.type !== "image") {
      return;
    }
    const coordinates = getMapViewportCoordinates(this.map);
    const url = this.getMapUrl(this.map);
    const imageSource = source as mapboxgl.ImageSource;
    const currentUrl = (imageSource as mapboxgl.ImageSource & { url?: string })
      .url;
    if (currentUrl === url) {
      return;
    }
    this.fireDataLoading();
    imageSource.updateImage({ url, coordinates });
  }
}
