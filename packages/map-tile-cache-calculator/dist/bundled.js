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
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target, mod));
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// node_modules/@mapbox/tilebelt/index.js
var require_tilebelt = __commonJS({
  "node_modules/@mapbox/tilebelt/index.js"(exports, module2) {
    "use strict";
    var d2r = Math.PI / 180;
    var r2d = 180 / Math.PI;
    function tileToBBOX(tile) {
      var e = tile2lon(tile[0] + 1, tile[2]);
      var w = tile2lon(tile[0], tile[2]);
      var s = tile2lat(tile[1] + 1, tile[2]);
      var n = tile2lat(tile[1], tile[2]);
      return [w, s, e, n];
    }
    function tileToGeoJSON(tile) {
      var bbox2 = tileToBBOX(tile);
      var poly = {
        type: "Polygon",
        coordinates: [[
          [bbox2[0], bbox2[3]],
          [bbox2[0], bbox2[1]],
          [bbox2[2], bbox2[1]],
          [bbox2[2], bbox2[3]],
          [bbox2[0], bbox2[3]]
        ]]
      };
      return poly;
    }
    function tile2lon(x, z) {
      return x / Math.pow(2, z) * 360 - 180;
    }
    function tile2lat(y, z) {
      var n = Math.PI - 2 * Math.PI * y / Math.pow(2, z);
      return r2d * Math.atan(0.5 * (Math.exp(n) - Math.exp(-n)));
    }
    function pointToTile(lon, lat, z) {
      var tile = pointToTileFraction(lon, lat, z);
      tile[0] = Math.floor(tile[0]);
      tile[1] = Math.floor(tile[1]);
      return tile;
    }
    function getChildren(tile) {
      return [
        [tile[0] * 2, tile[1] * 2, tile[2] + 1],
        [tile[0] * 2 + 1, tile[1] * 2, tile[2] + 1],
        [tile[0] * 2 + 1, tile[1] * 2 + 1, tile[2] + 1],
        [tile[0] * 2, tile[1] * 2 + 1, tile[2] + 1]
      ];
    }
    function getParent(tile) {
      return [tile[0] >> 1, tile[1] >> 1, tile[2] - 1];
    }
    function getSiblings(tile) {
      return getChildren(getParent(tile));
    }
    function hasSiblings(tile, tiles) {
      var siblings = getSiblings(tile);
      for (var i = 0; i < siblings.length; i++) {
        if (!hasTile(tiles, siblings[i]))
          return false;
      }
      return true;
    }
    function hasTile(tiles, tile) {
      for (var i = 0; i < tiles.length; i++) {
        if (tilesEqual(tiles[i], tile))
          return true;
      }
      return false;
    }
    function tilesEqual(tile1, tile2) {
      return tile1[0] === tile2[0] && tile1[1] === tile2[1] && tile1[2] === tile2[2];
    }
    function tileToQuadkey2(tile) {
      var index = "";
      for (var z = tile[2]; z > 0; z--) {
        var b = 0;
        var mask = 1 << z - 1;
        if ((tile[0] & mask) !== 0)
          b++;
        if ((tile[1] & mask) !== 0)
          b += 2;
        index += b.toString();
      }
      return index;
    }
    function quadkeyToTile(quadkey) {
      var x = 0;
      var y = 0;
      var z = quadkey.length;
      for (var i = z; i > 0; i--) {
        var mask = 1 << i - 1;
        var q = +quadkey[z - i];
        if (q === 1)
          x |= mask;
        if (q === 2)
          y |= mask;
        if (q === 3) {
          x |= mask;
          y |= mask;
        }
      }
      return [x, y, z];
    }
    function bboxToTile(bboxCoords) {
      var min = pointToTile(bboxCoords[0], bboxCoords[1], 32);
      var max = pointToTile(bboxCoords[2], bboxCoords[3], 32);
      var bbox2 = [min[0], min[1], max[0], max[1]];
      var z = getBboxZoom(bbox2);
      if (z === 0)
        return [0, 0, 0];
      var x = bbox2[0] >>> 32 - z;
      var y = bbox2[1] >>> 32 - z;
      return [x, y, z];
    }
    function getBboxZoom(bbox2) {
      var MAX_ZOOM = 28;
      for (var z = 0; z < MAX_ZOOM; z++) {
        var mask = 1 << 32 - (z + 1);
        if ((bbox2[0] & mask) !== (bbox2[2] & mask) || (bbox2[1] & mask) !== (bbox2[3] & mask)) {
          return z;
        }
      }
      return MAX_ZOOM;
    }
    function pointToTileFraction(lon, lat, z) {
      var sin = Math.sin(lat * d2r), z2 = Math.pow(2, z), x = z2 * (lon / 360 + 0.5), y = z2 * (0.5 - 0.25 * Math.log((1 + sin) / (1 - sin)) / Math.PI);
      x = x % z2;
      if (x < 0)
        x = x + z2;
      return [x, y, z];
    }
    module2.exports = {
      tileToGeoJSON,
      tileToBBOX,
      getChildren,
      getParent,
      getSiblings,
      hasTile,
      hasSiblings,
      tilesEqual,
      tileToQuadkey: tileToQuadkey2,
      quadkeyToTile,
      pointToTile,
      bboxToTile,
      pointToTileFraction
    };
  }
});

