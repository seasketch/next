import { Map } from "mapbox-gl";
import { GLLegendMarkerSymbol } from "./glLegends";
import { useEffect, useState } from "react";
import { blankDataUri } from "@seasketch/mapbox-gl-esri-sources/dist/src/ArcGISDynamicMapService";
import { colord, extend } from "colord";
import namesPlugin from "colord/plugins/names";
extend([namesPlugin]);

export default function MarkerSymbol({
  map,
  data,
}: {
  data: GLLegendMarkerSymbol;
  map: Map;
}) {
  const [imageData, setImageData] = useState<LegendResolvedImage | undefined>();

  useEffect(() => {
    if (!imageData && data.imageId) {
      const resolvedImage = getImage(data.imageId, map);
      if (resolvedImage) {
        setImageData(resolvedImage);
      } else {
        const handler = () => {
          const resolvedImage = getImage(data.imageId, map);
          if (resolvedImage) {
            setImageData(resolvedImage);
            map.off("styledata", handler);
          }
        };
        map.on("styledata", handler);
        return () => {
          map.off("styledata", handler);
        };
      }
    }
  }, [setImageData, map, data.imageId, imageData]);

  if (imageData) {
    return <img className="max-w-3/4" src={imageData.url} />;
  } else {
    // eslint-disable-next-line i18next/no-literal-string
    return null;
  }
}

const toImageData = (d: { width: number; height: number; data: any }) => {
  const { width, height, data } = d;
  const size = Math.max(width, height);
  const canvas = document.createElement("canvas");
  canvas.setAttribute("width", size.toString());
  canvas.setAttribute("height", size.toString());
  const ctx = canvas.getContext("2d");
  if (ctx) {
    const imageData = new ImageData(
      Uint8ClampedArray.from(data),
      width,
      height
    );
    ctx.putImageData(imageData, (size - width) / 4, (size - height) / 4);
  }
  return canvas.toDataURL();
};

export interface LegendResolvedImage {
  url: string;
  width: number;
  height: number;
  pixelRatio: number;
}

export function getImage(
  id: string,
  map: Map
): LegendResolvedImage | undefined {
  // @ts-ignore
  const d = map.style.getImage(id);
  if (d) {
    if (d.sdf) {
      // TODO: somehow support sdf?
      return {
        url: blankDataUri,
        width: d.width,
        height: d.height,
        pixelRatio: d.pixelRatio,
      };
    } else {
      const url = toImageData(d.data);
      if (url) {
        return {
          url,
          width: d.data.width,
          height: d.data.height,
          pixelRatio: d.pixelRatio,
        };
      } else {
        // If it fails somehow, return a blank data uri
        return {
          url: blankDataUri,
          width: d.width,
          height: d.height,
          pixelRatio: d.pixelRatio,
        };
      }
    }
  } else {
    return undefined;
  }
}
