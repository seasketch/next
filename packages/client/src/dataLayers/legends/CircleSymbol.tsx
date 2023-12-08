import { GLLegendCircleSymbol } from "./LegendDataModel";
import { colord, extend } from "colord";
import namesPlugin from "colord/plugins/names";
extend([namesPlugin]);

export default function CircleSymbol({ data }: { data: GLLegendCircleSymbol }) {
  const simpleSymbol = data;
  const diameter = simpleSymbol.radius
    ? Math.min(simpleSymbol.radius, 16) * 2
    : 10;
  let bg = colord(simpleSymbol.color || "transparent");
  if (data.fillOpacity && data.fillOpacity < 1 && bg.alpha() === 1) {
    bg = bg.alpha(data.fillOpacity);
  }
  return (
    <div
      style={{
        width: diameter + simpleSymbol.strokeWidth,
        height: diameter + simpleSymbol.strokeWidth,
        borderRadius: "50%",
        backgroundColor: bg.toRgbString(),
        border: simpleSymbol.strokeWidth
          ? `${Math.min(simpleSymbol.strokeWidth, 3)}px solid ${
              simpleSymbol.strokeColor
            }`
          : undefined,
      }}
    ></div>
  );
}
