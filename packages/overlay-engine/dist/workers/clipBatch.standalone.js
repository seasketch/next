"use strict";
var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __commonJS = (cb, mod) => function __require() {
  return mod || (0, cb[__getOwnPropNames(cb)[0]])((mod = { exports: {} }).exports, mod), mod.exports;
};
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// node_modules/sweepline-intersections/dist/sweeplineIntersections.js
var require_sweeplineIntersections = __commonJS({
  "node_modules/sweepline-intersections/dist/sweeplineIntersections.js"(exports2, module2) {
    (function(global, factory) {
      typeof exports2 === "object" && typeof module2 !== "undefined" ? module2.exports = factory() : typeof define === "function" && define.amd ? define(factory) : (global = typeof globalThis !== "undefined" ? globalThis : global || self, global.sweeplineIntersections = factory());
    })(exports2, (function() {
      "use strict";
      var TinyQueue = function TinyQueue2(data, compare2) {
        if (data === void 0) data = [];
        if (compare2 === void 0) compare2 = defaultCompare;
        this.data = data;
        this.length = this.data.length;
        this.compare = compare2;
        if (this.length > 0) {
          for (var i = (this.length >> 1) - 1; i >= 0; i--) {
            this._down(i);
          }
        }
      };
      TinyQueue.prototype.push = function push(item) {
        this.data.push(item);
        this.length++;
        this._up(this.length - 1);
      };
      TinyQueue.prototype.pop = function pop() {
        if (this.length === 0) {
          return void 0;
        }
        var top = this.data[0];
        var bottom = this.data.pop();
        this.length--;
        if (this.length > 0) {
          this.data[0] = bottom;
          this._down(0);
        }
        return top;
      };
      TinyQueue.prototype.peek = function peek() {
        return this.data[0];
      };
      TinyQueue.prototype._up = function _up(pos) {
        var ref = this;
        var data = ref.data;
        var compare2 = ref.compare;
        var item = data[pos];
        while (pos > 0) {
          var parent = pos - 1 >> 1;
          var current = data[parent];
          if (compare2(item, current) >= 0) {
            break;
          }
          data[pos] = current;
          pos = parent;
        }
        data[pos] = item;
      };
      TinyQueue.prototype._down = function _down(pos) {
        var ref = this;
        var data = ref.data;
        var compare2 = ref.compare;
        var halfLength = this.length >> 1;
        var item = data[pos];
        while (pos < halfLength) {
          var left = (pos << 1) + 1;
          var best = data[left];
          var right = left + 1;
          if (right < this.length && compare2(data[right], best) < 0) {
            left = right;
            best = data[right];
          }
          if (compare2(best, item) >= 0) {
            break;
          }
          data[pos] = best;
          pos = left;
        }
        data[pos] = item;
      };
      function defaultCompare(a, b) {
        return a < b ? -1 : a > b ? 1 : 0;
      }
      function checkWhichEventIsLeft(e1, e2) {
        if (e1.p.x > e2.p.x) {
          return 1;
        }
        if (e1.p.x < e2.p.x) {
          return -1;
        }
        if (e1.p.y !== e2.p.y) {
          return e1.p.y > e2.p.y ? 1 : -1;
        }
        return 1;
      }
      function checkWhichSegmentHasRightEndpointFirst(seg1, seg2) {
        if (seg1.rightSweepEvent.p.x > seg2.rightSweepEvent.p.x) {
          return 1;
        }
        if (seg1.rightSweepEvent.p.x < seg2.rightSweepEvent.p.x) {
          return -1;
        }
        if (seg1.rightSweepEvent.p.y !== seg2.rightSweepEvent.p.y) {
          return seg1.rightSweepEvent.p.y < seg2.rightSweepEvent.p.y ? 1 : -1;
        }
        return 1;
      }
      var Event = function Event2(p, featureId2, ringId2, eventId2) {
        this.p = {
          x: p[0],
          y: p[1]
        };
        this.featureId = featureId2;
        this.ringId = ringId2;
        this.eventId = eventId2;
        this.otherEvent = null;
        this.isLeftEndpoint = null;
      };
      Event.prototype.isSamePoint = function isSamePoint(eventToCheck) {
        return this.p.x === eventToCheck.p.x && this.p.y === eventToCheck.p.y;
      };
      function fillEventQueue(geojson, eventQueue) {
        if (geojson.type === "FeatureCollection") {
          var features = geojson.features;
          for (var i = 0; i < features.length; i++) {
            processFeature(features[i], eventQueue);
          }
        } else {
          processFeature(geojson, eventQueue);
        }
      }
      var featureId = 0;
      var ringId = 0;
      var eventId = 0;
      function processFeature(featureOrGeometry, eventQueue) {
        var geom = featureOrGeometry.type === "Feature" ? featureOrGeometry.geometry : featureOrGeometry;
        var coords = geom.coordinates;
        if (geom.type === "Polygon" || geom.type === "MultiLineString") {
          coords = [coords];
        }
        if (geom.type === "LineString") {
          coords = [[coords]];
        }
        for (var i = 0; i < coords.length; i++) {
          for (var ii = 0; ii < coords[i].length; ii++) {
            var currentP = coords[i][ii][0];
            var nextP = null;
            ringId = ringId + 1;
            for (var iii = 0; iii < coords[i][ii].length - 1; iii++) {
              nextP = coords[i][ii][iii + 1];
              var e1 = new Event(currentP, featureId, ringId, eventId);
              var e2 = new Event(nextP, featureId, ringId, eventId + 1);
              e1.otherEvent = e2;
              e2.otherEvent = e1;
              if (checkWhichEventIsLeft(e1, e2) > 0) {
                e2.isLeftEndpoint = true;
                e1.isLeftEndpoint = false;
              } else {
                e1.isLeftEndpoint = true;
                e2.isLeftEndpoint = false;
              }
              eventQueue.push(e1);
              eventQueue.push(e2);
              currentP = nextP;
              eventId = eventId + 1;
            }
          }
        }
        featureId = featureId + 1;
      }
      var Segment2 = function Segment3(event) {
        this.leftSweepEvent = event;
        this.rightSweepEvent = event.otherEvent;
      };
      function testSegmentIntersect(seg1, seg2) {
        if (seg1 === null || seg2 === null) {
          return false;
        }
        if (seg1.leftSweepEvent.ringId === seg2.leftSweepEvent.ringId && (seg1.rightSweepEvent.isSamePoint(seg2.leftSweepEvent) || seg1.rightSweepEvent.isSamePoint(seg2.leftSweepEvent) || seg1.rightSweepEvent.isSamePoint(seg2.rightSweepEvent) || seg1.leftSweepEvent.isSamePoint(seg2.leftSweepEvent) || seg1.leftSweepEvent.isSamePoint(seg2.rightSweepEvent))) {
          return false;
        }
        var x1 = seg1.leftSweepEvent.p.x;
        var y1 = seg1.leftSweepEvent.p.y;
        var x2 = seg1.rightSweepEvent.p.x;
        var y2 = seg1.rightSweepEvent.p.y;
        var x3 = seg2.leftSweepEvent.p.x;
        var y3 = seg2.leftSweepEvent.p.y;
        var x4 = seg2.rightSweepEvent.p.x;
        var y4 = seg2.rightSweepEvent.p.y;
        var denom = (y4 - y3) * (x2 - x1) - (x4 - x3) * (y2 - y1);
        var numeA = (x4 - x3) * (y1 - y3) - (y4 - y3) * (x1 - x3);
        var numeB = (x2 - x1) * (y1 - y3) - (y2 - y1) * (x1 - x3);
        if (denom === 0) {
          if (numeA === 0 && numeB === 0) {
            return false;
          }
          return false;
        }
        var uA = numeA / denom;
        var uB = numeB / denom;
        if (uA >= 0 && uA <= 1 && uB >= 0 && uB <= 1) {
          var x = x1 + uA * (x2 - x1);
          var y = y1 + uA * (y2 - y1);
          return [x, y];
        }
        return false;
      }
      function runCheck(eventQueue, ignoreSelfIntersections) {
        ignoreSelfIntersections = ignoreSelfIntersections ? ignoreSelfIntersections : false;
        var intersectionPoints = [];
        var outQueue = new TinyQueue([], checkWhichSegmentHasRightEndpointFirst);
        while (eventQueue.length) {
          var event = eventQueue.pop();
          if (event.isLeftEndpoint) {
            var segment = new Segment2(event);
            for (var i = 0; i < outQueue.data.length; i++) {
              var otherSeg = outQueue.data[i];
              if (ignoreSelfIntersections) {
                if (otherSeg.leftSweepEvent.featureId === event.featureId) {
                  continue;
                }
              }
              var intersection3 = testSegmentIntersect(segment, otherSeg);
              if (intersection3 !== false) {
                intersectionPoints.push(intersection3);
              }
            }
            outQueue.push(segment);
          } else if (event.isLeftEndpoint === false) {
            outQueue.pop();
          }
        }
        return intersectionPoints;
      }
      function sweeplineIntersections2(geojson, ignoreSelfIntersections) {
        var eventQueue = new TinyQueue([], checkWhichEventIsLeft);
        fillEventQueue(geojson, eventQueue);
        return runCheck(eventQueue, ignoreSelfIntersections);
      }
      return sweeplineIntersections2;
    }));
  }
});

// node_modules/rbush/rbush.js
var require_rbush = __commonJS({
  "node_modules/rbush/rbush.js"(exports2, module2) {
    (function(global, factory) {
      typeof exports2 === "object" && typeof module2 !== "undefined" ? module2.exports = factory() : typeof define === "function" && define.amd ? define(factory) : (global = global || self, global.RBush = factory());
    })(exports2, function() {
      "use strict";
      function quickselect(arr, k, left, right, compare2) {
        quickselectStep(arr, k, left || 0, right || arr.length - 1, compare2 || defaultCompare);
      }
      function quickselectStep(arr, k, left, right, compare2) {
        while (right > left) {
          if (right - left > 600) {
            var n = right - left + 1;
            var m = k - left + 1;
            var z = Math.log(n);
            var s = 0.5 * Math.exp(2 * z / 3);
            var sd = 0.5 * Math.sqrt(z * s * (n - s) / n) * (m - n / 2 < 0 ? -1 : 1);
            var newLeft = Math.max(left, Math.floor(k - m * s / n + sd));
            var newRight = Math.min(right, Math.floor(k + (n - m) * s / n + sd));
            quickselectStep(arr, k, newLeft, newRight, compare2);
          }
          var t = arr[k];
          var i = left;
          var j = right;
          swap(arr, left, k);
          if (compare2(arr[right], t) > 0) {
            swap(arr, left, right);
          }
          while (i < j) {
            swap(arr, i, j);
            i++;
            j--;
            while (compare2(arr[i], t) < 0) {
              i++;
            }
            while (compare2(arr[j], t) > 0) {
              j--;
            }
          }
          if (compare2(arr[left], t) === 0) {
            swap(arr, left, j);
          } else {
            j++;
            swap(arr, j, right);
          }
          if (j <= k) {
            left = j + 1;
          }
          if (k <= j) {
            right = j - 1;
          }
        }
      }
      function swap(arr, i, j) {
        var tmp = arr[i];
        arr[i] = arr[j];
        arr[j] = tmp;
      }
      function defaultCompare(a, b) {
        return a < b ? -1 : a > b ? 1 : 0;
      }
      var RBush = function RBush2(maxEntries) {
        if (maxEntries === void 0) maxEntries = 9;
        this._maxEntries = Math.max(4, maxEntries);
        this._minEntries = Math.max(2, Math.ceil(this._maxEntries * 0.4));
        this.clear();
      };
      RBush.prototype.all = function all() {
        return this._all(this.data, []);
      };
      RBush.prototype.search = function search(bbox3) {
        var node = this.data;
        var result = [];
        if (!intersects(bbox3, node)) {
          return result;
        }
        var toBBox = this.toBBox;
        var nodesToSearch = [];
        while (node) {
          for (var i = 0; i < node.children.length; i++) {
            var child = node.children[i];
            var childBBox = node.leaf ? toBBox(child) : child;
            if (intersects(bbox3, childBBox)) {
              if (node.leaf) {
                result.push(child);
              } else if (contains(bbox3, childBBox)) {
                this._all(child, result);
              } else {
                nodesToSearch.push(child);
              }
            }
          }
          node = nodesToSearch.pop();
        }
        return result;
      };
      RBush.prototype.collides = function collides(bbox3) {
        var node = this.data;
        if (!intersects(bbox3, node)) {
          return false;
        }
        var nodesToSearch = [];
        while (node) {
          for (var i = 0; i < node.children.length; i++) {
            var child = node.children[i];
            var childBBox = node.leaf ? this.toBBox(child) : child;
            if (intersects(bbox3, childBBox)) {
              if (node.leaf || contains(bbox3, childBBox)) {
                return true;
              }
              nodesToSearch.push(child);
            }
          }
          node = nodesToSearch.pop();
        }
        return false;
      };
      RBush.prototype.load = function load(data) {
        if (!(data && data.length)) {
          return this;
        }
        if (data.length < this._minEntries) {
          for (var i = 0; i < data.length; i++) {
            this.insert(data[i]);
          }
          return this;
        }
        var node = this._build(data.slice(), 0, data.length - 1, 0);
        if (!this.data.children.length) {
          this.data = node;
        } else if (this.data.height === node.height) {
          this._splitRoot(this.data, node);
        } else {
          if (this.data.height < node.height) {
            var tmpNode = this.data;
            this.data = node;
            node = tmpNode;
          }
          this._insert(node, this.data.height - node.height - 1, true);
        }
        return this;
      };
      RBush.prototype.insert = function insert(item) {
        if (item) {
          this._insert(item, this.data.height - 1);
        }
        return this;
      };
      RBush.prototype.clear = function clear() {
        this.data = createNode([]);
        return this;
      };
      RBush.prototype.remove = function remove(item, equalsFn) {
        if (!item) {
          return this;
        }
        var node = this.data;
        var bbox3 = this.toBBox(item);
        var path = [];
        var indexes = [];
        var i, parent, goingUp;
        while (node || path.length) {
          if (!node) {
            node = path.pop();
            parent = path[path.length - 1];
            i = indexes.pop();
            goingUp = true;
          }
          if (node.leaf) {
            var index = findItem(item, node.children, equalsFn);
            if (index !== -1) {
              node.children.splice(index, 1);
              path.push(node);
              this._condense(path);
              return this;
            }
          }
          if (!goingUp && !node.leaf && contains(node, bbox3)) {
            path.push(node);
            indexes.push(i);
            i = 0;
            parent = node;
            node = node.children[0];
          } else if (parent) {
            i++;
            node = parent.children[i];
            goingUp = false;
          } else {
            node = null;
          }
        }
        return this;
      };
      RBush.prototype.toBBox = function toBBox(item) {
        return item;
      };
      RBush.prototype.compareMinX = function compareMinX(a, b) {
        return a.minX - b.minX;
      };
      RBush.prototype.compareMinY = function compareMinY(a, b) {
        return a.minY - b.minY;
      };
      RBush.prototype.toJSON = function toJSON() {
        return this.data;
      };
      RBush.prototype.fromJSON = function fromJSON(data) {
        this.data = data;
        return this;
      };
      RBush.prototype._all = function _all(node, result) {
        var nodesToSearch = [];
        while (node) {
          if (node.leaf) {
            result.push.apply(result, node.children);
          } else {
            nodesToSearch.push.apply(nodesToSearch, node.children);
          }
          node = nodesToSearch.pop();
        }
        return result;
      };
      RBush.prototype._build = function _build(items, left, right, height) {
        var N = right - left + 1;
        var M = this._maxEntries;
        var node;
        if (N <= M) {
          node = createNode(items.slice(left, right + 1));
          calcBBox(node, this.toBBox);
          return node;
        }
        if (!height) {
          height = Math.ceil(Math.log(N) / Math.log(M));
          M = Math.ceil(N / Math.pow(M, height - 1));
        }
        node = createNode([]);
        node.leaf = false;
        node.height = height;
        var N2 = Math.ceil(N / M);
        var N1 = N2 * Math.ceil(Math.sqrt(M));
        multiSelect(items, left, right, N1, this.compareMinX);
        for (var i = left; i <= right; i += N1) {
          var right2 = Math.min(i + N1 - 1, right);
          multiSelect(items, i, right2, N2, this.compareMinY);
          for (var j = i; j <= right2; j += N2) {
            var right3 = Math.min(j + N2 - 1, right2);
            node.children.push(this._build(items, j, right3, height - 1));
          }
        }
        calcBBox(node, this.toBBox);
        return node;
      };
      RBush.prototype._chooseSubtree = function _chooseSubtree(bbox3, node, level, path) {
        while (true) {
          path.push(node);
          if (node.leaf || path.length - 1 === level) {
            break;
          }
          var minArea = Infinity;
          var minEnlargement = Infinity;
          var targetNode = void 0;
          for (var i = 0; i < node.children.length; i++) {
            var child = node.children[i];
            var area2 = bboxArea(child);
            var enlargement = enlargedArea(bbox3, child) - area2;
            if (enlargement < minEnlargement) {
              minEnlargement = enlargement;
              minArea = area2 < minArea ? area2 : minArea;
              targetNode = child;
            } else if (enlargement === minEnlargement) {
              if (area2 < minArea) {
                minArea = area2;
                targetNode = child;
              }
            }
          }
          node = targetNode || node.children[0];
        }
        return node;
      };
      RBush.prototype._insert = function _insert(item, level, isNode) {
        var bbox3 = isNode ? item : this.toBBox(item);
        var insertPath = [];
        var node = this._chooseSubtree(bbox3, this.data, level, insertPath);
        node.children.push(item);
        extend(node, bbox3);
        while (level >= 0) {
          if (insertPath[level].children.length > this._maxEntries) {
            this._split(insertPath, level);
            level--;
          } else {
            break;
          }
        }
        this._adjustParentBBoxes(bbox3, insertPath, level);
      };
      RBush.prototype._split = function _split(insertPath, level) {
        var node = insertPath[level];
        var M = node.children.length;
        var m = this._minEntries;
        this._chooseSplitAxis(node, m, M);
        var splitIndex = this._chooseSplitIndex(node, m, M);
        var newNode = createNode(node.children.splice(splitIndex, node.children.length - splitIndex));
        newNode.height = node.height;
        newNode.leaf = node.leaf;
        calcBBox(node, this.toBBox);
        calcBBox(newNode, this.toBBox);
        if (level) {
          insertPath[level - 1].children.push(newNode);
        } else {
          this._splitRoot(node, newNode);
        }
      };
      RBush.prototype._splitRoot = function _splitRoot(node, newNode) {
        this.data = createNode([node, newNode]);
        this.data.height = node.height + 1;
        this.data.leaf = false;
        calcBBox(this.data, this.toBBox);
      };
      RBush.prototype._chooseSplitIndex = function _chooseSplitIndex(node, m, M) {
        var index;
        var minOverlap = Infinity;
        var minArea = Infinity;
        for (var i = m; i <= M - m; i++) {
          var bbox1 = distBBox(node, 0, i, this.toBBox);
          var bbox22 = distBBox(node, i, M, this.toBBox);
          var overlap = intersectionArea(bbox1, bbox22);
          var area2 = bboxArea(bbox1) + bboxArea(bbox22);
          if (overlap < minOverlap) {
            minOverlap = overlap;
            index = i;
            minArea = area2 < minArea ? area2 : minArea;
          } else if (overlap === minOverlap) {
            if (area2 < minArea) {
              minArea = area2;
              index = i;
            }
          }
        }
        return index || M - m;
      };
      RBush.prototype._chooseSplitAxis = function _chooseSplitAxis(node, m, M) {
        var compareMinX = node.leaf ? this.compareMinX : compareNodeMinX;
        var compareMinY = node.leaf ? this.compareMinY : compareNodeMinY;
        var xMargin = this._allDistMargin(node, m, M, compareMinX);
        var yMargin = this._allDistMargin(node, m, M, compareMinY);
        if (xMargin < yMargin) {
          node.children.sort(compareMinX);
        }
      };
      RBush.prototype._allDistMargin = function _allDistMargin(node, m, M, compare2) {
        node.children.sort(compare2);
        var toBBox = this.toBBox;
        var leftBBox = distBBox(node, 0, m, toBBox);
        var rightBBox = distBBox(node, M - m, M, toBBox);
        var margin = bboxMargin(leftBBox) + bboxMargin(rightBBox);
        for (var i = m; i < M - m; i++) {
          var child = node.children[i];
          extend(leftBBox, node.leaf ? toBBox(child) : child);
          margin += bboxMargin(leftBBox);
        }
        for (var i$1 = M - m - 1; i$1 >= m; i$1--) {
          var child$1 = node.children[i$1];
          extend(rightBBox, node.leaf ? toBBox(child$1) : child$1);
          margin += bboxMargin(rightBBox);
        }
        return margin;
      };
      RBush.prototype._adjustParentBBoxes = function _adjustParentBBoxes(bbox3, path, level) {
        for (var i = level; i >= 0; i--) {
          extend(path[i], bbox3);
        }
      };
      RBush.prototype._condense = function _condense(path) {
        for (var i = path.length - 1, siblings = void 0; i >= 0; i--) {
          if (path[i].children.length === 0) {
            if (i > 0) {
              siblings = path[i - 1].children;
              siblings.splice(siblings.indexOf(path[i]), 1);
            } else {
              this.clear();
            }
          } else {
            calcBBox(path[i], this.toBBox);
          }
        }
      };
      function findItem(item, items, equalsFn) {
        if (!equalsFn) {
          return items.indexOf(item);
        }
        for (var i = 0; i < items.length; i++) {
          if (equalsFn(item, items[i])) {
            return i;
          }
        }
        return -1;
      }
      function calcBBox(node, toBBox) {
        distBBox(node, 0, node.children.length, toBBox, node);
      }
      function distBBox(node, k, p, toBBox, destNode) {
        if (!destNode) {
          destNode = createNode(null);
        }
        destNode.minX = Infinity;
        destNode.minY = Infinity;
        destNode.maxX = -Infinity;
        destNode.maxY = -Infinity;
        for (var i = k; i < p; i++) {
          var child = node.children[i];
          extend(destNode, node.leaf ? toBBox(child) : child);
        }
        return destNode;
      }
      function extend(a, b) {
        a.minX = Math.min(a.minX, b.minX);
        a.minY = Math.min(a.minY, b.minY);
        a.maxX = Math.max(a.maxX, b.maxX);
        a.maxY = Math.max(a.maxY, b.maxY);
        return a;
      }
      function compareNodeMinX(a, b) {
        return a.minX - b.minX;
      }
      function compareNodeMinY(a, b) {
        return a.minY - b.minY;
      }
      function bboxArea(a) {
        return (a.maxX - a.minX) * (a.maxY - a.minY);
      }
      function bboxMargin(a) {
        return a.maxX - a.minX + (a.maxY - a.minY);
      }
      function enlargedArea(a, b) {
        return (Math.max(b.maxX, a.maxX) - Math.min(b.minX, a.minX)) * (Math.max(b.maxY, a.maxY) - Math.min(b.minY, a.minY));
      }
      function intersectionArea(a, b) {
        var minX = Math.max(a.minX, b.minX);
        var minY = Math.max(a.minY, b.minY);
        var maxX = Math.min(a.maxX, b.maxX);
        var maxY = Math.min(a.maxY, b.maxY);
        return Math.max(0, maxX - minX) * Math.max(0, maxY - minY);
      }
      function contains(a, b) {
        return a.minX <= b.minX && a.minY <= b.minY && b.maxX <= a.maxX && b.maxY <= a.maxY;
      }
      function intersects(a, b) {
        return b.minX <= a.maxX && b.minY <= a.maxY && b.maxX >= a.minX && b.maxY >= a.minY;
      }
      function createNode(children) {
        return {
          children,
          height: 1,
          leaf: true,
          minX: Infinity,
          minY: Infinity,
          maxX: -Infinity,
          maxY: -Infinity
        };
      }
      function multiSelect(arr, left, right, n, compare2) {
        var stack = [left, right];
        while (stack.length) {
          right = stack.pop();
          left = stack.pop();
          if (right - left <= n) {
            continue;
          }
          var mid = left + Math.ceil((right - left) / n / 2) * n;
          quickselect(arr, mid, left, right, compare2);
          stack.push(left, mid, mid, right);
        }
      }
      return RBush;
    });
  }
});

// src/workers/clipBatch.ts
var clipBatch_exports = {};
__export(clipBatch_exports, {
  addColumnValuesToResults: () => addColumnValuesToResults,
  calculatedClippedOverlapSize: () => calculatedClippedOverlapSize,
  clipBatch: () => clipBatch,
  collectColumnValues: () => collectColumnValues,
  countFeatures: () => countFeatures,
  createPresenceTable: () => createPresenceTable,
  pick: () => pick,
  testForPresenceInSubject: () => testForPresenceInSubject
});
module.exports = __toCommonJS(clipBatch_exports);

