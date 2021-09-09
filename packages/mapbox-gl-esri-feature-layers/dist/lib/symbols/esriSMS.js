"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const utils_1 = require("./utils");
/** @hidden */
exports.default = (symbol, sourceId, imageList) => {
    const imageId = imageList.addEsriSMS(symbol);
    return [
        {
            id: utils_1.generateId(),
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
};
