"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.subjectIsFragment = exports.mergeTouchingFragments = exports.eliminateOverlap = exports.createFragments = exports.calculateArea = exports.clipToGeographies = exports.clipSketchToPolygons = exports.clipToGeography = exports.unionAtAntimeridian = exports.prepareSketch = void 0;
var prepareSketch_1 = require("./utils/prepareSketch");
Object.defineProperty(exports, "prepareSketch", { enumerable: true, get: function () { return prepareSketch_1.prepareSketch; } });
var unionAtAntimeridian_1 = require("./utils/unionAtAntimeridian");
Object.defineProperty(exports, "unionAtAntimeridian", { enumerable: true, get: function () { return unionAtAntimeridian_1.unionAtAntimeridian; } });
var geographies_1 = require("./geographies");
Object.defineProperty(exports, "clipToGeography", { enumerable: true, get: function () { return geographies_1.clipToGeography; } });
Object.defineProperty(exports, "clipSketchToPolygons", { enumerable: true, get: function () { return geographies_1.clipSketchToPolygons; } });
Object.defineProperty(exports, "clipToGeographies", { enumerable: true, get: function () { return geographies_1.clipToGeographies; } });
Object.defineProperty(exports, "calculateArea", { enumerable: true, get: function () { return geographies_1.calculateArea; } });
var fragments_1 = require("./fragments");
Object.defineProperty(exports, "createFragments", { enumerable: true, get: function () { return fragments_1.createFragments; } });
Object.defineProperty(exports, "eliminateOverlap", { enumerable: true, get: function () { return fragments_1.eliminateOverlap; } });
Object.defineProperty(exports, "mergeTouchingFragments", { enumerable: true, get: function () { return fragments_1.mergeTouchingFragments; } });
var metrics_1 = require("./metrics/metrics");
Object.defineProperty(exports, "subjectIsFragment", { enumerable: true, get: function () { return metrics_1.subjectIsFragment; } });
//# sourceMappingURL=index.js.map