// node_modules/bignumber.js/bignumber.mjs
var isNumeric = /^-?(?:\d+(?:\.\d*)?|\.\d+)(?:e[+-]?\d+)?$/i;
var mathceil = Math.ceil;
var mathfloor = Math.floor;
var bignumberError = "[BigNumber Error] ";
var tooManyDigits = bignumberError + "Number primitive has more than 15 significant digits: ";
var BASE = 1e14;
var LOG_BASE = 14;
var MAX_SAFE_INTEGER = 9007199254740991;
var POWS_TEN = [1, 10, 100, 1e3, 1e4, 1e5, 1e6, 1e7, 1e8, 1e9, 1e10, 1e11, 1e12, 1e13];
var SQRT_BASE = 1e7;
var MAX = 1e9;
function clone(configObject) {
  var div, convertBase, parseNumeric, P = BigNumber2.prototype = { constructor: BigNumber2, toString: null, valueOf: null }, ONE = new BigNumber2(1), DECIMAL_PLACES = 20, ROUNDING_MODE = 4, TO_EXP_NEG = -7, TO_EXP_POS = 21, MIN_EXP = -1e7, MAX_EXP = 1e7, CRYPTO = false, MODULO_MODE = 1, POW_PRECISION = 0, FORMAT = {
    prefix: "",
    groupSize: 3,
    secondaryGroupSize: 0,
    groupSeparator: ",",
    decimalSeparator: ".",
    fractionGroupSize: 0,
    fractionGroupSeparator: "\xA0",
    // non-breaking space
    suffix: ""
  }, ALPHABET = "0123456789abcdefghijklmnopqrstuvwxyz", alphabetHasNormalDecimalDigits = true;
  function BigNumber2(v2, b) {
    var alphabet, c, caseChanged, e, i, isNum, len, str, x = this;
    if (!(x instanceof BigNumber2)) return new BigNumber2(v2, b);
    if (b == null) {
      if (v2 && v2._isBigNumber === true) {
        x.s = v2.s;
        if (!v2.c || v2.e > MAX_EXP) {
          x.c = x.e = null;
        } else if (v2.e < MIN_EXP) {
          x.c = [x.e = 0];
        } else {
          x.e = v2.e;
          x.c = v2.c.slice();
        }
        return;
      }
      if ((isNum = typeof v2 == "number") && v2 * 0 == 0) {
        x.s = 1 / v2 < 0 ? (v2 = -v2, -1) : 1;
        if (v2 === ~~v2) {
          for (e = 0, i = v2; i >= 10; i /= 10, e++) ;
          if (e > MAX_EXP) {
            x.c = x.e = null;
          } else {
            x.e = e;
            x.c = [v2];
          }
          return;
        }
        str = String(v2);
      } else {
        if (!isNumeric.test(str = String(v2))) return parseNumeric(x, str, isNum);
        x.s = str.charCodeAt(0) == 45 ? (str = str.slice(1), -1) : 1;
      }
      if ((e = str.indexOf(".")) > -1) str = str.replace(".", "");
      if ((i = str.search(/e/i)) > 0) {
        if (e < 0) e = i;
        e += +str.slice(i + 1);
        str = str.substring(0, i);
      } else if (e < 0) {
        e = str.length;
      }
    } else {
      intCheck(b, 2, ALPHABET.length, "Base");
      if (b == 10 && alphabetHasNormalDecimalDigits) {
        x = new BigNumber2(v2);
        return round(x, DECIMAL_PLACES + x.e + 1, ROUNDING_MODE);
      }
      str = String(v2);
      if (isNum = typeof v2 == "number") {
        if (v2 * 0 != 0) return parseNumeric(x, str, isNum, b);
        x.s = 1 / v2 < 0 ? (str = str.slice(1), -1) : 1;
        if (BigNumber2.DEBUG && str.replace(/^0\.0*|\./, "").length > 15) {
          throw Error(tooManyDigits + v2);
        }
      } else {
        x.s = str.charCodeAt(0) === 45 ? (str = str.slice(1), -1) : 1;
      }
      alphabet = ALPHABET.slice(0, b);
      e = i = 0;
      for (len = str.length; i < len; i++) {
        if (alphabet.indexOf(c = str.charAt(i)) < 0) {
          if (c == ".") {
            if (i > e) {
              e = len;
              continue;
            }
          } else if (!caseChanged) {
            if (str == str.toUpperCase() && (str = str.toLowerCase()) || str == str.toLowerCase() && (str = str.toUpperCase())) {
              caseChanged = true;
              i = -1;
              e = 0;
              continue;
            }
          }
          return parseNumeric(x, String(v2), isNum, b);
        }
      }
      isNum = false;
      str = convertBase(str, b, 10, x.s);
      if ((e = str.indexOf(".")) > -1) str = str.replace(".", "");
      else e = str.length;
    }
    for (i = 0; str.charCodeAt(i) === 48; i++) ;
    for (len = str.length; str.charCodeAt(--len) === 48; ) ;
    if (str = str.slice(i, ++len)) {
      len -= i;
      if (isNum && BigNumber2.DEBUG && len > 15 && (v2 > MAX_SAFE_INTEGER || v2 !== mathfloor(v2))) {
        throw Error(tooManyDigits + x.s * v2);
      }
      if ((e = e - i - 1) > MAX_EXP) {
        x.c = x.e = null;
      } else if (e < MIN_EXP) {
        x.c = [x.e = 0];
      } else {
        x.e = e;
        x.c = [];
        i = (e + 1) % LOG_BASE;
        if (e < 0) i += LOG_BASE;
        if (i < len) {
          if (i) x.c.push(+str.slice(0, i));
          for (len -= LOG_BASE; i < len; ) {
            x.c.push(+str.slice(i, i += LOG_BASE));
          }
          i = LOG_BASE - (str = str.slice(i)).length;
        } else {
          i -= len;
        }
        for (; i--; str += "0") ;
        x.c.push(+str);
      }
    } else {
      x.c = [x.e = 0];
    }
  }
  BigNumber2.clone = clone;
  BigNumber2.ROUND_UP = 0;
  BigNumber2.ROUND_DOWN = 1;
  BigNumber2.ROUND_CEIL = 2;
  BigNumber2.ROUND_FLOOR = 3;
  BigNumber2.ROUND_HALF_UP = 4;
  BigNumber2.ROUND_HALF_DOWN = 5;
  BigNumber2.ROUND_HALF_EVEN = 6;
  BigNumber2.ROUND_HALF_CEIL = 7;
  BigNumber2.ROUND_HALF_FLOOR = 8;
  BigNumber2.EUCLID = 9;
  BigNumber2.config = BigNumber2.set = function(obj) {
    var p, v2;
    if (obj != null) {
      if (typeof obj == "object") {
        if (obj.hasOwnProperty(p = "DECIMAL_PLACES")) {
          v2 = obj[p];
          intCheck(v2, 0, MAX, p);
          DECIMAL_PLACES = v2;
        }
        if (obj.hasOwnProperty(p = "ROUNDING_MODE")) {
          v2 = obj[p];
          intCheck(v2, 0, 8, p);
          ROUNDING_MODE = v2;
        }
        if (obj.hasOwnProperty(p = "EXPONENTIAL_AT")) {
          v2 = obj[p];
          if (v2 && v2.pop) {
            intCheck(v2[0], -MAX, 0, p);
            intCheck(v2[1], 0, MAX, p);
            TO_EXP_NEG = v2[0];
            TO_EXP_POS = v2[1];
          } else {
            intCheck(v2, -MAX, MAX, p);
            TO_EXP_NEG = -(TO_EXP_POS = v2 < 0 ? -v2 : v2);
          }
        }
        if (obj.hasOwnProperty(p = "RANGE")) {
          v2 = obj[p];
          if (v2 && v2.pop) {
            intCheck(v2[0], -MAX, -1, p);
            intCheck(v2[1], 1, MAX, p);
            MIN_EXP = v2[0];
            MAX_EXP = v2[1];
          } else {
            intCheck(v2, -MAX, MAX, p);
            if (v2) {
              MIN_EXP = -(MAX_EXP = v2 < 0 ? -v2 : v2);
            } else {
              throw Error(bignumberError + p + " cannot be zero: " + v2);
            }
          }
        }
        if (obj.hasOwnProperty(p = "CRYPTO")) {
          v2 = obj[p];
          if (v2 === !!v2) {
            if (v2) {
              if (typeof crypto != "undefined" && crypto && (crypto.getRandomValues || crypto.randomBytes)) {
                CRYPTO = v2;
              } else {
                CRYPTO = !v2;
                throw Error(bignumberError + "crypto unavailable");
              }
            } else {
              CRYPTO = v2;
            }
          } else {
            throw Error(bignumberError + p + " not true or false: " + v2);
          }
        }
        if (obj.hasOwnProperty(p = "MODULO_MODE")) {
          v2 = obj[p];
          intCheck(v2, 0, 9, p);
          MODULO_MODE = v2;
        }
        if (obj.hasOwnProperty(p = "POW_PRECISION")) {
          v2 = obj[p];
          intCheck(v2, 0, MAX, p);
          POW_PRECISION = v2;
        }
        if (obj.hasOwnProperty(p = "FORMAT")) {
          v2 = obj[p];
          if (typeof v2 == "object") FORMAT = v2;
          else throw Error(bignumberError + p + " not an object: " + v2);
        }
        if (obj.hasOwnProperty(p = "ALPHABET")) {
          v2 = obj[p];
          if (typeof v2 == "string" && !/^.?$|[+\-.\s]|(.).*\1/.test(v2)) {
            alphabetHasNormalDecimalDigits = v2.slice(0, 10) == "0123456789";
            ALPHABET = v2;
          } else {
            throw Error(bignumberError + p + " invalid: " + v2);
          }
        }
      } else {
        throw Error(bignumberError + "Object expected: " + obj);
      }
    }
    return {
      DECIMAL_PLACES,
      ROUNDING_MODE,
      EXPONENTIAL_AT: [TO_EXP_NEG, TO_EXP_POS],
      RANGE: [MIN_EXP, MAX_EXP],
      CRYPTO,
      MODULO_MODE,
      POW_PRECISION,
      FORMAT,
      ALPHABET
    };
  };
  BigNumber2.isBigNumber = function(v2) {
    if (!v2 || v2._isBigNumber !== true) return false;
    if (!BigNumber2.DEBUG) return true;
    var i, n, c = v2.c, e = v2.e, s = v2.s;
    out: if ({}.toString.call(c) == "[object Array]") {
      if ((s === 1 || s === -1) && e >= -MAX && e <= MAX && e === mathfloor(e)) {
        if (c[0] === 0) {
          if (e === 0 && c.length === 1) return true;
          break out;
        }
        i = (e + 1) % LOG_BASE;
        if (i < 1) i += LOG_BASE;
        if (String(c[0]).length == i) {
          for (i = 0; i < c.length; i++) {
            n = c[i];
            if (n < 0 || n >= BASE || n !== mathfloor(n)) break out;
          }
          if (n !== 0) return true;
        }
      }
    } else if (c === null && e === null && (s === null || s === 1 || s === -1)) {
      return true;
    }
    throw Error(bignumberError + "Invalid BigNumber: " + v2);
  };
  BigNumber2.maximum = BigNumber2.max = function() {
    return maxOrMin(arguments, -1);
  };
  BigNumber2.minimum = BigNumber2.min = function() {
    return maxOrMin(arguments, 1);
  };
  BigNumber2.random = (function() {
    var pow2_53 = 9007199254740992;
    var random53bitInt = Math.random() * pow2_53 & 2097151 ? function() {
      return mathfloor(Math.random() * pow2_53);
    } : function() {
      return (Math.random() * 1073741824 | 0) * 8388608 + (Math.random() * 8388608 | 0);
    };
    return function(dp) {
      var a, b, e, k, v2, i = 0, c = [], rand = new BigNumber2(ONE);
      if (dp == null) dp = DECIMAL_PLACES;
      else intCheck(dp, 0, MAX);
      k = mathceil(dp / LOG_BASE);
      if (CRYPTO) {
        if (crypto.getRandomValues) {
          a = crypto.getRandomValues(new Uint32Array(k *= 2));
          for (; i < k; ) {
            v2 = a[i] * 131072 + (a[i + 1] >>> 11);
            if (v2 >= 9e15) {
              b = crypto.getRandomValues(new Uint32Array(2));
              a[i] = b[0];
              a[i + 1] = b[1];
            } else {
              c.push(v2 % 1e14);
              i += 2;
            }
          }
          i = k / 2;
        } else if (crypto.randomBytes) {
          a = crypto.randomBytes(k *= 7);
          for (; i < k; ) {
            v2 = (a[i] & 31) * 281474976710656 + a[i + 1] * 1099511627776 + a[i + 2] * 4294967296 + a[i + 3] * 16777216 + (a[i + 4] << 16) + (a[i + 5] << 8) + a[i + 6];
            if (v2 >= 9e15) {
              crypto.randomBytes(7).copy(a, i);
            } else {
              c.push(v2 % 1e14);
              i += 7;
            }
          }
          i = k / 7;
        } else {
          CRYPTO = false;
          throw Error(bignumberError + "crypto unavailable");
        }
      }
      if (!CRYPTO) {
        for (; i < k; ) {
          v2 = random53bitInt();
          if (v2 < 9e15) c[i++] = v2 % 1e14;
        }
      }
      k = c[--i];
      dp %= LOG_BASE;
      if (k && dp) {
        v2 = POWS_TEN[LOG_BASE - dp];
        c[i] = mathfloor(k / v2) * v2;
      }
      for (; c[i] === 0; c.pop(), i--) ;
      if (i < 0) {
        c = [e = 0];
      } else {
        for (e = -1; c[0] === 0; c.splice(0, 1), e -= LOG_BASE) ;
        for (i = 1, v2 = c[0]; v2 >= 10; v2 /= 10, i++) ;
        if (i < LOG_BASE) e -= LOG_BASE - i;
      }
      rand.e = e;
      rand.c = c;
      return rand;
    };
  })();
  BigNumber2.sum = function() {
    var i = 1, args = arguments, sum2 = new BigNumber2(args[0]);
    for (; i < args.length; ) sum2 = sum2.plus(args[i++]);
    return sum2;
  };
  convertBase = /* @__PURE__ */ (function() {
    var decimal = "0123456789";
    function toBaseOut(str, baseIn, baseOut, alphabet) {
      var j, arr = [0], arrL, i = 0, len = str.length;
      for (; i < len; ) {
        for (arrL = arr.length; arrL--; arr[arrL] *= baseIn) ;
        arr[0] += alphabet.indexOf(str.charAt(i++));
        for (j = 0; j < arr.length; j++) {
          if (arr[j] > baseOut - 1) {
            if (arr[j + 1] == null) arr[j + 1] = 0;
            arr[j + 1] += arr[j] / baseOut | 0;
            arr[j] %= baseOut;
          }
        }
      }
      return arr.reverse();
    }
    return function(str, baseIn, baseOut, sign, callerIsToString) {
      var alphabet, d, e, k, r, x, xc, y, i = str.indexOf("."), dp = DECIMAL_PLACES, rm = ROUNDING_MODE;
      if (i >= 0) {
        k = POW_PRECISION;
        POW_PRECISION = 0;
        str = str.replace(".", "");
        y = new BigNumber2(baseIn);
        x = y.pow(str.length - i);
        POW_PRECISION = k;
        y.c = toBaseOut(
          toFixedPoint(coeffToString(x.c), x.e, "0"),
          10,
          baseOut,
          decimal
        );
        y.e = y.c.length;
      }
      xc = toBaseOut(str, baseIn, baseOut, callerIsToString ? (alphabet = ALPHABET, decimal) : (alphabet = decimal, ALPHABET));
      e = k = xc.length;
      for (; xc[--k] == 0; xc.pop()) ;
      if (!xc[0]) return alphabet.charAt(0);
      if (i < 0) {
        --e;
      } else {
        x.c = xc;
        x.e = e;
        x.s = sign;
        x = div(x, y, dp, rm, baseOut);
        xc = x.c;
        r = x.r;
        e = x.e;
      }
      d = e + dp + 1;
      i = xc[d];
      k = baseOut / 2;
      r = r || d < 0 || xc[d + 1] != null;
      r = rm < 4 ? (i != null || r) && (rm == 0 || rm == (x.s < 0 ? 3 : 2)) : i > k || i == k && (rm == 4 || r || rm == 6 && xc[d - 1] & 1 || rm == (x.s < 0 ? 8 : 7));
      if (d < 1 || !xc[0]) {
        str = r ? toFixedPoint(alphabet.charAt(1), -dp, alphabet.charAt(0)) : alphabet.charAt(0);
      } else {
        xc.length = d;
        if (r) {
          for (--baseOut; ++xc[--d] > baseOut; ) {
            xc[d] = 0;
            if (!d) {
              ++e;
              xc = [1].concat(xc);
            }
          }
        }
        for (k = xc.length; !xc[--k]; ) ;
        for (i = 0, str = ""; i <= k; str += alphabet.charAt(xc[i++])) ;
        str = toFixedPoint(str, e, alphabet.charAt(0));
      }
      return str;
    };
  })();
  div = /* @__PURE__ */ (function() {
    function multiply(x, k, base) {
      var m, temp, xlo, xhi, carry = 0, i = x.length, klo = k % SQRT_BASE, khi = k / SQRT_BASE | 0;
      for (x = x.slice(); i--; ) {
        xlo = x[i] % SQRT_BASE;
        xhi = x[i] / SQRT_BASE | 0;
        m = khi * xlo + xhi * klo;
        temp = klo * xlo + m % SQRT_BASE * SQRT_BASE + carry;
        carry = (temp / base | 0) + (m / SQRT_BASE | 0) + khi * xhi;
        x[i] = temp % base;
      }
      if (carry) x = [carry].concat(x);
      return x;
    }
    function compare2(a, b, aL, bL) {
      var i, cmp;
      if (aL != bL) {
        cmp = aL > bL ? 1 : -1;
      } else {
        for (i = cmp = 0; i < aL; i++) {
          if (a[i] != b[i]) {
            cmp = a[i] > b[i] ? 1 : -1;
            break;
          }
        }
      }
      return cmp;
    }
    function subtract(a, b, aL, base) {
      var i = 0;
      for (; aL--; ) {
        a[aL] -= i;
        i = a[aL] < b[aL] ? 1 : 0;
        a[aL] = i * base + a[aL] - b[aL];
      }
      for (; !a[0] && a.length > 1; a.splice(0, 1)) ;
    }
    return function(x, y, dp, rm, base) {
      var cmp, e, i, more, n, prod, prodL, q, qc, rem, remL, rem0, xi, xL, yc0, yL, yz, s = x.s == y.s ? 1 : -1, xc = x.c, yc = y.c;
      if (!xc || !xc[0] || !yc || !yc[0]) {
        return new BigNumber2(
          // Return NaN if either NaN, or both Infinity or 0.
          !x.s || !y.s || (xc ? yc && xc[0] == yc[0] : !yc) ? NaN : (
            // Return ±0 if x is ±0 or y is ±Infinity, or return ±Infinity as y is ±0.
            xc && xc[0] == 0 || !yc ? s * 0 : s / 0
          )
        );
      }
      q = new BigNumber2(s);
      qc = q.c = [];
      e = x.e - y.e;
      s = dp + e + 1;
      if (!base) {
        base = BASE;
        e = bitFloor(x.e / LOG_BASE) - bitFloor(y.e / LOG_BASE);
        s = s / LOG_BASE | 0;
      }
      for (i = 0; yc[i] == (xc[i] || 0); i++) ;
      if (yc[i] > (xc[i] || 0)) e--;
      if (s < 0) {
        qc.push(1);
        more = true;
      } else {
        xL = xc.length;
        yL = yc.length;
        i = 0;
        s += 2;
        n = mathfloor(base / (yc[0] + 1));
        if (n > 1) {
          yc = multiply(yc, n, base);
          xc = multiply(xc, n, base);
          yL = yc.length;
          xL = xc.length;
        }
        xi = yL;
        rem = xc.slice(0, yL);
        remL = rem.length;
        for (; remL < yL; rem[remL++] = 0) ;
        yz = yc.slice();
        yz = [0].concat(yz);
        yc0 = yc[0];
        if (yc[1] >= base / 2) yc0++;
        do {
          n = 0;
          cmp = compare2(yc, rem, yL, remL);
          if (cmp < 0) {
            rem0 = rem[0];
            if (yL != remL) rem0 = rem0 * base + (rem[1] || 0);
            n = mathfloor(rem0 / yc0);
            if (n > 1) {
              if (n >= base) n = base - 1;
              prod = multiply(yc, n, base);
              prodL = prod.length;
              remL = rem.length;
              while (compare2(prod, rem, prodL, remL) == 1) {
                n--;
                subtract(prod, yL < prodL ? yz : yc, prodL, base);
                prodL = prod.length;
                cmp = 1;
              }
            } else {
              if (n == 0) {
                cmp = n = 1;
              }
              prod = yc.slice();
              prodL = prod.length;
            }
            if (prodL < remL) prod = [0].concat(prod);
            subtract(rem, prod, remL, base);
            remL = rem.length;
            if (cmp == -1) {
              while (compare2(yc, rem, yL, remL) < 1) {
                n++;
                subtract(rem, yL < remL ? yz : yc, remL, base);
                remL = rem.length;
              }
            }
          } else if (cmp === 0) {
            n++;
            rem = [0];
          }
          qc[i++] = n;
          if (rem[0]) {
            rem[remL++] = xc[xi] || 0;
          } else {
            rem = [xc[xi]];
            remL = 1;
          }
        } while ((xi++ < xL || rem[0] != null) && s--);
        more = rem[0] != null;
        if (!qc[0]) qc.splice(0, 1);
      }
      if (base == BASE) {
        for (i = 1, s = qc[0]; s >= 10; s /= 10, i++) ;
        round(q, dp + (q.e = i + e * LOG_BASE - 1) + 1, rm, more);
      } else {
        q.e = e;
        q.r = +more;
      }
      return q;
    };
  })();
  function format(n, i, rm, id) {
    var c0, e, ne, len, str;
    if (rm == null) rm = ROUNDING_MODE;
    else intCheck(rm, 0, 8);
    if (!n.c) return n.toString();
    c0 = n.c[0];
    ne = n.e;
    if (i == null) {
      str = coeffToString(n.c);
      str = id == 1 || id == 2 && (ne <= TO_EXP_NEG || ne >= TO_EXP_POS) ? toExponential(str, ne) : toFixedPoint(str, ne, "0");
    } else {
      n = round(new BigNumber2(n), i, rm);
      e = n.e;
      str = coeffToString(n.c);
      len = str.length;
      if (id == 1 || id == 2 && (i <= e || e <= TO_EXP_NEG)) {
        for (; len < i; str += "0", len++) ;
        str = toExponential(str, e);
      } else {
        i -= ne + (id === 2 && e > ne);
        str = toFixedPoint(str, e, "0");
        if (e + 1 > len) {
          if (--i > 0) for (str += "."; i--; str += "0") ;
        } else {
          i += e - len;
          if (i > 0) {
            if (e + 1 == len) str += ".";
            for (; i--; str += "0") ;
          }
        }
      }
    }
    return n.s < 0 && c0 ? "-" + str : str;
  }
  function maxOrMin(args, n) {
    var k, y, i = 1, x = new BigNumber2(args[0]);
    for (; i < args.length; i++) {
      y = new BigNumber2(args[i]);
      if (!y.s || (k = compare(x, y)) === n || k === 0 && x.s === n) {
        x = y;
      }
    }
    return x;
  }
  function normalise(n, c, e) {
    var i = 1, j = c.length;
    for (; !c[--j]; c.pop()) ;
    for (j = c[0]; j >= 10; j /= 10, i++) ;
    if ((e = i + e * LOG_BASE - 1) > MAX_EXP) {
      n.c = n.e = null;
    } else if (e < MIN_EXP) {
      n.c = [n.e = 0];
    } else {
      n.e = e;
      n.c = c;
    }
    return n;
  }
  parseNumeric = /* @__PURE__ */ (function() {
    var basePrefix = /^(-?)0([xbo])(?=\w[\w.]*$)/i, dotAfter = /^([^.]+)\.$/, dotBefore = /^\.([^.]+)$/, isInfinityOrNaN = /^-?(Infinity|NaN)$/, whitespaceOrPlus = /^\s*\+(?=[\w.])|^\s+|\s+$/g;
    return function(x, str, isNum, b) {
      var base, s = isNum ? str : str.replace(whitespaceOrPlus, "");
      if (isInfinityOrNaN.test(s)) {
        x.s = isNaN(s) ? null : s < 0 ? -1 : 1;
      } else {
        if (!isNum) {
          s = s.replace(basePrefix, function(m, p1, p2) {
            base = (p2 = p2.toLowerCase()) == "x" ? 16 : p2 == "b" ? 2 : 8;
            return !b || b == base ? p1 : m;
          });
          if (b) {
            base = b;
            s = s.replace(dotAfter, "$1").replace(dotBefore, "0.$1");
          }
          if (str != s) return new BigNumber2(s, base);
        }
        if (BigNumber2.DEBUG) {
          throw Error(bignumberError + "Not a" + (b ? " base " + b : "") + " number: " + str);
        }
        x.s = null;
      }
      x.c = x.e = null;
    };
  })();
  function round(x, sd, rm, r) {
    var d, i, j, k, n, ni, rd, xc = x.c, pows10 = POWS_TEN;
    if (xc) {
      out: {
        for (d = 1, k = xc[0]; k >= 10; k /= 10, d++) ;
        i = sd - d;
        if (i < 0) {
          i += LOG_BASE;
          j = sd;
          n = xc[ni = 0];
          rd = mathfloor(n / pows10[d - j - 1] % 10);
        } else {
          ni = mathceil((i + 1) / LOG_BASE);
          if (ni >= xc.length) {
            if (r) {
              for (; xc.length <= ni; xc.push(0)) ;
              n = rd = 0;
              d = 1;
              i %= LOG_BASE;
              j = i - LOG_BASE + 1;
            } else {
              break out;
            }
          } else {
            n = k = xc[ni];
            for (d = 1; k >= 10; k /= 10, d++) ;
            i %= LOG_BASE;
            j = i - LOG_BASE + d;
            rd = j < 0 ? 0 : mathfloor(n / pows10[d - j - 1] % 10);
          }
        }
        r = r || sd < 0 || // Are there any non-zero digits after the rounding digit?
        // The expression  n % pows10[d - j - 1]  returns all digits of n to the right
        // of the digit at j, e.g. if n is 908714 and j is 2, the expression gives 714.
        xc[ni + 1] != null || (j < 0 ? n : n % pows10[d - j - 1]);
        r = rm < 4 ? (rd || r) && (rm == 0 || rm == (x.s < 0 ? 3 : 2)) : rd > 5 || rd == 5 && (rm == 4 || r || rm == 6 && // Check whether the digit to the left of the rounding digit is odd.
        (i > 0 ? j > 0 ? n / pows10[d - j] : 0 : xc[ni - 1]) % 10 & 1 || rm == (x.s < 0 ? 8 : 7));
        if (sd < 1 || !xc[0]) {
          xc.length = 0;
          if (r) {
            sd -= x.e + 1;
            xc[0] = pows10[(LOG_BASE - sd % LOG_BASE) % LOG_BASE];
            x.e = -sd || 0;
          } else {
            xc[0] = x.e = 0;
          }
          return x;
        }
        if (i == 0) {
          xc.length = ni;
          k = 1;
          ni--;
        } else {
          xc.length = ni + 1;
          k = pows10[LOG_BASE - i];
          xc[ni] = j > 0 ? mathfloor(n / pows10[d - j] % pows10[j]) * k : 0;
        }
        if (r) {
          for (; ; ) {
            if (ni == 0) {
              for (i = 1, j = xc[0]; j >= 10; j /= 10, i++) ;
              j = xc[0] += k;
              for (k = 1; j >= 10; j /= 10, k++) ;
              if (i != k) {
                x.e++;
                if (xc[0] == BASE) xc[0] = 1;
              }
              break;
            } else {
              xc[ni] += k;
              if (xc[ni] != BASE) break;
              xc[ni--] = 0;
              k = 1;
            }
          }
        }
        for (i = xc.length; xc[--i] === 0; xc.pop()) ;
      }
      if (x.e > MAX_EXP) {
        x.c = x.e = null;
      } else if (x.e < MIN_EXP) {
        x.c = [x.e = 0];
      }
    }
    return x;
  }
  function valueOf(n) {
    var str, e = n.e;
    if (e === null) return n.toString();
    str = coeffToString(n.c);
    str = e <= TO_EXP_NEG || e >= TO_EXP_POS ? toExponential(str, e) : toFixedPoint(str, e, "0");
    return n.s < 0 ? "-" + str : str;
  }
  P.absoluteValue = P.abs = function() {
    var x = new BigNumber2(this);
    if (x.s < 0) x.s = 1;
    return x;
  };
  P.comparedTo = function(y, b) {
    return compare(this, new BigNumber2(y, b));
  };
  P.decimalPlaces = P.dp = function(dp, rm) {
    var c, n, v2, x = this;
    if (dp != null) {
      intCheck(dp, 0, MAX);
      if (rm == null) rm = ROUNDING_MODE;
      else intCheck(rm, 0, 8);
      return round(new BigNumber2(x), dp + x.e + 1, rm);
    }
    if (!(c = x.c)) return null;
    n = ((v2 = c.length - 1) - bitFloor(this.e / LOG_BASE)) * LOG_BASE;
    if (v2 = c[v2]) for (; v2 % 10 == 0; v2 /= 10, n--) ;
    if (n < 0) n = 0;
    return n;
  };
  P.dividedBy = P.div = function(y, b) {
    return div(this, new BigNumber2(y, b), DECIMAL_PLACES, ROUNDING_MODE);
  };
  P.dividedToIntegerBy = P.idiv = function(y, b) {
    return div(this, new BigNumber2(y, b), 0, 1);
  };
  P.exponentiatedBy = P.pow = function(n, m) {
    var half, isModExp, i, k, more, nIsBig, nIsNeg, nIsOdd, y, x = this;
    n = new BigNumber2(n);
    if (n.c && !n.isInteger()) {
      throw Error(bignumberError + "Exponent not an integer: " + valueOf(n));
    }
    if (m != null) m = new BigNumber2(m);
    nIsBig = n.e > 14;
    if (!x.c || !x.c[0] || x.c[0] == 1 && !x.e && x.c.length == 1 || !n.c || !n.c[0]) {
      y = new BigNumber2(Math.pow(+valueOf(x), nIsBig ? n.s * (2 - isOdd(n)) : +valueOf(n)));
      return m ? y.mod(m) : y;
    }
    nIsNeg = n.s < 0;
    if (m) {
      if (m.c ? !m.c[0] : !m.s) return new BigNumber2(NaN);
      isModExp = !nIsNeg && x.isInteger() && m.isInteger();
      if (isModExp) x = x.mod(m);
    } else if (n.e > 9 && (x.e > 0 || x.e < -1 || (x.e == 0 ? x.c[0] > 1 || nIsBig && x.c[1] >= 24e7 : x.c[0] < 8e13 || nIsBig && x.c[0] <= 9999975e7))) {
      k = x.s < 0 && isOdd(n) ? -0 : 0;
      if (x.e > -1) k = 1 / k;
      return new BigNumber2(nIsNeg ? 1 / k : k);
    } else if (POW_PRECISION) {
      k = mathceil(POW_PRECISION / LOG_BASE + 2);
    }
    if (nIsBig) {
      half = new BigNumber2(0.5);
      if (nIsNeg) n.s = 1;
      nIsOdd = isOdd(n);
    } else {
      i = Math.abs(+valueOf(n));
      nIsOdd = i % 2;
    }
    y = new BigNumber2(ONE);
    for (; ; ) {
      if (nIsOdd) {
        y = y.times(x);
        if (!y.c) break;
        if (k) {
          if (y.c.length > k) y.c.length = k;
        } else if (isModExp) {
          y = y.mod(m);
        }
      }
      if (i) {
        i = mathfloor(i / 2);
        if (i === 0) break;
        nIsOdd = i % 2;
      } else {
        n = n.times(half);
        round(n, n.e + 1, 1);
        if (n.e > 14) {
          nIsOdd = isOdd(n);
        } else {
          i = +valueOf(n);
          if (i === 0) break;
          nIsOdd = i % 2;
        }
      }
      x = x.times(x);
      if (k) {
        if (x.c && x.c.length > k) x.c.length = k;
      } else if (isModExp) {
        x = x.mod(m);
      }
    }
    if (isModExp) return y;
    if (nIsNeg) y = ONE.div(y);
    return m ? y.mod(m) : k ? round(y, POW_PRECISION, ROUNDING_MODE, more) : y;
  };
  P.integerValue = function(rm) {
    var n = new BigNumber2(this);
    if (rm == null) rm = ROUNDING_MODE;
    else intCheck(rm, 0, 8);
    return round(n, n.e + 1, rm);
  };
  P.isEqualTo = P.eq = function(y, b) {
    return compare(this, new BigNumber2(y, b)) === 0;
  };
  P.isFinite = function() {
    return !!this.c;
  };
  P.isGreaterThan = P.gt = function(y, b) {
    return compare(this, new BigNumber2(y, b)) > 0;
  };
  P.isGreaterThanOrEqualTo = P.gte = function(y, b) {
    return (b = compare(this, new BigNumber2(y, b))) === 1 || b === 0;
  };
  P.isInteger = function() {
    return !!this.c && bitFloor(this.e / LOG_BASE) > this.c.length - 2;
  };
  P.isLessThan = P.lt = function(y, b) {
    return compare(this, new BigNumber2(y, b)) < 0;
  };
  P.isLessThanOrEqualTo = P.lte = function(y, b) {
    return (b = compare(this, new BigNumber2(y, b))) === -1 || b === 0;
  };
  P.isNaN = function() {
    return !this.s;
  };
  P.isNegative = function() {
    return this.s < 0;
  };
  P.isPositive = function() {
    return this.s > 0;
  };
  P.isZero = function() {
    return !!this.c && this.c[0] == 0;
  };
  P.minus = function(y, b) {
    var i, j, t, xLTy, x = this, a = x.s;
    y = new BigNumber2(y, b);
    b = y.s;
    if (!a || !b) return new BigNumber2(NaN);
    if (a != b) {
      y.s = -b;
      return x.plus(y);
    }
    var xe = x.e / LOG_BASE, ye = y.e / LOG_BASE, xc = x.c, yc = y.c;
    if (!xe || !ye) {
      if (!xc || !yc) return xc ? (y.s = -b, y) : new BigNumber2(yc ? x : NaN);
      if (!xc[0] || !yc[0]) {
        return yc[0] ? (y.s = -b, y) : new BigNumber2(xc[0] ? x : (
          // IEEE 754 (2008) 6.3: n - n = -0 when rounding to -Infinity
          ROUNDING_MODE == 3 ? -0 : 0
        ));
      }
    }
    xe = bitFloor(xe);
    ye = bitFloor(ye);
    xc = xc.slice();
    if (a = xe - ye) {
      if (xLTy = a < 0) {
        a = -a;
        t = xc;
      } else {
        ye = xe;
        t = yc;
      }
      t.reverse();
      for (b = a; b--; t.push(0)) ;
      t.reverse();
    } else {
      j = (xLTy = (a = xc.length) < (b = yc.length)) ? a : b;
      for (a = b = 0; b < j; b++) {
        if (xc[b] != yc[b]) {
          xLTy = xc[b] < yc[b];
          break;
        }
      }
    }
    if (xLTy) {
      t = xc;
      xc = yc;
      yc = t;
      y.s = -y.s;
    }
    b = (j = yc.length) - (i = xc.length);
    if (b > 0) for (; b--; xc[i++] = 0) ;
    b = BASE - 1;
    for (; j > a; ) {
      if (xc[--j] < yc[j]) {
        for (i = j; i && !xc[--i]; xc[i] = b) ;
        --xc[i];
        xc[j] += BASE;
      }
      xc[j] -= yc[j];
    }
    for (; xc[0] == 0; xc.splice(0, 1), --ye) ;
    if (!xc[0]) {
      y.s = ROUNDING_MODE == 3 ? -1 : 1;
      y.c = [y.e = 0];
      return y;
    }
    return normalise(y, xc, ye);
  };
  P.modulo = P.mod = function(y, b) {
    var q, s, x = this;
    y = new BigNumber2(y, b);
    if (!x.c || !y.s || y.c && !y.c[0]) {
      return new BigNumber2(NaN);
    } else if (!y.c || x.c && !x.c[0]) {
      return new BigNumber2(x);
    }
    if (MODULO_MODE == 9) {
      s = y.s;
      y.s = 1;
      q = div(x, y, 0, 3);
      y.s = s;
      q.s *= s;
    } else {
      q = div(x, y, 0, MODULO_MODE);
    }
    y = x.minus(q.times(y));
    if (!y.c[0] && MODULO_MODE == 1) y.s = x.s;
    return y;
  };
  P.multipliedBy = P.times = function(y, b) {
    var c, e, i, j, k, m, xcL, xlo, xhi, ycL, ylo, yhi, zc, base, sqrtBase, x = this, xc = x.c, yc = (y = new BigNumber2(y, b)).c;
    if (!xc || !yc || !xc[0] || !yc[0]) {
      if (!x.s || !y.s || xc && !xc[0] && !yc || yc && !yc[0] && !xc) {
        y.c = y.e = y.s = null;
      } else {
        y.s *= x.s;
        if (!xc || !yc) {
          y.c = y.e = null;
        } else {
          y.c = [0];
          y.e = 0;
        }
      }
      return y;
    }
    e = bitFloor(x.e / LOG_BASE) + bitFloor(y.e / LOG_BASE);
    y.s *= x.s;
    xcL = xc.length;
    ycL = yc.length;
    if (xcL < ycL) {
      zc = xc;
      xc = yc;
      yc = zc;
      i = xcL;
      xcL = ycL;
      ycL = i;
    }
    for (i = xcL + ycL, zc = []; i--; zc.push(0)) ;
    base = BASE;
    sqrtBase = SQRT_BASE;
    for (i = ycL; --i >= 0; ) {
      c = 0;
      ylo = yc[i] % sqrtBase;
      yhi = yc[i] / sqrtBase | 0;
      for (k = xcL, j = i + k; j > i; ) {
        xlo = xc[--k] % sqrtBase;
        xhi = xc[k] / sqrtBase | 0;
        m = yhi * xlo + xhi * ylo;
        xlo = ylo * xlo + m % sqrtBase * sqrtBase + zc[j] + c;
        c = (xlo / base | 0) + (m / sqrtBase | 0) + yhi * xhi;
        zc[j--] = xlo % base;
      }
      zc[j] = c;
    }
    if (c) {
      ++e;
    } else {
      zc.splice(0, 1);
    }
    return normalise(y, zc, e);
  };
  P.negated = function() {
    var x = new BigNumber2(this);
    x.s = -x.s || null;
    return x;
  };
  P.plus = function(y, b) {
    var t, x = this, a = x.s;
    y = new BigNumber2(y, b);
    b = y.s;
    if (!a || !b) return new BigNumber2(NaN);
    if (a != b) {
      y.s = -b;
      return x.minus(y);
    }
    var xe = x.e / LOG_BASE, ye = y.e / LOG_BASE, xc = x.c, yc = y.c;
    if (!xe || !ye) {
      if (!xc || !yc) return new BigNumber2(a / 0);
      if (!xc[0] || !yc[0]) return yc[0] ? y : new BigNumber2(xc[0] ? x : a * 0);
    }
    xe = bitFloor(xe);
    ye = bitFloor(ye);
    xc = xc.slice();
    if (a = xe - ye) {
      if (a > 0) {
        ye = xe;
        t = yc;
      } else {
        a = -a;
        t = xc;
      }
      t.reverse();
      for (; a--; t.push(0)) ;
      t.reverse();
    }
    a = xc.length;
    b = yc.length;
    if (a - b < 0) {
      t = yc;
      yc = xc;
      xc = t;
      b = a;
    }
    for (a = 0; b; ) {
      a = (xc[--b] = xc[b] + yc[b] + a) / BASE | 0;
      xc[b] = BASE === xc[b] ? 0 : xc[b] % BASE;
    }
    if (a) {
      xc = [a].concat(xc);
      ++ye;
    }
    return normalise(y, xc, ye);
  };
  P.precision = P.sd = function(sd, rm) {
    var c, n, v2, x = this;
    if (sd != null && sd !== !!sd) {
      intCheck(sd, 1, MAX);
      if (rm == null) rm = ROUNDING_MODE;
      else intCheck(rm, 0, 8);
      return round(new BigNumber2(x), sd, rm);
    }
    if (!(c = x.c)) return null;
    v2 = c.length - 1;
    n = v2 * LOG_BASE + 1;
    if (v2 = c[v2]) {
      for (; v2 % 10 == 0; v2 /= 10, n--) ;
      for (v2 = c[0]; v2 >= 10; v2 /= 10, n++) ;
    }
    if (sd && x.e + 1 > n) n = x.e + 1;
    return n;
  };
  P.shiftedBy = function(k) {
    intCheck(k, -MAX_SAFE_INTEGER, MAX_SAFE_INTEGER);
    return this.times("1e" + k);
  };
  P.squareRoot = P.sqrt = function() {
    var m, n, r, rep, t, x = this, c = x.c, s = x.s, e = x.e, dp = DECIMAL_PLACES + 4, half = new BigNumber2("0.5");
    if (s !== 1 || !c || !c[0]) {
      return new BigNumber2(!s || s < 0 && (!c || c[0]) ? NaN : c ? x : 1 / 0);
    }
    s = Math.sqrt(+valueOf(x));
    if (s == 0 || s == 1 / 0) {
      n = coeffToString(c);
      if ((n.length + e) % 2 == 0) n += "0";
      s = Math.sqrt(+n);
      e = bitFloor((e + 1) / 2) - (e < 0 || e % 2);
      if (s == 1 / 0) {
        n = "5e" + e;
      } else {
        n = s.toExponential();
        n = n.slice(0, n.indexOf("e") + 1) + e;
      }
      r = new BigNumber2(n);
    } else {
      r = new BigNumber2(s + "");
    }
    if (r.c[0]) {
      e = r.e;
      s = e + dp;
      if (s < 3) s = 0;
      for (; ; ) {
        t = r;
        r = half.times(t.plus(div(x, t, dp, 1)));
        if (coeffToString(t.c).slice(0, s) === (n = coeffToString(r.c)).slice(0, s)) {
          if (r.e < e) --s;
          n = n.slice(s - 3, s + 1);
          if (n == "9999" || !rep && n == "4999") {
            if (!rep) {
              round(t, t.e + DECIMAL_PLACES + 2, 0);
              if (t.times(t).eq(x)) {
                r = t;
                break;
              }
            }
            dp += 4;
            s += 4;
            rep = 1;
          } else {
            if (!+n || !+n.slice(1) && n.charAt(0) == "5") {
              round(r, r.e + DECIMAL_PLACES + 2, 1);
              m = !r.times(r).eq(x);
            }
            break;
          }
        }
      }
    }
    return round(r, r.e + DECIMAL_PLACES + 1, ROUNDING_MODE, m);
  };
  P.toExponential = function(dp, rm) {
    if (dp != null) {
      intCheck(dp, 0, MAX);
      dp++;
    }
    return format(this, dp, rm, 1);
  };
  P.toFixed = function(dp, rm) {
    if (dp != null) {
      intCheck(dp, 0, MAX);
      dp = dp + this.e + 1;
    }
    return format(this, dp, rm);
  };
  P.toFormat = function(dp, rm, format2) {
    var str, x = this;
    if (format2 == null) {
      if (dp != null && rm && typeof rm == "object") {
        format2 = rm;
        rm = null;
      } else if (dp && typeof dp == "object") {
        format2 = dp;
        dp = rm = null;
      } else {
        format2 = FORMAT;
      }
    } else if (typeof format2 != "object") {
      throw Error(bignumberError + "Argument not an object: " + format2);
    }
    str = x.toFixed(dp, rm);
    if (x.c) {
      var i, arr = str.split("."), g1 = +format2.groupSize, g2 = +format2.secondaryGroupSize, groupSeparator = format2.groupSeparator || "", intPart = arr[0], fractionPart = arr[1], isNeg = x.s < 0, intDigits = isNeg ? intPart.slice(1) : intPart, len = intDigits.length;
      if (g2) {
        i = g1;
        g1 = g2;
        g2 = i;
        len -= i;
      }
      if (g1 > 0 && len > 0) {
        i = len % g1 || g1;
        intPart = intDigits.substr(0, i);
        for (; i < len; i += g1) intPart += groupSeparator + intDigits.substr(i, g1);
        if (g2 > 0) intPart += groupSeparator + intDigits.slice(i);
        if (isNeg) intPart = "-" + intPart;
      }
      str = fractionPart ? intPart + (format2.decimalSeparator || "") + ((g2 = +format2.fractionGroupSize) ? fractionPart.replace(
        new RegExp("\\d{" + g2 + "}\\B", "g"),
        "$&" + (format2.fractionGroupSeparator || "")
      ) : fractionPart) : intPart;
    }
    return (format2.prefix || "") + str + (format2.suffix || "");
  };
  P.toFraction = function(md) {
    var d, d0, d1, d2, e, exp, n, n0, n1, q, r, s, x = this, xc = x.c;
    if (md != null) {
      n = new BigNumber2(md);
      if (!n.isInteger() && (n.c || n.s !== 1) || n.lt(ONE)) {
        throw Error(bignumberError + "Argument " + (n.isInteger() ? "out of range: " : "not an integer: ") + valueOf(n));
      }
    }
    if (!xc) return new BigNumber2(x);
    d = new BigNumber2(ONE);
    n1 = d0 = new BigNumber2(ONE);
    d1 = n0 = new BigNumber2(ONE);
    s = coeffToString(xc);
    e = d.e = s.length - x.e - 1;
    d.c[0] = POWS_TEN[(exp = e % LOG_BASE) < 0 ? LOG_BASE + exp : exp];
    md = !md || n.comparedTo(d) > 0 ? e > 0 ? d : n1 : n;
    exp = MAX_EXP;
    MAX_EXP = 1 / 0;
    n = new BigNumber2(s);
    n0.c[0] = 0;
    for (; ; ) {
      q = div(n, d, 0, 1);
      d2 = d0.plus(q.times(d1));
      if (d2.comparedTo(md) == 1) break;
      d0 = d1;
      d1 = d2;
      n1 = n0.plus(q.times(d2 = n1));
      n0 = d2;
      d = n.minus(q.times(d2 = d));
      n = d2;
    }
    d2 = div(md.minus(d0), d1, 0, 1);
    n0 = n0.plus(d2.times(n1));
    d0 = d0.plus(d2.times(d1));
    n0.s = n1.s = x.s;
    e = e * 2;
    r = div(n1, d1, e, ROUNDING_MODE).minus(x).abs().comparedTo(
      div(n0, d0, e, ROUNDING_MODE).minus(x).abs()
    ) < 1 ? [n1, d1] : [n0, d0];
    MAX_EXP = exp;
    return r;
  };
  P.toNumber = function() {
    return +valueOf(this);
  };
  P.toPrecision = function(sd, rm) {
    if (sd != null) intCheck(sd, 1, MAX);
    return format(this, sd, rm, 2);
  };
  P.toString = function(b) {
    var str, n = this, s = n.s, e = n.e;
    if (e === null) {
      if (s) {
        str = "Infinity";
        if (s < 0) str = "-" + str;
      } else {
        str = "NaN";
      }
    } else {
      if (b == null) {
        str = e <= TO_EXP_NEG || e >= TO_EXP_POS ? toExponential(coeffToString(n.c), e) : toFixedPoint(coeffToString(n.c), e, "0");
      } else if (b === 10 && alphabetHasNormalDecimalDigits) {
        n = round(new BigNumber2(n), DECIMAL_PLACES + e + 1, ROUNDING_MODE);
        str = toFixedPoint(coeffToString(n.c), n.e, "0");
      } else {
        intCheck(b, 2, ALPHABET.length, "Base");
        str = convertBase(toFixedPoint(coeffToString(n.c), e, "0"), 10, b, s, true);
      }
      if (s < 0 && n.c[0]) str = "-" + str;
    }
    return str;
  };
  P.valueOf = P.toJSON = function() {
    return valueOf(this);
  };
  P._isBigNumber = true;
  P[Symbol.toStringTag] = "BigNumber";
  P[Symbol.for("nodejs.util.inspect.custom")] = P.valueOf;
  if (configObject != null) BigNumber2.set(configObject);
  return BigNumber2;
}
function bitFloor(n) {
  var i = n | 0;
  return n > 0 || n === i ? i : i - 1;
}
function coeffToString(a) {
  var s, z, i = 1, j = a.length, r = a[0] + "";
  for (; i < j; ) {
    s = a[i++] + "";
    z = LOG_BASE - s.length;
    for (; z--; s = "0" + s) ;
    r += s;
  }
  for (j = r.length; r.charCodeAt(--j) === 48; ) ;
  return r.slice(0, j + 1 || 1);
}
function compare(x, y) {
  var a, b, xc = x.c, yc = y.c, i = x.s, j = y.s, k = x.e, l = y.e;
  if (!i || !j) return null;
  a = xc && !xc[0];
  b = yc && !yc[0];
  if (a || b) return a ? b ? 0 : -j : i;
  if (i != j) return i;
  a = i < 0;
  b = k == l;
  if (!xc || !yc) return b ? 0 : !xc ^ a ? 1 : -1;
  if (!b) return k > l ^ a ? 1 : -1;
  j = (k = xc.length) < (l = yc.length) ? k : l;
  for (i = 0; i < j; i++) if (xc[i] != yc[i]) return xc[i] > yc[i] ^ a ? 1 : -1;
  return k == l ? 0 : k > l ^ a ? 1 : -1;
}
function intCheck(n, min, max, name) {
  if (n < min || n > max || n !== mathfloor(n)) {
    throw Error(bignumberError + (name || "Argument") + (typeof n == "number" ? n < min || n > max ? " out of range: " : " not an integer: " : " not a primitive number: ") + String(n));
  }
}
function isOdd(n) {
  var k = n.c.length - 1;
  return bitFloor(n.e / LOG_BASE) == k && n.c[k] % 2 != 0;
}
function toExponential(str, e) {
  return (str.length > 1 ? str.charAt(0) + "." + str.slice(1) : str) + (e < 0 ? "e" : "e+") + e;
}
function toFixedPoint(str, e, z) {
  var len, zs;
  if (e < 0) {
    for (zs = z + "."; ++e; zs += z) ;
    str = zs + str;
  } else {
    len = str.length;
    if (++e > len) {
      for (zs = z, e -= len; --e; zs += z) ;
      str += zs;
    } else if (e < len) {
      str = str.slice(0, e) + "." + str.slice(e);
    }
  }
  return str;
}
var BigNumber = clone();
var bignumber_default = BigNumber;

