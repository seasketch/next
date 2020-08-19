import { colorAndOpacity, ptToPx } from "./utils";
import linePatterns from "./linePatterns";
import { generateId } from "./utils";
export default (symbol, sourceId) => {
    const { color, opacity } = colorAndOpacity(symbol.color);
    let strokeWidth = ptToPx(symbol.width || 1);
    // No idea why... but this matches map service image output
    if (strokeWidth === -1) {
        strokeWidth = 1;
    }
    const style = symbol.style || "esriSLSSolid";
    const layer = {
        id: generateId(),
        type: "line",
        paint: {
            "line-color": color,
            "line-opacity": opacity,
            "line-width": strokeWidth,
        },
        layout: {},
        source: sourceId,
    };
    if (style !== "esriSLSSolid") {
        layer.paint["line-dasharray"] = linePatterns[style](strokeWidth);
    }
    return [layer];
};
