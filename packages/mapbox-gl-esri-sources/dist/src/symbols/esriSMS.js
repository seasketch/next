"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const utils_1 = require("./utils");
/** @hidden */
exports.default = (symbol, sourceId, imageList) => {
    var _a, _b;
    if (symbol.style === "esriSMSCircle") {
        // If it's a circle symbol, just make a gl style circle layer
        return [
            {
                id: (0, utils_1.generateId)(),
                type: "circle",
                source: sourceId,
                paint: {
                    "circle-color": (0, utils_1.rgba)(symbol.color),
                    "circle-radius": symbol.size,
                    "circle-stroke-color": (0, utils_1.rgba)(((_a = symbol.outline) === null || _a === void 0 ? void 0 : _a.color) || symbol.color),
                    "circle-stroke-width": ((_b = symbol.outline) === null || _b === void 0 ? void 0 : _b.width) || 0,
                },
                layout: {},
            },
        ];
    }
    else {
        const imageId = imageList.addEsriSMS(symbol);
        return [
            {
                id: (0, utils_1.generateId)(),
                type: "symbol",
                source: sourceId,
                paint: {},
                layout: {
                    "icon-allow-overlap": true,
                    "icon-rotate": symbol.angle,
                    "icon-offset": [symbol.xoffset || 0, symbol.yoffset || 0],
                    "icon-image": imageId,
                    "icon-size": 1,
                },
            },
        ];
    }
};
//# sourceMappingURL=esriSMS.js.map