// node_modules/splaytree-ts/dist/esm/index.js
var SplayTreeNode = class {
  key;
  left = null;
  right = null;
  constructor(key) {
    this.key = key;
  }
};
var SplayTreeSetNode = class extends SplayTreeNode {
  constructor(key) {
    super(key);
  }
};
var SplayTree = class {
  size = 0;
  modificationCount = 0;
  splayCount = 0;
  splay(key) {
    const root = this.root;
    if (root == null) {
      this.compare(key, key);
      return -1;
    }
    let right = null;
    let newTreeRight = null;
    let left = null;
    let newTreeLeft = null;
    let current = root;
    const compare2 = this.compare;
    let comp;
    while (true) {
      comp = compare2(current.key, key);
      if (comp > 0) {
        let currentLeft = current.left;
        if (currentLeft == null) break;
        comp = compare2(currentLeft.key, key);
        if (comp > 0) {
          current.left = currentLeft.right;
          currentLeft.right = current;
          current = currentLeft;
          currentLeft = current.left;
          if (currentLeft == null) break;
        }
        if (right == null) {
          newTreeRight = current;
        } else {
          right.left = current;
        }
        right = current;
        current = currentLeft;
      } else if (comp < 0) {
        let currentRight = current.right;
        if (currentRight == null) break;
        comp = compare2(currentRight.key, key);
        if (comp < 0) {
          current.right = currentRight.left;
          currentRight.left = current;
          current = currentRight;
          currentRight = current.right;
          if (currentRight == null) break;
        }
        if (left == null) {
          newTreeLeft = current;
        } else {
          left.right = current;
        }
        left = current;
        current = currentRight;
      } else {
        break;
      }
    }
    if (left != null) {
      left.right = current.left;
      current.left = newTreeLeft;
    }
    if (right != null) {
      right.left = current.right;
      current.right = newTreeRight;
    }
    if (this.root !== current) {
      this.root = current;
      this.splayCount++;
    }
    return comp;
  }
  splayMin(node) {
    let current = node;
    let nextLeft = current.left;
    while (nextLeft != null) {
      const left = nextLeft;
      current.left = left.right;
      left.right = current;
      current = left;
      nextLeft = current.left;
    }
    return current;
  }
  splayMax(node) {
    let current = node;
    let nextRight = current.right;
    while (nextRight != null) {
      const right = nextRight;
      current.right = right.left;
      right.left = current;
      current = right;
      nextRight = current.right;
    }
    return current;
  }
  _delete(key) {
    if (this.root == null) return null;
    const comp = this.splay(key);
    if (comp != 0) return null;
    let root = this.root;
    const result = root;
    const left = root.left;
    this.size--;
    if (left == null) {
      this.root = root.right;
    } else {
      const right = root.right;
      root = this.splayMax(left);
      root.right = right;
      this.root = root;
    }
    this.modificationCount++;
    return result;
  }
  addNewRoot(node, comp) {
    this.size++;
    this.modificationCount++;
    const root = this.root;
    if (root == null) {
      this.root = node;
      return;
    }
    if (comp < 0) {
      node.left = root;
      node.right = root.right;
      root.right = null;
    } else {
      node.right = root;
      node.left = root.left;
      root.left = null;
    }
    this.root = node;
  }
  _first() {
    const root = this.root;
    if (root == null) return null;
    this.root = this.splayMin(root);
    return this.root;
  }
  _last() {
    const root = this.root;
    if (root == null) return null;
    this.root = this.splayMax(root);
    return this.root;
  }
  clear() {
    this.root = null;
    this.size = 0;
    this.modificationCount++;
  }
  has(key) {
    return this.validKey(key) && this.splay(key) == 0;
  }
  defaultCompare() {
    return (a, b) => a < b ? -1 : a > b ? 1 : 0;
  }
  wrap() {
    return {
      getRoot: () => {
        return this.root;
      },
      setRoot: (root) => {
        this.root = root;
      },
      getSize: () => {
        return this.size;
      },
      getModificationCount: () => {
        return this.modificationCount;
      },
      getSplayCount: () => {
        return this.splayCount;
      },
      setSplayCount: (count) => {
        this.splayCount = count;
      },
      splay: (key) => {
        return this.splay(key);
      },
      has: (key) => {
        return this.has(key);
      }
    };
  }
};
var SplayTreeSet = class _SplayTreeSet extends SplayTree {
  root = null;
  compare;
  validKey;
  constructor(compare2, isValidKey) {
    super();
    this.compare = compare2 ?? this.defaultCompare();
    this.validKey = isValidKey ?? ((v2) => v2 != null && v2 != void 0);
  }
  delete(element) {
    if (!this.validKey(element)) return false;
    return this._delete(element) != null;
  }
  deleteAll(elements) {
    for (const element of elements) {
      this.delete(element);
    }
  }
  forEach(f) {
    const nodes = this[Symbol.iterator]();
    let result;
    while (result = nodes.next(), !result.done) {
      f(result.value, result.value, this);
    }
  }
  add(element) {
    const compare2 = this.splay(element);
    if (compare2 != 0) this.addNewRoot(new SplayTreeSetNode(element), compare2);
    return this;
  }
  addAndReturn(element) {
    const compare2 = this.splay(element);
    if (compare2 != 0) this.addNewRoot(new SplayTreeSetNode(element), compare2);
    return this.root.key;
  }
  addAll(elements) {
    for (const element of elements) {
      this.add(element);
    }
  }
  isEmpty() {
    return this.root == null;
  }
  isNotEmpty() {
    return this.root != null;
  }
  single() {
    if (this.size == 0) throw "Bad state: No element";
    if (this.size > 1) throw "Bad state: Too many element";
    return this.root.key;
  }
  first() {
    if (this.size == 0) throw "Bad state: No element";
    return this._first().key;
  }
  last() {
    if (this.size == 0) throw "Bad state: No element";
    return this._last().key;
  }
  lastBefore(element) {
    if (element == null) throw "Invalid arguments(s)";
    if (this.root == null) return null;
    const comp = this.splay(element);
    if (comp < 0) return this.root.key;
    let node = this.root.left;
    if (node == null) return null;
    let nodeRight = node.right;
    while (nodeRight != null) {
      node = nodeRight;
      nodeRight = node.right;
    }
    return node.key;
  }
  firstAfter(element) {
    if (element == null) throw "Invalid arguments(s)";
    if (this.root == null) return null;
    const comp = this.splay(element);
    if (comp > 0) return this.root.key;
    let node = this.root.right;
    if (node == null) return null;
    let nodeLeft = node.left;
    while (nodeLeft != null) {
      node = nodeLeft;
      nodeLeft = node.left;
    }
    return node.key;
  }
  retainAll(elements) {
    const retainSet = new _SplayTreeSet(this.compare, this.validKey);
    const modificationCount = this.modificationCount;
    for (const object of elements) {
      if (modificationCount != this.modificationCount) {
        throw "Concurrent modification during iteration.";
      }
      if (this.validKey(object) && this.splay(object) == 0) {
        retainSet.add(this.root.key);
      }
    }
    if (retainSet.size != this.size) {
      this.root = retainSet.root;
      this.size = retainSet.size;
      this.modificationCount++;
    }
  }
  lookup(object) {
    if (!this.validKey(object)) return null;
    const comp = this.splay(object);
    if (comp != 0) return null;
    return this.root.key;
  }
  intersection(other) {
    const result = new _SplayTreeSet(this.compare, this.validKey);
    for (const element of this) {
      if (other.has(element)) result.add(element);
    }
    return result;
  }
  difference(other) {
    const result = new _SplayTreeSet(this.compare, this.validKey);
    for (const element of this) {
      if (!other.has(element)) result.add(element);
    }
    return result;
  }
  union(other) {
    const u4 = this.clone();
    u4.addAll(other);
    return u4;
  }
  clone() {
    const set2 = new _SplayTreeSet(this.compare, this.validKey);
    set2.size = this.size;
    set2.root = this.copyNode(this.root);
    return set2;
  }
  copyNode(node) {
    if (node == null) return null;
    function copyChildren(node2, dest) {
      let left;
      let right;
      do {
        left = node2.left;
        right = node2.right;
        if (left != null) {
          const newLeft = new SplayTreeSetNode(left.key);
          dest.left = newLeft;
          copyChildren(left, newLeft);
        }
        if (right != null) {
          const newRight = new SplayTreeSetNode(right.key);
          dest.right = newRight;
          node2 = right;
          dest = newRight;
        }
      } while (right != null);
    }
    const result = new SplayTreeSetNode(node.key);
    copyChildren(node, result);
    return result;
  }
  toSet() {
    return this.clone();
  }
  entries() {
    return new SplayTreeSetEntryIterableIterator(this.wrap());
  }
  keys() {
    return this[Symbol.iterator]();
  }
  values() {
    return this[Symbol.iterator]();
  }
  [Symbol.iterator]() {
    return new SplayTreeKeyIterableIterator(this.wrap());
  }
  [Symbol.toStringTag] = "[object Set]";
};
var SplayTreeIterableIterator = class {
  tree;
  path = new Array();
  modificationCount = null;
  splayCount;
  constructor(tree) {
    this.tree = tree;
    this.splayCount = tree.getSplayCount();
  }
  [Symbol.iterator]() {
    return this;
  }
  next() {
    if (this.moveNext()) return { done: false, value: this.current() };
    return { done: true, value: null };
  }
  current() {
    if (!this.path.length) return null;
    const node = this.path[this.path.length - 1];
    return this.getValue(node);
  }
  rebuildPath(key) {
    this.path.splice(0, this.path.length);
    this.tree.splay(key);
    this.path.push(this.tree.getRoot());
    this.splayCount = this.tree.getSplayCount();
  }
  findLeftMostDescendent(node) {
    while (node != null) {
      this.path.push(node);
      node = node.left;
    }
  }
  moveNext() {
    if (this.modificationCount != this.tree.getModificationCount()) {
      if (this.modificationCount == null) {
        this.modificationCount = this.tree.getModificationCount();
        let node2 = this.tree.getRoot();
        while (node2 != null) {
          this.path.push(node2);
          node2 = node2.left;
        }
        return this.path.length > 0;
      }
      throw "Concurrent modification during iteration.";
    }
    if (!this.path.length) return false;
    if (this.splayCount != this.tree.getSplayCount()) {
      this.rebuildPath(this.path[this.path.length - 1].key);
    }
    let node = this.path[this.path.length - 1];
    let next = node.right;
    if (next != null) {
      while (next != null) {
        this.path.push(next);
        next = next.left;
      }
      return true;
    }
    this.path.pop();
    while (this.path.length && this.path[this.path.length - 1].right === node) {
      node = this.path.pop();
    }
    return this.path.length > 0;
  }
};
var SplayTreeKeyIterableIterator = class extends SplayTreeIterableIterator {
  getValue(node) {
    return node.key;
  }
};
var SplayTreeSetEntryIterableIterator = class extends SplayTreeIterableIterator {
  getValue(node) {
    return [node.key, node.key];
  }
};

