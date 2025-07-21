"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const utils_1 = require("./utils");
const esriSLS_1 = __importDefault(require("./esriSLS"));
const utils_2 = require("./utils");
/** @hidden */
exports.default = (symbol, sourceId, imageList) => {
    const layers = [];
    let useFillOutlineColor = symbol.outline &&
        (0, utils_1.ptToPx)(symbol.outline.width || 1) === 1 &&
        symbol.outline.style === "esriSLSSolid";
    switch (symbol.style) {
        case "esriSFSSolid":
            if (symbol.color && symbol.color[3] === 0) {
                useFillOutlineColor = false;
            }
            else {
                layers.push({
                    id: (0, utils_2.generateId)(),
                    type: "fill",
                    source: sourceId,
                    paint: {
                        "fill-color": (0, utils_1.rgba)(symbol.color),
                        ...(useFillOutlineColor
                            ? { "fill-outline-color": (0, utils_1.rgba)(symbol.outline.color) }
                            : {}),
                    },
                });
            }
            break;
        case "esriSFSNull":
            // leave empty
            break;
        case "esriSFSBackwardDiagonal":
        case "esriSFSCross":
        case "esriSFSDiagonalCross":
        case "esriSFSForwardDiagonal":
        case "esriSFSHorizontal":
        case "esriSFSVertical":
            const imageId = imageList.addEsriSFS(symbol);
            layers.push({
                id: (0, utils_2.generateId)(),
                source: sourceId,
                type: "fill",
                paint: {
                    "fill-pattern": imageId,
                    ...(useFillOutlineColor
                        ? { "fill-outline-color": (0, utils_1.rgba)(symbol.outline.color) }
                        : {}),
                },
            });
            break;
        default:
            throw new Error(`Unknown fill style ${symbol.style}`);
    }
    if (symbol.outline && !useFillOutlineColor) {
        let outline = (0, esriSLS_1.default)(symbol.outline, sourceId);
        layers.push(...outline);
    }
    return layers;
};
//# sourceMappingURL=esriSFS.js.map