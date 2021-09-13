"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const esriSLS_1 = __importDefault(require("./esriSLS"));
const utils_1 = require("./utils");
// TODO: Add support for lesser-used options
// height
// width
// angle
// xoffset
// yoffset
// xscale
// yscale
/** @hidden */
exports.default = (symbol, sourceId, imageList) => {
    const imageId = imageList.addEsriPFS(symbol);
    const layers = [
        {
            id: utils_1.generateId(),
            source: sourceId,
            type: "fill",
            paint: {
                "fill-pattern": imageId,
            },
            layout: {},
        },
    ];
    if ("outline" in symbol) {
        let outline = esriSLS_1.default(symbol.outline, sourceId);
        layers.push(...outline);
    }
    return layers;
};