// node_modules/polyclip-ts/dist/esm/index.js
var constant_default = (x) => {
  return () => {
    return x;
  };
};
var compare_default = (eps) => {
  const almostEqual = eps ? (a, b) => b.minus(a).abs().isLessThanOrEqualTo(eps) : constant_default(false);
  return (a, b) => {
    if (almostEqual(a, b)) return 0;
    return a.comparedTo(b);
  };
};
function orient_default(eps) {
  const almostCollinear = eps ? (area2, ax, ay, cx, cy) => area2.exponentiatedBy(2).isLessThanOrEqualTo(
    cx.minus(ax).exponentiatedBy(2).plus(cy.minus(ay).exponentiatedBy(2)).times(eps)
  ) : constant_default(false);
  return (a, b, c) => {
    const ax = a.x, ay = a.y, cx = c.x, cy = c.y;
    const area2 = ay.minus(cy).times(b.x.minus(cx)).minus(ax.minus(cx).times(b.y.minus(cy)));
    if (almostCollinear(area2, ax, ay, cx, cy)) return 0;
    return area2.comparedTo(0);
  };
}
var identity_default = (x) => {
  return x;
};
var snap_default = (eps) => {
  if (eps) {
    const xTree = new SplayTreeSet(compare_default(eps));
    const yTree = new SplayTreeSet(compare_default(eps));
    const snapCoord = (coord, tree) => {
      return tree.addAndReturn(coord);
    };
    const snap = (v2) => {
      return {
        x: snapCoord(v2.x, xTree),
        y: snapCoord(v2.y, yTree)
      };
    };
    snap({ x: new bignumber_default(0), y: new bignumber_default(0) });
    return snap;
  }
  return identity_default;
};
var set = (eps) => {
  return {
    set: (eps2) => {
      precision = set(eps2);
    },
    reset: () => set(eps),
    compare: compare_default(eps),
    snap: snap_default(eps),
    orient: orient_default(eps)
  };
};
var precision = set();
var isInBbox = (bbox3, point2) => {
  return bbox3.ll.x.isLessThanOrEqualTo(point2.x) && point2.x.isLessThanOrEqualTo(bbox3.ur.x) && bbox3.ll.y.isLessThanOrEqualTo(point2.y) && point2.y.isLessThanOrEqualTo(bbox3.ur.y);
};
var getBboxOverlap = (b1, b2) => {
  if (b2.ur.x.isLessThan(b1.ll.x) || b1.ur.x.isLessThan(b2.ll.x) || b2.ur.y.isLessThan(b1.ll.y) || b1.ur.y.isLessThan(b2.ll.y))
    return null;
  const lowerX = b1.ll.x.isLessThan(b2.ll.x) ? b2.ll.x : b1.ll.x;
  const upperX = b1.ur.x.isLessThan(b2.ur.x) ? b1.ur.x : b2.ur.x;
  const lowerY = b1.ll.y.isLessThan(b2.ll.y) ? b2.ll.y : b1.ll.y;
  const upperY = b1.ur.y.isLessThan(b2.ur.y) ? b1.ur.y : b2.ur.y;
  return { ll: { x: lowerX, y: lowerY }, ur: { x: upperX, y: upperY } };
};
var crossProduct = (a, b) => a.x.times(b.y).minus(a.y.times(b.x));
var dotProduct = (a, b) => a.x.times(b.x).plus(a.y.times(b.y));
var length = (v2) => dotProduct(v2, v2).sqrt();
var sineOfAngle = (pShared, pBase, pAngle) => {
  const vBase = { x: pBase.x.minus(pShared.x), y: pBase.y.minus(pShared.y) };
  const vAngle = { x: pAngle.x.minus(pShared.x), y: pAngle.y.minus(pShared.y) };
  return crossProduct(vAngle, vBase).div(length(vAngle)).div(length(vBase));
};
var cosineOfAngle = (pShared, pBase, pAngle) => {
  const vBase = { x: pBase.x.minus(pShared.x), y: pBase.y.minus(pShared.y) };
  const vAngle = { x: pAngle.x.minus(pShared.x), y: pAngle.y.minus(pShared.y) };
  return dotProduct(vAngle, vBase).div(length(vAngle)).div(length(vBase));
};
var horizontalIntersection = (pt, v2, y) => {
  if (v2.y.isZero()) return null;
  return { x: pt.x.plus(v2.x.div(v2.y).times(y.minus(pt.y))), y };
};
var verticalIntersection = (pt, v2, x) => {
  if (v2.x.isZero()) return null;
  return { x, y: pt.y.plus(v2.y.div(v2.x).times(x.minus(pt.x))) };
};
var intersection = (pt1, v1, pt2, v2) => {
  if (v1.x.isZero()) return verticalIntersection(pt2, v2, pt1.x);
  if (v2.x.isZero()) return verticalIntersection(pt1, v1, pt2.x);
  if (v1.y.isZero()) return horizontalIntersection(pt2, v2, pt1.y);
  if (v2.y.isZero()) return horizontalIntersection(pt1, v1, pt2.y);
  const kross = crossProduct(v1, v2);
  if (kross.isZero()) return null;
  const ve = { x: pt2.x.minus(pt1.x), y: pt2.y.minus(pt1.y) };
  const d1 = crossProduct(ve, v1).div(kross);
  const d2 = crossProduct(ve, v2).div(kross);
  const x1 = pt1.x.plus(d2.times(v1.x)), x2 = pt2.x.plus(d1.times(v2.x));
  const y1 = pt1.y.plus(d2.times(v1.y)), y2 = pt2.y.plus(d1.times(v2.y));
  const x = x1.plus(x2).div(2);
  const y = y1.plus(y2).div(2);
  return { x, y };
};
var SweepEvent = class _SweepEvent {
  point;
  isLeft;
  segment;
  otherSE;
  consumedBy;
  // for ordering sweep events in the sweep event queue
  static compare(a, b) {
    const ptCmp = _SweepEvent.comparePoints(a.point, b.point);
    if (ptCmp !== 0) return ptCmp;
    if (a.point !== b.point) a.link(b);
    if (a.isLeft !== b.isLeft) return a.isLeft ? 1 : -1;
    return Segment.compare(a.segment, b.segment);
  }
  // for ordering points in sweep line order
  static comparePoints(aPt, bPt) {
    if (aPt.x.isLessThan(bPt.x)) return -1;
    if (aPt.x.isGreaterThan(bPt.x)) return 1;
    if (aPt.y.isLessThan(bPt.y)) return -1;
    if (aPt.y.isGreaterThan(bPt.y)) return 1;
    return 0;
  }
  // Warning: 'point' input will be modified and re-used (for performance)
  constructor(point2, isLeft) {
    if (point2.events === void 0) point2.events = [this];
    else point2.events.push(this);
    this.point = point2;
    this.isLeft = isLeft;
  }
  link(other) {
    if (other.point === this.point) {
      throw new Error("Tried to link already linked events");
    }
    const otherEvents = other.point.events;
    for (let i = 0, iMax = otherEvents.length; i < iMax; i++) {
      const evt = otherEvents[i];
      this.point.events.push(evt);
      evt.point = this.point;
    }
    this.checkForConsuming();
  }
  /* Do a pass over our linked events and check to see if any pair
   * of segments match, and should be consumed. */
  checkForConsuming() {
    const numEvents = this.point.events.length;
    for (let i = 0; i < numEvents; i++) {
      const evt1 = this.point.events[i];
      if (evt1.segment.consumedBy !== void 0) continue;
      for (let j = i + 1; j < numEvents; j++) {
        const evt2 = this.point.events[j];
        if (evt2.consumedBy !== void 0) continue;
        if (evt1.otherSE.point.events !== evt2.otherSE.point.events) continue;
        evt1.segment.consume(evt2.segment);
      }
    }
  }
  getAvailableLinkedEvents() {
    const events = [];
    for (let i = 0, iMax = this.point.events.length; i < iMax; i++) {
      const evt = this.point.events[i];
      if (evt !== this && !evt.segment.ringOut && evt.segment.isInResult()) {
        events.push(evt);
      }
    }
    return events;
  }
  /**
   * Returns a comparator function for sorting linked events that will
   * favor the event that will give us the smallest left-side angle.
   * All ring construction starts as low as possible heading to the right,
   * so by always turning left as sharp as possible we'll get polygons
   * without uncessary loops & holes.
   *
   * The comparator function has a compute cache such that it avoids
   * re-computing already-computed values.
   */
  getLeftmostComparator(baseEvent) {
    const cache = /* @__PURE__ */ new Map();
    const fillCache = (linkedEvent) => {
      const nextEvent = linkedEvent.otherSE;
      cache.set(linkedEvent, {
        sine: sineOfAngle(this.point, baseEvent.point, nextEvent.point),
        cosine: cosineOfAngle(this.point, baseEvent.point, nextEvent.point)
      });
    };
    return (a, b) => {
      if (!cache.has(a)) fillCache(a);
      if (!cache.has(b)) fillCache(b);
      const { sine: asine, cosine: acosine } = cache.get(a);
      const { sine: bsine, cosine: bcosine } = cache.get(b);
      if (asine.isGreaterThanOrEqualTo(0) && bsine.isGreaterThanOrEqualTo(0)) {
        if (acosine.isLessThan(bcosine)) return 1;
        if (acosine.isGreaterThan(bcosine)) return -1;
        return 0;
      }
      if (asine.isLessThan(0) && bsine.isLessThan(0)) {
        if (acosine.isLessThan(bcosine)) return -1;
        if (acosine.isGreaterThan(bcosine)) return 1;
        return 0;
      }
      if (bsine.isLessThan(asine)) return -1;
      if (bsine.isGreaterThan(asine)) return 1;
      return 0;
    };
  }
};
var RingOut = class _RingOut {
  events;
  poly;
  _isExteriorRing;
  _enclosingRing;
  /* Given the segments from the sweep line pass, compute & return a series
   * of closed rings from all the segments marked to be part of the result */
  static factory(allSegments) {
    const ringsOut = [];
    for (let i = 0, iMax = allSegments.length; i < iMax; i++) {
      const segment = allSegments[i];
      if (!segment.isInResult() || segment.ringOut) continue;
      let prevEvent = null;
      let event = segment.leftSE;
      let nextEvent = segment.rightSE;
      const events = [event];
      const startingPoint = event.point;
      const intersectionLEs = [];
      while (true) {
        prevEvent = event;
        event = nextEvent;
        events.push(event);
        if (event.point === startingPoint) break;
        while (true) {
          const availableLEs = event.getAvailableLinkedEvents();
          if (availableLEs.length === 0) {
            const firstPt = events[0].point;
            const lastPt = events[events.length - 1].point;
            throw new Error(
              `Unable to complete output ring starting at [${firstPt.x}, ${firstPt.y}]. Last matching segment found ends at [${lastPt.x}, ${lastPt.y}].`
            );
          }
          if (availableLEs.length === 1) {
            nextEvent = availableLEs[0].otherSE;
            break;
          }
          let indexLE = null;
          for (let j = 0, jMax = intersectionLEs.length; j < jMax; j++) {
            if (intersectionLEs[j].point === event.point) {
              indexLE = j;
              break;
            }
          }
          if (indexLE !== null) {
            const intersectionLE = intersectionLEs.splice(indexLE)[0];
            const ringEvents = events.splice(intersectionLE.index);
            ringEvents.unshift(ringEvents[0].otherSE);
            ringsOut.push(new _RingOut(ringEvents.reverse()));
            continue;
          }
          intersectionLEs.push({
            index: events.length,
            point: event.point
          });
          const comparator = event.getLeftmostComparator(prevEvent);
          nextEvent = availableLEs.sort(comparator)[0].otherSE;
          break;
        }
      }
      ringsOut.push(new _RingOut(events));
    }
    return ringsOut;
  }
  constructor(events) {
    this.events = events;
    for (let i = 0, iMax = events.length; i < iMax; i++) {
      events[i].segment.ringOut = this;
    }
    this.poly = null;
  }
  getGeom() {
    let prevPt = this.events[0].point;
    const points = [prevPt];
    for (let i = 1, iMax = this.events.length - 1; i < iMax; i++) {
      const pt2 = this.events[i].point;
      const nextPt2 = this.events[i + 1].point;
      if (precision.orient(pt2, prevPt, nextPt2) === 0) continue;
      points.push(pt2);
      prevPt = pt2;
    }
    if (points.length === 1) return null;
    const pt = points[0];
    const nextPt = points[1];
    if (precision.orient(pt, prevPt, nextPt) === 0) points.shift();
    points.push(points[0]);
    const step = this.isExteriorRing() ? 1 : -1;
    const iStart = this.isExteriorRing() ? 0 : points.length - 1;
    const iEnd = this.isExteriorRing() ? points.length : -1;
    const orderedPoints = [];
    for (let i = iStart; i != iEnd; i += step)
      orderedPoints.push([points[i].x.toNumber(), points[i].y.toNumber()]);
    return orderedPoints;
  }
  isExteriorRing() {
    if (this._isExteriorRing === void 0) {
      const enclosing = this.enclosingRing();
      this._isExteriorRing = enclosing ? !enclosing.isExteriorRing() : true;
    }
    return this._isExteriorRing;
  }
  enclosingRing() {
    if (this._enclosingRing === void 0) {
      this._enclosingRing = this._calcEnclosingRing();
    }
    return this._enclosingRing;
  }
  /* Returns the ring that encloses this one, if any */
  _calcEnclosingRing() {
    let leftMostEvt = this.events[0];
    for (let i = 1, iMax = this.events.length; i < iMax; i++) {
      const evt = this.events[i];
      if (SweepEvent.compare(leftMostEvt, evt) > 0) leftMostEvt = evt;
    }
    let prevSeg = leftMostEvt.segment.prevInResult();
    let prevPrevSeg = prevSeg ? prevSeg.prevInResult() : null;
    while (true) {
      if (!prevSeg) return null;
      if (!prevPrevSeg) return prevSeg.ringOut;
      if (prevPrevSeg.ringOut !== prevSeg.ringOut) {
        if (prevPrevSeg.ringOut?.enclosingRing() !== prevSeg.ringOut) {
          return prevSeg.ringOut;
        } else return prevSeg.ringOut?.enclosingRing();
      }
      prevSeg = prevPrevSeg.prevInResult();
      prevPrevSeg = prevSeg ? prevSeg.prevInResult() : null;
    }
  }
};
var PolyOut = class {
  exteriorRing;
  interiorRings;
  constructor(exteriorRing) {
    this.exteriorRing = exteriorRing;
    exteriorRing.poly = this;
    this.interiorRings = [];
  }
  addInterior(ring) {
    this.interiorRings.push(ring);
    ring.poly = this;
  }
  getGeom() {
    const geom0 = this.exteriorRing.getGeom();
    if (geom0 === null) return null;
    const geom = [geom0];
    for (let i = 0, iMax = this.interiorRings.length; i < iMax; i++) {
      const ringGeom = this.interiorRings[i].getGeom();
      if (ringGeom === null) continue;
      geom.push(ringGeom);
    }
    return geom;
  }
};
var MultiPolyOut = class {
  rings;
  polys;
  constructor(rings) {
    this.rings = rings;
    this.polys = this._composePolys(rings);
  }
  getGeom() {
    const geom = [];
    for (let i = 0, iMax = this.polys.length; i < iMax; i++) {
      const polyGeom = this.polys[i].getGeom();
      if (polyGeom === null) continue;
      geom.push(polyGeom);
    }
    return geom;
  }
  _composePolys(rings) {
    const polys = [];
    for (let i = 0, iMax = rings.length; i < iMax; i++) {
      const ring = rings[i];
      if (ring.poly) continue;
      if (ring.isExteriorRing()) polys.push(new PolyOut(ring));
      else {
        const enclosingRing = ring.enclosingRing();
        if (!enclosingRing?.poly) polys.push(new PolyOut(enclosingRing));
        enclosingRing?.poly?.addInterior(ring);
      }
    }
    return polys;
  }
};
var SweepLine = class {
  queue;
  tree;
  segments;
  constructor(queue, comparator = Segment.compare) {
    this.queue = queue;
    this.tree = new SplayTreeSet(comparator);
    this.segments = [];
  }
  process(event) {
    const segment = event.segment;
    const newEvents = [];
    if (event.consumedBy) {
      if (event.isLeft) this.queue.delete(event.otherSE);
      else this.tree.delete(segment);
      return newEvents;
    }
    if (event.isLeft) this.tree.add(segment);
    let prevSeg = segment;
    let nextSeg = segment;
    do {
      prevSeg = this.tree.lastBefore(prevSeg);
    } while (prevSeg != null && prevSeg.consumedBy != void 0);
    do {
      nextSeg = this.tree.firstAfter(nextSeg);
    } while (nextSeg != null && nextSeg.consumedBy != void 0);
    if (event.isLeft) {
      let prevMySplitter = null;
      if (prevSeg) {
        const prevInter = prevSeg.getIntersection(segment);
        if (prevInter !== null) {
          if (!segment.isAnEndpoint(prevInter)) prevMySplitter = prevInter;
          if (!prevSeg.isAnEndpoint(prevInter)) {
            const newEventsFromSplit = this._splitSafely(prevSeg, prevInter);
            for (let i = 0, iMax = newEventsFromSplit.length; i < iMax; i++) {
              newEvents.push(newEventsFromSplit[i]);
            }
          }
        }
      }
      let nextMySplitter = null;
      if (nextSeg) {
        const nextInter = nextSeg.getIntersection(segment);
        if (nextInter !== null) {
          if (!segment.isAnEndpoint(nextInter)) nextMySplitter = nextInter;
          if (!nextSeg.isAnEndpoint(nextInter)) {
            const newEventsFromSplit = this._splitSafely(nextSeg, nextInter);
            for (let i = 0, iMax = newEventsFromSplit.length; i < iMax; i++) {
              newEvents.push(newEventsFromSplit[i]);
            }
          }
        }
      }
      if (prevMySplitter !== null || nextMySplitter !== null) {
        let mySplitter = null;
        if (prevMySplitter === null) mySplitter = nextMySplitter;
        else if (nextMySplitter === null) mySplitter = prevMySplitter;
        else {
          const cmpSplitters = SweepEvent.comparePoints(
            prevMySplitter,
            nextMySplitter
          );
          mySplitter = cmpSplitters <= 0 ? prevMySplitter : nextMySplitter;
        }
        this.queue.delete(segment.rightSE);
        newEvents.push(segment.rightSE);
        const newEventsFromSplit = segment.split(mySplitter);
        for (let i = 0, iMax = newEventsFromSplit.length; i < iMax; i++) {
          newEvents.push(newEventsFromSplit[i]);
        }
      }
      if (newEvents.length > 0) {
        this.tree.delete(segment);
        newEvents.push(event);
      } else {
        this.segments.push(segment);
        segment.prev = prevSeg;
      }
    } else {
      if (prevSeg && nextSeg) {
        const inter = prevSeg.getIntersection(nextSeg);
        if (inter !== null) {
          if (!prevSeg.isAnEndpoint(inter)) {
            const newEventsFromSplit = this._splitSafely(prevSeg, inter);
            for (let i = 0, iMax = newEventsFromSplit.length; i < iMax; i++) {
              newEvents.push(newEventsFromSplit[i]);
            }
          }
          if (!nextSeg.isAnEndpoint(inter)) {
            const newEventsFromSplit = this._splitSafely(nextSeg, inter);
            for (let i = 0, iMax = newEventsFromSplit.length; i < iMax; i++) {
              newEvents.push(newEventsFromSplit[i]);
            }
          }
        }
      }
      this.tree.delete(segment);
    }
    return newEvents;
  }
  /* Safely split a segment that is currently in the datastructures
   * IE - a segment other than the one that is currently being processed. */
  _splitSafely(seg, pt) {
    this.tree.delete(seg);
    const rightSE = seg.rightSE;
    this.queue.delete(rightSE);
    const newEvents = seg.split(pt);
    newEvents.push(rightSE);
    if (seg.consumedBy === void 0) this.tree.add(seg);
    return newEvents;
  }
};
var Operation = class {
  type;
  numMultiPolys;
  run(type, geom, moreGeoms) {
    operation.type = type;
    const multipolys = [new MultiPolyIn(geom, true)];
    for (let i = 0, iMax = moreGeoms.length; i < iMax; i++) {
      multipolys.push(new MultiPolyIn(moreGeoms[i], false));
    }
    operation.numMultiPolys = multipolys.length;
    if (operation.type === "difference") {
      const subject = multipolys[0];
      let i = 1;
      while (i < multipolys.length) {
        if (getBboxOverlap(multipolys[i].bbox, subject.bbox) !== null) i++;
        else multipolys.splice(i, 1);
      }
    }
    if (operation.type === "intersection") {
      for (let i = 0, iMax = multipolys.length; i < iMax; i++) {
        const mpA = multipolys[i];
        for (let j = i + 1, jMax = multipolys.length; j < jMax; j++) {
          if (getBboxOverlap(mpA.bbox, multipolys[j].bbox) === null) return [];
        }
      }
    }
    const queue = new SplayTreeSet(SweepEvent.compare);
    for (let i = 0, iMax = multipolys.length; i < iMax; i++) {
      const sweepEvents = multipolys[i].getSweepEvents();
      for (let j = 0, jMax = sweepEvents.length; j < jMax; j++) {
        queue.add(sweepEvents[j]);
      }
    }
    const sweepLine = new SweepLine(queue);
    let evt = null;
    if (queue.size != 0) {
      evt = queue.first();
      queue.delete(evt);
    }
    while (evt) {
      const newEvents = sweepLine.process(evt);
      for (let i = 0, iMax = newEvents.length; i < iMax; i++) {
        const evt2 = newEvents[i];
        if (evt2.consumedBy === void 0) queue.add(evt2);
      }
      if (queue.size != 0) {
        evt = queue.first();
        queue.delete(evt);
      } else {
        evt = null;
      }
    }
    precision.reset();
    const ringsOut = RingOut.factory(sweepLine.segments);
    const result = new MultiPolyOut(ringsOut);
    return result.getGeom();
  }
};
var operation = new Operation();
var operation_default = operation;
var segmentId = 0;
var Segment = class _Segment {
  id;
  leftSE;
  rightSE;
  rings;
  windings;
  ringOut;
  consumedBy;
  prev;
  _prevInResult;
  _beforeState;
  _afterState;
  _isInResult;
  /* This compare() function is for ordering segments in the sweep
   * line tree, and does so according to the following criteria:
   *
   * Consider the vertical line that lies an infinestimal step to the
   * right of the right-more of the two left endpoints of the input
   * segments. Imagine slowly moving a point up from negative infinity
   * in the increasing y direction. Which of the two segments will that
   * point intersect first? That segment comes 'before' the other one.
   *
   * If neither segment would be intersected by such a line, (if one
   * or more of the segments are vertical) then the line to be considered
   * is directly on the right-more of the two left inputs.
   */
  static compare(a, b) {
    const alx = a.leftSE.point.x;
    const blx = b.leftSE.point.x;
    const arx = a.rightSE.point.x;
    const brx = b.rightSE.point.x;
    if (brx.isLessThan(alx)) return 1;
    if (arx.isLessThan(blx)) return -1;
    const aly = a.leftSE.point.y;
    const bly = b.leftSE.point.y;
    const ary = a.rightSE.point.y;
    const bry = b.rightSE.point.y;
    if (alx.isLessThan(blx)) {
      if (bly.isLessThan(aly) && bly.isLessThan(ary)) return 1;
      if (bly.isGreaterThan(aly) && bly.isGreaterThan(ary)) return -1;
      const aCmpBLeft = a.comparePoint(b.leftSE.point);
      if (aCmpBLeft < 0) return 1;
      if (aCmpBLeft > 0) return -1;
      const bCmpARight = b.comparePoint(a.rightSE.point);
      if (bCmpARight !== 0) return bCmpARight;
      return -1;
    }
    if (alx.isGreaterThan(blx)) {
      if (aly.isLessThan(bly) && aly.isLessThan(bry)) return -1;
      if (aly.isGreaterThan(bly) && aly.isGreaterThan(bry)) return 1;
      const bCmpALeft = b.comparePoint(a.leftSE.point);
      if (bCmpALeft !== 0) return bCmpALeft;
      const aCmpBRight = a.comparePoint(b.rightSE.point);
      if (aCmpBRight < 0) return 1;
      if (aCmpBRight > 0) return -1;
      return 1;
    }
    if (aly.isLessThan(bly)) return -1;
    if (aly.isGreaterThan(bly)) return 1;
    if (arx.isLessThan(brx)) {
      const bCmpARight = b.comparePoint(a.rightSE.point);
      if (bCmpARight !== 0) return bCmpARight;
    }
    if (arx.isGreaterThan(brx)) {
      const aCmpBRight = a.comparePoint(b.rightSE.point);
      if (aCmpBRight < 0) return 1;
      if (aCmpBRight > 0) return -1;
    }
    if (!arx.eq(brx)) {
      const ay = ary.minus(aly);
      const ax = arx.minus(alx);
      const by = bry.minus(bly);
      const bx = brx.minus(blx);
      if (ay.isGreaterThan(ax) && by.isLessThan(bx)) return 1;
      if (ay.isLessThan(ax) && by.isGreaterThan(bx)) return -1;
    }
    if (arx.isGreaterThan(brx)) return 1;
    if (arx.isLessThan(brx)) return -1;
    if (ary.isLessThan(bry)) return -1;
    if (ary.isGreaterThan(bry)) return 1;
    if (a.id < b.id) return -1;
    if (a.id > b.id) return 1;
    return 0;
  }
  /* Warning: a reference to ringWindings input will be stored,
   *  and possibly will be later modified */
  constructor(leftSE, rightSE, rings, windings) {
    this.id = ++segmentId;
    this.leftSE = leftSE;
    leftSE.segment = this;
    leftSE.otherSE = rightSE;
    this.rightSE = rightSE;
    rightSE.segment = this;
    rightSE.otherSE = leftSE;
    this.rings = rings;
    this.windings = windings;
  }
  static fromRing(pt1, pt2, ring) {
    let leftPt, rightPt, winding;
    const cmpPts = SweepEvent.comparePoints(pt1, pt2);
    if (cmpPts < 0) {
      leftPt = pt1;
      rightPt = pt2;
      winding = 1;
    } else if (cmpPts > 0) {
      leftPt = pt2;
      rightPt = pt1;
      winding = -1;
    } else
      throw new Error(
        `Tried to create degenerate segment at [${pt1.x}, ${pt1.y}]`
      );
    const leftSE = new SweepEvent(leftPt, true);
    const rightSE = new SweepEvent(rightPt, false);
    return new _Segment(leftSE, rightSE, [ring], [winding]);
  }
  /* When a segment is split, the rightSE is replaced with a new sweep event */
  replaceRightSE(newRightSE) {
    this.rightSE = newRightSE;
    this.rightSE.segment = this;
    this.rightSE.otherSE = this.leftSE;
    this.leftSE.otherSE = this.rightSE;
  }
  bbox() {
    const y1 = this.leftSE.point.y;
    const y2 = this.rightSE.point.y;
    return {
      ll: { x: this.leftSE.point.x, y: y1.isLessThan(y2) ? y1 : y2 },
      ur: { x: this.rightSE.point.x, y: y1.isGreaterThan(y2) ? y1 : y2 }
    };
  }
  /* A vector from the left point to the right */
  vector() {
    return {
      x: this.rightSE.point.x.minus(this.leftSE.point.x),
      y: this.rightSE.point.y.minus(this.leftSE.point.y)
    };
  }
  isAnEndpoint(pt) {
    return pt.x.eq(this.leftSE.point.x) && pt.y.eq(this.leftSE.point.y) || pt.x.eq(this.rightSE.point.x) && pt.y.eq(this.rightSE.point.y);
  }
  /* Compare this segment with a point.
   *
   * A point P is considered to be colinear to a segment if there
   * exists a distance D such that if we travel along the segment
   * from one * endpoint towards the other a distance D, we find
   * ourselves at point P.
   *
   * Return value indicates:
   *
   *   1: point lies above the segment (to the left of vertical)
   *   0: point is colinear to segment
   *  -1: point lies below the segment (to the right of vertical)
   */
  comparePoint(point2) {
    return precision.orient(this.leftSE.point, point2, this.rightSE.point);
  }
  /**
   * Given another segment, returns the first non-trivial intersection
   * between the two segments (in terms of sweep line ordering), if it exists.
   *
   * A 'non-trivial' intersection is one that will cause one or both of the
   * segments to be split(). As such, 'trivial' vs. 'non-trivial' intersection:
   *
   *   * endpoint of segA with endpoint of segB --> trivial
   *   * endpoint of segA with point along segB --> non-trivial
   *   * endpoint of segB with point along segA --> non-trivial
   *   * point along segA with point along segB --> non-trivial
   *
   * If no non-trivial intersection exists, return null
   * Else, return null.
   */
  getIntersection(other) {
    const tBbox = this.bbox();
    const oBbox = other.bbox();
    const bboxOverlap = getBboxOverlap(tBbox, oBbox);
    if (bboxOverlap === null) return null;
    const tlp = this.leftSE.point;
    const trp = this.rightSE.point;
    const olp = other.leftSE.point;
    const orp = other.rightSE.point;
    const touchesOtherLSE = isInBbox(tBbox, olp) && this.comparePoint(olp) === 0;
    const touchesThisLSE = isInBbox(oBbox, tlp) && other.comparePoint(tlp) === 0;
    const touchesOtherRSE = isInBbox(tBbox, orp) && this.comparePoint(orp) === 0;
    const touchesThisRSE = isInBbox(oBbox, trp) && other.comparePoint(trp) === 0;
    if (touchesThisLSE && touchesOtherLSE) {
      if (touchesThisRSE && !touchesOtherRSE) return trp;
      if (!touchesThisRSE && touchesOtherRSE) return orp;
      return null;
    }
    if (touchesThisLSE) {
      if (touchesOtherRSE) {
        if (tlp.x.eq(orp.x) && tlp.y.eq(orp.y)) return null;
      }
      return tlp;
    }
    if (touchesOtherLSE) {
      if (touchesThisRSE) {
        if (trp.x.eq(olp.x) && trp.y.eq(olp.y)) return null;
      }
      return olp;
    }
    if (touchesThisRSE && touchesOtherRSE) return null;
    if (touchesThisRSE) return trp;
    if (touchesOtherRSE) return orp;
    const pt = intersection(tlp, this.vector(), olp, other.vector());
    if (pt === null) return null;
    if (!isInBbox(bboxOverlap, pt)) return null;
    return precision.snap(pt);
  }
  /**
   * Split the given segment into multiple segments on the given points.
   *  * Each existing segment will retain its leftSE and a new rightSE will be
   *    generated for it.
   *  * A new segment will be generated which will adopt the original segment's
   *    rightSE, and a new leftSE will be generated for it.
   *  * If there are more than two points given to split on, new segments
   *    in the middle will be generated with new leftSE and rightSE's.
   *  * An array of the newly generated SweepEvents will be returned.
   *
   * Warning: input array of points is modified
   */
  split(point2) {
    const newEvents = [];
    const alreadyLinked = point2.events !== void 0;
    const newLeftSE = new SweepEvent(point2, true);
    const newRightSE = new SweepEvent(point2, false);
    const oldRightSE = this.rightSE;
    this.replaceRightSE(newRightSE);
    newEvents.push(newRightSE);
    newEvents.push(newLeftSE);
    const newSeg = new _Segment(
      newLeftSE,
      oldRightSE,
      this.rings.slice(),
      this.windings.slice()
    );
    if (SweepEvent.comparePoints(newSeg.leftSE.point, newSeg.rightSE.point) > 0) {
      newSeg.swapEvents();
    }
    if (SweepEvent.comparePoints(this.leftSE.point, this.rightSE.point) > 0) {
      this.swapEvents();
    }
    if (alreadyLinked) {
      newLeftSE.checkForConsuming();
      newRightSE.checkForConsuming();
    }
    return newEvents;
  }
  /* Swap which event is left and right */
  swapEvents() {
    const tmpEvt = this.rightSE;
    this.rightSE = this.leftSE;
    this.leftSE = tmpEvt;
    this.leftSE.isLeft = true;
    this.rightSE.isLeft = false;
    for (let i = 0, iMax = this.windings.length; i < iMax; i++) {
      this.windings[i] *= -1;
    }
  }
  /* Consume another segment. We take their rings under our wing
   * and mark them as consumed. Use for perfectly overlapping segments */
  consume(other) {
    let consumer = this;
    let consumee = other;
    while (consumer.consumedBy) consumer = consumer.consumedBy;
    while (consumee.consumedBy) consumee = consumee.consumedBy;
    const cmp = _Segment.compare(consumer, consumee);
    if (cmp === 0) return;
    if (cmp > 0) {
      const tmp = consumer;
      consumer = consumee;
      consumee = tmp;
    }
    if (consumer.prev === consumee) {
      const tmp = consumer;
      consumer = consumee;
      consumee = tmp;
    }
    for (let i = 0, iMax = consumee.rings.length; i < iMax; i++) {
      const ring = consumee.rings[i];
      const winding = consumee.windings[i];
      const index = consumer.rings.indexOf(ring);
      if (index === -1) {
        consumer.rings.push(ring);
        consumer.windings.push(winding);
      } else consumer.windings[index] += winding;
    }
    consumee.rings = null;
    consumee.windings = null;
    consumee.consumedBy = consumer;
    consumee.leftSE.consumedBy = consumer.leftSE;
    consumee.rightSE.consumedBy = consumer.rightSE;
  }
  /* The first segment previous segment chain that is in the result */
  prevInResult() {
    if (this._prevInResult !== void 0) return this._prevInResult;
    if (!this.prev) this._prevInResult = null;
    else if (this.prev.isInResult()) this._prevInResult = this.prev;
    else this._prevInResult = this.prev.prevInResult();
    return this._prevInResult;
  }
  beforeState() {
    if (this._beforeState !== void 0) return this._beforeState;
    if (!this.prev)
      this._beforeState = {
        rings: [],
        windings: [],
        multiPolys: []
      };
    else {
      const seg = this.prev.consumedBy || this.prev;
      this._beforeState = seg.afterState();
    }
    return this._beforeState;
  }
  afterState() {
    if (this._afterState !== void 0) return this._afterState;
    const beforeState = this.beforeState();
    this._afterState = {
      rings: beforeState.rings.slice(0),
      windings: beforeState.windings.slice(0),
      multiPolys: []
    };
    const ringsAfter = this._afterState.rings;
    const windingsAfter = this._afterState.windings;
    const mpsAfter = this._afterState.multiPolys;
    for (let i = 0, iMax = this.rings.length; i < iMax; i++) {
      const ring = this.rings[i];
      const winding = this.windings[i];
      const index = ringsAfter.indexOf(ring);
      if (index === -1) {
        ringsAfter.push(ring);
        windingsAfter.push(winding);
      } else windingsAfter[index] += winding;
    }
    const polysAfter = [];
    const polysExclude = [];
    for (let i = 0, iMax = ringsAfter.length; i < iMax; i++) {
      if (windingsAfter[i] === 0) continue;
      const ring = ringsAfter[i];
      const poly = ring.poly;
      if (polysExclude.indexOf(poly) !== -1) continue;
      if (ring.isExterior) polysAfter.push(poly);
      else {
        if (polysExclude.indexOf(poly) === -1) polysExclude.push(poly);
        const index = polysAfter.indexOf(ring.poly);
        if (index !== -1) polysAfter.splice(index, 1);
      }
    }
    for (let i = 0, iMax = polysAfter.length; i < iMax; i++) {
      const mp = polysAfter[i].multiPoly;
      if (mpsAfter.indexOf(mp) === -1) mpsAfter.push(mp);
    }
    return this._afterState;
  }
  /* Is this segment part of the final result? */
  isInResult() {
    if (this.consumedBy) return false;
    if (this._isInResult !== void 0) return this._isInResult;
    const mpsBefore = this.beforeState().multiPolys;
    const mpsAfter = this.afterState().multiPolys;
    switch (operation_default.type) {
      case "union": {
        const noBefores = mpsBefore.length === 0;
        const noAfters = mpsAfter.length === 0;
        this._isInResult = noBefores !== noAfters;
        break;
      }
      case "intersection": {
        let least;
        let most;
        if (mpsBefore.length < mpsAfter.length) {
          least = mpsBefore.length;
          most = mpsAfter.length;
        } else {
          least = mpsAfter.length;
          most = mpsBefore.length;
        }
        this._isInResult = most === operation_default.numMultiPolys && least < most;
        break;
      }
      case "xor": {
        const diff = Math.abs(mpsBefore.length - mpsAfter.length);
        this._isInResult = diff % 2 === 1;
        break;
      }
      case "difference": {
        const isJustSubject = (mps) => mps.length === 1 && mps[0].isSubject;
        this._isInResult = isJustSubject(mpsBefore) !== isJustSubject(mpsAfter);
        break;
      }
    }
    return this._isInResult;
  }
};
var RingIn = class {
  poly;
  isExterior;
  segments;
  bbox;
  constructor(geomRing, poly, isExterior) {
    if (!Array.isArray(geomRing) || geomRing.length === 0) {
      throw new Error("Input geometry is not a valid Polygon or MultiPolygon");
    }
    this.poly = poly;
    this.isExterior = isExterior;
    this.segments = [];
    if (typeof geomRing[0][0] !== "number" || typeof geomRing[0][1] !== "number") {
      throw new Error("Input geometry is not a valid Polygon or MultiPolygon");
    }
    const firstPoint = precision.snap({ x: new bignumber_default(geomRing[0][0]), y: new bignumber_default(geomRing[0][1]) });
    this.bbox = {
      ll: { x: firstPoint.x, y: firstPoint.y },
      ur: { x: firstPoint.x, y: firstPoint.y }
    };
    let prevPoint = firstPoint;
    for (let i = 1, iMax = geomRing.length; i < iMax; i++) {
      if (typeof geomRing[i][0] !== "number" || typeof geomRing[i][1] !== "number") {
        throw new Error("Input geometry is not a valid Polygon or MultiPolygon");
      }
      const point2 = precision.snap({ x: new bignumber_default(geomRing[i][0]), y: new bignumber_default(geomRing[i][1]) });
      if (point2.x.eq(prevPoint.x) && point2.y.eq(prevPoint.y)) continue;
      this.segments.push(Segment.fromRing(prevPoint, point2, this));
      if (point2.x.isLessThan(this.bbox.ll.x)) this.bbox.ll.x = point2.x;
      if (point2.y.isLessThan(this.bbox.ll.y)) this.bbox.ll.y = point2.y;
      if (point2.x.isGreaterThan(this.bbox.ur.x)) this.bbox.ur.x = point2.x;
      if (point2.y.isGreaterThan(this.bbox.ur.y)) this.bbox.ur.y = point2.y;
      prevPoint = point2;
    }
    if (!firstPoint.x.eq(prevPoint.x) || !firstPoint.y.eq(prevPoint.y)) {
      this.segments.push(Segment.fromRing(prevPoint, firstPoint, this));
    }
  }
  getSweepEvents() {
    const sweepEvents = [];
    for (let i = 0, iMax = this.segments.length; i < iMax; i++) {
      const segment = this.segments[i];
      sweepEvents.push(segment.leftSE);
      sweepEvents.push(segment.rightSE);
    }
    return sweepEvents;
  }
};
var PolyIn = class {
  multiPoly;
  exteriorRing;
  interiorRings;
  bbox;
  constructor(geomPoly, multiPoly) {
    if (!Array.isArray(geomPoly)) {
      throw new Error("Input geometry is not a valid Polygon or MultiPolygon");
    }
    this.exteriorRing = new RingIn(geomPoly[0], this, true);
    this.bbox = {
      ll: { x: this.exteriorRing.bbox.ll.x, y: this.exteriorRing.bbox.ll.y },
      ur: { x: this.exteriorRing.bbox.ur.x, y: this.exteriorRing.bbox.ur.y }
    };
    this.interiorRings = [];
    for (let i = 1, iMax = geomPoly.length; i < iMax; i++) {
      const ring = new RingIn(geomPoly[i], this, false);
      if (ring.bbox.ll.x.isLessThan(this.bbox.ll.x)) this.bbox.ll.x = ring.bbox.ll.x;
      if (ring.bbox.ll.y.isLessThan(this.bbox.ll.y)) this.bbox.ll.y = ring.bbox.ll.y;
      if (ring.bbox.ur.x.isGreaterThan(this.bbox.ur.x)) this.bbox.ur.x = ring.bbox.ur.x;
      if (ring.bbox.ur.y.isGreaterThan(this.bbox.ur.y)) this.bbox.ur.y = ring.bbox.ur.y;
      this.interiorRings.push(ring);
    }
    this.multiPoly = multiPoly;
  }
  getSweepEvents() {
    const sweepEvents = this.exteriorRing.getSweepEvents();
    for (let i = 0, iMax = this.interiorRings.length; i < iMax; i++) {
      const ringSweepEvents = this.interiorRings[i].getSweepEvents();
      for (let j = 0, jMax = ringSweepEvents.length; j < jMax; j++) {
        sweepEvents.push(ringSweepEvents[j]);
      }
    }
    return sweepEvents;
  }
};
var MultiPolyIn = class {
  isSubject;
  polys;
  bbox;
  constructor(geom, isSubject) {
    if (!Array.isArray(geom)) {
      throw new Error("Input geometry is not a valid Polygon or MultiPolygon");
    }
    try {
      if (typeof geom[0][0][0] === "number") geom = [geom];
    } catch (ex) {
    }
    this.polys = [];
    this.bbox = {
      ll: { x: new bignumber_default(Number.POSITIVE_INFINITY), y: new bignumber_default(Number.POSITIVE_INFINITY) },
      ur: { x: new bignumber_default(Number.NEGATIVE_INFINITY), y: new bignumber_default(Number.NEGATIVE_INFINITY) }
    };
    for (let i = 0, iMax = geom.length; i < iMax; i++) {
      const poly = new PolyIn(geom[i], this);
      if (poly.bbox.ll.x.isLessThan(this.bbox.ll.x)) this.bbox.ll.x = poly.bbox.ll.x;
      if (poly.bbox.ll.y.isLessThan(this.bbox.ll.y)) this.bbox.ll.y = poly.bbox.ll.y;
      if (poly.bbox.ur.x.isGreaterThan(this.bbox.ur.x)) this.bbox.ur.x = poly.bbox.ur.x;
      if (poly.bbox.ur.y.isGreaterThan(this.bbox.ur.y)) this.bbox.ur.y = poly.bbox.ur.y;
      this.polys.push(poly);
    }
    this.isSubject = isSubject;
  }
  getSweepEvents() {
    const sweepEvents = [];
    for (let i = 0, iMax = this.polys.length; i < iMax; i++) {
      const polySweepEvents = this.polys[i].getSweepEvents();
      for (let j = 0, jMax = polySweepEvents.length; j < jMax; j++) {
        sweepEvents.push(polySweepEvents[j]);
      }
    }
    return sweepEvents;
  }
};
var intersection2 = (geom, ...moreGeoms) => operation_default.run("intersection", geom, moreGeoms);
var difference = (geom, ...moreGeoms) => operation_default.run("difference", geom, moreGeoms);
var setPrecision = precision.set;

