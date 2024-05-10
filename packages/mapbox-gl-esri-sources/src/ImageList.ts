import { Map } from "mapbox-gl";
import {
  SimpleMarkerSymbol,
  PictureFillSymbol,
  PictureMarkerSymbol,
  SimpleFillSymbol,
} from "arcgis-rest-api";
import { v4 as uuid } from "uuid";
import drawSMS from "./symbols/drawSMS";
import fillPatterns, { PatternFn } from "./symbols/fillPatterns";
import { rgba, ptToPx, createCanvas } from "./symbols/utils";

export interface Image {
  pixelRatio: number;
  dataURI: string;
  width: number;
  height: number;
}

export interface ImageSet {
  id: string;
  images: Image[];
}

export class ImageList {
  private imageSets: (ImageSet | Promise<ImageSet>)[] = [];
  private supportsHighDPILegends = false;

  constructor(arcGISVersion?: number, imageSets?: ImageSet[]) {
    if (arcGISVersion && arcGISVersion >= 10.6) {
      this.supportsHighDPILegends = true;
    }
    if (imageSets) {
      this.imageSets = imageSets;
    }
  }

  toJSON() {
    return Promise.all(this.imageSets).then((imageSets) => {
      return imageSets;
    });
  }

  /**
   * Add a fill image for a PictureFillSymbol to the image set.
   *
   * PictureFillSymbol images cannot be requested at high-dpi from the legend
   * endpoint because they would include an outline and not the full pattern. If
   * there is a way to request a high-dpi image I do not know it. Instead,
   * serialized image data is just pulled from the symbol itself.
   *
   * @hidden
   * @param {PictureFillSymbol} symbol
   * @returns {string} imageid
   */
  addEsriPFS(symbol: PictureFillSymbol): string {
    const imageid = uuid();
    this.imageSets.push({
      id: imageid,
      images: [
        {
          pixelRatio: 1,
          dataURI: `data:${symbol.contentType};base64,${symbol.imageData}`,
          width: ptToPx(symbol.width!),
          height: ptToPx(symbol.height!),
        },
      ],
    });
    return imageid;
  }

  /**
   * Add a PictureMarkerSymbol image to the set. If the server supports high-dpi
   * legends (10.6+), this function will fetch high resolution markers from the
   * origin server. Otherwise it will just use serialized image data from the
   * symbol definition.
   *
   * @param {PictureMarkerSymbol} symbol
   * @param {string} serviceBaseUrl
   * @param {number} sublayer
   * @param {number} legendIndex
   * @returns {string} imageid
   * @hidden
   */
  addEsriPMS(
    symbol: PictureMarkerSymbol,
    serviceBaseUrl: string,
    sublayer: number,
    legendIndex: number
  ): string {
    const imageid = uuid();
    // cb - this is proving not be reliable with older servers in some case,
    // and I'm not sure it's adding much value. I'm going to remove it for now
    // 2/29/2024
    // if (this.supportsHighDPILegends) {
    //   this.imageSets.push(
    //     new Promise<ImageSet>(async (resolve) => {
    //       const imageSet = {
    //         id: imageid,
    //         images: [
    //           {
    //             pixelRatio: 1,
    //             dataURI: `data:${symbol.contentType};base64,${symbol.imageData}`,
    //             width: ptToPx(symbol.width!),
    //             height: ptToPx(symbol.height!),
    //           },
    //         ],
    //       };
    //       // FeatureServers don't have a legend endpoint
    //       if (/MapServer/.test(serviceBaseUrl)) {
    //         const legend2x = await fetchLegendImage(
    //           serviceBaseUrl,
    //           sublayer,
    //           legendIndex,
    //           2
    //         );
    //         const legend3x = await fetchLegendImage(
    //           serviceBaseUrl,
    //           sublayer,
    //           legendIndex,
    //           3
    //         );
    //         imageSet.images.push(legend2x, legend3x);
    //       }
    //       resolve(imageSet);
    //     })
    //   );
    // } else {
    this.imageSets.push({
      id: imageid,
      images: [
        {
          pixelRatio: 1,
          dataURI: `data:${symbol.contentType};base64,${symbol.imageData}`,
          width: ptToPx(symbol.width!),
          height: ptToPx(symbol.height!),
        },
      ],
    });
    // }
    return imageid;
  }

  /**
   * Adds a SimpleMarkerSymbol to the ImageSet. These markers will be generated
   * in multiple resolutions using html canvas to support multiple device pixel
   * ratios (1, 2 and 3)
   *
   * @param {SimpleMarkerSymbol} symbol
   * @returns {string} imageid
   * @hidden
   */
  addEsriSMS(symbol: SimpleMarkerSymbol): string {
    const imageid = uuid();
    let width = 0;
    const images = ([1, 2, 3] as (1 | 2 | 3)[]).map((pixelRatio) => {
      const marker = drawSMS(symbol, pixelRatio);
      if (pixelRatio === 1) width = marker.width;
      return {
        dataURI: marker.data,
        pixelRatio,
        width: marker.width,
        height: marker.height,
      };
    });
    this.imageSets.push({
      id: imageid,
      images: images,
    });
    return imageid;
  }

