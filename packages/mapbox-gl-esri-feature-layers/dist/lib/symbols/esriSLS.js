"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const utils_1 = require("./utils");
const linePatterns_1 = __importDefault(require("./linePatterns"));
const utils_2 = require("./utils");
/** @hidden */
exports.default = (symbol, sourceId) => {
    const { color, opacity } = utils_1.colorAndOpacity(symbol.color);
    let strokeWidth = utils_1.ptToPx(symbol.width || 1);
    // No idea why... but this matches map service image output
    if (strokeWidth === -1) {
        strokeWidth = 1;
    }
    const style = symbol.style || "esriSLSSolid";
    const layer = {
        id: utils_2.generateId(),
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
        layer.paint["line-dasharray"] = linePatterns_1.default[style](strokeWidth);
    }
    return [layer];
};