// node_modules/@turf/helpers/dist/esm/index.js
var earthRadius = 63710088e-1;
var factors = {
  centimeters: earthRadius * 100,
  centimetres: earthRadius * 100,
  degrees: 360 / (2 * Math.PI),
  feet: earthRadius * 3.28084,
  inches: earthRadius * 39.37,
  kilometers: earthRadius / 1e3,
  kilometres: earthRadius / 1e3,
  meters: earthRadius,
  metres: earthRadius,
  miles: earthRadius / 1609.344,
  millimeters: earthRadius * 1e3,
  millimetres: earthRadius * 1e3,
  nauticalmiles: earthRadius / 1852,
  radians: 1,
  yards: earthRadius * 1.0936
};
function feature(geom, properties, options = {}) {
  const feat = { type: "Feature" };
  if (options.id === 0 || options.id) {
    feat.id = options.id;
  }
  if (options.bbox) {
    feat.bbox = options.bbox;
  }
  feat.properties = properties || {};
  feat.geometry = geom;
  return feat;
}
function point(coordinates, properties, options = {}) {
  if (!coordinates) {
    throw new Error("coordinates is required");
  }
  if (!Array.isArray(coordinates)) {
    throw new Error("coordinates must be an Array");
  }
  if (coordinates.length < 2) {
    throw new Error("coordinates must be at least 2 numbers long");
  }
  if (!isNumber(coordinates[0]) || !isNumber(coordinates[1])) {
    throw new Error("coordinates must contain numbers");
  }
  const geom = {
    type: "Point",
    coordinates
  };
  return feature(geom, properties, options);
}
function lineString(coordinates, properties, options = {}) {
  if (coordinates.length < 2) {
    throw new Error("coordinates must be an array of two or more positions");
  }
  const geom = {
    type: "LineString",
    coordinates
  };
  return feature(geom, properties, options);
}
function featureCollection(features, options = {}) {
  const fc = { type: "FeatureCollection" };
  if (options.id) {
    fc.id = options.id;
  }
  if (options.bbox) {
    fc.bbox = options.bbox;
  }
  fc.features = features;
  return fc;
}
function multiLineString(coordinates, properties, options = {}) {
  const geom = {
    type: "MultiLineString",
    coordinates
  };
  return feature(geom, properties, options);
}
function radiansToLength(radians, units = "kilometers") {
  const factor = factors[units];
  if (!factor) {
    throw new Error(units + " units is invalid");
  }
  return radians * factor;
}
function lengthToRadians(distance2, units = "kilometers") {
  const factor = factors[units];
  if (!factor) {
    throw new Error(units + " units is invalid");
  }
  return distance2 / factor;
}
function radiansToDegrees(radians) {
  const normalisedRadians = radians % (2 * Math.PI);
  return normalisedRadians * 180 / Math.PI;
}
function degreesToRadians(degrees) {
  const normalisedDegrees = degrees % 360;
  return normalisedDegrees * Math.PI / 180;
}
function isNumber(num) {
  return !isNaN(num) && num !== null && !Array.isArray(num);
}
function isObject(input) {
  return input !== null && typeof input === "object" && !Array.isArray(input);
}

