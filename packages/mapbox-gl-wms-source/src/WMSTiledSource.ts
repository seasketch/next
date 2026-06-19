import mapboxgl, { AnySourceData, Map } from "mapbox-gl";
import { CustomSourceType } from "./CustomGLSource";
import { WMSBaseSource, WMSCommonOptions } from "./WMSBaseSource";

export interface WMSTiledSourceOptions extends WMSCommonOptions {}

export class WMSTiledSource extends WMSBaseSource {
  type: CustomSourceType = "WMSTiledSource";

  protected onLayersUpdated(): void {
    if (!this.map) return;
    const source = this.map.getSource(this.sourceId);
    if (source && source.type === "raster") {
      this.fireDataLoading();
      const rasterSource = source as mapboxgl.RasterTileSource;
      rasterSource.setTiles([this.getTiledUrlTemplate()]);
    }
  }

  async getGLSource(map: Map): Promise<AnySourceData> {
    const meta = await this.getComputedMetadata();
    return {
      type: "raster",
      tiles: [this.getTiledUrlTemplate()],
      tileSize: this.options.tileSize || 256,
      bounds: meta.bounds,
      attribution: meta.attribution,
    };
  }

  async addToMap(map: Map): Promise<string> {
    this.map = map;
    const sourceData = await this.getGLSource(map);
    map.addSource(this.sourceId, sourceData);
    this.addEventListeners(map);
    return this.sourceId;
  }

  addEventListeners(map: Map): void {
    this.map = map;
    map.on("data", this.onMapData);
    map.on("error", this.onMapError);
  }

  removeEventListeners(map: Map): void {
    map.off("data", this.onMapData);
    map.off("error", this.onMapError);
    if (this.map === map) {
      this.map = undefined;
    }
  }
}
