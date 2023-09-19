import { GLLegendLineSymbol } from "./glLegends";
import { colord, extend } from "colord";
import namesPlugin from "colord/plugins/names";
extend([namesPlugin]);

// TODO: support line patterns
// but how??
export default function LineSymbol(props: { data: GLLegendLineSymbol }) {
  const simpleSymbol = props.data;
  return (
    <div
      style={{
        transform: "rotate(-45deg)",
        width: 15,
        height: 0,
        borderBottom: simpleSymbol.strokeWidth
          ? `${Math.min(simpleSymbol.strokeWidth, 3)}px ${
              simpleSymbol.dashed !== undefined && simpleSymbol.dashed !== false
                ? "dashed"
                : "solid"
            } ${simpleSymbol.color}`
          : undefined,
      }}
    ></div>
  );
}