// node_modules/@turf/meta/dist/esm/index.js
function coordEach(geojson, callback, excludeWrapCoord) {
  if (geojson === null) return;
  var j, k, l, geometry, stopG, coords, geometryMaybeCollection, wrapShrink = 0, coordIndex = 0, isGeometryCollection, type = geojson.type, isFeatureCollection = type === "FeatureCollection", isFeature = type === "Feature", stop = isFeatureCollection ? geojson.features.length : 1;
  for (var featureIndex = 0; featureIndex < stop; featureIndex++) {
    geometryMaybeCollection = isFeatureCollection ? geojson.features[featureIndex].geometry : isFeature ? geojson.geometry : geojson;
    isGeometryCollection = geometryMaybeCollection ? geometryMaybeCollection.type === "GeometryCollection" : false;
    stopG = isGeometryCollection ? geometryMaybeCollection.geometries.length : 1;
    for (var geomIndex = 0; geomIndex < stopG; geomIndex++) {
      var multiFeatureIndex = 0;
      var geometryIndex = 0;
      geometry = isGeometryCollection ? geometryMaybeCollection.geometries[geomIndex] : geometryMaybeCollection;
      if (geometry === null) continue;
      coords = geometry.coordinates;
      var geomType = geometry.type;
      wrapShrink = excludeWrapCoord && (geomType === "Polygon" || geomType === "MultiPolygon") ? 1 : 0;
      switch (geomType) {
        case null:
          break;
        case "Point":
          if (callback(
            coords,
            coordIndex,
            featureIndex,
            multiFeatureIndex,
            geometryIndex
          ) === false)
            return false;
          coordIndex++;
          multiFeatureIndex++;
          break;
        case "LineString":
        case "MultiPoint":
          for (j = 0; j < coords.length; j++) {
            if (callback(
              coords[j],
              coordIndex,
              featureIndex,
              multiFeatureIndex,
              geometryIndex
            ) === false)
              return false;
            coordIndex++;
            if (geomType === "MultiPoint") multiFeatureIndex++;
          }
          if (geomType === "LineString") multiFeatureIndex++;
          break;
        case "Polygon":
        case "MultiLineString":
          for (j = 0; j < coords.length; j++) {
            for (k = 0; k < coords[j].length - wrapShrink; k++) {
              if (callback(
                coords[j][k],
                coordIndex,
                featureIndex,
                multiFeatureIndex,
                geometryIndex
              ) === false)
                return false;
              coordIndex++;
            }
            if (geomType === "MultiLineString") multiFeatureIndex++;
            if (geomType === "Polygon") geometryIndex++;
          }
          if (geomType === "Polygon") multiFeatureIndex++;
          break;
        case "MultiPolygon":
          for (j = 0; j < coords.length; j++) {
            geometryIndex = 0;
            for (k = 0; k < coords[j].length; k++) {
              for (l = 0; l < coords[j][k].length - wrapShrink; l++) {
                if (callback(
                  coords[j][k][l],
                  coordIndex,
                  featureIndex,
                  multiFeatureIndex,
                  geometryIndex
                ) === false)
                  return false;
                coordIndex++;
              }
              geometryIndex++;
            }
            multiFeatureIndex++;
          }
          break;
        case "GeometryCollection":
          for (j = 0; j < geometry.geometries.length; j++)
            if (coordEach(geometry.geometries[j], callback, excludeWrapCoord) === false)
              return false;
          break;
        default:
          throw new Error("Unknown Geometry Type");
      }
    }
  }
}
function featureEach(geojson, callback) {
  if (geojson.type === "Feature") {
    callback(geojson, 0);
  } else if (geojson.type === "FeatureCollection") {
    for (var i = 0; i < geojson.features.length; i++) {
      if (callback(geojson.features[i], i) === false) break;
    }
  }
}
function featureReduce(geojson, callback, initialValue) {
  var previousValue = initialValue;
  featureEach(geojson, function(currentFeature, featureIndex) {
    if (featureIndex === 0 && initialValue === void 0)
      previousValue = currentFeature;
    else previousValue = callback(previousValue, currentFeature, featureIndex);
  });
  return previousValue;
}
function geomEach(geojson, callback) {
  var i, j, g, geometry, stopG, geometryMaybeCollection, isGeometryCollection, featureProperties, featureBBox, featureId, featureIndex = 0, isFeatureCollection = geojson.type === "FeatureCollection", isFeature = geojson.type === "Feature", stop = isFeatureCollection ? geojson.features.length : 1;
  for (i = 0; i < stop; i++) {
    geometryMaybeCollection = isFeatureCollection ? geojson.features[i].geometry : isFeature ? geojson.geometry : geojson;
    featureProperties = isFeatureCollection ? geojson.features[i].properties : isFeature ? geojson.properties : {};
    featureBBox = isFeatureCollection ? geojson.features[i].bbox : isFeature ? geojson.bbox : void 0;
    featureId = isFeatureCollection ? geojson.features[i].id : isFeature ? geojson.id : void 0;
    isGeometryCollection = geometryMaybeCollection ? geometryMaybeCollection.type === "GeometryCollection" : false;
    stopG = isGeometryCollection ? geometryMaybeCollection.geometries.length : 1;
    for (g = 0; g < stopG; g++) {
      geometry = isGeometryCollection ? geometryMaybeCollection.geometries[g] : geometryMaybeCollection;
      if (geometry === null) {
        if (callback(
          null,
          featureIndex,
          featureProperties,
          featureBBox,
          featureId
        ) === false)
          return false;
        continue;
      }
      switch (geometry.type) {
        case "Point":
        case "LineString":
        case "MultiPoint":
        case "Polygon":
        case "MultiLineString":
        case "MultiPolygon": {
          if (callback(
            geometry,
            featureIndex,
            featureProperties,
            featureBBox,
            featureId
          ) === false)
            return false;
          break;
        }
        case "GeometryCollection": {
          for (j = 0; j < geometry.geometries.length; j++) {
            if (callback(
              geometry.geometries[j],
              featureIndex,
              featureProperties,
              featureBBox,
              featureId
            ) === false)
              return false;
          }
          break;
        }
        default:
          throw new Error("Unknown Geometry Type");
      }
    }
    featureIndex++;
  }
}
function geomReduce(geojson, callback, initialValue) {
  var previousValue = initialValue;
  geomEach(
    geojson,
    function(currentGeometry, featureIndex, featureProperties, featureBBox, featureId) {
      if (featureIndex === 0 && initialValue === void 0)
        previousValue = currentGeometry;
      else
        previousValue = callback(
          previousValue,
          currentGeometry,
          featureIndex,
          featureProperties,
          featureBBox,
          featureId
        );
    }
  );
  return previousValue;
}
function flattenEach(geojson, callback) {
  geomEach(geojson, function(geometry, featureIndex, properties, bbox3, id) {
    var type = geometry === null ? null : geometry.type;
    switch (type) {
      case null:
      case "Point":
      case "LineString":
      case "Polygon":
        if (callback(
          feature(geometry, properties, { bbox: bbox3, id }),
          featureIndex,
          0
        ) === false)
          return false;
        return;
    }
    var geomType;
    switch (type) {
      case "MultiPoint":
        geomType = "Point";
        break;
      case "MultiLineString":
        geomType = "LineString";
        break;
      case "MultiPolygon":
        geomType = "Polygon";
        break;
    }
    for (var multiFeatureIndex = 0; multiFeatureIndex < geometry.coordinates.length; multiFeatureIndex++) {
      var coordinate = geometry.coordinates[multiFeatureIndex];
      var geom = {
        type: geomType,
        coordinates: coordinate
      };
      if (callback(feature(geom, properties), featureIndex, multiFeatureIndex) === false)
        return false;
    }
  });
}
function segmentEach(geojson, callback) {
  flattenEach(geojson, function(feature2, featureIndex, multiFeatureIndex) {
    var segmentIndex = 0;
    if (!feature2.geometry) return;
    var type = feature2.geometry.type;
    if (type === "Point" || type === "MultiPoint") return;
    var previousCoords;
    var previousFeatureIndex = 0;
    var previousMultiIndex = 0;
    var prevGeomIndex = 0;
    if (coordEach(
      feature2,
      function(currentCoord, coordIndex, featureIndexCoord, multiPartIndexCoord, geometryIndex) {
        if (previousCoords === void 0 || featureIndex > previousFeatureIndex || multiPartIndexCoord > previousMultiIndex || geometryIndex > prevGeomIndex) {
          previousCoords = currentCoord;
          previousFeatureIndex = featureIndex;
          previousMultiIndex = multiPartIndexCoord;
          prevGeomIndex = geometryIndex;
          segmentIndex = 0;
          return;
        }
        var currentSegment = lineString(
          [previousCoords, currentCoord],
          feature2.properties
        );
        if (callback(
          currentSegment,
          featureIndex,
          multiFeatureIndex,
          geometryIndex,
          segmentIndex
        ) === false)
          return false;
        segmentIndex++;
        previousCoords = currentCoord;
      }
    ) === false)
      return false;
  });
}
function segmentReduce(geojson, callback, initialValue) {
  var previousValue = initialValue;
  var started = false;
  segmentEach(
    geojson,
    function(currentSegment, featureIndex, multiFeatureIndex, geometryIndex, segmentIndex) {
      if (started === false && initialValue === void 0)
        previousValue = currentSegment;
      else
        previousValue = callback(
          previousValue,
          currentSegment,
          featureIndex,
          multiFeatureIndex,
          geometryIndex,
          segmentIndex
        );
      started = true;
    }
  );
  return previousValue;
}

// node_modules/@turf/area/dist/esm/index.js
function area(geojson) {
  return geomReduce(
    geojson,
    (value, geom) => {
      return value + calculateArea(geom);
    },
    0
  );
}
function calculateArea(geom) {
  let total = 0;
  let i;
  switch (geom.type) {
    case "Polygon":
      return polygonArea(geom.coordinates);
    case "MultiPolygon":
      for (i = 0; i < geom.coordinates.length; i++) {
        total += polygonArea(geom.coordinates[i]);
      }
      return total;
    case "Point":
    case "MultiPoint":
    case "LineString":
    case "MultiLineString":
      return 0;
  }
  return 0;
}
function polygonArea(coords) {
  let total = 0;
  if (coords && coords.length > 0) {
    total += Math.abs(ringArea(coords[0]));
    for (let i = 1; i < coords.length; i++) {
      total -= Math.abs(ringArea(coords[i]));
    }
  }
  return total;
}
var FACTOR = earthRadius * earthRadius / 2;
var PI_OVER_180 = Math.PI / 180;
function ringArea(coords) {
  const coordsLength = coords.length - 1;
  if (coordsLength <= 2) return 0;
  let total = 0;
  let i = 0;
  while (i < coordsLength) {
    const lower = coords[i];
    const middle = coords[i + 1 === coordsLength ? 0 : i + 1];
    const upper = coords[i + 2 >= coordsLength ? (i + 2) % coordsLength : i + 2];
    const lowerX = lower[0] * PI_OVER_180;
    const middleY = middle[1] * PI_OVER_180;
    const upperX = upper[0] * PI_OVER_180;
    total += (upperX - lowerX) * Math.sin(middleY);
    i++;
  }
  return total * FACTOR;
}
var turf_area_default = area;

// src/workers/clipBatch.ts
var import_node_worker_threads = require("node:worker_threads");

// node_modules/robust-predicates/esm/util.js
var epsilon = 11102230246251565e-32;
var splitter = 134217729;
var resulterrbound = (3 + 8 * epsilon) * epsilon;
function sum(elen, e, flen, f, h) {
  let Q, Qnew, hh, bvirt;
  let enow = e[0];
  let fnow = f[0];
  let eindex = 0;
  let findex = 0;
  if (fnow > enow === fnow > -enow) {
    Q = enow;
    enow = e[++eindex];
  } else {
    Q = fnow;
    fnow = f[++findex];
  }
  let hindex = 0;
  if (eindex < elen && findex < flen) {
    if (fnow > enow === fnow > -enow) {
      Qnew = enow + Q;
      hh = Q - (Qnew - enow);
      enow = e[++eindex];
    } else {
      Qnew = fnow + Q;
      hh = Q - (Qnew - fnow);
      fnow = f[++findex];
    }
    Q = Qnew;
    if (hh !== 0) {
      h[hindex++] = hh;
    }
    while (eindex < elen && findex < flen) {
      if (fnow > enow === fnow > -enow) {
        Qnew = Q + enow;
        bvirt = Qnew - Q;
        hh = Q - (Qnew - bvirt) + (enow - bvirt);
        enow = e[++eindex];
      } else {
        Qnew = Q + fnow;
        bvirt = Qnew - Q;
        hh = Q - (Qnew - bvirt) + (fnow - bvirt);
        fnow = f[++findex];
      }
      Q = Qnew;
      if (hh !== 0) {
        h[hindex++] = hh;
      }
    }
  }
  while (eindex < elen) {
    Qnew = Q + enow;
    bvirt = Qnew - Q;
    hh = Q - (Qnew - bvirt) + (enow - bvirt);
    enow = e[++eindex];
    Q = Qnew;
    if (hh !== 0) {
      h[hindex++] = hh;
    }
  }
  while (findex < flen) {
    Qnew = Q + fnow;
    bvirt = Qnew - Q;
    hh = Q - (Qnew - bvirt) + (fnow - bvirt);
    fnow = f[++findex];
    Q = Qnew;
    if (hh !== 0) {
      h[hindex++] = hh;
    }
  }
  if (Q !== 0 || hindex === 0) {
    h[hindex++] = Q;
  }
  return hindex;
}
function estimate(elen, e) {
  let Q = e[0];
  for (let i = 1; i < elen; i++) Q += e[i];
  return Q;
}
function vec(n) {
  return new Float64Array(n);
}

// node_modules/robust-predicates/esm/orient2d.js
var ccwerrboundA = (3 + 16 * epsilon) * epsilon;
var ccwerrboundB = (2 + 12 * epsilon) * epsilon;
var ccwerrboundC = (9 + 64 * epsilon) * epsilon * epsilon;
var B = vec(4);
var C1 = vec(8);
var C2 = vec(12);
var D = vec(16);
var u = vec(4);
function orient2dadapt(ax, ay, bx, by, cx, cy, detsum) {
  let acxtail, acytail, bcxtail, bcytail;
  let bvirt, c, ahi, alo, bhi, blo, _i, _j, _0, s1, s0, t1, t0, u32;
  const acx = ax - cx;
  const bcx = bx - cx;
  const acy = ay - cy;
  const bcy = by - cy;
  s1 = acx * bcy;
  c = splitter * acx;
  ahi = c - (c - acx);
  alo = acx - ahi;
  c = splitter * bcy;
  bhi = c - (c - bcy);
  blo = bcy - bhi;
  s0 = alo * blo - (s1 - ahi * bhi - alo * bhi - ahi * blo);
  t1 = acy * bcx;
  c = splitter * acy;
  ahi = c - (c - acy);
  alo = acy - ahi;
  c = splitter * bcx;
  bhi = c - (c - bcx);
  blo = bcx - bhi;
  t0 = alo * blo - (t1 - ahi * bhi - alo * bhi - ahi * blo);
  _i = s0 - t0;
  bvirt = s0 - _i;
  B[0] = s0 - (_i + bvirt) + (bvirt - t0);
  _j = s1 + _i;
  bvirt = _j - s1;
  _0 = s1 - (_j - bvirt) + (_i - bvirt);
  _i = _0 - t1;
  bvirt = _0 - _i;
  B[1] = _0 - (_i + bvirt) + (bvirt - t1);
  u32 = _j + _i;
  bvirt = u32 - _j;
  B[2] = _j - (u32 - bvirt) + (_i - bvirt);
  B[3] = u32;
  let det = estimate(4, B);
  let errbound = ccwerrboundB * detsum;
  if (det >= errbound || -det >= errbound) {
    return det;
  }
  bvirt = ax - acx;
  acxtail = ax - (acx + bvirt) + (bvirt - cx);
  bvirt = bx - bcx;
  bcxtail = bx - (bcx + bvirt) + (bvirt - cx);
  bvirt = ay - acy;
  acytail = ay - (acy + bvirt) + (bvirt - cy);
  bvirt = by - bcy;
  bcytail = by - (bcy + bvirt) + (bvirt - cy);
  if (acxtail === 0 && acytail === 0 && bcxtail === 0 && bcytail === 0) {
    return det;
  }
  errbound = ccwerrboundC * detsum + resulterrbound * Math.abs(det);
  det += acx * bcytail + bcy * acxtail - (acy * bcxtail + bcx * acytail);
  if (det >= errbound || -det >= errbound) return det;
  s1 = acxtail * bcy;
  c = splitter * acxtail;
  ahi = c - (c - acxtail);
  alo = acxtail - ahi;
  c = splitter * bcy;
  bhi = c - (c - bcy);
  blo = bcy - bhi;
  s0 = alo * blo - (s1 - ahi * bhi - alo * bhi - ahi * blo);
  t1 = acytail * bcx;
  c = splitter * acytail;
  ahi = c - (c - acytail);
  alo = acytail - ahi;
  c = splitter * bcx;
  bhi = c - (c - bcx);
  blo = bcx - bhi;
  t0 = alo * blo - (t1 - ahi * bhi - alo * bhi - ahi * blo);
  _i = s0 - t0;
  bvirt = s0 - _i;
  u[0] = s0 - (_i + bvirt) + (bvirt - t0);
  _j = s1 + _i;
  bvirt = _j - s1;
  _0 = s1 - (_j - bvirt) + (_i - bvirt);
  _i = _0 - t1;
  bvirt = _0 - _i;
  u[1] = _0 - (_i + bvirt) + (bvirt - t1);
  u32 = _j + _i;
  bvirt = u32 - _j;
  u[2] = _j - (u32 - bvirt) + (_i - bvirt);
  u[3] = u32;
  const C1len = sum(4, B, 4, u, C1);
  s1 = acx * bcytail;
  c = splitter * acx;
  ahi = c - (c - acx);
  alo = acx - ahi;
  c = splitter * bcytail;
  bhi = c - (c - bcytail);
  blo = bcytail - bhi;
  s0 = alo * blo - (s1 - ahi * bhi - alo * bhi - ahi * blo);
  t1 = acy * bcxtail;
  c = splitter * acy;
  ahi = c - (c - acy);
  alo = acy - ahi;
  c = splitter * bcxtail;
  bhi = c - (c - bcxtail);
  blo = bcxtail - bhi;
  t0 = alo * blo - (t1 - ahi * bhi - alo * bhi - ahi * blo);
  _i = s0 - t0;
  bvirt = s0 - _i;
  u[0] = s0 - (_i + bvirt) + (bvirt - t0);
  _j = s1 + _i;
  bvirt = _j - s1;
  _0 = s1 - (_j - bvirt) + (_i - bvirt);
  _i = _0 - t1;
  bvirt = _0 - _i;
  u[1] = _0 - (_i + bvirt) + (bvirt - t1);
  u32 = _j + _i;
  bvirt = u32 - _j;
  u[2] = _j - (u32 - bvirt) + (_i - bvirt);
  u[3] = u32;
  const C2len = sum(C1len, C1, 4, u, C2);
  s1 = acxtail * bcytail;
  c = splitter * acxtail;
  ahi = c - (c - acxtail);
  alo = acxtail - ahi;
  c = splitter * bcytail;
  bhi = c - (c - bcytail);
  blo = bcytail - bhi;
  s0 = alo * blo - (s1 - ahi * bhi - alo * bhi - ahi * blo);
  t1 = acytail * bcxtail;
  c = splitter * acytail;
  ahi = c - (c - acytail);
  alo = acytail - ahi;
  c = splitter * bcxtail;
  bhi = c - (c - bcxtail);
  blo = bcxtail - bhi;
  t0 = alo * blo - (t1 - ahi * bhi - alo * bhi - ahi * blo);
  _i = s0 - t0;
  bvirt = s0 - _i;
  u[0] = s0 - (_i + bvirt) + (bvirt - t0);
  _j = s1 + _i;
  bvirt = _j - s1;
  _0 = s1 - (_j - bvirt) + (_i - bvirt);
  _i = _0 - t1;
  bvirt = _0 - _i;
  u[1] = _0 - (_i + bvirt) + (bvirt - t1);
  u32 = _j + _i;
  bvirt = u32 - _j;
  u[2] = _j - (u32 - bvirt) + (_i - bvirt);
  u[3] = u32;
  const Dlen = sum(C2len, C2, 4, u, D);
  return D[Dlen - 1];
}
function orient2d(ax, ay, bx, by, cx, cy) {
  const detleft = (ay - cy) * (bx - cx);
  const detright = (ax - cx) * (by - cy);
  const det = detleft - detright;
  const detsum = Math.abs(detleft + detright);
  if (Math.abs(det) >= ccwerrboundA * detsum) return det;
  return -orient2dadapt(ax, ay, bx, by, cx, cy, detsum);
}

// node_modules/robust-predicates/esm/orient3d.js
var o3derrboundA = (7 + 56 * epsilon) * epsilon;
var o3derrboundB = (3 + 28 * epsilon) * epsilon;
var o3derrboundC = (26 + 288 * epsilon) * epsilon * epsilon;
var bc = vec(4);
var ca = vec(4);
var ab = vec(4);
var at_b = vec(4);
var at_c = vec(4);
var bt_c = vec(4);
var bt_a = vec(4);
var ct_a = vec(4);
var ct_b = vec(4);
var bct = vec(8);
var cat = vec(8);
var abt = vec(8);
var u2 = vec(4);
var _8 = vec(8);
var _8b = vec(8);
var _16 = vec(8);
var _12 = vec(12);
var fin = vec(192);
var fin2 = vec(192);

// node_modules/robust-predicates/esm/incircle.js
var iccerrboundA = (10 + 96 * epsilon) * epsilon;
var iccerrboundB = (4 + 48 * epsilon) * epsilon;
var iccerrboundC = (44 + 576 * epsilon) * epsilon * epsilon;
var bc2 = vec(4);
var ca2 = vec(4);
var ab2 = vec(4);
var aa = vec(4);
var bb = vec(4);
var cc = vec(4);
var u3 = vec(4);
var v = vec(4);
var axtbc = vec(8);
var aytbc = vec(8);
var bxtca = vec(8);
var bytca = vec(8);
var cxtab = vec(8);
var cytab = vec(8);
var abt2 = vec(8);
var bct2 = vec(8);
var cat2 = vec(8);
var abtt = vec(4);
var bctt = vec(4);
var catt = vec(4);
var _82 = vec(8);
var _162 = vec(16);
var _16b = vec(16);
var _16c = vec(16);
var _32 = vec(32);
var _32b = vec(32);
var _48 = vec(48);
var _64 = vec(64);
var fin3 = vec(1152);
var fin22 = vec(1152);

// node_modules/robust-predicates/esm/insphere.js
var isperrboundA = (16 + 224 * epsilon) * epsilon;
var isperrboundB = (5 + 72 * epsilon) * epsilon;
var isperrboundC = (71 + 1408 * epsilon) * epsilon * epsilon;
var ab3 = vec(4);
var bc3 = vec(4);
var cd = vec(4);
var de = vec(4);
var ea = vec(4);
var ac = vec(4);
var bd = vec(4);
var ce = vec(4);
var da = vec(4);
var eb = vec(4);
var abc = vec(24);
var bcd = vec(24);
var cde = vec(24);
var dea = vec(24);
var eab = vec(24);
var abd = vec(24);
var bce = vec(24);
var cda = vec(24);
var deb = vec(24);
var eac = vec(24);
var adet = vec(1152);
var bdet = vec(1152);
var cdet = vec(1152);
var ddet = vec(1152);
var edet = vec(1152);
var abdet = vec(2304);
var cddet = vec(2304);
var cdedet = vec(3456);
var deter = vec(5760);
var _83 = vec(8);
var _8b2 = vec(8);
var _8c = vec(8);
var _163 = vec(16);
var _24 = vec(24);
var _482 = vec(48);
var _48b = vec(48);
var _96 = vec(96);
var _192 = vec(192);
var _384x = vec(384);
var _384y = vec(384);
var _384z = vec(384);
var _768 = vec(768);
var xdet = vec(96);
var ydet = vec(96);
var zdet = vec(96);
var fin4 = vec(1152);

// node_modules/point-in-polygon-hao/dist/esm/index.js
function pointInPolygon(p, polygon) {
  var i;
  var ii;
  var k = 0;
  var f;
  var u1;
  var v1;
  var u22;
  var v2;
  var currentP;
  var nextP;
  var x = p[0];
  var y = p[1];
  var numContours = polygon.length;
  for (i = 0; i < numContours; i++) {
    ii = 0;
    var contour = polygon[i];
    var contourLen = contour.length - 1;
    currentP = contour[0];
    if (currentP[0] !== contour[contourLen][0] && currentP[1] !== contour[contourLen][1]) {
      throw new Error("First and last coordinates in a ring must be the same");
    }
    u1 = currentP[0] - x;
    v1 = currentP[1] - y;
    for (ii; ii < contourLen; ii++) {
      nextP = contour[ii + 1];
      u22 = nextP[0] - x;
      v2 = nextP[1] - y;
      if (v1 === 0 && v2 === 0) {
        if (u22 <= 0 && u1 >= 0 || u1 <= 0 && u22 >= 0) {
          return 0;
        }
      } else if (v2 >= 0 && v1 <= 0 || v2 <= 0 && v1 >= 0) {
        f = orient2d(u1, u22, v1, v2, 0, 0);
        if (f === 0) {
          return 0;
        }
        if (f > 0 && v2 > 0 && v1 <= 0 || f < 0 && v2 <= 0 && v1 > 0) {
          k++;
        }
      }
      currentP = nextP;
      v1 = v2;
      u1 = u22;
    }
  }
  if (k % 2 === 0) {
    return false;
  }
  return true;
}

// node_modules/@turf/invariant/dist/esm/index.js
function getCoord(coord) {
  if (!coord) {
    throw new Error("coord is required");
  }
  if (!Array.isArray(coord)) {
    if (coord.type === "Feature" && coord.geometry !== null && coord.geometry.type === "Point") {
      return [...coord.geometry.coordinates];
    }
    if (coord.type === "Point") {
      return [...coord.coordinates];
    }
  }
  if (Array.isArray(coord) && coord.length >= 2 && !Array.isArray(coord[0]) && !Array.isArray(coord[1])) {
    return [...coord];
  }
  throw new Error("coord must be GeoJSON Point or an Array of numbers");
}
function getCoords(coords) {
  if (Array.isArray(coords)) {
    return coords;
  }
  if (coords.type === "Feature") {
    if (coords.geometry !== null) {
      return coords.geometry.coordinates;
    }
  } else {
    if (coords.coordinates) {
      return coords.coordinates;
    }
  }
  throw new Error(
    "coords must be GeoJSON Feature, Geometry Object or an Array"
  );
}
function getGeom(geojson) {
  if (geojson.type === "Feature") {
    return geojson.geometry;
  }
  return geojson;
}
function getType(geojson, _name) {
  if (geojson.type === "FeatureCollection") {
    return "FeatureCollection";
  }
  if (geojson.type === "GeometryCollection") {
    return "GeometryCollection";
  }
  if (geojson.type === "Feature" && geojson.geometry !== null) {
    return geojson.geometry.type;
  }
  return geojson.type;
}

