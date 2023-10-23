import { useEffect, useState } from "react";
import { GLLegendFillSymbol } from "./LegendDataModel";
import { LegendResolvedImage, getImage } from "./MarkerSymbol";
import { Map } from "mapbox-gl";
import { colord, extend } from "colord";
import namesPlugin from "colord/plugins/names";
extend([namesPlugin]);

export default function FillSymbol({
  data,
  map,
}: {
  data: GLLegendFillSymbol;
  map?: Map;
}) {
  const [imageData, setImageData] = useState<LegendResolvedImage | undefined>();
  useEffect(() => {
    if (map && !imageData && data.patternImageId) {
      const resolvedImage = getImage(data.patternImageId, map);
      if (resolvedImage) {
        setImageData(resolvedImage);
      } else {
        const handler = () => {
          const resolvedImage = getImage(data.patternImageId!, map);
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
  }, [setImageData, map, data.patternImageId, imageData]);
  const simpleSymbol = data;
  let bg = colord(simpleSymbol.color);
  if (
    data.fillOpacity !== undefined &&
    data.fillOpacity < 1 &&
    bg.alpha() === 1
  ) {
    bg = bg.alpha(data.fillOpacity);
  }
  let strokeColor = colord(simpleSymbol.strokeColor || "#000");
  if (
    data.strokeOpacity !== undefined &&
    data.strokeOpacity < 1 &&
    strokeColor.alpha() === 1
  ) {
    strokeColor = strokeColor.alpha(data.strokeOpacity);
  }

  return (
    <div
      className="rounded-sm"
      style={{
        width: 15,
        height: 15,
        backgroundColor: bg.toRgbString(),
        border: simpleSymbol.strokeWidth
          ? `${Math.min(simpleSymbol.strokeWidth, 3)}px ${
              simpleSymbol.dashed ? "dashed" : "solid"
            } ${strokeColor.toRgbString()}`
          : undefined,
        ...(data.patternImageId && imageData
          ? {
              backgroundImage: `url(${imageData.url})`,
              backgroundSize: "cover",
            }
          : undefined),
      }}
    ></div>
  );
}