  /**
   * @hidden
   * @param {SimpleFillSymbol} symbol
   * @returns
   * @memberof ImageList
   */
  addEsriSFS(symbol: SimpleFillSymbol) {
    const imageId = uuid();
    const pattern = fillPatterns[symbol.style!];
    this.imageSets.push({
      id: imageId,
      images: [
        // createFillImage(pattern, 1, rgba(symbol.color)),
        createFillImage(pattern, rgba(symbol.color)),
        // createFillImage(pattern, 3, rgba(symbol.color)),
      ],
    });
    return imageId;
  }

  /**
   * Add all images to a MapBox GL JS map instance so that they may be used in
   * style layers. Call before adding layers created by {@link styleForFeatureLayer}.
   *
   * The ImageList may contain multiple copies of images at different dpi. Since
   * MapBox GL does not currently support adding images at multiple resolutions
   * this function will pick those that best match the current [devicePixelRatio](https://developer.mozilla.org/en-US/docs/Web/API/Window/devicePixelRatio).
   * If the devicePixelRatio changes (e.g. switching monitors), the images
   * *will not* be updated and may be at a less than ideal resolution, though
   * mapbox gl will still show them at the correct size.
   *
   * @param {Map} map
   * @returns
   * @memberof ImageList
   */
  addToMap(map: Map) {
    return Promise.all(
      this.imageSets.map(async (imageSet) => {
        if (imageSet instanceof Promise) {
          imageSet = await imageSet;
        }
        let imageData = imageSet.images[0];
        // MapBox GL does not allow adding images with multiple copies for each
        // pixelRatio. So we have to pick the one that matches the current
        // devicePixelRatio. This may change during the user session and result
        // than a less than ideal display, but updating the image is a lot of
        // extra complexity to manage.
        if (imageSet.images.length > 1) {
          imageData =
            imageSet.images.find(
              (i) => i.pixelRatio === Math.round(window.devicePixelRatio)
            ) || imageData;
        }
        const image = await createImage(
          imageData.width,
          imageData.height,
          imageData.dataURI
        );
        map.addImage(imageSet.id, image, {
          pixelRatio: imageData.pixelRatio,
        });
      })
    );
  }

  /**
   * Remove a previously added ImageList from the map
   *
   * @param {Map} map
   * @memberof ImageList
   */
  removeFromMap(map: Map) {
    return Promise.all(
      this.imageSets.map(async (imageSet) => {
        if (imageSet instanceof Promise) {
          imageSet = await imageSet;
        }
        map.removeImage(imageSet.id);
      })
    );
  }
}

/** @hidden */
async function createImage(
  width: number,
  height: number,
  dataURI: string
): Promise<HTMLImageElement> {
  return new Promise((resolve) => {
    const image = new Image(width, height);
    image.src = dataURI;
    image.onload = () => {
      resolve(image);
    };
  });
}

/** @hidden */
function createFillImage(pattern: PatternFn, strokeStyle: string): Image {
  const canvas = createCanvas(16, 16);
  const ctx = canvas.getContext("2d")!;
  ctx.imageSmoothingEnabled = true;
  pattern(ctx, strokeStyle);
  return {
    pixelRatio: 2,
    dataURI: CANVAS_TO_DATA_URL(canvas),
    width: 16,
    height: 16,
  };
}

export let CANVAS_TO_DATA_URL = (canvas: HTMLCanvasElement) => {
  return canvas.toDataURL();
};

export function setCanvasToDataURLPolyfill(
  polyfill: (canvas: HTMLCanvasElement) => string
) {
  CANVAS_TO_DATA_URL = polyfill;
}

/** @hidden */
const cache: {
  [rootUrl: string]: {
    [pixelRatio: number]: Promise<any>;
  };
} = {};

/** @hidden */
async function fetchLegendImage(
  serviceRoot: string,
  sublayer: number,
  legendIndex: number,
  pixelRatio: 2 | 3
): Promise<Image> {
  const legendData = await fetchLegendData(serviceRoot, pixelRatio);
  const sublayerData = legendData.layers.find(
    (lyr: any) => lyr.layerId === sublayer
  );
  const legendItem = sublayerData.legend[legendIndex];
  if (!legendItem) {
    throw new Error(
      `No legend item found at index ${legendIndex} for sublayer ${sublayer}`
    );
  }
  return {
    dataURI: `data:${legendItem.contentType};base64,${legendItem.imageData}`,
    pixelRatio,
    width: legendItem.width,
    height: legendItem.height,
  };
}

/** @hidden */
async function fetchLegendData(serviceRoot: string, pixelRatio: 2 | 3) {
  const dpi = pixelRatio === 2 ? 192 : 384;
  if (!cache[serviceRoot]) {
    cache[serviceRoot] = {};
  }
  if (!cache[serviceRoot][pixelRatio]) {
    cache[serviceRoot][pixelRatio] = fetch(
      `${serviceRoot}/legend?f=json&dpi=${dpi}`
    ).then((r) => r.json());
  }
  return cache[serviceRoot][pixelRatio];
}