// node_modules/@turf/boolean-point-in-polygon/dist/esm/index.js
function booleanPointInPolygon(point2, polygon, options = {}) {
  if (!point2) {
    throw new Error("point is required");
  }
  if (!polygon) {
    throw new Error("polygon is required");
  }
  const pt = getCoord(point2);
  const geom = getGeom(polygon);
  const type = geom.type;
  const bbox3 = polygon.bbox;
  let polys = geom.coordinates;
  if (bbox3 && inBBox(pt, bbox3) === false) {
    return false;
  }
  if (type === "Polygon") {
    polys = [polys];
  }
  let result = false;
  for (var i = 0; i < polys.length; ++i) {
    const polyResult = pointInPolygon(pt, polys[i]);
    if (polyResult === 0) return options.ignoreBoundary ? false : true;
    else if (polyResult) result = true;
  }
  return result;
}
function inBBox(pt, bbox3) {
  return bbox3[0] <= pt[0] && bbox3[1] <= pt[1] && bbox3[2] >= pt[0] && bbox3[3] >= pt[1];
}

// node_modules/@turf/line-intersect/dist/esm/index.js
var import_sweepline_intersections = __toESM(require_sweeplineIntersections(), 1);
var sweeplineIntersections = import_sweepline_intersections.default;
function lineIntersect(line1, line2, options = {}) {
  const { removeDuplicates = true, ignoreSelfIntersections = true } = options;
  let features = [];
  if (line1.type === "FeatureCollection")
    features = features.concat(line1.features);
  else if (line1.type === "Feature") features.push(line1);
  else if (line1.type === "LineString" || line1.type === "Polygon" || line1.type === "MultiLineString" || line1.type === "MultiPolygon") {
    features.push(feature(line1));
  }
  if (line2.type === "FeatureCollection")
    features = features.concat(line2.features);
  else if (line2.type === "Feature") features.push(line2);
  else if (line2.type === "LineString" || line2.type === "Polygon" || line2.type === "MultiLineString" || line2.type === "MultiPolygon") {
    features.push(feature(line2));
  }
  const intersections = sweeplineIntersections(
    featureCollection(features),
    ignoreSelfIntersections
  );
  let results = [];
  if (removeDuplicates) {
    const unique = {};
    intersections.forEach((intersection3) => {
      const key = intersection3.join(",");
      if (!unique[key]) {
        unique[key] = true;
        results.push(intersection3);
      }
    });
  } else {
    results = intersections;
  }
  return featureCollection(results.map((r) => point(r)));
}

// node_modules/@turf/polygon-to-line/dist/esm/index.js
function polygonToLine(poly, options = {}) {
  const geom = getGeom(poly);
  if (!options.properties && poly.type === "Feature") {
    options.properties = poly.properties;
  }
  switch (geom.type) {
    case "Polygon":
      return singlePolygonToLine(geom, options);
    case "MultiPolygon":
      return multiPolygonToLine(geom, options);
    default:
      throw new Error("invalid poly");
  }
}
function singlePolygonToLine(poly, options = {}) {
  const geom = getGeom(poly);
  const coords = geom.coordinates;
  const properties = options.properties ? options.properties : poly.type === "Feature" ? poly.properties : {};
  return coordsToLine(coords, properties);
}
function multiPolygonToLine(multiPoly, options = {}) {
  const geom = getGeom(multiPoly);
  const coords = geom.coordinates;
  const properties = options.properties ? options.properties : multiPoly.type === "Feature" ? multiPoly.properties : {};
  const lines = [];
  coords.forEach((coord) => {
    lines.push(coordsToLine(coord, properties));
  });
  return featureCollection(lines);
}
function coordsToLine(coords, properties) {
  if (coords.length > 1) {
    return multiLineString(coords, properties);
  }
  return lineString(coords[0], properties);
}

// node_modules/@turf/boolean-disjoint/dist/esm/index.js
function booleanDisjoint(feature1, feature2, {
  ignoreSelfIntersections = true
} = { ignoreSelfIntersections: true }) {
  let bool = true;
  flattenEach(feature1, (flatten1) => {
    flattenEach(feature2, (flatten2) => {
      if (bool === false) {
        return false;
      }
      bool = disjoint(
        flatten1.geometry,
        flatten2.geometry,
        ignoreSelfIntersections
      );
    });
  });
  return bool;
}
function disjoint(geom1, geom2, ignoreSelfIntersections) {
  switch (geom1.type) {
    case "Point":
      switch (geom2.type) {
        case "Point":
          return !compareCoords(geom1.coordinates, geom2.coordinates);
        case "LineString":
          return !isPointOnLine(geom2, geom1);
        case "Polygon":
          return !booleanPointInPolygon(geom1, geom2);
      }
      break;
    case "LineString":
      switch (geom2.type) {
        case "Point":
          return !isPointOnLine(geom1, geom2);
        case "LineString":
          return !isLineOnLine(geom1, geom2, ignoreSelfIntersections);
        case "Polygon":
          return !isLineInPoly(geom2, geom1, ignoreSelfIntersections);
      }
      break;
    case "Polygon":
      switch (geom2.type) {
        case "Point":
          return !booleanPointInPolygon(geom2, geom1);
        case "LineString":
          return !isLineInPoly(geom1, geom2, ignoreSelfIntersections);
        case "Polygon":
          return !isPolyInPoly(geom2, geom1, ignoreSelfIntersections);
      }
  }
  return false;
}
function isPointOnLine(lineString2, pt) {
  for (let i = 0; i < lineString2.coordinates.length - 1; i++) {
    if (isPointOnLineSegment(
      lineString2.coordinates[i],
      lineString2.coordinates[i + 1],
      pt.coordinates
    )) {
      return true;
    }
  }
  return false;
}
function isLineOnLine(lineString1, lineString2, ignoreSelfIntersections) {
  const doLinesIntersect = lineIntersect(lineString1, lineString2, {
    ignoreSelfIntersections
  });
  if (doLinesIntersect.features.length > 0) {
    return true;
  }
  return false;
}
function isLineInPoly(polygon, lineString2, ignoreSelfIntersections) {
  for (const coord of lineString2.coordinates) {
    if (booleanPointInPolygon(coord, polygon)) {
      return true;
    }
  }
  const doLinesIntersect = lineIntersect(lineString2, polygonToLine(polygon), {
    ignoreSelfIntersections
  });
  if (doLinesIntersect.features.length > 0) {
    return true;
  }
  return false;
}
function isPolyInPoly(feature1, feature2, ignoreSelfIntersections) {
  for (const coord1 of feature1.coordinates[0]) {
    if (booleanPointInPolygon(coord1, feature2)) {
      return true;
    }
  }
  for (const coord2 of feature2.coordinates[0]) {
    if (booleanPointInPolygon(coord2, feature1)) {
      return true;
    }
  }
  const doLinesIntersect = lineIntersect(
    polygonToLine(feature1),
    polygonToLine(feature2),
    { ignoreSelfIntersections }
  );
  if (doLinesIntersect.features.length > 0) {
    return true;
  }
  return false;
}
function isPointOnLineSegment(lineSegmentStart, lineSegmentEnd, pt) {
  const dxc = pt[0] - lineSegmentStart[0];
  const dyc = pt[1] - lineSegmentStart[1];
  const dxl = lineSegmentEnd[0] - lineSegmentStart[0];
  const dyl = lineSegmentEnd[1] - lineSegmentStart[1];
  const cross2 = dxc * dyl - dyc * dxl;
  if (cross2 !== 0) {
    return false;
  }
  if (Math.abs(dxl) >= Math.abs(dyl)) {
    if (dxl > 0) {
      return lineSegmentStart[0] <= pt[0] && pt[0] <= lineSegmentEnd[0];
    } else {
      return lineSegmentEnd[0] <= pt[0] && pt[0] <= lineSegmentStart[0];
    }
  } else if (dyl > 0) {
    return lineSegmentStart[1] <= pt[1] && pt[1] <= lineSegmentEnd[1];
  } else {
    return lineSegmentEnd[1] <= pt[1] && pt[1] <= lineSegmentStart[1];
  }
}
function compareCoords(pair1, pair2) {
  return pair1[0] === pair2[0] && pair1[1] === pair2[1];
}
var index_default = booleanDisjoint;

// node_modules/@turf/boolean-intersects/dist/esm/index.js
function booleanIntersects(feature1, feature2, {
  ignoreSelfIntersections = true
} = {}) {
  let bool = false;
  flattenEach(feature1, (flatten1) => {
    flattenEach(feature2, (flatten2) => {
      if (bool === true) {
        return true;
      }
      bool = !booleanDisjoint(flatten1.geometry, flatten2.geometry, {
        ignoreSelfIntersections
      });
    });
  });
  return bool;
}
var turf_boolean_intersects_default = booleanIntersects;

// node_modules/@turf/distance/dist/esm/index.js
function distance(from, to, options = {}) {
  var coordinates1 = getCoord(from);
  var coordinates2 = getCoord(to);
  var dLat = degreesToRadians(coordinates2[1] - coordinates1[1]);
  var dLon = degreesToRadians(coordinates2[0] - coordinates1[0]);
  var lat1 = degreesToRadians(coordinates1[1]);
  var lat2 = degreesToRadians(coordinates2[1]);
  var a = Math.pow(Math.sin(dLat / 2), 2) + Math.pow(Math.sin(dLon / 2), 2) * Math.cos(lat1) * Math.cos(lat2);
  return radiansToLength(
    2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)),
    options.units
  );
}

// node_modules/@turf/length/dist/esm/index.js
function length2(geojson, options = {}) {
  return segmentReduce(
    geojson,
    (previousValue, segment) => {
      const coords = segment.geometry.coordinates;
      return previousValue + distance(coords[0], coords[1], options);
    },
    0
  );
}
var index_default2 = length2;

// node_modules/@turf/bbox/dist/esm/index.js
function bbox(geojson, options = {}) {
  if (geojson.bbox != null && true !== options.recompute) {
    return geojson.bbox;
  }
  const result = [Infinity, Infinity, -Infinity, -Infinity];
  coordEach(geojson, (coord) => {
    if (result[0] > coord[0]) {
      result[0] = coord[0];
    }
    if (result[1] > coord[1]) {
      result[1] = coord[1];
    }
    if (result[2] < coord[0]) {
      result[2] = coord[0];
    }
    if (result[3] < coord[1]) {
      result[3] = coord[1];
    }
  });
  return result;
}

// node_modules/@turf/boolean-point-on-line/dist/esm/index.js
function booleanPointOnLine(pt, line, options = {}) {
  const ptCoords = getCoord(pt);
  const lineCoords = getCoords(line);
  for (let i = 0; i < lineCoords.length - 1; i++) {
    let ignoreBoundary = false;
    if (options.ignoreEndVertices) {
      if (i === 0) {
        ignoreBoundary = "start";
      }
      if (i === lineCoords.length - 2) {
        ignoreBoundary = "end";
      }
      if (i === 0 && i + 1 === lineCoords.length - 1) {
        ignoreBoundary = "both";
      }
    }
    if (isPointOnLineSegment2(
      lineCoords[i],
      lineCoords[i + 1],
      ptCoords,
      ignoreBoundary,
      typeof options.epsilon === "undefined" ? null : options.epsilon
    )) {
      return true;
    }
  }
  return false;
}
function isPointOnLineSegment2(lineSegmentStart, lineSegmentEnd, pt, excludeBoundary, epsilon2) {
  const x = pt[0];
  const y = pt[1];
  const x1 = lineSegmentStart[0];
  const y1 = lineSegmentStart[1];
  const x2 = lineSegmentEnd[0];
  const y2 = lineSegmentEnd[1];
  const dxc = pt[0] - x1;
  const dyc = pt[1] - y1;
  const dxl = x2 - x1;
  const dyl = y2 - y1;
  const cross2 = dxc * dyl - dyc * dxl;
  if (epsilon2 !== null) {
    if (Math.abs(cross2) > epsilon2) {
      return false;
    }
  } else if (cross2 !== 0) {
    return false;
  }
  if (Math.abs(dxl) === Math.abs(dyl) && Math.abs(dxl) === 0) {
    if (excludeBoundary) {
      return false;
    }
    if (pt[0] === lineSegmentStart[0] && pt[1] === lineSegmentStart[1]) {
      return true;
    } else {
      return false;
    }
  }
  if (!excludeBoundary) {
    if (Math.abs(dxl) >= Math.abs(dyl)) {
      return dxl > 0 ? x1 <= x && x <= x2 : x2 <= x && x <= x1;
    }
    return dyl > 0 ? y1 <= y && y <= y2 : y2 <= y && y <= y1;
  } else if (excludeBoundary === "start") {
    if (Math.abs(dxl) >= Math.abs(dyl)) {
      return dxl > 0 ? x1 < x && x <= x2 : x2 <= x && x < x1;
    }
    return dyl > 0 ? y1 < y && y <= y2 : y2 <= y && y < y1;
  } else if (excludeBoundary === "end") {
    if (Math.abs(dxl) >= Math.abs(dyl)) {
      return dxl > 0 ? x1 <= x && x < x2 : x2 < x && x <= x1;
    }
    return dyl > 0 ? y1 <= y && y < y2 : y2 < y && y <= y1;
  } else if (excludeBoundary === "both") {
    if (Math.abs(dxl) >= Math.abs(dyl)) {
      return dxl > 0 ? x1 < x && x < x2 : x2 < x && x < x1;
    }
    return dyl > 0 ? y1 < y && y < y2 : y2 < y && y < y1;
  }
  return false;
}

// node_modules/@turf/boolean-within/dist/esm/index.js
function booleanWithin(feature1, feature2) {
  var geom1 = getGeom(feature1);
  var geom2 = getGeom(feature2);
  var type1 = geom1.type;
  var type2 = geom2.type;
  switch (type1) {
    case "Point":
      switch (type2) {
        case "MultiPoint":
          return isPointInMultiPoint(geom1, geom2);
        case "LineString":
          return booleanPointOnLine(geom1, geom2, { ignoreEndVertices: true });
        case "Polygon":
        case "MultiPolygon":
          return booleanPointInPolygon(geom1, geom2, { ignoreBoundary: true });
        default:
          throw new Error("feature2 " + type2 + " geometry not supported");
      }
    case "MultiPoint":
      switch (type2) {
        case "MultiPoint":
          return isMultiPointInMultiPoint(geom1, geom2);
        case "LineString":
          return isMultiPointOnLine(geom1, geom2);
        case "Polygon":
        case "MultiPolygon":
          return isMultiPointInPoly(geom1, geom2);
        default:
          throw new Error("feature2 " + type2 + " geometry not supported");
      }
    case "LineString":
      switch (type2) {
        case "LineString":
          return isLineOnLine2(geom1, geom2);
        case "Polygon":
        case "MultiPolygon":
          return isLineInPoly2(geom1, geom2);
        default:
          throw new Error("feature2 " + type2 + " geometry not supported");
      }
    case "Polygon":
      switch (type2) {
        case "Polygon":
        case "MultiPolygon":
          return isPolyInPoly2(geom1, geom2);
        default:
          throw new Error("feature2 " + type2 + " geometry not supported");
      }
    default:
      throw new Error("feature1 " + type1 + " geometry not supported");
  }
}
function isPointInMultiPoint(point2, multiPoint) {
  var i;
  var output = false;
  for (i = 0; i < multiPoint.coordinates.length; i++) {
    if (compareCoords2(multiPoint.coordinates[i], point2.coordinates)) {
      output = true;
      break;
    }
  }
  return output;
}
function isMultiPointInMultiPoint(multiPoint1, multiPoint2) {
  for (var i = 0; i < multiPoint1.coordinates.length; i++) {
    var anyMatch = false;
    for (var i2 = 0; i2 < multiPoint2.coordinates.length; i2++) {
      if (compareCoords2(multiPoint1.coordinates[i], multiPoint2.coordinates[i2])) {
        anyMatch = true;
      }
    }
    if (!anyMatch) {
      return false;
    }
  }
  return true;
}
function isMultiPointOnLine(multiPoint, lineString2) {
  var foundInsidePoint = false;
  for (var i = 0; i < multiPoint.coordinates.length; i++) {
    if (!booleanPointOnLine(multiPoint.coordinates[i], lineString2)) {
      return false;
    }
    if (!foundInsidePoint) {
      foundInsidePoint = booleanPointOnLine(
        multiPoint.coordinates[i],
        lineString2,
        { ignoreEndVertices: true }
      );
    }
  }
  return foundInsidePoint;
}
function isMultiPointInPoly(multiPoint, polygon) {
  var output = true;
  var oneInside = false;
  var isInside = false;
  for (var i = 0; i < multiPoint.coordinates.length; i++) {
    isInside = booleanPointInPolygon(multiPoint.coordinates[i], polygon);
    if (!isInside) {
      output = false;
      break;
    }
    if (!oneInside) {
      isInside = booleanPointInPolygon(multiPoint.coordinates[i], polygon, {
        ignoreBoundary: true
      });
    }
  }
  return output && isInside;
}
function isLineOnLine2(lineString1, lineString2) {
  for (var i = 0; i < lineString1.coordinates.length; i++) {
    if (!booleanPointOnLine(lineString1.coordinates[i], lineString2)) {
      return false;
    }
  }
  return true;
}
function isLineInPoly2(linestring, polygon) {
  var polyBbox = bbox(polygon);
  var lineBbox = bbox(linestring);
  if (!doBBoxOverlap(polyBbox, lineBbox)) {
    return false;
  }
  var foundInsidePoint = false;
  for (var i = 0; i < linestring.coordinates.length; i++) {
    if (!booleanPointInPolygon(linestring.coordinates[i], polygon)) {
      return false;
    }
    if (!foundInsidePoint) {
      foundInsidePoint = booleanPointInPolygon(
        linestring.coordinates[i],
        polygon,
        { ignoreBoundary: true }
      );
    }
    if (!foundInsidePoint && i < linestring.coordinates.length - 1) {
      var midpoint = getMidpoint(
        linestring.coordinates[i],
        linestring.coordinates[i + 1]
      );
      foundInsidePoint = booleanPointInPolygon(midpoint, polygon, {
        ignoreBoundary: true
      });
    }
  }
  return foundInsidePoint;
}
function isPolyInPoly2(geometry1, geometry2) {
  var poly1Bbox = bbox(geometry1);
  var poly2Bbox = bbox(geometry2);
  if (!doBBoxOverlap(poly2Bbox, poly1Bbox)) {
    return false;
  }
  for (var i = 0; i < geometry1.coordinates[0].length; i++) {
    if (!booleanPointInPolygon(geometry1.coordinates[0][i], geometry2)) {
      return false;
    }
  }
  return true;
}
function doBBoxOverlap(bbox1, bbox22) {
  if (bbox1[0] > bbox22[0]) return false;
  if (bbox1[2] < bbox22[2]) return false;
  if (bbox1[1] > bbox22[1]) return false;
  if (bbox1[3] < bbox22[3]) return false;
  return true;
}
function compareCoords2(pair1, pair2) {
  return pair1[0] === pair2[0] && pair1[1] === pair2[1];
}
function getMidpoint(pair1, pair2) {
  return [(pair1[0] + pair2[0]) / 2, (pair1[1] + pair2[1]) / 2];
}
var index_default3 = booleanWithin;

// node_modules/@turf/geojson-rbush/dist/esm/index.js
var import_rbush = __toESM(require_rbush(), 1);
function geojsonRbush(maxEntries) {
  var tree = new import_rbush.default(maxEntries);
  tree.insert = function(feature2) {
    if (feature2.type !== "Feature") throw new Error("invalid feature");
    feature2.bbox = feature2.bbox ? feature2.bbox : bbox(feature2);
    return import_rbush.default.prototype.insert.call(this, feature2);
  };
  tree.load = function(features) {
    var load = [];
    if (Array.isArray(features)) {
      features.forEach(function(feature2) {
        if (feature2.type !== "Feature") throw new Error("invalid features");
        feature2.bbox = feature2.bbox ? feature2.bbox : bbox(feature2);
        load.push(feature2);
      });
    } else {
      featureEach(features, function(feature2) {
        if (feature2.type !== "Feature") throw new Error("invalid features");
        feature2.bbox = feature2.bbox ? feature2.bbox : bbox(feature2);
        load.push(feature2);
      });
    }
    return import_rbush.default.prototype.load.call(this, load);
  };
  tree.remove = function(feature2, equals) {
    if (feature2.type !== "Feature") throw new Error("invalid feature");
    feature2.bbox = feature2.bbox ? feature2.bbox : bbox(feature2);
    return import_rbush.default.prototype.remove.call(this, feature2, equals);
  };
  tree.clear = function() {
    return import_rbush.default.prototype.clear.call(this);
  };
  tree.search = function(geojson) {
    var features = import_rbush.default.prototype.search.call(this, this.toBBox(geojson));
    return featureCollection(features);
  };
  tree.collides = function(geojson) {
    return import_rbush.default.prototype.collides.call(this, this.toBBox(geojson));
  };
  tree.all = function() {
    var features = import_rbush.default.prototype.all.call(this);
    return featureCollection(features);
  };
  tree.toJSON = function() {
    return import_rbush.default.prototype.toJSON.call(this);
  };
  tree.fromJSON = function(json) {
    return import_rbush.default.prototype.fromJSON.call(this, json);
  };
  tree.toBBox = function(geojson) {
    var bbox3;
    if (geojson.bbox) bbox3 = geojson.bbox;
    else if (Array.isArray(geojson) && geojson.length === 4) bbox3 = geojson;
    else if (Array.isArray(geojson) && geojson.length === 6)
      bbox3 = [geojson[0], geojson[1], geojson[3], geojson[4]];
    else if (geojson.type === "Feature") bbox3 = bbox(geojson);
    else if (geojson.type === "FeatureCollection") bbox3 = bbox(geojson);
    else throw new Error("invalid geojson");
    return {
      minX: bbox3[0],
      minY: bbox3[1],
      maxX: bbox3[2],
      maxY: bbox3[3]
    };
  };
  return tree;
}

// node_modules/@turf/truncate/dist/esm/index.js
function truncate(geojson, options) {
  options = options != null ? options : {};
  if (!isObject(options)) throw new Error("options is invalid");
  var precision2 = options.precision;
  var coordinates = options.coordinates;
  var mutate = options.mutate;
  precision2 = precision2 === void 0 || precision2 === null || isNaN(precision2) ? 6 : precision2;
  coordinates = coordinates === void 0 || coordinates === null || isNaN(coordinates) ? 3 : coordinates;
  if (!geojson) throw new Error("<geojson> is required");
  if (typeof precision2 !== "number")
    throw new Error("<precision> must be a number");
  if (typeof coordinates !== "number")
    throw new Error("<coordinates> must be a number");
  if (mutate === false || mutate === void 0)
    geojson = JSON.parse(JSON.stringify(geojson));
  var factor = Math.pow(10, precision2);
  coordEach(geojson, function(coords) {
    truncateCoords(coords, factor, coordinates);
  });
  return geojson;
}
function truncateCoords(coords, factor, coordinates) {
  if (coords.length > coordinates) coords.splice(coordinates, coords.length);
  for (var i = 0; i < coords.length; i++) {
    coords[i] = Math.round(coords[i] * factor) / factor;
  }
  return coords;
}

// node_modules/@turf/line-segment/dist/esm/index.js
function lineSegment(geojson) {
  if (!geojson) {
    throw new Error("geojson is required");
  }
  const results = [];
  flattenEach(geojson, (feature2) => {
    lineSegmentFeature(feature2, results);
  });
  return featureCollection(results);
}
function lineSegmentFeature(geojson, results) {
  let coords = [];
  const geometry = geojson.geometry;
  if (geometry !== null) {
    switch (geometry.type) {
      case "Polygon":
        coords = getCoords(geometry);
        break;
      case "LineString":
        coords = [getCoords(geometry)];
    }
    coords.forEach((coord) => {
      const segments = createSegments(coord, geojson.properties);
      segments.forEach((segment) => {
        segment.id = results.length;
        results.push(segment);
      });
    });
  }
}
function createSegments(coords, properties) {
  const segments = [];
  coords.reduce((previousCoords, currentCoords) => {
    const segment = lineString([previousCoords, currentCoords], properties);
    segment.bbox = bbox2(previousCoords, currentCoords);
    segments.push(segment);
    return currentCoords;
  });
  return segments;
}
function bbox2(coords1, coords2) {
  const x1 = coords1[0];
  const y1 = coords1[1];
  const x2 = coords2[0];
  const y2 = coords2[1];
  const west = x1 < x2 ? x1 : x2;
  const south = y1 < y2 ? y1 : y2;
  const east = x1 > x2 ? x1 : x2;
  const north = y1 > y2 ? y1 : y2;
  return [west, south, east, north];
}