// node_modules/rbush/rbush.js
var require_rbush = __commonJS({
  "node_modules/rbush/rbush.js"(exports, module2) {
    (function(global, factory) {
      typeof exports === "object" && typeof module2 !== "undefined" ? module2.exports = factory() : typeof define === "function" && define.amd ? define(factory) : (global = global || self, global.RBush = factory());
    })(exports, function() {
      "use strict";
      function quickselect(arr, k, left, right, compare) {
        quickselectStep(arr, k, left || 0, right || arr.length - 1, compare || defaultCompare);
      }
      function quickselectStep(arr, k, left, right, compare) {
        while (right > left) {
          if (right - left > 600) {
            var n = right - left + 1;
            var m = k - left + 1;
            var z = Math.log(n);
            var s = 0.5 * Math.exp(2 * z / 3);
            var sd = 0.5 * Math.sqrt(z * s * (n - s) / n) * (m - n / 2 < 0 ? -1 : 1);
            var newLeft = Math.max(left, Math.floor(k - m * s / n + sd));
            var newRight = Math.min(right, Math.floor(k + (n - m) * s / n + sd));
            quickselectStep(arr, k, newLeft, newRight, compare);
          }
          var t = arr[k];
          var i = left;
          var j = right;
          swap(arr, left, k);
          if (compare(arr[right], t) > 0) {
            swap(arr, left, right);
          }
          while (i < j) {
            swap(arr, i, j);
            i++;
            j--;
            while (compare(arr[i], t) < 0) {
              i++;
            }
            while (compare(arr[j], t) > 0) {
              j--;
            }
          }
          if (compare(arr[left], t) === 0) {
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
        if (maxEntries === void 0)
          maxEntries = 9;
        this._maxEntries = Math.max(4, maxEntries);
        this._minEntries = Math.max(2, Math.ceil(this._maxEntries * 0.4));
        this.clear();
      };
      RBush.prototype.all = function all() {
        return this._all(this.data, []);
      };
      RBush.prototype.search = function search(bbox2) {
        var node = this.data;
        var result = [];
        if (!intersects2(bbox2, node)) {
          return result;
        }
        var toBBox = this.toBBox;
        var nodesToSearch = [];
        while (node) {
          for (var i = 0; i < node.children.length; i++) {
            var child = node.children[i];
            var childBBox = node.leaf ? toBBox(child) : child;
            if (intersects2(bbox2, childBBox)) {
              if (node.leaf) {
                result.push(child);
              } else if (contains(bbox2, childBBox)) {
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
      RBush.prototype.collides = function collides(bbox2) {
        var node = this.data;
        if (!intersects2(bbox2, node)) {
          return false;
        }
        var nodesToSearch = [];
        while (node) {
          for (var i = 0; i < node.children.length; i++) {
            var child = node.children[i];
            var childBBox = node.leaf ? this.toBBox(child) : child;
            if (intersects2(bbox2, childBBox)) {
              if (node.leaf || contains(bbox2, childBBox)) {
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
        var bbox2 = this.toBBox(item);
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
          if (!goingUp && !node.leaf && contains(node, bbox2)) {
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
      RBush.prototype._chooseSubtree = function _chooseSubtree(bbox2, node, level, path) {
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
            var area = bboxArea(child);
            var enlargement = enlargedArea(bbox2, child) - area;
            if (enlargement < minEnlargement) {
              minEnlargement = enlargement;
              minArea = area < minArea ? area : minArea;
              targetNode = child;
            } else if (enlargement === minEnlargement) {
              if (area < minArea) {
                minArea = area;
                targetNode = child;
              }
            }
          }
          node = targetNode || node.children[0];
        }
        return node;
      };
      RBush.prototype._insert = function _insert(item, level, isNode) {
        var bbox2 = isNode ? item : this.toBBox(item);
        var insertPath = [];
        var node = this._chooseSubtree(bbox2, this.data, level, insertPath);
        node.children.push(item);
        extend(node, bbox2);
        while (level >= 0) {
          if (insertPath[level].children.length > this._maxEntries) {
            this._split(insertPath, level);
            level--;
          } else {
            break;
          }
        }
        this._adjustParentBBoxes(bbox2, insertPath, level);
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
          var bbox2 = distBBox(node, i, M, this.toBBox);
          var overlap = intersectionArea(bbox1, bbox2);
          var area = bboxArea(bbox1) + bboxArea(bbox2);
          if (overlap < minOverlap) {
            minOverlap = overlap;
            index = i;
            minArea = area < minArea ? area : minArea;
          } else if (overlap === minOverlap) {
            if (area < minArea) {
              minArea = area;
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
      RBush.prototype._allDistMargin = function _allDistMargin(node, m, M, compare) {
        node.children.sort(compare);
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
      RBush.prototype._adjustParentBBoxes = function _adjustParentBBoxes(bbox2, path, level) {
        for (var i = level; i >= 0; i--) {
          extend(path[i], bbox2);
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
      function intersects2(a, b) {
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
      function multiSelect(arr, left, right, n, compare) {
        var stack = [left, right];
        while (stack.length) {
          right = stack.pop();
          left = stack.pop();
          if (right - left <= n) {
            continue;
          }
          var mid = left + Math.ceil((right - left) / n / 2) * n;
          quickselect(arr, mid, left, right, compare);
          stack.push(left, mid, mid, right);
        }
      }
      return RBush;
    });
  }
});

// node_modules/@turf/helpers/dist/js/index.js
var require_js = __commonJS({
  "node_modules/@turf/helpers/dist/js/index.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.earthRadius = 63710088e-1;
    exports.factors = {
      centimeters: exports.earthRadius * 100,
      centimetres: exports.earthRadius * 100,
      degrees: exports.earthRadius / 111325,
      feet: exports.earthRadius * 3.28084,
      inches: exports.earthRadius * 39.37,
      kilometers: exports.earthRadius / 1e3,
      kilometres: exports.earthRadius / 1e3,
      meters: exports.earthRadius,
      metres: exports.earthRadius,
      miles: exports.earthRadius / 1609.344,
      millimeters: exports.earthRadius * 1e3,
      millimetres: exports.earthRadius * 1e3,
      nauticalmiles: exports.earthRadius / 1852,
      radians: 1,
      yards: exports.earthRadius * 1.0936
    };
    exports.unitsFactors = {
      centimeters: 100,
      centimetres: 100,
      degrees: 1 / 111325,
      feet: 3.28084,
      inches: 39.37,
      kilometers: 1 / 1e3,
      kilometres: 1 / 1e3,
      meters: 1,
      metres: 1,
      miles: 1 / 1609.344,
      millimeters: 1e3,
      millimetres: 1e3,
      nauticalmiles: 1 / 1852,
      radians: 1 / exports.earthRadius,
      yards: 1.0936133
    };
    exports.areaFactors = {
      acres: 247105e-9,
      centimeters: 1e4,
      centimetres: 1e4,
      feet: 10.763910417,
      hectares: 1e-4,
      inches: 1550.003100006,
      kilometers: 1e-6,
      kilometres: 1e-6,
      meters: 1,
      metres: 1,
      miles: 386e-9,
      millimeters: 1e6,
      millimetres: 1e6,
      yards: 1.195990046
    };
    function feature2(geom, properties, options) {
      if (options === void 0) {
        options = {};
      }
      var feat = { type: "Feature" };
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
    exports.feature = feature2;
    function geometry(type, coordinates, _options) {
      if (_options === void 0) {
        _options = {};
      }
      switch (type) {
        case "Point":
          return point2(coordinates).geometry;
        case "LineString":
          return lineString2(coordinates).geometry;
        case "Polygon":
          return polygon(coordinates).geometry;
        case "MultiPoint":
          return multiPoint(coordinates).geometry;
        case "MultiLineString":
          return multiLineString2(coordinates).geometry;
        case "MultiPolygon":
          return multiPolygon(coordinates).geometry;
        default:
          throw new Error(type + " is invalid");
      }
    }
    exports.geometry = geometry;
    function point2(coordinates, properties, options) {
      if (options === void 0) {
        options = {};
      }
      if (!coordinates) {
        throw new Error("coordinates is required");
      }
      if (!Array.isArray(coordinates)) {
        throw new Error("coordinates must be an Array");
      }
      if (coordinates.length < 2) {
        throw new Error("coordinates must be at least 2 numbers long");
      }
      if (!isNumber2(coordinates[0]) || !isNumber2(coordinates[1])) {
        throw new Error("coordinates must contain numbers");
      }
      var geom = {
        type: "Point",
        coordinates
      };
      return feature2(geom, properties, options);
    }
    exports.point = point2;
    function points(coordinates, properties, options) {
      if (options === void 0) {
        options = {};
      }
      return featureCollection2(coordinates.map(function(coords) {
        return point2(coords, properties);
      }), options);
    }
    exports.points = points;
    function polygon(coordinates, properties, options) {
      if (options === void 0) {
        options = {};
      }
      for (var _i = 0, coordinates_1 = coordinates; _i < coordinates_1.length; _i++) {
        var ring = coordinates_1[_i];
        if (ring.length < 4) {
          throw new Error("Each LinearRing of a Polygon must have 4 or more Positions.");
        }
        for (var j = 0; j < ring[ring.length - 1].length; j++) {
          if (ring[ring.length - 1][j] !== ring[0][j]) {
            throw new Error("First and last Position are not equivalent.");
          }
        }
      }
      var geom = {
        type: "Polygon",
        coordinates
      };
      return feature2(geom, properties, options);
    }
    exports.polygon = polygon;
    function polygons(coordinates, properties, options) {
      if (options === void 0) {
        options = {};
      }
      return featureCollection2(coordinates.map(function(coords) {
        return polygon(coords, properties);
      }), options);
    }
    exports.polygons = polygons;
    function lineString2(coordinates, properties, options) {
      if (options === void 0) {
        options = {};
      }
      if (coordinates.length < 2) {
        throw new Error("coordinates must be an array of two or more positions");
      }
      var geom = {
        type: "LineString",
        coordinates
      };
      return feature2(geom, properties, options);
    }
    exports.lineString = lineString2;
    function lineStrings(coordinates, properties, options) {
      if (options === void 0) {
        options = {};
      }
      return featureCollection2(coordinates.map(function(coords) {
        return lineString2(coords, properties);
      }), options);
    }
    exports.lineStrings = lineStrings;
    function featureCollection2(features, options) {
      if (options === void 0) {
        options = {};
      }
      var fc = { type: "FeatureCollection" };
      if (options.id) {
        fc.id = options.id;
      }
      if (options.bbox) {
        fc.bbox = options.bbox;
      }
      fc.features = features;
      return fc;
    }
    exports.featureCollection = featureCollection2;
    function multiLineString2(coordinates, properties, options) {
      if (options === void 0) {
        options = {};
      }
      var geom = {
        type: "MultiLineString",
        coordinates
      };
      return feature2(geom, properties, options);
    }
    exports.multiLineString = multiLineString2;
    function multiPoint(coordinates, properties, options) {
      if (options === void 0) {
        options = {};
      }
      var geom = {
        type: "MultiPoint",
        coordinates
      };
      return feature2(geom, properties, options);
    }
    exports.multiPoint = multiPoint;
    function multiPolygon(coordinates, properties, options) {
      if (options === void 0) {
        options = {};
      }
      var geom = {
        type: "MultiPolygon",
        coordinates
      };
      return feature2(geom, properties, options);
    }
    exports.multiPolygon = multiPolygon;
    function geometryCollection(geometries, properties, options) {
      if (options === void 0) {
        options = {};
      }
      var geom = {
        type: "GeometryCollection",
        geometries
      };
      return feature2(geom, properties, options);
    }
    exports.geometryCollection = geometryCollection;
    function round(num, precision) {
      if (precision === void 0) {
        precision = 0;
      }
      if (precision && !(precision >= 0)) {
        throw new Error("precision must be a positive number");
      }
      var multiplier = Math.pow(10, precision || 0);
      return Math.round(num * multiplier) / multiplier;
    }
    exports.round = round;
    function radiansToLength(radians, units) {
      if (units === void 0) {
        units = "kilometers";
      }
      var factor = exports.factors[units];
      if (!factor) {
        throw new Error(units + " units is invalid");
      }
      return radians * factor;
    }
    exports.radiansToLength = radiansToLength;
    function lengthToRadians(distance, units) {
      if (units === void 0) {
        units = "kilometers";
      }
      var factor = exports.factors[units];
      if (!factor) {
        throw new Error(units + " units is invalid");
      }
      return distance / factor;
    }
    exports.lengthToRadians = lengthToRadians;
    function lengthToDegrees(distance, units) {
      return radiansToDegrees(lengthToRadians(distance, units));
    }
    exports.lengthToDegrees = lengthToDegrees;
    function bearingToAzimuth(bearing) {
      var angle = bearing % 360;
      if (angle < 0) {
        angle += 360;
      }
      return angle;
    }
    exports.bearingToAzimuth = bearingToAzimuth;
    function radiansToDegrees(radians) {
      var degrees = radians % (2 * Math.PI);
      return degrees * 180 / Math.PI;
    }
    exports.radiansToDegrees = radiansToDegrees;
    function degreesToRadians(degrees) {
      var radians = degrees % 360;
      return radians * Math.PI / 180;
    }
    exports.degreesToRadians = degreesToRadians;
    function convertLength(length, originalUnit, finalUnit) {
      if (originalUnit === void 0) {
        originalUnit = "kilometers";
      }
      if (finalUnit === void 0) {
        finalUnit = "kilometers";
      }
      if (!(length >= 0)) {
        throw new Error("length must be a positive number");
      }
      return radiansToLength(lengthToRadians(length, originalUnit), finalUnit);
    }
    exports.convertLength = convertLength;
    function convertArea(area, originalUnit, finalUnit) {
      if (originalUnit === void 0) {
        originalUnit = "meters";
      }
      if (finalUnit === void 0) {
        finalUnit = "kilometers";
      }
      if (!(area >= 0)) {
        throw new Error("area must be a positive number");
      }
      var startFactor = exports.areaFactors[originalUnit];
      if (!startFactor) {
        throw new Error("invalid original units");
      }
      var finalFactor = exports.areaFactors[finalUnit];
      if (!finalFactor) {
        throw new Error("invalid final units");
      }
      return area / startFactor * finalFactor;
    }
    exports.convertArea = convertArea;
    function isNumber2(num) {
      return !isNaN(num) && num !== null && !Array.isArray(num);
    }
    exports.isNumber = isNumber2;
    function isObject2(input) {
      return !!input && input.constructor === Object;
    }
    exports.isObject = isObject2;
    function validateBBox(bbox2) {
      if (!bbox2) {
        throw new Error("bbox is required");
      }
      if (!Array.isArray(bbox2)) {
        throw new Error("bbox must be an Array");
      }
      if (bbox2.length !== 4 && bbox2.length !== 6) {
        throw new Error("bbox must be an Array of 4 or 6 numbers");
      }
      bbox2.forEach(function(num) {
        if (!isNumber2(num)) {
          throw new Error("bbox must only contain numbers");
        }
      });
    }
    exports.validateBBox = validateBBox;
    function validateId(id) {
      if (!id) {
        throw new Error("id is required");
      }
      if (["string", "number"].indexOf(typeof id) === -1) {
        throw new Error("id must be a number or a string");
      }
    }
    exports.validateId = validateId;
  }
});

// node_modules/@turf/meta/dist/js/index.js
var require_js2 = __commonJS({
  "node_modules/@turf/meta/dist/js/index.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    var helpers = require_js();
    function coordEach(geojson, callback, excludeWrapCoord) {
      if (geojson === null)
        return;
      var j, k, l, geometry, stopG, coords, geometryMaybeCollection, wrapShrink = 0, coordIndex = 0, isGeometryCollection, type = geojson.type, isFeatureCollection = type === "FeatureCollection", isFeature = type === "Feature", stop = isFeatureCollection ? geojson.features.length : 1;
      for (var featureIndex = 0; featureIndex < stop; featureIndex++) {
        geometryMaybeCollection = isFeatureCollection ? geojson.features[featureIndex].geometry : isFeature ? geojson.geometry : geojson;
        isGeometryCollection = geometryMaybeCollection ? geometryMaybeCollection.type === "GeometryCollection" : false;
        stopG = isGeometryCollection ? geometryMaybeCollection.geometries.length : 1;
        for (var geomIndex = 0; geomIndex < stopG; geomIndex++) {
          var multiFeatureIndex = 0;
          var geometryIndex = 0;
          geometry = isGeometryCollection ? geometryMaybeCollection.geometries[geomIndex] : geometryMaybeCollection;
          if (geometry === null)
            continue;
          coords = geometry.coordinates;
          var geomType = geometry.type;
          wrapShrink = excludeWrapCoord && (geomType === "Polygon" || geomType === "MultiPolygon") ? 1 : 0;
          switch (geomType) {
            case null:
              break;
            case "Point":
              if (callback(coords, coordIndex, featureIndex, multiFeatureIndex, geometryIndex) === false)
                return false;
              coordIndex++;
              multiFeatureIndex++;
              break;
            case "LineString":
            case "MultiPoint":
              for (j = 0; j < coords.length; j++) {
                if (callback(coords[j], coordIndex, featureIndex, multiFeatureIndex, geometryIndex) === false)
                  return false;
                coordIndex++;
                if (geomType === "MultiPoint")
                  multiFeatureIndex++;
              }
              if (geomType === "LineString")
                multiFeatureIndex++;
              break;
            case "Polygon":
            case "MultiLineString":
              for (j = 0; j < coords.length; j++) {
                for (k = 0; k < coords[j].length - wrapShrink; k++) {
                  if (callback(coords[j][k], coordIndex, featureIndex, multiFeatureIndex, geometryIndex) === false)
                    return false;
                  coordIndex++;
                }
                if (geomType === "MultiLineString")
                  multiFeatureIndex++;
                if (geomType === "Polygon")
                  geometryIndex++;
              }
              if (geomType === "Polygon")
                multiFeatureIndex++;
              break;
            case "MultiPolygon":
              for (j = 0; j < coords.length; j++) {
                geometryIndex = 0;
                for (k = 0; k < coords[j].length; k++) {
                  for (l = 0; l < coords[j][k].length - wrapShrink; l++) {
                    if (callback(coords[j][k][l], coordIndex, featureIndex, multiFeatureIndex, geometryIndex) === false)
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
    function coordReduce(geojson, callback, initialValue, excludeWrapCoord) {
      var previousValue = initialValue;
      coordEach(geojson, function(currentCoord, coordIndex, featureIndex, multiFeatureIndex, geometryIndex) {
        if (coordIndex === 0 && initialValue === void 0)
          previousValue = currentCoord;
        else
          previousValue = callback(previousValue, currentCoord, coordIndex, featureIndex, multiFeatureIndex, geometryIndex);
      }, excludeWrapCoord);
      return previousValue;
    }
    function propEach(geojson, callback) {
      var i;
      switch (geojson.type) {
        case "FeatureCollection":
          for (i = 0; i < geojson.features.length; i++) {
            if (callback(geojson.features[i].properties, i) === false)
              break;
          }
          break;
        case "Feature":
          callback(geojson.properties, 0);
          break;
      }
    }
    function propReduce(geojson, callback, initialValue) {
      var previousValue = initialValue;
      propEach(geojson, function(currentProperties, featureIndex) {
        if (featureIndex === 0 && initialValue === void 0)
          previousValue = currentProperties;
        else
          previousValue = callback(previousValue, currentProperties, featureIndex);
      });
      return previousValue;
    }
    function featureEach2(geojson, callback) {
      if (geojson.type === "Feature") {
        callback(geojson, 0);
      } else if (geojson.type === "FeatureCollection") {
        for (var i = 0; i < geojson.features.length; i++) {
          if (callback(geojson.features[i], i) === false)
            break;
        }
      }
    }
    function featureReduce(geojson, callback, initialValue) {
      var previousValue = initialValue;
      featureEach2(geojson, function(currentFeature, featureIndex) {
        if (featureIndex === 0 && initialValue === void 0)
          previousValue = currentFeature;
        else
          previousValue = callback(previousValue, currentFeature, featureIndex);
      });
      return previousValue;
    }
    function coordAll(geojson) {
      var coords = [];
      coordEach(geojson, function(coord) {
        coords.push(coord);
      });
      return coords;
    }
    function geomEach2(geojson, callback) {
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
            if (callback(null, featureIndex, featureProperties, featureBBox, featureId) === false)
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
              if (callback(geometry, featureIndex, featureProperties, featureBBox, featureId) === false)
                return false;
              break;
            }
            case "GeometryCollection": {
              for (j = 0; j < geometry.geometries.length; j++) {
                if (callback(geometry.geometries[j], featureIndex, featureProperties, featureBBox, featureId) === false)
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
      geomEach2(geojson, function(currentGeometry, featureIndex, featureProperties, featureBBox, featureId) {
        if (featureIndex === 0 && initialValue === void 0)
          previousValue = currentGeometry;
        else
          previousValue = callback(previousValue, currentGeometry, featureIndex, featureProperties, featureBBox, featureId);
      });
      return previousValue;
    }
    function flattenEach2(geojson, callback) {
      geomEach2(geojson, function(geometry, featureIndex, properties, bbox2, id) {
        var type = geometry === null ? null : geometry.type;
        switch (type) {
          case null:
          case "Point":
          case "LineString":
          case "Polygon":
            if (callback(helpers.feature(geometry, properties, { bbox: bbox2, id }), featureIndex, 0) === false)
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
          if (callback(helpers.feature(geom, properties), featureIndex, multiFeatureIndex) === false)
            return false;
        }
      });
    }
    function flattenReduce(geojson, callback, initialValue) {
      var previousValue = initialValue;
      flattenEach2(geojson, function(currentFeature, featureIndex, multiFeatureIndex) {
        if (featureIndex === 0 && multiFeatureIndex === 0 && initialValue === void 0)
          previousValue = currentFeature;
        else
          previousValue = callback(previousValue, currentFeature, featureIndex, multiFeatureIndex);
      });
      return previousValue;
    }
    function segmentEach(geojson, callback) {
      flattenEach2(geojson, function(feature2, featureIndex, multiFeatureIndex) {
        var segmentIndex = 0;
        if (!feature2.geometry)
          return;
        var type = feature2.geometry.type;
        if (type === "Point" || type === "MultiPoint")
          return;
        var previousCoords;
        var previousFeatureIndex = 0;
        var previousMultiIndex = 0;
        var prevGeomIndex = 0;
        if (coordEach(feature2, function(currentCoord, coordIndex, featureIndexCoord, multiPartIndexCoord, geometryIndex) {
          if (previousCoords === void 0 || featureIndex > previousFeatureIndex || multiPartIndexCoord > previousMultiIndex || geometryIndex > prevGeomIndex) {
            previousCoords = currentCoord;
            previousFeatureIndex = featureIndex;
            previousMultiIndex = multiPartIndexCoord;
            prevGeomIndex = geometryIndex;
            segmentIndex = 0;
            return;
          }
          var currentSegment = helpers.lineString([previousCoords, currentCoord], feature2.properties);
          if (callback(currentSegment, featureIndex, multiFeatureIndex, geometryIndex, segmentIndex) === false)
            return false;
          segmentIndex++;
          previousCoords = currentCoord;
        }) === false)
          return false;
      });
    }
    function segmentReduce(geojson, callback, initialValue) {
      var previousValue = initialValue;
      var started = false;
      segmentEach(geojson, function(currentSegment, featureIndex, multiFeatureIndex, geometryIndex, segmentIndex) {
        if (started === false && initialValue === void 0)
          previousValue = currentSegment;
        else
          previousValue = callback(previousValue, currentSegment, featureIndex, multiFeatureIndex, geometryIndex, segmentIndex);
        started = true;
      });
      return previousValue;
    }
    function lineEach(geojson, callback) {
      if (!geojson)
        throw new Error("geojson is required");
      flattenEach2(geojson, function(feature2, featureIndex, multiFeatureIndex) {
        if (feature2.geometry === null)
          return;
        var type = feature2.geometry.type;
        var coords = feature2.geometry.coordinates;
        switch (type) {
          case "LineString":
            if (callback(feature2, featureIndex, multiFeatureIndex, 0, 0) === false)
              return false;
            break;
          case "Polygon":
            for (var geometryIndex = 0; geometryIndex < coords.length; geometryIndex++) {
              if (callback(helpers.lineString(coords[geometryIndex], feature2.properties), featureIndex, multiFeatureIndex, geometryIndex) === false)
                return false;
            }
            break;
        }
      });
    }
    function lineReduce(geojson, callback, initialValue) {
      var previousValue = initialValue;
      lineEach(geojson, function(currentLine, featureIndex, multiFeatureIndex, geometryIndex) {
        if (featureIndex === 0 && initialValue === void 0)
          previousValue = currentLine;
        else
          previousValue = callback(previousValue, currentLine, featureIndex, multiFeatureIndex, geometryIndex);
      });
      return previousValue;
    }
    function findSegment(geojson, options) {
      options = options || {};
      if (!helpers.isObject(options))
        throw new Error("options is invalid");
      var featureIndex = options.featureIndex || 0;
      var multiFeatureIndex = options.multiFeatureIndex || 0;
      var geometryIndex = options.geometryIndex || 0;
      var segmentIndex = options.segmentIndex || 0;
      var properties = options.properties;
      var geometry;
      switch (geojson.type) {
        case "FeatureCollection":
          if (featureIndex < 0)
            featureIndex = geojson.features.length + featureIndex;
          properties = properties || geojson.features[featureIndex].properties;
          geometry = geojson.features[featureIndex].geometry;
          break;
        case "Feature":
          properties = properties || geojson.properties;
          geometry = geojson.geometry;
          break;
        case "Point":
        case "MultiPoint":
          return null;
        case "LineString":
        case "Polygon":
        case "MultiLineString":
        case "MultiPolygon":
          geometry = geojson;
          break;
        default:
          throw new Error("geojson is invalid");
      }
      if (geometry === null)
        return null;
      var coords = geometry.coordinates;
      switch (geometry.type) {
        case "Point":
        case "MultiPoint":
          return null;
        case "LineString":
          if (segmentIndex < 0)
            segmentIndex = coords.length + segmentIndex - 1;
          return helpers.lineString([coords[segmentIndex], coords[segmentIndex + 1]], properties, options);
        case "Polygon":
          if (geometryIndex < 0)
            geometryIndex = coords.length + geometryIndex;
          if (segmentIndex < 0)
            segmentIndex = coords[geometryIndex].length + segmentIndex - 1;
          return helpers.lineString([
            coords[geometryIndex][segmentIndex],
            coords[geometryIndex][segmentIndex + 1]
          ], properties, options);
        case "MultiLineString":
          if (multiFeatureIndex < 0)
            multiFeatureIndex = coords.length + multiFeatureIndex;
          if (segmentIndex < 0)
            segmentIndex = coords[multiFeatureIndex].length + segmentIndex - 1;
          return helpers.lineString([
            coords[multiFeatureIndex][segmentIndex],
            coords[multiFeatureIndex][segmentIndex + 1]
          ], properties, options);
        case "MultiPolygon":
          if (multiFeatureIndex < 0)
            multiFeatureIndex = coords.length + multiFeatureIndex;
          if (geometryIndex < 0)
            geometryIndex = coords[multiFeatureIndex].length + geometryIndex;
          if (segmentIndex < 0)
            segmentIndex = coords[multiFeatureIndex][geometryIndex].length - segmentIndex - 1;
          return helpers.lineString([
            coords[multiFeatureIndex][geometryIndex][segmentIndex],
            coords[multiFeatureIndex][geometryIndex][segmentIndex + 1]
          ], properties, options);
      }
      throw new Error("geojson is invalid");
    }
    function findPoint(geojson, options) {
      options = options || {};
      if (!helpers.isObject(options))
        throw new Error("options is invalid");
      var featureIndex = options.featureIndex || 0;
      var multiFeatureIndex = options.multiFeatureIndex || 0;
      var geometryIndex = options.geometryIndex || 0;
      var coordIndex = options.coordIndex || 0;
      var properties = options.properties;
      var geometry;
      switch (geojson.type) {
        case "FeatureCollection":
          if (featureIndex < 0)
            featureIndex = geojson.features.length + featureIndex;
          properties = properties || geojson.features[featureIndex].properties;
          geometry = geojson.features[featureIndex].geometry;
          break;
        case "Feature":
          properties = properties || geojson.properties;
          geometry = geojson.geometry;
          break;
        case "Point":
        case "MultiPoint":
          return null;
        case "LineString":
        case "Polygon":
        case "MultiLineString":
        case "MultiPolygon":
          geometry = geojson;
          break;
        default:
          throw new Error("geojson is invalid");
      }
      if (geometry === null)
        return null;
      var coords = geometry.coordinates;
      switch (geometry.type) {
        case "Point":
          return helpers.point(coords, properties, options);
        case "MultiPoint":
          if (multiFeatureIndex < 0)
            multiFeatureIndex = coords.length + multiFeatureIndex;
          return helpers.point(coords[multiFeatureIndex], properties, options);
        case "LineString":
          if (coordIndex < 0)
            coordIndex = coords.length + coordIndex;
          return helpers.point(coords[coordIndex], properties, options);
        case "Polygon":
          if (geometryIndex < 0)
            geometryIndex = coords.length + geometryIndex;
          if (coordIndex < 0)
            coordIndex = coords[geometryIndex].length + coordIndex;
          return helpers.point(coords[geometryIndex][coordIndex], properties, options);
        case "MultiLineString":
          if (multiFeatureIndex < 0)
            multiFeatureIndex = coords.length + multiFeatureIndex;
          if (coordIndex < 0)
            coordIndex = coords[multiFeatureIndex].length + coordIndex;
          return helpers.point(coords[multiFeatureIndex][coordIndex], properties, options);
        case "MultiPolygon":
          if (multiFeatureIndex < 0)
            multiFeatureIndex = coords.length + multiFeatureIndex;
          if (geometryIndex < 0)
            geometryIndex = coords[multiFeatureIndex].length + geometryIndex;
          if (coordIndex < 0)
            coordIndex = coords[multiFeatureIndex][geometryIndex].length - coordIndex;
          return helpers.point(coords[multiFeatureIndex][geometryIndex][coordIndex], properties, options);
      }
      throw new Error("geojson is invalid");
    }
    exports.coordAll = coordAll;
    exports.coordEach = coordEach;
    exports.coordReduce = coordReduce;
    exports.featureEach = featureEach2;
    exports.featureReduce = featureReduce;
    exports.findPoint = findPoint;
    exports.findSegment = findSegment;
    exports.flattenEach = flattenEach2;
    exports.flattenReduce = flattenReduce;
    exports.geomEach = geomEach2;
    exports.geomReduce = geomReduce;
    exports.lineEach = lineEach;
    exports.lineReduce = lineReduce;
    exports.propEach = propEach;
    exports.propReduce = propReduce;
    exports.segmentEach = segmentEach;
    exports.segmentReduce = segmentReduce;
  }
});

// node_modules/@turf/bbox/dist/js/index.js
var require_js3 = __commonJS({
  "node_modules/@turf/bbox/dist/js/index.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    var meta_1 = require_js2();
    function bbox2(geojson) {
      var result = [Infinity, Infinity, -Infinity, -Infinity];
      meta_1.coordEach(geojson, function(coord) {
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
    bbox2["default"] = bbox2;
    exports.default = bbox2;
  }
});

// node_modules/geojson-rbush/index.js
var require_geojson_rbush = __commonJS({
  "node_modules/geojson-rbush/index.js"(exports, module2) {
    var rbush2 = require_rbush();
    var helpers = require_js();
    var meta = require_js2();
    var turfBBox = require_js3().default;
    var featureEach2 = meta.featureEach;
    var coordEach = meta.coordEach;
    var polygon = helpers.polygon;
    var featureCollection2 = helpers.featureCollection;
    function geojsonRbush(maxEntries) {
      var tree = new rbush2(maxEntries);
      tree.insert = function(feature2) {
        if (feature2.type !== "Feature")
          throw new Error("invalid feature");
        feature2.bbox = feature2.bbox ? feature2.bbox : turfBBox(feature2);
        return rbush2.prototype.insert.call(this, feature2);
      };
      tree.load = function(features) {
        var load = [];
        if (Array.isArray(features)) {
          features.forEach(function(feature2) {
            if (feature2.type !== "Feature")
              throw new Error("invalid features");
            feature2.bbox = feature2.bbox ? feature2.bbox : turfBBox(feature2);
            load.push(feature2);
          });
        } else {
          featureEach2(features, function(feature2) {
            if (feature2.type !== "Feature")
              throw new Error("invalid features");
            feature2.bbox = feature2.bbox ? feature2.bbox : turfBBox(feature2);
            load.push(feature2);
          });
        }
        return rbush2.prototype.load.call(this, load);
      };
      tree.remove = function(feature2, equals) {
        if (feature2.type !== "Feature")
          throw new Error("invalid feature");
        feature2.bbox = feature2.bbox ? feature2.bbox : turfBBox(feature2);
        return rbush2.prototype.remove.call(this, feature2, equals);
      };
      tree.clear = function() {
        return rbush2.prototype.clear.call(this);
      };
      tree.search = function(geojson) {
        var features = rbush2.prototype.search.call(this, this.toBBox(geojson));
        return featureCollection2(features);
      };
      tree.collides = function(geojson) {
        return rbush2.prototype.collides.call(this, this.toBBox(geojson));
      };
      tree.all = function() {
        var features = rbush2.prototype.all.call(this);
        return featureCollection2(features);
      };
      tree.toJSON = function() {
        return rbush2.prototype.toJSON.call(this);
      };
      tree.fromJSON = function(json) {
        return rbush2.prototype.fromJSON.call(this, json);
      };
      tree.toBBox = function(geojson) {
        var bbox2;
        if (geojson.bbox)
          bbox2 = geojson.bbox;
        else if (Array.isArray(geojson) && geojson.length === 4)
          bbox2 = geojson;
        else if (Array.isArray(geojson) && geojson.length === 6)
          bbox2 = [geojson[0], geojson[1], geojson[3], geojson[4]];
        else if (geojson.type === "Feature")
          bbox2 = turfBBox(geojson);
        else if (geojson.type === "FeatureCollection")
          bbox2 = turfBBox(geojson);
        else
          throw new Error("invalid geojson");
        return {
          minX: bbox2[0],
          minY: bbox2[1],
          maxX: bbox2[2],
          maxY: bbox2[3]
        };
      };
      return tree;
    }
    module2.exports = geojsonRbush;
    module2.exports.default = geojsonRbush;
  }
});

// ../vector-data-source/dist/bundled.js
var require_bundled = __commonJS({
  "../vector-data-source/dist/bundled.js"(exports, module2) {
    "use strict";
    var __create2 = Object.create;
    var __defProp2 = Object.defineProperty;
    var __getOwnPropDesc2 = Object.getOwnPropertyDescriptor;
    var __getOwnPropNames2 = Object.getOwnPropertyNames;
    var __getProtoOf2 = Object.getPrototypeOf;
    var __hasOwnProp2 = Object.prototype.hasOwnProperty;
    var __commonJS2 = (cb, mod) => function __require() {
      return mod || (0, cb[__getOwnPropNames2(cb)[0]])((mod = { exports: {} }).exports, mod), mod.exports;
    };
    var __export2 = (target, all) => {
      for (var name in all)
        __defProp2(target, name, { get: all[name], enumerable: true });
    };
    var __copyProps2 = (to, from, except, desc) => {
      if (from && typeof from === "object" || typeof from === "function") {
        for (let key of __getOwnPropNames2(from))
          if (!__hasOwnProp2.call(to, key) && key !== except)
            __defProp2(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc2(from, key)) || desc.enumerable });
      }
      return to;
    };
    var __toESM2 = (mod, isNodeMode, target) => (target = mod != null ? __create2(__getProtoOf2(mod)) : {}, __copyProps2(isNodeMode || !mod || !mod.__esModule ? __defProp2(target, "default", { value: mod, enumerable: true }) : target, mod));
    var __toCommonJS2 = (mod) => __copyProps2(__defProp2({}, "__esModule", { value: true }), mod);
    var require_ieee754 = __commonJS2({
      "node_modules/ieee754/index.js"(exports2) {
        exports2.read = function(buffer, offset, isLE, mLen, nBytes) {
          var e, m;
          var eLen = nBytes * 8 - mLen - 1;
          var eMax = (1 << eLen) - 1;
          var eBias = eMax >> 1;
          var nBits = -7;
          var i = isLE ? nBytes - 1 : 0;
          var d = isLE ? -1 : 1;
          var s = buffer[offset + i];
          i += d;
          e = s & (1 << -nBits) - 1;
          s >>= -nBits;
          nBits += eLen;
          for (; nBits > 0; e = e * 256 + buffer[offset + i], i += d, nBits -= 8) {
          }
          m = e & (1 << -nBits) - 1;
          e >>= -nBits;
          nBits += mLen;
          for (; nBits > 0; m = m * 256 + buffer[offset + i], i += d, nBits -= 8) {
          }
          if (e === 0) {
            e = 1 - eBias;
          } else if (e === eMax) {
            return m ? NaN : (s ? -1 : 1) * Infinity;
          } else {
            m = m + Math.pow(2, mLen);
            e = e - eBias;
          }
          return (s ? -1 : 1) * m * Math.pow(2, e - mLen);
        };
        exports2.write = function(buffer, value, offset, isLE, mLen, nBytes) {
          var e, m, c;
          var eLen = nBytes * 8 - mLen - 1;
          var eMax = (1 << eLen) - 1;
          var eBias = eMax >> 1;
          var rt = mLen === 23 ? Math.pow(2, -24) - Math.pow(2, -77) : 0;
          var i = isLE ? 0 : nBytes - 1;
          var d = isLE ? 1 : -1;
          var s = value < 0 || value === 0 && 1 / value < 0 ? 1 : 0;
          value = Math.abs(value);
          if (isNaN(value) || value === Infinity) {
            m = isNaN(value) ? 1 : 0;
            e = eMax;
          } else {
            e = Math.floor(Math.log(value) / Math.LN2);
            if (value * (c = Math.pow(2, -e)) < 1) {
              e--;
              c *= 2;
            }
            if (e + eBias >= 1) {
              value += rt / c;
            } else {
              value += rt * Math.pow(2, 1 - eBias);
            }
            if (value * c >= 2) {
              e++;
              c /= 2;
            }
            if (e + eBias >= eMax) {
              m = 0;
              e = eMax;
            } else if (e + eBias >= 1) {
              m = (value * c - 1) * Math.pow(2, mLen);
              e = e + eBias;
            } else {
              m = value * Math.pow(2, eBias - 1) * Math.pow(2, mLen);
              e = 0;
            }
          }
          for (; mLen >= 8; buffer[offset + i] = m & 255, i += d, m /= 256, mLen -= 8) {
          }
          e = e << mLen | m;
          eLen += mLen;
          for (; eLen > 0; buffer[offset + i] = e & 255, i += d, e /= 256, eLen -= 8) {
          }
          buffer[offset + i - d] |= s * 128;
        };
      }
    });
    var require_pbf = __commonJS2({
      "node_modules/pbf/index.js"(exports2, module22) {
        "use strict";
        module22.exports = Pbf2;
        var ieee754 = require_ieee754();
        function Pbf2(buf) {
          this.buf = ArrayBuffer.isView && ArrayBuffer.isView(buf) ? buf : new Uint8Array(buf || 0);
          this.pos = 0;
          this.type = 0;
          this.length = this.buf.length;
        }
        Pbf2.Varint = 0;
        Pbf2.Fixed64 = 1;
        Pbf2.Bytes = 2;
        Pbf2.Fixed32 = 5;
        var SHIFT_LEFT_32 = (1 << 16) * (1 << 16);
        var SHIFT_RIGHT_32 = 1 / SHIFT_LEFT_32;
        var TEXT_DECODER_MIN_LENGTH = 12;
        var utf8TextDecoder = typeof TextDecoder === "undefined" ? null : new TextDecoder("utf8");
        Pbf2.prototype = {
          destroy: function() {
            this.buf = null;
          },
          readFields: function(readField, result, end) {
            end = end || this.length;
            while (this.pos < end) {
              var val = this.readVarint(), tag = val >> 3, startPos = this.pos;
              this.type = val & 7;
              readField(tag, result, this);
              if (this.pos === startPos)
                this.skip(val);
            }
            return result;
          },
          readMessage: function(readField, result) {
            return this.readFields(readField, result, this.readVarint() + this.pos);
          },
          readFixed32: function() {
            var val = readUInt32(this.buf, this.pos);
            this.pos += 4;
            return val;
          },
          readSFixed32: function() {
            var val = readInt32(this.buf, this.pos);
            this.pos += 4;
            return val;
          },
          readFixed64: function() {
            var val = readUInt32(this.buf, this.pos) + readUInt32(this.buf, this.pos + 4) * SHIFT_LEFT_32;
            this.pos += 8;
            return val;
          },
          readSFixed64: function() {
            var val = readUInt32(this.buf, this.pos) + readInt32(this.buf, this.pos + 4) * SHIFT_LEFT_32;
            this.pos += 8;
            return val;
          },
          readFloat: function() {
            var val = ieee754.read(this.buf, this.pos, true, 23, 4);
            this.pos += 4;
            return val;
          },
          readDouble: function() {
            var val = ieee754.read(this.buf, this.pos, true, 52, 8);
            this.pos += 8;
            return val;
          },
          readVarint: function(isSigned) {
            var buf = this.buf, val, b;
            b = buf[this.pos++];
            val = b & 127;
            if (b < 128)
              return val;
            b = buf[this.pos++];
            val |= (b & 127) << 7;
            if (b < 128)
              return val;
            b = buf[this.pos++];
            val |= (b & 127) << 14;
            if (b < 128)
              return val;
            b = buf[this.pos++];
            val |= (b & 127) << 21;
            if (b < 128)
              return val;
            b = buf[this.pos];
            val |= (b & 15) << 28;
            return readVarintRemainder(val, isSigned, this);
          },
          readVarint64: function() {
            return this.readVarint(true);
          },
          readSVarint: function() {
            var num = this.readVarint();
            return num % 2 === 1 ? (num + 1) / -2 : num / 2;
          },
          readBoolean: function() {
            return Boolean(this.readVarint());
          },
          readString: function() {
            var end = this.readVarint() + this.pos;
            var pos = this.pos;
            this.pos = end;
            if (end - pos >= TEXT_DECODER_MIN_LENGTH && utf8TextDecoder) {
              return readUtf8TextDecoder(this.buf, pos, end);
            }
            return readUtf8(this.buf, pos, end);
          },
          readBytes: function() {
            var end = this.readVarint() + this.pos, buffer = this.buf.subarray(this.pos, end);
            this.pos = end;
            return buffer;
          },
          readPackedVarint: function(arr, isSigned) {
            if (this.type !== Pbf2.Bytes)
              return arr.push(this.readVarint(isSigned));
            var end = readPackedEnd(this);
            arr = arr || [];
            while (this.pos < end)
              arr.push(this.readVarint(isSigned));
            return arr;
          },
          readPackedSVarint: function(arr) {
            if (this.type !== Pbf2.Bytes)
              return arr.push(this.readSVarint());
            var end = readPackedEnd(this);
            arr = arr || [];
            while (this.pos < end)
              arr.push(this.readSVarint());
            return arr;
          },
          readPackedBoolean: function(arr) {
            if (this.type !== Pbf2.Bytes)
              return arr.push(this.readBoolean());
            var end = readPackedEnd(this);
            arr = arr || [];
            while (this.pos < end)
              arr.push(this.readBoolean());
            return arr;
          },
          readPackedFloat: function(arr) {
            if (this.type !== Pbf2.Bytes)
              return arr.push(this.readFloat());
            var end = readPackedEnd(this);
            arr = arr || [];
            while (this.pos < end)
              arr.push(this.readFloat());
            return arr;
          },
          readPackedDouble: function(arr) {
            if (this.type !== Pbf2.Bytes)
              return arr.push(this.readDouble());
            var end = readPackedEnd(this);
            arr = arr || [];
            while (this.pos < end)
              arr.push(this.readDouble());
            return arr;
          },
          readPackedFixed32: function(arr) {
            if (this.type !== Pbf2.Bytes)
              return arr.push(this.readFixed32());
            var end = readPackedEnd(this);
            arr = arr || [];
            while (this.pos < end)
              arr.push(this.readFixed32());
            return arr;
          },
          readPackedSFixed32: function(arr) {
            if (this.type !== Pbf2.Bytes)
              return arr.push(this.readSFixed32());
            var end = readPackedEnd(this);
            arr = arr || [];
            while (this.pos < end)
              arr.push(this.readSFixed32());
            return arr;
          },
          readPackedFixed64: function(arr) {
            if (this.type !== Pbf2.Bytes)
              return arr.push(this.readFixed64());
            var end = readPackedEnd(this);
            arr = arr || [];
            while (this.pos < end)
              arr.push(this.readFixed64());
            return arr;
          },
          readPackedSFixed64: function(arr) {
            if (this.type !== Pbf2.Bytes)
              return arr.push(this.readSFixed64());
            var end = readPackedEnd(this);
            arr = arr || [];
            while (this.pos < end)
              arr.push(this.readSFixed64());
            return arr;
          },
          skip: function(val) {
            var type = val & 7;
            if (type === Pbf2.Varint)
              while (this.buf[this.pos++] > 127) {
              }
            else if (type === Pbf2.Bytes)
              this.pos = this.readVarint() + this.pos;
            else if (type === Pbf2.Fixed32)
              this.pos += 4;
            else if (type === Pbf2.Fixed64)
              this.pos += 8;
            else
              throw new Error("Unimplemented type: " + type);
          },
          writeTag: function(tag, type) {
            this.writeVarint(tag << 3 | type);
          },
          realloc: function(min) {
            var length = this.length || 16;
            while (length < this.pos + min)
              length *= 2;
            if (length !== this.length) {
              var buf = new Uint8Array(length);
              buf.set(this.buf);
              this.buf = buf;
              this.length = length;
            }
          },
          finish: function() {
            this.length = this.pos;
            this.pos = 0;
            return this.buf.subarray(0, this.length);
          },
          writeFixed32: function(val) {
            this.realloc(4);
            writeInt32(this.buf, val, this.pos);
            this.pos += 4;
          },
          writeSFixed32: function(val) {
            this.realloc(4);
            writeInt32(this.buf, val, this.pos);
            this.pos += 4;
          },
          writeFixed64: function(val) {
            this.realloc(8);
            writeInt32(this.buf, val & -1, this.pos);
            writeInt32(this.buf, Math.floor(val * SHIFT_RIGHT_32), this.pos + 4);
            this.pos += 8;
          },
          writeSFixed64: function(val) {
            this.realloc(8);
            writeInt32(this.buf, val & -1, this.pos);
            writeInt32(this.buf, Math.floor(val * SHIFT_RIGHT_32), this.pos + 4);
            this.pos += 8;
          },
          writeVarint: function(val) {
            val = +val || 0;
            if (val > 268435455 || val < 0) {
              writeBigVarint(val, this);
              return;
            }
            this.realloc(4);
            this.buf[this.pos++] = val & 127 | (val > 127 ? 128 : 0);
            if (val <= 127)
              return;
            this.buf[this.pos++] = (val >>>= 7) & 127 | (val > 127 ? 128 : 0);
            if (val <= 127)
              return;
            this.buf[this.pos++] = (val >>>= 7) & 127 | (val > 127 ? 128 : 0);
            if (val <= 127)
              return;
            this.buf[this.pos++] = val >>> 7 & 127;
          },
          writeSVarint: function(val) {
            this.writeVarint(val < 0 ? -val * 2 - 1 : val * 2);
          },
          writeBoolean: function(val) {
            this.writeVarint(Boolean(val));
          },
          writeString: function(str) {
            str = String(str);
            this.realloc(str.length * 4);
            this.pos++;
            var startPos = this.pos;
            this.pos = writeUtf8(this.buf, str, this.pos);
            var len = this.pos - startPos;
            if (len >= 128)
              makeRoomForExtraLength(startPos, len, this);
            this.pos = startPos - 1;
            this.writeVarint(len);
            this.pos += len;
          },
          writeFloat: function(val) {
            this.realloc(4);
            ieee754.write(this.buf, val, this.pos, true, 23, 4);
            this.pos += 4;
          },
          writeDouble: function(val) {
            this.realloc(8);
            ieee754.write(this.buf, val, this.pos, true, 52, 8);
            this.pos += 8;
          },
          writeBytes: function(buffer) {
            var len = buffer.length;
            this.writeVarint(len);
            this.realloc(len);
            for (var i = 0; i < len; i++)
              this.buf[this.pos++] = buffer[i];
          },
          writeRawMessage: function(fn, obj) {
            this.pos++;
            var startPos = this.pos;
            fn(obj, this);
            var len = this.pos - startPos;
            if (len >= 128)
              makeRoomForExtraLength(startPos, len, this);
            this.pos = startPos - 1;
            this.writeVarint(len);
            this.pos += len;
          },
          writeMessage: function(tag, fn, obj) {
            this.writeTag(tag, Pbf2.Bytes);
            this.writeRawMessage(fn, obj);
          },
          writePackedVarint: function(tag, arr) {
            if (arr.length)
              this.writeMessage(tag, writePackedVarint, arr);
          },
          writePackedSVarint: function(tag, arr) {
            if (arr.length)
              this.writeMessage(tag, writePackedSVarint, arr);
          },
          writePackedBoolean: function(tag, arr) {
            if (arr.length)
              this.writeMessage(tag, writePackedBoolean, arr);
          },
          writePackedFloat: function(tag, arr) {
            if (arr.length)
              this.writeMessage(tag, writePackedFloat, arr);
          },
          writePackedDouble: function(tag, arr) {
            if (arr.length)
              this.writeMessage(tag, writePackedDouble, arr);
          },
          writePackedFixed32: function(tag, arr) {
            if (arr.length)
              this.writeMessage(tag, writePackedFixed32, arr);
          },
          writePackedSFixed32: function(tag, arr) {
            if (arr.length)
              this.writeMessage(tag, writePackedSFixed32, arr);
          },
          writePackedFixed64: function(tag, arr) {
            if (arr.length)
              this.writeMessage(tag, writePackedFixed64, arr);
          },
          writePackedSFixed64: function(tag, arr) {
            if (arr.length)
              this.writeMessage(tag, writePackedSFixed64, arr);
          },
          writeBytesField: function(tag, buffer) {
            this.writeTag(tag, Pbf2.Bytes);
            this.writeBytes(buffer);
          },
          writeFixed32Field: function(tag, val) {
            this.writeTag(tag, Pbf2.Fixed32);
            this.writeFixed32(val);
          },
          writeSFixed32Field: function(tag, val) {
            this.writeTag(tag, Pbf2.Fixed32);
            this.writeSFixed32(val);
          },
          writeFixed64Field: function(tag, val) {
            this.writeTag(tag, Pbf2.Fixed64);
            this.writeFixed64(val);
          },
          writeSFixed64Field: function(tag, val) {
            this.writeTag(tag, Pbf2.Fixed64);
            this.writeSFixed64(val);
          },
          writeVarintField: function(tag, val) {
            this.writeTag(tag, Pbf2.Varint);
            this.writeVarint(val);
          },
          writeSVarintField: function(tag, val) {
            this.writeTag(tag, Pbf2.Varint);
            this.writeSVarint(val);
          },
          writeStringField: function(tag, str) {
            this.writeTag(tag, Pbf2.Bytes);
            this.writeString(str);
          },
          writeFloatField: function(tag, val) {
            this.writeTag(tag, Pbf2.Fixed32);
            this.writeFloat(val);
          },
          writeDoubleField: function(tag, val) {
            this.writeTag(tag, Pbf2.Fixed64);
            this.writeDouble(val);
          },
          writeBooleanField: function(tag, val) {
            this.writeVarintField(tag, Boolean(val));
          }
        };
        function readVarintRemainder(l, s, p) {
          var buf = p.buf, h, b;
          b = buf[p.pos++];
          h = (b & 112) >> 4;
          if (b < 128)
            return toNum(l, h, s);
          b = buf[p.pos++];
          h |= (b & 127) << 3;
          if (b < 128)
            return toNum(l, h, s);
          b = buf[p.pos++];
          h |= (b & 127) << 10;
          if (b < 128)
            return toNum(l, h, s);
          b = buf[p.pos++];
          h |= (b & 127) << 17;
          if (b < 128)
            return toNum(l, h, s);
          b = buf[p.pos++];
          h |= (b & 127) << 24;
          if (b < 128)
            return toNum(l, h, s);
          b = buf[p.pos++];
          h |= (b & 1) << 31;
          if (b < 128)
            return toNum(l, h, s);
          throw new Error("Expected varint not more than 10 bytes");
        }
        function readPackedEnd(pbf) {
          return pbf.type === Pbf2.Bytes ? pbf.readVarint() + pbf.pos : pbf.pos + 1;
        }
        function toNum(low, high, isSigned) {
          if (isSigned) {
            return high * 4294967296 + (low >>> 0);
          }
          return (high >>> 0) * 4294967296 + (low >>> 0);
        }
        function writeBigVarint(val, pbf) {
          var low, high;
          if (val >= 0) {
            low = val % 4294967296 | 0;
            high = val / 4294967296 | 0;
          } else {
            low = ~(-val % 4294967296);
            high = ~(-val / 4294967296);
            if (low ^ 4294967295) {
              low = low + 1 | 0;
            } else {
              low = 0;
              high = high + 1 | 0;
            }
          }
          if (val >= 18446744073709552e3 || val < -18446744073709552e3) {
            throw new Error("Given varint doesn't fit into 10 bytes");
          }
          pbf.realloc(10);
          writeBigVarintLow(low, high, pbf);
          writeBigVarintHigh(high, pbf);
        }
        function writeBigVarintLow(low, high, pbf) {
          pbf.buf[pbf.pos++] = low & 127 | 128;
          low >>>= 7;
          pbf.buf[pbf.pos++] = low & 127 | 128;
          low >>>= 7;
          pbf.buf[pbf.pos++] = low & 127 | 128;
          low >>>= 7;
          pbf.buf[pbf.pos++] = low & 127 | 128;
          low >>>= 7;
          pbf.buf[pbf.pos] = low & 127;
        }
        function writeBigVarintHigh(high, pbf) {
          var lsb = (high & 7) << 4;
          pbf.buf[pbf.pos++] |= lsb | ((high >>>= 3) ? 128 : 0);
          if (!high)
            return;
          pbf.buf[pbf.pos++] = high & 127 | ((high >>>= 7) ? 128 : 0);
          if (!high)
            return;
          pbf.buf[pbf.pos++] = high & 127 | ((high >>>= 7) ? 128 : 0);
          if (!high)
            return;
          pbf.buf[pbf.pos++] = high & 127 | ((high >>>= 7) ? 128 : 0);
          if (!high)
            return;
          pbf.buf[pbf.pos++] = high & 127 | ((high >>>= 7) ? 128 : 0);
          if (!high)
            return;
          pbf.buf[pbf.pos++] = high & 127;
        }
        function makeRoomForExtraLength(startPos, len, pbf) {
          var extraLen = len <= 16383 ? 1 : len <= 2097151 ? 2 : len <= 268435455 ? 3 : Math.floor(Math.log(len) / (Math.LN2 * 7));
          pbf.realloc(extraLen);
          for (var i = pbf.pos - 1; i >= startPos; i--)
            pbf.buf[i + extraLen] = pbf.buf[i];
        }
        function writePackedVarint(arr, pbf) {
          for (var i = 0; i < arr.length; i++)
            pbf.writeVarint(arr[i]);
        }
        function writePackedSVarint(arr, pbf) {
          for (var i = 0; i < arr.length; i++)
            pbf.writeSVarint(arr[i]);
        }
        function writePackedFloat(arr, pbf) {
          for (var i = 0; i < arr.length; i++)
            pbf.writeFloat(arr[i]);
        }
        function writePackedDouble(arr, pbf) {
          for (var i = 0; i < arr.length; i++)
            pbf.writeDouble(arr[i]);
        }
        function writePackedBoolean(arr, pbf) {
          for (var i = 0; i < arr.length; i++)
            pbf.writeBoolean(arr[i]);
        }
        function writePackedFixed32(arr, pbf) {
          for (var i = 0; i < arr.length; i++)
            pbf.writeFixed32(arr[i]);
        }
        function writePackedSFixed32(arr, pbf) {
          for (var i = 0; i < arr.length; i++)
            pbf.writeSFixed32(arr[i]);
        }
        function writePackedFixed64(arr, pbf) {
          for (var i = 0; i < arr.length; i++)
            pbf.writeFixed64(arr[i]);
        }
        function writePackedSFixed64(arr, pbf) {
          for (var i = 0; i < arr.length; i++)
            pbf.writeSFixed64(arr[i]);
        }
        function readUInt32(buf, pos) {
          return (buf[pos] | buf[pos + 1] << 8 | buf[pos + 2] << 16) + buf[pos + 3] * 16777216;
        }
        function writeInt32(buf, val, pos) {
          buf[pos] = val;
          buf[pos + 1] = val >>> 8;
          buf[pos + 2] = val >>> 16;
          buf[pos + 3] = val >>> 24;
        }
        function readInt32(buf, pos) {
          return (buf[pos] | buf[pos + 1] << 8 | buf[pos + 2] << 16) + (buf[pos + 3] << 24);
        }
        function readUtf8(buf, pos, end) {
          var str = "";
          var i = pos;
          while (i < end) {
            var b0 = buf[i];
            var c = null;
            var bytesPerSequence = b0 > 239 ? 4 : b0 > 223 ? 3 : b0 > 191 ? 2 : 1;
            if (i + bytesPerSequence > end)
              break;
            var b1, b2, b3;
            if (bytesPerSequence === 1) {
              if (b0 < 128) {
                c = b0;
              }
            } else if (bytesPerSequence === 2) {
              b1 = buf[i + 1];
              if ((b1 & 192) === 128) {
                c = (b0 & 31) << 6 | b1 & 63;
                if (c <= 127) {
                  c = null;
                }
              }
            } else if (bytesPerSequence === 3) {
              b1 = buf[i + 1];
              b2 = buf[i + 2];
              if ((b1 & 192) === 128 && (b2 & 192) === 128) {
                c = (b0 & 15) << 12 | (b1 & 63) << 6 | b2 & 63;
                if (c <= 2047 || c >= 55296 && c <= 57343) {
                  c = null;
                }
              }
            } else if (bytesPerSequence === 4) {
              b1 = buf[i + 1];
              b2 = buf[i + 2];
              b3 = buf[i + 3];
              if ((b1 & 192) === 128 && (b2 & 192) === 128 && (b3 & 192) === 128) {
                c = (b0 & 15) << 18 | (b1 & 63) << 12 | (b2 & 63) << 6 | b3 & 63;
                if (c <= 65535 || c >= 1114112) {
                  c = null;
                }
              }
            }
            if (c === null) {
              c = 65533;
              bytesPerSequence = 1;
            } else if (c > 65535) {
              c -= 65536;
              str += String.fromCharCode(c >>> 10 & 1023 | 55296);
              c = 56320 | c & 1023;
            }
            str += String.fromCharCode(c);
            i += bytesPerSequence;
          }
          return str;
        }
        function readUtf8TextDecoder(buf, pos, end) {
          return utf8TextDecoder.decode(buf.subarray(pos, end));
        }
        function writeUtf8(buf, str, pos) {
          for (var i = 0, c, lead; i < str.length; i++) {
            c = str.charCodeAt(i);
            if (c > 55295 && c < 57344) {
              if (lead) {
                if (c < 56320) {
                  buf[pos++] = 239;
                  buf[pos++] = 191;
                  buf[pos++] = 189;
                  lead = c;
                  continue;
                } else {
                  c = lead - 55296 << 10 | c - 56320 | 65536;
                  lead = null;
                }
              } else {
                if (c > 56319 || i + 1 === str.length) {
                  buf[pos++] = 239;
                  buf[pos++] = 191;
                  buf[pos++] = 189;
                } else {
                  lead = c;
                }
                continue;
              }
            } else if (lead) {
              buf[pos++] = 239;
              buf[pos++] = 191;
              buf[pos++] = 189;
              lead = null;
            }
            if (c < 128) {
              buf[pos++] = c;
            } else {
              if (c < 2048) {
                buf[pos++] = c >> 6 | 192;
              } else {
                if (c < 65536) {
                  buf[pos++] = c >> 12 | 224;
                } else {
                  buf[pos++] = c >> 18 | 240;
                  buf[pos++] = c >> 12 & 63 | 128;
                }
                buf[pos++] = c >> 6 & 63 | 128;
              }
              buf[pos++] = c & 63 | 128;
            }
          }
          return pos;
        }
      }
    });
    var require_encode = __commonJS2({
      "node_modules/geobuf/encode.js"(exports2, module22) {
        "use strict";
        module22.exports = encode;
        var keys;
        var keysNum;
        var keysArr;
        var dim;
        var e;
        var maxPrecision = 1e6;
        var geometryTypes = {
          "Point": 0,
          "MultiPoint": 1,
          "LineString": 2,
          "MultiLineString": 3,
          "Polygon": 4,
          "MultiPolygon": 5,
          "GeometryCollection": 6
        };
        function encode(obj, pbf) {
          keys = {};
          keysArr = [];
          keysNum = 0;
          dim = 0;
          e = 1;
          analyze(obj);
          e = Math.min(e, maxPrecision);
          var precision = Math.ceil(Math.log(e) / Math.LN10);
          for (var i = 0; i < keysArr.length; i++)
            pbf.writeStringField(1, keysArr[i]);
          if (dim !== 2)
            pbf.writeVarintField(2, dim);
          if (precision !== 6)
            pbf.writeVarintField(3, precision);
          if (obj.type === "FeatureCollection")
            pbf.writeMessage(4, writeFeatureCollection, obj);
          else if (obj.type === "Feature")
            pbf.writeMessage(5, writeFeature, obj);
          else
            pbf.writeMessage(6, writeGeometry, obj);
          keys = null;
          return pbf.finish();
        }
        function analyze(obj) {
          var i, key;
          if (obj.type === "FeatureCollection") {
            for (i = 0; i < obj.features.length; i++)
              analyze(obj.features[i]);
          } else if (obj.type === "Feature") {
            if (obj.geometry !== null)
              analyze(obj.geometry);
            for (key in obj.properties)
              saveKey(key);
          } else if (obj.type === "Point")
            analyzePoint(obj.coordinates);
          else if (obj.type === "MultiPoint")
            analyzePoints(obj.coordinates);
          else if (obj.type === "GeometryCollection") {
            for (i = 0; i < obj.geometries.length; i++)
              analyze(obj.geometries[i]);
          } else if (obj.type === "LineString")
            analyzePoints(obj.coordinates);
          else if (obj.type === "Polygon" || obj.type === "MultiLineString")
            analyzeMultiLine(obj.coordinates);
          else if (obj.type === "MultiPolygon") {
            for (i = 0; i < obj.coordinates.length; i++)
              analyzeMultiLine(obj.coordinates[i]);
          }
          for (key in obj) {
            if (!isSpecialKey(key, obj.type))
              saveKey(key);
          }
        }
        function analyzeMultiLine(coords) {
          for (var i = 0; i < coords.length; i++)
            analyzePoints(coords[i]);
        }
        function analyzePoints(coords) {
          for (var i = 0; i < coords.length; i++)
            analyzePoint(coords[i]);
        }
        function analyzePoint(point2) {
          dim = Math.max(dim, point2.length);
          for (var i = 0; i < point2.length; i++) {
            while (Math.round(point2[i] * e) / e !== point2[i] && e < maxPrecision)
              e *= 10;
          }
        }
        function saveKey(key) {
          if (keys[key] === void 0) {
            keysArr.push(key);
            keys[key] = keysNum++;
          }
        }
        function writeFeatureCollection(obj, pbf) {
          for (var i = 0; i < obj.features.length; i++) {
            pbf.writeMessage(1, writeFeature, obj.features[i]);
          }
          writeProps(obj, pbf, true);
        }
        function writeFeature(feature2, pbf) {
          if (feature2.geometry !== null)
            pbf.writeMessage(1, writeGeometry, feature2.geometry);
          if (feature2.id !== void 0) {
            if (typeof feature2.id === "number" && feature2.id % 1 === 0)
              pbf.writeSVarintField(12, feature2.id);
            else
              pbf.writeStringField(11, feature2.id);
          }
          if (feature2.properties)
            writeProps(feature2.properties, pbf);
          writeProps(feature2, pbf, true);
        }
        function writeGeometry(geom, pbf) {
          pbf.writeVarintField(1, geometryTypes[geom.type]);
          var coords = geom.coordinates;
          if (geom.type === "Point")
            writePoint(coords, pbf);
          else if (geom.type === "MultiPoint")
            writeLine(coords, pbf, true);
          else if (geom.type === "LineString")
            writeLine(coords, pbf);
          else if (geom.type === "MultiLineString")
            writeMultiLine(coords, pbf);
          else if (geom.type === "Polygon")
            writeMultiLine(coords, pbf, true);
          else if (geom.type === "MultiPolygon")
            writeMultiPolygon(coords, pbf);
          else if (geom.type === "GeometryCollection") {
            for (var i = 0; i < geom.geometries.length; i++)
              pbf.writeMessage(4, writeGeometry, geom.geometries[i]);
          }
          writeProps(geom, pbf, true);
        }
        function writeProps(props, pbf, isCustom) {
          var indexes = [], valueIndex = 0;
          for (var key in props) {
            if (isCustom && isSpecialKey(key, props.type)) {
              continue;
            }
            pbf.writeMessage(13, writeValue, props[key]);
            indexes.push(keys[key]);
            indexes.push(valueIndex++);
          }
          pbf.writePackedVarint(isCustom ? 15 : 14, indexes);
        }
        function writeValue(value, pbf) {
          if (value === null)
            return;
          var type = typeof value;
          if (type === "string")
            pbf.writeStringField(1, value);
          else if (type === "boolean")
            pbf.writeBooleanField(5, value);
          else if (type === "object")
            pbf.writeStringField(6, JSON.stringify(value));
          else if (type === "number") {
            if (value % 1 !== 0)
              pbf.writeDoubleField(2, value);
            else if (value >= 0)
              pbf.writeVarintField(3, value);
            else
              pbf.writeVarintField(4, -value);
          }
        }
        function writePoint(point2, pbf) {
          var coords = [];
          for (var i = 0; i < dim; i++)
            coords.push(Math.round(point2[i] * e));
          pbf.writePackedSVarint(3, coords);
        }
        function writeLine(line, pbf) {
          var coords = [];
          populateLine(coords, line);
          pbf.writePackedSVarint(3, coords);
        }
        function writeMultiLine(lines, pbf, closed) {
          var len = lines.length, i;
          if (len !== 1) {
            var lengths = [];
            for (i = 0; i < len; i++)
              lengths.push(lines[i].length - (closed ? 1 : 0));
            pbf.writePackedVarint(2, lengths);
          }
          var coords = [];
          for (i = 0; i < len; i++)
            populateLine(coords, lines[i], closed);
          pbf.writePackedSVarint(3, coords);
        }
        function writeMultiPolygon(polygons, pbf) {
          var len = polygons.length, i, j;
          if (len !== 1 || polygons[0].length !== 1) {
            var lengths = [len];
            for (i = 0; i < len; i++) {
              lengths.push(polygons[i].length);
              for (j = 0; j < polygons[i].length; j++)
                lengths.push(polygons[i][j].length - 1);
            }
            pbf.writePackedVarint(2, lengths);
          }
          var coords = [];
          for (i = 0; i < len; i++) {
            for (j = 0; j < polygons[i].length; j++)
              populateLine(coords, polygons[i][j], true);
          }
          pbf.writePackedSVarint(3, coords);
        }
        function populateLine(coords, line, closed) {
          var i, j, len = line.length - (closed ? 1 : 0), sum = new Array(dim);
          for (j = 0; j < dim; j++)
            sum[j] = 0;
          for (i = 0; i < len; i++) {
            for (j = 0; j < dim; j++) {
              var n = Math.round(line[i][j] * e) - sum[j];
              coords.push(n);
              sum[j] += n;
            }
          }
        }
        function isSpecialKey(key, type) {
          if (key === "type")
            return true;
          else if (type === "FeatureCollection") {
            if (key === "features")
              return true;
          } else if (type === "Feature") {
            if (key === "id" || key === "properties" || key === "geometry")
              return true;
          } else if (type === "GeometryCollection") {
            if (key === "geometries")
              return true;
          } else if (key === "coordinates")
            return true;
          return false;
        }
      }
    });
    var require_decode = __commonJS2({
      "node_modules/geobuf/decode.js"(exports2, module22) {
        "use strict";
        module22.exports = decode;
        var keys;
        var values;
        var lengths;
        var dim;
        var e;
        var geometryTypes = [
          "Point",
          "MultiPoint",
          "LineString",
          "MultiLineString",
          "Polygon",
          "MultiPolygon",
          "GeometryCollection"
        ];
        function decode(pbf) {
          dim = 2;
          e = Math.pow(10, 6);
          lengths = null;
          keys = [];
          values = [];
          var obj = pbf.readFields(readDataField, {});
          keys = null;
          return obj;
        }
        function readDataField(tag, obj, pbf) {
          if (tag === 1)
            keys.push(pbf.readString());
          else if (tag === 2)
            dim = pbf.readVarint();
          else if (tag === 3)
            e = Math.pow(10, pbf.readVarint());
          else if (tag === 4)
            readFeatureCollection(pbf, obj);
          else if (tag === 5)
            readFeature(pbf, obj);
          else if (tag === 6)
            readGeometry(pbf, obj);
        }
        function readFeatureCollection(pbf, obj) {
          obj.type = "FeatureCollection";
          obj.features = [];
          return pbf.readMessage(readFeatureCollectionField, obj);
        }
        function readFeature(pbf, feature2) {
          feature2.type = "Feature";
          var f = pbf.readMessage(readFeatureField, feature2);
          if (!("geometry" in f))
            f.geometry = null;
          return f;
        }
        function readGeometry(pbf, geom) {
          geom.type = "Point";
          return pbf.readMessage(readGeometryField, geom);
        }
        function readFeatureCollectionField(tag, obj, pbf) {
          if (tag === 1)
            obj.features.push(readFeature(pbf, {}));
          else if (tag === 13)
            values.push(readValue(pbf));
          else if (tag === 15)
            readProps(pbf, obj);
        }
        function readFeatureField(tag, feature2, pbf) {
          if (tag === 1)
            feature2.geometry = readGeometry(pbf, {});
          else if (tag === 11)
            feature2.id = pbf.readString();
          else if (tag === 12)
            feature2.id = pbf.readSVarint();
          else if (tag === 13)
            values.push(readValue(pbf));
          else if (tag === 14)
            feature2.properties = readProps(pbf, {});
          else if (tag === 15)
            readProps(pbf, feature2);
        }
        function readGeometryField(tag, geom, pbf) {
          if (tag === 1)
            geom.type = geometryTypes[pbf.readVarint()];
          else if (tag === 2)
            lengths = pbf.readPackedVarint();
          else if (tag === 3)
            readCoords(geom, pbf, geom.type);
          else if (tag === 4) {
            geom.geometries = geom.geometries || [];
            geom.geometries.push(readGeometry(pbf, {}));
          } else if (tag === 13)
            values.push(readValue(pbf));
          else if (tag === 15)
            readProps(pbf, geom);
        }
        function readCoords(geom, pbf, type) {
          if (type === "Point")
            geom.coordinates = readPoint(pbf);
          else if (type === "MultiPoint")
            geom.coordinates = readLine(pbf, true);
          else if (type === "LineString")
            geom.coordinates = readLine(pbf);
          else if (type === "MultiLineString")
            geom.coordinates = readMultiLine(pbf);
          else if (type === "Polygon")
            geom.coordinates = readMultiLine(pbf, true);
          else if (type === "MultiPolygon")
            geom.coordinates = readMultiPolygon(pbf);
        }
        function readValue(pbf) {
          var end = pbf.readVarint() + pbf.pos, value = null;
          while (pbf.pos < end) {
            var val = pbf.readVarint(), tag = val >> 3;
            if (tag === 1)
              value = pbf.readString();
            else if (tag === 2)
              value = pbf.readDouble();
            else if (tag === 3)
              value = pbf.readVarint();
            else if (tag === 4)
              value = -pbf.readVarint();
            else if (tag === 5)
              value = pbf.readBoolean();
            else if (tag === 6)
              value = JSON.parse(pbf.readString());
          }
          return value;
        }
        function readProps(pbf, props) {
          var end = pbf.readVarint() + pbf.pos;
          while (pbf.pos < end)
            props[keys[pbf.readVarint()]] = values[pbf.readVarint()];
          values = [];
          return props;
        }
        function readPoint(pbf) {
          var end = pbf.readVarint() + pbf.pos, coords = [];
          while (pbf.pos < end)
            coords.push(pbf.readSVarint() / e);
          return coords;
        }
        function readLinePart(pbf, end, len, closed) {
          var i = 0, coords = [], p, d;
          var prevP = [];
          for (d = 0; d < dim; d++)
            prevP[d] = 0;
          while (len ? i < len : pbf.pos < end) {
            p = [];
            for (d = 0; d < dim; d++) {
              prevP[d] += pbf.readSVarint();
              p[d] = prevP[d] / e;
            }
            coords.push(p);
            i++;
          }
          if (closed)
            coords.push(coords[0]);
          return coords;
        }
        function readLine(pbf) {
          return readLinePart(pbf, pbf.readVarint() + pbf.pos);
        }
        function readMultiLine(pbf, closed) {
          var end = pbf.readVarint() + pbf.pos;
          if (!lengths)
            return [readLinePart(pbf, end, null, closed)];
          var coords = [];
          for (var i = 0; i < lengths.length; i++)
            coords.push(readLinePart(pbf, end, lengths[i], closed));
          lengths = null;
          return coords;
        }
        function readMultiPolygon(pbf) {
          var end = pbf.readVarint() + pbf.pos;
          if (!lengths)
            return [[readLinePart(pbf, end, null, true)]];
          var coords = [];
          var j = 1;
          for (var i = 0; i < lengths[0]; i++) {
            var rings = [];
            for (var k = 0; k < lengths[j]; k++)
              rings.push(readLinePart(pbf, end, lengths[j + 1 + k], true));
            j += lengths[j] + 1;
            coords.push(rings);
          }
          lengths = null;
          return coords;
        }
      }
    });
    var require_geobuf = __commonJS2({
      "node_modules/geobuf/index.js"(exports2) {
        "use strict";
        exports2.encode = require_encode();
        exports2.decode = require_decode();
      }
    });
    var require_iterator = __commonJS2({
      "node_modules/obliterator/iterator.js"(exports2, module22) {
        function Iterator(next) {
          if (typeof next !== "function")
            throw new Error("obliterator/iterator: expecting a function!");
          this.next = next;
        }
        if (typeof Symbol !== "undefined")
          Iterator.prototype[Symbol.iterator] = function() {
            return this;
          };
        Iterator.of = function() {
          var args = arguments, l = args.length, i = 0;
          return new Iterator(function() {
            if (i >= l)
              return { done: true };
            return { done: false, value: args[i++] };
          });
        };
        Iterator.empty = function() {
          var iterator = new Iterator(function() {
            return { done: true };
          });
          return iterator;
        };
        Iterator.fromSequence = function(sequence) {
          var i = 0, l = sequence.length;
          return new Iterator(function() {
            if (i >= l)
              return { done: true };
            return { done: false, value: sequence[i++] };
          });
        };
        Iterator.is = function(value) {
          if (value instanceof Iterator)
            return true;
          return typeof value === "object" && value !== null && typeof value.next === "function";
        };
        module22.exports = Iterator;
      }
    });
    var require_support = __commonJS2({
      "node_modules/obliterator/support.js"(exports2) {
        exports2.ARRAY_BUFFER_SUPPORT = typeof ArrayBuffer !== "undefined";
        exports2.SYMBOL_SUPPORT = typeof Symbol !== "undefined";
      }
    });
    var require_foreach = __commonJS2({
      "node_modules/obliterator/foreach.js"(exports2, module22) {
        var support = require_support();
        var ARRAY_BUFFER_SUPPORT = support.ARRAY_BUFFER_SUPPORT;
        var SYMBOL_SUPPORT = support.SYMBOL_SUPPORT;
        module22.exports = function forEach(iterable, callback) {
          var iterator, k, i, l, s;
          if (!iterable)
            throw new Error("obliterator/forEach: invalid iterable.");
          if (typeof callback !== "function")
            throw new Error("obliterator/forEach: expecting a callback.");
          if (Array.isArray(iterable) || ARRAY_BUFFER_SUPPORT && ArrayBuffer.isView(iterable) || typeof iterable === "string" || iterable.toString() === "[object Arguments]") {
            for (i = 0, l = iterable.length; i < l; i++)
              callback(iterable[i], i);
            return;
          }
          if (typeof iterable.forEach === "function") {
            iterable.forEach(callback);
            return;
          }
          if (SYMBOL_SUPPORT && Symbol.iterator in iterable && typeof iterable.next !== "function") {
            iterable = iterable[Symbol.iterator]();
          }
          if (typeof iterable.next === "function") {
            iterator = iterable;
            i = 0;
            while (s = iterator.next(), s.done !== true) {
              callback(s.value, i);
              i++;
            }
            return;
          }
          for (k in iterable) {
            if (iterable.hasOwnProperty(k)) {
              callback(iterable[k], k);
            }
          }
          return;
        };
      }
    });
    var require_typed_arrays = __commonJS2({
      "node_modules/mnemonist/utils/typed-arrays.js"(exports2) {
        var MAX_8BIT_INTEGER = Math.pow(2, 8) - 1;
        var MAX_16BIT_INTEGER = Math.pow(2, 16) - 1;
        var MAX_32BIT_INTEGER = Math.pow(2, 32) - 1;
        var MAX_SIGNED_8BIT_INTEGER = Math.pow(2, 7) - 1;
        var MAX_SIGNED_16BIT_INTEGER = Math.pow(2, 15) - 1;
        var MAX_SIGNED_32BIT_INTEGER = Math.pow(2, 31) - 1;
        exports2.getPointerArray = function(size) {
          var maxIndex = size - 1;
          if (maxIndex <= MAX_8BIT_INTEGER)
            return Uint8Array;
          if (maxIndex <= MAX_16BIT_INTEGER)
            return Uint16Array;
          if (maxIndex <= MAX_32BIT_INTEGER)
            return Uint32Array;
          throw new Error("mnemonist: Pointer Array of size > 4294967295 is not supported.");
        };
        exports2.getSignedPointerArray = function(size) {
          var maxIndex = size - 1;
          if (maxIndex <= MAX_SIGNED_8BIT_INTEGER)
            return Int8Array;
          if (maxIndex <= MAX_SIGNED_16BIT_INTEGER)
            return Int16Array;
          if (maxIndex <= MAX_SIGNED_32BIT_INTEGER)
            return Int32Array;
          return Float64Array;
        };
        exports2.getNumberType = function(value) {
          if (value === (value | 0)) {
            if (Math.sign(value) === -1) {
              if (value <= 127 && value >= -128)
                return Int8Array;
              if (value <= 32767 && value >= -32768)
                return Int16Array;
              return Int32Array;
            } else {
              if (value <= 255)
                return Uint8Array;
              if (value <= 65535)
                return Uint16Array;
              return Uint32Array;
            }
          }
          return Float64Array;
        };
        var TYPE_PRIORITY = {
          Uint8Array: 1,
          Int8Array: 2,
          Uint16Array: 3,
          Int16Array: 4,
          Uint32Array: 5,
          Int32Array: 6,
          Float32Array: 7,
          Float64Array: 8
        };
        exports2.getMinimalRepresentation = function(array, getter) {
          var maxType = null, maxPriority = 0, p, t, v, i, l;
          for (i = 0, l = array.length; i < l; i++) {
            v = getter ? getter(array[i]) : array[i];
            t = exports2.getNumberType(v);
            p = TYPE_PRIORITY[t.name];
            if (p > maxPriority) {
              maxPriority = p;
              maxType = t;
            }
          }
          return maxType;
        };
        exports2.isTypedArray = function(value) {
          return typeof ArrayBuffer !== "undefined" && ArrayBuffer.isView(value);
        };
        exports2.concat = function() {
          var length = 0, i, o, l;
          for (i = 0, l = arguments.length; i < l; i++)
            length += arguments[i].length;
          var array = new arguments[0].constructor(length);
          for (i = 0, o = 0; i < l; i++) {
            array.set(arguments[i], o);
            o += arguments[i].length;
          }
          return array;
        };
        exports2.indices = function(length) {
          var PointerArray = exports2.getPointerArray(length);
          var array = new PointerArray(length);
          for (var i = 0; i < length; i++)
            array[i] = i;
          return array;
        };
      }
    });
    var require_iterables = __commonJS2({
      "node_modules/mnemonist/utils/iterables.js"(exports2) {
        var forEach = require_foreach();
        var typed = require_typed_arrays();
        function isArrayLike(target) {
          return Array.isArray(target) || typed.isTypedArray(target);
        }
        function guessLength(target) {
          if (typeof target.length === "number")
            return target.length;
          if (typeof target.size === "number")
            return target.size;
          return;
        }
        function toArray(target) {
          var l = guessLength(target);
          var array = typeof l === "number" ? new Array(l) : [];
          var i = 0;
          forEach(target, function(value) {
            array[i++] = value;
          });
          return array;
        }
        function toArrayWithIndices(target) {
          var l = guessLength(target);
          var IndexArray = typeof l === "number" ? typed.getPointerArray(l) : Array;
          var array = typeof l === "number" ? new Array(l) : [];
          var indices = typeof l === "number" ? new IndexArray(l) : [];
          var i = 0;
          forEach(target, function(value) {
            array[i] = value;
            indices[i] = i++;
          });
          return [array, indices];
        }
        exports2.isArrayLike = isArrayLike;
        exports2.guessLength = guessLength;
        exports2.toArray = toArray;
        exports2.toArrayWithIndices = toArrayWithIndices;
      }
    });
    var require_lru_cache = __commonJS2({
      "node_modules/mnemonist/lru-cache.js"(exports2, module22) {
        var Iterator = require_iterator();
        var forEach = require_foreach();
        var typed = require_typed_arrays();
        var iterables = require_iterables();
        function LRUCache2(Keys, Values, capacity) {
          if (arguments.length < 2) {
            capacity = Keys;
            Keys = null;
            Values = null;
          }
          this.capacity = capacity;
          if (typeof this.capacity !== "number" || this.capacity <= 0)
            throw new Error("mnemonist/lru-cache: capacity should be positive number.");
          else if (!isFinite(this.capacity) || Math.floor(this.capacity) !== this.capacity)
            throw new Error("mnemonist/lru-cache: capacity should be a finite positive integer.");
          var PointerArray = typed.getPointerArray(capacity);
          this.forward = new PointerArray(capacity);
          this.backward = new PointerArray(capacity);
          this.K = typeof Keys === "function" ? new Keys(capacity) : new Array(capacity);
          this.V = typeof Values === "function" ? new Values(capacity) : new Array(capacity);
          this.size = 0;
          this.head = 0;
          this.tail = 0;
          this.items = {};
        }
        LRUCache2.prototype.clear = function() {
          this.size = 0;
          this.head = 0;
          this.tail = 0;
          this.items = {};
        };
        LRUCache2.prototype.splayOnTop = function(pointer) {
          var oldHead = this.head;
          if (this.head === pointer)
            return this;
          var previous = this.backward[pointer], next = this.forward[pointer];
          if (this.tail === pointer) {
            this.tail = previous;
          } else {
            this.backward[next] = previous;
          }
          this.forward[previous] = next;
          this.backward[oldHead] = pointer;
          this.head = pointer;
          this.forward[pointer] = oldHead;
          return this;
        };
        LRUCache2.prototype.set = function(key, value) {
          var pointer = this.items[key];
          if (typeof pointer !== "undefined") {
            this.splayOnTop(pointer);
            this.V[pointer] = value;
            return;
          }
          if (this.size < this.capacity) {
            pointer = this.size++;
          } else {
            pointer = this.tail;
            this.tail = this.backward[pointer];
            delete this.items[this.K[pointer]];
          }
          this.items[key] = pointer;
          this.K[pointer] = key;
          this.V[pointer] = value;
          this.forward[pointer] = this.head;
          this.backward[this.head] = pointer;
          this.head = pointer;
        };
        LRUCache2.prototype.setpop = function(key, value) {
          var oldValue = null;
          var oldKey = null;
          var pointer = this.items[key];
          if (typeof pointer !== "undefined") {
            this.splayOnTop(pointer);
            oldValue = this.V[pointer];
            this.V[pointer] = value;
            return { evicted: false, key, value: oldValue };
          }
          if (this.size < this.capacity) {
            pointer = this.size++;
          } else {
            pointer = this.tail;
            this.tail = this.backward[pointer];
            oldValue = this.V[pointer];
            oldKey = this.K[pointer];
            delete this.items[this.K[pointer]];
          }
          this.items[key] = pointer;
          this.K[pointer] = key;
          this.V[pointer] = value;
          this.forward[pointer] = this.head;
          this.backward[this.head] = pointer;
          this.head = pointer;
          if (oldKey) {
            return { evicted: true, key: oldKey, value: oldValue };
          } else {
            return null;
          }
        };
        LRUCache2.prototype.has = function(key) {
          return key in this.items;
        };
        LRUCache2.prototype.get = function(key) {
          var pointer = this.items[key];
          if (typeof pointer === "undefined")
            return;
          this.splayOnTop(pointer);
          return this.V[pointer];
        };
        LRUCache2.prototype.peek = function(key) {
          var pointer = this.items[key];
          if (typeof pointer === "undefined")
            return;
          return this.V[pointer];
        };
        LRUCache2.prototype.forEach = function(callback, scope) {
          scope = arguments.length > 1 ? scope : this;
          var i = 0, l = this.size;
          var pointer = this.head, keys = this.K, values = this.V, forward = this.forward;
          while (i < l) {
            callback.call(scope, values[pointer], keys[pointer], this);
            pointer = forward[pointer];
            i++;
          }
        };
        LRUCache2.prototype.keys = function() {
          var i = 0, l = this.size;
          var pointer = this.head, keys = this.K, forward = this.forward;
          return new Iterator(function() {
            if (i >= l)
              return { done: true };
            var key = keys[pointer];
            i++;
            if (i < l)
              pointer = forward[pointer];
            return {
              done: false,
              value: key
            };
          });
        };
        LRUCache2.prototype.values = function() {
          var i = 0, l = this.size;
          var pointer = this.head, values = this.V, forward = this.forward;
          return new Iterator(function() {
            if (i >= l)
              return { done: true };
            var value = values[pointer];
            i++;
            if (i < l)
              pointer = forward[pointer];
            return {
              done: false,
              value
            };
          });
        };
        LRUCache2.prototype.entries = function() {
          var i = 0, l = this.size;
          var pointer = this.head, keys = this.K, values = this.V, forward = this.forward;
          return new Iterator(function() {
            if (i >= l)
              return { done: true };
            var key = keys[pointer], value = values[pointer];
            i++;
            if (i < l)
              pointer = forward[pointer];
            return {
              done: false,
              value: [key, value]
            };
          });
        };
        if (typeof Symbol !== "undefined")
          LRUCache2.prototype[Symbol.iterator] = LRUCache2.prototype.entries;
        LRUCache2.prototype.inspect = function() {
          var proxy = /* @__PURE__ */ new Map();
          var iterator = this.entries(), step;
          while (step = iterator.next(), !step.done)
            proxy.set(step.value[0], step.value[1]);
          Object.defineProperty(proxy, "constructor", {
            value: LRUCache2,
            enumerable: false
          });
          return proxy;
        };
        if (typeof Symbol !== "undefined")
          LRUCache2.prototype[Symbol.for("nodejs.util.inspect.custom")] = LRUCache2.prototype.inspect;
        LRUCache2.from = function(iterable, Keys, Values, capacity) {
          if (arguments.length < 2) {
            capacity = iterables.guessLength(iterable);
            if (typeof capacity !== "number")
              throw new Error("mnemonist/lru-cache.from: could not guess iterable length. Please provide desired capacity as last argument.");
          } else if (arguments.length === 2) {
            capacity = Keys;
            Keys = null;
            Values = null;
          }
          var cache = new LRUCache2(Keys, Values, capacity);
          forEach(iterable, function(value, key) {
            cache.set(key, value);
          });
          return cache;
        };
        module22.exports = LRUCache2;
      }
    });
    var require_rbush2 = __commonJS2({
      "node_modules/rbush/rbush.js"(exports2, module22) {
        (function(global, factory) {
          typeof exports2 === "object" && typeof module22 !== "undefined" ? module22.exports = factory() : typeof define === "function" && define.amd ? define(factory) : (global = global || self, global.RBush = factory());
        })(exports2, function() {
          "use strict";
          function quickselect(arr, k, left, right, compare) {
            quickselectStep(arr, k, left || 0, right || arr.length - 1, compare || defaultCompare);
          }
          function quickselectStep(arr, k, left, right, compare) {
            while (right > left) {
              if (right - left > 600) {
                var n = right - left + 1;
                var m = k - left + 1;
                var z = Math.log(n);
                var s = 0.5 * Math.exp(2 * z / 3);
                var sd = 0.5 * Math.sqrt(z * s * (n - s) / n) * (m - n / 2 < 0 ? -1 : 1);
                var newLeft = Math.max(left, Math.floor(k - m * s / n + sd));
                var newRight = Math.min(right, Math.floor(k + (n - m) * s / n + sd));
                quickselectStep(arr, k, newLeft, newRight, compare);
              }
              var t = arr[k];
              var i = left;
              var j = right;
              swap2(arr, left, k);
              if (compare(arr[right], t) > 0) {
                swap2(arr, left, right);
              }
              while (i < j) {
                swap2(arr, i, j);
                i++;
                j--;
                while (compare(arr[i], t) < 0) {
                  i++;
                }
                while (compare(arr[j], t) > 0) {
                  j--;
                }
              }
              if (compare(arr[left], t) === 0) {
                swap2(arr, left, j);
              } else {
                j++;
                swap2(arr, j, right);
              }
              if (j <= k) {
                left = j + 1;
              }
              if (k <= j) {
                right = j - 1;
              }
            }
          }
          function swap2(arr, i, j) {
            var tmp = arr[i];
            arr[i] = arr[j];
            arr[j] = tmp;
          }
          function defaultCompare(a, b) {
            return a < b ? -1 : a > b ? 1 : 0;
          }
          var RBush2 = function RBush3(maxEntries) {
            if (maxEntries === void 0)
              maxEntries = 9;
            this._maxEntries = Math.max(4, maxEntries);
            this._minEntries = Math.max(2, Math.ceil(this._maxEntries * 0.4));
            this.clear();
          };
          RBush2.prototype.all = function all() {
            return this._all(this.data, []);
          };
          RBush2.prototype.search = function search(bbox22) {
            var node = this.data;
            var result = [];
            if (!intersects2(bbox22, node)) {
              return result;
            }
            var toBBox = this.toBBox;
            var nodesToSearch = [];
            while (node) {
              for (var i = 0; i < node.children.length; i++) {
                var child = node.children[i];
                var childBBox = node.leaf ? toBBox(child) : child;
                if (intersects2(bbox22, childBBox)) {
                  if (node.leaf) {
                    result.push(child);
                  } else if (contains(bbox22, childBBox)) {
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
          RBush2.prototype.collides = function collides(bbox22) {
            var node = this.data;
            if (!intersects2(bbox22, node)) {
              return false;
            }
            var nodesToSearch = [];
            while (node) {
              for (var i = 0; i < node.children.length; i++) {
                var child = node.children[i];
                var childBBox = node.leaf ? this.toBBox(child) : child;
                if (intersects2(bbox22, childBBox)) {
                  if (node.leaf || contains(bbox22, childBBox)) {
                    return true;
                  }
                  nodesToSearch.push(child);
                }
              }
              node = nodesToSearch.pop();
            }
            return false;
          };
          RBush2.prototype.load = function load(data) {
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
          RBush2.prototype.insert = function insert(item) {
            if (item) {
              this._insert(item, this.data.height - 1);
            }
            return this;
          };
          RBush2.prototype.clear = function clear() {
            this.data = createNode([]);
            return this;
          };
          RBush2.prototype.remove = function remove(item, equalsFn) {
            if (!item) {
              return this;
            }
            var node = this.data;
            var bbox22 = this.toBBox(item);
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
              if (!goingUp && !node.leaf && contains(node, bbox22)) {
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
          RBush2.prototype.toBBox = function toBBox(item) {
            return item;
          };
          RBush2.prototype.compareMinX = function compareMinX(a, b) {
            return a.minX - b.minX;
          };
          RBush2.prototype.compareMinY = function compareMinY(a, b) {
            return a.minY - b.minY;
          };
          RBush2.prototype.toJSON = function toJSON() {
            return this.data;
          };
          RBush2.prototype.fromJSON = function fromJSON(data) {
            this.data = data;
            return this;
          };
          RBush2.prototype._all = function _all(node, result) {
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
          RBush2.prototype._build = function _build(items, left, right, height) {
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
          RBush2.prototype._chooseSubtree = function _chooseSubtree(bbox22, node, level, path) {
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
                var area = bboxArea(child);
                var enlargement = enlargedArea(bbox22, child) - area;
                if (enlargement < minEnlargement) {
                  minEnlargement = enlargement;
                  minArea = area < minArea ? area : minArea;
                  targetNode = child;
                } else if (enlargement === minEnlargement) {
                  if (area < minArea) {
                    minArea = area;
                    targetNode = child;
                  }
                }
              }
              node = targetNode || node.children[0];
            }
            return node;
          };
          RBush2.prototype._insert = function _insert(item, level, isNode) {
            var bbox22 = isNode ? item : this.toBBox(item);
            var insertPath = [];
            var node = this._chooseSubtree(bbox22, this.data, level, insertPath);
            node.children.push(item);
            extend(node, bbox22);
            while (level >= 0) {
              if (insertPath[level].children.length > this._maxEntries) {
                this._split(insertPath, level);
                level--;
              } else {
                break;
              }
            }
            this._adjustParentBBoxes(bbox22, insertPath, level);
          };
          RBush2.prototype._split = function _split(insertPath, level) {
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
          RBush2.prototype._splitRoot = function _splitRoot(node, newNode) {
            this.data = createNode([node, newNode]);
            this.data.height = node.height + 1;
            this.data.leaf = false;
            calcBBox(this.data, this.toBBox);
          };
          RBush2.prototype._chooseSplitIndex = function _chooseSplitIndex(node, m, M) {
            var index;
            var minOverlap = Infinity;
            var minArea = Infinity;
            for (var i = m; i <= M - m; i++) {
              var bbox1 = distBBox(node, 0, i, this.toBBox);
              var bbox22 = distBBox(node, i, M, this.toBBox);
              var overlap = intersectionArea(bbox1, bbox22);
              var area = bboxArea(bbox1) + bboxArea(bbox22);
              if (overlap < minOverlap) {
                minOverlap = overlap;
                index = i;
                minArea = area < minArea ? area : minArea;
              } else if (overlap === minOverlap) {
                if (area < minArea) {
                  minArea = area;
                  index = i;
                }
              }
            }
            return index || M - m;
          };
          RBush2.prototype._chooseSplitAxis = function _chooseSplitAxis(node, m, M) {
            var compareMinX = node.leaf ? this.compareMinX : compareNodeMinX;
            var compareMinY = node.leaf ? this.compareMinY : compareNodeMinY;
            var xMargin = this._allDistMargin(node, m, M, compareMinX);
            var yMargin = this._allDistMargin(node, m, M, compareMinY);
            if (xMargin < yMargin) {
              node.children.sort(compareMinX);
            }
          };
          RBush2.prototype._allDistMargin = function _allDistMargin(node, m, M, compare) {
            node.children.sort(compare);
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
          RBush2.prototype._adjustParentBBoxes = function _adjustParentBBoxes(bbox22, path, level) {
            for (var i = level; i >= 0; i--) {
              extend(path[i], bbox22);
            }
          };
          RBush2.prototype._condense = function _condense(path) {
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
          function intersects2(a, b) {
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
          function multiSelect(arr, left, right, n, compare) {
            var stack = [left, right];
            while (stack.length) {
              right = stack.pop();
              left = stack.pop();
              if (right - left <= n) {
                continue;
              }
              var mid = left + Math.ceil((right - left) / n / 2) * n;
              quickselect(arr, mid, left, right, compare);
              stack.push(left, mid, mid, right);
            }
          }
          return RBush2;
        });
      }
    });
    var require_js4 = __commonJS2({
      "node_modules/@turf/helpers/dist/js/index.js"(exports2) {
        "use strict";
        Object.defineProperty(exports2, "__esModule", { value: true });
        exports2.earthRadius = 63710088e-1;
        exports2.factors = {
          centimeters: exports2.earthRadius * 100,
          centimetres: exports2.earthRadius * 100,
          degrees: exports2.earthRadius / 111325,
          feet: exports2.earthRadius * 3.28084,
          inches: exports2.earthRadius * 39.37,
          kilometers: exports2.earthRadius / 1e3,
          kilometres: exports2.earthRadius / 1e3,
          meters: exports2.earthRadius,
          metres: exports2.earthRadius,
          miles: exports2.earthRadius / 1609.344,
          millimeters: exports2.earthRadius * 1e3,
          millimetres: exports2.earthRadius * 1e3,
          nauticalmiles: exports2.earthRadius / 1852,
          radians: 1,
          yards: exports2.earthRadius * 1.0936
        };
        exports2.unitsFactors = {
          centimeters: 100,
          centimetres: 100,
          degrees: 1 / 111325,
          feet: 3.28084,
          inches: 39.37,
          kilometers: 1 / 1e3,
          kilometres: 1 / 1e3,
          meters: 1,
          metres: 1,
          miles: 1 / 1609.344,
          millimeters: 1e3,
          millimetres: 1e3,
          nauticalmiles: 1 / 1852,
          radians: 1 / exports2.earthRadius,
          yards: 1.0936133
        };
        exports2.areaFactors = {
          acres: 247105e-9,
          centimeters: 1e4,
          centimetres: 1e4,
          feet: 10.763910417,
          hectares: 1e-4,
          inches: 1550.003100006,
          kilometers: 1e-6,
          kilometres: 1e-6,
          meters: 1,
          metres: 1,
          miles: 386e-9,
          millimeters: 1e6,
          millimetres: 1e6,
          yards: 1.195990046
        };
        function feature2(geom, properties, options) {
          if (options === void 0) {
            options = {};
          }
          var feat = { type: "Feature" };
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
        exports2.feature = feature2;
        function geometry(type, coordinates, _options) {
          if (_options === void 0) {
            _options = {};
          }
          switch (type) {
            case "Point":
              return point2(coordinates).geometry;
            case "LineString":
              return lineString2(coordinates).geometry;
            case "Polygon":
              return polygon(coordinates).geometry;
            case "MultiPoint":
              return multiPoint(coordinates).geometry;
            case "MultiLineString":
              return multiLineString2(coordinates).geometry;
            case "MultiPolygon":
              return multiPolygon(coordinates).geometry;
            default:
              throw new Error(type + " is invalid");
          }
        }
        exports2.geometry = geometry;
        function point2(coordinates, properties, options) {
          if (options === void 0) {
            options = {};
          }
          if (!coordinates) {
            throw new Error("coordinates is required");
          }
          if (!Array.isArray(coordinates)) {
            throw new Error("coordinates must be an Array");
          }
          if (coordinates.length < 2) {
            throw new Error("coordinates must be at least 2 numbers long");
          }
          if (!isNumber2(coordinates[0]) || !isNumber2(coordinates[1])) {
            throw new Error("coordinates must contain numbers");
          }
          var geom = {
            type: "Point",
            coordinates
          };
          return feature2(geom, properties, options);
        }
        exports2.point = point2;
        function points(coordinates, properties, options) {
          if (options === void 0) {
            options = {};
          }
          return featureCollection22(coordinates.map(function(coords) {
            return point2(coords, properties);
          }), options);
        }
        exports2.points = points;
        function polygon(coordinates, properties, options) {
          if (options === void 0) {
            options = {};
          }
          for (var _i = 0, coordinates_1 = coordinates; _i < coordinates_1.length; _i++) {
            var ring = coordinates_1[_i];
            if (ring.length < 4) {
              throw new Error("Each LinearRing of a Polygon must have 4 or more Positions.");
            }
            for (var j = 0; j < ring[ring.length - 1].length; j++) {
              if (ring[ring.length - 1][j] !== ring[0][j]) {
                throw new Error("First and last Position are not equivalent.");
              }
            }
          }
          var geom = {
            type: "Polygon",
            coordinates
          };
          return feature2(geom, properties, options);
        }
        exports2.polygon = polygon;
        function polygons(coordinates, properties, options) {
          if (options === void 0) {
            options = {};
          }
          return featureCollection22(coordinates.map(function(coords) {
            return polygon(coords, properties);
          }), options);
        }
        exports2.polygons = polygons;
        function lineString2(coordinates, properties, options) {
          if (options === void 0) {
            options = {};
          }
          if (coordinates.length < 2) {
            throw new Error("coordinates must be an array of two or more positions");
          }
          var geom = {
            type: "LineString",
            coordinates
          };
          return feature2(geom, properties, options);
        }
        exports2.lineString = lineString2;
        function lineStrings(coordinates, properties, options) {
          if (options === void 0) {
            options = {};
          }
          return featureCollection22(coordinates.map(function(coords) {
            return lineString2(coords, properties);
          }), options);
        }
        exports2.lineStrings = lineStrings;
        function featureCollection22(features, options) {
          if (options === void 0) {
            options = {};
          }
          var fc = { type: "FeatureCollection" };
          if (options.id) {
            fc.id = options.id;
          }
          if (options.bbox) {
            fc.bbox = options.bbox;
          }
          fc.features = features;
          return fc;
        }
        exports2.featureCollection = featureCollection22;
        function multiLineString2(coordinates, properties, options) {
          if (options === void 0) {
            options = {};
          }
          var geom = {
            type: "MultiLineString",
            coordinates
          };
          return feature2(geom, properties, options);
        }
        exports2.multiLineString = multiLineString2;
        function multiPoint(coordinates, properties, options) {
          if (options === void 0) {
            options = {};
          }
          var geom = {
            type: "MultiPoint",
            coordinates
          };
          return feature2(geom, properties, options);
        }
        exports2.multiPoint = multiPoint;
        function multiPolygon(coordinates, properties, options) {
          if (options === void 0) {
            options = {};
          }
          var geom = {
            type: "MultiPolygon",
            coordinates
          };
          return feature2(geom, properties, options);
        }
        exports2.multiPolygon = multiPolygon;
        function geometryCollection(geometries, properties, options) {
          if (options === void 0) {
            options = {};
          }
          var geom = {
            type: "GeometryCollection",
            geometries
          };
          return feature2(geom, properties, options);
        }
        exports2.geometryCollection = geometryCollection;
        function round(num, precision) {
          if (precision === void 0) {
            precision = 0;
          }
          if (precision && !(precision >= 0)) {
            throw new Error("precision must be a positive number");
          }
          var multiplier = Math.pow(10, precision || 0);
          return Math.round(num * multiplier) / multiplier;
        }
        exports2.round = round;
        function radiansToLength(radians, units) {
          if (units === void 0) {
            units = "kilometers";
          }
          var factor = exports2.factors[units];
          if (!factor) {
            throw new Error(units + " units is invalid");
          }
          return radians * factor;
        }
        exports2.radiansToLength = radiansToLength;
        function lengthToRadians(distance, units) {
          if (units === void 0) {
            units = "kilometers";
          }
          var factor = exports2.factors[units];
          if (!factor) {
            throw new Error(units + " units is invalid");
          }
          return distance / factor;
        }
        exports2.lengthToRadians = lengthToRadians;
        function lengthToDegrees(distance, units) {
          return radiansToDegrees(lengthToRadians(distance, units));
        }
        exports2.lengthToDegrees = lengthToDegrees;
        function bearingToAzimuth(bearing) {
          var angle = bearing % 360;
          if (angle < 0) {
            angle += 360;
          }
          return angle;
        }
        exports2.bearingToAzimuth = bearingToAzimuth;
        function radiansToDegrees(radians) {
          var degrees = radians % (2 * Math.PI);
          return degrees * 180 / Math.PI;
        }
        exports2.radiansToDegrees = radiansToDegrees;
        function degreesToRadians(degrees) {
          var radians = degrees % 360;
          return radians * Math.PI / 180;
        }
        exports2.degreesToRadians = degreesToRadians;
        function convertLength(length, originalUnit, finalUnit) {
          if (originalUnit === void 0) {
            originalUnit = "kilometers";
          }
          if (finalUnit === void 0) {
            finalUnit = "kilometers";
          }
          if (!(length >= 0)) {
            throw new Error("length must be a positive number");
          }
          return radiansToLength(lengthToRadians(length, originalUnit), finalUnit);
        }
        exports2.convertLength = convertLength;
        function convertArea(area, originalUnit, finalUnit) {
          if (originalUnit === void 0) {
            originalUnit = "meters";
          }
          if (finalUnit === void 0) {
            finalUnit = "kilometers";
          }
          if (!(area >= 0)) {
            throw new Error("area must be a positive number");
          }
          var startFactor = exports2.areaFactors[originalUnit];
          if (!startFactor) {
            throw new Error("invalid original units");
          }
          var finalFactor = exports2.areaFactors[finalUnit];
          if (!finalFactor) {
            throw new Error("invalid final units");
          }
          return area / startFactor * finalFactor;
        }
        exports2.convertArea = convertArea;
        function isNumber2(num) {
          return !isNaN(num) && num !== null && !Array.isArray(num);
        }
        exports2.isNumber = isNumber2;
        function isObject2(input) {
          return !!input && input.constructor === Object;
        }
        exports2.isObject = isObject2;
        function validateBBox(bbox22) {
          if (!bbox22) {
            throw new Error("bbox is required");
          }
          if (!Array.isArray(bbox22)) {
            throw new Error("bbox must be an Array");
          }
          if (bbox22.length !== 4 && bbox22.length !== 6) {
            throw new Error("bbox must be an Array of 4 or 6 numbers");
          }
          bbox22.forEach(function(num) {
            if (!isNumber2(num)) {
              throw new Error("bbox must only contain numbers");
            }
          });
        }
        exports2.validateBBox = validateBBox;
        function validateId(id) {
          if (!id) {
            throw new Error("id is required");
          }
          if (["string", "number"].indexOf(typeof id) === -1) {
            throw new Error("id must be a number or a string");
          }
        }
        exports2.validateId = validateId;
      }
    });
    var require_js22 = __commonJS2({
      "node_modules/@turf/meta/dist/js/index.js"(exports2) {
        "use strict";
        Object.defineProperty(exports2, "__esModule", { value: true });
        var helpers = require_js4();
        function coordEach2(geojson, callback, excludeWrapCoord) {
          if (geojson === null)
            return;
          var j, k, l, geometry, stopG, coords, geometryMaybeCollection, wrapShrink = 0, coordIndex = 0, isGeometryCollection, type = geojson.type, isFeatureCollection = type === "FeatureCollection", isFeature = type === "Feature", stop = isFeatureCollection ? geojson.features.length : 1;
          for (var featureIndex = 0; featureIndex < stop; featureIndex++) {
            geometryMaybeCollection = isFeatureCollection ? geojson.features[featureIndex].geometry : isFeature ? geojson.geometry : geojson;
            isGeometryCollection = geometryMaybeCollection ? geometryMaybeCollection.type === "GeometryCollection" : false;
            stopG = isGeometryCollection ? geometryMaybeCollection.geometries.length : 1;
            for (var geomIndex = 0; geomIndex < stopG; geomIndex++) {
              var multiFeatureIndex = 0;
              var geometryIndex = 0;
              geometry = isGeometryCollection ? geometryMaybeCollection.geometries[geomIndex] : geometryMaybeCollection;
              if (geometry === null)
                continue;
              coords = geometry.coordinates;
              var geomType = geometry.type;
              wrapShrink = excludeWrapCoord && (geomType === "Polygon" || geomType === "MultiPolygon") ? 1 : 0;
              switch (geomType) {
                case null:
                  break;
                case "Point":
                  if (callback(coords, coordIndex, featureIndex, multiFeatureIndex, geometryIndex) === false)
                    return false;
                  coordIndex++;
                  multiFeatureIndex++;
                  break;
                case "LineString":
                case "MultiPoint":
                  for (j = 0; j < coords.length; j++) {
                    if (callback(coords[j], coordIndex, featureIndex, multiFeatureIndex, geometryIndex) === false)
                      return false;
                    coordIndex++;
                    if (geomType === "MultiPoint")
                      multiFeatureIndex++;
                  }
                  if (geomType === "LineString")
                    multiFeatureIndex++;
                  break;
                case "Polygon":
                case "MultiLineString":
                  for (j = 0; j < coords.length; j++) {
                    for (k = 0; k < coords[j].length - wrapShrink; k++) {
                      if (callback(coords[j][k], coordIndex, featureIndex, multiFeatureIndex, geometryIndex) === false)
                        return false;
                      coordIndex++;
                    }
                    if (geomType === "MultiLineString")
                      multiFeatureIndex++;
                    if (geomType === "Polygon")
                      geometryIndex++;
                  }
                  if (geomType === "Polygon")
                    multiFeatureIndex++;
                  break;
                case "MultiPolygon":
                  for (j = 0; j < coords.length; j++) {
                    geometryIndex = 0;
                    for (k = 0; k < coords[j].length; k++) {
                      for (l = 0; l < coords[j][k].length - wrapShrink; l++) {
                        if (callback(coords[j][k][l], coordIndex, featureIndex, multiFeatureIndex, geometryIndex) === false)
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
                    if (coordEach2(geometry.geometries[j], callback, excludeWrapCoord) === false)
                      return false;
                  break;
                default:
                  throw new Error("Unknown Geometry Type");
              }
            }
          }
        }
        function coordReduce(geojson, callback, initialValue, excludeWrapCoord) {
          var previousValue = initialValue;
          coordEach2(geojson, function(currentCoord, coordIndex, featureIndex, multiFeatureIndex, geometryIndex) {
            if (coordIndex === 0 && initialValue === void 0)
              previousValue = currentCoord;
            else
              previousValue = callback(previousValue, currentCoord, coordIndex, featureIndex, multiFeatureIndex, geometryIndex);
          }, excludeWrapCoord);
          return previousValue;
        }
        function propEach(geojson, callback) {
          var i;
          switch (geojson.type) {
            case "FeatureCollection":
              for (i = 0; i < geojson.features.length; i++) {
                if (callback(geojson.features[i].properties, i) === false)
                  break;
              }
              break;
            case "Feature":
              callback(geojson.properties, 0);
              break;
          }
        }
        function propReduce(geojson, callback, initialValue) {
          var previousValue = initialValue;
          propEach(geojson, function(currentProperties, featureIndex) {
            if (featureIndex === 0 && initialValue === void 0)
              previousValue = currentProperties;
            else
              previousValue = callback(previousValue, currentProperties, featureIndex);
          });
          return previousValue;
        }
        function featureEach2(geojson, callback) {
          if (geojson.type === "Feature") {
            callback(geojson, 0);
          } else if (geojson.type === "FeatureCollection") {
            for (var i = 0; i < geojson.features.length; i++) {
              if (callback(geojson.features[i], i) === false)
                break;
            }
          }
        }
        function featureReduce(geojson, callback, initialValue) {
          var previousValue = initialValue;
          featureEach2(geojson, function(currentFeature, featureIndex) {
            if (featureIndex === 0 && initialValue === void 0)
              previousValue = currentFeature;
            else
              previousValue = callback(previousValue, currentFeature, featureIndex);
          });
          return previousValue;
        }
        function coordAll(geojson) {
          var coords = [];
          coordEach2(geojson, function(coord) {
            coords.push(coord);
          });
          return coords;
        }
        function geomEach2(geojson, callback) {
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
                if (callback(null, featureIndex, featureProperties, featureBBox, featureId) === false)
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
                  if (callback(geometry, featureIndex, featureProperties, featureBBox, featureId) === false)
                    return false;
                  break;
                }
                case "GeometryCollection": {
                  for (j = 0; j < geometry.geometries.length; j++) {
                    if (callback(geometry.geometries[j], featureIndex, featureProperties, featureBBox, featureId) === false)
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
          geomEach2(geojson, function(currentGeometry, featureIndex, featureProperties, featureBBox, featureId) {
            if (featureIndex === 0 && initialValue === void 0)
              previousValue = currentGeometry;
            else
              previousValue = callback(previousValue, currentGeometry, featureIndex, featureProperties, featureBBox, featureId);
          });
          return previousValue;
        }
        function flattenEach2(geojson, callback) {
          geomEach2(geojson, function(geometry, featureIndex, properties, bbox22, id) {
            var type = geometry === null ? null : geometry.type;
            switch (type) {
              case null:
              case "Point":
              case "LineString":
              case "Polygon":
                if (callback(helpers.feature(geometry, properties, { bbox: bbox22, id }), featureIndex, 0) === false)
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
              if (callback(helpers.feature(geom, properties), featureIndex, multiFeatureIndex) === false)
                return false;
            }
          });
        }
        function flattenReduce(geojson, callback, initialValue) {
          var previousValue = initialValue;
          flattenEach2(geojson, function(currentFeature, featureIndex, multiFeatureIndex) {
            if (featureIndex === 0 && multiFeatureIndex === 0 && initialValue === void 0)
              previousValue = currentFeature;
            else
              previousValue = callback(previousValue, currentFeature, featureIndex, multiFeatureIndex);
          });
          return previousValue;
        }
        function segmentEach(geojson, callback) {
          flattenEach2(geojson, function(feature2, featureIndex, multiFeatureIndex) {
            var segmentIndex = 0;
            if (!feature2.geometry)
              return;
            var type = feature2.geometry.type;
            if (type === "Point" || type === "MultiPoint")
              return;
            var previousCoords;
            var previousFeatureIndex = 0;
            var previousMultiIndex = 0;
            var prevGeomIndex = 0;
            if (coordEach2(feature2, function(currentCoord, coordIndex, featureIndexCoord, multiPartIndexCoord, geometryIndex) {
              if (previousCoords === void 0 || featureIndex > previousFeatureIndex || multiPartIndexCoord > previousMultiIndex || geometryIndex > prevGeomIndex) {
                previousCoords = currentCoord;
                previousFeatureIndex = featureIndex;
                previousMultiIndex = multiPartIndexCoord;
                prevGeomIndex = geometryIndex;
                segmentIndex = 0;
                return;
              }
              var currentSegment = helpers.lineString([previousCoords, currentCoord], feature2.properties);
              if (callback(currentSegment, featureIndex, multiFeatureIndex, geometryIndex, segmentIndex) === false)
                return false;
              segmentIndex++;
              previousCoords = currentCoord;
            }) === false)
              return false;
          });
        }
        function segmentReduce(geojson, callback, initialValue) {
          var previousValue = initialValue;
          var started = false;
          segmentEach(geojson, function(currentSegment, featureIndex, multiFeatureIndex, geometryIndex, segmentIndex) {
            if (started === false && initialValue === void 0)
              previousValue = currentSegment;
            else
              previousValue = callback(previousValue, currentSegment, featureIndex, multiFeatureIndex, geometryIndex, segmentIndex);
            started = true;
          });
          return previousValue;
        }
        function lineEach(geojson, callback) {
          if (!geojson)
            throw new Error("geojson is required");
          flattenEach2(geojson, function(feature2, featureIndex, multiFeatureIndex) {
            if (feature2.geometry === null)
              return;
            var type = feature2.geometry.type;
            var coords = feature2.geometry.coordinates;
            switch (type) {
              case "LineString":
                if (callback(feature2, featureIndex, multiFeatureIndex, 0, 0) === false)
                  return false;
                break;
              case "Polygon":
                for (var geometryIndex = 0; geometryIndex < coords.length; geometryIndex++) {
                  if (callback(helpers.lineString(coords[geometryIndex], feature2.properties), featureIndex, multiFeatureIndex, geometryIndex) === false)
                    return false;
                }
                break;
            }
          });
        }
        function lineReduce(geojson, callback, initialValue) {
          var previousValue = initialValue;
          lineEach(geojson, function(currentLine, featureIndex, multiFeatureIndex, geometryIndex) {
            if (featureIndex === 0 && initialValue === void 0)
              previousValue = currentLine;
            else
              previousValue = callback(previousValue, currentLine, featureIndex, multiFeatureIndex, geometryIndex);
          });
          return previousValue;
        }
        function findSegment(geojson, options) {
          options = options || {};
          if (!helpers.isObject(options))
            throw new Error("options is invalid");
          var featureIndex = options.featureIndex || 0;
          var multiFeatureIndex = options.multiFeatureIndex || 0;
          var geometryIndex = options.geometryIndex || 0;
          var segmentIndex = options.segmentIndex || 0;
          var properties = options.properties;
          var geometry;
          switch (geojson.type) {
            case "FeatureCollection":
              if (featureIndex < 0)
                featureIndex = geojson.features.length + featureIndex;
              properties = properties || geojson.features[featureIndex].properties;
              geometry = geojson.features[featureIndex].geometry;
              break;
            case "Feature":
              properties = properties || geojson.properties;
              geometry = geojson.geometry;
              break;
            case "Point":
            case "MultiPoint":
              return null;
            case "LineString":
            case "Polygon":
            case "MultiLineString":
            case "MultiPolygon":
              geometry = geojson;
              break;
            default:
              throw new Error("geojson is invalid");
          }
          if (geometry === null)
            return null;
          var coords = geometry.coordinates;
          switch (geometry.type) {
            case "Point":
            case "MultiPoint":
              return null;
            case "LineString":
              if (segmentIndex < 0)
                segmentIndex = coords.length + segmentIndex - 1;
              return helpers.lineString([coords[segmentIndex], coords[segmentIndex + 1]], properties, options);
            case "Polygon":
              if (geometryIndex < 0)
                geometryIndex = coords.length + geometryIndex;
              if (segmentIndex < 0)
                segmentIndex = coords[geometryIndex].length + segmentIndex - 1;
              return helpers.lineString([
                coords[geometryIndex][segmentIndex],
                coords[geometryIndex][segmentIndex + 1]
              ], properties, options);
            case "MultiLineString":
              if (multiFeatureIndex < 0)
                multiFeatureIndex = coords.length + multiFeatureIndex;
              if (segmentIndex < 0)
                segmentIndex = coords[multiFeatureIndex].length + segmentIndex - 1;
              return helpers.lineString([
                coords[multiFeatureIndex][segmentIndex],
                coords[multiFeatureIndex][segmentIndex + 1]
              ], properties, options);
            case "MultiPolygon":
              if (multiFeatureIndex < 0)
                multiFeatureIndex = coords.length + multiFeatureIndex;
              if (geometryIndex < 0)
                geometryIndex = coords[multiFeatureIndex].length + geometryIndex;
              if (segmentIndex < 0)
                segmentIndex = coords[multiFeatureIndex][geometryIndex].length - segmentIndex - 1;
              return helpers.lineString([
                coords[multiFeatureIndex][geometryIndex][segmentIndex],
                coords[multiFeatureIndex][geometryIndex][segmentIndex + 1]
              ], properties, options);
          }
          throw new Error("geojson is invalid");
        }
        function findPoint(geojson, options) {
          options = options || {};
          if (!helpers.isObject(options))
            throw new Error("options is invalid");
          var featureIndex = options.featureIndex || 0;
          var multiFeatureIndex = options.multiFeatureIndex || 0;
          var geometryIndex = options.geometryIndex || 0;
          var coordIndex = options.coordIndex || 0;
          var properties = options.properties;
          var geometry;
          switch (geojson.type) {
            case "FeatureCollection":
              if (featureIndex < 0)
                featureIndex = geojson.features.length + featureIndex;
              properties = properties || geojson.features[featureIndex].properties;
              geometry = geojson.features[featureIndex].geometry;
              break;
            case "Feature":
              properties = properties || geojson.properties;
              geometry = geojson.geometry;
              break;
            case "Point":
            case "MultiPoint":
              return null;
            case "LineString":
            case "Polygon":
            case "MultiLineString":
            case "MultiPolygon":
              geometry = geojson;
              break;
            default:
              throw new Error("geojson is invalid");
          }
          if (geometry === null)
            return null;
          var coords = geometry.coordinates;
          switch (geometry.type) {
            case "Point":
              return helpers.point(coords, properties, options);
            case "MultiPoint":
              if (multiFeatureIndex < 0)
                multiFeatureIndex = coords.length + multiFeatureIndex;
              return helpers.point(coords[multiFeatureIndex], properties, options);
            case "LineString":
              if (coordIndex < 0)
                coordIndex = coords.length + coordIndex;
              return helpers.point(coords[coordIndex], properties, options);
            case "Polygon":
              if (geometryIndex < 0)
                geometryIndex = coords.length + geometryIndex;
              if (coordIndex < 0)
                coordIndex = coords[geometryIndex].length + coordIndex;
              return helpers.point(coords[geometryIndex][coordIndex], properties, options);
            case "MultiLineString":
              if (multiFeatureIndex < 0)
                multiFeatureIndex = coords.length + multiFeatureIndex;
              if (coordIndex < 0)
                coordIndex = coords[multiFeatureIndex].length + coordIndex;
              return helpers.point(coords[multiFeatureIndex][coordIndex], properties, options);
            case "MultiPolygon":
              if (multiFeatureIndex < 0)
                multiFeatureIndex = coords.length + multiFeatureIndex;
              if (geometryIndex < 0)
                geometryIndex = coords[multiFeatureIndex].length + geometryIndex;
              if (coordIndex < 0)
                coordIndex = coords[multiFeatureIndex][geometryIndex].length - coordIndex;
              return helpers.point(coords[multiFeatureIndex][geometryIndex][coordIndex], properties, options);
          }
          throw new Error("geojson is invalid");
        }
        exports2.coordAll = coordAll;
        exports2.coordEach = coordEach2;
        exports2.coordReduce = coordReduce;
        exports2.featureEach = featureEach2;
        exports2.featureReduce = featureReduce;
        exports2.findPoint = findPoint;
        exports2.findSegment = findSegment;
        exports2.flattenEach = flattenEach2;
        exports2.flattenReduce = flattenReduce;
        exports2.geomEach = geomEach2;
        exports2.geomReduce = geomReduce;
        exports2.lineEach = lineEach;
        exports2.lineReduce = lineReduce;
        exports2.propEach = propEach;
        exports2.propReduce = propReduce;
        exports2.segmentEach = segmentEach;
        exports2.segmentReduce = segmentReduce;
      }
    });
    var require_js32 = __commonJS2({
      "node_modules/@turf/bbox/dist/js/index.js"(exports2) {
        "use strict";
        Object.defineProperty(exports2, "__esModule", { value: true });
        var meta_1 = require_js22();
        function bbox22(geojson) {
          var result = [Infinity, Infinity, -Infinity, -Infinity];
          meta_1.coordEach(geojson, function(coord) {
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
        bbox22["default"] = bbox22;
        exports2.default = bbox22;
      }
    });
    var require_getEvents = __commonJS2({
      "node_modules/union-subdivided-polygons/dist/src/getEvents.js"(exports2) {
        "use strict";
        var __spreadArrays = exports2 && exports2.__spreadArrays || function() {
          for (var s = 0, i = 0, il = arguments.length; i < il; i++)
            s += arguments[i].length;
          for (var r = Array(s), k = 0, i = 0; i < il; i++)
            for (var a = arguments[i], j = 0, jl = a.length; j < jl; j++, k++)
              r[k] = a[j];
          return r;
        };
        var __importDefault = exports2 && exports2.__importDefault || function(mod) {
          return mod && mod.__esModule ? mod : { "default": mod };
        };
        Object.defineProperty(exports2, "__esModule", { value: true });
        var bbox_1 = __importDefault(require_js32());
        function getEventsAndInteriorRings(collection, originalIdField) {
          var independentFeatures = [];
          var oidCounts = {};
          if (originalIdField) {
            for (var _i = 0, _a = collection.features; _i < _a.length; _i++) {
              var feature2 = _a[_i];
              if (feature2.properties && feature2.properties[originalIdField]) {
                var key = feature2.properties[originalIdField];
                oidCounts[key] = (oidCounts[key] || 0) + 1;
              }
            }
          }
          var bboxes = [];
          var idSequence = 0;
          var polygonIdSequence = 0;
          var events = [];
          var interiorRings = {};
          for (var fi = 0; fi < collection.features.length; fi++) {
            var feature2 = collection.features[fi];
            if (originalIdField && feature2.properties && feature2.properties[originalIdField] && oidCounts[feature2.properties[originalIdField]] === 1) {
              independentFeatures.push(feature2);
              continue;
            }
            var bbox22 = feature2.bbox || bbox_1.default(feature2);
            bboxes.push(bbox22);
            var polygons = void 0;
            if (feature2.geometry.type === "Polygon") {
              polygons = [feature2.geometry.coordinates];
            } else {
              polygons = feature2.geometry.coordinates;
            }
            var _loop_1 = function(polygon2) {
              var polygonId = polygonIdSequence++;
              interiorRings[polygonId] = polygon2.slice(1);
              var exteriorRing = polygon2[0];
              var firstEvent = null;
              var previousEvent = null;
              var _loop_2 = function() {
                var position = exteriorRing[i];
                if (previousEvent && previousEvent.position[0] === position[0] && previousEvent.position[1] === position[1]) {
                  var removed = events.pop();
                  if (firstEvent && firstEvent === removed) {
                    firstEvent = null;
                    previousEvent = null;
                  } else {
                    previousEvent = events[events.length - 1];
                  }
                }
                if (i === exteriorRing.length - 1) {
                  previousEvent.next = firstEvent;
                  firstEvent.trailingCoordinates = __spreadArrays(exteriorRing.slice(previousEvent.index + 1, i), firstEvent.trailingCoordinates);
                  return "break";
                }
                var onLeft = position[0] === bbox22[0];
                var onRight = position[0] === bbox22[2];
                var onBottom = position[1] === bbox22[1];
                var onTop = position[1] === bbox22[3];
                if (onLeft || onRight || onTop || onBottom || i === exteriorRing.length - 1) {
                  var isRightAngle = function() {
                    var before = exteriorRing[i - 1];
                    var after = exteriorRing[i + 1];
                    if (i === 0) {
                      before = exteriorRing[exteriorRing.length - 2];
                    } else if (i === exteriorRing.length - 1) {
                      after = exteriorRing[1];
                    }
                    return isNinetyDegrees(position, before, after);
                  };
                  var onCorner = onLeft && onBottom || onBottom && onRight || onTop && onRight || onTop && onLeft;
                  var e = {
                    id: idSequence++,
                    position,
                    featureId: fi,
                    polygonId,
                    index: i,
                    trailingCoordinates: [],
                    isNinetyDegreeCorner: onCorner && isRightAngle(),
                    onCorner,
                    next: null
                  };
                  if (previousEvent) {
                    previousEvent.next = e;
                    e.trailingCoordinates = exteriorRing.slice(previousEvent.index + 1, i);
                  } else {
                    e.trailingCoordinates = exteriorRing.slice(0, i);
                    firstEvent = e;
                  }
                  events.push(e);
                  previousEvent = e;
                }
              };
              for (var i = 0; i < exteriorRing.length; i++) {
                var state_1 = _loop_2();
                if (state_1 === "break")
                  break;
              }
            };
            for (var _b = 0, polygons_1 = polygons; _b < polygons_1.length; _b++) {
              var polygon = polygons_1[_b];
              _loop_1(polygon);
            }
          }
          return {
            events,
            interiorRings,
            bboxes,
            independentFeatures
          };
        }
        exports2.default = getEventsAndInteriorRings;
        function isNinetyDegrees(center, before, after) {
          return before[0] === center[0] && after[1] === center[1] || before[1] === center[1] && after[0] === center[0];
        }
      }
    });
    var require_makePolygons = __commonJS2({
      "node_modules/union-subdivided-polygons/dist/src/makePolygons.js"(exports2) {
        "use strict";
        var __spreadArrays = exports2 && exports2.__spreadArrays || function() {
          for (var s = 0, i = 0, il = arguments.length; i < il; i++)
            s += arguments[i].length;
          for (var r = Array(s), k = 0, i = 0; i < il; i++)
            for (var a = arguments[i], j = 0, jl = a.length; j < jl; j++, k++)
              r[k] = a[j];
          return r;
        };
        Object.defineProperty(exports2, "__esModule", { value: true });
        var Direction;
        (function(Direction2) {
          Direction2[Direction2["Horizontal"] = 0] = "Horizontal";
          Direction2[Direction2["Vertical"] = 1] = "Vertical";
        })(Direction || (Direction = {}));
        function makePolygons(collection, index, interiorRings, originalIdField) {
          index.resetProcessedState();
          var outputCollection = {
            type: "FeatureCollection",
            features: []
          };
          var nextExteriorRing = index.getNextExteriorRing();
          var _loop_1 = function() {
            var event_1 = nextExteriorRing;
            var prev = null;
            var addedPositions = {};
            var duplicateCoordinateLocations = [];
            var coordinates = [event_1.position];
            var hasEventOffEdge = false;
            var collectedFeatureIds = [];
            var _loop_2 = function() {
              if (coordinates.length > 1 && event_1.position[0] === nextExteriorRing.position[0] && event_1.position[1] === nextExteriorRing.position[1]) {
                return "break";
              }
              hasEventOffEdge = hasEventOffEdge || event_1.trailingCoordinates.length > 0;
              index.recordTouchedPolygons([event_1.polygonId]);
              if (collectedFeatureIds.indexOf(event_1.featureId) === -1) {
                collectedFeatureIds.push(event_1.featureId);
              }
              var key = event_1.position.join(",");
              if (addedPositions[key]) {
                duplicateCoordinateLocations.push(addedPositions[key].index, coordinates.length - 1);
                addedPositions[key].count++;
                if (addedPositions[key].count > 3) {
                  throw new Error("Looping through the same path");
                }
              } else {
                addedPositions[key] = {
                  index: coordinates.length - 1,
                  count: 1
                };
              }
              var destination = pickNext(event_1, index);
              if (event_1.next.trailingCoordinates.length === 0 && (event_1.position[0] === destination.position[0] || event_1.position[1] === destination.position[1])) {
                var _a2 = eventsInPlane(event_1, destination, index), behind_1 = _a2.behind, inPath = _a2.inPath;
                if (!behind_1.find(function(e) {
                  return e.polygonId === (event_1 === null || event_1 === void 0 ? void 0 : event_1.polygonId) || e.polygonId === (prev === null || prev === void 0 ? void 0 : prev.polygonId) || addedPositions[e.position.join(",")] && !(e !== prev && behind_1.length === 1 && e === nextExteriorRing);
                })) {
                  if (behind_1.length > 1 && behind_1[0].position[0] === behind_1[1].position[0] && behind_1[0].position[1] === behind_1[1].position[1]) {
                    var commonPlane_1 = event_1.position[0] === behind_1[0].position[0] ? 0 : 1;
                    behind_1 = __spreadArrays(behind_1.slice(0, 2).filter(function(e) {
                      return e.next.trailingCoordinates.length > 0 || e.next.position[commonPlane_1] !== behind_1[0].position[commonPlane_1];
                    }), behind_1.slice(2));
                  }
                  if (behind_1.length && behind_1.length % 2 !== 0) {
                    coordinates.push(behind_1[0].position);
                    prev = event_1;
                    event_1 = behind_1[0];
                    return "continue";
                  }
                }
                if (inPath.length) {
                  coordinates.push(inPath[0].position);
                  prev = event_1;
                  event_1 = inPath[0];
                  return "continue";
                }
              }
              coordinates.push.apply(coordinates, event_1.next.trailingCoordinates);
              if (!duplicateCoPlanarEvents(event_1, destination)) {
                coordinates.push(destination.position);
              }
              prev = event_1;
              event_1 = destination;
            };
            while (event_1) {
              var state_1 = _loop_2();
              if (state_1 === "break")
                break;
            }
            event_1 = null;
            prev = null;
            if (hasEventOffEdge) {
              var interior = [];
              for (var _i = 0, _a = index.getTouchedPolygonIds(); _i < _a.length; _i++) {
                var id = _a[_i];
                interior.push.apply(interior, interiorRings[id]);
              }
              var properties = collection.features[collectedFeatureIds[0]].properties;
              var segments = [];
              if (duplicateCoordinateLocations.length) {
                duplicateCoordinateLocations.sort(function(a, b) {
                  return a - b;
                });
                for (var i = 0; i < duplicateCoordinateLocations.length; i++) {
                  segments.push(coordinates.slice(i === 0 ? 0 : duplicateCoordinateLocations[i - 1], duplicateCoordinateLocations[i] + 1));
                  if (i === duplicateCoordinateLocations.length - 1) {
                    segments.push(coordinates.slice(duplicateCoordinateLocations[i] + 1));
                  }
                }
                while (segments.length) {
                  var coordinates_1 = [];
                  if (segments.length === 1) {
                    coordinates_1 = segments.pop();
                  } else if (segments.length > 1) {
                    coordinates_1 = __spreadArrays(segments.shift(), segments.pop());
                  }
                  var feature2 = {
                    type: "Feature",
                    properties,
                    geometry: {
                      type: "Polygon",
                      coordinates: __spreadArrays([
                        coordinates_1
                      ], interior)
                    }
                  };
                  outputCollection.features.push(feature2);
                }
              } else {
                var feature2 = {
                  type: "Feature",
                  properties,
                  geometry: {
                    type: "Polygon",
                    coordinates: __spreadArrays([
                      coordinates
                    ], interior)
                  }
                };
                outputCollection.features.push(feature2);
              }
            }
            index.markTouchedPolygonsAsProcessed();
            nextExteriorRing = index.getNextExteriorRing();
          };
          while (nextExteriorRing) {
            _loop_1();
          }
          if (originalIdField) {
            var byId = outputCollection.features.reduce(function(lookup, feature2) {
              var _a;
              if (!feature2.properties) {
                throw new Error("originalIdField supplied but properties not present on feature");
              }
              var existing = lookup[feature2.properties[originalIdField].toString()];
              if (existing) {
                if (existing.geometry.type === "Polygon") {
                  existing.geometry.type = "MultiPolygon";
                  existing.geometry.coordinates = [existing.geometry.coordinates];
                }
                if (existing.geometry.type === "MultiPolygon") {
                  if (feature2.geometry.type === "MultiPolygon") {
                    (_a = existing.geometry.coordinates).push.apply(_a, feature2.geometry.coordinates);
                  } else {
                    existing.geometry.coordinates.push(feature2.geometry.coordinates);
                  }
                }
              } else {
                lookup[feature2.properties[originalIdField].toString()] = feature2;
              }
              return lookup;
            }, {});
            outputCollection.features = Object.values(byId);
          }
          return outputCollection;
        }
        exports2.default = makePolygons;
        function duplicateCoPlanarEvents(start, destination) {
          if (destination.trailingCoordinates.length || destination.next.trailingCoordinates) {
            return false;
          }
          var straightX = start.position[0] === destination.position[0] && destination.position[0] === destination.next.position[0];
          var straightY = start.position[1] === destination.position[1] && destination.position[1] === destination.next.position[1];
          return straightX || straightY;
        }
        function pickNext(origin, index) {
          var overlapping = index.getByPosition(origin.next.position).filter(function(e) {
            return e.polygonId !== origin.polygonId;
          });
          if (overlapping.length === 0) {
            return origin.next;
          } else {
            var nextEvent = overlapping.sort(function(a, b) {
              if (a.isNinetyDegreeCorner && !b.isNinetyDegreeCorner) {
                return 1;
              } else if (b.isNinetyDegreeCorner && !a.isNinetyDegreeCorner) {
                return -1;
              } else {
                return 0;
              }
            })[0];
            return nextEvent;
          }
        }
        function eventsInPlane(start, destination, index) {
          var direction = start.position[0] === destination.position[0] ? Direction.Vertical : Direction.Horizontal;
          var vary = direction === Direction.Vertical ? 1 : 0;
          var events = direction === Direction.Vertical ? index.getByX(start.position) : index.getByY(start.position);
          var ascending = start.position[vary] < destination.position[vary];
          return {
            behind: events.filter(function(e) {
              return ascending ? e.position[vary] < start.position[vary] : e.position[vary] > start.position[vary];
            }).sort(function(a, b) {
              if (ascending) {
                return b.position[vary] - a.position[vary];
              } else {
                return a.position[vary] - b.position[vary];
              }
            }),
            inPath: events.filter(function(e) {
              return ascending ? e.position[vary] > start.position[vary] && e.position[vary] < destination.position[vary] : e.position[vary] < start.position[vary] && e.position[vary] > destination.position[vary];
            }).sort(function(a, b) {
              if (ascending) {
                return a.position[vary] - b.position[vary];
              } else {
                return b.position[vary] - a.position[vary];
              }
            })
          };
        }
      }
    });
    var require_eventIndex = __commonJS2({
      "node_modules/union-subdivided-polygons/dist/src/eventIndex.js"(exports2) {
        "use strict";
        Object.defineProperty(exports2, "__esModule", { value: true });
        var EventIndex = function() {
          function EventIndex2(events) {
            this.events = [];
            this.byPosition = {};
            this.byX = {};
            this.byY = {};
            this.removedPolygonIds = {};
            this.touchedPolygonIds = {};
            this.touchTable = {};
            this.events = events;
            for (var _i = 0, events_1 = events; _i < events_1.length; _i++) {
              var event_1 = events_1[_i];
              var key = event_1.position.join(",");
              if (key in this.byPosition) {
                this.byPosition[key].push(event_1);
              } else {
                this.byPosition[key] = [event_1];
              }
              if (event_1.position[0] in this.byX) {
                this.byX[event_1.position[0]].push(event_1);
              } else {
                this.byX[event_1.position[0]] = [event_1];
              }
              if (event_1.position[1] in this.byY) {
                this.byY[event_1.position[1]].push(event_1);
              } else {
                this.byY[event_1.position[1]] = [event_1];
              }
            }
            for (var _a = 0, events_2 = events; _a < events_2.length; _a++) {
              var event_2 = events_2[_a];
              if (!(event_2.polygonId in this.touchTable)) {
                this.touchTable[event_2.polygonId] = {};
              }
              var overlapping = this.getByPosition(event_2.position);
              for (var _b = 0, overlapping_1 = overlapping; _b < overlapping_1.length; _b++) {
                var e = overlapping_1[_b];
                this.touchTable[event_2.polygonId][e.polygonId] = true;
              }
            }
          }
          EventIndex2.prototype.getByPosition = function(position) {
            var _this = this;
            return this.byPosition[position.join(",")].filter(function(e) {
              return !_this.removedPolygonIds[e.polygonId];
            });
          };
          EventIndex2.prototype.getByX = function(position) {
            var _this = this;
            return this.byX[position[0]].filter(function(e) {
              return !_this.removedPolygonIds[e.polygonId];
            });
          };
          EventIndex2.prototype.getByY = function(position) {
            var _this = this;
            return this.byY[position[1]].filter(function(e) {
              return !_this.removedPolygonIds[e.polygonId];
            });
          };
          EventIndex2.prototype.getNextExteriorRing = function() {
            var exteriorEvent = null;
            for (var i = 0; i < this.events.length; i++) {
              var event_3 = this.events[i];
              if (!this.removedPolygonIds[event_3.polygonId]) {
                if (!exteriorEvent || event_3.position[0] < exteriorEvent.position[0]) {
                  exteriorEvent = event_3;
                }
              }
            }
            if (exteriorEvent) {
              var inPlane = this.getByX(exteriorEvent.position);
              if (inPlane.length > 0) {
                exteriorEvent = inPlane.sort(function(a, b) {
                  return b.position[1] - a.position[1];
                })[0];
              }
            }
            return exteriorEvent;
          };
          EventIndex2.prototype.markTouchedPolygonsAsProcessed = function() {
            for (var key in this.touchedPolygonIds) {
              this.removedPolygonIds[key] = true;
              for (var touching in this.touchTable[key]) {
                this.removedPolygonIds[touching] = true;
              }
            }
            this.touchedPolygonIds = {};
          };
          EventIndex2.prototype.recordTouchedPolygons = function(polygonIds) {
            for (var _i = 0, polygonIds_1 = polygonIds; _i < polygonIds_1.length; _i++) {
              var id = polygonIds_1[_i];
              this.touchedPolygonIds[id] = true;
            }
          };
          EventIndex2.prototype.resetProcessedState = function() {
            this.removedPolygonIds = {};
            this.touchedPolygonIds = {};
          };
          EventIndex2.prototype.getTouchedPolygonIds = function() {
            return Object.keys(this.touchedPolygonIds).map(function(k) {
              return parseInt(k);
            });
          };
          return EventIndex2;
        }();
        exports2.EventIndex = EventIndex;
      }
    });
    var require_dist = __commonJS2({
      "node_modules/union-subdivided-polygons/dist/index.js"(exports2) {
        "use strict";
        var __importDefault = exports2 && exports2.__importDefault || function(mod) {
          return mod && mod.__esModule ? mod : { "default": mod };
        };
        Object.defineProperty(exports2, "__esModule", { value: true });
        var getEvents_1 = __importDefault(require_getEvents());
        var makePolygons_1 = __importDefault(require_makePolygons());
        var eventIndex_1 = require_eventIndex();
        function union2(collection, originalIdProperty) {
          var _a;
          var _b = getEvents_1.default(collection, originalIdProperty), events = _b.events, interiorRings = _b.interiorRings, independentFeatures = _b.independentFeatures;
          var index = new eventIndex_1.EventIndex(events);
          var outputCollection = makePolygons_1.default(collection, index, interiorRings);
          (_a = outputCollection.features).push.apply(_a, independentFeatures);
          return outputCollection;
        }
        exports2.union = union2;
      }
    });
    var lib_exports = {};
    __export2(lib_exports, {
      DEFAULTS: () => DEFAULTS,
      VectorDataSource: () => VectorDataSource2
    });
    module2.exports = __toCommonJS2(lib_exports);
    var FlatQueue = class {
      constructor() {
        this.ids = [];
        this.values = [];
        this.length = 0;
      }
      clear() {
        this.length = 0;
      }
      push(id, value) {
        let pos = this.length++;
        while (pos > 0) {
          const parent = pos - 1 >> 1;
          const parentValue = this.values[parent];
          if (value >= parentValue)
            break;
          this.ids[pos] = this.ids[parent];
          this.values[pos] = parentValue;
          pos = parent;
        }
        this.ids[pos] = id;
        this.values[pos] = value;
      }
      pop() {
        if (this.length === 0)
          return void 0;
        const top = this.ids[0];
        this.length--;
        if (this.length > 0) {
          const id = this.ids[0] = this.ids[this.length];
          const value = this.values[0] = this.values[this.length];
          const halfLength = this.length >> 1;
          let pos = 0;
          while (pos < halfLength) {
            let left = (pos << 1) + 1;
            const right = left + 1;
            let bestIndex = this.ids[left];
            let bestValue = this.values[left];
            const rightValue = this.values[right];
            if (right < this.length && rightValue < bestValue) {
              left = right;
              bestIndex = this.ids[right];
              bestValue = rightValue;
            }
            if (bestValue >= value)
              break;
            this.ids[pos] = bestIndex;
            this.values[pos] = bestValue;
            pos = left;
          }
          this.ids[pos] = id;
          this.values[pos] = value;
        }
        return top;
      }
      peek() {
        if (this.length === 0)
          return void 0;
        return this.ids[0];
      }
      peekValue() {
        if (this.length === 0)
          return void 0;
        return this.values[0];
      }
      shrink() {
        this.ids.length = this.values.length = this.length;
      }
    };
    var ARRAY_TYPES = [
      Int8Array,
      Uint8Array,
      Uint8ClampedArray,
      Int16Array,
      Uint16Array,
      Int32Array,
      Uint32Array,
      Float32Array,
      Float64Array
    ];
    var VERSION = 3;
    var Flatbush = class {
      static from(data) {
        if (!(data instanceof ArrayBuffer)) {
          throw new Error("Data must be an instance of ArrayBuffer.");
        }
        const [magic, versionAndType] = new Uint8Array(data, 0, 2);
        if (magic !== 251) {
          throw new Error("Data does not appear to be in a Flatbush format.");
        }
        if (versionAndType >> 4 !== VERSION) {
          throw new Error(`Got v${versionAndType >> 4} data when expected v${VERSION}.`);
        }
        const [nodeSize] = new Uint16Array(data, 2, 1);
        const [numItems] = new Uint32Array(data, 4, 1);
        return new Flatbush(numItems, nodeSize, ARRAY_TYPES[versionAndType & 15], data);
      }
      constructor(numItems, nodeSize = 16, ArrayType = Float64Array, data) {
        if (numItems === void 0)
          throw new Error("Missing required argument: numItems.");
        if (isNaN(numItems) || numItems <= 0)
          throw new Error(`Unpexpected numItems value: ${numItems}.`);
        this.numItems = +numItems;
        this.nodeSize = Math.min(Math.max(+nodeSize, 2), 65535);
        let n = numItems;
        let numNodes = n;
        this._levelBounds = [n * 4];
        do {
          n = Math.ceil(n / this.nodeSize);
          numNodes += n;
          this._levelBounds.push(numNodes * 4);
        } while (n !== 1);
        this.ArrayType = ArrayType || Float64Array;
        this.IndexArrayType = numNodes < 16384 ? Uint16Array : Uint32Array;
        const arrayTypeIndex = ARRAY_TYPES.indexOf(this.ArrayType);
        const nodesByteSize = numNodes * 4 * this.ArrayType.BYTES_PER_ELEMENT;
        if (arrayTypeIndex < 0) {
          throw new Error(`Unexpected typed array class: ${ArrayType}.`);
        }
        if (data && data instanceof ArrayBuffer) {
          this.data = data;
          this._boxes = new this.ArrayType(this.data, 8, numNodes * 4);
          this._indices = new this.IndexArrayType(this.data, 8 + nodesByteSize, numNodes);
          this._pos = numNodes * 4;
          this.minX = this._boxes[this._pos - 4];
          this.minY = this._boxes[this._pos - 3];
          this.maxX = this._boxes[this._pos - 2];
          this.maxY = this._boxes[this._pos - 1];
        } else {
          this.data = new ArrayBuffer(8 + nodesByteSize + numNodes * this.IndexArrayType.BYTES_PER_ELEMENT);
          this._boxes = new this.ArrayType(this.data, 8, numNodes * 4);
          this._indices = new this.IndexArrayType(this.data, 8 + nodesByteSize, numNodes);
          this._pos = 0;
          this.minX = Infinity;
          this.minY = Infinity;
          this.maxX = -Infinity;
          this.maxY = -Infinity;
          new Uint8Array(this.data, 0, 2).set([251, (VERSION << 4) + arrayTypeIndex]);
          new Uint16Array(this.data, 2, 1)[0] = nodeSize;
          new Uint32Array(this.data, 4, 1)[0] = numItems;
        }
        this._queue = new FlatQueue();
      }
      add(minX, minY, maxX, maxY) {
        const index = this._pos >> 2;
        this._indices[index] = index;
        this._boxes[this._pos++] = minX;
        this._boxes[this._pos++] = minY;
        this._boxes[this._pos++] = maxX;
        this._boxes[this._pos++] = maxY;
        if (minX < this.minX)
          this.minX = minX;
        if (minY < this.minY)
          this.minY = minY;
        if (maxX > this.maxX)
          this.maxX = maxX;
        if (maxY > this.maxY)
          this.maxY = maxY;
        return index;
      }
      finish() {
        if (this._pos >> 2 !== this.numItems) {
          throw new Error(`Added ${this._pos >> 2} items when expected ${this.numItems}.`);
        }
        if (this.numItems <= this.nodeSize) {
          this._boxes[this._pos++] = this.minX;
          this._boxes[this._pos++] = this.minY;
          this._boxes[this._pos++] = this.maxX;
          this._boxes[this._pos++] = this.maxY;
          return;
        }
        const width = this.maxX - this.minX || 1;
        const height = this.maxY - this.minY || 1;
        const hilbertValues = new Uint32Array(this.numItems);
        const hilbertMax = (1 << 16) - 1;
        for (let i = 0; i < this.numItems; i++) {
          let pos = 4 * i;
          const minX = this._boxes[pos++];
          const minY = this._boxes[pos++];
          const maxX = this._boxes[pos++];
          const maxY = this._boxes[pos++];
          const x = Math.floor(hilbertMax * ((minX + maxX) / 2 - this.minX) / width);
          const y = Math.floor(hilbertMax * ((minY + maxY) / 2 - this.minY) / height);
          hilbertValues[i] = hilbert(x, y);
        }
        sort(hilbertValues, this._boxes, this._indices, 0, this.numItems - 1, this.nodeSize);
        for (let i = 0, pos = 0; i < this._levelBounds.length - 1; i++) {
          const end = this._levelBounds[i];
          while (pos < end) {
            const nodeIndex = pos;
            let nodeMinX = Infinity;
            let nodeMinY = Infinity;
            let nodeMaxX = -Infinity;
            let nodeMaxY = -Infinity;
            for (let i2 = 0; i2 < this.nodeSize && pos < end; i2++) {
              nodeMinX = Math.min(nodeMinX, this._boxes[pos++]);
              nodeMinY = Math.min(nodeMinY, this._boxes[pos++]);
              nodeMaxX = Math.max(nodeMaxX, this._boxes[pos++]);
              nodeMaxY = Math.max(nodeMaxY, this._boxes[pos++]);
            }
            this._indices[this._pos >> 2] = nodeIndex;
            this._boxes[this._pos++] = nodeMinX;
            this._boxes[this._pos++] = nodeMinY;
            this._boxes[this._pos++] = nodeMaxX;
            this._boxes[this._pos++] = nodeMaxY;
          }
        }
      }
      search(minX, minY, maxX, maxY, filterFn) {
        if (this._pos !== this._boxes.length) {
          throw new Error("Data not yet indexed - call index.finish().");
        }
        let nodeIndex = this._boxes.length - 4;
        const queue = [];
        const results = [];
        while (nodeIndex !== void 0) {
          const end = Math.min(nodeIndex + this.nodeSize * 4, upperBound(nodeIndex, this._levelBounds));
          for (let pos = nodeIndex; pos < end; pos += 4) {
            if (maxX < this._boxes[pos])
              continue;
            if (maxY < this._boxes[pos + 1])
              continue;
            if (minX > this._boxes[pos + 2])
              continue;
            if (minY > this._boxes[pos + 3])
              continue;
            const index = this._indices[pos >> 2] | 0;
            if (nodeIndex < this.numItems * 4) {
              if (filterFn === void 0 || filterFn(index)) {
                results.push(index);
              }
            } else {
              queue.push(index);
            }
          }
          nodeIndex = queue.pop();
        }
        return results;
      }
      neighbors(x, y, maxResults = Infinity, maxDistance = Infinity, filterFn) {
        if (this._pos !== this._boxes.length) {
          throw new Error("Data not yet indexed - call index.finish().");
        }
        let nodeIndex = this._boxes.length - 4;
        const q = this._queue;
        const results = [];
        const maxDistSquared = maxDistance * maxDistance;
        while (nodeIndex !== void 0) {
          const end = Math.min(nodeIndex + this.nodeSize * 4, upperBound(nodeIndex, this._levelBounds));
          for (let pos = nodeIndex; pos < end; pos += 4) {
            const index = this._indices[pos >> 2] | 0;
            const dx = axisDist(x, this._boxes[pos], this._boxes[pos + 2]);
            const dy = axisDist(y, this._boxes[pos + 1], this._boxes[pos + 3]);
            const dist = dx * dx + dy * dy;
            if (nodeIndex < this.numItems * 4) {
              if (filterFn === void 0 || filterFn(index)) {
                q.push((index << 1) + 1, dist);
              }
            } else {
              q.push(index << 1, dist);
            }
          }
          while (q.length && q.peek() & 1) {
            const dist = q.peekValue();
            if (dist > maxDistSquared) {
              q.clear();
              return results;
            }
            results.push(q.pop() >> 1);
            if (results.length === maxResults) {
              q.clear();
              return results;
            }
          }
          nodeIndex = q.pop() >> 1;
        }
        q.clear();
        return results;
      }
    };
    function axisDist(k, min, max) {
      return k < min ? min - k : k <= max ? 0 : k - max;
    }
    function upperBound(value, arr) {
      let i = 0;
      let j = arr.length - 1;
      while (i < j) {
        const m = i + j >> 1;
        if (arr[m] > value) {
          j = m;
        } else {
          i = m + 1;
        }
      }
      return arr[i];
    }
    function sort(values, boxes, indices, left, right, nodeSize) {
      if (Math.floor(left / nodeSize) >= Math.floor(right / nodeSize))
        return;
      const pivot = values[left + right >> 1];
      let i = left - 1;
      let j = right + 1;
      while (true) {
        do
          i++;
        while (values[i] < pivot);
        do
          j--;
        while (values[j] > pivot);
        if (i >= j)
          break;
        swap(values, boxes, indices, i, j);
      }
      sort(values, boxes, indices, left, j, nodeSize);
      sort(values, boxes, indices, j + 1, right, nodeSize);
    }
    function swap(values, boxes, indices, i, j) {
      const temp = values[i];
      values[i] = values[j];
      values[j] = temp;
      const k = 4 * i;
      const m = 4 * j;
      const a = boxes[k];
      const b = boxes[k + 1];
      const c = boxes[k + 2];
      const d = boxes[k + 3];
      boxes[k] = boxes[m];
      boxes[k + 1] = boxes[m + 1];
      boxes[k + 2] = boxes[m + 2];
      boxes[k + 3] = boxes[m + 3];
      boxes[m] = a;
      boxes[m + 1] = b;
      boxes[m + 2] = c;
      boxes[m + 3] = d;
      const e = indices[i];
      indices[i] = indices[j];
      indices[j] = e;
    }
    function hilbert(x, y) {
      let a = x ^ y;
      let b = 65535 ^ a;
      let c = 65535 ^ (x | y);
      let d = x & (y ^ 65535);
      let A = a | b >> 1;
      let B = a >> 1 ^ a;
      let C = c >> 1 ^ b & d >> 1 ^ c;
      let D = a & c >> 1 ^ d >> 1 ^ d;
      a = A;
      b = B;
      c = C;
      d = D;
      A = a & a >> 2 ^ b & b >> 2;
      B = a & b >> 2 ^ b & (a ^ b) >> 2;
      C ^= a & c >> 2 ^ b & d >> 2;
      D ^= b & c >> 2 ^ (a ^ b) & d >> 2;
      a = A;
      b = B;
      c = C;
      d = D;
      A = a & a >> 4 ^ b & b >> 4;
      B = a & b >> 4 ^ b & (a ^ b) >> 4;
      C ^= a & c >> 4 ^ b & d >> 4;
      D ^= b & c >> 4 ^ (a ^ b) & d >> 4;
      a = A;
      b = B;
      c = C;
      d = D;
      C ^= a & c >> 8 ^ b & d >> 8;
      D ^= b & c >> 8 ^ (a ^ b) & d >> 8;
      a = C ^ C >> 1;
      b = D ^ D >> 1;
      let i0 = x ^ y;
      let i1 = b | 65535 ^ (i0 | a);
      i0 = (i0 | i0 << 8) & 16711935;
      i0 = (i0 | i0 << 4) & 252645135;
      i0 = (i0 | i0 << 2) & 858993459;
      i0 = (i0 | i0 << 1) & 1431655765;
      i1 = (i1 | i1 << 8) & 16711935;
      i1 = (i1 | i1 << 4) & 252645135;
      i1 = (i1 | i1 << 2) & 858993459;
      i1 = (i1 | i1 << 1) & 1431655765;
      return (i1 << 1 | i0) >>> 0;
    }
    var import_pbf = __toESM2(require_pbf());
    var import_geobuf = __toESM2(require_geobuf());
    var import_lru_cache = __toESM2(require_lru_cache());
    var import_rbush = __toESM2(require_rbush2());
    var earthRadius2 = 63710088e-1;
    var factors2 = {
      centimeters: earthRadius2 * 100,
      centimetres: earthRadius2 * 100,
      degrees: earthRadius2 / 111325,
      feet: earthRadius2 * 3.28084,
      inches: earthRadius2 * 39.37,
      kilometers: earthRadius2 / 1e3,
      kilometres: earthRadius2 / 1e3,
      meters: earthRadius2,
      metres: earthRadius2,
      miles: earthRadius2 / 1609.344,
      millimeters: earthRadius2 * 1e3,
      millimetres: earthRadius2 * 1e3,
      nauticalmiles: earthRadius2 / 1852,
      radians: 1,
      yards: earthRadius2 * 1.0936
    };
    var unitsFactors2 = {
      centimeters: 100,
      centimetres: 100,
      degrees: 1 / 111325,
      feet: 3.28084,
      inches: 39.37,
      kilometers: 1 / 1e3,
      kilometres: 1 / 1e3,
      meters: 1,
      metres: 1,
      miles: 1 / 1609.344,
      millimeters: 1e3,
      millimetres: 1e3,
      nauticalmiles: 1 / 1852,
      radians: 1 / earthRadius2,
      yards: 1.0936133
    };
    function featureCollection2(features, options) {
      if (options === void 0) {
        options = {};
      }
      var fc = { type: "FeatureCollection" };
      if (options.id) {
        fc.id = options.id;
      }
      if (options.bbox) {
        fc.bbox = options.bbox;
      }
      fc.features = features;
      return fc;
    }
    function coordEach(geojson, callback, excludeWrapCoord) {
      if (geojson === null)
        return;
      var j, k, l, geometry, stopG, coords, geometryMaybeCollection, wrapShrink = 0, coordIndex = 0, isGeometryCollection, type = geojson.type, isFeatureCollection = type === "FeatureCollection", isFeature = type === "Feature", stop = isFeatureCollection ? geojson.features.length : 1;
      for (var featureIndex = 0; featureIndex < stop; featureIndex++) {
        geometryMaybeCollection = isFeatureCollection ? geojson.features[featureIndex].geometry : isFeature ? geojson.geometry : geojson;
        isGeometryCollection = geometryMaybeCollection ? geometryMaybeCollection.type === "GeometryCollection" : false;
        stopG = isGeometryCollection ? geometryMaybeCollection.geometries.length : 1;
        for (var geomIndex = 0; geomIndex < stopG; geomIndex++) {
          var multiFeatureIndex = 0;
          var geometryIndex = 0;
          geometry = isGeometryCollection ? geometryMaybeCollection.geometries[geomIndex] : geometryMaybeCollection;
          if (geometry === null)
            continue;
          coords = geometry.coordinates;
          var geomType = geometry.type;
          wrapShrink = excludeWrapCoord && (geomType === "Polygon" || geomType === "MultiPolygon") ? 1 : 0;
          switch (geomType) {
            case null:
              break;
            case "Point":
              if (callback(coords, coordIndex, featureIndex, multiFeatureIndex, geometryIndex) === false)
                return false;
              coordIndex++;
              multiFeatureIndex++;
              break;
            case "LineString":
            case "MultiPoint":
              for (j = 0; j < coords.length; j++) {
                if (callback(coords[j], coordIndex, featureIndex, multiFeatureIndex, geometryIndex) === false)
                  return false;
                coordIndex++;
                if (geomType === "MultiPoint")
                  multiFeatureIndex++;
              }
              if (geomType === "LineString")
                multiFeatureIndex++;
              break;
            case "Polygon":
            case "MultiLineString":
              for (j = 0; j < coords.length; j++) {
                for (k = 0; k < coords[j].length - wrapShrink; k++) {
                  if (callback(coords[j][k], coordIndex, featureIndex, multiFeatureIndex, geometryIndex) === false)
                    return false;
                  coordIndex++;
                }
                if (geomType === "MultiLineString")
                  multiFeatureIndex++;
                if (geomType === "Polygon")
                  geometryIndex++;
              }
              if (geomType === "Polygon")
                multiFeatureIndex++;
              break;
            case "MultiPolygon":
              for (j = 0; j < coords.length; j++) {
                geometryIndex = 0;
                for (k = 0; k < coords[j].length; k++) {
                  for (l = 0; l < coords[j][k].length - wrapShrink; l++) {
                    if (callback(coords[j][k][l], coordIndex, featureIndex, multiFeatureIndex, geometryIndex) === false)
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
    function bbox2(geojson) {
      var result = [Infinity, Infinity, -Infinity, -Infinity];
      coordEach(geojson, function(coord) {
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
    bbox2["default"] = bbox2;
    var es_default5 = bbox2;
    var import_union_subdivided_polygons = __toESM2(require_dist());
    var getBBox = (feature2) => {
      return feature2.bbox || es_default5(feature2);
    };
    var sources = [];
    var DEFAULTS = {
      cacheSize: 250,
      hintPrefetchLimit: 8,
      dissolvedFeatureCacheExcessLimit: 3
    };
    var RBushIndex = class extends import_rbush.default {
      toBBox(feature2) {
        const [minX, minY, maxX, maxY] = feature2.bbox;
        return { minX, minY, maxX, maxY };
      }
      compareMinX(a, b) {
        return a.bbox[0] - b.bbox[0];
      }
      compareMinY(a, b) {
        return a.bbox[1] - b.bbox[1];
      }
    };
    var VectorDataSource2 = class {
      constructor(url, options = {}) {
        this.options = { ...DEFAULTS, ...options };
        this.url = url.replace(/\/$/, "");
        this.pendingRequests = /* @__PURE__ */ new Map();
        this.cache = new import_lru_cache.default(Uint32Array, Array, this.options.cacheSize);
        this.tree = new RBushIndex();
        sources.push({
          url: this.url,
          options: this.options
        });
        this.fetchMetadata();
      }
      static clearRegisteredSources() {
        sources = [];
      }
      static getRegisteredSources() {
        return sources;
      }
      async fetchMetadata() {
        if (this.metadata && this.bundleIndex) {
          return;
        } else {
          delete this.initError;
          const metadataUrl = this.url + "/metadata.json";
          return fetch(metadataUrl, {
            mode: "cors"
          }).then((r) => r.json().then(async (metadata) => {
            this.metadata = metadata;
            await this.fetchBundleIndex();
            return;
          })).catch((e) => {
            console.error(e);
            this.initError = new Error(`Problem fetching VectorDataSource manifest from ${metadataUrl}`);
          });
        }
      }
      async fetchBundleIndex() {
        if (this.bundleIndex) {
          return this.bundleIndex;
        }
        if (!this.metadata) {
          throw new Error("Metadata not yet fetched");
        }
        const i = this.metadata.index;
        if (!i) {
          throw new Error(`Expected "entire" index not found in manifest`);
        }
        let data;
        try {
          const response = await fetch(this.url + i.location);
          data = await response.arrayBuffer();
        } catch (e) {
          console.error(e);
          throw new Error(`Problem fetching or parsing index data at ${i.location}`);
        }
        this.bundleIndex = Flatbush.from(data);
        return this.bundleIndex;
      }
      async identifyBundles(bbox22) {
        await this.fetchMetadata();
        if (this.initError) {
          throw this.initError;
        }
        return this.bundleIndex.search(bbox22[0], bbox22[1], bbox22[2], bbox22[3]);
      }
      async fetchBundle(id, priority = "low") {
        var _a;
        const key = id.toString();
        const existingRequest = this.pendingRequests.get(key);
        const bundle = this.cache.get(id);
        if (bundle) {
          return bundle;
        } else if (existingRequest) {
          return existingRequest.promise;
        } else {
          const url = `${this.url}${(_a = this.metadata) == null ? void 0 : _a.index.rootDir}/${id}.pbf`;
          const abortController = new AbortController();
          const promise = fetch(url, {
            signal: abortController.signal
          }).then((r) => {
            if (abortController.signal.aborted) {
              return Promise.reject(new DOMException("Aborted", "AbortError"));
            }
            if (!r.ok) {
              this.pendingRequests.delete(key);
              return Promise.reject(new Error(`Problem fetching datasource bundle at ${url}`));
            }
            return r.arrayBuffer();
          }).then((arrayBuffer) => {
            if (abortController.signal.aborted) {
              return Promise.reject(new DOMException("Aborted", "AbortError"));
            }
            const geojson = import_geobuf.default.decode(new import_pbf.default(arrayBuffer));
            const popped = this.cache.setpop(id, geojson);
            if (popped && popped.evicted) {
              this.removeFeaturesFromIndex(popped.value.features);
            }
            for (const feature2 of geojson.features) {
              if (!feature2.bbox) {
                feature2.bbox = getBBox(feature2);
              }
              feature2.properties = feature2.properties || {};
              feature2.properties._url = url;
              this.tree.insert(feature2);
            }
            this.pendingRequests.delete(key);
            return geojson;
          }).finally(() => {
            this.pendingRequests.delete(key);
          }).catch((err) => {
            this.pendingRequests.delete(key);
            if (err.name === "AbortError") {
            } else {
              throw err;
            }
          });
          this.pendingRequests.set(key, {
            abortController,
            promise,
            priority
          });
          return promise;
        }
      }
      async removeFeaturesFromIndex(features) {
        for (const feature2 of features) {
          this.tree.remove(feature2);
        }
      }
      async clear() {
        this.tree.clear();
        for (const key of this.pendingRequests.keys()) {
          const { abortController } = this.pendingRequests.get(key);
          abortController.abort();
          this.pendingRequests.delete(key);
        }
        this.cache.clear();
      }
      cancelLowPriorityRequests(ignore) {
        for (const key of this.pendingRequests.keys()) {
          if (ignore.indexOf(parseInt(key)) === -1) {
            const { abortController, priority } = this.pendingRequests.get(key);
            if (priority === "low") {
              abortController.abort();
              this.pendingRequests.delete(key);
            }
          }
        }
      }
      async hint(bbox22) {
        const bundleIds = await this.identifyBundles(bbox22);
        this.cancelLowPriorityRequests(bundleIds);
        if (bundleIds.length <= this.options.hintPrefetchLimit) {
          return Promise.all(bundleIds.map((id) => this.fetchBundle(id))).then(() => {
            return;
          });
        } else {
          Promise.resolve();
        }
      }
      async prefetch(bbox22, feature2) {
        let bundleIds = await this.identifyBundles(bbox22);
        if (feature2) {
          const overlapping = await this.identifyBundles(getBBox(feature2));
          for (const id of bundleIds) {
            if (overlapping.indexOf(id) === -1) {
              overlapping.push(id);
            }
          }
          bundleIds = overlapping;
        }
        this.cancelLowPriorityRequests(bundleIds);
        return Promise.all(bundleIds.slice(0, this.options.cacheSize).map((id) => this.fetchBundle(id))).then(() => {
          const features = this.tree.search({
            minX: bbox22[0],
            minY: bbox22[1],
            maxX: bbox22[2],
            maxY: bbox22[3]
          });
          return;
        });
      }
      async fetch(bbox22) {
        let bundleIds = await this.identifyBundles(bbox22);
        this.cancelLowPriorityRequests(bundleIds);
        await Promise.all(bundleIds.slice(0, this.options.cacheSize).map((id) => this.fetchBundle(id, "high")));
        let features = this.tree.search({
          minX: bbox22[0],
          minY: bbox22[1],
          maxX: bbox22[2],
          maxY: bbox22[3]
        });
        const a = bbox22;
        return features.filter((feature2) => {
          const b = bbox22;
          return a[2] >= b[0] && b[2] >= a[0] && a[3] >= b[1] && b[3] >= a[1];
        });
      }
      async fetchUnion(bbox22, unionProperty) {
        const features = await this.fetch(bbox22);
        if (features.length !== 0) {
          return (0, import_union_subdivided_polygons.union)(featureCollection2(features), unionProperty || void 0);
        } else {
          return featureCollection2([]);
        }
      }
      async fetchOverlapping(feature2) {
        return this.fetch(getBBox(feature2));
      }
    };
  }
});

// src/map-tile-cache-calculator.ts
var map_tile_cache_calculator_exports = {};
__export(map_tile_cache_calculator_exports, {
  MapTileCacheCalculator: () => MapTileCacheCalculator,
  isDetailedShorelineSetting: () => isDetailedShorelineSetting
});
module.exports = __toCommonJS(map_tile_cache_calculator_exports);
var import_tilebelt = __toESM(require_tilebelt());

// node_modules/@turf/helpers/dist/es/index.js
var earthRadius = 63710088e-1;
var factors = {
  centimeters: earthRadius * 100,
  centimetres: earthRadius * 100,
  degrees: earthRadius / 111325,
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
var unitsFactors = {
  centimeters: 100,
  centimetres: 100,
  degrees: 1 / 111325,
  feet: 3.28084,
  inches: 39.37,
  kilometers: 1 / 1e3,
  kilometres: 1 / 1e3,
  meters: 1,
  metres: 1,
  miles: 1 / 1609.344,
  millimeters: 1e3,
  millimetres: 1e3,
  nauticalmiles: 1 / 1852,
  radians: 1 / earthRadius,
  yards: 1.0936133
};
function feature(geom, properties, options) {
  if (options === void 0) {
    options = {};
  }
  var feat = { type: "Feature" };
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
function point(coordinates, properties, options) {
  if (options === void 0) {
    options = {};
  }
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
  var geom = {
    type: "Point",
    coordinates
  };
  return feature(geom, properties, options);
}
function lineString(coordinates, properties, options) {
  if (options === void 0) {
    options = {};
  }
  if (coordinates.length < 2) {
    throw new Error("coordinates must be an array of two or more positions");
  }
  var geom = {
    type: "LineString",
    coordinates
  };
  return feature(geom, properties, options);
}
function featureCollection(features, options) {
  if (options === void 0) {
    options = {};
  }
  var fc = { type: "FeatureCollection" };
  if (options.id) {
    fc.id = options.id;
  }
  if (options.bbox) {
    fc.bbox = options.bbox;
  }
  fc.features = features;
  return fc;
}
function multiLineString(coordinates, properties, options) {
  if (options === void 0) {
    options = {};
  }
  var geom = {
    type: "MultiLineString",
    coordinates
  };
  return feature(geom, properties, options);
}
function isNumber(num) {
  return !isNaN(num) && num !== null && !Array.isArray(num);
}

// node_modules/@turf/invariant/dist/es/index.js
function getCoord(coord) {
  if (!coord) {
    throw new Error("coord is required");
  }
  if (!Array.isArray(coord)) {
    if (coord.type === "Feature" && coord.geometry !== null && coord.geometry.type === "Point") {
      return coord.geometry.coordinates;
    }
    if (coord.type === "Point") {
      return coord.coordinates;
    }
  }
  if (Array.isArray(coord) && coord.length >= 2 && !Array.isArray(coord[0]) && !Array.isArray(coord[1])) {
    return coord;
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
  throw new Error("coords must be GeoJSON Feature, Geometry Object or an Array");
}
function getGeom(geojson) {
  if (geojson.type === "Feature") {
    return geojson.geometry;
  }
  return geojson;
}

// node_modules/@turf/boolean-point-in-polygon/dist/es/index.js
function booleanPointInPolygon(point2, polygon, options) {
  if (options === void 0) {
    options = {};
  }
  if (!point2) {
    throw new Error("point is required");
  }
  if (!polygon) {
    throw new Error("polygon is required");
  }
  var pt = getCoord(point2);
  var geom = getGeom(polygon);
  var type = geom.type;
  var bbox2 = polygon.bbox;
  var polys = geom.coordinates;
  if (bbox2 && inBBox(pt, bbox2) === false) {
    return false;
  }
  if (type === "Polygon") {
    polys = [polys];
  }
  var insidePoly = false;
  for (var i = 0; i < polys.length && !insidePoly; i++) {
    if (inRing(pt, polys[i][0], options.ignoreBoundary)) {
      var inHole = false;
      var k = 1;
      while (k < polys[i].length && !inHole) {
        if (inRing(pt, polys[i][k], !options.ignoreBoundary)) {
          inHole = true;
        }
        k++;
      }
      if (!inHole) {
        insidePoly = true;
      }
    }
  }
  return insidePoly;
}
function inRing(pt, ring, ignoreBoundary) {
  var isInside = false;
  if (ring[0][0] === ring[ring.length - 1][0] && ring[0][1] === ring[ring.length - 1][1]) {
    ring = ring.slice(0, ring.length - 1);
  }
  for (var i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    var xi = ring[i][0];
    var yi = ring[i][1];
    var xj = ring[j][0];
    var yj = ring[j][1];
    var onBoundary = pt[1] * (xi - xj) + yi * (xj - pt[0]) + yj * (pt[0] - xi) === 0 && (xi - pt[0]) * (xj - pt[0]) <= 0 && (yi - pt[1]) * (yj - pt[1]) <= 0;
    if (onBoundary) {
      return !ignoreBoundary;
    }
    var intersect = yi > pt[1] !== yj > pt[1] && pt[0] < (xj - xi) * (pt[1] - yi) / (yj - yi) + xi;
    if (intersect) {
      isInside = !isInside;
    }
  }
  return isInside;
}
function inBBox(pt, bbox2) {
  return bbox2[0] <= pt[0] && bbox2[1] <= pt[1] && bbox2[2] >= pt[0] && bbox2[3] >= pt[1];
}

// node_modules/@turf/meta/dist/es/index.js
function featureEach(geojson, callback) {
  if (geojson.type === "Feature") {
    callback(geojson, 0);
  } else if (geojson.type === "FeatureCollection") {
    for (var i = 0; i < geojson.features.length; i++) {
      if (callback(geojson.features[i], i) === false)
        break;
    }
  }
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
        if (callback(null, featureIndex, featureProperties, featureBBox, featureId) === false)
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
          if (callback(geometry, featureIndex, featureProperties, featureBBox, featureId) === false)
            return false;
          break;
        }
        case "GeometryCollection": {
          for (j = 0; j < geometry.geometries.length; j++) {
            if (callback(geometry.geometries[j], featureIndex, featureProperties, featureBBox, featureId) === false)
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
function flattenEach(geojson, callback) {
  geomEach(geojson, function(geometry, featureIndex, properties, bbox2, id) {
    var type = geometry === null ? null : geometry.type;
    switch (type) {
      case null:
      case "Point":
      case "LineString":
      case "Polygon":
        if (callback(feature(geometry, properties, { bbox: bbox2, id }), featureIndex, 0) === false)
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

// node_modules/@turf/line-segment/dist/es/index.js
function lineSegment(geojson) {
  if (!geojson) {
    throw new Error("geojson is required");
  }
  var results = [];
  flattenEach(geojson, function(feature2) {
    lineSegmentFeature(feature2, results);
  });
  return featureCollection(results);
}
function lineSegmentFeature(geojson, results) {
  var coords = [];
  var geometry = geojson.geometry;
  if (geometry !== null) {
    switch (geometry.type) {
      case "Polygon":
        coords = getCoords(geometry);
        break;
      case "LineString":
        coords = [getCoords(geometry)];
    }
    coords.forEach(function(coord) {
      var segments = createSegments(coord, geojson.properties);
      segments.forEach(function(segment) {
        segment.id = results.length;
        results.push(segment);
      });
    });
  }
}
function createSegments(coords, properties) {
  var segments = [];
  coords.reduce(function(previousCoords, currentCoords) {
    var segment = lineString([previousCoords, currentCoords], properties);
    segment.bbox = bbox(previousCoords, currentCoords);
    segments.push(segment);
    return currentCoords;
  });
  return segments;
}
function bbox(coords1, coords2) {
  var x1 = coords1[0];
  var y1 = coords1[1];
  var x2 = coords2[0];
  var y2 = coords2[1];
  var west = x1 < x2 ? x1 : x2;
  var south = y1 < y2 ? y1 : y2;
  var east = x1 > x2 ? x1 : x2;
  var north = y1 > y2 ? y1 : y2;
  return [west, south, east, north];
}
var es_default = lineSegment;

// node_modules/@turf/line-intersect/dist/es/index.js
var import_geojson_rbush = __toESM(require_geojson_rbush(), 1);
function lineIntersect(line1, line2) {
  var unique = {};
  var results = [];
  if (line1.type === "LineString") {
    line1 = feature(line1);
  }
  if (line2.type === "LineString") {
    line2 = feature(line2);
  }
  if (line1.type === "Feature" && line2.type === "Feature" && line1.geometry !== null && line2.geometry !== null && line1.geometry.type === "LineString" && line2.geometry.type === "LineString" && line1.geometry.coordinates.length === 2 && line2.geometry.coordinates.length === 2) {
    var intersect = intersects(line1, line2);
    if (intersect) {
      results.push(intersect);
    }
    return featureCollection(results);
  }
  var tree = (0, import_geojson_rbush.default)();
  tree.load(es_default(line2));
  featureEach(es_default(line1), function(segment) {
    featureEach(tree.search(segment), function(match) {
      var intersect2 = intersects(segment, match);
      if (intersect2) {
        var key = getCoords(intersect2).join(",");
        if (!unique[key]) {
          unique[key] = true;
          results.push(intersect2);
        }
      }
    });
  });
  return featureCollection(results);
}
function intersects(line1, line2) {
  var coords1 = getCoords(line1);
  var coords2 = getCoords(line2);
  if (coords1.length !== 2) {
    throw new Error("<intersects> line1 must only contain 2 coordinates");
  }
  if (coords2.length !== 2) {
    throw new Error("<intersects> line2 must only contain 2 coordinates");
  }
  var x1 = coords1[0][0];
  var y1 = coords1[0][1];
  var x2 = coords1[1][0];
  var y2 = coords1[1][1];
  var x3 = coords2[0][0];
  var y3 = coords2[0][1];
  var x4 = coords2[1][0];
  var y4 = coords2[1][1];
  var denom = (y4 - y3) * (x2 - x1) - (x4 - x3) * (y2 - y1);
  var numeA = (x4 - x3) * (y1 - y3) - (y4 - y3) * (x1 - x3);
  var numeB = (x2 - x1) * (y1 - y3) - (y2 - y1) * (x1 - x3);
  if (denom === 0) {
    if (numeA === 0 && numeB === 0) {
      return null;
    }
    return null;
  }
  var uA = numeA / denom;
  var uB = numeB / denom;
  if (uA >= 0 && uA <= 1 && uB >= 0 && uB <= 1) {
    var x = x1 + uA * (x2 - x1);
    var y = y1 + uA * (y2 - y1);
    return point([x, y]);
  }
  return null;
}
var es_default2 = lineIntersect;

// node_modules/@turf/polygon-to-line/dist/es/index.js
function es_default3(poly, options) {
  if (options === void 0) {
    options = {};
  }
  var geom = getGeom(poly);
  if (!options.properties && poly.type === "Feature") {
    options.properties = poly.properties;
  }
  switch (geom.type) {
    case "Polygon":
      return polygonToLine(geom, options);
    case "MultiPolygon":
      return multiPolygonToLine(geom, options);
    default:
      throw new Error("invalid poly");
  }
}
function polygonToLine(poly, options) {
  if (options === void 0) {
    options = {};
  }
  var geom = getGeom(poly);
  var coords = geom.coordinates;
  var properties = options.properties ? options.properties : poly.type === "Feature" ? poly.properties : {};
  return coordsToLine(coords, properties);
}
function multiPolygonToLine(multiPoly, options) {
  if (options === void 0) {
    options = {};
  }
  var geom = getGeom(multiPoly);
  var coords = geom.coordinates;
  var properties = options.properties ? options.properties : multiPoly.type === "Feature" ? multiPoly.properties : {};
  var lines = [];
  coords.forEach(function(coord) {
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

// node_modules/@turf/boolean-disjoint/dist/es/index.js
function booleanDisjoint(feature1, feature2) {
  var bool = true;
  flattenEach(feature1, function(flatten1) {
    flattenEach(feature2, function(flatten2) {
      if (bool === false) {
        return false;
      }
      bool = disjoint(flatten1.geometry, flatten2.geometry);
    });
  });
  return bool;
}
function disjoint(geom1, geom2) {
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
          return !isLineOnLine(geom1, geom2);
        case "Polygon":
          return !isLineInPoly(geom2, geom1);
      }
      break;
    case "Polygon":
      switch (geom2.type) {
        case "Point":
          return !booleanPointInPolygon(geom2, geom1);
        case "LineString":
          return !isLineInPoly(geom1, geom2);
        case "Polygon":
          return !isPolyInPoly(geom2, geom1);
      }
  }
  return false;
}
function isPointOnLine(lineString2, pt) {
  for (var i = 0; i < lineString2.coordinates.length - 1; i++) {
    if (isPointOnLineSegment(lineString2.coordinates[i], lineString2.coordinates[i + 1], pt.coordinates)) {
      return true;
    }
  }
  return false;
}
function isLineOnLine(lineString1, lineString2) {
  var doLinesIntersect = es_default2(lineString1, lineString2);
  if (doLinesIntersect.features.length > 0) {
    return true;
  }
  return false;
}
function isLineInPoly(polygon, lineString2) {
  for (var _i = 0, _a = lineString2.coordinates; _i < _a.length; _i++) {
    var coord = _a[_i];
    if (booleanPointInPolygon(coord, polygon)) {
      return true;
    }
  }
  var doLinesIntersect = es_default2(lineString2, es_default3(polygon));
  if (doLinesIntersect.features.length > 0) {
    return true;
  }
  return false;
}
function isPolyInPoly(feature1, feature2) {
  for (var _i = 0, _a = feature1.coordinates[0]; _i < _a.length; _i++) {
    var coord1 = _a[_i];
    if (booleanPointInPolygon(coord1, feature2)) {
      return true;
    }
  }
  for (var _b = 0, _c = feature2.coordinates[0]; _b < _c.length; _b++) {
    var coord2 = _c[_b];
    if (booleanPointInPolygon(coord2, feature1)) {
      return true;
    }
  }
  var doLinesIntersect = es_default2(es_default3(feature1), es_default3(feature2));
  if (doLinesIntersect.features.length > 0) {
    return true;
  }
  return false;
}
function isPointOnLineSegment(lineSegmentStart, lineSegmentEnd, pt) {
  var dxc = pt[0] - lineSegmentStart[0];
  var dyc = pt[1] - lineSegmentStart[1];
  var dxl = lineSegmentEnd[0] - lineSegmentStart[0];
  var dyl = lineSegmentEnd[1] - lineSegmentStart[1];
  var cross = dxc * dyl - dyc * dxl;
  if (cross !== 0) {
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
var es_default4 = booleanDisjoint;

// node_modules/@turf/boolean-intersects/dist/es/index.js
function booleanIntersects(feature1, feature2) {
  var bool = false;
  flattenEach(feature1, function(flatten1) {
    flattenEach(feature2, function(flatten2) {
      if (bool === true) {
        return true;
      }
      bool = !es_default4(flatten1.geometry, flatten2.geometry);
    });
  });
  return bool;
}

// src/map-tile-cache-calculator.ts
var import_vector_data_source = __toESM(require_bundled());
function isDetailedShorelineSetting(settings) {
  return settings.maxShorelineZ !== void 0 && settings.maxShorelineZ !== null;
}
var Z = 2;
var MapTileCacheCalculator = class {
  constructor(vectorDataSourceUrl) {
    this.landFeatures = new import_vector_data_source.VectorDataSource(vectorDataSourceUrl);
    return this;
  }
  async traverseOfflineTiles(settings, visitFn, viewport) {
    for (const tile of Z_ONE_TILES) {
      await this.traverseChildrenRecursive(tile, settings, visitFn, viewport);
    }
  }
  async tileInCache(tile, settings) {
    let match = null;
    const qk = (0, import_tilebelt.tileToQuadkey)(tile);
    await this.traverseOfflineTiles(settings, (t, stop) => {
      if (match) {
        stop();
      } else {
        const tqk = import_tilebelt.default.tileToQuadkey(t);
        if (tqk === qk) {
          match = t;
          stop();
        } else if (!new RegExp(`^${tqk}`).test(qk)) {
          stop();
        }
      }
    });
    return !!match;
  }
  async countChildTiles(settings) {
    let count = 0;
    await this.traverseOfflineTiles(settings, (tile, stop) => {
      count++;
      if (isDetailedShorelineSetting(settings) && count > 5e4) {
        throw new Error("Number of tiles exceeds maximum (50 thousand) while considering shoreline");
      }
    });
    return count;
  }
  async traverseChildrenRecursive(tile, settings, visitFn, viewport, parentIntersectsLand, grandparentIntersectsLand) {
    if (!parentIntersectsLand && tile[Z] > settings.maxZ) {
      return;
    } else if (isDetailedShorelineSetting(settings) && tile[Z] > settings.maxShorelineZ) {
      return;
    }
    const tileGeoJSON = import_tilebelt.default.tileToGeoJSON(tile);
    if (viewport && !booleanIntersects(viewport, tileGeoJSON)) {
      return;
    }
    let stop = false;
    await visitFn(tile, () => {
      stop = true;
    });
    if (stop) {
      return;
    }
    grandparentIntersectsLand = parentIntersectsLand;
    if (isDetailedShorelineSetting(settings) && tile[Z] >= settings.maxZ) {
      const shoreFeatures = await this.landFeatures.fetchOverlapping({
        type: "Feature",
        properties: {},
        geometry: tileGeoJSON
      });
      if (shoreFeatures.length === 0 && !parentIntersectsLand) {
        parentIntersectsLand = false;
        return;
      } else if (shoreFeatures.length === 0) {
        parentIntersectsLand = false;
      } else {
        parentIntersectsLand = true;
      }
    }
    if (tile[Z] > 2 && !booleanIntersects(tileGeoJSON, settings.region)) {
      return;
    }
    for (const child of import_tilebelt.default.getChildren(tile)) {
      await this.traverseChildrenRecursive(child, settings, visitFn, viewport, parentIntersectsLand, grandparentIntersectsLand);
    }
    return;
  }
};
var Z_ONE_TILES = [
  [0, 0, 1],
  [1, 0, 1],
  [0, 1, 1],
  [1, 1, 1]
];
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  MapTileCacheCalculator,
  isDetailedShorelineSetting
});
/*! ieee754. BSD-3-Clause License. Feross Aboukhadijeh <https://feross.org/opensource> */