// node_modules/@turf/nearest-point-on-line/dist/esm/index.js
var __defProp2 = Object.defineProperty;
var __defProps = Object.defineProperties;
var __getOwnPropDescs = Object.getOwnPropertyDescriptors;
var __getOwnPropSymbols = Object.getOwnPropertySymbols;
var __hasOwnProp2 = Object.prototype.hasOwnProperty;
var __propIsEnum = Object.prototype.propertyIsEnumerable;
var __defNormalProp = (obj, key, value) => key in obj ? __defProp2(obj, key, { enumerable: true, configurable: true, writable: true, value }) : obj[key] = value;
var __spreadValues = (a, b) => {
  for (var prop in b || (b = {}))
    if (__hasOwnProp2.call(b, prop))
      __defNormalProp(a, prop, b[prop]);
  if (__getOwnPropSymbols)
    for (var prop of __getOwnPropSymbols(b)) {
      if (__propIsEnum.call(b, prop))
        __defNormalProp(a, prop, b[prop]);
    }
  return a;
};
var __spreadProps = (a, b) => __defProps(a, __getOwnPropDescs(b));
function nearestPointOnLine(lines, pt, options = {}) {
  if (!lines || !pt) {
    throw new Error("lines and pt are required arguments");
  }
  const ptPos = getCoord(pt);
  let closestPt = point([Infinity, Infinity], {
    dist: Infinity,
    index: -1,
    multiFeatureIndex: -1,
    location: -1
  });
  let length3 = 0;
  flattenEach(
    lines,
    function(line, _featureIndex, multiFeatureIndex) {
      const coords = getCoords(line);
      for (let i = 0; i < coords.length - 1; i++) {
        const start = point(coords[i]);
        const startPos = getCoord(start);
        const stop = point(coords[i + 1]);
        const stopPos = getCoord(stop);
        const sectionLength = distance(start, stop, options);
        let intersectPos;
        let wasEnd;
        if (stopPos[0] === ptPos[0] && stopPos[1] === ptPos[1]) {
          [intersectPos, wasEnd] = [stopPos, true];
        } else if (startPos[0] === ptPos[0] && startPos[1] === ptPos[1]) {
          [intersectPos, wasEnd] = [startPos, false];
        } else {
          [intersectPos, wasEnd] = nearestPointOnSegment(
            startPos,
            stopPos,
            ptPos
          );
        }
        const intersectPt = point(intersectPos, {
          dist: distance(pt, intersectPos, options),
          multiFeatureIndex,
          location: length3 + distance(start, intersectPos, options)
        });
        if (intersectPt.properties.dist < closestPt.properties.dist) {
          closestPt = __spreadProps(__spreadValues({}, intersectPt), {
            properties: __spreadProps(__spreadValues({}, intersectPt.properties), {
              // Legacy behaviour where index progresses to next segment # if we
              // went with the end point this iteration.
              index: wasEnd ? i + 1 : i
            })
          });
        }
        length3 += sectionLength;
      }
    }
  );
  return closestPt;
}
function dot(v1, v2) {
  const [v1x, v1y, v1z] = v1;
  const [v2x, v2y, v2z] = v2;
  return v1x * v2x + v1y * v2y + v1z * v2z;
}
function cross(v1, v2) {
  const [v1x, v1y, v1z] = v1;
  const [v2x, v2y, v2z] = v2;
  return [v1y * v2z - v1z * v2y, v1z * v2x - v1x * v2z, v1x * v2y - v1y * v2x];
}
function magnitude(v2) {
  return Math.sqrt(Math.pow(v2[0], 2) + Math.pow(v2[1], 2) + Math.pow(v2[2], 2));
}
function normalize(v2) {
  const mag = magnitude(v2);
  return [v2[0] / mag, v2[1] / mag, v2[2] / mag];
}
function lngLatToVector(a) {
  const lat = degreesToRadians(a[1]);
  const lng = degreesToRadians(a[0]);
  return [
    Math.cos(lat) * Math.cos(lng),
    Math.cos(lat) * Math.sin(lng),
    Math.sin(lat)
  ];
}
function vectorToLngLat(v2) {
  const [x, y, z] = v2;
  const zClamp = Math.min(Math.max(z, -1), 1);
  const lat = radiansToDegrees(Math.asin(zClamp));
  const lng = radiansToDegrees(Math.atan2(y, x));
  return [lng, lat];
}
function nearestPointOnSegment(posA, posB, posC) {
  const A = lngLatToVector(posA);
  const B2 = lngLatToVector(posB);
  const C = lngLatToVector(posC);
  const segmentAxis = cross(A, B2);
  if (segmentAxis[0] === 0 && segmentAxis[1] === 0 && segmentAxis[2] === 0) {
    if (dot(A, B2) > 0) {
      return [[...posB], true];
    } else {
      return [[...posC], false];
    }
  }
  const targetAxis = cross(segmentAxis, C);
  if (targetAxis[0] === 0 && targetAxis[1] === 0 && targetAxis[2] === 0) {
    return [[...posB], true];
  }
  const intersectionAxis = cross(targetAxis, segmentAxis);
  const I1 = normalize(intersectionAxis);
  const I2 = [-I1[0], -I1[1], -I1[2]];
  const I = dot(C, I1) > dot(C, I2) ? I1 : I2;
  const segmentAxisNorm = normalize(segmentAxis);
  const cmpAI = dot(cross(A, I), segmentAxisNorm);
  const cmpIB = dot(cross(I, B2), segmentAxisNorm);
  if (cmpAI >= 0 && cmpIB >= 0) {
    return [vectorToLngLat(I), false];
  }
  if (dot(A, C) > dot(B2, C)) {
    return [[...posA], false];
  } else {
    return [[...posB], true];
  }
}

// node_modules/@turf/line-split/dist/esm/index.js
function lineSplit(line, splitter2) {
  if (!line) throw new Error("line is required");
  if (!splitter2) throw new Error("splitter is required");
  var lineType = getType(line);
  var splitterType = getType(splitter2);
  if (lineType !== "LineString") throw new Error("line must be LineString");
  if (splitterType === "FeatureCollection")
    throw new Error("splitter cannot be a FeatureCollection");
  if (splitterType === "GeometryCollection")
    throw new Error("splitter cannot be a GeometryCollection");
  var truncatedSplitter = truncate(splitter2, { precision: 7 });
  switch (splitterType) {
    case "Point":
      return splitLineWithPoint(line, truncatedSplitter);
    case "MultiPoint":
      return splitLineWithPoints(line, truncatedSplitter);
    case "LineString":
    case "MultiLineString":
    case "Polygon":
    case "MultiPolygon":
      return splitLineWithPoints(
        line,
        lineIntersect(line, truncatedSplitter, {
          ignoreSelfIntersections: true
        })
      );
  }
}
function splitLineWithPoints(line, splitter2) {
  var results = [];
  var tree = geojsonRbush();
  flattenEach(splitter2, function(point2) {
    results.forEach(function(feature2, index) {
      feature2.id = index;
    });
    if (!results.length) {
      results = splitLineWithPoint(line, point2).features;
      tree.load(featureCollection(results));
    } else {
      var search = tree.search(point2);
      if (search.features.length) {
        var closestLine = findClosestFeature(point2, search);
        results = results.filter(function(feature2) {
          return feature2.id !== closestLine.id;
        });
        tree.remove(closestLine);
        featureEach(splitLineWithPoint(closestLine, point2), function(line2) {
          results.push(line2);
          tree.insert(line2);
        });
      }
    }
  });
  return featureCollection(results);
}
function splitLineWithPoint(line, splitter2) {
  var results = [];
  var startPoint = getCoords(line)[0];
  var endPoint = getCoords(line)[line.geometry.coordinates.length - 1];
  if (pointsEquals(startPoint, getCoord(splitter2)) || pointsEquals(endPoint, getCoord(splitter2)))
    return featureCollection([line]);
  var tree = geojsonRbush();
  var segments = lineSegment(line);
  tree.load(segments);
  var search = tree.search(splitter2);
  if (!search.features.length) return featureCollection([line]);
  var closestSegment = findClosestFeature(splitter2, search);
  var initialValue = [startPoint];
  var lastCoords = featureReduce(
    segments,
    function(previous, current, index) {
      var currentCoords = getCoords(current)[1];
      var splitterCoords = getCoord(splitter2);
      if (index === closestSegment.id) {
        previous.push(splitterCoords);
        results.push(lineString(previous));
        if (pointsEquals(splitterCoords, currentCoords))
          return [splitterCoords];
        return [splitterCoords, currentCoords];
      } else {
        previous.push(currentCoords);
        return previous;
      }
    },
    initialValue
  );
  if (lastCoords.length > 1) {
    results.push(lineString(lastCoords));
  }
  return featureCollection(results);
}
function findClosestFeature(point2, lines) {
  if (!lines.features.length) throw new Error("lines must contain features");
  if (lines.features.length === 1) return lines.features[0];
  var closestFeature;
  var closestDistance = Infinity;
  featureEach(lines, function(segment) {
    var pt = nearestPointOnLine(segment, point2);
    var dist = pt.properties.dist;
    if (dist < closestDistance) {
      closestFeature = segment;
      closestDistance = dist;
    }
  });
  return closestFeature;
}
function pointsEquals(pt1, pt2) {
  return pt1[0] === pt2[0] && pt1[1] === pt2[1];
}
var index_default4 = lineSplit;

// node_modules/@turf/bearing/dist/esm/index.js
function bearing(start, end, options = {}) {
  if (options.final === true) {
    return calculateFinalBearing(start, end);
  }
  const coordinates1 = getCoord(start);
  const coordinates2 = getCoord(end);
  const lon1 = degreesToRadians(coordinates1[0]);
  const lon2 = degreesToRadians(coordinates2[0]);
  const lat1 = degreesToRadians(coordinates1[1]);
  const lat2 = degreesToRadians(coordinates2[1]);
  const a = Math.sin(lon2 - lon1) * Math.cos(lat2);
  const b = Math.cos(lat1) * Math.sin(lat2) - Math.sin(lat1) * Math.cos(lat2) * Math.cos(lon2 - lon1);
  return radiansToDegrees(Math.atan2(a, b));
}
function calculateFinalBearing(start, end) {
  let bear = bearing(end, start);
  bear = (bear + 180) % 360;
  return bear;
}

// node_modules/@turf/destination/dist/esm/index.js
function destination(origin, distance2, bearing2, options = {}) {
  const coordinates1 = getCoord(origin);
  const longitude1 = degreesToRadians(coordinates1[0]);
  const latitude1 = degreesToRadians(coordinates1[1]);
  const bearingRad = degreesToRadians(bearing2);
  const radians = lengthToRadians(distance2, options.units);
  const latitude2 = Math.asin(
    Math.sin(latitude1) * Math.cos(radians) + Math.cos(latitude1) * Math.sin(radians) * Math.cos(bearingRad)
  );
  const longitude2 = longitude1 + Math.atan2(
    Math.sin(bearingRad) * Math.sin(radians) * Math.cos(latitude1),
    Math.cos(radians) - Math.sin(latitude1) * Math.sin(latitude2)
  );
  const lng = radiansToDegrees(longitude2);
  const lat = radiansToDegrees(latitude2);
  if (coordinates1[2] !== void 0) {
    return point([lng, lat, coordinates1[2]], options.properties);
  }
  return point([lng, lat], options.properties);
}

// node_modules/@turf/along/dist/esm/index.js
function along(line, distance2, options = {}) {
  const geom = getGeom(line);
  const coords = geom.coordinates;
  let travelled = 0;
  for (let i = 0; i < coords.length; i++) {
    if (distance2 >= travelled && i === coords.length - 1) {
      break;
    } else if (travelled >= distance2) {
      const overshot = distance2 - travelled;
      if (!overshot) {
        return point(coords[i]);
      } else {
        const direction = bearing(coords[i], coords[i - 1]) - 180;
        const interpolated = destination(
          coords[i],
          overshot,
          direction,
          options
        );
        return interpolated;
      }
    } else {
      travelled += distance(coords[i], coords[i + 1], options);
    }
  }
  return point(coords[coords.length - 1]);
}
var index_default5 = along;

// src/workers/clipBatch.ts
async function clipBatch({
  features,
  differenceMultiPolygon,
  subjectFeature,
  groupBy
}) {
  const results = { "*": 0 };
  if (groupBy) {
    const classKeys = ["*"];
    for (const f of features) {
      const classKey = f.feature.properties?.[groupBy];
      if (classKey && !classKeys.includes(classKey)) {
        classKeys.push(classKey);
        results[classKey] = 0;
      }
    }
    for (const classKey of classKeys) {
      if (classKey === "*") {
        continue;
      }
      const size = calculatedClippedOverlapSize(
        features.filter((f) => f.feature.properties?.[groupBy] === classKey),
        differenceMultiPolygon,
        subjectFeature
      );
      results[classKey] += size;
      results["*"] += size;
    }
  } else {
    const size = calculatedClippedOverlapSize(
      features,
      differenceMultiPolygon,
      subjectFeature
    );
    results["*"] += size;
  }
  return results;
}
function calcSize(feature2) {
  if (feature2.geometry.type === "Polygon" || feature2.geometry.type === "MultiPolygon") {
    return turf_area_default(feature2) * 1e-6;
  } else if (feature2.geometry.type === "LineString" || feature2.geometry.type === "MultiLineString") {
    return index_default2(feature2, { units: "kilometers" });
  }
  return 0;
}
function calculatedClippedOverlapSize(features, differenceGeoms, subjectFeature) {
  if (features[0].feature.geometry.type === "Polygon" || features[0].feature.geometry.type === "MultiPolygon") {
    let product = [];
    let forClipping = [];
    for (const f of features) {
      const target = f.requiresIntersection ? forClipping : product;
      if (f.feature.geometry.type === "Polygon") {
        target.push(f.feature.geometry.coordinates);
      } else {
        for (const poly of f.feature.geometry.coordinates) {
          target.push(poly);
        }
      }
    }
    if (forClipping.length > 0) {
      const result = intersection2(
        forClipping,
        subjectFeature.geometry.coordinates
      );
      if (result.length > 0) {
        product.push(...result);
      }
    }
    const difference2 = difference(product, ...differenceGeoms);
    return calcSize({
      type: "Feature",
      geometry: {
        type: "MultiPolygon",
        coordinates: difference2
      },
      properties: {}
    });
  } else if (features[0].feature.geometry.type === "LineString" || features[0].feature.geometry.type === "MultiLineString") {
    let totalLength = 0;
    for (const f of features) {
      const processed = performOperationsOnFeature(
        f.feature,
        f.requiresIntersection,
        f.requiresDifference,
        differenceGeoms,
        subjectFeature
      );
      if (processed.geometry.type === "LineString" || processed.geometry.type === "MultiLineString") {
        totalLength += calcSize(
          processed
        );
      }
    }
    return totalLength;
  }
  return 0;
}
async function countFeatures({
  features,
  differenceMultiPolygon,
  subjectFeature,
  groupBy
}) {
  const results = { "*": /* @__PURE__ */ new Set() };
  for (const f of features) {
    if (f.requiresIntersection) {
      throw new Error(
        "Not implemented. If just counting features, they should never be added to the batch if unsure if they lie within the subject feature."
      );
    }
    if (f.requiresDifference) {
      if (f.feature.geometry.type === "Point" || f.feature.geometry.type === "MultiPoint") {
        const coords = f.feature.geometry.type === "Point" ? [f.feature.geometry.coordinates] : f.feature.geometry.coordinates;
        for (const coord of coords) {
          let anyMisses = false;
          for (const poly of differenceMultiPolygon) {
            const r = pointInPolygon(coord, poly);
            if (r === false) {
              anyMisses = true;
              break;
            }
          }
          if (!anyMisses) {
            continue;
          }
        }
      } else {
        if (turf_boolean_intersects_default(f.feature, {
          type: "Feature",
          geometry: {
            type: "MultiPolygon",
            coordinates: differenceMultiPolygon
          },
          properties: {}
        })) {
          continue;
        }
      }
    }
    if (!("__oidx" in f.feature.properties || {})) {
      throw new Error("Feature properties must contain __oidx");
    }
    if (groupBy) {
      const classKey = f.feature.properties?.[groupBy];
      if (classKey) {
        if (!(classKey in results)) {
          results[classKey] = /* @__PURE__ */ new Set();
        }
        results[classKey].add(f.feature.properties.__oidx);
      }
    }
    results["*"].add(f.feature.properties.__oidx);
  }
  return Object.fromEntries(
    Object.entries(results).map(([key, value]) => [key, Array.from(value)])
  );
}
async function testForPresenceInSubject({
  features,
  differenceMultiPolygon,
  subjectFeature
}) {
  for (const f of features) {
    if (f.requiresIntersection) {
      if (!turf_boolean_intersects_default(f.feature, subjectFeature)) {
        continue;
      }
    }
    if (f.requiresDifference) {
      if (turf_boolean_intersects_default(f.feature, {
        type: "Feature",
        properties: {},
        geometry: {
          type: "MultiPolygon",
          coordinates: differenceMultiPolygon
        }
      })) {
        continue;
      }
    }
    return true;
  }
  return false;
}
async function createPresenceTable({
  features,
  differenceMultiPolygon,
  subjectFeature,
  limit = 50,
  includedProperties
}) {
  const results = {
    exceededLimit: false,
    values: []
  };
  for (const f of features) {
    if (results.exceededLimit) {
      break;
    }
    if (f.requiresIntersection) {
      throw new Error(
        "Not implemented. If just counting features, they should never be added to the batch if unsure if they lie within the subject feature."
      );
    }
    if (f.requiresDifference) {
      if (f.feature.geometry.type === "Point" || f.feature.geometry.type === "MultiPoint") {
        const coords = f.feature.geometry.type === "Point" ? [f.feature.geometry.coordinates] : f.feature.geometry.coordinates;
        for (const coord of coords) {
          let anyMisses = false;
          for (const poly of differenceMultiPolygon) {
            const r = pointInPolygon(coord, poly);
            if (r === false) {
              anyMisses = true;
              break;
            }
          }
          if (!anyMisses) {
            continue;
          }
        }
      } else {
        if (turf_boolean_intersects_default(f.feature, {
          type: "Feature",
          geometry: {
            type: "MultiPolygon",
            coordinates: differenceMultiPolygon
          },
          properties: {}
        })) {
          continue;
        }
      }
    }
    if (!("__oidx" in f.feature.properties || {})) {
      throw new Error("Feature properties must contain __oidx");
    }
    let result = {
      __id: f.feature.properties.__oidx,
      ...f.feature.properties
    };
    result = pick(result, includedProperties);
    results.values.push(result);
    if (results.values.length >= limit) {
      results.exceededLimit = true;
    }
  }
  return results;
}
async function collectColumnValues({
  features,
  differenceMultiPolygon,
  subjectFeature,
  // property,
  groupBy
}) {
  const results = { "*": {} };
  for (const f of features) {
    if (f.feature.geometry.type === "Point" || f.feature.geometry.type === "MultiPoint") {
      if (f.requiresIntersection) {
        throw new Error(
          "Not implemented. If just collecting column values for points. They should never be added to the batch if unsure if they lie within the subject feature."
        );
      }
      if (f.requiresDifference) {
        if (f.feature.geometry.type === "Point" || f.feature.geometry.type === "MultiPoint") {
          const coords = f.feature.geometry.type === "Point" ? [f.feature.geometry.coordinates] : f.feature.geometry.coordinates;
          for (const coord of coords) {
            let anyMisses = false;
            for (const poly of differenceMultiPolygon) {
              const r = pointInPolygon(coord, poly);
              if (r === false) {
                anyMisses = true;
                break;
              }
            }
            if (!anyMisses) {
              continue;
            }
          }
        }
      }
    } else if (f.feature.geometry.type === "Polygon" || f.feature.geometry.type === "MultiPolygon" || f.feature.geometry.type === "LineString" || f.feature.geometry.type === "MultiLineString") {
      f.feature = performOperationsOnFeature(
        f.feature,
        f.requiresIntersection,
        f.requiresDifference,
        differenceMultiPolygon,
        subjectFeature
      );
    }
    addColumnValuesToResults(results, f.feature, groupBy);
  }
  return results;
}
function addColumnValuesToResults(results, feature2, groupBy) {
  for (const attr in feature2.properties) {
    if (attr === "__oidx" || attr === "__byteLength" || attr === "__area" || attr === "__offset") {
      continue;
    }
    const value = feature2.properties[attr];
    const columnValue = [value];
    if (feature2.geometry.type === "Polygon" || feature2.geometry.type === "MultiPolygon") {
      const sqKm = turf_area_default(feature2) * 1e-6;
      if (isNaN(sqKm) || sqKm === 0) {
        continue;
      }
      columnValue.push(sqKm);
    } else if (feature2.geometry.type === "LineString" || feature2.geometry.type === "MultiLineString") {
      const length3 = index_default2(feature2);
      if (isNaN(length3) || length3 === 0) {
        continue;
      }
      columnValue.push(length3);
    }
    if (typeof value === "number" || typeof value === "string" || typeof value === "boolean") {
      if (!(attr in results["*"])) {
        results["*"][attr] = [];
      }
      results["*"][attr].push(columnValue);
      if (groupBy) {
        const classKey = feature2.properties?.[groupBy];
        if (classKey) {
          if (!(classKey in results)) {
            results[classKey] = {};
          }
          if (!(attr in results[classKey])) {
            results[classKey][attr] = [];
          }
          results[classKey][attr].push(columnValue);
        }
      }
    }
  }
}
import_node_worker_threads.parentPort?.on(
  "message",
  async (job) => {
    try {
      const operation2 = job.operation || "overlay_area";
      let result;
      if (operation2 === "overlay_area") {
        result = await clipBatch({
          features: job.features,
          differenceMultiPolygon: job.differenceMultiPolygon,
          subjectFeature: job.subjectFeature,
          groupBy: job.groupBy
        });
      } else if (operation2 === "count") {
        result = await countFeatures({
          features: job.features,
          differenceMultiPolygon: job.differenceMultiPolygon,
          subjectFeature: job.subjectFeature,
          groupBy: job.groupBy
        });
      } else if (operation2 === "presence") {
        result = await testForPresenceInSubject({
          features: job.features,
          differenceMultiPolygon: job.differenceMultiPolygon,
          subjectFeature: job.subjectFeature
        });
      } else if (operation2 === "presence_table") {
        result = await createPresenceTable({
          features: job.features,
          differenceMultiPolygon: job.differenceMultiPolygon,
          subjectFeature: job.subjectFeature,
          limit: job.limit,
          includedProperties: job.includedProperties
        });
      } else if (operation2 === "column_values") {
        result = await collectColumnValues({
          features: job.features,
          differenceMultiPolygon: job.differenceMultiPolygon,
          subjectFeature: job.subjectFeature,
          // property: job.property,
          groupBy: job.groupBy
        });
      } else {
        throw new Error(`Unknown operation type: ${operation2}`);
      }
      import_node_worker_threads.parentPort?.postMessage({ ok: true, result });
    } catch (err) {
      import_node_worker_threads.parentPort?.postMessage({
        ok: false,
        error: { message: err.message, stack: err.stack }
      });
    }
  }
);
function pick(object, keys) {
  keys = keys || Object.keys(object);
  keys = keys.filter(
    (key) => key !== "__oidx" && key !== "__byteLength" && key !== "__area" && key !== "__offset"
  );
  return keys.reduce((acc, key) => {
    acc[key] = object[key];
    return acc;
  }, {});
}
function performOperationsOnFeature(feature2, requiresIntersection, requiresDifference, differenceMultiPolygon, subjectFeature) {
  let result = JSON.parse(JSON.stringify(feature2));
  if (result.geometry.type === "Polygon" || result.geometry.type === "MultiPolygon") {
    let geom = result.geometry.type === "Polygon" ? [result.geometry.coordinates] : result.geometry.coordinates;
    if (requiresIntersection) {
      geom = intersection2(
        geom,
        subjectFeature.geometry.coordinates
      );
    }
    if (requiresDifference) {
      geom = difference(geom, ...differenceMultiPolygon);
    }
    result.geometry = {
      type: "MultiPolygon",
      coordinates: geom
    };
  } else if (result.geometry.type === "LineString" || result.geometry.type === "MultiLineString") {
    let multiLine = toMultiLineCoordinates(result.geometry);
    if (requiresIntersection) {
      multiLine = clipLinesWithPolygon(multiLine, subjectFeature, "intersect");
    }
    if (requiresDifference && differenceMultiPolygon.length > 0) {
      for (const geom of differenceMultiPolygon) {
        if (multiLine.length === 0) {
          break;
        }
        if (!geom || geom.length === 0) {
          continue;
        }
        const differenceFeature = geomToMultiPolygonFeature(geom);
        multiLine = clipLinesWithPolygon(
          multiLine,
          differenceFeature,
          "difference"
        );
      }
    }
    result.geometry = {
      type: "MultiLineString",
      coordinates: multiLine
    };
  } else {
    throw new Error(
      `Unsupported geometry type: ${feature2.geometry.type}`
    );
  }
  return result;
}
function toMultiLineCoordinates(geometry) {
  if (geometry.type === "LineString") {
    return [cloneLineCoordinates(geometry.coordinates)];
  }
  return geometry.coordinates.map((line) => cloneLineCoordinates(line));
}
function clipLinesWithPolygon(lines, polygon, mode) {
  if (lines.length === 0) {
    return [];
  }
  const keepInside = mode === "intersect";
  const result = [];
  for (const coords of lines) {
    const filtered = filterLineStringAgainstPolygon(
      coords,
      polygon,
      keepInside
    );
    if (filtered.length > 0) {
      result.push(...filtered);
    }
  }
  return result;
}
function filterLineStringAgainstPolygon(coords, polygon, keepInside) {
  if (coords.length < 2) {
    return [];
  }
  const line = {
    type: "Feature",
    geometry: {
      type: "LineString",
      coordinates: coords
    },
    properties: {}
  };
  if (index_default3(line, polygon)) {
    return keepInside ? [cloneLineCoordinates(coords)] : [];
  }
  if (index_default(polygon, line)) {
    return keepInside ? [] : [cloneLineCoordinates(coords)];
  }
  const split = index_default4(line, polygon);
  const segments = [];
  for (const segment of split.features) {
    if (segment.geometry.type !== "LineString") {
      continue;
    }
    if (segment.geometry.coordinates.length < 2) {
      continue;
    }
    const segmentFeature = segment;
    const segmentLengthKm = index_default2(segmentFeature, {
      units: "kilometers"
    });
    const segmentLengthMeters = segmentLengthKm * 1e3;
    if (segmentLengthMeters <= 0.2) {
      continue;
    }
    const samplePoint = samplePointOnSegment(segmentFeature, segmentLengthKm);
    const inside = samplePoint ? index_default3(samplePoint, polygon) : index_default3(segmentFeature, polygon);
    if (keepInside && inside || !keepInside && !inside) {
      segments.push(cloneLineCoordinates(segment.geometry.coordinates));
    }
  }
  return segments;
}
function cloneLineCoordinates(coords) {
  return coords.map((pt) => pt.slice());
}
function samplePointOnSegment(segment, segmentLengthKm) {
  const distanceKm = Math.max(segmentLengthKm / 2, 1e-6);
  try {
    const sampled = index_default5(segment, distanceKm, { units: "kilometers" });
    if (sampled?.geometry?.type === "Point") {
      return sampled;
    }
  } catch (err) {
  }
  const coords = segment.geometry.coordinates;
  if (!coords || coords.length === 0) {
    return null;
  }
  const midIdx = Math.floor(coords.length / 2);
  const midpoint = coords[midIdx];
  if (!midpoint) {
    return null;
  }
  return {
    type: "Feature",
    geometry: {
      type: "Point",
      coordinates: midpoint
    },
    properties: {}
  };
}
function geomToMultiPolygonFeature(geom) {
  return {
    type: "Feature",
    geometry: {
      type: "MultiPolygon",
      coordinates: geomToMultiPolygonCoordinates(geom)
    },
    properties: {}
  };
}
function geomToMultiPolygonCoordinates(geom) {
  if (!geom || geom.length === 0) {
    return [];
  }
  const indicator = geom?.[0]?.[0]?.[0];
  if (Array.isArray(indicator)) {
    return geom;
  }
  return [geom];
}
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  addColumnValuesToResults,
  calculatedClippedOverlapSize,
  clipBatch,
  collectColumnValues,
  countFeatures,
  createPresenceTable,
  pick,
  testForPresenceInSubject
});
