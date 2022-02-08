// @ts-nocheck
var __create = Object.create;
var __defProp = Object.defineProperty;
var __defProps = Object.defineProperties;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropDescs = Object.getOwnPropertyDescriptors;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getOwnPropSymbols = Object.getOwnPropertySymbols;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __propIsEnum = Object.prototype.propertyIsEnumerable;
var __defNormalProp = (obj, key, value) => key in obj ? __defProp(obj, key, { enumerable: true, configurable: true, writable: true, value }) : obj[key] = value;
var __spreadValues = (a, b) => {
  for (var prop in b || (b = {}))
    if (__hasOwnProp.call(b, prop))
      __defNormalProp(a, prop, b[prop]);
  if (__getOwnPropSymbols)
    for (var prop of __getOwnPropSymbols(b)) {
      if (__propIsEnum.call(b, prop))
        __defNormalProp(a, prop, b[prop]);
    }
  return a;
};
var __spreadProps = (a, b) => __defProps(a, __getOwnPropDescs(b));
var __markAsModule = (target) => __defProp(target, "__esModule", { value: true });
var __commonJS = (cb, mod) => function __require() {
  return mod || (0, cb[__getOwnPropNames(cb)[0]])((mod = { exports: {} }).exports, mod), mod.exports;
};
var __reExport = (target, module, copyDefault, desc) => {
  if (module && typeof module === "object" || typeof module === "function") {
    for (let key of __getOwnPropNames(module))
      if (!__hasOwnProp.call(target, key) && (copyDefault || key !== "default"))
        __defProp(target, key, { get: () => module[key], enumerable: !(desc = __getOwnPropDesc(module, key)) || desc.enumerable });
  }
  return target;
};
var __toESM = (module, isNodeMode) => {
  return __reExport(__markAsModule(__defProp(module != null ? __create(__getProtoOf(module)) : {}, "default", !isNodeMode && module && module.__esModule ? { get: () => module.default, enumerable: true } : { value: module, enumerable: true })), module);
};

// ../api/node_modules/graphql-tag/node_modules/tslib/tslib.js
var require_tslib = __commonJS({
  "../api/node_modules/graphql-tag/node_modules/tslib/tslib.js"(exports, module) {
    var __extends;
    var __assign;
    var __rest;
    var __decorate;
    var __param;
    var __metadata;
    var __awaiter;
    var __generator;
    var __exportStar;
    var __values;
    var __read;
    var __spread;
    var __spreadArrays;
    var __spreadArray;
    var __await;
    var __asyncGenerator;
    var __asyncDelegator;
    var __asyncValues;
    var __makeTemplateObject;
    var __importStar;
    var __importDefault;
    var __classPrivateFieldGet;
    var __classPrivateFieldSet;
    var __createBinding;
    (function(factory) {
      var root = typeof global === "object" ? global : typeof self === "object" ? self : typeof this === "object" ? this : {};
      if (typeof define === "function" && define.amd) {
        define("tslib", ["exports"], function(exports2) {
          factory(createExporter(root, createExporter(exports2)));
        });
      } else if (typeof module === "object" && typeof module.exports === "object") {
        factory(createExporter(root, createExporter(module.exports)));
      } else {
        factory(createExporter(root));
      }
      function createExporter(exports2, previous) {
        if (exports2 !== root) {
          if (typeof Object.create === "function") {
            Object.defineProperty(exports2, "__esModule", { value: true });
          } else {
            exports2.__esModule = true;
          }
        }
        return function(id, v) {
          return exports2[id] = previous ? previous(id, v) : v;
        };
      }
    })(function(exporter) {
      var extendStatics = Object.setPrototypeOf || { __proto__: [] } instanceof Array && function(d, b) {
        d.__proto__ = b;
      } || function(d, b) {
        for (var p in b)
          if (Object.prototype.hasOwnProperty.call(b, p))
            d[p] = b[p];
      };
      __extends = function(d, b) {
        if (typeof b !== "function" && b !== null)
          throw new TypeError("Class extends value " + String(b) + " is not a constructor or null");
        extendStatics(d, b);
        function __() {
          this.constructor = d;
        }
        d.prototype = b === null ? Object.create(b) : (__.prototype = b.prototype, new __());
      };
      __assign = Object.assign || function(t) {
        for (var s, i = 1, n = arguments.length; i < n; i++) {
          s = arguments[i];
          for (var p in s)
            if (Object.prototype.hasOwnProperty.call(s, p))
              t[p] = s[p];
        }
        return t;
      };
      __rest = function(s, e) {
        var t = {};
        for (var p in s)
          if (Object.prototype.hasOwnProperty.call(s, p) && e.indexOf(p) < 0)
            t[p] = s[p];
        if (s != null && typeof Object.getOwnPropertySymbols === "function")
          for (var i = 0, p = Object.getOwnPropertySymbols(s); i < p.length; i++) {
            if (e.indexOf(p[i]) < 0 && Object.prototype.propertyIsEnumerable.call(s, p[i]))
              t[p[i]] = s[p[i]];
          }
        return t;
      };
      __decorate = function(decorators, target, key, desc) {
        var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
        if (typeof Reflect === "object" && typeof Reflect.decorate === "function")
          r = Reflect.decorate(decorators, target, key, desc);
        else
          for (var i = decorators.length - 1; i >= 0; i--)
            if (d = decorators[i])
              r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
        return c > 3 && r && Object.defineProperty(target, key, r), r;
      };
      __param = function(paramIndex, decorator) {
        return function(target, key) {
          decorator(target, key, paramIndex);
        };
      };
      __metadata = function(metadataKey, metadataValue) {
        if (typeof Reflect === "object" && typeof Reflect.metadata === "function")
          return Reflect.metadata(metadataKey, metadataValue);
      };
      __awaiter = function(thisArg, _arguments, P, generator) {
        function adopt(value) {
          return value instanceof P ? value : new P(function(resolve) {
            resolve(value);
          });
        }
        return new (P || (P = Promise))(function(resolve, reject) {
          function fulfilled(value) {
            try {
              step(generator.next(value));
            } catch (e) {
              reject(e);
            }
          }
          function rejected(value) {
            try {
              step(generator["throw"](value));
            } catch (e) {
              reject(e);
            }
          }
          function step(result) {
            result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected);
          }
          step((generator = generator.apply(thisArg, _arguments || [])).next());
        });
      };
      __generator = function(thisArg, body) {
        var _ = { label: 0, sent: function() {
          if (t[0] & 1)
            throw t[1];
          return t[1];
        }, trys: [], ops: [] }, f, y, t, g;
        return g = { next: verb(0), "throw": verb(1), "return": verb(2) }, typeof Symbol === "function" && (g[Symbol.iterator] = function() {
          return this;
        }), g;
        function verb(n) {
          return function(v) {
            return step([n, v]);
          };
        }
        function step(op) {
          if (f)
            throw new TypeError("Generator is already executing.");
          while (_)
            try {
              if (f = 1, y && (t = op[0] & 2 ? y["return"] : op[0] ? y["throw"] || ((t = y["return"]) && t.call(y), 0) : y.next) && !(t = t.call(y, op[1])).done)
                return t;
              if (y = 0, t)
                op = [op[0] & 2, t.value];
              switch (op[0]) {
                case 0:
                case 1:
                  t = op;
                  break;
                case 4:
                  _.label++;
                  return { value: op[1], done: false };
                case 5:
                  _.label++;
                  y = op[1];
                  op = [0];
                  continue;
                case 7:
                  op = _.ops.pop();
                  _.trys.pop();
                  continue;
                default:
                  if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) {
                    _ = 0;
                    continue;
                  }
                  if (op[0] === 3 && (!t || op[1] > t[0] && op[1] < t[3])) {
                    _.label = op[1];
                    break;
                  }
                  if (op[0] === 6 && _.label < t[1]) {
                    _.label = t[1];
                    t = op;
                    break;
                  }
                  if (t && _.label < t[2]) {
                    _.label = t[2];
                    _.ops.push(op);
                    break;
                  }
                  if (t[2])
                    _.ops.pop();
                  _.trys.pop();
                  continue;
              }
              op = body.call(thisArg, _);
            } catch (e) {
              op = [6, e];
              y = 0;
            } finally {
              f = t = 0;
            }
          if (op[0] & 5)
            throw op[1];
          return { value: op[0] ? op[1] : void 0, done: true };
        }
      };
      __exportStar = function(m, o) {
        for (var p in m)
          if (p !== "default" && !Object.prototype.hasOwnProperty.call(o, p))
            __createBinding(o, m, p);
      };
      __createBinding = Object.create ? function(o, m, k, k2) {
        if (k2 === void 0)
          k2 = k;
        Object.defineProperty(o, k2, { enumerable: true, get: function() {
          return m[k];
        } });
      } : function(o, m, k, k2) {
        if (k2 === void 0)
          k2 = k;
        o[k2] = m[k];
      };
      __values = function(o) {
        var s = typeof Symbol === "function" && Symbol.iterator, m = s && o[s], i = 0;
        if (m)
          return m.call(o);
        if (o && typeof o.length === "number")
          return {
            next: function() {
              if (o && i >= o.length)
                o = void 0;
              return { value: o && o[i++], done: !o };
            }
          };
        throw new TypeError(s ? "Object is not iterable." : "Symbol.iterator is not defined.");
      };
      __read = function(o, n) {
        var m = typeof Symbol === "function" && o[Symbol.iterator];
        if (!m)
          return o;
        var i = m.call(o), r, ar = [], e;
        try {
          while ((n === void 0 || n-- > 0) && !(r = i.next()).done)
            ar.push(r.value);
        } catch (error) {
          e = { error };
        } finally {
          try {
            if (r && !r.done && (m = i["return"]))
              m.call(i);
          } finally {
            if (e)
              throw e.error;
          }
        }
        return ar;
      };
      __spread = function() {
        for (var ar = [], i = 0; i < arguments.length; i++)
          ar = ar.concat(__read(arguments[i]));
        return ar;
      };
      __spreadArrays = function() {
        for (var s = 0, i = 0, il = arguments.length; i < il; i++)
          s += arguments[i].length;
        for (var r = Array(s), k = 0, i = 0; i < il; i++)
          for (var a = arguments[i], j = 0, jl = a.length; j < jl; j++, k++)
            r[k] = a[j];
        return r;
      };
      __spreadArray = function(to, from, pack) {
        if (pack || arguments.length === 2)
          for (var i = 0, l = from.length, ar; i < l; i++) {
            if (ar || !(i in from)) {
              if (!ar)
                ar = Array.prototype.slice.call(from, 0, i);
              ar[i] = from[i];
            }
          }
        return to.concat(ar || Array.prototype.slice.call(from));
      };
      __await = function(v) {
        return this instanceof __await ? (this.v = v, this) : new __await(v);
      };
      __asyncGenerator = function(thisArg, _arguments, generator) {
        if (!Symbol.asyncIterator)
          throw new TypeError("Symbol.asyncIterator is not defined.");
        var g = generator.apply(thisArg, _arguments || []), i, q = [];
        return i = {}, verb("next"), verb("throw"), verb("return"), i[Symbol.asyncIterator] = function() {
          return this;
        }, i;
        function verb(n) {
          if (g[n])
            i[n] = function(v) {
              return new Promise(function(a, b) {
                q.push([n, v, a, b]) > 1 || resume(n, v);
              });
            };
        }
        function resume(n, v) {
          try {
            step(g[n](v));
          } catch (e) {
            settle(q[0][3], e);
          }
        }
        function step(r) {
          r.value instanceof __await ? Promise.resolve(r.value.v).then(fulfill, reject) : settle(q[0][2], r);
        }
        function fulfill(value) {
          resume("next", value);
        }
        function reject(value) {
          resume("throw", value);
        }
        function settle(f, v) {
          if (f(v), q.shift(), q.length)
            resume(q[0][0], q[0][1]);
        }
      };
      __asyncDelegator = function(o) {
        var i, p;
        return i = {}, verb("next"), verb("throw", function(e) {
          throw e;
        }), verb("return"), i[Symbol.iterator] = function() {
          return this;
        }, i;
        function verb(n, f) {
          i[n] = o[n] ? function(v) {
            return (p = !p) ? { value: __await(o[n](v)), done: n === "return" } : f ? f(v) : v;
          } : f;
        }
      };
      __asyncValues = function(o) {
        if (!Symbol.asyncIterator)
          throw new TypeError("Symbol.asyncIterator is not defined.");
        var m = o[Symbol.asyncIterator], i;
        return m ? m.call(o) : (o = typeof __values === "function" ? __values(o) : o[Symbol.iterator](), i = {}, verb("next"), verb("throw"), verb("return"), i[Symbol.asyncIterator] = function() {
          return this;
        }, i);
        function verb(n) {
          i[n] = o[n] && function(v) {
            return new Promise(function(resolve, reject) {
              v = o[n](v), settle(resolve, reject, v.done, v.value);
            });
          };
        }
        function settle(resolve, reject, d, v) {
          Promise.resolve(v).then(function(v2) {
            resolve({ value: v2, done: d });
          }, reject);
        }
      };
      __makeTemplateObject = function(cooked, raw) {
        if (Object.defineProperty) {
          Object.defineProperty(cooked, "raw", { value: raw });
        } else {
          cooked.raw = raw;
        }
        return cooked;
      };
      var __setModuleDefault = Object.create ? function(o, v) {
        Object.defineProperty(o, "default", { enumerable: true, value: v });
      } : function(o, v) {
        o["default"] = v;
      };
      __importStar = function(mod) {
        if (mod && mod.__esModule)
          return mod;
        var result = {};
        if (mod != null) {
          for (var k in mod)
            if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k))
              __createBinding(result, mod, k);
        }
        __setModuleDefault(result, mod);
        return result;
      };
      __importDefault = function(mod) {
        return mod && mod.__esModule ? mod : { "default": mod };
      };
      __classPrivateFieldGet = function(receiver, state, kind, f) {
        if (kind === "a" && !f)
          throw new TypeError("Private accessor was defined without a getter");
        if (typeof state === "function" ? receiver !== state || !f : !state.has(receiver))
          throw new TypeError("Cannot read private member from an object whose class did not declare it");
        return kind === "m" ? f : kind === "a" ? f.call(receiver) : f ? f.value : state.get(receiver);
      };
      __classPrivateFieldSet = function(receiver, state, value, kind, f) {
        if (kind === "m")
          throw new TypeError("Private method is not writable");
        if (kind === "a" && !f)
          throw new TypeError("Private accessor was defined without a setter");
        if (typeof state === "function" ? receiver !== state || !f : !state.has(receiver))
          throw new TypeError("Cannot write private member to an object whose class did not declare it");
        return kind === "a" ? f.call(receiver, value) : f ? f.value = value : state.set(receiver, value), value;
      };
      exporter("__extends", __extends);
      exporter("__assign", __assign);
      exporter("__rest", __rest);
      exporter("__decorate", __decorate);
      exporter("__param", __param);
      exporter("__metadata", __metadata);
      exporter("__awaiter", __awaiter);
      exporter("__generator", __generator);
      exporter("__exportStar", __exportStar);
      exporter("__createBinding", __createBinding);
      exporter("__values", __values);
      exporter("__read", __read);
      exporter("__spread", __spread);
      exporter("__spreadArrays", __spreadArrays);
      exporter("__spreadArray", __spreadArray);
      exporter("__await", __await);
      exporter("__asyncGenerator", __asyncGenerator);
      exporter("__asyncDelegator", __asyncDelegator);
      exporter("__asyncValues", __asyncValues);
      exporter("__makeTemplateObject", __makeTemplateObject);
      exporter("__importStar", __importStar);
      exporter("__importDefault", __importDefault);
      exporter("__classPrivateFieldGet", __classPrivateFieldGet);
      exporter("__classPrivateFieldSet", __classPrivateFieldSet);
    });
  }
});

// ../api/node_modules/graphql/version.js
var require_version = __commonJS({
  "../api/node_modules/graphql/version.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", {
      value: true
    });
    exports.versionInfo = exports.version = void 0;
    var version = "14.6.0";
    exports.version = version;
    var versionInfo = Object.freeze({
      major: 14,
      minor: 6,
      patch: 0,
      preReleaseTag: null
    });
    exports.versionInfo = versionInfo;
  }
});

// ../api/node_modules/graphql/jsutils/isPromise.js
var require_isPromise = __commonJS({
  "../api/node_modules/graphql/jsutils/isPromise.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", {
      value: true
    });
    exports.default = isPromise;
    function isPromise(value) {
      return Boolean(value && typeof value.then === "function");
    }
  }
});

// ../api/node_modules/graphql/jsutils/nodejsCustomInspectSymbol.js
var require_nodejsCustomInspectSymbol = __commonJS({
  "../api/node_modules/graphql/jsutils/nodejsCustomInspectSymbol.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", {
      value: true
    });
    exports.default = void 0;
    var nodejsCustomInspectSymbol = typeof Symbol === "function" && typeof Symbol.for === "function" ? Symbol.for("nodejs.util.inspect.custom") : void 0;
    var _default = nodejsCustomInspectSymbol;
    exports.default = _default;
  }
});

// ../api/node_modules/graphql/jsutils/inspect.js
var require_inspect = __commonJS({
  "../api/node_modules/graphql/jsutils/inspect.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", {
      value: true
    });
    exports.default = inspect;
    var _nodejsCustomInspectSymbol = _interopRequireDefault(require_nodejsCustomInspectSymbol());
    function _interopRequireDefault(obj) {
      return obj && obj.__esModule ? obj : { default: obj };
    }
    function _typeof(obj) {
      if (typeof Symbol === "function" && typeof Symbol.iterator === "symbol") {
        _typeof = function _typeof2(obj2) {
          return typeof obj2;
        };
      } else {
        _typeof = function _typeof2(obj2) {
          return obj2 && typeof Symbol === "function" && obj2.constructor === Symbol && obj2 !== Symbol.prototype ? "symbol" : typeof obj2;
        };
      }
      return _typeof(obj);
    }
    var MAX_ARRAY_LENGTH = 10;
    var MAX_RECURSIVE_DEPTH = 2;
    function inspect(value) {
      return formatValue(value, []);
    }
    function formatValue(value, seenValues) {
      switch (_typeof(value)) {
        case "string":
          return JSON.stringify(value);
        case "function":
          return value.name ? "[function ".concat(value.name, "]") : "[function]";
        case "object":
          if (value === null) {
            return "null";
          }
          return formatObjectValue(value, seenValues);
        default:
          return String(value);
      }
    }
    function formatObjectValue(value, previouslySeenValues) {
      if (previouslySeenValues.indexOf(value) !== -1) {
        return "[Circular]";
      }
      var seenValues = [].concat(previouslySeenValues, [value]);
      var customInspectFn = getCustomFn(value);
      if (customInspectFn !== void 0) {
        var customValue = customInspectFn.call(value);
        if (customValue !== value) {
          return typeof customValue === "string" ? customValue : formatValue(customValue, seenValues);
        }
      } else if (Array.isArray(value)) {
        return formatArray(value, seenValues);
      }
      return formatObject(value, seenValues);
    }
    function formatObject(object, seenValues) {
      var keys = Object.keys(object);
      if (keys.length === 0) {
        return "{}";
      }
      if (seenValues.length > MAX_RECURSIVE_DEPTH) {
        return "[" + getObjectTag(object) + "]";
      }
      var properties = keys.map(function(key) {
        var value = formatValue(object[key], seenValues);
        return key + ": " + value;
      });
      return "{ " + properties.join(", ") + " }";
    }
    function formatArray(array, seenValues) {
      if (array.length === 0) {
        return "[]";
      }
      if (seenValues.length > MAX_RECURSIVE_DEPTH) {
        return "[Array]";
      }
      var len = Math.min(MAX_ARRAY_LENGTH, array.length);
      var remaining = array.length - len;
      var items = [];
      for (var i = 0; i < len; ++i) {
        items.push(formatValue(array[i], seenValues));
      }
      if (remaining === 1) {
        items.push("... 1 more item");
      } else if (remaining > 1) {
        items.push("... ".concat(remaining, " more items"));
      }
      return "[" + items.join(", ") + "]";
    }
    function getCustomFn(object) {
      var customInspectFn = object[String(_nodejsCustomInspectSymbol.default)];
      if (typeof customInspectFn === "function") {
        return customInspectFn;
      }
      if (typeof object.inspect === "function") {
        return object.inspect;
      }
    }
    function getObjectTag(object) {
      var tag = Object.prototype.toString.call(object).replace(/^\[object /, "").replace(/]$/, "");
      if (tag === "Object" && typeof object.constructor === "function") {
        var name = object.constructor.name;
        if (typeof name === "string" && name !== "") {
          return name;
        }
      }
      return tag;
    }
  }
});

// ../api/node_modules/graphql/jsutils/devAssert.js
var require_devAssert = __commonJS({
  "../api/node_modules/graphql/jsutils/devAssert.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", {
      value: true
    });
    exports.default = devAssert;
    function devAssert(condition, message) {
      var booleanCondition = Boolean(condition);
      if (!booleanCondition) {
        throw new Error(message);
      }
    }
  }
});

// ../api/node_modules/graphql/jsutils/defineToJSON.js
var require_defineToJSON = __commonJS({
  "../api/node_modules/graphql/jsutils/defineToJSON.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", {
      value: true
    });
    exports.default = defineToJSON;
    var _nodejsCustomInspectSymbol = _interopRequireDefault(require_nodejsCustomInspectSymbol());
    function _interopRequireDefault(obj) {
      return obj && obj.__esModule ? obj : { default: obj };
    }
    function defineToJSON(classObject) {
      var fn = arguments.length > 1 && arguments[1] !== void 0 ? arguments[1] : classObject.prototype.toString;
      classObject.prototype.toJSON = fn;
      classObject.prototype.inspect = fn;
      if (_nodejsCustomInspectSymbol.default) {
        classObject.prototype[_nodejsCustomInspectSymbol.default] = fn;
      }
    }
  }
});

// ../api/node_modules/graphql/jsutils/isObjectLike.js
var require_isObjectLike = __commonJS({
  "../api/node_modules/graphql/jsutils/isObjectLike.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", {
      value: true
    });
    exports.default = isObjectLike;
    function _typeof(obj) {
      if (typeof Symbol === "function" && typeof Symbol.iterator === "symbol") {
        _typeof = function _typeof2(obj2) {
          return typeof obj2;
        };
      } else {
        _typeof = function _typeof2(obj2) {
          return obj2 && typeof Symbol === "function" && obj2.constructor === Symbol && obj2 !== Symbol.prototype ? "symbol" : typeof obj2;
        };
      }
      return _typeof(obj);
    }
    function isObjectLike(value) {
      return _typeof(value) == "object" && value !== null;
    }
  }
});

// ../api/node_modules/graphql/language/location.js
var require_location = __commonJS({
  "../api/node_modules/graphql/language/location.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", {
      value: true
    });
    exports.getLocation = getLocation;
    function getLocation(source, position) {
      var lineRegexp = /\r\n|[\n\r]/g;
      var line = 1;
      var column = position + 1;
      var match;
      while ((match = lineRegexp.exec(source.body)) && match.index < position) {
        line += 1;
        column = position + 1 - (match.index + match[0].length);
      }
      return {
        line,
        column
      };
    }
  }
});

// ../api/node_modules/graphql/language/printLocation.js
var require_printLocation = __commonJS({
  "../api/node_modules/graphql/language/printLocation.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", {
      value: true
    });
    exports.printLocation = printLocation;
    exports.printSourceLocation = printSourceLocation;
    var _location = require_location();
    function printLocation(location) {
      return printSourceLocation(location.source, (0, _location.getLocation)(location.source, location.start));
    }
    function printSourceLocation(source, sourceLocation) {
      var firstLineColumnOffset = source.locationOffset.column - 1;
      var body = whitespace(firstLineColumnOffset) + source.body;
      var lineIndex = sourceLocation.line - 1;
      var lineOffset = source.locationOffset.line - 1;
      var lineNum = sourceLocation.line + lineOffset;
      var columnOffset = sourceLocation.line === 1 ? firstLineColumnOffset : 0;
      var columnNum = sourceLocation.column + columnOffset;
      var locationStr = "".concat(source.name, ":").concat(lineNum, ":").concat(columnNum, "\n");
      var lines = body.split(/\r\n|[\n\r]/g);
      var locationLine = lines[lineIndex];
      if (locationLine.length > 120) {
        var sublineIndex = Math.floor(columnNum / 80);
        var sublineColumnNum = columnNum % 80;
        var sublines = [];
        for (var i = 0; i < locationLine.length; i += 80) {
          sublines.push(locationLine.slice(i, i + 80));
        }
        return locationStr + printPrefixedLines([["".concat(lineNum), sublines[0]]].concat(sublines.slice(1, sublineIndex + 1).map(function(subline) {
          return ["", subline];
        }), [[" ", whitespace(sublineColumnNum - 1) + "^"], ["", sublines[sublineIndex + 1]]]));
      }
      return locationStr + printPrefixedLines([
        ["".concat(lineNum - 1), lines[lineIndex - 1]],
        ["".concat(lineNum), locationLine],
        ["", whitespace(columnNum - 1) + "^"],
        ["".concat(lineNum + 1), lines[lineIndex + 1]]
      ]);
    }
    function printPrefixedLines(lines) {
      var existingLines = lines.filter(function(_ref) {
        var _ = _ref[0], line = _ref[1];
        return line !== void 0;
      });
      var padLen = Math.max.apply(Math, existingLines.map(function(_ref2) {
        var prefix = _ref2[0];
        return prefix.length;
      }));
      return existingLines.map(function(_ref3) {
        var prefix = _ref3[0], line = _ref3[1];
        return lpad(padLen, prefix) + (line ? " | " + line : " |");
      }).join("\n");
    }
    function whitespace(len) {
      return Array(len + 1).join(" ");
    }
    function lpad(len, str) {
      return whitespace(len - str.length) + str;
    }
  }
});

// ../api/node_modules/graphql/error/GraphQLError.js
var require_GraphQLError = __commonJS({
  "../api/node_modules/graphql/error/GraphQLError.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", {
      value: true
    });
    exports.GraphQLError = GraphQLError;
    exports.printError = printError;
    var _isObjectLike = _interopRequireDefault(require_isObjectLike());
    var _location = require_location();
    var _printLocation = require_printLocation();
    function _interopRequireDefault(obj) {
      return obj && obj.__esModule ? obj : { default: obj };
    }
    function GraphQLError(message, nodes, source, positions, path, originalError, extensions) {
      var _nodes = Array.isArray(nodes) ? nodes.length !== 0 ? nodes : void 0 : nodes ? [nodes] : void 0;
      var _source = source;
      if (!_source && _nodes) {
        var node = _nodes[0];
        _source = node && node.loc && node.loc.source;
      }
      var _positions = positions;
      if (!_positions && _nodes) {
        _positions = _nodes.reduce(function(list, node2) {
          if (node2.loc) {
            list.push(node2.loc.start);
          }
          return list;
        }, []);
      }
      if (_positions && _positions.length === 0) {
        _positions = void 0;
      }
      var _locations;
      if (positions && source) {
        _locations = positions.map(function(pos) {
          return (0, _location.getLocation)(source, pos);
        });
      } else if (_nodes) {
        _locations = _nodes.reduce(function(list, node2) {
          if (node2.loc) {
            list.push((0, _location.getLocation)(node2.loc.source, node2.loc.start));
          }
          return list;
        }, []);
      }
      var _extensions = extensions;
      if (_extensions == null && originalError != null) {
        var originalExtensions = originalError.extensions;
        if ((0, _isObjectLike.default)(originalExtensions)) {
          _extensions = originalExtensions;
        }
      }
      Object.defineProperties(this, {
        message: {
          value: message,
          enumerable: true,
          writable: true
        },
        locations: {
          value: _locations || void 0,
          enumerable: Boolean(_locations)
        },
        path: {
          value: path || void 0,
          enumerable: Boolean(path)
        },
        nodes: {
          value: _nodes || void 0
        },
        source: {
          value: _source || void 0
        },
        positions: {
          value: _positions || void 0
        },
        originalError: {
          value: originalError
        },
        extensions: {
          value: _extensions || void 0,
          enumerable: Boolean(_extensions)
        }
      });
      if (originalError && originalError.stack) {
        Object.defineProperty(this, "stack", {
          value: originalError.stack,
          writable: true,
          configurable: true
        });
      } else if (Error.captureStackTrace) {
        Error.captureStackTrace(this, GraphQLError);
      } else {
        Object.defineProperty(this, "stack", {
          value: Error().stack,
          writable: true,
          configurable: true
        });
      }
    }
    GraphQLError.prototype = Object.create(Error.prototype, {
      constructor: {
        value: GraphQLError
      },
      name: {
        value: "GraphQLError"
      },
      toString: {
        value: function toString() {
          return printError(this);
        }
      }
    });
    function printError(error) {
      var output = error.message;
      if (error.nodes) {
        for (var _i2 = 0, _error$nodes2 = error.nodes; _i2 < _error$nodes2.length; _i2++) {
          var node = _error$nodes2[_i2];
          if (node.loc) {
            output += "\n\n" + (0, _printLocation.printLocation)(node.loc);
          }
        }
      } else if (error.source && error.locations) {
        for (var _i4 = 0, _error$locations2 = error.locations; _i4 < _error$locations2.length; _i4++) {
          var location = _error$locations2[_i4];
          output += "\n\n" + (0, _printLocation.printSourceLocation)(error.source, location);
        }
      }
      return output;
    }
  }
});

// ../api/node_modules/graphql/error/syntaxError.js
var require_syntaxError = __commonJS({
  "../api/node_modules/graphql/error/syntaxError.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", {
      value: true
    });
    exports.syntaxError = syntaxError;
    var _GraphQLError = require_GraphQLError();
    function syntaxError(source, position, description) {
      return new _GraphQLError.GraphQLError("Syntax Error: ".concat(description), void 0, source, [position]);
    }
  }
});

// ../api/node_modules/graphql/language/kinds.js
var require_kinds = __commonJS({
  "../api/node_modules/graphql/language/kinds.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", {
      value: true
    });
    exports.Kind = void 0;
    var Kind = Object.freeze({
      NAME: "Name",
      DOCUMENT: "Document",
      OPERATION_DEFINITION: "OperationDefinition",
      VARIABLE_DEFINITION: "VariableDefinition",
      SELECTION_SET: "SelectionSet",
      FIELD: "Field",
      ARGUMENT: "Argument",
      FRAGMENT_SPREAD: "FragmentSpread",
      INLINE_FRAGMENT: "InlineFragment",
      FRAGMENT_DEFINITION: "FragmentDefinition",
      VARIABLE: "Variable",
      INT: "IntValue",
      FLOAT: "FloatValue",
      STRING: "StringValue",
      BOOLEAN: "BooleanValue",
      NULL: "NullValue",
      ENUM: "EnumValue",
      LIST: "ListValue",
      OBJECT: "ObjectValue",
      OBJECT_FIELD: "ObjectField",
      DIRECTIVE: "Directive",
      NAMED_TYPE: "NamedType",
      LIST_TYPE: "ListType",
      NON_NULL_TYPE: "NonNullType",
      SCHEMA_DEFINITION: "SchemaDefinition",
      OPERATION_TYPE_DEFINITION: "OperationTypeDefinition",
      SCALAR_TYPE_DEFINITION: "ScalarTypeDefinition",
      OBJECT_TYPE_DEFINITION: "ObjectTypeDefinition",
      FIELD_DEFINITION: "FieldDefinition",
      INPUT_VALUE_DEFINITION: "InputValueDefinition",
      INTERFACE_TYPE_DEFINITION: "InterfaceTypeDefinition",
      UNION_TYPE_DEFINITION: "UnionTypeDefinition",
      ENUM_TYPE_DEFINITION: "EnumTypeDefinition",
      ENUM_VALUE_DEFINITION: "EnumValueDefinition",
      INPUT_OBJECT_TYPE_DEFINITION: "InputObjectTypeDefinition",
      DIRECTIVE_DEFINITION: "DirectiveDefinition",
      SCHEMA_EXTENSION: "SchemaExtension",
      SCALAR_TYPE_EXTENSION: "ScalarTypeExtension",
      OBJECT_TYPE_EXTENSION: "ObjectTypeExtension",
      INTERFACE_TYPE_EXTENSION: "InterfaceTypeExtension",
      UNION_TYPE_EXTENSION: "UnionTypeExtension",
      ENUM_TYPE_EXTENSION: "EnumTypeExtension",
      INPUT_OBJECT_TYPE_EXTENSION: "InputObjectTypeExtension"
    });
    exports.Kind = Kind;
  }
});

// ../api/node_modules/graphql/jsutils/defineToStringTag.js
var require_defineToStringTag = __commonJS({
  "../api/node_modules/graphql/jsutils/defineToStringTag.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", {
      value: true
    });
    exports.default = defineToStringTag;
    function defineToStringTag(classObject) {
      if (typeof Symbol === "function" && Symbol.toStringTag) {
        Object.defineProperty(classObject.prototype, Symbol.toStringTag, {
          get: function get() {
            return this.constructor.name;
          }
        });
      }
    }
  }
});

// ../api/node_modules/graphql/language/source.js
var require_source = __commonJS({
  "../api/node_modules/graphql/language/source.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", {
      value: true
    });
    exports.Source = void 0;
    var _devAssert = _interopRequireDefault(require_devAssert());
    var _defineToStringTag = _interopRequireDefault(require_defineToStringTag());
    function _interopRequireDefault(obj) {
      return obj && obj.__esModule ? obj : { default: obj };
    }
    var Source = function Source2(body, name, locationOffset) {
      this.body = body;
      this.name = name || "GraphQL request";
      this.locationOffset = locationOffset || {
        line: 1,
        column: 1
      };
      this.locationOffset.line > 0 || (0, _devAssert.default)(0, "line in locationOffset is 1-indexed and must be positive");
      this.locationOffset.column > 0 || (0, _devAssert.default)(0, "column in locationOffset is 1-indexed and must be positive");
    };
    exports.Source = Source;
    (0, _defineToStringTag.default)(Source);
  }
});

// ../api/node_modules/graphql/language/blockString.js
var require_blockString = __commonJS({
  "../api/node_modules/graphql/language/blockString.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", {
      value: true
    });
    exports.dedentBlockStringValue = dedentBlockStringValue;
    exports.getBlockStringIndentation = getBlockStringIndentation;
    exports.printBlockString = printBlockString;
    function dedentBlockStringValue(rawString) {
      var lines = rawString.split(/\r\n|[\n\r]/g);
      var commonIndent = getBlockStringIndentation(lines);
      if (commonIndent !== 0) {
        for (var i = 1; i < lines.length; i++) {
          lines[i] = lines[i].slice(commonIndent);
        }
      }
      while (lines.length > 0 && isBlank(lines[0])) {
        lines.shift();
      }
      while (lines.length > 0 && isBlank(lines[lines.length - 1])) {
        lines.pop();
      }
      return lines.join("\n");
    }
    function getBlockStringIndentation(lines) {
      var commonIndent = null;
      for (var i = 1; i < lines.length; i++) {
        var line = lines[i];
        var indent = leadingWhitespace(line);
        if (indent === line.length) {
          continue;
        }
        if (commonIndent === null || indent < commonIndent) {
          commonIndent = indent;
          if (commonIndent === 0) {
            break;
          }
        }
      }
      return commonIndent === null ? 0 : commonIndent;
    }
    function leadingWhitespace(str) {
      var i = 0;
      while (i < str.length && (str[i] === " " || str[i] === "	")) {
        i++;
      }
      return i;
    }
    function isBlank(str) {
      return leadingWhitespace(str) === str.length;
    }
    function printBlockString(value) {
      var indentation = arguments.length > 1 && arguments[1] !== void 0 ? arguments[1] : "";
      var preferMultipleLines = arguments.length > 2 && arguments[2] !== void 0 ? arguments[2] : false;
      var isSingleLine = value.indexOf("\n") === -1;
      var hasLeadingSpace = value[0] === " " || value[0] === "	";
      var hasTrailingQuote = value[value.length - 1] === '"';
      var printAsMultipleLines = !isSingleLine || hasTrailingQuote || preferMultipleLines;
      var result = "";
      if (printAsMultipleLines && !(isSingleLine && hasLeadingSpace)) {
        result += "\n" + indentation;
      }
      result += indentation ? value.replace(/\n/g, "\n" + indentation) : value;
      if (printAsMultipleLines) {
        result += "\n";
      }
      return '"""' + result.replace(/"""/g, '\\"""') + '"""';
    }
  }
});

// ../api/node_modules/graphql/language/tokenKind.js
var require_tokenKind = __commonJS({
  "../api/node_modules/graphql/language/tokenKind.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", {
      value: true
    });
    exports.TokenKind = void 0;
    var TokenKind = Object.freeze({
      SOF: "<SOF>",
      EOF: "<EOF>",
      BANG: "!",
      DOLLAR: "$",
      AMP: "&",
      PAREN_L: "(",
      PAREN_R: ")",
      SPREAD: "...",
      COLON: ":",
      EQUALS: "=",
      AT: "@",
      BRACKET_L: "[",
      BRACKET_R: "]",
      BRACE_L: "{",
      PIPE: "|",
      BRACE_R: "}",
      NAME: "Name",
      INT: "Int",
      FLOAT: "Float",
      STRING: "String",
      BLOCK_STRING: "BlockString",
      COMMENT: "Comment"
    });
    exports.TokenKind = TokenKind;
  }
});

// ../api/node_modules/graphql/language/lexer.js
var require_lexer = __commonJS({
  "../api/node_modules/graphql/language/lexer.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", {
      value: true
    });
    exports.createLexer = createLexer;
    exports.isPunctuatorToken = isPunctuatorToken;
    var _defineToJSON = _interopRequireDefault(require_defineToJSON());
    var _syntaxError = require_syntaxError();
    var _blockString = require_blockString();
    var _tokenKind = require_tokenKind();
    function _interopRequireDefault(obj) {
      return obj && obj.__esModule ? obj : { default: obj };
    }
    function createLexer(source, options) {
      var startOfFileToken = new Tok(_tokenKind.TokenKind.SOF, 0, 0, 0, 0, null);
      var lexer = {
        source,
        options,
        lastToken: startOfFileToken,
        token: startOfFileToken,
        line: 1,
        lineStart: 0,
        advance: advanceLexer,
        lookahead
      };
      return lexer;
    }
    function advanceLexer() {
      this.lastToken = this.token;
      var token = this.token = this.lookahead();
      return token;
    }
    function lookahead() {
      var token = this.token;
      if (token.kind !== _tokenKind.TokenKind.EOF) {
        do {
          token = token.next || (token.next = readToken(this, token));
        } while (token.kind === _tokenKind.TokenKind.COMMENT);
      }
      return token;
    }
    function isPunctuatorToken(token) {
      var kind = token.kind;
      return kind === _tokenKind.TokenKind.BANG || kind === _tokenKind.TokenKind.DOLLAR || kind === _tokenKind.TokenKind.AMP || kind === _tokenKind.TokenKind.PAREN_L || kind === _tokenKind.TokenKind.PAREN_R || kind === _tokenKind.TokenKind.SPREAD || kind === _tokenKind.TokenKind.COLON || kind === _tokenKind.TokenKind.EQUALS || kind === _tokenKind.TokenKind.AT || kind === _tokenKind.TokenKind.BRACKET_L || kind === _tokenKind.TokenKind.BRACKET_R || kind === _tokenKind.TokenKind.BRACE_L || kind === _tokenKind.TokenKind.PIPE || kind === _tokenKind.TokenKind.BRACE_R;
    }
    function Tok(kind, start, end, line, column, prev, value) {
      this.kind = kind;
      this.start = start;
      this.end = end;
      this.line = line;
      this.column = column;
      this.value = value;
      this.prev = prev;
      this.next = null;
    }
    (0, _defineToJSON.default)(Tok, function() {
      return {
        kind: this.kind,
        value: this.value,
        line: this.line,
        column: this.column
      };
    });
    function printCharCode(code) {
      return isNaN(code) ? _tokenKind.TokenKind.EOF : code < 127 ? JSON.stringify(String.fromCharCode(code)) : '"\\u'.concat(("00" + code.toString(16).toUpperCase()).slice(-4), '"');
    }
    function readToken(lexer, prev) {
      var source = lexer.source;
      var body = source.body;
      var bodyLength = body.length;
      var pos = positionAfterWhitespace(body, prev.end, lexer);
      var line = lexer.line;
      var col = 1 + pos - lexer.lineStart;
      if (pos >= bodyLength) {
        return new Tok(_tokenKind.TokenKind.EOF, bodyLength, bodyLength, line, col, prev);
      }
      var code = body.charCodeAt(pos);
      switch (code) {
        case 33:
          return new Tok(_tokenKind.TokenKind.BANG, pos, pos + 1, line, col, prev);
        case 35:
          return readComment(source, pos, line, col, prev);
        case 36:
          return new Tok(_tokenKind.TokenKind.DOLLAR, pos, pos + 1, line, col, prev);
        case 38:
          return new Tok(_tokenKind.TokenKind.AMP, pos, pos + 1, line, col, prev);
        case 40:
          return new Tok(_tokenKind.TokenKind.PAREN_L, pos, pos + 1, line, col, prev);
        case 41:
          return new Tok(_tokenKind.TokenKind.PAREN_R, pos, pos + 1, line, col, prev);
        case 46:
          if (body.charCodeAt(pos + 1) === 46 && body.charCodeAt(pos + 2) === 46) {
            return new Tok(_tokenKind.TokenKind.SPREAD, pos, pos + 3, line, col, prev);
          }
          break;
        case 58:
          return new Tok(_tokenKind.TokenKind.COLON, pos, pos + 1, line, col, prev);
        case 61:
          return new Tok(_tokenKind.TokenKind.EQUALS, pos, pos + 1, line, col, prev);
        case 64:
          return new Tok(_tokenKind.TokenKind.AT, pos, pos + 1, line, col, prev);
        case 91:
          return new Tok(_tokenKind.TokenKind.BRACKET_L, pos, pos + 1, line, col, prev);
        case 93:
          return new Tok(_tokenKind.TokenKind.BRACKET_R, pos, pos + 1, line, col, prev);
        case 123:
          return new Tok(_tokenKind.TokenKind.BRACE_L, pos, pos + 1, line, col, prev);
        case 124:
          return new Tok(_tokenKind.TokenKind.PIPE, pos, pos + 1, line, col, prev);
        case 125:
          return new Tok(_tokenKind.TokenKind.BRACE_R, pos, pos + 1, line, col, prev);
        case 65:
        case 66:
        case 67:
        case 68:
        case 69:
        case 70:
        case 71:
        case 72:
        case 73:
        case 74:
        case 75:
        case 76:
        case 77:
        case 78:
        case 79:
        case 80:
        case 81:
        case 82:
        case 83:
        case 84:
        case 85:
        case 86:
        case 87:
        case 88:
        case 89:
        case 90:
        case 95:
        case 97:
        case 98:
        case 99:
        case 100:
        case 101:
        case 102:
        case 103:
        case 104:
        case 105:
        case 106:
        case 107:
        case 108:
        case 109:
        case 110:
        case 111:
        case 112:
        case 113:
        case 114:
        case 115:
        case 116:
        case 117:
        case 118:
        case 119:
        case 120:
        case 121:
        case 122:
          return readName(source, pos, line, col, prev);
        case 45:
        case 48:
        case 49:
        case 50:
        case 51:
        case 52:
        case 53:
        case 54:
        case 55:
        case 56:
        case 57:
          return readNumber(source, pos, code, line, col, prev);
        case 34:
          if (body.charCodeAt(pos + 1) === 34 && body.charCodeAt(pos + 2) === 34) {
            return readBlockString(source, pos, line, col, prev, lexer);
          }
          return readString(source, pos, line, col, prev);
      }
      throw (0, _syntaxError.syntaxError)(source, pos, unexpectedCharacterMessage(code));
    }
    function unexpectedCharacterMessage(code) {
      if (code < 32 && code !== 9 && code !== 10 && code !== 13) {
        return "Cannot contain the invalid character ".concat(printCharCode(code), ".");
      }
      if (code === 39) {
        return `Unexpected single quote character ('), did you mean to use a double quote (")?`;
      }
      return "Cannot parse the unexpected character ".concat(printCharCode(code), ".");
    }
    function positionAfterWhitespace(body, startPosition, lexer) {
      var bodyLength = body.length;
      var position = startPosition;
      while (position < bodyLength) {
        var code = body.charCodeAt(position);
        if (code === 9 || code === 32 || code === 44 || code === 65279) {
          ++position;
        } else if (code === 10) {
          ++position;
          ++lexer.line;
          lexer.lineStart = position;
        } else if (code === 13) {
          if (body.charCodeAt(position + 1) === 10) {
            position += 2;
          } else {
            ++position;
          }
          ++lexer.line;
          lexer.lineStart = position;
        } else {
          break;
        }
      }
      return position;
    }
    function readComment(source, start, line, col, prev) {
      var body = source.body;
      var code;
      var position = start;
      do {
        code = body.charCodeAt(++position);
      } while (!isNaN(code) && (code > 31 || code === 9));
      return new Tok(_tokenKind.TokenKind.COMMENT, start, position, line, col, prev, body.slice(start + 1, position));
    }
    function readNumber(source, start, firstCode, line, col, prev) {
      var body = source.body;
      var code = firstCode;
      var position = start;
      var isFloat = false;
      if (code === 45) {
        code = body.charCodeAt(++position);
      }
      if (code === 48) {
        code = body.charCodeAt(++position);
        if (code >= 48 && code <= 57) {
          throw (0, _syntaxError.syntaxError)(source, position, "Invalid number, unexpected digit after 0: ".concat(printCharCode(code), "."));
        }
      } else {
        position = readDigits(source, position, code);
        code = body.charCodeAt(position);
      }
      if (code === 46) {
        isFloat = true;
        code = body.charCodeAt(++position);
        position = readDigits(source, position, code);
        code = body.charCodeAt(position);
      }
      if (code === 69 || code === 101) {
        isFloat = true;
        code = body.charCodeAt(++position);
        if (code === 43 || code === 45) {
          code = body.charCodeAt(++position);
        }
        position = readDigits(source, position, code);
        code = body.charCodeAt(position);
      }
      if (code === 46 || code === 69 || code === 101) {
        throw (0, _syntaxError.syntaxError)(source, position, "Invalid number, expected digit but got: ".concat(printCharCode(code), "."));
      }
      return new Tok(isFloat ? _tokenKind.TokenKind.FLOAT : _tokenKind.TokenKind.INT, start, position, line, col, prev, body.slice(start, position));
    }
    function readDigits(source, start, firstCode) {
      var body = source.body;
      var position = start;
      var code = firstCode;
      if (code >= 48 && code <= 57) {
        do {
          code = body.charCodeAt(++position);
        } while (code >= 48 && code <= 57);
        return position;
      }
      throw (0, _syntaxError.syntaxError)(source, position, "Invalid number, expected digit but got: ".concat(printCharCode(code), "."));
    }
    function readString(source, start, line, col, prev) {
      var body = source.body;
      var position = start + 1;
      var chunkStart = position;
      var code = 0;
      var value = "";
      while (position < body.length && !isNaN(code = body.charCodeAt(position)) && code !== 10 && code !== 13) {
        if (code === 34) {
          value += body.slice(chunkStart, position);
          return new Tok(_tokenKind.TokenKind.STRING, start, position + 1, line, col, prev, value);
        }
        if (code < 32 && code !== 9) {
          throw (0, _syntaxError.syntaxError)(source, position, "Invalid character within String: ".concat(printCharCode(code), "."));
        }
        ++position;
        if (code === 92) {
          value += body.slice(chunkStart, position - 1);
          code = body.charCodeAt(position);
          switch (code) {
            case 34:
              value += '"';
              break;
            case 47:
              value += "/";
              break;
            case 92:
              value += "\\";
              break;
            case 98:
              value += "\b";
              break;
            case 102:
              value += "\f";
              break;
            case 110:
              value += "\n";
              break;
            case 114:
              value += "\r";
              break;
            case 116:
              value += "	";
              break;
            case 117: {
              var charCode = uniCharCode(body.charCodeAt(position + 1), body.charCodeAt(position + 2), body.charCodeAt(position + 3), body.charCodeAt(position + 4));
              if (charCode < 0) {
                var invalidSequence = body.slice(position + 1, position + 5);
                throw (0, _syntaxError.syntaxError)(source, position, "Invalid character escape sequence: \\u".concat(invalidSequence, "."));
              }
              value += String.fromCharCode(charCode);
              position += 4;
              break;
            }
            default:
              throw (0, _syntaxError.syntaxError)(source, position, "Invalid character escape sequence: \\".concat(String.fromCharCode(code), "."));
          }
          ++position;
          chunkStart = position;
        }
      }
      throw (0, _syntaxError.syntaxError)(source, position, "Unterminated string.");
    }
    function readBlockString(source, start, line, col, prev, lexer) {
      var body = source.body;
      var position = start + 3;
      var chunkStart = position;
      var code = 0;
      var rawValue = "";
      while (position < body.length && !isNaN(code = body.charCodeAt(position))) {
        if (code === 34 && body.charCodeAt(position + 1) === 34 && body.charCodeAt(position + 2) === 34) {
          rawValue += body.slice(chunkStart, position);
          return new Tok(_tokenKind.TokenKind.BLOCK_STRING, start, position + 3, line, col, prev, (0, _blockString.dedentBlockStringValue)(rawValue));
        }
        if (code < 32 && code !== 9 && code !== 10 && code !== 13) {
          throw (0, _syntaxError.syntaxError)(source, position, "Invalid character within String: ".concat(printCharCode(code), "."));
        }
        if (code === 10) {
          ++position;
          ++lexer.line;
          lexer.lineStart = position;
        } else if (code === 13) {
          if (body.charCodeAt(position + 1) === 10) {
            position += 2;
          } else {
            ++position;
          }
          ++lexer.line;
          lexer.lineStart = position;
        } else if (code === 92 && body.charCodeAt(position + 1) === 34 && body.charCodeAt(position + 2) === 34 && body.charCodeAt(position + 3) === 34) {
          rawValue += body.slice(chunkStart, position) + '"""';
          position += 4;
          chunkStart = position;
        } else {
          ++position;
        }
      }
      throw (0, _syntaxError.syntaxError)(source, position, "Unterminated string.");
    }
    function uniCharCode(a, b, c, d) {
      return char2hex(a) << 12 | char2hex(b) << 8 | char2hex(c) << 4 | char2hex(d);
    }
    function char2hex(a) {
      return a >= 48 && a <= 57 ? a - 48 : a >= 65 && a <= 70 ? a - 55 : a >= 97 && a <= 102 ? a - 87 : -1;
    }
    function readName(source, start, line, col, prev) {
      var body = source.body;
      var bodyLength = body.length;
      var position = start + 1;
      var code = 0;
      while (position !== bodyLength && !isNaN(code = body.charCodeAt(position)) && (code === 95 || code >= 48 && code <= 57 || code >= 65 && code <= 90 || code >= 97 && code <= 122)) {
        ++position;
      }
      return new Tok(_tokenKind.TokenKind.NAME, start, position, line, col, prev, body.slice(start, position));
    }
  }
});

// ../api/node_modules/graphql/language/directiveLocation.js
var require_directiveLocation = __commonJS({
  "../api/node_modules/graphql/language/directiveLocation.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", {
      value: true
    });
    exports.DirectiveLocation = void 0;
    var DirectiveLocation = Object.freeze({
      QUERY: "QUERY",
      MUTATION: "MUTATION",
      SUBSCRIPTION: "SUBSCRIPTION",
      FIELD: "FIELD",
      FRAGMENT_DEFINITION: "FRAGMENT_DEFINITION",
      FRAGMENT_SPREAD: "FRAGMENT_SPREAD",
      INLINE_FRAGMENT: "INLINE_FRAGMENT",
      VARIABLE_DEFINITION: "VARIABLE_DEFINITION",
      SCHEMA: "SCHEMA",
      SCALAR: "SCALAR",
      OBJECT: "OBJECT",
      FIELD_DEFINITION: "FIELD_DEFINITION",
      ARGUMENT_DEFINITION: "ARGUMENT_DEFINITION",
      INTERFACE: "INTERFACE",
      UNION: "UNION",
      ENUM: "ENUM",
      ENUM_VALUE: "ENUM_VALUE",
      INPUT_OBJECT: "INPUT_OBJECT",
      INPUT_FIELD_DEFINITION: "INPUT_FIELD_DEFINITION"
    });
    exports.DirectiveLocation = DirectiveLocation;
  }
});

// ../api/node_modules/graphql/language/parser.js
var require_parser = __commonJS({
  "../api/node_modules/graphql/language/parser.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", {
      value: true
    });
    exports.parse = parse;
    exports.parseValue = parseValue;
    exports.parseType = parseType;
    var _inspect = _interopRequireDefault(require_inspect());
    var _devAssert = _interopRequireDefault(require_devAssert());
    var _defineToJSON = _interopRequireDefault(require_defineToJSON());
    var _syntaxError = require_syntaxError();
    var _kinds = require_kinds();
    var _source = require_source();
    var _lexer = require_lexer();
    var _directiveLocation = require_directiveLocation();
    var _tokenKind = require_tokenKind();
    function _interopRequireDefault(obj) {
      return obj && obj.__esModule ? obj : { default: obj };
    }
    function parse(source, options) {
      var parser = new Parser(source, options);
      return parser.parseDocument();
    }
    function parseValue(source, options) {
      var parser = new Parser(source, options);
      parser.expectToken(_tokenKind.TokenKind.SOF);
      var value = parser.parseValueLiteral(false);
      parser.expectToken(_tokenKind.TokenKind.EOF);
      return value;
    }
    function parseType(source, options) {
      var parser = new Parser(source, options);
      parser.expectToken(_tokenKind.TokenKind.SOF);
      var type = parser.parseTypeReference();
      parser.expectToken(_tokenKind.TokenKind.EOF);
      return type;
    }
    var Parser = /* @__PURE__ */ function() {
      function Parser2(source, options) {
        var sourceObj = typeof source === "string" ? new _source.Source(source) : source;
        sourceObj instanceof _source.Source || (0, _devAssert.default)(0, "Must provide Source. Received: ".concat((0, _inspect.default)(sourceObj)));
        this._lexer = (0, _lexer.createLexer)(sourceObj);
        this._options = options || {};
      }
      var _proto = Parser2.prototype;
      _proto.parseName = function parseName() {
        var token = this.expectToken(_tokenKind.TokenKind.NAME);
        return {
          kind: _kinds.Kind.NAME,
          value: token.value,
          loc: this.loc(token)
        };
      };
      _proto.parseDocument = function parseDocument() {
        var start = this._lexer.token;
        return {
          kind: _kinds.Kind.DOCUMENT,
          definitions: this.many(_tokenKind.TokenKind.SOF, this.parseDefinition, _tokenKind.TokenKind.EOF),
          loc: this.loc(start)
        };
      };
      _proto.parseDefinition = function parseDefinition() {
        if (this.peek(_tokenKind.TokenKind.NAME)) {
          switch (this._lexer.token.value) {
            case "query":
            case "mutation":
            case "subscription":
              return this.parseOperationDefinition();
            case "fragment":
              return this.parseFragmentDefinition();
            case "schema":
            case "scalar":
            case "type":
            case "interface":
            case "union":
            case "enum":
            case "input":
            case "directive":
              return this.parseTypeSystemDefinition();
            case "extend":
              return this.parseTypeSystemExtension();
          }
        } else if (this.peek(_tokenKind.TokenKind.BRACE_L)) {
          return this.parseOperationDefinition();
        } else if (this.peekDescription()) {
          return this.parseTypeSystemDefinition();
        }
        throw this.unexpected();
      };
      _proto.parseOperationDefinition = function parseOperationDefinition() {
        var start = this._lexer.token;
        if (this.peek(_tokenKind.TokenKind.BRACE_L)) {
          return {
            kind: _kinds.Kind.OPERATION_DEFINITION,
            operation: "query",
            name: void 0,
            variableDefinitions: [],
            directives: [],
            selectionSet: this.parseSelectionSet(),
            loc: this.loc(start)
          };
        }
        var operation = this.parseOperationType();
        var name;
        if (this.peek(_tokenKind.TokenKind.NAME)) {
          name = this.parseName();
        }
        return {
          kind: _kinds.Kind.OPERATION_DEFINITION,
          operation,
          name,
          variableDefinitions: this.parseVariableDefinitions(),
          directives: this.parseDirectives(false),
          selectionSet: this.parseSelectionSet(),
          loc: this.loc(start)
        };
      };
      _proto.parseOperationType = function parseOperationType() {
        var operationToken = this.expectToken(_tokenKind.TokenKind.NAME);
        switch (operationToken.value) {
          case "query":
            return "query";
          case "mutation":
            return "mutation";
          case "subscription":
            return "subscription";
        }
        throw this.unexpected(operationToken);
      };
      _proto.parseVariableDefinitions = function parseVariableDefinitions() {
        return this.optionalMany(_tokenKind.TokenKind.PAREN_L, this.parseVariableDefinition, _tokenKind.TokenKind.PAREN_R);
      };
      _proto.parseVariableDefinition = function parseVariableDefinition() {
        var start = this._lexer.token;
        return {
          kind: _kinds.Kind.VARIABLE_DEFINITION,
          variable: this.parseVariable(),
          type: (this.expectToken(_tokenKind.TokenKind.COLON), this.parseTypeReference()),
          defaultValue: this.expectOptionalToken(_tokenKind.TokenKind.EQUALS) ? this.parseValueLiteral(true) : void 0,
          directives: this.parseDirectives(true),
          loc: this.loc(start)
        };
      };
      _proto.parseVariable = function parseVariable() {
        var start = this._lexer.token;
        this.expectToken(_tokenKind.TokenKind.DOLLAR);
        return {
          kind: _kinds.Kind.VARIABLE,
          name: this.parseName(),
          loc: this.loc(start)
        };
      };
      _proto.parseSelectionSet = function parseSelectionSet() {
        var start = this._lexer.token;
        return {
          kind: _kinds.Kind.SELECTION_SET,
          selections: this.many(_tokenKind.TokenKind.BRACE_L, this.parseSelection, _tokenKind.TokenKind.BRACE_R),
          loc: this.loc(start)
        };
      };
      _proto.parseSelection = function parseSelection() {
        return this.peek(_tokenKind.TokenKind.SPREAD) ? this.parseFragment() : this.parseField();
      };
      _proto.parseField = function parseField() {
        var start = this._lexer.token;
        var nameOrAlias = this.parseName();
        var alias;
        var name;
        if (this.expectOptionalToken(_tokenKind.TokenKind.COLON)) {
          alias = nameOrAlias;
          name = this.parseName();
        } else {
          name = nameOrAlias;
        }
        return {
          kind: _kinds.Kind.FIELD,
          alias,
          name,
          arguments: this.parseArguments(false),
          directives: this.parseDirectives(false),
          selectionSet: this.peek(_tokenKind.TokenKind.BRACE_L) ? this.parseSelectionSet() : void 0,
          loc: this.loc(start)
        };
      };
      _proto.parseArguments = function parseArguments(isConst) {
        var item = isConst ? this.parseConstArgument : this.parseArgument;
        return this.optionalMany(_tokenKind.TokenKind.PAREN_L, item, _tokenKind.TokenKind.PAREN_R);
      };
      _proto.parseArgument = function parseArgument() {
        var start = this._lexer.token;
        var name = this.parseName();
        this.expectToken(_tokenKind.TokenKind.COLON);
        return {
          kind: _kinds.Kind.ARGUMENT,
          name,
          value: this.parseValueLiteral(false),
          loc: this.loc(start)
        };
      };
      _proto.parseConstArgument = function parseConstArgument() {
        var start = this._lexer.token;
        return {
          kind: _kinds.Kind.ARGUMENT,
          name: this.parseName(),
          value: (this.expectToken(_tokenKind.TokenKind.COLON), this.parseValueLiteral(true)),
          loc: this.loc(start)
        };
      };
      _proto.parseFragment = function parseFragment() {
        var start = this._lexer.token;
        this.expectToken(_tokenKind.TokenKind.SPREAD);
        var hasTypeCondition = this.expectOptionalKeyword("on");
        if (!hasTypeCondition && this.peek(_tokenKind.TokenKind.NAME)) {
          return {
            kind: _kinds.Kind.FRAGMENT_SPREAD,
            name: this.parseFragmentName(),
            directives: this.parseDirectives(false),
            loc: this.loc(start)
          };
        }
        return {
          kind: _kinds.Kind.INLINE_FRAGMENT,
          typeCondition: hasTypeCondition ? this.parseNamedType() : void 0,
          directives: this.parseDirectives(false),
          selectionSet: this.parseSelectionSet(),
          loc: this.loc(start)
        };
      };
      _proto.parseFragmentDefinition = function parseFragmentDefinition() {
        var start = this._lexer.token;
        this.expectKeyword("fragment");
        if (this._options.experimentalFragmentVariables) {
          return {
            kind: _kinds.Kind.FRAGMENT_DEFINITION,
            name: this.parseFragmentName(),
            variableDefinitions: this.parseVariableDefinitions(),
            typeCondition: (this.expectKeyword("on"), this.parseNamedType()),
            directives: this.parseDirectives(false),
            selectionSet: this.parseSelectionSet(),
            loc: this.loc(start)
          };
        }
        return {
          kind: _kinds.Kind.FRAGMENT_DEFINITION,
          name: this.parseFragmentName(),
          typeCondition: (this.expectKeyword("on"), this.parseNamedType()),
          directives: this.parseDirectives(false),
          selectionSet: this.parseSelectionSet(),
          loc: this.loc(start)
        };
      };
      _proto.parseFragmentName = function parseFragmentName() {
        if (this._lexer.token.value === "on") {
          throw this.unexpected();
        }
        return this.parseName();
      };
      _proto.parseValueLiteral = function parseValueLiteral(isConst) {
        var token = this._lexer.token;
        switch (token.kind) {
          case _tokenKind.TokenKind.BRACKET_L:
            return this.parseList(isConst);
          case _tokenKind.TokenKind.BRACE_L:
            return this.parseObject(isConst);
          case _tokenKind.TokenKind.INT:
            this._lexer.advance();
            return {
              kind: _kinds.Kind.INT,
              value: token.value,
              loc: this.loc(token)
            };
          case _tokenKind.TokenKind.FLOAT:
            this._lexer.advance();
            return {
              kind: _kinds.Kind.FLOAT,
              value: token.value,
              loc: this.loc(token)
            };
          case _tokenKind.TokenKind.STRING:
          case _tokenKind.TokenKind.BLOCK_STRING:
            return this.parseStringLiteral();
          case _tokenKind.TokenKind.NAME:
            if (token.value === "true" || token.value === "false") {
              this._lexer.advance();
              return {
                kind: _kinds.Kind.BOOLEAN,
                value: token.value === "true",
                loc: this.loc(token)
              };
            } else if (token.value === "null") {
              this._lexer.advance();
              return {
                kind: _kinds.Kind.NULL,
                loc: this.loc(token)
              };
            }
            this._lexer.advance();
            return {
              kind: _kinds.Kind.ENUM,
              value: token.value,
              loc: this.loc(token)
            };
          case _tokenKind.TokenKind.DOLLAR:
            if (!isConst) {
              return this.parseVariable();
            }
            break;
        }
        throw this.unexpected();
      };
      _proto.parseStringLiteral = function parseStringLiteral() {
        var token = this._lexer.token;
        this._lexer.advance();
        return {
          kind: _kinds.Kind.STRING,
          value: token.value,
          block: token.kind === _tokenKind.TokenKind.BLOCK_STRING,
          loc: this.loc(token)
        };
      };
      _proto.parseList = function parseList(isConst) {
        var _this = this;
        var start = this._lexer.token;
        var item = function item2() {
          return _this.parseValueLiteral(isConst);
        };
        return {
          kind: _kinds.Kind.LIST,
          values: this.any(_tokenKind.TokenKind.BRACKET_L, item, _tokenKind.TokenKind.BRACKET_R),
          loc: this.loc(start)
        };
      };
      _proto.parseObject = function parseObject(isConst) {
        var _this2 = this;
        var start = this._lexer.token;
        var item = function item2() {
          return _this2.parseObjectField(isConst);
        };
        return {
          kind: _kinds.Kind.OBJECT,
          fields: this.any(_tokenKind.TokenKind.BRACE_L, item, _tokenKind.TokenKind.BRACE_R),
          loc: this.loc(start)
        };
      };
      _proto.parseObjectField = function parseObjectField(isConst) {
        var start = this._lexer.token;
        var name = this.parseName();
        this.expectToken(_tokenKind.TokenKind.COLON);
        return {
          kind: _kinds.Kind.OBJECT_FIELD,
          name,
          value: this.parseValueLiteral(isConst),
          loc: this.loc(start)
        };
      };
      _proto.parseDirectives = function parseDirectives(isConst) {
        var directives = [];
        while (this.peek(_tokenKind.TokenKind.AT)) {
          directives.push(this.parseDirective(isConst));
        }
        return directives;
      };
      _proto.parseDirective = function parseDirective(isConst) {
        var start = this._lexer.token;
        this.expectToken(_tokenKind.TokenKind.AT);
        return {
          kind: _kinds.Kind.DIRECTIVE,
          name: this.parseName(),
          arguments: this.parseArguments(isConst),
          loc: this.loc(start)
        };
      };
      _proto.parseTypeReference = function parseTypeReference() {
        var start = this._lexer.token;
        var type;
        if (this.expectOptionalToken(_tokenKind.TokenKind.BRACKET_L)) {
          type = this.parseTypeReference();
          this.expectToken(_tokenKind.TokenKind.BRACKET_R);
          type = {
            kind: _kinds.Kind.LIST_TYPE,
            type,
            loc: this.loc(start)
          };
        } else {
          type = this.parseNamedType();
        }
        if (this.expectOptionalToken(_tokenKind.TokenKind.BANG)) {
          return {
            kind: _kinds.Kind.NON_NULL_TYPE,
            type,
            loc: this.loc(start)
          };
        }
        return type;
      };
      _proto.parseNamedType = function parseNamedType() {
        var start = this._lexer.token;
        return {
          kind: _kinds.Kind.NAMED_TYPE,
          name: this.parseName(),
          loc: this.loc(start)
        };
      };
      _proto.parseTypeSystemDefinition = function parseTypeSystemDefinition() {
        var keywordToken = this.peekDescription() ? this._lexer.lookahead() : this._lexer.token;
        if (keywordToken.kind === _tokenKind.TokenKind.NAME) {
          switch (keywordToken.value) {
            case "schema":
              return this.parseSchemaDefinition();
            case "scalar":
              return this.parseScalarTypeDefinition();
            case "type":
              return this.parseObjectTypeDefinition();
            case "interface":
              return this.parseInterfaceTypeDefinition();
            case "union":
              return this.parseUnionTypeDefinition();
            case "enum":
              return this.parseEnumTypeDefinition();
            case "input":
              return this.parseInputObjectTypeDefinition();
            case "directive":
              return this.parseDirectiveDefinition();
          }
        }
        throw this.unexpected(keywordToken);
      };
      _proto.peekDescription = function peekDescription() {
        return this.peek(_tokenKind.TokenKind.STRING) || this.peek(_tokenKind.TokenKind.BLOCK_STRING);
      };
      _proto.parseDescription = function parseDescription() {
        if (this.peekDescription()) {
          return this.parseStringLiteral();
        }
      };
      _proto.parseSchemaDefinition = function parseSchemaDefinition() {
        var start = this._lexer.token;
        this.expectKeyword("schema");
        var directives = this.parseDirectives(true);
        var operationTypes = this.many(_tokenKind.TokenKind.BRACE_L, this.parseOperationTypeDefinition, _tokenKind.TokenKind.BRACE_R);
        return {
          kind: _kinds.Kind.SCHEMA_DEFINITION,
          directives,
          operationTypes,
          loc: this.loc(start)
        };
      };
      _proto.parseOperationTypeDefinition = function parseOperationTypeDefinition() {
        var start = this._lexer.token;
        var operation = this.parseOperationType();
        this.expectToken(_tokenKind.TokenKind.COLON);
        var type = this.parseNamedType();
        return {
          kind: _kinds.Kind.OPERATION_TYPE_DEFINITION,
          operation,
          type,
          loc: this.loc(start)
        };
      };
      _proto.parseScalarTypeDefinition = function parseScalarTypeDefinition() {
        var start = this._lexer.token;
        var description = this.parseDescription();
        this.expectKeyword("scalar");
        var name = this.parseName();
        var directives = this.parseDirectives(true);
        return {
          kind: _kinds.Kind.SCALAR_TYPE_DEFINITION,
          description,
          name,
          directives,
          loc: this.loc(start)
        };
      };
      _proto.parseObjectTypeDefinition = function parseObjectTypeDefinition() {
        var start = this._lexer.token;
        var description = this.parseDescription();
        this.expectKeyword("type");
        var name = this.parseName();
        var interfaces = this.parseImplementsInterfaces();
        var directives = this.parseDirectives(true);
        var fields = this.parseFieldsDefinition();
        return {
          kind: _kinds.Kind.OBJECT_TYPE_DEFINITION,
          description,
          name,
          interfaces,
          directives,
          fields,
          loc: this.loc(start)
        };
      };
      _proto.parseImplementsInterfaces = function parseImplementsInterfaces() {
        var types = [];
        if (this.expectOptionalKeyword("implements")) {
          this.expectOptionalToken(_tokenKind.TokenKind.AMP);
          do {
            types.push(this.parseNamedType());
          } while (this.expectOptionalToken(_tokenKind.TokenKind.AMP) || this._options.allowLegacySDLImplementsInterfaces && this.peek(_tokenKind.TokenKind.NAME));
        }
        return types;
      };
      _proto.parseFieldsDefinition = function parseFieldsDefinition() {
        if (this._options.allowLegacySDLEmptyFields && this.peek(_tokenKind.TokenKind.BRACE_L) && this._lexer.lookahead().kind === _tokenKind.TokenKind.BRACE_R) {
          this._lexer.advance();
          this._lexer.advance();
          return [];
        }
        return this.optionalMany(_tokenKind.TokenKind.BRACE_L, this.parseFieldDefinition, _tokenKind.TokenKind.BRACE_R);
      };
      _proto.parseFieldDefinition = function parseFieldDefinition() {
        var start = this._lexer.token;
        var description = this.parseDescription();
        var name = this.parseName();
        var args = this.parseArgumentDefs();
        this.expectToken(_tokenKind.TokenKind.COLON);
        var type = this.parseTypeReference();
        var directives = this.parseDirectives(true);
        return {
          kind: _kinds.Kind.FIELD_DEFINITION,
          description,
          name,
          arguments: args,
          type,
          directives,
          loc: this.loc(start)
        };
      };
      _proto.parseArgumentDefs = function parseArgumentDefs() {
        return this.optionalMany(_tokenKind.TokenKind.PAREN_L, this.parseInputValueDef, _tokenKind.TokenKind.PAREN_R);
      };
      _proto.parseInputValueDef = function parseInputValueDef() {
        var start = this._lexer.token;
        var description = this.parseDescription();
        var name = this.parseName();
        this.expectToken(_tokenKind.TokenKind.COLON);
        var type = this.parseTypeReference();
        var defaultValue;
        if (this.expectOptionalToken(_tokenKind.TokenKind.EQUALS)) {
          defaultValue = this.parseValueLiteral(true);
        }
        var directives = this.parseDirectives(true);
        return {
          kind: _kinds.Kind.INPUT_VALUE_DEFINITION,
          description,
          name,
          type,
          defaultValue,
          directives,
          loc: this.loc(start)
        };
      };
      _proto.parseInterfaceTypeDefinition = function parseInterfaceTypeDefinition() {
        var start = this._lexer.token;
        var description = this.parseDescription();
        this.expectKeyword("interface");
        var name = this.parseName();
        var directives = this.parseDirectives(true);
        var fields = this.parseFieldsDefinition();
        return {
          kind: _kinds.Kind.INTERFACE_TYPE_DEFINITION,
          description,
          name,
          directives,
          fields,
          loc: this.loc(start)
        };
      };
      _proto.parseUnionTypeDefinition = function parseUnionTypeDefinition() {
        var start = this._lexer.token;
        var description = this.parseDescription();
        this.expectKeyword("union");
        var name = this.parseName();
        var directives = this.parseDirectives(true);
        var types = this.parseUnionMemberTypes();
        return {
          kind: _kinds.Kind.UNION_TYPE_DEFINITION,
          description,
          name,
          directives,
          types,
          loc: this.loc(start)
        };
      };
      _proto.parseUnionMemberTypes = function parseUnionMemberTypes() {
        var types = [];
        if (this.expectOptionalToken(_tokenKind.TokenKind.EQUALS)) {
          this.expectOptionalToken(_tokenKind.TokenKind.PIPE);
          do {
            types.push(this.parseNamedType());
          } while (this.expectOptionalToken(_tokenKind.TokenKind.PIPE));
        }
        return types;
      };
      _proto.parseEnumTypeDefinition = function parseEnumTypeDefinition() {
        var start = this._lexer.token;
        var description = this.parseDescription();
        this.expectKeyword("enum");
        var name = this.parseName();
        var directives = this.parseDirectives(true);
        var values = this.parseEnumValuesDefinition();
        return {
          kind: _kinds.Kind.ENUM_TYPE_DEFINITION,
          description,
          name,
          directives,
          values,
          loc: this.loc(start)
        };
      };
      _proto.parseEnumValuesDefinition = function parseEnumValuesDefinition() {
        return this.optionalMany(_tokenKind.TokenKind.BRACE_L, this.parseEnumValueDefinition, _tokenKind.TokenKind.BRACE_R);
      };
      _proto.parseEnumValueDefinition = function parseEnumValueDefinition() {
        var start = this._lexer.token;
        var description = this.parseDescription();
        var name = this.parseName();
        var directives = this.parseDirectives(true);
        return {
          kind: _kinds.Kind.ENUM_VALUE_DEFINITION,
          description,
          name,
          directives,
          loc: this.loc(start)
        };
      };
      _proto.parseInputObjectTypeDefinition = function parseInputObjectTypeDefinition() {
        var start = this._lexer.token;
        var description = this.parseDescription();
        this.expectKeyword("input");
        var name = this.parseName();
        var directives = this.parseDirectives(true);
        var fields = this.parseInputFieldsDefinition();
        return {
          kind: _kinds.Kind.INPUT_OBJECT_TYPE_DEFINITION,
          description,
          name,
          directives,
          fields,
          loc: this.loc(start)
        };
      };
      _proto.parseInputFieldsDefinition = function parseInputFieldsDefinition() {
        return this.optionalMany(_tokenKind.TokenKind.BRACE_L, this.parseInputValueDef, _tokenKind.TokenKind.BRACE_R);
      };
      _proto.parseTypeSystemExtension = function parseTypeSystemExtension() {
        var keywordToken = this._lexer.lookahead();
        if (keywordToken.kind === _tokenKind.TokenKind.NAME) {
          switch (keywordToken.value) {
            case "schema":
              return this.parseSchemaExtension();
            case "scalar":
              return this.parseScalarTypeExtension();
            case "type":
              return this.parseObjectTypeExtension();
            case "interface":
              return this.parseInterfaceTypeExtension();
            case "union":
              return this.parseUnionTypeExtension();
            case "enum":
              return this.parseEnumTypeExtension();
            case "input":
              return this.parseInputObjectTypeExtension();
          }
        }
        throw this.unexpected(keywordToken);
      };
      _proto.parseSchemaExtension = function parseSchemaExtension() {
        var start = this._lexer.token;
        this.expectKeyword("extend");
        this.expectKeyword("schema");
        var directives = this.parseDirectives(true);
        var operationTypes = this.optionalMany(_tokenKind.TokenKind.BRACE_L, this.parseOperationTypeDefinition, _tokenKind.TokenKind.BRACE_R);
        if (directives.length === 0 && operationTypes.length === 0) {
          throw this.unexpected();
        }
        return {
          kind: _kinds.Kind.SCHEMA_EXTENSION,
          directives,
          operationTypes,
          loc: this.loc(start)
        };
      };
      _proto.parseScalarTypeExtension = function parseScalarTypeExtension() {
        var start = this._lexer.token;
        this.expectKeyword("extend");
        this.expectKeyword("scalar");
        var name = this.parseName();
        var directives = this.parseDirectives(true);
        if (directives.length === 0) {
          throw this.unexpected();
        }
        return {
          kind: _kinds.Kind.SCALAR_TYPE_EXTENSION,
          name,
          directives,
          loc: this.loc(start)
        };
      };
      _proto.parseObjectTypeExtension = function parseObjectTypeExtension() {
        var start = this._lexer.token;
        this.expectKeyword("extend");
        this.expectKeyword("type");
        var name = this.parseName();
        var interfaces = this.parseImplementsInterfaces();
        var directives = this.parseDirectives(true);
        var fields = this.parseFieldsDefinition();
        if (interfaces.length === 0 && directives.length === 0 && fields.length === 0) {
          throw this.unexpected();
        }
        return {
          kind: _kinds.Kind.OBJECT_TYPE_EXTENSION,
          name,
          interfaces,
          directives,
          fields,
          loc: this.loc(start)
        };
      };
      _proto.parseInterfaceTypeExtension = function parseInterfaceTypeExtension() {
        var start = this._lexer.token;
        this.expectKeyword("extend");
        this.expectKeyword("interface");
        var name = this.parseName();
        var directives = this.parseDirectives(true);
        var fields = this.parseFieldsDefinition();
        if (directives.length === 0 && fields.length === 0) {
          throw this.unexpected();
        }
        return {
          kind: _kinds.Kind.INTERFACE_TYPE_EXTENSION,
          name,
          directives,
          fields,
          loc: this.loc(start)
        };
      };
      _proto.parseUnionTypeExtension = function parseUnionTypeExtension() {
        var start = this._lexer.token;
        this.expectKeyword("extend");
        this.expectKeyword("union");
        var name = this.parseName();
        var directives = this.parseDirectives(true);
        var types = this.parseUnionMemberTypes();
        if (directives.length === 0 && types.length === 0) {
          throw this.unexpected();
        }
        return {
          kind: _kinds.Kind.UNION_TYPE_EXTENSION,
          name,
          directives,
          types,
          loc: this.loc(start)
        };
      };
      _proto.parseEnumTypeExtension = function parseEnumTypeExtension() {
        var start = this._lexer.token;
        this.expectKeyword("extend");
        this.expectKeyword("enum");
        var name = this.parseName();
        var directives = this.parseDirectives(true);
        var values = this.parseEnumValuesDefinition();
        if (directives.length === 0 && values.length === 0) {
          throw this.unexpected();
        }
        return {
          kind: _kinds.Kind.ENUM_TYPE_EXTENSION,
          name,
          directives,
          values,
          loc: this.loc(start)
        };
      };
      _proto.parseInputObjectTypeExtension = function parseInputObjectTypeExtension() {
        var start = this._lexer.token;
        this.expectKeyword("extend");
        this.expectKeyword("input");
        var name = this.parseName();
        var directives = this.parseDirectives(true);
        var fields = this.parseInputFieldsDefinition();
        if (directives.length === 0 && fields.length === 0) {
          throw this.unexpected();
        }
        return {
          kind: _kinds.Kind.INPUT_OBJECT_TYPE_EXTENSION,
          name,
          directives,
          fields,
          loc: this.loc(start)
        };
      };
      _proto.parseDirectiveDefinition = function parseDirectiveDefinition() {
        var start = this._lexer.token;
        var description = this.parseDescription();
        this.expectKeyword("directive");
        this.expectToken(_tokenKind.TokenKind.AT);
        var name = this.parseName();
        var args = this.parseArgumentDefs();
        var repeatable = this.expectOptionalKeyword("repeatable");
        this.expectKeyword("on");
        var locations = this.parseDirectiveLocations();
        return {
          kind: _kinds.Kind.DIRECTIVE_DEFINITION,
          description,
          name,
          arguments: args,
          repeatable,
          locations,
          loc: this.loc(start)
        };
      };
      _proto.parseDirectiveLocations = function parseDirectiveLocations() {
        this.expectOptionalToken(_tokenKind.TokenKind.PIPE);
        var locations = [];
        do {
          locations.push(this.parseDirectiveLocation());
        } while (this.expectOptionalToken(_tokenKind.TokenKind.PIPE));
        return locations;
      };
      _proto.parseDirectiveLocation = function parseDirectiveLocation() {
        var start = this._lexer.token;
        var name = this.parseName();
        if (_directiveLocation.DirectiveLocation[name.value] !== void 0) {
          return name;
        }
        throw this.unexpected(start);
      };
      _proto.loc = function loc(startToken) {
        if (!this._options.noLocation) {
          return new Loc(startToken, this._lexer.lastToken, this._lexer.source);
        }
      };
      _proto.peek = function peek(kind) {
        return this._lexer.token.kind === kind;
      };
      _proto.expectToken = function expectToken(kind) {
        var token = this._lexer.token;
        if (token.kind === kind) {
          this._lexer.advance();
          return token;
        }
        throw (0, _syntaxError.syntaxError)(this._lexer.source, token.start, "Expected ".concat(kind, ", found ").concat(getTokenDesc(token)));
      };
      _proto.expectOptionalToken = function expectOptionalToken(kind) {
        var token = this._lexer.token;
        if (token.kind === kind) {
          this._lexer.advance();
          return token;
        }
        return void 0;
      };
      _proto.expectKeyword = function expectKeyword(value) {
        var token = this._lexer.token;
        if (token.kind === _tokenKind.TokenKind.NAME && token.value === value) {
          this._lexer.advance();
        } else {
          throw (0, _syntaxError.syntaxError)(this._lexer.source, token.start, 'Expected "'.concat(value, '", found ').concat(getTokenDesc(token)));
        }
      };
      _proto.expectOptionalKeyword = function expectOptionalKeyword(value) {
        var token = this._lexer.token;
        if (token.kind === _tokenKind.TokenKind.NAME && token.value === value) {
          this._lexer.advance();
          return true;
        }
        return false;
      };
      _proto.unexpected = function unexpected(atToken) {
        var token = atToken || this._lexer.token;
        return (0, _syntaxError.syntaxError)(this._lexer.source, token.start, "Unexpected ".concat(getTokenDesc(token)));
      };
      _proto.any = function any(openKind, parseFn, closeKind) {
        this.expectToken(openKind);
        var nodes = [];
        while (!this.expectOptionalToken(closeKind)) {
          nodes.push(parseFn.call(this));
        }
        return nodes;
      };
      _proto.optionalMany = function optionalMany(openKind, parseFn, closeKind) {
        if (this.expectOptionalToken(openKind)) {
          var nodes = [];
          do {
            nodes.push(parseFn.call(this));
          } while (!this.expectOptionalToken(closeKind));
          return nodes;
        }
        return [];
      };
      _proto.many = function many(openKind, parseFn, closeKind) {
        this.expectToken(openKind);
        var nodes = [];
        do {
          nodes.push(parseFn.call(this));
        } while (!this.expectOptionalToken(closeKind));
        return nodes;
      };
      return Parser2;
    }();
    function Loc(startToken, endToken, source) {
      this.start = startToken.start;
      this.end = endToken.end;
      this.startToken = startToken;
      this.endToken = endToken;
      this.source = source;
    }
    (0, _defineToJSON.default)(Loc, function() {
      return {
        start: this.start,
        end: this.end
      };
    });
    function getTokenDesc(token) {
      var value = token.value;
      return value ? "".concat(token.kind, ' "').concat(value, '"') : token.kind;
    }
  }
});

// ../api/node_modules/graphql/language/visitor.js
var require_visitor = __commonJS({
  "../api/node_modules/graphql/language/visitor.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", {
      value: true
    });
    exports.visit = visit;
    exports.visitInParallel = visitInParallel;
    exports.visitWithTypeInfo = visitWithTypeInfo;
    exports.getVisitFn = getVisitFn;
    exports.BREAK = exports.QueryDocumentKeys = void 0;
    var _inspect = _interopRequireDefault(require_inspect());
    function _interopRequireDefault(obj) {
      return obj && obj.__esModule ? obj : { default: obj };
    }
    var QueryDocumentKeys = {
      Name: [],
      Document: ["definitions"],
      OperationDefinition: ["name", "variableDefinitions", "directives", "selectionSet"],
      VariableDefinition: ["variable", "type", "defaultValue", "directives"],
      Variable: ["name"],
      SelectionSet: ["selections"],
      Field: ["alias", "name", "arguments", "directives", "selectionSet"],
      Argument: ["name", "value"],
      FragmentSpread: ["name", "directives"],
      InlineFragment: ["typeCondition", "directives", "selectionSet"],
      FragmentDefinition: [
        "name",
        "variableDefinitions",
        "typeCondition",
        "directives",
        "selectionSet"
      ],
      IntValue: [],
      FloatValue: [],
      StringValue: [],
      BooleanValue: [],
      NullValue: [],
      EnumValue: [],
      ListValue: ["values"],
      ObjectValue: ["fields"],
      ObjectField: ["name", "value"],
      Directive: ["name", "arguments"],
      NamedType: ["name"],
      ListType: ["type"],
      NonNullType: ["type"],
      SchemaDefinition: ["directives", "operationTypes"],
      OperationTypeDefinition: ["type"],
      ScalarTypeDefinition: ["description", "name", "directives"],
      ObjectTypeDefinition: ["description", "name", "interfaces", "directives", "fields"],
      FieldDefinition: ["description", "name", "arguments", "type", "directives"],
      InputValueDefinition: ["description", "name", "type", "defaultValue", "directives"],
      InterfaceTypeDefinition: ["description", "name", "directives", "fields"],
      UnionTypeDefinition: ["description", "name", "directives", "types"],
      EnumTypeDefinition: ["description", "name", "directives", "values"],
      EnumValueDefinition: ["description", "name", "directives"],
      InputObjectTypeDefinition: ["description", "name", "directives", "fields"],
      DirectiveDefinition: ["description", "name", "arguments", "locations"],
      SchemaExtension: ["directives", "operationTypes"],
      ScalarTypeExtension: ["name", "directives"],
      ObjectTypeExtension: ["name", "interfaces", "directives", "fields"],
      InterfaceTypeExtension: ["name", "directives", "fields"],
      UnionTypeExtension: ["name", "directives", "types"],
      EnumTypeExtension: ["name", "directives", "values"],
      InputObjectTypeExtension: ["name", "directives", "fields"]
    };
    exports.QueryDocumentKeys = QueryDocumentKeys;
    var BREAK = Object.freeze({});
    exports.BREAK = BREAK;
    function visit(root, visitor) {
      var visitorKeys = arguments.length > 2 && arguments[2] !== void 0 ? arguments[2] : QueryDocumentKeys;
      var stack = void 0;
      var inArray = Array.isArray(root);
      var keys = [root];
      var index = -1;
      var edits = [];
      var node = void 0;
      var key = void 0;
      var parent = void 0;
      var path = [];
      var ancestors = [];
      var newRoot = root;
      do {
        index++;
        var isLeaving = index === keys.length;
        var isEdited = isLeaving && edits.length !== 0;
        if (isLeaving) {
          key = ancestors.length === 0 ? void 0 : path[path.length - 1];
          node = parent;
          parent = ancestors.pop();
          if (isEdited) {
            if (inArray) {
              node = node.slice();
            } else {
              var clone = {};
              for (var _i2 = 0, _Object$keys2 = Object.keys(node); _i2 < _Object$keys2.length; _i2++) {
                var k = _Object$keys2[_i2];
                clone[k] = node[k];
              }
              node = clone;
            }
            var editOffset = 0;
            for (var ii = 0; ii < edits.length; ii++) {
              var editKey = edits[ii][0];
              var editValue = edits[ii][1];
              if (inArray) {
                editKey -= editOffset;
              }
              if (inArray && editValue === null) {
                node.splice(editKey, 1);
                editOffset++;
              } else {
                node[editKey] = editValue;
              }
            }
          }
          index = stack.index;
          keys = stack.keys;
          edits = stack.edits;
          inArray = stack.inArray;
          stack = stack.prev;
        } else {
          key = parent ? inArray ? index : keys[index] : void 0;
          node = parent ? parent[key] : newRoot;
          if (node === null || node === void 0) {
            continue;
          }
          if (parent) {
            path.push(key);
          }
        }
        var result = void 0;
        if (!Array.isArray(node)) {
          if (!isNode(node)) {
            throw new Error("Invalid AST Node: " + (0, _inspect.default)(node));
          }
          var visitFn = getVisitFn(visitor, node.kind, isLeaving);
          if (visitFn) {
            result = visitFn.call(visitor, node, key, parent, path, ancestors);
            if (result === BREAK) {
              break;
            }
            if (result === false) {
              if (!isLeaving) {
                path.pop();
                continue;
              }
            } else if (result !== void 0) {
              edits.push([key, result]);
              if (!isLeaving) {
                if (isNode(result)) {
                  node = result;
                } else {
                  path.pop();
                  continue;
                }
              }
            }
          }
        }
        if (result === void 0 && isEdited) {
          edits.push([key, node]);
        }
        if (isLeaving) {
          path.pop();
        } else {
          stack = {
            inArray,
            index,
            keys,
            edits,
            prev: stack
          };
          inArray = Array.isArray(node);
          keys = inArray ? node : visitorKeys[node.kind] || [];
          index = -1;
          edits = [];
          if (parent) {
            ancestors.push(parent);
          }
          parent = node;
        }
      } while (stack !== void 0);
      if (edits.length !== 0) {
        newRoot = edits[edits.length - 1][1];
      }
      return newRoot;
    }
    function isNode(maybeNode) {
      return Boolean(maybeNode && typeof maybeNode.kind === "string");
    }
    function visitInParallel(visitors) {
      var skipping = new Array(visitors.length);
      return {
        enter: function enter(node) {
          for (var i = 0; i < visitors.length; i++) {
            if (!skipping[i]) {
              var fn = getVisitFn(visitors[i], node.kind, false);
              if (fn) {
                var result = fn.apply(visitors[i], arguments);
                if (result === false) {
                  skipping[i] = node;
                } else if (result === BREAK) {
                  skipping[i] = BREAK;
                } else if (result !== void 0) {
                  return result;
                }
              }
            }
          }
        },
        leave: function leave(node) {
          for (var i = 0; i < visitors.length; i++) {
            if (!skipping[i]) {
              var fn = getVisitFn(visitors[i], node.kind, true);
              if (fn) {
                var result = fn.apply(visitors[i], arguments);
                if (result === BREAK) {
                  skipping[i] = BREAK;
                } else if (result !== void 0 && result !== false) {
                  return result;
                }
              }
            } else if (skipping[i] === node) {
              skipping[i] = null;
            }
          }
        }
      };
    }
    function visitWithTypeInfo(typeInfo, visitor) {
      return {
        enter: function enter(node) {
          typeInfo.enter(node);
          var fn = getVisitFn(visitor, node.kind, false);
          if (fn) {
            var result = fn.apply(visitor, arguments);
            if (result !== void 0) {
              typeInfo.leave(node);
              if (isNode(result)) {
                typeInfo.enter(result);
              }
            }
            return result;
          }
        },
        leave: function leave(node) {
          var fn = getVisitFn(visitor, node.kind, true);
          var result;
          if (fn) {
            result = fn.apply(visitor, arguments);
          }
          typeInfo.leave(node);
          return result;
        }
      };
    }
    function getVisitFn(visitor, kind, isLeaving) {
      var kindVisitor = visitor[kind];
      if (kindVisitor) {
        if (!isLeaving && typeof kindVisitor === "function") {
          return kindVisitor;
        }
        var kindSpecificVisitor = isLeaving ? kindVisitor.leave : kindVisitor.enter;
        if (typeof kindSpecificVisitor === "function") {
          return kindSpecificVisitor;
        }
      } else {
        var specificVisitor = isLeaving ? visitor.leave : visitor.enter;
        if (specificVisitor) {
          if (typeof specificVisitor === "function") {
            return specificVisitor;
          }
          var specificKindVisitor = specificVisitor[kind];
          if (typeof specificKindVisitor === "function") {
            return specificKindVisitor;
          }
        }
      }
    }
  }
});

// ../api/node_modules/graphql/polyfills/find.js
var require_find = __commonJS({
  "../api/node_modules/graphql/polyfills/find.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", {
      value: true
    });
    exports.default = void 0;
    var find = Array.prototype.find ? function(list, predicate) {
      return Array.prototype.find.call(list, predicate);
    } : function(list, predicate) {
      for (var _i2 = 0; _i2 < list.length; _i2++) {
        var value = list[_i2];
        if (predicate(value)) {
          return value;
        }
      }
    };
    var _default = find;
    exports.default = _default;
  }
});

// ../api/node_modules/graphql/polyfills/flatMap.js
var require_flatMap = __commonJS({
  "../api/node_modules/graphql/polyfills/flatMap.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", {
      value: true
    });
    exports.default = void 0;
    var flatMapMethod = Array.prototype.flatMap;
    var flatMap = flatMapMethod ? function(list, fn) {
      return flatMapMethod.call(list, fn);
    } : function(list, fn) {
      var result = [];
      for (var _i2 = 0; _i2 < list.length; _i2++) {
        var _item = list[_i2];
        var value = fn(_item);
        if (Array.isArray(value)) {
          result = result.concat(value);
        } else {
          result.push(value);
        }
      }
      return result;
    };
    var _default = flatMap;
    exports.default = _default;
  }
});

// ../api/node_modules/graphql/polyfills/objectValues.js
var require_objectValues = __commonJS({
  "../api/node_modules/graphql/polyfills/objectValues.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", {
      value: true
    });
    exports.default = void 0;
    var objectValues = Object.values || function(obj) {
      return Object.keys(obj).map(function(key) {
        return obj[key];
      });
    };
    var _default = objectValues;
    exports.default = _default;
  }
});

// ../api/node_modules/graphql/polyfills/objectEntries.js
var require_objectEntries = __commonJS({
  "../api/node_modules/graphql/polyfills/objectEntries.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", {
      value: true
    });
    exports.default = void 0;
    var objectEntries = Object.entries || function(obj) {
      return Object.keys(obj).map(function(key) {
        return [key, obj[key]];
      });
    };
    var _default = objectEntries;
    exports.default = _default;
  }
});

// ../api/node_modules/graphql/utilities/assertValidName.js
var require_assertValidName = __commonJS({
  "../api/node_modules/graphql/utilities/assertValidName.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", {
      value: true
    });
    exports.assertValidName = assertValidName;
    exports.isValidNameError = isValidNameError;
    var _devAssert = _interopRequireDefault(require_devAssert());
    var _GraphQLError = require_GraphQLError();
    function _interopRequireDefault(obj) {
      return obj && obj.__esModule ? obj : { default: obj };
    }
    var NAME_RX = /^[_a-zA-Z][_a-zA-Z0-9]*$/;
    function assertValidName(name) {
      var error = isValidNameError(name);
      if (error) {
        throw error;
      }
      return name;
    }
    function isValidNameError(name, node) {
      typeof name === "string" || (0, _devAssert.default)(0, "Expected string");
      if (name.length > 1 && name[0] === "_" && name[1] === "_") {
        return new _GraphQLError.GraphQLError('Name "'.concat(name, '" must not begin with "__", which is reserved by GraphQL introspection.'), node);
      }
      if (!NAME_RX.test(name)) {
        return new _GraphQLError.GraphQLError('Names must match /^[_a-zA-Z][_a-zA-Z0-9]*$/ but "'.concat(name, '" does not.'), node);
      }
    }
  }
});

// ../api/node_modules/graphql/jsutils/keyMap.js
var require_keyMap = __commonJS({
  "../api/node_modules/graphql/jsutils/keyMap.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", {
      value: true
    });
    exports.default = keyMap;
    function keyMap(list, keyFn) {
      return list.reduce(function(map, item) {
        map[keyFn(item)] = item;
        return map;
      }, /* @__PURE__ */ Object.create(null));
    }
  }
});

// ../api/node_modules/graphql/jsutils/mapValue.js
var require_mapValue = __commonJS({
  "../api/node_modules/graphql/jsutils/mapValue.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", {
      value: true
    });
    exports.default = mapValue;
    var _objectEntries3 = _interopRequireDefault(require_objectEntries());
    function _interopRequireDefault(obj) {
      return obj && obj.__esModule ? obj : { default: obj };
    }
    function mapValue(map, fn) {
      var result = /* @__PURE__ */ Object.create(null);
      for (var _i2 = 0, _objectEntries2 = (0, _objectEntries3.default)(map); _i2 < _objectEntries2.length; _i2++) {
        var _ref2 = _objectEntries2[_i2];
        var _key = _ref2[0];
        var _value = _ref2[1];
        result[_key] = fn(_value, _key);
      }
      return result;
    }
  }
});

// ../api/node_modules/graphql/jsutils/toObjMap.js
var require_toObjMap = __commonJS({
  "../api/node_modules/graphql/jsutils/toObjMap.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", {
      value: true
    });
    exports.default = toObjMap;
    var _objectEntries3 = _interopRequireDefault(require_objectEntries());
    function _interopRequireDefault(obj) {
      return obj && obj.__esModule ? obj : { default: obj };
    }
    function toObjMap(obj) {
      if (Object.getPrototypeOf(obj) === null) {
        return obj;
      }
      var map = /* @__PURE__ */ Object.create(null);
      for (var _i2 = 0, _objectEntries2 = (0, _objectEntries3.default)(obj); _i2 < _objectEntries2.length; _i2++) {
        var _ref2 = _objectEntries2[_i2];
        var key = _ref2[0];
        var value = _ref2[1];
        map[key] = value;
      }
      return map;
    }
  }
});

// ../api/node_modules/graphql/jsutils/keyValMap.js
var require_keyValMap = __commonJS({
  "../api/node_modules/graphql/jsutils/keyValMap.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", {
      value: true
    });
    exports.default = keyValMap;
    function keyValMap(list, keyFn, valFn) {
      return list.reduce(function(map, item) {
        map[keyFn(item)] = valFn(item);
        return map;
      }, /* @__PURE__ */ Object.create(null));
    }
  }
});

// ../api/node_modules/graphql/jsutils/instanceOf.js
var require_instanceOf = __commonJS({
  "../api/node_modules/graphql/jsutils/instanceOf.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", {
      value: true
    });
    exports.default = void 0;
    var _default = process.env.NODE_ENV === "production" ? function instanceOf(value, constructor) {
      return value instanceof constructor;
    } : function instanceOf(value, constructor) {
      if (value instanceof constructor) {
        return true;
      }
      if (value) {
        var valueClass = value.constructor;
        var className = constructor.name;
        if (className && valueClass && valueClass.name === className) {
          throw new Error("Cannot use ".concat(className, ' "').concat(value, '" from another module or realm.\n\nEnsure that there is only one instance of "graphql" in the node_modules\ndirectory. If different versions of "graphql" are the dependencies of other\nrelied on modules, use "resolutions" to ensure only one version is installed.\n\nhttps://yarnpkg.com/en/docs/selective-version-resolutions\n\nDuplicate "graphql" modules cannot be used at the same time since different\nversions may have different capabilities and behavior. The data from one\nversion used in the function from another could produce confusing and\nspurious results.'));
        }
      }
      return false;
    };
    exports.default = _default;
  }
});

// ../api/node_modules/graphql/jsutils/identityFunc.js
var require_identityFunc = __commonJS({
  "../api/node_modules/graphql/jsutils/identityFunc.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", {
      value: true
    });
    exports.default = identityFunc;
    function identityFunc(x) {
      return x;
    }
  }
});

// ../api/node_modules/graphql/jsutils/invariant.js
var require_invariant = __commonJS({
  "../api/node_modules/graphql/jsutils/invariant.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", {
      value: true
    });
    exports.default = invariant;
    function invariant(condition, message) {
      var booleanCondition = Boolean(condition);
      if (!booleanCondition) {
        throw new Error(message || "Unexpected invariant triggered");
      }
    }
  }
});

// ../api/node_modules/graphql/jsutils/isInvalid.js
var require_isInvalid = __commonJS({
  "../api/node_modules/graphql/jsutils/isInvalid.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", {
      value: true
    });
    exports.default = isInvalid;
    function isInvalid(value) {
      return value === void 0 || value !== value;
    }
  }
});

// ../api/node_modules/graphql/utilities/valueFromASTUntyped.js
var require_valueFromASTUntyped = __commonJS({
  "../api/node_modules/graphql/utilities/valueFromASTUntyped.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", {
      value: true
    });
    exports.valueFromASTUntyped = valueFromASTUntyped;
    var _inspect = _interopRequireDefault(require_inspect());
    var _invariant = _interopRequireDefault(require_invariant());
    var _keyValMap = _interopRequireDefault(require_keyValMap());
    var _isInvalid = _interopRequireDefault(require_isInvalid());
    var _kinds = require_kinds();
    function _interopRequireDefault(obj) {
      return obj && obj.__esModule ? obj : { default: obj };
    }
    function valueFromASTUntyped(valueNode, variables) {
      switch (valueNode.kind) {
        case _kinds.Kind.NULL:
          return null;
        case _kinds.Kind.INT:
          return parseInt(valueNode.value, 10);
        case _kinds.Kind.FLOAT:
          return parseFloat(valueNode.value);
        case _kinds.Kind.STRING:
        case _kinds.Kind.ENUM:
        case _kinds.Kind.BOOLEAN:
          return valueNode.value;
        case _kinds.Kind.LIST:
          return valueNode.values.map(function(node) {
            return valueFromASTUntyped(node, variables);
          });
        case _kinds.Kind.OBJECT:
          return (0, _keyValMap.default)(valueNode.fields, function(field) {
            return field.name.value;
          }, function(field) {
            return valueFromASTUntyped(field.value, variables);
          });
        case _kinds.Kind.VARIABLE: {
          var variableName = valueNode.name.value;
          return variables && !(0, _isInvalid.default)(variables[variableName]) ? variables[variableName] : void 0;
        }
      }
      (0, _invariant.default)(false, "Unexpected value node: " + (0, _inspect.default)(valueNode));
    }
  }
});

// ../api/node_modules/graphql/type/definition.js
var require_definition = __commonJS({
  "../api/node_modules/graphql/type/definition.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", {
      value: true
    });
    exports.isType = isType;
    exports.assertType = assertType;
    exports.isScalarType = isScalarType;
    exports.assertScalarType = assertScalarType;
    exports.isObjectType = isObjectType;
    exports.assertObjectType = assertObjectType;
    exports.isInterfaceType = isInterfaceType;
    exports.assertInterfaceType = assertInterfaceType;
    exports.isUnionType = isUnionType;
    exports.assertUnionType = assertUnionType;
    exports.isEnumType = isEnumType;
    exports.assertEnumType = assertEnumType;
    exports.isInputObjectType = isInputObjectType;
    exports.assertInputObjectType = assertInputObjectType;
    exports.isListType = isListType;
    exports.assertListType = assertListType;
    exports.isNonNullType = isNonNullType;
    exports.assertNonNullType = assertNonNullType;
    exports.isInputType = isInputType;
    exports.assertInputType = assertInputType;
    exports.isOutputType = isOutputType;
    exports.assertOutputType = assertOutputType;
    exports.isLeafType = isLeafType;
    exports.assertLeafType = assertLeafType;
    exports.isCompositeType = isCompositeType;
    exports.assertCompositeType = assertCompositeType;
    exports.isAbstractType = isAbstractType;
    exports.assertAbstractType = assertAbstractType;
    exports.GraphQLList = GraphQLList;
    exports.GraphQLNonNull = GraphQLNonNull;
    exports.isWrappingType = isWrappingType;
    exports.assertWrappingType = assertWrappingType;
    exports.isNullableType = isNullableType;
    exports.assertNullableType = assertNullableType;
    exports.getNullableType = getNullableType;
    exports.isNamedType = isNamedType;
    exports.assertNamedType = assertNamedType;
    exports.getNamedType = getNamedType;
    exports.argsToArgsConfig = argsToArgsConfig;
    exports.isRequiredArgument = isRequiredArgument;
    exports.isRequiredInputField = isRequiredInputField;
    exports.GraphQLInputObjectType = exports.GraphQLEnumType = exports.GraphQLUnionType = exports.GraphQLInterfaceType = exports.GraphQLObjectType = exports.GraphQLScalarType = void 0;
    var _objectEntries = _interopRequireDefault(require_objectEntries());
    var _inspect = _interopRequireDefault(require_inspect());
    var _keyMap = _interopRequireDefault(require_keyMap());
    var _mapValue = _interopRequireDefault(require_mapValue());
    var _toObjMap = _interopRequireDefault(require_toObjMap());
    var _devAssert = _interopRequireDefault(require_devAssert());
    var _keyValMap = _interopRequireDefault(require_keyValMap());
    var _instanceOf = _interopRequireDefault(require_instanceOf());
    var _isObjectLike = _interopRequireDefault(require_isObjectLike());
    var _identityFunc = _interopRequireDefault(require_identityFunc());
    var _defineToJSON = _interopRequireDefault(require_defineToJSON());
    var _defineToStringTag = _interopRequireDefault(require_defineToStringTag());
    var _kinds = require_kinds();
    var _valueFromASTUntyped = require_valueFromASTUntyped();
    function _interopRequireDefault(obj) {
      return obj && obj.__esModule ? obj : { default: obj };
    }
    function ownKeys(object, enumerableOnly) {
      var keys = Object.keys(object);
      if (Object.getOwnPropertySymbols) {
        var symbols = Object.getOwnPropertySymbols(object);
        if (enumerableOnly)
          symbols = symbols.filter(function(sym) {
            return Object.getOwnPropertyDescriptor(object, sym).enumerable;
          });
        keys.push.apply(keys, symbols);
      }
      return keys;
    }
    function _objectSpread(target) {
      for (var i = 1; i < arguments.length; i++) {
        var source = arguments[i] != null ? arguments[i] : {};
        if (i % 2) {
          ownKeys(source, true).forEach(function(key) {
            _defineProperty(target, key, source[key]);
          });
        } else if (Object.getOwnPropertyDescriptors) {
          Object.defineProperties(target, Object.getOwnPropertyDescriptors(source));
        } else {
          ownKeys(source).forEach(function(key) {
            Object.defineProperty(target, key, Object.getOwnPropertyDescriptor(source, key));
          });
        }
      }
      return target;
    }
    function _defineProperty(obj, key, value) {
      if (key in obj) {
        Object.defineProperty(obj, key, { value, enumerable: true, configurable: true, writable: true });
      } else {
        obj[key] = value;
      }
      return obj;
    }
    function isType(type) {
      return isScalarType(type) || isObjectType(type) || isInterfaceType(type) || isUnionType(type) || isEnumType(type) || isInputObjectType(type) || isListType(type) || isNonNullType(type);
    }
    function assertType(type) {
      if (!isType(type)) {
        throw new Error("Expected ".concat((0, _inspect.default)(type), " to be a GraphQL type."));
      }
      return type;
    }
    function isScalarType(type) {
      return (0, _instanceOf.default)(type, GraphQLScalarType);
    }
    function assertScalarType(type) {
      if (!isScalarType(type)) {
        throw new Error("Expected ".concat((0, _inspect.default)(type), " to be a GraphQL Scalar type."));
      }
      return type;
    }
    function isObjectType(type) {
      return (0, _instanceOf.default)(type, GraphQLObjectType);
    }
    function assertObjectType(type) {
      if (!isObjectType(type)) {
        throw new Error("Expected ".concat((0, _inspect.default)(type), " to be a GraphQL Object type."));
      }
      return type;
    }
    function isInterfaceType(type) {
      return (0, _instanceOf.default)(type, GraphQLInterfaceType);
    }
    function assertInterfaceType(type) {
      if (!isInterfaceType(type)) {
        throw new Error("Expected ".concat((0, _inspect.default)(type), " to be a GraphQL Interface type."));
      }
      return type;
    }
    function isUnionType(type) {
      return (0, _instanceOf.default)(type, GraphQLUnionType);
    }
    function assertUnionType(type) {
      if (!isUnionType(type)) {
        throw new Error("Expected ".concat((0, _inspect.default)(type), " to be a GraphQL Union type."));
      }
      return type;
    }
    function isEnumType(type) {
      return (0, _instanceOf.default)(type, GraphQLEnumType);
    }
    function assertEnumType(type) {
      if (!isEnumType(type)) {
        throw new Error("Expected ".concat((0, _inspect.default)(type), " to be a GraphQL Enum type."));
      }
      return type;
    }
    function isInputObjectType(type) {
      return (0, _instanceOf.default)(type, GraphQLInputObjectType);
    }
    function assertInputObjectType(type) {
      if (!isInputObjectType(type)) {
        throw new Error("Expected ".concat((0, _inspect.default)(type), " to be a GraphQL Input Object type."));
      }
      return type;
    }
    function isListType(type) {
      return (0, _instanceOf.default)(type, GraphQLList);
    }
    function assertListType(type) {
      if (!isListType(type)) {
        throw new Error("Expected ".concat((0, _inspect.default)(type), " to be a GraphQL List type."));
      }
      return type;
    }
    function isNonNullType(type) {
      return (0, _instanceOf.default)(type, GraphQLNonNull);
    }
    function assertNonNullType(type) {
      if (!isNonNullType(type)) {
        throw new Error("Expected ".concat((0, _inspect.default)(type), " to be a GraphQL Non-Null type."));
      }
      return type;
    }
    function isInputType(type) {
      return isScalarType(type) || isEnumType(type) || isInputObjectType(type) || isWrappingType(type) && isInputType(type.ofType);
    }
    function assertInputType(type) {
      if (!isInputType(type)) {
        throw new Error("Expected ".concat((0, _inspect.default)(type), " to be a GraphQL input type."));
      }
      return type;
    }
    function isOutputType(type) {
      return isScalarType(type) || isObjectType(type) || isInterfaceType(type) || isUnionType(type) || isEnumType(type) || isWrappingType(type) && isOutputType(type.ofType);
    }
    function assertOutputType(type) {
      if (!isOutputType(type)) {
        throw new Error("Expected ".concat((0, _inspect.default)(type), " to be a GraphQL output type."));
      }
      return type;
    }
    function isLeafType(type) {
      return isScalarType(type) || isEnumType(type);
    }
    function assertLeafType(type) {
      if (!isLeafType(type)) {
        throw new Error("Expected ".concat((0, _inspect.default)(type), " to be a GraphQL leaf type."));
      }
      return type;
    }
    function isCompositeType(type) {
      return isObjectType(type) || isInterfaceType(type) || isUnionType(type);
    }
    function assertCompositeType(type) {
      if (!isCompositeType(type)) {
        throw new Error("Expected ".concat((0, _inspect.default)(type), " to be a GraphQL composite type."));
      }
      return type;
    }
    function isAbstractType(type) {
      return isInterfaceType(type) || isUnionType(type);
    }
    function assertAbstractType(type) {
      if (!isAbstractType(type)) {
        throw new Error("Expected ".concat((0, _inspect.default)(type), " to be a GraphQL abstract type."));
      }
      return type;
    }
    function GraphQLList(ofType) {
      if (this instanceof GraphQLList) {
        this.ofType = assertType(ofType);
      } else {
        return new GraphQLList(ofType);
      }
    }
    GraphQLList.prototype.toString = function toString() {
      return "[" + String(this.ofType) + "]";
    };
    (0, _defineToStringTag.default)(GraphQLList);
    (0, _defineToJSON.default)(GraphQLList);
    function GraphQLNonNull(ofType) {
      if (this instanceof GraphQLNonNull) {
        this.ofType = assertNullableType(ofType);
      } else {
        return new GraphQLNonNull(ofType);
      }
    }
    GraphQLNonNull.prototype.toString = function toString() {
      return String(this.ofType) + "!";
    };
    (0, _defineToStringTag.default)(GraphQLNonNull);
    (0, _defineToJSON.default)(GraphQLNonNull);
    function isWrappingType(type) {
      return isListType(type) || isNonNullType(type);
    }
    function assertWrappingType(type) {
      if (!isWrappingType(type)) {
        throw new Error("Expected ".concat((0, _inspect.default)(type), " to be a GraphQL wrapping type."));
      }
      return type;
    }
    function isNullableType(type) {
      return isType(type) && !isNonNullType(type);
    }
    function assertNullableType(type) {
      if (!isNullableType(type)) {
        throw new Error("Expected ".concat((0, _inspect.default)(type), " to be a GraphQL nullable type."));
      }
      return type;
    }
    function getNullableType(type) {
      if (type) {
        return isNonNullType(type) ? type.ofType : type;
      }
    }
    function isNamedType(type) {
      return isScalarType(type) || isObjectType(type) || isInterfaceType(type) || isUnionType(type) || isEnumType(type) || isInputObjectType(type);
    }
    function assertNamedType(type) {
      if (!isNamedType(type)) {
        throw new Error("Expected ".concat((0, _inspect.default)(type), " to be a GraphQL named type."));
      }
      return type;
    }
    function getNamedType(type) {
      if (type) {
        var unwrappedType = type;
        while (isWrappingType(unwrappedType)) {
          unwrappedType = unwrappedType.ofType;
        }
        return unwrappedType;
      }
    }
    function resolveThunk(thunk) {
      return typeof thunk === "function" ? thunk() : thunk;
    }
    function undefineIfEmpty(arr) {
      return arr && arr.length > 0 ? arr : void 0;
    }
    var GraphQLScalarType = /* @__PURE__ */ function() {
      function GraphQLScalarType2(config) {
        var parseValue = config.parseValue || _identityFunc.default;
        this.name = config.name;
        this.description = config.description;
        this.serialize = config.serialize || _identityFunc.default;
        this.parseValue = parseValue;
        this.parseLiteral = config.parseLiteral || function(node) {
          return parseValue((0, _valueFromASTUntyped.valueFromASTUntyped)(node));
        };
        this.extensions = config.extensions && (0, _toObjMap.default)(config.extensions);
        this.astNode = config.astNode;
        this.extensionASTNodes = undefineIfEmpty(config.extensionASTNodes);
        typeof config.name === "string" || (0, _devAssert.default)(0, "Must provide name.");
        config.serialize == null || typeof config.serialize === "function" || (0, _devAssert.default)(0, "".concat(this.name, ' must provide "serialize" function. If this custom Scalar is also used as an input type, ensure "parseValue" and "parseLiteral" functions are also provided.'));
        if (config.parseLiteral) {
          typeof config.parseValue === "function" && typeof config.parseLiteral === "function" || (0, _devAssert.default)(0, "".concat(this.name, ' must provide both "parseValue" and "parseLiteral" functions.'));
        }
      }
      var _proto = GraphQLScalarType2.prototype;
      _proto.toConfig = function toConfig() {
        return {
          name: this.name,
          description: this.description,
          serialize: this.serialize,
          parseValue: this.parseValue,
          parseLiteral: this.parseLiteral,
          extensions: this.extensions,
          astNode: this.astNode,
          extensionASTNodes: this.extensionASTNodes || []
        };
      };
      _proto.toString = function toString() {
        return this.name;
      };
      return GraphQLScalarType2;
    }();
    exports.GraphQLScalarType = GraphQLScalarType;
    (0, _defineToStringTag.default)(GraphQLScalarType);
    (0, _defineToJSON.default)(GraphQLScalarType);
    var GraphQLObjectType = /* @__PURE__ */ function() {
      function GraphQLObjectType2(config) {
        this.name = config.name;
        this.description = config.description;
        this.isTypeOf = config.isTypeOf;
        this.extensions = config.extensions && (0, _toObjMap.default)(config.extensions);
        this.astNode = config.astNode;
        this.extensionASTNodes = undefineIfEmpty(config.extensionASTNodes);
        this._fields = defineFieldMap.bind(void 0, config);
        this._interfaces = defineInterfaces.bind(void 0, config);
        typeof config.name === "string" || (0, _devAssert.default)(0, "Must provide name.");
        config.isTypeOf == null || typeof config.isTypeOf === "function" || (0, _devAssert.default)(0, "".concat(this.name, ' must provide "isTypeOf" as a function, ') + "but got: ".concat((0, _inspect.default)(config.isTypeOf), "."));
      }
      var _proto2 = GraphQLObjectType2.prototype;
      _proto2.getFields = function getFields() {
        if (typeof this._fields === "function") {
          this._fields = this._fields();
        }
        return this._fields;
      };
      _proto2.getInterfaces = function getInterfaces() {
        if (typeof this._interfaces === "function") {
          this._interfaces = this._interfaces();
        }
        return this._interfaces;
      };
      _proto2.toConfig = function toConfig() {
        return {
          name: this.name,
          description: this.description,
          interfaces: this.getInterfaces(),
          fields: fieldsToFieldsConfig(this.getFields()),
          isTypeOf: this.isTypeOf,
          extensions: this.extensions,
          astNode: this.astNode,
          extensionASTNodes: this.extensionASTNodes || []
        };
      };
      _proto2.toString = function toString() {
        return this.name;
      };
      return GraphQLObjectType2;
    }();
    exports.GraphQLObjectType = GraphQLObjectType;
    (0, _defineToStringTag.default)(GraphQLObjectType);
    (0, _defineToJSON.default)(GraphQLObjectType);
    function defineInterfaces(config) {
      var interfaces = resolveThunk(config.interfaces) || [];
      Array.isArray(interfaces) || (0, _devAssert.default)(0, "".concat(config.name, " interfaces must be an Array or a function which returns an Array."));
      return interfaces;
    }
    function defineFieldMap(config) {
      var fieldMap = resolveThunk(config.fields) || {};
      isPlainObj(fieldMap) || (0, _devAssert.default)(0, "".concat(config.name, " fields must be an object with field names as keys or a function which returns such an object."));
      return (0, _mapValue.default)(fieldMap, function(fieldConfig, fieldName) {
        isPlainObj(fieldConfig) || (0, _devAssert.default)(0, "".concat(config.name, ".").concat(fieldName, " field config must be an object"));
        !("isDeprecated" in fieldConfig) || (0, _devAssert.default)(0, "".concat(config.name, ".").concat(fieldName, ' should provide "deprecationReason" instead of "isDeprecated".'));
        fieldConfig.resolve == null || typeof fieldConfig.resolve === "function" || (0, _devAssert.default)(0, "".concat(config.name, ".").concat(fieldName, " field resolver must be a function if ") + "provided, but got: ".concat((0, _inspect.default)(fieldConfig.resolve), "."));
        var argsConfig = fieldConfig.args || {};
        isPlainObj(argsConfig) || (0, _devAssert.default)(0, "".concat(config.name, ".").concat(fieldName, " args must be an object with argument names as keys."));
        var args = (0, _objectEntries.default)(argsConfig).map(function(_ref) {
          var argName = _ref[0], arg = _ref[1];
          return {
            name: argName,
            description: arg.description === void 0 ? null : arg.description,
            type: arg.type,
            defaultValue: arg.defaultValue,
            extensions: arg.extensions && (0, _toObjMap.default)(arg.extensions),
            astNode: arg.astNode
          };
        });
        return _objectSpread({}, fieldConfig, {
          name: fieldName,
          description: fieldConfig.description,
          type: fieldConfig.type,
          args,
          resolve: fieldConfig.resolve,
          subscribe: fieldConfig.subscribe,
          isDeprecated: Boolean(fieldConfig.deprecationReason),
          deprecationReason: fieldConfig.deprecationReason,
          extensions: fieldConfig.extensions && (0, _toObjMap.default)(fieldConfig.extensions),
          astNode: fieldConfig.astNode
        });
      });
    }
    function isPlainObj(obj) {
      return (0, _isObjectLike.default)(obj) && !Array.isArray(obj);
    }
    function fieldsToFieldsConfig(fields) {
      return (0, _mapValue.default)(fields, function(field) {
        return {
          description: field.description,
          type: field.type,
          args: argsToArgsConfig(field.args),
          resolve: field.resolve,
          subscribe: field.subscribe,
          deprecationReason: field.deprecationReason,
          extensions: field.extensions,
          astNode: field.astNode
        };
      });
    }
    function argsToArgsConfig(args) {
      return (0, _keyValMap.default)(args, function(arg) {
        return arg.name;
      }, function(arg) {
        return {
          description: arg.description,
          type: arg.type,
          defaultValue: arg.defaultValue,
          extensions: arg.extensions,
          astNode: arg.astNode
        };
      });
    }
    function isRequiredArgument(arg) {
      return isNonNullType(arg.type) && arg.defaultValue === void 0;
    }
    var GraphQLInterfaceType = /* @__PURE__ */ function() {
      function GraphQLInterfaceType2(config) {
        this.name = config.name;
        this.description = config.description;
        this.resolveType = config.resolveType;
        this.extensions = config.extensions && (0, _toObjMap.default)(config.extensions);
        this.astNode = config.astNode;
        this.extensionASTNodes = undefineIfEmpty(config.extensionASTNodes);
        this._fields = defineFieldMap.bind(void 0, config);
        typeof config.name === "string" || (0, _devAssert.default)(0, "Must provide name.");
        config.resolveType == null || typeof config.resolveType === "function" || (0, _devAssert.default)(0, "".concat(this.name, ' must provide "resolveType" as a function, ') + "but got: ".concat((0, _inspect.default)(config.resolveType), "."));
      }
      var _proto3 = GraphQLInterfaceType2.prototype;
      _proto3.getFields = function getFields() {
        if (typeof this._fields === "function") {
          this._fields = this._fields();
        }
        return this._fields;
      };
      _proto3.toConfig = function toConfig() {
        return {
          name: this.name,
          description: this.description,
          fields: fieldsToFieldsConfig(this.getFields()),
          resolveType: this.resolveType,
          extensions: this.extensions,
          astNode: this.astNode,
          extensionASTNodes: this.extensionASTNodes || []
        };
      };
      _proto3.toString = function toString() {
        return this.name;
      };
      return GraphQLInterfaceType2;
    }();
    exports.GraphQLInterfaceType = GraphQLInterfaceType;
    (0, _defineToStringTag.default)(GraphQLInterfaceType);
    (0, _defineToJSON.default)(GraphQLInterfaceType);
    var GraphQLUnionType = /* @__PURE__ */ function() {
      function GraphQLUnionType2(config) {
        this.name = config.name;
        this.description = config.description;
        this.resolveType = config.resolveType;
        this.extensions = config.extensions && (0, _toObjMap.default)(config.extensions);
        this.astNode = config.astNode;
        this.extensionASTNodes = undefineIfEmpty(config.extensionASTNodes);
        this._types = defineTypes.bind(void 0, config);
        typeof config.name === "string" || (0, _devAssert.default)(0, "Must provide name.");
        config.resolveType == null || typeof config.resolveType === "function" || (0, _devAssert.default)(0, "".concat(this.name, ' must provide "resolveType" as a function, ') + "but got: ".concat((0, _inspect.default)(config.resolveType), "."));
      }
      var _proto4 = GraphQLUnionType2.prototype;
      _proto4.getTypes = function getTypes() {
        if (typeof this._types === "function") {
          this._types = this._types();
        }
        return this._types;
      };
      _proto4.toConfig = function toConfig() {
        return {
          name: this.name,
          description: this.description,
          types: this.getTypes(),
          resolveType: this.resolveType,
          extensions: this.extensions,
          astNode: this.astNode,
          extensionASTNodes: this.extensionASTNodes || []
        };
      };
      _proto4.toString = function toString() {
        return this.name;
      };
      return GraphQLUnionType2;
    }();
    exports.GraphQLUnionType = GraphQLUnionType;
    (0, _defineToStringTag.default)(GraphQLUnionType);
    (0, _defineToJSON.default)(GraphQLUnionType);
    function defineTypes(config) {
      var types = resolveThunk(config.types) || [];
      Array.isArray(types) || (0, _devAssert.default)(0, "Must provide Array of types or a function which returns such an array for Union ".concat(config.name, "."));
      return types;
    }
    var GraphQLEnumType = /* @__PURE__ */ function() {
      function GraphQLEnumType2(config) {
        this.name = config.name;
        this.description = config.description;
        this.extensions = config.extensions && (0, _toObjMap.default)(config.extensions);
        this.astNode = config.astNode;
        this.extensionASTNodes = undefineIfEmpty(config.extensionASTNodes);
        this._values = defineEnumValues(this.name, config.values);
        this._valueLookup = new Map(this._values.map(function(enumValue) {
          return [enumValue.value, enumValue];
        }));
        this._nameLookup = (0, _keyMap.default)(this._values, function(value) {
          return value.name;
        });
        typeof config.name === "string" || (0, _devAssert.default)(0, "Must provide name.");
      }
      var _proto5 = GraphQLEnumType2.prototype;
      _proto5.getValues = function getValues() {
        return this._values;
      };
      _proto5.getValue = function getValue(name) {
        return this._nameLookup[name];
      };
      _proto5.serialize = function serialize(value) {
        var enumValue = this._valueLookup.get(value);
        if (enumValue) {
          return enumValue.name;
        }
      };
      _proto5.parseValue = function parseValue(value) {
        if (typeof value === "string") {
          var enumValue = this.getValue(value);
          if (enumValue) {
            return enumValue.value;
          }
        }
      };
      _proto5.parseLiteral = function parseLiteral(valueNode, _variables) {
        if (valueNode.kind === _kinds.Kind.ENUM) {
          var enumValue = this.getValue(valueNode.value);
          if (enumValue) {
            return enumValue.value;
          }
        }
      };
      _proto5.toConfig = function toConfig() {
        var values = (0, _keyValMap.default)(this.getValues(), function(value) {
          return value.name;
        }, function(value) {
          return {
            description: value.description,
            value: value.value,
            deprecationReason: value.deprecationReason,
            extensions: value.extensions,
            astNode: value.astNode
          };
        });
        return {
          name: this.name,
          description: this.description,
          values,
          extensions: this.extensions,
          astNode: this.astNode,
          extensionASTNodes: this.extensionASTNodes || []
        };
      };
      _proto5.toString = function toString() {
        return this.name;
      };
      return GraphQLEnumType2;
    }();
    exports.GraphQLEnumType = GraphQLEnumType;
    (0, _defineToStringTag.default)(GraphQLEnumType);
    (0, _defineToJSON.default)(GraphQLEnumType);
    function defineEnumValues(typeName, valueMap) {
      isPlainObj(valueMap) || (0, _devAssert.default)(0, "".concat(typeName, " values must be an object with value names as keys."));
      return (0, _objectEntries.default)(valueMap).map(function(_ref2) {
        var valueName = _ref2[0], value = _ref2[1];
        isPlainObj(value) || (0, _devAssert.default)(0, "".concat(typeName, ".").concat(valueName, ' must refer to an object with a "value" key ') + "representing an internal value but got: ".concat((0, _inspect.default)(value), "."));
        !("isDeprecated" in value) || (0, _devAssert.default)(0, "".concat(typeName, ".").concat(valueName, ' should provide "deprecationReason" instead of "isDeprecated".'));
        return {
          name: valueName,
          description: value.description,
          value: "value" in value ? value.value : valueName,
          isDeprecated: Boolean(value.deprecationReason),
          deprecationReason: value.deprecationReason,
          extensions: value.extensions && (0, _toObjMap.default)(value.extensions),
          astNode: value.astNode
        };
      });
    }
    var GraphQLInputObjectType = /* @__PURE__ */ function() {
      function GraphQLInputObjectType2(config) {
        this.name = config.name;
        this.description = config.description;
        this.extensions = config.extensions && (0, _toObjMap.default)(config.extensions);
        this.astNode = config.astNode;
        this.extensionASTNodes = undefineIfEmpty(config.extensionASTNodes);
        this._fields = defineInputFieldMap.bind(void 0, config);
        typeof config.name === "string" || (0, _devAssert.default)(0, "Must provide name.");
      }
      var _proto6 = GraphQLInputObjectType2.prototype;
      _proto6.getFields = function getFields() {
        if (typeof this._fields === "function") {
          this._fields = this._fields();
        }
        return this._fields;
      };
      _proto6.toConfig = function toConfig() {
        var fields = (0, _mapValue.default)(this.getFields(), function(field) {
          return {
            description: field.description,
            type: field.type,
            defaultValue: field.defaultValue,
            extensions: field.extensions,
            astNode: field.astNode
          };
        });
        return {
          name: this.name,
          description: this.description,
          fields,
          extensions: this.extensions,
          astNode: this.astNode,
          extensionASTNodes: this.extensionASTNodes || []
        };
      };
      _proto6.toString = function toString() {
        return this.name;
      };
      return GraphQLInputObjectType2;
    }();
    exports.GraphQLInputObjectType = GraphQLInputObjectType;
    (0, _defineToStringTag.default)(GraphQLInputObjectType);
    (0, _defineToJSON.default)(GraphQLInputObjectType);
    function defineInputFieldMap(config) {
      var fieldMap = resolveThunk(config.fields) || {};
      isPlainObj(fieldMap) || (0, _devAssert.default)(0, "".concat(config.name, " fields must be an object with field names as keys or a function which returns such an object."));
      return (0, _mapValue.default)(fieldMap, function(fieldConfig, fieldName) {
        !("resolve" in fieldConfig) || (0, _devAssert.default)(0, "".concat(config.name, ".").concat(fieldName, " field has a resolve property, but Input Types cannot define resolvers."));
        return _objectSpread({}, fieldConfig, {
          name: fieldName,
          description: fieldConfig.description,
          type: fieldConfig.type,
          defaultValue: fieldConfig.defaultValue,
          extensions: fieldConfig.extensions && (0, _toObjMap.default)(fieldConfig.extensions),
          astNode: fieldConfig.astNode
        });
      });
    }
    function isRequiredInputField(field) {
      return isNonNullType(field.type) && field.defaultValue === void 0;
    }
  }
});

// ../api/node_modules/graphql/utilities/typeComparators.js
var require_typeComparators = __commonJS({
  "../api/node_modules/graphql/utilities/typeComparators.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", {
      value: true
    });
    exports.isEqualType = isEqualType;
    exports.isTypeSubTypeOf = isTypeSubTypeOf;
    exports.doTypesOverlap = doTypesOverlap;
    var _definition = require_definition();
    function isEqualType(typeA, typeB) {
      if (typeA === typeB) {
        return true;
      }
      if ((0, _definition.isNonNullType)(typeA) && (0, _definition.isNonNullType)(typeB)) {
        return isEqualType(typeA.ofType, typeB.ofType);
      }
      if ((0, _definition.isListType)(typeA) && (0, _definition.isListType)(typeB)) {
        return isEqualType(typeA.ofType, typeB.ofType);
      }
      return false;
    }
    function isTypeSubTypeOf(schema, maybeSubType, superType) {
      if (maybeSubType === superType) {
        return true;
      }
      if ((0, _definition.isNonNullType)(superType)) {
        if ((0, _definition.isNonNullType)(maybeSubType)) {
          return isTypeSubTypeOf(schema, maybeSubType.ofType, superType.ofType);
        }
        return false;
      }
      if ((0, _definition.isNonNullType)(maybeSubType)) {
        return isTypeSubTypeOf(schema, maybeSubType.ofType, superType);
      }
      if ((0, _definition.isListType)(superType)) {
        if ((0, _definition.isListType)(maybeSubType)) {
          return isTypeSubTypeOf(schema, maybeSubType.ofType, superType.ofType);
        }
        return false;
      }
      if ((0, _definition.isListType)(maybeSubType)) {
        return false;
      }
      if ((0, _definition.isAbstractType)(superType) && (0, _definition.isObjectType)(maybeSubType) && schema.isPossibleType(superType, maybeSubType)) {
        return true;
      }
      return false;
    }
    function doTypesOverlap(schema, typeA, typeB) {
      if (typeA === typeB) {
        return true;
      }
      if ((0, _definition.isAbstractType)(typeA)) {
        if ((0, _definition.isAbstractType)(typeB)) {
          return schema.getPossibleTypes(typeA).some(function(type) {
            return schema.isPossibleType(typeB, type);
          });
        }
        return schema.isPossibleType(typeA, typeB);
      }
      if ((0, _definition.isAbstractType)(typeB)) {
        return schema.isPossibleType(typeB, typeA);
      }
      return false;
    }
  }
});

// ../api/node_modules/graphql/polyfills/isFinite.js
var require_isFinite = __commonJS({
  "../api/node_modules/graphql/polyfills/isFinite.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", {
      value: true
    });
    exports.default = void 0;
    var isFinitePolyfill = Number.isFinite || function(value) {
      return typeof value === "number" && isFinite(value);
    };
    var _default = isFinitePolyfill;
    exports.default = _default;
  }
});

// ../api/node_modules/graphql/polyfills/isInteger.js
var require_isInteger = __commonJS({
  "../api/node_modules/graphql/polyfills/isInteger.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", {
      value: true
    });
    exports.default = void 0;
    var isInteger = Number.isInteger || function(value) {
      return typeof value === "number" && isFinite(value) && Math.floor(value) === value;
    };
    var _default = isInteger;
    exports.default = _default;
  }
});

// ../api/node_modules/graphql/type/scalars.js
var require_scalars = __commonJS({
  "../api/node_modules/graphql/type/scalars.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", {
      value: true
    });
    exports.isSpecifiedScalarType = isSpecifiedScalarType;
    exports.specifiedScalarTypes = exports.GraphQLID = exports.GraphQLBoolean = exports.GraphQLString = exports.GraphQLFloat = exports.GraphQLInt = void 0;
    var _isFinite = _interopRequireDefault(require_isFinite());
    var _isInteger = _interopRequireDefault(require_isInteger());
    var _inspect = _interopRequireDefault(require_inspect());
    var _isObjectLike = _interopRequireDefault(require_isObjectLike());
    var _kinds = require_kinds();
    var _definition = require_definition();
    function _interopRequireDefault(obj) {
      return obj && obj.__esModule ? obj : { default: obj };
    }
    var MAX_INT = 2147483647;
    var MIN_INT = -2147483648;
    function serializeInt(value) {
      if (typeof value === "boolean") {
        return value ? 1 : 0;
      }
      var num = value;
      if (typeof value === "string" && value !== "") {
        num = Number(value);
      }
      if (!(0, _isInteger.default)(num)) {
        throw new TypeError("Int cannot represent non-integer value: ".concat((0, _inspect.default)(value)));
      }
      if (num > MAX_INT || num < MIN_INT) {
        throw new TypeError("Int cannot represent non 32-bit signed integer value: ".concat((0, _inspect.default)(value)));
      }
      return num;
    }
    function coerceInt(value) {
      if (!(0, _isInteger.default)(value)) {
        throw new TypeError("Int cannot represent non-integer value: ".concat((0, _inspect.default)(value)));
      }
      if (value > MAX_INT || value < MIN_INT) {
        throw new TypeError("Int cannot represent non 32-bit signed integer value: ".concat((0, _inspect.default)(value)));
      }
      return value;
    }
    var GraphQLInt = new _definition.GraphQLScalarType({
      name: "Int",
      description: "The `Int` scalar type represents non-fractional signed whole numeric values. Int can represent values between -(2^31) and 2^31 - 1.",
      serialize: serializeInt,
      parseValue: coerceInt,
      parseLiteral: function parseLiteral(ast) {
        if (ast.kind === _kinds.Kind.INT) {
          var num = parseInt(ast.value, 10);
          if (num <= MAX_INT && num >= MIN_INT) {
            return num;
          }
        }
        return void 0;
      }
    });
    exports.GraphQLInt = GraphQLInt;
    function serializeFloat(value) {
      if (typeof value === "boolean") {
        return value ? 1 : 0;
      }
      var num = value;
      if (typeof value === "string" && value !== "") {
        num = Number(value);
      }
      if (!(0, _isFinite.default)(num)) {
        throw new TypeError("Float cannot represent non numeric value: ".concat((0, _inspect.default)(value)));
      }
      return num;
    }
    function coerceFloat(value) {
      if (!(0, _isFinite.default)(value)) {
        throw new TypeError("Float cannot represent non numeric value: ".concat((0, _inspect.default)(value)));
      }
      return value;
    }
    var GraphQLFloat = new _definition.GraphQLScalarType({
      name: "Float",
      description: "The `Float` scalar type represents signed double-precision fractional values as specified by [IEEE 754](https://en.wikipedia.org/wiki/IEEE_floating_point).",
      serialize: serializeFloat,
      parseValue: coerceFloat,
      parseLiteral: function parseLiteral(ast) {
        return ast.kind === _kinds.Kind.FLOAT || ast.kind === _kinds.Kind.INT ? parseFloat(ast.value) : void 0;
      }
    });
    exports.GraphQLFloat = GraphQLFloat;
    function serializeObject(value) {
      if ((0, _isObjectLike.default)(value)) {
        if (typeof value.valueOf === "function") {
          var valueOfResult = value.valueOf();
          if (!(0, _isObjectLike.default)(valueOfResult)) {
            return valueOfResult;
          }
        }
        if (typeof value.toJSON === "function") {
          return value.toJSON();
        }
      }
      return value;
    }
    function serializeString(rawValue) {
      var value = serializeObject(rawValue);
      if (typeof value === "string") {
        return value;
      }
      if (typeof value === "boolean") {
        return value ? "true" : "false";
      }
      if ((0, _isFinite.default)(value)) {
        return value.toString();
      }
      throw new TypeError("String cannot represent value: ".concat((0, _inspect.default)(rawValue)));
    }
    function coerceString(value) {
      if (typeof value !== "string") {
        throw new TypeError("String cannot represent a non string value: ".concat((0, _inspect.default)(value)));
      }
      return value;
    }
    var GraphQLString = new _definition.GraphQLScalarType({
      name: "String",
      description: "The `String` scalar type represents textual data, represented as UTF-8 character sequences. The String type is most often used by GraphQL to represent free-form human-readable text.",
      serialize: serializeString,
      parseValue: coerceString,
      parseLiteral: function parseLiteral(ast) {
        return ast.kind === _kinds.Kind.STRING ? ast.value : void 0;
      }
    });
    exports.GraphQLString = GraphQLString;
    function serializeBoolean(value) {
      if (typeof value === "boolean") {
        return value;
      }
      if ((0, _isFinite.default)(value)) {
        return value !== 0;
      }
      throw new TypeError("Boolean cannot represent a non boolean value: ".concat((0, _inspect.default)(value)));
    }
    function coerceBoolean(value) {
      if (typeof value !== "boolean") {
        throw new TypeError("Boolean cannot represent a non boolean value: ".concat((0, _inspect.default)(value)));
      }
      return value;
    }
    var GraphQLBoolean = new _definition.GraphQLScalarType({
      name: "Boolean",
      description: "The `Boolean` scalar type represents `true` or `false`.",
      serialize: serializeBoolean,
      parseValue: coerceBoolean,
      parseLiteral: function parseLiteral(ast) {
        return ast.kind === _kinds.Kind.BOOLEAN ? ast.value : void 0;
      }
    });
    exports.GraphQLBoolean = GraphQLBoolean;
    function serializeID(rawValue) {
      var value = serializeObject(rawValue);
      if (typeof value === "string") {
        return value;
      }
      if ((0, _isInteger.default)(value)) {
        return String(value);
      }
      throw new TypeError("ID cannot represent value: ".concat((0, _inspect.default)(rawValue)));
    }
    function coerceID(value) {
      if (typeof value === "string") {
        return value;
      }
      if ((0, _isInteger.default)(value)) {
        return value.toString();
      }
      throw new TypeError("ID cannot represent value: ".concat((0, _inspect.default)(value)));
    }
    var GraphQLID = new _definition.GraphQLScalarType({
      name: "ID",
      description: 'The `ID` scalar type represents a unique identifier, often used to refetch an object or as key for a cache. The ID type appears in a JSON response as a String; however, it is not intended to be human-readable. When expected as an input type, any string (such as `"4"`) or integer (such as `4`) input value will be accepted as an ID.',
      serialize: serializeID,
      parseValue: coerceID,
      parseLiteral: function parseLiteral(ast) {
        return ast.kind === _kinds.Kind.STRING || ast.kind === _kinds.Kind.INT ? ast.value : void 0;
      }
    });
    exports.GraphQLID = GraphQLID;
    var specifiedScalarTypes = Object.freeze([GraphQLString, GraphQLInt, GraphQLFloat, GraphQLBoolean, GraphQLID]);
    exports.specifiedScalarTypes = specifiedScalarTypes;
    function isSpecifiedScalarType(type) {
      return (0, _definition.isScalarType)(type) && specifiedScalarTypes.some(function(_ref) {
        var name = _ref.name;
        return type.name === name;
      });
    }
  }
});

// ../api/node_modules/graphql/type/directives.js
var require_directives = __commonJS({
  "../api/node_modules/graphql/type/directives.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", {
      value: true
    });
    exports.isDirective = isDirective;
    exports.assertDirective = assertDirective;
    exports.isSpecifiedDirective = isSpecifiedDirective;
    exports.specifiedDirectives = exports.GraphQLDeprecatedDirective = exports.DEFAULT_DEPRECATION_REASON = exports.GraphQLSkipDirective = exports.GraphQLIncludeDirective = exports.GraphQLDirective = void 0;
    var _objectEntries = _interopRequireDefault(require_objectEntries());
    var _inspect = _interopRequireDefault(require_inspect());
    var _toObjMap = _interopRequireDefault(require_toObjMap());
    var _devAssert = _interopRequireDefault(require_devAssert());
    var _instanceOf = _interopRequireDefault(require_instanceOf());
    var _defineToJSON = _interopRequireDefault(require_defineToJSON());
    var _isObjectLike = _interopRequireDefault(require_isObjectLike());
    var _defineToStringTag = _interopRequireDefault(require_defineToStringTag());
    var _directiveLocation = require_directiveLocation();
    var _scalars = require_scalars();
    var _definition = require_definition();
    function _interopRequireDefault(obj) {
      return obj && obj.__esModule ? obj : { default: obj };
    }
    function isDirective(directive) {
      return (0, _instanceOf.default)(directive, GraphQLDirective);
    }
    function assertDirective(directive) {
      if (!isDirective(directive)) {
        throw new Error("Expected ".concat((0, _inspect.default)(directive), " to be a GraphQL directive."));
      }
      return directive;
    }
    var GraphQLDirective = /* @__PURE__ */ function() {
      function GraphQLDirective2(config) {
        this.name = config.name;
        this.description = config.description;
        this.locations = config.locations;
        this.isRepeatable = config.isRepeatable != null && config.isRepeatable;
        this.extensions = config.extensions && (0, _toObjMap.default)(config.extensions);
        this.astNode = config.astNode;
        config.name || (0, _devAssert.default)(0, "Directive must be named.");
        Array.isArray(config.locations) || (0, _devAssert.default)(0, "@".concat(config.name, " locations must be an Array."));
        var args = config.args || {};
        (0, _isObjectLike.default)(args) && !Array.isArray(args) || (0, _devAssert.default)(0, "@".concat(config.name, " args must be an object with argument names as keys."));
        this.args = (0, _objectEntries.default)(args).map(function(_ref) {
          var argName = _ref[0], arg = _ref[1];
          return {
            name: argName,
            description: arg.description === void 0 ? null : arg.description,
            type: arg.type,
            defaultValue: arg.defaultValue,
            extensions: arg.extensions && (0, _toObjMap.default)(arg.extensions),
            astNode: arg.astNode
          };
        });
      }
      var _proto = GraphQLDirective2.prototype;
      _proto.toString = function toString() {
        return "@" + this.name;
      };
      _proto.toConfig = function toConfig() {
        return {
          name: this.name,
          description: this.description,
          locations: this.locations,
          args: (0, _definition.argsToArgsConfig)(this.args),
          isRepeatable: this.isRepeatable,
          extensions: this.extensions,
          astNode: this.astNode
        };
      };
      return GraphQLDirective2;
    }();
    exports.GraphQLDirective = GraphQLDirective;
    (0, _defineToStringTag.default)(GraphQLDirective);
    (0, _defineToJSON.default)(GraphQLDirective);
    var GraphQLIncludeDirective = new GraphQLDirective({
      name: "include",
      description: "Directs the executor to include this field or fragment only when the `if` argument is true.",
      locations: [_directiveLocation.DirectiveLocation.FIELD, _directiveLocation.DirectiveLocation.FRAGMENT_SPREAD, _directiveLocation.DirectiveLocation.INLINE_FRAGMENT],
      args: {
        if: {
          type: (0, _definition.GraphQLNonNull)(_scalars.GraphQLBoolean),
          description: "Included when true."
        }
      }
    });
    exports.GraphQLIncludeDirective = GraphQLIncludeDirective;
    var GraphQLSkipDirective = new GraphQLDirective({
      name: "skip",
      description: "Directs the executor to skip this field or fragment when the `if` argument is true.",
      locations: [_directiveLocation.DirectiveLocation.FIELD, _directiveLocation.DirectiveLocation.FRAGMENT_SPREAD, _directiveLocation.DirectiveLocation.INLINE_FRAGMENT],
      args: {
        if: {
          type: (0, _definition.GraphQLNonNull)(_scalars.GraphQLBoolean),
          description: "Skipped when true."
        }
      }
    });
    exports.GraphQLSkipDirective = GraphQLSkipDirective;
    var DEFAULT_DEPRECATION_REASON = "No longer supported";
    exports.DEFAULT_DEPRECATION_REASON = DEFAULT_DEPRECATION_REASON;
    var GraphQLDeprecatedDirective = new GraphQLDirective({
      name: "deprecated",
      description: "Marks an element of a GraphQL schema as no longer supported.",
      locations: [_directiveLocation.DirectiveLocation.FIELD_DEFINITION, _directiveLocation.DirectiveLocation.ENUM_VALUE],
      args: {
        reason: {
          type: _scalars.GraphQLString,
          description: "Explains why this element was deprecated, usually also including a suggestion for how to access supported similar data. Formatted using the Markdown syntax (as specified by [CommonMark](https://commonmark.org/).",
          defaultValue: DEFAULT_DEPRECATION_REASON
        }
      }
    });
    exports.GraphQLDeprecatedDirective = GraphQLDeprecatedDirective;
    var specifiedDirectives = Object.freeze([GraphQLIncludeDirective, GraphQLSkipDirective, GraphQLDeprecatedDirective]);
    exports.specifiedDirectives = specifiedDirectives;
    function isSpecifiedDirective(directive) {
      return isDirective(directive) && specifiedDirectives.some(function(_ref2) {
        var name = _ref2.name;
        return name === directive.name;
      });
    }
  }
});

// ../api/node_modules/graphql/language/printer.js
var require_printer = __commonJS({
  "../api/node_modules/graphql/language/printer.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", {
      value: true
    });
    exports.print = print;
    var _visitor = require_visitor();
    var _blockString = require_blockString();
    function print(ast) {
      return (0, _visitor.visit)(ast, {
        leave: printDocASTReducer
      });
    }
    var printDocASTReducer = {
      Name: function Name(node) {
        return node.value;
      },
      Variable: function Variable(node) {
        return "$" + node.name;
      },
      Document: function Document(node) {
        return join(node.definitions, "\n\n") + "\n";
      },
      OperationDefinition: function OperationDefinition(node) {
        var op = node.operation;
        var name = node.name;
        var varDefs = wrap("(", join(node.variableDefinitions, ", "), ")");
        var directives = join(node.directives, " ");
        var selectionSet = node.selectionSet;
        return !name && !directives && !varDefs && op === "query" ? selectionSet : join([op, join([name, varDefs]), directives, selectionSet], " ");
      },
      VariableDefinition: function VariableDefinition(_ref) {
        var variable = _ref.variable, type = _ref.type, defaultValue = _ref.defaultValue, directives = _ref.directives;
        return variable + ": " + type + wrap(" = ", defaultValue) + wrap(" ", join(directives, " "));
      },
      SelectionSet: function SelectionSet(_ref2) {
        var selections = _ref2.selections;
        return block(selections);
      },
      Field: function Field(_ref3) {
        var alias = _ref3.alias, name = _ref3.name, args = _ref3.arguments, directives = _ref3.directives, selectionSet = _ref3.selectionSet;
        return join([wrap("", alias, ": ") + name + wrap("(", join(args, ", "), ")"), join(directives, " "), selectionSet], " ");
      },
      Argument: function Argument(_ref4) {
        var name = _ref4.name, value = _ref4.value;
        return name + ": " + value;
      },
      FragmentSpread: function FragmentSpread(_ref5) {
        var name = _ref5.name, directives = _ref5.directives;
        return "..." + name + wrap(" ", join(directives, " "));
      },
      InlineFragment: function InlineFragment(_ref6) {
        var typeCondition = _ref6.typeCondition, directives = _ref6.directives, selectionSet = _ref6.selectionSet;
        return join(["...", wrap("on ", typeCondition), join(directives, " "), selectionSet], " ");
      },
      FragmentDefinition: function FragmentDefinition(_ref7) {
        var name = _ref7.name, typeCondition = _ref7.typeCondition, variableDefinitions = _ref7.variableDefinitions, directives = _ref7.directives, selectionSet = _ref7.selectionSet;
        return "fragment ".concat(name).concat(wrap("(", join(variableDefinitions, ", "), ")"), " ") + "on ".concat(typeCondition, " ").concat(wrap("", join(directives, " "), " ")) + selectionSet;
      },
      IntValue: function IntValue(_ref8) {
        var value = _ref8.value;
        return value;
      },
      FloatValue: function FloatValue(_ref9) {
        var value = _ref9.value;
        return value;
      },
      StringValue: function StringValue(_ref10, key) {
        var value = _ref10.value, isBlockString = _ref10.block;
        return isBlockString ? (0, _blockString.printBlockString)(value, key === "description" ? "" : "  ") : JSON.stringify(value);
      },
      BooleanValue: function BooleanValue(_ref11) {
        var value = _ref11.value;
        return value ? "true" : "false";
      },
      NullValue: function NullValue() {
        return "null";
      },
      EnumValue: function EnumValue(_ref12) {
        var value = _ref12.value;
        return value;
      },
      ListValue: function ListValue(_ref13) {
        var values = _ref13.values;
        return "[" + join(values, ", ") + "]";
      },
      ObjectValue: function ObjectValue(_ref14) {
        var fields = _ref14.fields;
        return "{" + join(fields, ", ") + "}";
      },
      ObjectField: function ObjectField(_ref15) {
        var name = _ref15.name, value = _ref15.value;
        return name + ": " + value;
      },
      Directive: function Directive(_ref16) {
        var name = _ref16.name, args = _ref16.arguments;
        return "@" + name + wrap("(", join(args, ", "), ")");
      },
      NamedType: function NamedType(_ref17) {
        var name = _ref17.name;
        return name;
      },
      ListType: function ListType(_ref18) {
        var type = _ref18.type;
        return "[" + type + "]";
      },
      NonNullType: function NonNullType(_ref19) {
        var type = _ref19.type;
        return type + "!";
      },
      SchemaDefinition: function SchemaDefinition(_ref20) {
        var directives = _ref20.directives, operationTypes = _ref20.operationTypes;
        return join(["schema", join(directives, " "), block(operationTypes)], " ");
      },
      OperationTypeDefinition: function OperationTypeDefinition(_ref21) {
        var operation = _ref21.operation, type = _ref21.type;
        return operation + ": " + type;
      },
      ScalarTypeDefinition: addDescription(function(_ref22) {
        var name = _ref22.name, directives = _ref22.directives;
        return join(["scalar", name, join(directives, " ")], " ");
      }),
      ObjectTypeDefinition: addDescription(function(_ref23) {
        var name = _ref23.name, interfaces = _ref23.interfaces, directives = _ref23.directives, fields = _ref23.fields;
        return join(["type", name, wrap("implements ", join(interfaces, " & ")), join(directives, " "), block(fields)], " ");
      }),
      FieldDefinition: addDescription(function(_ref24) {
        var name = _ref24.name, args = _ref24.arguments, type = _ref24.type, directives = _ref24.directives;
        return name + (hasMultilineItems(args) ? wrap("(\n", indent(join(args, "\n")), "\n)") : wrap("(", join(args, ", "), ")")) + ": " + type + wrap(" ", join(directives, " "));
      }),
      InputValueDefinition: addDescription(function(_ref25) {
        var name = _ref25.name, type = _ref25.type, defaultValue = _ref25.defaultValue, directives = _ref25.directives;
        return join([name + ": " + type, wrap("= ", defaultValue), join(directives, " ")], " ");
      }),
      InterfaceTypeDefinition: addDescription(function(_ref26) {
        var name = _ref26.name, directives = _ref26.directives, fields = _ref26.fields;
        return join(["interface", name, join(directives, " "), block(fields)], " ");
      }),
      UnionTypeDefinition: addDescription(function(_ref27) {
        var name = _ref27.name, directives = _ref27.directives, types = _ref27.types;
        return join(["union", name, join(directives, " "), types && types.length !== 0 ? "= " + join(types, " | ") : ""], " ");
      }),
      EnumTypeDefinition: addDescription(function(_ref28) {
        var name = _ref28.name, directives = _ref28.directives, values = _ref28.values;
        return join(["enum", name, join(directives, " "), block(values)], " ");
      }),
      EnumValueDefinition: addDescription(function(_ref29) {
        var name = _ref29.name, directives = _ref29.directives;
        return join([name, join(directives, " ")], " ");
      }),
      InputObjectTypeDefinition: addDescription(function(_ref30) {
        var name = _ref30.name, directives = _ref30.directives, fields = _ref30.fields;
        return join(["input", name, join(directives, " "), block(fields)], " ");
      }),
      DirectiveDefinition: addDescription(function(_ref31) {
        var name = _ref31.name, args = _ref31.arguments, repeatable = _ref31.repeatable, locations = _ref31.locations;
        return "directive @" + name + (hasMultilineItems(args) ? wrap("(\n", indent(join(args, "\n")), "\n)") : wrap("(", join(args, ", "), ")")) + (repeatable ? " repeatable" : "") + " on " + join(locations, " | ");
      }),
      SchemaExtension: function SchemaExtension(_ref32) {
        var directives = _ref32.directives, operationTypes = _ref32.operationTypes;
        return join(["extend schema", join(directives, " "), block(operationTypes)], " ");
      },
      ScalarTypeExtension: function ScalarTypeExtension(_ref33) {
        var name = _ref33.name, directives = _ref33.directives;
        return join(["extend scalar", name, join(directives, " ")], " ");
      },
      ObjectTypeExtension: function ObjectTypeExtension(_ref34) {
        var name = _ref34.name, interfaces = _ref34.interfaces, directives = _ref34.directives, fields = _ref34.fields;
        return join(["extend type", name, wrap("implements ", join(interfaces, " & ")), join(directives, " "), block(fields)], " ");
      },
      InterfaceTypeExtension: function InterfaceTypeExtension(_ref35) {
        var name = _ref35.name, directives = _ref35.directives, fields = _ref35.fields;
        return join(["extend interface", name, join(directives, " "), block(fields)], " ");
      },
      UnionTypeExtension: function UnionTypeExtension(_ref36) {
        var name = _ref36.name, directives = _ref36.directives, types = _ref36.types;
        return join(["extend union", name, join(directives, " "), types && types.length !== 0 ? "= " + join(types, " | ") : ""], " ");
      },
      EnumTypeExtension: function EnumTypeExtension(_ref37) {
        var name = _ref37.name, directives = _ref37.directives, values = _ref37.values;
        return join(["extend enum", name, join(directives, " "), block(values)], " ");
      },
      InputObjectTypeExtension: function InputObjectTypeExtension(_ref38) {
        var name = _ref38.name, directives = _ref38.directives, fields = _ref38.fields;
        return join(["extend input", name, join(directives, " "), block(fields)], " ");
      }
    };
    function addDescription(cb) {
      return function(node) {
        return join([node.description, cb(node)], "\n");
      };
    }
    function join(maybeArray, separator) {
      return maybeArray ? maybeArray.filter(function(x) {
        return x;
      }).join(separator || "") : "";
    }
    function block(array) {
      return array && array.length !== 0 ? "{\n" + indent(join(array, "\n")) + "\n}" : "";
    }
    function wrap(start, maybeString, end) {
      return maybeString ? start + maybeString + (end || "") : "";
    }
    function indent(maybeString) {
      return maybeString && "  " + maybeString.replace(/\n/g, "\n  ");
    }
    function isMultiline(string) {
      return string.indexOf("\n") !== -1;
    }
    function hasMultilineItems(maybeArray) {
      return maybeArray && maybeArray.some(isMultiline);
    }
  }
});

// ../api/node_modules/iterall/index.js
var require_iterall = __commonJS({
  "../api/node_modules/iterall/index.js"(exports) {
    "use strict";
    exports.isIterable = isIterable;
    exports.isArrayLike = isArrayLike;
    exports.isCollection = isCollection;
    exports.getIterator = getIterator;
    exports.getIteratorMethod = getIteratorMethod;
    exports.createIterator = createIterator;
    exports.forEach = forEach;
    exports.isAsyncIterable = isAsyncIterable;
    exports.getAsyncIterator = getAsyncIterator;
    exports.getAsyncIteratorMethod = getAsyncIteratorMethod;
    exports.createAsyncIterator = createAsyncIterator;
    exports.forAwaitEach = forAwaitEach;
    var SYMBOL = typeof Symbol === "function" ? Symbol : void 0;
    var SYMBOL_ITERATOR = SYMBOL && SYMBOL.iterator;
    var $$iterator = exports.$$iterator = SYMBOL_ITERATOR || "@@iterator";
    function isIterable(obj) {
      return !!getIteratorMethod(obj);
    }
    function isArrayLike(obj) {
      var length = obj != null && obj.length;
      return typeof length === "number" && length >= 0 && length % 1 === 0;
    }
    function isCollection(obj) {
      return Object(obj) === obj && (isArrayLike(obj) || isIterable(obj));
    }
    function getIterator(iterable) {
      var method = getIteratorMethod(iterable);
      if (method) {
        return method.call(iterable);
      }
    }
    function getIteratorMethod(iterable) {
      if (iterable != null) {
        var method = SYMBOL_ITERATOR && iterable[SYMBOL_ITERATOR] || iterable["@@iterator"];
        if (typeof method === "function") {
          return method;
        }
      }
    }
    function createIterator(collection) {
      if (collection != null) {
        var iterator = getIterator(collection);
        if (iterator) {
          return iterator;
        }
        if (isArrayLike(collection)) {
          return new ArrayLikeIterator(collection);
        }
      }
    }
    function ArrayLikeIterator(obj) {
      this._o = obj;
      this._i = 0;
    }
    ArrayLikeIterator.prototype[$$iterator] = function() {
      return this;
    };
    ArrayLikeIterator.prototype.next = function() {
      if (this._o === void 0 || this._i >= this._o.length) {
        this._o = void 0;
        return { value: void 0, done: true };
      }
      return { value: this._o[this._i++], done: false };
    };
    function forEach(collection, callback, thisArg) {
      if (collection != null) {
        if (typeof collection.forEach === "function") {
          return collection.forEach(callback, thisArg);
        }
        var i = 0;
        var iterator = getIterator(collection);
        if (iterator) {
          var step;
          while (!(step = iterator.next()).done) {
            callback.call(thisArg, step.value, i++, collection);
            if (i > 9999999) {
              throw new TypeError("Near-infinite iteration.");
            }
          }
        } else if (isArrayLike(collection)) {
          for (; i < collection.length; i++) {
            if (collection.hasOwnProperty(i)) {
              callback.call(thisArg, collection[i], i, collection);
            }
          }
        }
      }
    }
    var SYMBOL_ASYNC_ITERATOR = SYMBOL && SYMBOL.asyncIterator;
    var $$asyncIterator = exports.$$asyncIterator = SYMBOL_ASYNC_ITERATOR || "@@asyncIterator";
    function isAsyncIterable(obj) {
      return !!getAsyncIteratorMethod(obj);
    }
    function getAsyncIterator(asyncIterable) {
      var method = getAsyncIteratorMethod(asyncIterable);
      if (method) {
        return method.call(asyncIterable);
      }
    }
    function getAsyncIteratorMethod(asyncIterable) {
      if (asyncIterable != null) {
        var method = SYMBOL_ASYNC_ITERATOR && asyncIterable[SYMBOL_ASYNC_ITERATOR] || asyncIterable["@@asyncIterator"];
        if (typeof method === "function") {
          return method;
        }
      }
    }
    function createAsyncIterator(source) {
      if (source != null) {
        var asyncIterator = getAsyncIterator(source);
        if (asyncIterator) {
          return asyncIterator;
        }
        var iterator = createIterator(source);
        if (iterator) {
          return new AsyncFromSyncIterator(iterator);
        }
      }
    }
    function AsyncFromSyncIterator(iterator) {
      this._i = iterator;
    }
    AsyncFromSyncIterator.prototype[$$asyncIterator] = function() {
      return this;
    };
    AsyncFromSyncIterator.prototype.next = function(value) {
      return unwrapAsyncFromSync(this._i, "next", value);
    };
    AsyncFromSyncIterator.prototype.return = function(value) {
      return this._i.return ? unwrapAsyncFromSync(this._i, "return", value) : Promise.resolve({ value, done: true });
    };
    AsyncFromSyncIterator.prototype.throw = function(value) {
      return this._i.throw ? unwrapAsyncFromSync(this._i, "throw", value) : Promise.reject(value);
    };
    function unwrapAsyncFromSync(iterator, fn, value) {
      var step;
      return new Promise(function(resolve) {
        step = iterator[fn](value);
        resolve(step.value);
      }).then(function(value2) {
        return { value: value2, done: step.done };
      });
    }
    function forAwaitEach(source, callback, thisArg) {
      var asyncIterator = createAsyncIterator(source);
      if (asyncIterator) {
        var i = 0;
        return new Promise(function(resolve, reject) {
          function next() {
            asyncIterator.next().then(function(step) {
              if (!step.done) {
                Promise.resolve(callback.call(thisArg, step.value, i++, source)).then(next).catch(reject);
              } else {
                resolve();
              }
              return null;
            }).catch(reject);
            return null;
          }
          next();
        });
      }
    }
  }
});

// ../api/node_modules/graphql/jsutils/isNullish.js
var require_isNullish = __commonJS({
  "../api/node_modules/graphql/jsutils/isNullish.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", {
      value: true
    });
    exports.default = isNullish;
    function isNullish(value) {
      return value === null || value === void 0 || value !== value;
    }
  }
});

// ../api/node_modules/graphql/utilities/astFromValue.js
var require_astFromValue = __commonJS({
  "../api/node_modules/graphql/utilities/astFromValue.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", {
      value: true
    });
    exports.astFromValue = astFromValue;
    var _iterall = require_iterall();
    var _objectValues3 = _interopRequireDefault(require_objectValues());
    var _inspect = _interopRequireDefault(require_inspect());
    var _invariant = _interopRequireDefault(require_invariant());
    var _isNullish = _interopRequireDefault(require_isNullish());
    var _isInvalid = _interopRequireDefault(require_isInvalid());
    var _isObjectLike = _interopRequireDefault(require_isObjectLike());
    var _kinds = require_kinds();
    var _scalars = require_scalars();
    var _definition = require_definition();
    function _interopRequireDefault(obj) {
      return obj && obj.__esModule ? obj : { default: obj };
    }
    function astFromValue(value, type) {
      if ((0, _definition.isNonNullType)(type)) {
        var astValue = astFromValue(value, type.ofType);
        if (astValue && astValue.kind === _kinds.Kind.NULL) {
          return null;
        }
        return astValue;
      }
      if (value === null) {
        return {
          kind: _kinds.Kind.NULL
        };
      }
      if ((0, _isInvalid.default)(value)) {
        return null;
      }
      if ((0, _definition.isListType)(type)) {
        var itemType = type.ofType;
        if ((0, _iterall.isCollection)(value)) {
          var valuesNodes = [];
          (0, _iterall.forEach)(value, function(item) {
            var itemNode = astFromValue(item, itemType);
            if (itemNode) {
              valuesNodes.push(itemNode);
            }
          });
          return {
            kind: _kinds.Kind.LIST,
            values: valuesNodes
          };
        }
        return astFromValue(value, itemType);
      }
      if ((0, _definition.isInputObjectType)(type)) {
        if (!(0, _isObjectLike.default)(value)) {
          return null;
        }
        var fieldNodes = [];
        for (var _i2 = 0, _objectValues2 = (0, _objectValues3.default)(type.getFields()); _i2 < _objectValues2.length; _i2++) {
          var field = _objectValues2[_i2];
          var fieldValue = astFromValue(value[field.name], field.type);
          if (fieldValue) {
            fieldNodes.push({
              kind: _kinds.Kind.OBJECT_FIELD,
              name: {
                kind: _kinds.Kind.NAME,
                value: field.name
              },
              value: fieldValue
            });
          }
        }
        return {
          kind: _kinds.Kind.OBJECT,
          fields: fieldNodes
        };
      }
      if ((0, _definition.isLeafType)(type)) {
        var serialized = type.serialize(value);
        if ((0, _isNullish.default)(serialized)) {
          return null;
        }
        if (typeof serialized === "boolean") {
          return {
            kind: _kinds.Kind.BOOLEAN,
            value: serialized
          };
        }
        if (typeof serialized === "number") {
          var stringNum = String(serialized);
          return integerStringRegExp.test(stringNum) ? {
            kind: _kinds.Kind.INT,
            value: stringNum
          } : {
            kind: _kinds.Kind.FLOAT,
            value: stringNum
          };
        }
        if (typeof serialized === "string") {
          if ((0, _definition.isEnumType)(type)) {
            return {
              kind: _kinds.Kind.ENUM,
              value: serialized
            };
          }
          if (type === _scalars.GraphQLID && integerStringRegExp.test(serialized)) {
            return {
              kind: _kinds.Kind.INT,
              value: serialized
            };
          }
          return {
            kind: _kinds.Kind.STRING,
            value: serialized
          };
        }
        throw new TypeError("Cannot convert value to AST: ".concat((0, _inspect.default)(serialized)));
      }
      (0, _invariant.default)(false, "Unexpected input type: " + (0, _inspect.default)(type));
    }
    var integerStringRegExp = /^-?(?:0|[1-9][0-9]*)$/;
  }
});

// ../api/node_modules/graphql/type/introspection.js
var require_introspection = __commonJS({
  "../api/node_modules/graphql/type/introspection.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", {
      value: true
    });
    exports.isIntrospectionType = isIntrospectionType;
    exports.introspectionTypes = exports.TypeNameMetaFieldDef = exports.TypeMetaFieldDef = exports.SchemaMetaFieldDef = exports.__TypeKind = exports.TypeKind = exports.__EnumValue = exports.__InputValue = exports.__Field = exports.__Type = exports.__DirectiveLocation = exports.__Directive = exports.__Schema = void 0;
    var _objectValues = _interopRequireDefault(require_objectValues());
    var _inspect = _interopRequireDefault(require_inspect());
    var _invariant = _interopRequireDefault(require_invariant());
    var _printer = require_printer();
    var _directiveLocation = require_directiveLocation();
    var _astFromValue = require_astFromValue();
    var _scalars = require_scalars();
    var _definition = require_definition();
    function _interopRequireDefault(obj) {
      return obj && obj.__esModule ? obj : { default: obj };
    }
    var __Schema = new _definition.GraphQLObjectType({
      name: "__Schema",
      description: "A GraphQL Schema defines the capabilities of a GraphQL server. It exposes all available types and directives on the server, as well as the entry points for query, mutation, and subscription operations.",
      fields: function fields() {
        return {
          types: {
            description: "A list of all types supported by this server.",
            type: (0, _definition.GraphQLNonNull)((0, _definition.GraphQLList)((0, _definition.GraphQLNonNull)(__Type))),
            resolve: function resolve(schema) {
              return (0, _objectValues.default)(schema.getTypeMap());
            }
          },
          queryType: {
            description: "The type that query operations will be rooted at.",
            type: (0, _definition.GraphQLNonNull)(__Type),
            resolve: function resolve(schema) {
              return schema.getQueryType();
            }
          },
          mutationType: {
            description: "If this server supports mutation, the type that mutation operations will be rooted at.",
            type: __Type,
            resolve: function resolve(schema) {
              return schema.getMutationType();
            }
          },
          subscriptionType: {
            description: "If this server support subscription, the type that subscription operations will be rooted at.",
            type: __Type,
            resolve: function resolve(schema) {
              return schema.getSubscriptionType();
            }
          },
          directives: {
            description: "A list of all directives supported by this server.",
            type: (0, _definition.GraphQLNonNull)((0, _definition.GraphQLList)((0, _definition.GraphQLNonNull)(__Directive))),
            resolve: function resolve(schema) {
              return schema.getDirectives();
            }
          }
        };
      }
    });
    exports.__Schema = __Schema;
    var __Directive = new _definition.GraphQLObjectType({
      name: "__Directive",
      description: "A Directive provides a way to describe alternate runtime execution and type validation behavior in a GraphQL document.\n\nIn some cases, you need to provide options to alter GraphQL's execution behavior in ways field arguments will not suffice, such as conditionally including or skipping a field. Directives provide this by describing additional information to the executor.",
      fields: function fields() {
        return {
          name: {
            type: (0, _definition.GraphQLNonNull)(_scalars.GraphQLString),
            resolve: function resolve(obj) {
              return obj.name;
            }
          },
          description: {
            type: _scalars.GraphQLString,
            resolve: function resolve(obj) {
              return obj.description;
            }
          },
          locations: {
            type: (0, _definition.GraphQLNonNull)((0, _definition.GraphQLList)((0, _definition.GraphQLNonNull)(__DirectiveLocation))),
            resolve: function resolve(obj) {
              return obj.locations;
            }
          },
          args: {
            type: (0, _definition.GraphQLNonNull)((0, _definition.GraphQLList)((0, _definition.GraphQLNonNull)(__InputValue))),
            resolve: function resolve(directive) {
              return directive.args;
            }
          }
        };
      }
    });
    exports.__Directive = __Directive;
    var __DirectiveLocation = new _definition.GraphQLEnumType({
      name: "__DirectiveLocation",
      description: "A Directive can be adjacent to many parts of the GraphQL language, a __DirectiveLocation describes one such possible adjacencies.",
      values: {
        QUERY: {
          value: _directiveLocation.DirectiveLocation.QUERY,
          description: "Location adjacent to a query operation."
        },
        MUTATION: {
          value: _directiveLocation.DirectiveLocation.MUTATION,
          description: "Location adjacent to a mutation operation."
        },
        SUBSCRIPTION: {
          value: _directiveLocation.DirectiveLocation.SUBSCRIPTION,
          description: "Location adjacent to a subscription operation."
        },
        FIELD: {
          value: _directiveLocation.DirectiveLocation.FIELD,
          description: "Location adjacent to a field."
        },
        FRAGMENT_DEFINITION: {
          value: _directiveLocation.DirectiveLocation.FRAGMENT_DEFINITION,
          description: "Location adjacent to a fragment definition."
        },
        FRAGMENT_SPREAD: {
          value: _directiveLocation.DirectiveLocation.FRAGMENT_SPREAD,
          description: "Location adjacent to a fragment spread."
        },
        INLINE_FRAGMENT: {
          value: _directiveLocation.DirectiveLocation.INLINE_FRAGMENT,
          description: "Location adjacent to an inline fragment."
        },
        VARIABLE_DEFINITION: {
          value: _directiveLocation.DirectiveLocation.VARIABLE_DEFINITION,
          description: "Location adjacent to a variable definition."
        },
        SCHEMA: {
          value: _directiveLocation.DirectiveLocation.SCHEMA,
          description: "Location adjacent to a schema definition."
        },
        SCALAR: {
          value: _directiveLocation.DirectiveLocation.SCALAR,
          description: "Location adjacent to a scalar definition."
        },
        OBJECT: {
          value: _directiveLocation.DirectiveLocation.OBJECT,
          description: "Location adjacent to an object type definition."
        },
        FIELD_DEFINITION: {
          value: _directiveLocation.DirectiveLocation.FIELD_DEFINITION,
          description: "Location adjacent to a field definition."
        },
        ARGUMENT_DEFINITION: {
          value: _directiveLocation.DirectiveLocation.ARGUMENT_DEFINITION,
          description: "Location adjacent to an argument definition."
        },
        INTERFACE: {
          value: _directiveLocation.DirectiveLocation.INTERFACE,
          description: "Location adjacent to an interface definition."
        },
        UNION: {
          value: _directiveLocation.DirectiveLocation.UNION,
          description: "Location adjacent to a union definition."
        },
        ENUM: {
          value: _directiveLocation.DirectiveLocation.ENUM,
          description: "Location adjacent to an enum definition."
        },
        ENUM_VALUE: {
          value: _directiveLocation.DirectiveLocation.ENUM_VALUE,
          description: "Location adjacent to an enum value definition."
        },
        INPUT_OBJECT: {
          value: _directiveLocation.DirectiveLocation.INPUT_OBJECT,
          description: "Location adjacent to an input object type definition."
        },
        INPUT_FIELD_DEFINITION: {
          value: _directiveLocation.DirectiveLocation.INPUT_FIELD_DEFINITION,
          description: "Location adjacent to an input object field definition."
        }
      }
    });
    exports.__DirectiveLocation = __DirectiveLocation;
    var __Type = new _definition.GraphQLObjectType({
      name: "__Type",
      description: "The fundamental unit of any GraphQL Schema is the type. There are many kinds of types in GraphQL as represented by the `__TypeKind` enum.\n\nDepending on the kind of a type, certain fields describe information about that type. Scalar types provide no information beyond a name and description, while Enum types provide their values. Object and Interface types provide the fields they describe. Abstract types, Union and Interface, provide the Object types possible at runtime. List and NonNull types compose other types.",
      fields: function fields() {
        return {
          kind: {
            type: (0, _definition.GraphQLNonNull)(__TypeKind),
            resolve: function resolve(type) {
              if ((0, _definition.isScalarType)(type)) {
                return TypeKind.SCALAR;
              } else if ((0, _definition.isObjectType)(type)) {
                return TypeKind.OBJECT;
              } else if ((0, _definition.isInterfaceType)(type)) {
                return TypeKind.INTERFACE;
              } else if ((0, _definition.isUnionType)(type)) {
                return TypeKind.UNION;
              } else if ((0, _definition.isEnumType)(type)) {
                return TypeKind.ENUM;
              } else if ((0, _definition.isInputObjectType)(type)) {
                return TypeKind.INPUT_OBJECT;
              } else if ((0, _definition.isListType)(type)) {
                return TypeKind.LIST;
              } else if ((0, _definition.isNonNullType)(type)) {
                return TypeKind.NON_NULL;
              }
              (0, _invariant.default)(false, 'Unexpected type: "'.concat((0, _inspect.default)(type), '".'));
            }
          },
          name: {
            type: _scalars.GraphQLString,
            resolve: function resolve(obj) {
              return obj.name !== void 0 ? obj.name : void 0;
            }
          },
          description: {
            type: _scalars.GraphQLString,
            resolve: function resolve(obj) {
              return obj.description !== void 0 ? obj.description : void 0;
            }
          },
          fields: {
            type: (0, _definition.GraphQLList)((0, _definition.GraphQLNonNull)(__Field)),
            args: {
              includeDeprecated: {
                type: _scalars.GraphQLBoolean,
                defaultValue: false
              }
            },
            resolve: function resolve(type, _ref) {
              var includeDeprecated = _ref.includeDeprecated;
              if ((0, _definition.isObjectType)(type) || (0, _definition.isInterfaceType)(type)) {
                var fields2 = (0, _objectValues.default)(type.getFields());
                if (!includeDeprecated) {
                  fields2 = fields2.filter(function(field) {
                    return !field.deprecationReason;
                  });
                }
                return fields2;
              }
              return null;
            }
          },
          interfaces: {
            type: (0, _definition.GraphQLList)((0, _definition.GraphQLNonNull)(__Type)),
            resolve: function resolve(type) {
              if ((0, _definition.isObjectType)(type)) {
                return type.getInterfaces();
              }
            }
          },
          possibleTypes: {
            type: (0, _definition.GraphQLList)((0, _definition.GraphQLNonNull)(__Type)),
            resolve: function resolve(type, args, context, _ref2) {
              var schema = _ref2.schema;
              if ((0, _definition.isAbstractType)(type)) {
                return schema.getPossibleTypes(type);
              }
            }
          },
          enumValues: {
            type: (0, _definition.GraphQLList)((0, _definition.GraphQLNonNull)(__EnumValue)),
            args: {
              includeDeprecated: {
                type: _scalars.GraphQLBoolean,
                defaultValue: false
              }
            },
            resolve: function resolve(type, _ref3) {
              var includeDeprecated = _ref3.includeDeprecated;
              if ((0, _definition.isEnumType)(type)) {
                var values = type.getValues();
                if (!includeDeprecated) {
                  values = values.filter(function(value) {
                    return !value.deprecationReason;
                  });
                }
                return values;
              }
            }
          },
          inputFields: {
            type: (0, _definition.GraphQLList)((0, _definition.GraphQLNonNull)(__InputValue)),
            resolve: function resolve(type) {
              if ((0, _definition.isInputObjectType)(type)) {
                return (0, _objectValues.default)(type.getFields());
              }
            }
          },
          ofType: {
            type: __Type,
            resolve: function resolve(obj) {
              return obj.ofType !== void 0 ? obj.ofType : void 0;
            }
          }
        };
      }
    });
    exports.__Type = __Type;
    var __Field = new _definition.GraphQLObjectType({
      name: "__Field",
      description: "Object and Interface types are described by a list of Fields, each of which has a name, potentially a list of arguments, and a return type.",
      fields: function fields() {
        return {
          name: {
            type: (0, _definition.GraphQLNonNull)(_scalars.GraphQLString),
            resolve: function resolve(obj) {
              return obj.name;
            }
          },
          description: {
            type: _scalars.GraphQLString,
            resolve: function resolve(obj) {
              return obj.description;
            }
          },
          args: {
            type: (0, _definition.GraphQLNonNull)((0, _definition.GraphQLList)((0, _definition.GraphQLNonNull)(__InputValue))),
            resolve: function resolve(field) {
              return field.args;
            }
          },
          type: {
            type: (0, _definition.GraphQLNonNull)(__Type),
            resolve: function resolve(obj) {
              return obj.type;
            }
          },
          isDeprecated: {
            type: (0, _definition.GraphQLNonNull)(_scalars.GraphQLBoolean),
            resolve: function resolve(obj) {
              return obj.isDeprecated;
            }
          },
          deprecationReason: {
            type: _scalars.GraphQLString,
            resolve: function resolve(obj) {
              return obj.deprecationReason;
            }
          }
        };
      }
    });
    exports.__Field = __Field;
    var __InputValue = new _definition.GraphQLObjectType({
      name: "__InputValue",
      description: "Arguments provided to Fields or Directives and the input fields of an InputObject are represented as Input Values which describe their type and optionally a default value.",
      fields: function fields() {
        return {
          name: {
            type: (0, _definition.GraphQLNonNull)(_scalars.GraphQLString),
            resolve: function resolve(obj) {
              return obj.name;
            }
          },
          description: {
            type: _scalars.GraphQLString,
            resolve: function resolve(obj) {
              return obj.description;
            }
          },
          type: {
            type: (0, _definition.GraphQLNonNull)(__Type),
            resolve: function resolve(obj) {
              return obj.type;
            }
          },
          defaultValue: {
            type: _scalars.GraphQLString,
            description: "A GraphQL-formatted string representing the default value for this input value.",
            resolve: function resolve(inputVal) {
              var valueAST = (0, _astFromValue.astFromValue)(inputVal.defaultValue, inputVal.type);
              return valueAST ? (0, _printer.print)(valueAST) : null;
            }
          }
        };
      }
    });
    exports.__InputValue = __InputValue;
    var __EnumValue = new _definition.GraphQLObjectType({
      name: "__EnumValue",
      description: "One possible value for a given Enum. Enum values are unique values, not a placeholder for a string or numeric value. However an Enum value is returned in a JSON response as a string.",
      fields: function fields() {
        return {
          name: {
            type: (0, _definition.GraphQLNonNull)(_scalars.GraphQLString),
            resolve: function resolve(obj) {
              return obj.name;
            }
          },
          description: {
            type: _scalars.GraphQLString,
            resolve: function resolve(obj) {
              return obj.description;
            }
          },
          isDeprecated: {
            type: (0, _definition.GraphQLNonNull)(_scalars.GraphQLBoolean),
            resolve: function resolve(obj) {
              return obj.isDeprecated;
            }
          },
          deprecationReason: {
            type: _scalars.GraphQLString,
            resolve: function resolve(obj) {
              return obj.deprecationReason;
            }
          }
        };
      }
    });
    exports.__EnumValue = __EnumValue;
    var TypeKind = Object.freeze({
      SCALAR: "SCALAR",
      OBJECT: "OBJECT",
      INTERFACE: "INTERFACE",
      UNION: "UNION",
      ENUM: "ENUM",
      INPUT_OBJECT: "INPUT_OBJECT",
      LIST: "LIST",
      NON_NULL: "NON_NULL"
    });
    exports.TypeKind = TypeKind;
    var __TypeKind = new _definition.GraphQLEnumType({
      name: "__TypeKind",
      description: "An enum describing what kind of type a given `__Type` is.",
      values: {
        SCALAR: {
          value: TypeKind.SCALAR,
          description: "Indicates this type is a scalar."
        },
        OBJECT: {
          value: TypeKind.OBJECT,
          description: "Indicates this type is an object. `fields` and `interfaces` are valid fields."
        },
        INTERFACE: {
          value: TypeKind.INTERFACE,
          description: "Indicates this type is an interface. `fields` and `possibleTypes` are valid fields."
        },
        UNION: {
          value: TypeKind.UNION,
          description: "Indicates this type is a union. `possibleTypes` is a valid field."
        },
        ENUM: {
          value: TypeKind.ENUM,
          description: "Indicates this type is an enum. `enumValues` is a valid field."
        },
        INPUT_OBJECT: {
          value: TypeKind.INPUT_OBJECT,
          description: "Indicates this type is an input object. `inputFields` is a valid field."
        },
        LIST: {
          value: TypeKind.LIST,
          description: "Indicates this type is a list. `ofType` is a valid field."
        },
        NON_NULL: {
          value: TypeKind.NON_NULL,
          description: "Indicates this type is a non-null. `ofType` is a valid field."
        }
      }
    });
    exports.__TypeKind = __TypeKind;
    var SchemaMetaFieldDef = {
      name: "__schema",
      type: (0, _definition.GraphQLNonNull)(__Schema),
      description: "Access the current type schema of this server.",
      args: [],
      resolve: function resolve(source, args, context, _ref4) {
        var schema = _ref4.schema;
        return schema;
      },
      deprecationReason: void 0,
      extensions: void 0,
      astNode: void 0
    };
    exports.SchemaMetaFieldDef = SchemaMetaFieldDef;
    var TypeMetaFieldDef = {
      name: "__type",
      type: __Type,
      description: "Request the type information of a single type.",
      args: [{
        name: "name",
        description: void 0,
        type: (0, _definition.GraphQLNonNull)(_scalars.GraphQLString),
        defaultValue: void 0,
        extensions: void 0,
        astNode: void 0
      }],
      resolve: function resolve(source, _ref5, context, _ref6) {
        var name = _ref5.name;
        var schema = _ref6.schema;
        return schema.getType(name);
      },
      deprecationReason: void 0,
      extensions: void 0,
      astNode: void 0
    };
    exports.TypeMetaFieldDef = TypeMetaFieldDef;
    var TypeNameMetaFieldDef = {
      name: "__typename",
      type: (0, _definition.GraphQLNonNull)(_scalars.GraphQLString),
      description: "The name of the current Object type at runtime.",
      args: [],
      resolve: function resolve(source, args, context, _ref7) {
        var parentType = _ref7.parentType;
        return parentType.name;
      },
      deprecationReason: void 0,
      extensions: void 0,
      astNode: void 0
    };
    exports.TypeNameMetaFieldDef = TypeNameMetaFieldDef;
    var introspectionTypes = Object.freeze([__Schema, __Directive, __DirectiveLocation, __Type, __Field, __InputValue, __EnumValue, __TypeKind]);
    exports.introspectionTypes = introspectionTypes;
    function isIntrospectionType(type) {
      return (0, _definition.isNamedType)(type) && introspectionTypes.some(function(_ref8) {
        var name = _ref8.name;
        return type.name === name;
      });
    }
  }
});

// ../api/node_modules/graphql/type/schema.js
var require_schema = __commonJS({
  "../api/node_modules/graphql/type/schema.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", {
      value: true
    });
    exports.isSchema = isSchema;
    exports.assertSchema = assertSchema;
    exports.GraphQLSchema = void 0;
    var _find = _interopRequireDefault(require_find());
    var _objectValues7 = _interopRequireDefault(require_objectValues());
    var _inspect = _interopRequireDefault(require_inspect());
    var _toObjMap = _interopRequireDefault(require_toObjMap());
    var _devAssert = _interopRequireDefault(require_devAssert());
    var _instanceOf = _interopRequireDefault(require_instanceOf());
    var _isObjectLike = _interopRequireDefault(require_isObjectLike());
    var _defineToStringTag = _interopRequireDefault(require_defineToStringTag());
    var _introspection = require_introspection();
    var _directives = require_directives();
    var _definition = require_definition();
    function _interopRequireDefault(obj) {
      return obj && obj.__esModule ? obj : { default: obj };
    }
    function isSchema(schema) {
      return (0, _instanceOf.default)(schema, GraphQLSchema);
    }
    function assertSchema(schema) {
      if (!isSchema(schema)) {
        throw new Error("Expected ".concat((0, _inspect.default)(schema), " to be a GraphQL schema."));
      }
      return schema;
    }
    var GraphQLSchema = /* @__PURE__ */ function() {
      function GraphQLSchema2(config) {
        if (config && config.assumeValid) {
          this.__validationErrors = [];
        } else {
          this.__validationErrors = void 0;
          (0, _isObjectLike.default)(config) || (0, _devAssert.default)(0, "Must provide configuration object.");
          !config.types || Array.isArray(config.types) || (0, _devAssert.default)(0, '"types" must be Array if provided but got: '.concat((0, _inspect.default)(config.types), "."));
          !config.directives || Array.isArray(config.directives) || (0, _devAssert.default)(0, '"directives" must be Array if provided but got: ' + "".concat((0, _inspect.default)(config.directives), "."));
          !config.allowedLegacyNames || Array.isArray(config.allowedLegacyNames) || (0, _devAssert.default)(0, '"allowedLegacyNames" must be Array if provided but got: ' + "".concat((0, _inspect.default)(config.allowedLegacyNames), "."));
        }
        this.extensions = config.extensions && (0, _toObjMap.default)(config.extensions);
        this.astNode = config.astNode;
        this.extensionASTNodes = config.extensionASTNodes;
        this.__allowedLegacyNames = config.allowedLegacyNames || [];
        this._queryType = config.query;
        this._mutationType = config.mutation;
        this._subscriptionType = config.subscription;
        this._directives = config.directives || _directives.specifiedDirectives;
        var initialTypes = [this._queryType, this._mutationType, this._subscriptionType, _introspection.__Schema].concat(config.types);
        var typeMap = /* @__PURE__ */ Object.create(null);
        typeMap = initialTypes.reduce(typeMapReducer, typeMap);
        typeMap = this._directives.reduce(typeMapDirectiveReducer, typeMap);
        this._typeMap = typeMap;
        this._possibleTypeMap = /* @__PURE__ */ Object.create(null);
        this._implementations = /* @__PURE__ */ Object.create(null);
        for (var _i2 = 0, _objectValues2 = (0, _objectValues7.default)(this._typeMap); _i2 < _objectValues2.length; _i2++) {
          var type = _objectValues2[_i2];
          if ((0, _definition.isObjectType)(type)) {
            for (var _i4 = 0, _type$getInterfaces2 = type.getInterfaces(); _i4 < _type$getInterfaces2.length; _i4++) {
              var iface = _type$getInterfaces2[_i4];
              if ((0, _definition.isInterfaceType)(iface)) {
                var impls = this._implementations[iface.name];
                if (impls) {
                  impls.push(type);
                } else {
                  this._implementations[iface.name] = [type];
                }
              }
            }
          }
        }
      }
      var _proto = GraphQLSchema2.prototype;
      _proto.getQueryType = function getQueryType() {
        return this._queryType;
      };
      _proto.getMutationType = function getMutationType() {
        return this._mutationType;
      };
      _proto.getSubscriptionType = function getSubscriptionType() {
        return this._subscriptionType;
      };
      _proto.getTypeMap = function getTypeMap() {
        return this._typeMap;
      };
      _proto.getType = function getType(name) {
        return this.getTypeMap()[name];
      };
      _proto.getPossibleTypes = function getPossibleTypes(abstractType) {
        if ((0, _definition.isUnionType)(abstractType)) {
          return abstractType.getTypes();
        }
        return this._implementations[abstractType.name] || [];
      };
      _proto.isPossibleType = function isPossibleType(abstractType, possibleType) {
        if (this._possibleTypeMap[abstractType.name] == null) {
          var map = /* @__PURE__ */ Object.create(null);
          for (var _i6 = 0, _this$getPossibleType2 = this.getPossibleTypes(abstractType); _i6 < _this$getPossibleType2.length; _i6++) {
            var type = _this$getPossibleType2[_i6];
            map[type.name] = true;
          }
          this._possibleTypeMap[abstractType.name] = map;
        }
        return Boolean(this._possibleTypeMap[abstractType.name][possibleType.name]);
      };
      _proto.getDirectives = function getDirectives() {
        return this._directives;
      };
      _proto.getDirective = function getDirective(name) {
        return (0, _find.default)(this.getDirectives(), function(directive) {
          return directive.name === name;
        });
      };
      _proto.toConfig = function toConfig() {
        return {
          query: this.getQueryType(),
          mutation: this.getMutationType(),
          subscription: this.getSubscriptionType(),
          types: (0, _objectValues7.default)(this.getTypeMap()),
          directives: this.getDirectives().slice(),
          extensions: this.extensions,
          astNode: this.astNode,
          extensionASTNodes: this.extensionASTNodes || [],
          assumeValid: this.__validationErrors !== void 0,
          allowedLegacyNames: this.__allowedLegacyNames
        };
      };
      return GraphQLSchema2;
    }();
    exports.GraphQLSchema = GraphQLSchema;
    (0, _defineToStringTag.default)(GraphQLSchema);
    function typeMapReducer(map, type) {
      if (!type) {
        return map;
      }
      var namedType = (0, _definition.getNamedType)(type);
      var seenType = map[namedType.name];
      if (seenType) {
        if (seenType !== namedType) {
          throw new Error('Schema must contain uniquely named types but contains multiple types named "'.concat(namedType.name, '".'));
        }
        return map;
      }
      map[namedType.name] = namedType;
      var reducedMap = map;
      if ((0, _definition.isUnionType)(namedType)) {
        reducedMap = namedType.getTypes().reduce(typeMapReducer, reducedMap);
      }
      if ((0, _definition.isObjectType)(namedType)) {
        reducedMap = namedType.getInterfaces().reduce(typeMapReducer, reducedMap);
      }
      if ((0, _definition.isObjectType)(namedType) || (0, _definition.isInterfaceType)(namedType)) {
        for (var _i8 = 0, _objectValues4 = (0, _objectValues7.default)(namedType.getFields()); _i8 < _objectValues4.length; _i8++) {
          var field = _objectValues4[_i8];
          var fieldArgTypes = field.args.map(function(arg) {
            return arg.type;
          });
          reducedMap = fieldArgTypes.reduce(typeMapReducer, reducedMap);
          reducedMap = typeMapReducer(reducedMap, field.type);
        }
      }
      if ((0, _definition.isInputObjectType)(namedType)) {
        for (var _i10 = 0, _objectValues6 = (0, _objectValues7.default)(namedType.getFields()); _i10 < _objectValues6.length; _i10++) {
          var _field = _objectValues6[_i10];
          reducedMap = typeMapReducer(reducedMap, _field.type);
        }
      }
      return reducedMap;
    }
    function typeMapDirectiveReducer(map, directive) {
      if (!(0, _directives.isDirective)(directive)) {
        return map;
      }
      return directive.args.reduce(function(_map, arg) {
        return typeMapReducer(_map, arg.type);
      }, map);
    }
  }
});

// ../api/node_modules/graphql/type/validate.js
var require_validate = __commonJS({
  "../api/node_modules/graphql/type/validate.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", {
      value: true
    });
    exports.validateSchema = validateSchema;
    exports.assertValidSchema = assertValidSchema;
    var _find = _interopRequireDefault(require_find());
    var _flatMap = _interopRequireDefault(require_flatMap());
    var _objectValues3 = _interopRequireDefault(require_objectValues());
    var _objectEntries3 = _interopRequireDefault(require_objectEntries());
    var _inspect = _interopRequireDefault(require_inspect());
    var _GraphQLError = require_GraphQLError();
    var _assertValidName = require_assertValidName();
    var _typeComparators = require_typeComparators();
    var _directives = require_directives();
    var _introspection = require_introspection();
    var _schema = require_schema();
    var _definition = require_definition();
    function _interopRequireDefault(obj) {
      return obj && obj.__esModule ? obj : { default: obj };
    }
    function validateSchema(schema) {
      (0, _schema.assertSchema)(schema);
      if (schema.__validationErrors) {
        return schema.__validationErrors;
      }
      var context = new SchemaValidationContext(schema);
      validateRootTypes(context);
      validateDirectives(context);
      validateTypes(context);
      var errors = context.getErrors();
      schema.__validationErrors = errors;
      return errors;
    }
    function assertValidSchema(schema) {
      var errors = validateSchema(schema);
      if (errors.length !== 0) {
        throw new Error(errors.map(function(error) {
          return error.message;
        }).join("\n\n"));
      }
    }
    var SchemaValidationContext = /* @__PURE__ */ function() {
      function SchemaValidationContext2(schema) {
        this._errors = [];
        this.schema = schema;
      }
      var _proto = SchemaValidationContext2.prototype;
      _proto.reportError = function reportError(message, nodes) {
        var _nodes = Array.isArray(nodes) ? nodes.filter(Boolean) : nodes;
        this.addError(new _GraphQLError.GraphQLError(message, _nodes));
      };
      _proto.addError = function addError(error) {
        this._errors.push(error);
      };
      _proto.getErrors = function getErrors() {
        return this._errors;
      };
      return SchemaValidationContext2;
    }();
    function validateRootTypes(context) {
      var schema = context.schema;
      var queryType = schema.getQueryType();
      if (!queryType) {
        context.reportError("Query root type must be provided.", schema.astNode);
      } else if (!(0, _definition.isObjectType)(queryType)) {
        context.reportError("Query root type must be Object type, it cannot be ".concat((0, _inspect.default)(queryType), "."), getOperationTypeNode(schema, queryType, "query"));
      }
      var mutationType = schema.getMutationType();
      if (mutationType && !(0, _definition.isObjectType)(mutationType)) {
        context.reportError("Mutation root type must be Object type if provided, it cannot be " + "".concat((0, _inspect.default)(mutationType), "."), getOperationTypeNode(schema, mutationType, "mutation"));
      }
      var subscriptionType = schema.getSubscriptionType();
      if (subscriptionType && !(0, _definition.isObjectType)(subscriptionType)) {
        context.reportError("Subscription root type must be Object type if provided, it cannot be " + "".concat((0, _inspect.default)(subscriptionType), "."), getOperationTypeNode(schema, subscriptionType, "subscription"));
      }
    }
    function getOperationTypeNode(schema, type, operation) {
      var operationNodes = getAllSubNodes(schema, function(node2) {
        return node2.operationTypes;
      });
      for (var _i2 = 0; _i2 < operationNodes.length; _i2++) {
        var node = operationNodes[_i2];
        if (node.operation === operation) {
          return node.type;
        }
      }
      return type.astNode;
    }
    function validateDirectives(context) {
      for (var _i4 = 0, _context$schema$getDi2 = context.schema.getDirectives(); _i4 < _context$schema$getDi2.length; _i4++) {
        var directive = _context$schema$getDi2[_i4];
        if (!(0, _directives.isDirective)(directive)) {
          context.reportError("Expected directive but got: ".concat((0, _inspect.default)(directive), "."), directive && directive.astNode);
          continue;
        }
        validateName(context, directive);
        var argNames = /* @__PURE__ */ Object.create(null);
        var _loop = function _loop2(_i62, _directive$args22) {
          var arg = _directive$args22[_i62];
          var argName = arg.name;
          validateName(context, arg);
          if (argNames[argName]) {
            context.reportError("Argument @".concat(directive.name, "(").concat(argName, ":) can only be defined once."), directive.astNode && directive.args.filter(function(_ref) {
              var name = _ref.name;
              return name === argName;
            }).map(function(_ref2) {
              var astNode = _ref2.astNode;
              return astNode;
            }));
            return "continue";
          }
          argNames[argName] = true;
          if (!(0, _definition.isInputType)(arg.type)) {
            context.reportError("The type of @".concat(directive.name, "(").concat(argName, ":) must be Input Type ") + "but got: ".concat((0, _inspect.default)(arg.type), "."), arg.astNode);
          }
        };
        for (var _i6 = 0, _directive$args2 = directive.args; _i6 < _directive$args2.length; _i6++) {
          var _ret = _loop(_i6, _directive$args2);
          if (_ret === "continue")
            continue;
        }
      }
    }
    function validateName(context, node) {
      if (context.schema.__allowedLegacyNames.indexOf(node.name) !== -1) {
        return;
      }
      var error = (0, _assertValidName.isValidNameError)(node.name, node.astNode || void 0);
      if (error) {
        context.addError(error);
      }
    }
    function validateTypes(context) {
      var validateInputObjectCircularRefs = createInputObjectCircularRefsValidator(context);
      var typeMap = context.schema.getTypeMap();
      for (var _i8 = 0, _objectValues2 = (0, _objectValues3.default)(typeMap); _i8 < _objectValues2.length; _i8++) {
        var type = _objectValues2[_i8];
        if (!(0, _definition.isNamedType)(type)) {
          context.reportError("Expected GraphQL named type but got: ".concat((0, _inspect.default)(type), "."), type && type.astNode);
          continue;
        }
        if (!(0, _introspection.isIntrospectionType)(type)) {
          validateName(context, type);
        }
        if ((0, _definition.isObjectType)(type)) {
          validateFields(context, type);
          validateObjectInterfaces(context, type);
        } else if ((0, _definition.isInterfaceType)(type)) {
          validateFields(context, type);
        } else if ((0, _definition.isUnionType)(type)) {
          validateUnionMembers(context, type);
        } else if ((0, _definition.isEnumType)(type)) {
          validateEnumValues(context, type);
        } else if ((0, _definition.isInputObjectType)(type)) {
          validateInputFields(context, type);
          validateInputObjectCircularRefs(type);
        }
      }
    }
    function validateFields(context, type) {
      var fields = (0, _objectValues3.default)(type.getFields());
      if (fields.length === 0) {
        context.reportError("Type ".concat(type.name, " must define one or more fields."), getAllNodes(type));
      }
      for (var _i10 = 0; _i10 < fields.length; _i10++) {
        var field = fields[_i10];
        validateName(context, field);
        if (!(0, _definition.isOutputType)(field.type)) {
          context.reportError("The type of ".concat(type.name, ".").concat(field.name, " must be Output Type ") + "but got: ".concat((0, _inspect.default)(field.type), "."), field.astNode && field.astNode.type);
        }
        var argNames = /* @__PURE__ */ Object.create(null);
        var _loop2 = function _loop22(_i122, _field$args22) {
          var arg = _field$args22[_i122];
          var argName = arg.name;
          validateName(context, arg);
          if (argNames[argName]) {
            context.reportError("Field argument ".concat(type.name, ".").concat(field.name, "(").concat(argName, ":) can only be defined once."), field.args.filter(function(_ref3) {
              var name = _ref3.name;
              return name === argName;
            }).map(function(_ref4) {
              var astNode = _ref4.astNode;
              return astNode;
            }));
          }
          argNames[argName] = true;
          if (!(0, _definition.isInputType)(arg.type)) {
            context.reportError("The type of ".concat(type.name, ".").concat(field.name, "(").concat(argName, ":) must be Input ") + "Type but got: ".concat((0, _inspect.default)(arg.type), "."), arg.astNode && arg.astNode.type);
          }
        };
        for (var _i12 = 0, _field$args2 = field.args; _i12 < _field$args2.length; _i12++) {
          _loop2(_i12, _field$args2);
        }
      }
    }
    function validateObjectInterfaces(context, object) {
      var implementedTypeNames = /* @__PURE__ */ Object.create(null);
      for (var _i14 = 0, _object$getInterfaces2 = object.getInterfaces(); _i14 < _object$getInterfaces2.length; _i14++) {
        var iface = _object$getInterfaces2[_i14];
        if (!(0, _definition.isInterfaceType)(iface)) {
          context.reportError("Type ".concat((0, _inspect.default)(object), " must only implement Interface types, ") + "it cannot implement ".concat((0, _inspect.default)(iface), "."), getAllImplementsInterfaceNodes(object, iface));
          continue;
        }
        if (implementedTypeNames[iface.name]) {
          context.reportError("Type ".concat(object.name, " can only implement ").concat(iface.name, " once."), getAllImplementsInterfaceNodes(object, iface));
          continue;
        }
        implementedTypeNames[iface.name] = true;
        validateObjectImplementsInterface(context, object, iface);
      }
    }
    function validateObjectImplementsInterface(context, object, iface) {
      var objectFieldMap = object.getFields();
      var ifaceFieldMap = iface.getFields();
      for (var _i16 = 0, _objectEntries2 = (0, _objectEntries3.default)(ifaceFieldMap); _i16 < _objectEntries2.length; _i16++) {
        var _ref6 = _objectEntries2[_i16];
        var fieldName = _ref6[0];
        var ifaceField = _ref6[1];
        var objectField = objectFieldMap[fieldName];
        if (!objectField) {
          context.reportError("Interface field ".concat(iface.name, ".").concat(fieldName, " expected but ").concat(object.name, " does not provide it."), [ifaceField.astNode].concat(getAllNodes(object)));
          continue;
        }
        if (!(0, _typeComparators.isTypeSubTypeOf)(context.schema, objectField.type, ifaceField.type)) {
          context.reportError("Interface field ".concat(iface.name, ".").concat(fieldName, " expects type ") + "".concat((0, _inspect.default)(ifaceField.type), " but ").concat(object.name, ".").concat(fieldName, " ") + "is type ".concat((0, _inspect.default)(objectField.type), "."), [ifaceField.astNode && ifaceField.astNode.type, objectField.astNode && objectField.astNode.type]);
        }
        var _loop3 = function _loop32(_i182, _ifaceField$args22) {
          var ifaceArg = _ifaceField$args22[_i182];
          var argName = ifaceArg.name;
          var objectArg = (0, _find.default)(objectField.args, function(arg) {
            return arg.name === argName;
          });
          if (!objectArg) {
            context.reportError("Interface field argument ".concat(iface.name, ".").concat(fieldName, "(").concat(argName, ":) expected but ").concat(object.name, ".").concat(fieldName, " does not provide it."), [ifaceArg.astNode, objectField.astNode]);
            return "continue";
          }
          if (!(0, _typeComparators.isEqualType)(ifaceArg.type, objectArg.type)) {
            context.reportError("Interface field argument ".concat(iface.name, ".").concat(fieldName, "(").concat(argName, ":) ") + "expects type ".concat((0, _inspect.default)(ifaceArg.type), " but ") + "".concat(object.name, ".").concat(fieldName, "(").concat(argName, ":) is type ") + "".concat((0, _inspect.default)(objectArg.type), "."), [ifaceArg.astNode && ifaceArg.astNode.type, objectArg.astNode && objectArg.astNode.type]);
          }
        };
        for (var _i18 = 0, _ifaceField$args2 = ifaceField.args; _i18 < _ifaceField$args2.length; _i18++) {
          var _ret2 = _loop3(_i18, _ifaceField$args2);
          if (_ret2 === "continue")
            continue;
        }
        var _loop4 = function _loop42(_i202, _objectField$args22) {
          var objectArg = _objectField$args22[_i202];
          var argName = objectArg.name;
          var ifaceArg = (0, _find.default)(ifaceField.args, function(arg) {
            return arg.name === argName;
          });
          if (!ifaceArg && (0, _definition.isRequiredArgument)(objectArg)) {
            context.reportError("Object field ".concat(object.name, ".").concat(fieldName, " includes required argument ").concat(argName, " that is missing from the Interface field ").concat(iface.name, ".").concat(fieldName, "."), [objectArg.astNode, ifaceField.astNode]);
          }
        };
        for (var _i20 = 0, _objectField$args2 = objectField.args; _i20 < _objectField$args2.length; _i20++) {
          _loop4(_i20, _objectField$args2);
        }
      }
    }
    function validateUnionMembers(context, union) {
      var memberTypes = union.getTypes();
      if (memberTypes.length === 0) {
        context.reportError("Union type ".concat(union.name, " must define one or more member types."), getAllNodes(union));
      }
      var includedTypeNames = /* @__PURE__ */ Object.create(null);
      for (var _i22 = 0; _i22 < memberTypes.length; _i22++) {
        var memberType = memberTypes[_i22];
        if (includedTypeNames[memberType.name]) {
          context.reportError("Union type ".concat(union.name, " can only include type ").concat(memberType.name, " once."), getUnionMemberTypeNodes(union, memberType.name));
          continue;
        }
        includedTypeNames[memberType.name] = true;
        if (!(0, _definition.isObjectType)(memberType)) {
          context.reportError("Union type ".concat(union.name, " can only include Object types, ") + "it cannot include ".concat((0, _inspect.default)(memberType), "."), getUnionMemberTypeNodes(union, String(memberType)));
        }
      }
    }
    function validateEnumValues(context, enumType) {
      var enumValues = enumType.getValues();
      if (enumValues.length === 0) {
        context.reportError("Enum type ".concat(enumType.name, " must define one or more values."), getAllNodes(enumType));
      }
      for (var _i24 = 0; _i24 < enumValues.length; _i24++) {
        var enumValue = enumValues[_i24];
        var valueName = enumValue.name;
        validateName(context, enumValue);
        if (valueName === "true" || valueName === "false" || valueName === "null") {
          context.reportError("Enum type ".concat(enumType.name, " cannot include value: ").concat(valueName, "."), enumValue.astNode);
        }
      }
    }
    function validateInputFields(context, inputObj) {
      var fields = (0, _objectValues3.default)(inputObj.getFields());
      if (fields.length === 0) {
        context.reportError("Input Object type ".concat(inputObj.name, " must define one or more fields."), getAllNodes(inputObj));
      }
      for (var _i26 = 0; _i26 < fields.length; _i26++) {
        var field = fields[_i26];
        validateName(context, field);
        if (!(0, _definition.isInputType)(field.type)) {
          context.reportError("The type of ".concat(inputObj.name, ".").concat(field.name, " must be Input Type ") + "but got: ".concat((0, _inspect.default)(field.type), "."), field.astNode && field.astNode.type);
        }
      }
    }
    function createInputObjectCircularRefsValidator(context) {
      var visitedTypes = /* @__PURE__ */ Object.create(null);
      var fieldPath = [];
      var fieldPathIndexByTypeName = /* @__PURE__ */ Object.create(null);
      return detectCycleRecursive;
      function detectCycleRecursive(inputObj) {
        if (visitedTypes[inputObj.name]) {
          return;
        }
        visitedTypes[inputObj.name] = true;
        fieldPathIndexByTypeName[inputObj.name] = fieldPath.length;
        var fields = (0, _objectValues3.default)(inputObj.getFields());
        for (var _i28 = 0; _i28 < fields.length; _i28++) {
          var field = fields[_i28];
          if ((0, _definition.isNonNullType)(field.type) && (0, _definition.isInputObjectType)(field.type.ofType)) {
            var fieldType = field.type.ofType;
            var cycleIndex = fieldPathIndexByTypeName[fieldType.name];
            fieldPath.push(field);
            if (cycleIndex === void 0) {
              detectCycleRecursive(fieldType);
            } else {
              var cyclePath = fieldPath.slice(cycleIndex);
              var pathStr = cyclePath.map(function(fieldObj) {
                return fieldObj.name;
              }).join(".");
              context.reportError('Cannot reference Input Object "'.concat(fieldType.name, '" within itself through a series of non-null fields: "').concat(pathStr, '".'), cyclePath.map(function(fieldObj) {
                return fieldObj.astNode;
              }));
            }
            fieldPath.pop();
          }
        }
        fieldPathIndexByTypeName[inputObj.name] = void 0;
      }
    }
    function getAllNodes(object) {
      var astNode = object.astNode, extensionASTNodes = object.extensionASTNodes;
      return astNode ? extensionASTNodes ? [astNode].concat(extensionASTNodes) : [astNode] : extensionASTNodes || [];
    }
    function getAllSubNodes(object, getter) {
      return (0, _flatMap.default)(getAllNodes(object), function(item) {
        return getter(item) || [];
      });
    }
    function getAllImplementsInterfaceNodes(type, iface) {
      return getAllSubNodes(type, function(typeNode) {
        return typeNode.interfaces;
      }).filter(function(ifaceNode) {
        return ifaceNode.name.value === iface.name;
      });
    }
    function getUnionMemberTypeNodes(union, typeName) {
      return getAllSubNodes(union, function(unionNode) {
        return unionNode.types;
      }).filter(function(typeNode) {
        return typeNode.name.value === typeName;
      });
    }
  }
});

// ../api/node_modules/graphql/utilities/typeFromAST.js
var require_typeFromAST = __commonJS({
  "../api/node_modules/graphql/utilities/typeFromAST.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", {
      value: true
    });
    exports.typeFromAST = typeFromAST;
    var _inspect = _interopRequireDefault(require_inspect());
    var _invariant = _interopRequireDefault(require_invariant());
    var _kinds = require_kinds();
    var _definition = require_definition();
    function _interopRequireDefault(obj) {
      return obj && obj.__esModule ? obj : { default: obj };
    }
    function typeFromAST(schema, typeNode) {
      var innerType;
      if (typeNode.kind === _kinds.Kind.LIST_TYPE) {
        innerType = typeFromAST(schema, typeNode.type);
        return innerType && (0, _definition.GraphQLList)(innerType);
      }
      if (typeNode.kind === _kinds.Kind.NON_NULL_TYPE) {
        innerType = typeFromAST(schema, typeNode.type);
        return innerType && (0, _definition.GraphQLNonNull)(innerType);
      }
      if (typeNode.kind === _kinds.Kind.NAMED_TYPE) {
        return schema.getType(typeNode.name.value);
      }
      (0, _invariant.default)(false, "Unexpected type node: " + (0, _inspect.default)(typeNode));
    }
  }
});

// ../api/node_modules/graphql/utilities/TypeInfo.js
var require_TypeInfo = __commonJS({
  "../api/node_modules/graphql/utilities/TypeInfo.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", {
      value: true
    });
    exports.TypeInfo = void 0;
    var _find = _interopRequireDefault(require_find());
    var _kinds = require_kinds();
    var _definition = require_definition();
    var _introspection = require_introspection();
    var _typeFromAST = require_typeFromAST();
    function _interopRequireDefault(obj) {
      return obj && obj.__esModule ? obj : { default: obj };
    }
    var TypeInfo = /* @__PURE__ */ function() {
      function TypeInfo2(schema, getFieldDefFn, initialType) {
        this._schema = schema;
        this._typeStack = [];
        this._parentTypeStack = [];
        this._inputTypeStack = [];
        this._fieldDefStack = [];
        this._defaultValueStack = [];
        this._directive = null;
        this._argument = null;
        this._enumValue = null;
        this._getFieldDef = getFieldDefFn || getFieldDef;
        if (initialType) {
          if ((0, _definition.isInputType)(initialType)) {
            this._inputTypeStack.push(initialType);
          }
          if ((0, _definition.isCompositeType)(initialType)) {
            this._parentTypeStack.push(initialType);
          }
          if ((0, _definition.isOutputType)(initialType)) {
            this._typeStack.push(initialType);
          }
        }
      }
      var _proto = TypeInfo2.prototype;
      _proto.getType = function getType() {
        if (this._typeStack.length > 0) {
          return this._typeStack[this._typeStack.length - 1];
        }
      };
      _proto.getParentType = function getParentType() {
        if (this._parentTypeStack.length > 0) {
          return this._parentTypeStack[this._parentTypeStack.length - 1];
        }
      };
      _proto.getInputType = function getInputType() {
        if (this._inputTypeStack.length > 0) {
          return this._inputTypeStack[this._inputTypeStack.length - 1];
        }
      };
      _proto.getParentInputType = function getParentInputType() {
        if (this._inputTypeStack.length > 1) {
          return this._inputTypeStack[this._inputTypeStack.length - 2];
        }
      };
      _proto.getFieldDef = function getFieldDef2() {
        if (this._fieldDefStack.length > 0) {
          return this._fieldDefStack[this._fieldDefStack.length - 1];
        }
      };
      _proto.getDefaultValue = function getDefaultValue() {
        if (this._defaultValueStack.length > 0) {
          return this._defaultValueStack[this._defaultValueStack.length - 1];
        }
      };
      _proto.getDirective = function getDirective() {
        return this._directive;
      };
      _proto.getArgument = function getArgument() {
        return this._argument;
      };
      _proto.getEnumValue = function getEnumValue() {
        return this._enumValue;
      };
      _proto.enter = function enter(node) {
        var schema = this._schema;
        switch (node.kind) {
          case _kinds.Kind.SELECTION_SET: {
            var namedType = (0, _definition.getNamedType)(this.getType());
            this._parentTypeStack.push((0, _definition.isCompositeType)(namedType) ? namedType : void 0);
            break;
          }
          case _kinds.Kind.FIELD: {
            var parentType = this.getParentType();
            var fieldDef;
            var fieldType;
            if (parentType) {
              fieldDef = this._getFieldDef(schema, parentType, node);
              if (fieldDef) {
                fieldType = fieldDef.type;
              }
            }
            this._fieldDefStack.push(fieldDef);
            this._typeStack.push((0, _definition.isOutputType)(fieldType) ? fieldType : void 0);
            break;
          }
          case _kinds.Kind.DIRECTIVE:
            this._directive = schema.getDirective(node.name.value);
            break;
          case _kinds.Kind.OPERATION_DEFINITION: {
            var type;
            if (node.operation === "query") {
              type = schema.getQueryType();
            } else if (node.operation === "mutation") {
              type = schema.getMutationType();
            } else if (node.operation === "subscription") {
              type = schema.getSubscriptionType();
            }
            this._typeStack.push((0, _definition.isObjectType)(type) ? type : void 0);
            break;
          }
          case _kinds.Kind.INLINE_FRAGMENT:
          case _kinds.Kind.FRAGMENT_DEFINITION: {
            var typeConditionAST = node.typeCondition;
            var outputType = typeConditionAST ? (0, _typeFromAST.typeFromAST)(schema, typeConditionAST) : (0, _definition.getNamedType)(this.getType());
            this._typeStack.push((0, _definition.isOutputType)(outputType) ? outputType : void 0);
            break;
          }
          case _kinds.Kind.VARIABLE_DEFINITION: {
            var inputType = (0, _typeFromAST.typeFromAST)(schema, node.type);
            this._inputTypeStack.push((0, _definition.isInputType)(inputType) ? inputType : void 0);
            break;
          }
          case _kinds.Kind.ARGUMENT: {
            var argDef;
            var argType;
            var fieldOrDirective = this.getDirective() || this.getFieldDef();
            if (fieldOrDirective) {
              argDef = (0, _find.default)(fieldOrDirective.args, function(arg) {
                return arg.name === node.name.value;
              });
              if (argDef) {
                argType = argDef.type;
              }
            }
            this._argument = argDef;
            this._defaultValueStack.push(argDef ? argDef.defaultValue : void 0);
            this._inputTypeStack.push((0, _definition.isInputType)(argType) ? argType : void 0);
            break;
          }
          case _kinds.Kind.LIST: {
            var listType = (0, _definition.getNullableType)(this.getInputType());
            var itemType = (0, _definition.isListType)(listType) ? listType.ofType : listType;
            this._defaultValueStack.push(void 0);
            this._inputTypeStack.push((0, _definition.isInputType)(itemType) ? itemType : void 0);
            break;
          }
          case _kinds.Kind.OBJECT_FIELD: {
            var objectType = (0, _definition.getNamedType)(this.getInputType());
            var inputFieldType;
            var inputField;
            if ((0, _definition.isInputObjectType)(objectType)) {
              inputField = objectType.getFields()[node.name.value];
              if (inputField) {
                inputFieldType = inputField.type;
              }
            }
            this._defaultValueStack.push(inputField ? inputField.defaultValue : void 0);
            this._inputTypeStack.push((0, _definition.isInputType)(inputFieldType) ? inputFieldType : void 0);
            break;
          }
          case _kinds.Kind.ENUM: {
            var enumType = (0, _definition.getNamedType)(this.getInputType());
            var enumValue;
            if ((0, _definition.isEnumType)(enumType)) {
              enumValue = enumType.getValue(node.value);
            }
            this._enumValue = enumValue;
            break;
          }
        }
      };
      _proto.leave = function leave(node) {
        switch (node.kind) {
          case _kinds.Kind.SELECTION_SET:
            this._parentTypeStack.pop();
            break;
          case _kinds.Kind.FIELD:
            this._fieldDefStack.pop();
            this._typeStack.pop();
            break;
          case _kinds.Kind.DIRECTIVE:
            this._directive = null;
            break;
          case _kinds.Kind.OPERATION_DEFINITION:
          case _kinds.Kind.INLINE_FRAGMENT:
          case _kinds.Kind.FRAGMENT_DEFINITION:
            this._typeStack.pop();
            break;
          case _kinds.Kind.VARIABLE_DEFINITION:
            this._inputTypeStack.pop();
            break;
          case _kinds.Kind.ARGUMENT:
            this._argument = null;
            this._defaultValueStack.pop();
            this._inputTypeStack.pop();
            break;
          case _kinds.Kind.LIST:
          case _kinds.Kind.OBJECT_FIELD:
            this._defaultValueStack.pop();
            this._inputTypeStack.pop();
            break;
          case _kinds.Kind.ENUM:
            this._enumValue = null;
            break;
        }
      };
      return TypeInfo2;
    }();
    exports.TypeInfo = TypeInfo;
    function getFieldDef(schema, parentType, fieldNode) {
      var name = fieldNode.name.value;
      if (name === _introspection.SchemaMetaFieldDef.name && schema.getQueryType() === parentType) {
        return _introspection.SchemaMetaFieldDef;
      }
      if (name === _introspection.TypeMetaFieldDef.name && schema.getQueryType() === parentType) {
        return _introspection.TypeMetaFieldDef;
      }
      if (name === _introspection.TypeNameMetaFieldDef.name && (0, _definition.isCompositeType)(parentType)) {
        return _introspection.TypeNameMetaFieldDef;
      }
      if ((0, _definition.isObjectType)(parentType) || (0, _definition.isInterfaceType)(parentType)) {
        return parentType.getFields()[name];
      }
    }
  }
});

// ../api/node_modules/graphql/language/predicates.js
var require_predicates = __commonJS({
  "../api/node_modules/graphql/language/predicates.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", {
      value: true
    });
    exports.isDefinitionNode = isDefinitionNode;
    exports.isExecutableDefinitionNode = isExecutableDefinitionNode;
    exports.isSelectionNode = isSelectionNode;
    exports.isValueNode = isValueNode;
    exports.isTypeNode = isTypeNode;
    exports.isTypeSystemDefinitionNode = isTypeSystemDefinitionNode;
    exports.isTypeDefinitionNode = isTypeDefinitionNode;
    exports.isTypeSystemExtensionNode = isTypeSystemExtensionNode;
    exports.isTypeExtensionNode = isTypeExtensionNode;
    var _kinds = require_kinds();
    function isDefinitionNode(node) {
      return isExecutableDefinitionNode(node) || isTypeSystemDefinitionNode(node) || isTypeSystemExtensionNode(node);
    }
    function isExecutableDefinitionNode(node) {
      return node.kind === _kinds.Kind.OPERATION_DEFINITION || node.kind === _kinds.Kind.FRAGMENT_DEFINITION;
    }
    function isSelectionNode(node) {
      return node.kind === _kinds.Kind.FIELD || node.kind === _kinds.Kind.FRAGMENT_SPREAD || node.kind === _kinds.Kind.INLINE_FRAGMENT;
    }
    function isValueNode(node) {
      return node.kind === _kinds.Kind.VARIABLE || node.kind === _kinds.Kind.INT || node.kind === _kinds.Kind.FLOAT || node.kind === _kinds.Kind.STRING || node.kind === _kinds.Kind.BOOLEAN || node.kind === _kinds.Kind.NULL || node.kind === _kinds.Kind.ENUM || node.kind === _kinds.Kind.LIST || node.kind === _kinds.Kind.OBJECT;
    }
    function isTypeNode(node) {
      return node.kind === _kinds.Kind.NAMED_TYPE || node.kind === _kinds.Kind.LIST_TYPE || node.kind === _kinds.Kind.NON_NULL_TYPE;
    }
    function isTypeSystemDefinitionNode(node) {
      return node.kind === _kinds.Kind.SCHEMA_DEFINITION || isTypeDefinitionNode(node) || node.kind === _kinds.Kind.DIRECTIVE_DEFINITION;
    }
    function isTypeDefinitionNode(node) {
      return node.kind === _kinds.Kind.SCALAR_TYPE_DEFINITION || node.kind === _kinds.Kind.OBJECT_TYPE_DEFINITION || node.kind === _kinds.Kind.INTERFACE_TYPE_DEFINITION || node.kind === _kinds.Kind.UNION_TYPE_DEFINITION || node.kind === _kinds.Kind.ENUM_TYPE_DEFINITION || node.kind === _kinds.Kind.INPUT_OBJECT_TYPE_DEFINITION;
    }
    function isTypeSystemExtensionNode(node) {
      return node.kind === _kinds.Kind.SCHEMA_EXTENSION || isTypeExtensionNode(node);
    }
    function isTypeExtensionNode(node) {
      return node.kind === _kinds.Kind.SCALAR_TYPE_EXTENSION || node.kind === _kinds.Kind.OBJECT_TYPE_EXTENSION || node.kind === _kinds.Kind.INTERFACE_TYPE_EXTENSION || node.kind === _kinds.Kind.UNION_TYPE_EXTENSION || node.kind === _kinds.Kind.ENUM_TYPE_EXTENSION || node.kind === _kinds.Kind.INPUT_OBJECT_TYPE_EXTENSION;
    }
  }
});

// ../api/node_modules/graphql/validation/rules/ExecutableDefinitions.js
var require_ExecutableDefinitions = __commonJS({
  "../api/node_modules/graphql/validation/rules/ExecutableDefinitions.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", {
      value: true
    });
    exports.nonExecutableDefinitionMessage = nonExecutableDefinitionMessage;
    exports.ExecutableDefinitions = ExecutableDefinitions;
    var _GraphQLError = require_GraphQLError();
    var _kinds = require_kinds();
    var _predicates = require_predicates();
    function nonExecutableDefinitionMessage(defName) {
      return "The ".concat(defName, " definition is not executable.");
    }
    function ExecutableDefinitions(context) {
      return {
        Document: function Document(node) {
          for (var _i2 = 0, _node$definitions2 = node.definitions; _i2 < _node$definitions2.length; _i2++) {
            var definition = _node$definitions2[_i2];
            if (!(0, _predicates.isExecutableDefinitionNode)(definition)) {
              context.reportError(new _GraphQLError.GraphQLError(nonExecutableDefinitionMessage(definition.kind === _kinds.Kind.SCHEMA_DEFINITION || definition.kind === _kinds.Kind.SCHEMA_EXTENSION ? "schema" : definition.name.value), definition));
            }
          }
          return false;
        }
      };
    }
  }
});

// ../api/node_modules/graphql/validation/rules/UniqueOperationNames.js
var require_UniqueOperationNames = __commonJS({
  "../api/node_modules/graphql/validation/rules/UniqueOperationNames.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", {
      value: true
    });
    exports.duplicateOperationNameMessage = duplicateOperationNameMessage;
    exports.UniqueOperationNames = UniqueOperationNames;
    var _GraphQLError = require_GraphQLError();
    function duplicateOperationNameMessage(operationName) {
      return 'There can be only one operation named "'.concat(operationName, '".');
    }
    function UniqueOperationNames(context) {
      var knownOperationNames = /* @__PURE__ */ Object.create(null);
      return {
        OperationDefinition: function OperationDefinition(node) {
          var operationName = node.name;
          if (operationName) {
            if (knownOperationNames[operationName.value]) {
              context.reportError(new _GraphQLError.GraphQLError(duplicateOperationNameMessage(operationName.value), [knownOperationNames[operationName.value], operationName]));
            } else {
              knownOperationNames[operationName.value] = operationName;
            }
          }
          return false;
        },
        FragmentDefinition: function FragmentDefinition() {
          return false;
        }
      };
    }
  }
});

// ../api/node_modules/graphql/validation/rules/LoneAnonymousOperation.js
var require_LoneAnonymousOperation = __commonJS({
  "../api/node_modules/graphql/validation/rules/LoneAnonymousOperation.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", {
      value: true
    });
    exports.anonOperationNotAloneMessage = anonOperationNotAloneMessage;
    exports.LoneAnonymousOperation = LoneAnonymousOperation;
    var _GraphQLError = require_GraphQLError();
    var _kinds = require_kinds();
    function anonOperationNotAloneMessage() {
      return "This anonymous operation must be the only defined operation.";
    }
    function LoneAnonymousOperation(context) {
      var operationCount = 0;
      return {
        Document: function Document(node) {
          operationCount = node.definitions.filter(function(definition) {
            return definition.kind === _kinds.Kind.OPERATION_DEFINITION;
          }).length;
        },
        OperationDefinition: function OperationDefinition(node) {
          if (!node.name && operationCount > 1) {
            context.reportError(new _GraphQLError.GraphQLError(anonOperationNotAloneMessage(), node));
          }
        }
      };
    }
  }
});

// ../api/node_modules/graphql/validation/rules/SingleFieldSubscriptions.js
var require_SingleFieldSubscriptions = __commonJS({
  "../api/node_modules/graphql/validation/rules/SingleFieldSubscriptions.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", {
      value: true
    });
    exports.singleFieldOnlyMessage = singleFieldOnlyMessage;
    exports.SingleFieldSubscriptions = SingleFieldSubscriptions;
    var _GraphQLError = require_GraphQLError();
    function singleFieldOnlyMessage(name) {
      return name ? 'Subscription "'.concat(name, '" must select only one top level field.') : "Anonymous Subscription must select only one top level field.";
    }
    function SingleFieldSubscriptions(context) {
      return {
        OperationDefinition: function OperationDefinition(node) {
          if (node.operation === "subscription") {
            if (node.selectionSet.selections.length !== 1) {
              context.reportError(new _GraphQLError.GraphQLError(singleFieldOnlyMessage(node.name && node.name.value), node.selectionSet.selections.slice(1)));
            }
          }
        }
      };
    }
  }
});

// ../api/node_modules/graphql/jsutils/didYouMean.js
var require_didYouMean = __commonJS({
  "../api/node_modules/graphql/jsutils/didYouMean.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", {
      value: true
    });
    exports.default = didYouMean;
    var MAX_SUGGESTIONS = 5;
    function didYouMean(firstArg, secondArg) {
      var _ref = typeof firstArg === "string" ? [firstArg, secondArg] : [void 0, firstArg], subMessage = _ref[0], suggestions = _ref[1];
      var message = " Did you mean ";
      if (subMessage) {
        message += subMessage + " ";
      }
      switch (suggestions.length) {
        case 0:
          return "";
        case 1:
          return message + suggestions[0] + "?";
        case 2:
          return message + suggestions[0] + " or " + suggestions[1] + "?";
      }
      var selected = suggestions.slice(0, MAX_SUGGESTIONS);
      var lastItem = selected.pop();
      return message + selected.join(", ") + ", or " + lastItem + "?";
    }
  }
});

// ../api/node_modules/graphql/jsutils/suggestionList.js
var require_suggestionList = __commonJS({
  "../api/node_modules/graphql/jsutils/suggestionList.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", {
      value: true
    });
    exports.default = suggestionList;
    function suggestionList(input, options) {
      var optionsByDistance = /* @__PURE__ */ Object.create(null);
      var inputThreshold = input.length / 2;
      for (var _i2 = 0; _i2 < options.length; _i2++) {
        var option = options[_i2];
        var distance = lexicalDistance(input, option);
        var threshold = Math.max(inputThreshold, option.length / 2, 1);
        if (distance <= threshold) {
          optionsByDistance[option] = distance;
        }
      }
      return Object.keys(optionsByDistance).sort(function(a, b) {
        return optionsByDistance[a] - optionsByDistance[b];
      });
    }
    function lexicalDistance(aStr, bStr) {
      if (aStr === bStr) {
        return 0;
      }
      var d = [];
      var a = aStr.toLowerCase();
      var b = bStr.toLowerCase();
      var aLength = a.length;
      var bLength = b.length;
      if (a === b) {
        return 1;
      }
      for (var i = 0; i <= aLength; i++) {
        d[i] = [i];
      }
      for (var j = 1; j <= bLength; j++) {
        d[0][j] = j;
      }
      for (var _i3 = 1; _i3 <= aLength; _i3++) {
        for (var _j = 1; _j <= bLength; _j++) {
          var cost = a[_i3 - 1] === b[_j - 1] ? 0 : 1;
          d[_i3][_j] = Math.min(d[_i3 - 1][_j] + 1, d[_i3][_j - 1] + 1, d[_i3 - 1][_j - 1] + cost);
          if (_i3 > 1 && _j > 1 && a[_i3 - 1] === b[_j - 2] && a[_i3 - 2] === b[_j - 1]) {
            d[_i3][_j] = Math.min(d[_i3][_j], d[_i3 - 2][_j - 2] + cost);
          }
        }
      }
      return d[aLength][bLength];
    }
  }
});

// ../api/node_modules/graphql/validation/rules/KnownTypeNames.js
var require_KnownTypeNames = __commonJS({
  "../api/node_modules/graphql/validation/rules/KnownTypeNames.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", {
      value: true
    });
    exports.unknownTypeMessage = unknownTypeMessage;
    exports.KnownTypeNames = KnownTypeNames;
    var _didYouMean = _interopRequireDefault(require_didYouMean());
    var _suggestionList = _interopRequireDefault(require_suggestionList());
    var _GraphQLError = require_GraphQLError();
    var _predicates = require_predicates();
    var _scalars = require_scalars();
    function _interopRequireDefault(obj) {
      return obj && obj.__esModule ? obj : { default: obj };
    }
    function unknownTypeMessage(typeName, suggestedTypes) {
      return 'Unknown type "'.concat(typeName, '".') + (0, _didYouMean.default)(suggestedTypes.map(function(x) {
        return '"'.concat(x, '"');
      }));
    }
    function KnownTypeNames(context) {
      var schema = context.getSchema();
      var existingTypesMap = schema ? schema.getTypeMap() : /* @__PURE__ */ Object.create(null);
      var definedTypes = /* @__PURE__ */ Object.create(null);
      for (var _i2 = 0, _context$getDocument$2 = context.getDocument().definitions; _i2 < _context$getDocument$2.length; _i2++) {
        var def = _context$getDocument$2[_i2];
        if ((0, _predicates.isTypeDefinitionNode)(def)) {
          definedTypes[def.name.value] = true;
        }
      }
      var typeNames = Object.keys(existingTypesMap).concat(Object.keys(definedTypes));
      return {
        NamedType: function NamedType(node, _1, parent, _2, ancestors) {
          var typeName = node.name.value;
          if (!existingTypesMap[typeName] && !definedTypes[typeName]) {
            var definitionNode = ancestors[2] || parent;
            var isSDL = isSDLNode(definitionNode);
            if (isSDL && isSpecifiedScalarName(typeName)) {
              return;
            }
            var suggestedTypes = (0, _suggestionList.default)(typeName, isSDL ? specifiedScalarsNames.concat(typeNames) : typeNames);
            context.reportError(new _GraphQLError.GraphQLError(unknownTypeMessage(typeName, suggestedTypes), node));
          }
        }
      };
    }
    var specifiedScalarsNames = _scalars.specifiedScalarTypes.map(function(type) {
      return type.name;
    });
    function isSpecifiedScalarName(typeName) {
      return specifiedScalarsNames.indexOf(typeName) !== -1;
    }
    function isSDLNode(value) {
      return Boolean(value && !Array.isArray(value) && ((0, _predicates.isTypeSystemDefinitionNode)(value) || (0, _predicates.isTypeSystemExtensionNode)(value)));
    }
  }
});

// ../api/node_modules/graphql/validation/rules/FragmentsOnCompositeTypes.js
var require_FragmentsOnCompositeTypes = __commonJS({
  "../api/node_modules/graphql/validation/rules/FragmentsOnCompositeTypes.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", {
      value: true
    });
    exports.inlineFragmentOnNonCompositeErrorMessage = inlineFragmentOnNonCompositeErrorMessage;
    exports.fragmentOnNonCompositeErrorMessage = fragmentOnNonCompositeErrorMessage;
    exports.FragmentsOnCompositeTypes = FragmentsOnCompositeTypes;
    var _GraphQLError = require_GraphQLError();
    var _printer = require_printer();
    var _definition = require_definition();
    var _typeFromAST = require_typeFromAST();
    function inlineFragmentOnNonCompositeErrorMessage(type) {
      return 'Fragment cannot condition on non composite type "'.concat(type, '".');
    }
    function fragmentOnNonCompositeErrorMessage(fragName, type) {
      return 'Fragment "'.concat(fragName, '" cannot condition on non composite type "').concat(type, '".');
    }
    function FragmentsOnCompositeTypes(context) {
      return {
        InlineFragment: function InlineFragment(node) {
          var typeCondition = node.typeCondition;
          if (typeCondition) {
            var type = (0, _typeFromAST.typeFromAST)(context.getSchema(), typeCondition);
            if (type && !(0, _definition.isCompositeType)(type)) {
              context.reportError(new _GraphQLError.GraphQLError(inlineFragmentOnNonCompositeErrorMessage((0, _printer.print)(typeCondition)), typeCondition));
            }
          }
        },
        FragmentDefinition: function FragmentDefinition(node) {
          var type = (0, _typeFromAST.typeFromAST)(context.getSchema(), node.typeCondition);
          if (type && !(0, _definition.isCompositeType)(type)) {
            context.reportError(new _GraphQLError.GraphQLError(fragmentOnNonCompositeErrorMessage(node.name.value, (0, _printer.print)(node.typeCondition)), node.typeCondition));
          }
        }
      };
    }
  }
});

// ../api/node_modules/graphql/validation/rules/VariablesAreInputTypes.js
var require_VariablesAreInputTypes = __commonJS({
  "../api/node_modules/graphql/validation/rules/VariablesAreInputTypes.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", {
      value: true
    });
    exports.nonInputTypeOnVarMessage = nonInputTypeOnVarMessage;
    exports.VariablesAreInputTypes = VariablesAreInputTypes;
    var _GraphQLError = require_GraphQLError();
    var _printer = require_printer();
    var _definition = require_definition();
    var _typeFromAST = require_typeFromAST();
    function nonInputTypeOnVarMessage(variableName, typeName) {
      return 'Variable "$'.concat(variableName, '" cannot be non-input type "').concat(typeName, '".');
    }
    function VariablesAreInputTypes(context) {
      return {
        VariableDefinition: function VariableDefinition(node) {
          var type = (0, _typeFromAST.typeFromAST)(context.getSchema(), node.type);
          if (type && !(0, _definition.isInputType)(type)) {
            var variableName = node.variable.name.value;
            context.reportError(new _GraphQLError.GraphQLError(nonInputTypeOnVarMessage(variableName, (0, _printer.print)(node.type)), node.type));
          }
        }
      };
    }
  }
});

// ../api/node_modules/graphql/validation/rules/ScalarLeafs.js
var require_ScalarLeafs = __commonJS({
  "../api/node_modules/graphql/validation/rules/ScalarLeafs.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", {
      value: true
    });
    exports.noSubselectionAllowedMessage = noSubselectionAllowedMessage;
    exports.requiredSubselectionMessage = requiredSubselectionMessage;
    exports.ScalarLeafs = ScalarLeafs;
    var _inspect = _interopRequireDefault(require_inspect());
    var _GraphQLError = require_GraphQLError();
    var _definition = require_definition();
    function _interopRequireDefault(obj) {
      return obj && obj.__esModule ? obj : { default: obj };
    }
    function noSubselectionAllowedMessage(fieldName, type) {
      return 'Field "'.concat(fieldName, '" must not have a selection since type "').concat(type, '" has no subfields.');
    }
    function requiredSubselectionMessage(fieldName, type) {
      return 'Field "'.concat(fieldName, '" of type "').concat(type, '" must have a selection of subfields. Did you mean "').concat(fieldName, ' { ... }"?');
    }
    function ScalarLeafs(context) {
      return {
        Field: function Field(node) {
          var type = context.getType();
          var selectionSet = node.selectionSet;
          if (type) {
            if ((0, _definition.isLeafType)((0, _definition.getNamedType)(type))) {
              if (selectionSet) {
                context.reportError(new _GraphQLError.GraphQLError(noSubselectionAllowedMessage(node.name.value, (0, _inspect.default)(type)), selectionSet));
              }
            } else if (!selectionSet) {
              context.reportError(new _GraphQLError.GraphQLError(requiredSubselectionMessage(node.name.value, (0, _inspect.default)(type)), node));
            }
          }
        }
      };
    }
  }
});

// ../api/node_modules/graphql/validation/rules/FieldsOnCorrectType.js
var require_FieldsOnCorrectType = __commonJS({
  "../api/node_modules/graphql/validation/rules/FieldsOnCorrectType.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", {
      value: true
    });
    exports.undefinedFieldMessage = undefinedFieldMessage;
    exports.FieldsOnCorrectType = FieldsOnCorrectType;
    var _didYouMean = _interopRequireDefault(require_didYouMean());
    var _suggestionList = _interopRequireDefault(require_suggestionList());
    var _GraphQLError = require_GraphQLError();
    var _definition = require_definition();
    function _interopRequireDefault(obj) {
      return obj && obj.__esModule ? obj : { default: obj };
    }
    function undefinedFieldMessage(fieldName, type, suggestedTypeNames, suggestedFieldNames) {
      var quotedTypeNames = suggestedTypeNames.map(function(x) {
        return '"'.concat(x, '"');
      });
      var quotedFieldNames = suggestedFieldNames.map(function(x) {
        return '"'.concat(x, '"');
      });
      return 'Cannot query field "'.concat(fieldName, '" on type "').concat(type, '".') + ((0, _didYouMean.default)("to use an inline fragment on", quotedTypeNames) || (0, _didYouMean.default)(quotedFieldNames));
    }
    function FieldsOnCorrectType(context) {
      return {
        Field: function Field(node) {
          var type = context.getParentType();
          if (type) {
            var fieldDef = context.getFieldDef();
            if (!fieldDef) {
              var schema = context.getSchema();
              var fieldName = node.name.value;
              var suggestedTypeNames = getSuggestedTypeNames(schema, type, fieldName);
              var suggestedFieldNames = suggestedTypeNames.length !== 0 ? [] : getSuggestedFieldNames(schema, type, fieldName);
              context.reportError(new _GraphQLError.GraphQLError(undefinedFieldMessage(fieldName, type.name, suggestedTypeNames, suggestedFieldNames), node));
            }
          }
        }
      };
    }
    function getSuggestedTypeNames(schema, type, fieldName) {
      if ((0, _definition.isAbstractType)(type)) {
        var suggestedObjectTypes = [];
        var interfaceUsageCount = /* @__PURE__ */ Object.create(null);
        for (var _i2 = 0, _schema$getPossibleTy2 = schema.getPossibleTypes(type); _i2 < _schema$getPossibleTy2.length; _i2++) {
          var possibleType = _schema$getPossibleTy2[_i2];
          if (!possibleType.getFields()[fieldName]) {
            continue;
          }
          suggestedObjectTypes.push(possibleType.name);
          for (var _i4 = 0, _possibleType$getInte2 = possibleType.getInterfaces(); _i4 < _possibleType$getInte2.length; _i4++) {
            var possibleInterface = _possibleType$getInte2[_i4];
            if (!possibleInterface.getFields()[fieldName]) {
              continue;
            }
            interfaceUsageCount[possibleInterface.name] = (interfaceUsageCount[possibleInterface.name] || 0) + 1;
          }
        }
        var suggestedInterfaceTypes = Object.keys(interfaceUsageCount).sort(function(a, b) {
          return interfaceUsageCount[b] - interfaceUsageCount[a];
        });
        return suggestedInterfaceTypes.concat(suggestedObjectTypes);
      }
      return [];
    }
    function getSuggestedFieldNames(schema, type, fieldName) {
      if ((0, _definition.isObjectType)(type) || (0, _definition.isInterfaceType)(type)) {
        var possibleFieldNames = Object.keys(type.getFields());
        return (0, _suggestionList.default)(fieldName, possibleFieldNames);
      }
      return [];
    }
  }
});

// ../api/node_modules/graphql/validation/rules/UniqueFragmentNames.js
var require_UniqueFragmentNames = __commonJS({
  "../api/node_modules/graphql/validation/rules/UniqueFragmentNames.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", {
      value: true
    });
    exports.duplicateFragmentNameMessage = duplicateFragmentNameMessage;
    exports.UniqueFragmentNames = UniqueFragmentNames;
    var _GraphQLError = require_GraphQLError();
    function duplicateFragmentNameMessage(fragName) {
      return 'There can be only one fragment named "'.concat(fragName, '".');
    }
    function UniqueFragmentNames(context) {
      var knownFragmentNames = /* @__PURE__ */ Object.create(null);
      return {
        OperationDefinition: function OperationDefinition() {
          return false;
        },
        FragmentDefinition: function FragmentDefinition(node) {
          var fragmentName = node.name.value;
          if (knownFragmentNames[fragmentName]) {
            context.reportError(new _GraphQLError.GraphQLError(duplicateFragmentNameMessage(fragmentName), [knownFragmentNames[fragmentName], node.name]));
          } else {
            knownFragmentNames[fragmentName] = node.name;
          }
          return false;
        }
      };
    }
  }
});

// ../api/node_modules/graphql/validation/rules/KnownFragmentNames.js
var require_KnownFragmentNames = __commonJS({
  "../api/node_modules/graphql/validation/rules/KnownFragmentNames.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", {
      value: true
    });
    exports.unknownFragmentMessage = unknownFragmentMessage;
    exports.KnownFragmentNames = KnownFragmentNames;
    var _GraphQLError = require_GraphQLError();
    function unknownFragmentMessage(fragName) {
      return 'Unknown fragment "'.concat(fragName, '".');
    }
    function KnownFragmentNames(context) {
      return {
        FragmentSpread: function FragmentSpread(node) {
          var fragmentName = node.name.value;
          var fragment = context.getFragment(fragmentName);
          if (!fragment) {
            context.reportError(new _GraphQLError.GraphQLError(unknownFragmentMessage(fragmentName), node.name));
          }
        }
      };
    }
  }
});

// ../api/node_modules/graphql/validation/rules/NoUnusedFragments.js
var require_NoUnusedFragments = __commonJS({
  "../api/node_modules/graphql/validation/rules/NoUnusedFragments.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", {
      value: true
    });
    exports.unusedFragMessage = unusedFragMessage;
    exports.NoUnusedFragments = NoUnusedFragments;
    var _GraphQLError = require_GraphQLError();
    function unusedFragMessage(fragName) {
      return 'Fragment "'.concat(fragName, '" is never used.');
    }
    function NoUnusedFragments(context) {
      var operationDefs = [];
      var fragmentDefs = [];
      return {
        OperationDefinition: function OperationDefinition(node) {
          operationDefs.push(node);
          return false;
        },
        FragmentDefinition: function FragmentDefinition(node) {
          fragmentDefs.push(node);
          return false;
        },
        Document: {
          leave: function leave() {
            var fragmentNameUsed = /* @__PURE__ */ Object.create(null);
            for (var _i2 = 0; _i2 < operationDefs.length; _i2++) {
              var operation = operationDefs[_i2];
              for (var _i4 = 0, _context$getRecursive2 = context.getRecursivelyReferencedFragments(operation); _i4 < _context$getRecursive2.length; _i4++) {
                var fragment = _context$getRecursive2[_i4];
                fragmentNameUsed[fragment.name.value] = true;
              }
            }
            for (var _i6 = 0; _i6 < fragmentDefs.length; _i6++) {
              var fragmentDef = fragmentDefs[_i6];
              var fragName = fragmentDef.name.value;
              if (fragmentNameUsed[fragName] !== true) {
                context.reportError(new _GraphQLError.GraphQLError(unusedFragMessage(fragName), fragmentDef));
              }
            }
          }
        }
      };
    }
  }
});

// ../api/node_modules/graphql/validation/rules/PossibleFragmentSpreads.js
var require_PossibleFragmentSpreads = __commonJS({
  "../api/node_modules/graphql/validation/rules/PossibleFragmentSpreads.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", {
      value: true
    });
    exports.typeIncompatibleSpreadMessage = typeIncompatibleSpreadMessage;
    exports.typeIncompatibleAnonSpreadMessage = typeIncompatibleAnonSpreadMessage;
    exports.PossibleFragmentSpreads = PossibleFragmentSpreads;
    var _inspect = _interopRequireDefault(require_inspect());
    var _GraphQLError = require_GraphQLError();
    var _definition = require_definition();
    var _typeFromAST = require_typeFromAST();
    var _typeComparators = require_typeComparators();
    function _interopRequireDefault(obj) {
      return obj && obj.__esModule ? obj : { default: obj };
    }
    function typeIncompatibleSpreadMessage(fragName, parentType, fragType) {
      return 'Fragment "'.concat(fragName, '" cannot be spread here as objects of type "').concat(parentType, '" can never be of type "').concat(fragType, '".');
    }
    function typeIncompatibleAnonSpreadMessage(parentType, fragType) {
      return 'Fragment cannot be spread here as objects of type "'.concat(parentType, '" can never be of type "').concat(fragType, '".');
    }
    function PossibleFragmentSpreads(context) {
      return {
        InlineFragment: function InlineFragment(node) {
          var fragType = context.getType();
          var parentType = context.getParentType();
          if ((0, _definition.isCompositeType)(fragType) && (0, _definition.isCompositeType)(parentType) && !(0, _typeComparators.doTypesOverlap)(context.getSchema(), fragType, parentType)) {
            context.reportError(new _GraphQLError.GraphQLError(typeIncompatibleAnonSpreadMessage((0, _inspect.default)(parentType), (0, _inspect.default)(fragType)), node));
          }
        },
        FragmentSpread: function FragmentSpread(node) {
          var fragName = node.name.value;
          var fragType = getFragmentType(context, fragName);
          var parentType = context.getParentType();
          if (fragType && parentType && !(0, _typeComparators.doTypesOverlap)(context.getSchema(), fragType, parentType)) {
            context.reportError(new _GraphQLError.GraphQLError(typeIncompatibleSpreadMessage(fragName, (0, _inspect.default)(parentType), (0, _inspect.default)(fragType)), node));
          }
        }
      };
    }
    function getFragmentType(context, name) {
      var frag = context.getFragment(name);
      if (frag) {
        var type = (0, _typeFromAST.typeFromAST)(context.getSchema(), frag.typeCondition);
        if ((0, _definition.isCompositeType)(type)) {
          return type;
        }
      }
    }
  }
});

// ../api/node_modules/graphql/validation/rules/NoFragmentCycles.js
var require_NoFragmentCycles = __commonJS({
  "../api/node_modules/graphql/validation/rules/NoFragmentCycles.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", {
      value: true
    });
    exports.cycleErrorMessage = cycleErrorMessage;
    exports.NoFragmentCycles = NoFragmentCycles;
    var _GraphQLError = require_GraphQLError();
    function cycleErrorMessage(fragName, spreadNames) {
      var via = spreadNames.length ? " via " + spreadNames.join(", ") : "";
      return 'Cannot spread fragment "'.concat(fragName, '" within itself').concat(via, ".");
    }
    function NoFragmentCycles(context) {
      var visitedFrags = /* @__PURE__ */ Object.create(null);
      var spreadPath = [];
      var spreadPathIndexByName = /* @__PURE__ */ Object.create(null);
      return {
        OperationDefinition: function OperationDefinition() {
          return false;
        },
        FragmentDefinition: function FragmentDefinition(node) {
          detectCycleRecursive(node);
          return false;
        }
      };
      function detectCycleRecursive(fragment) {
        if (visitedFrags[fragment.name.value]) {
          return;
        }
        var fragmentName = fragment.name.value;
        visitedFrags[fragmentName] = true;
        var spreadNodes = context.getFragmentSpreads(fragment.selectionSet);
        if (spreadNodes.length === 0) {
          return;
        }
        spreadPathIndexByName[fragmentName] = spreadPath.length;
        for (var _i2 = 0; _i2 < spreadNodes.length; _i2++) {
          var spreadNode = spreadNodes[_i2];
          var spreadName = spreadNode.name.value;
          var cycleIndex = spreadPathIndexByName[spreadName];
          spreadPath.push(spreadNode);
          if (cycleIndex === void 0) {
            var spreadFragment = context.getFragment(spreadName);
            if (spreadFragment) {
              detectCycleRecursive(spreadFragment);
            }
          } else {
            var cyclePath = spreadPath.slice(cycleIndex);
            var fragmentNames = cyclePath.slice(0, -1).map(function(s) {
              return s.name.value;
            });
            context.reportError(new _GraphQLError.GraphQLError(cycleErrorMessage(spreadName, fragmentNames), cyclePath));
          }
          spreadPath.pop();
        }
        spreadPathIndexByName[fragmentName] = void 0;
      }
    }
  }
});

// ../api/node_modules/graphql/validation/rules/UniqueVariableNames.js
var require_UniqueVariableNames = __commonJS({
  "../api/node_modules/graphql/validation/rules/UniqueVariableNames.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", {
      value: true
    });
    exports.duplicateVariableMessage = duplicateVariableMessage;
    exports.UniqueVariableNames = UniqueVariableNames;
    var _GraphQLError = require_GraphQLError();
    function duplicateVariableMessage(variableName) {
      return 'There can be only one variable named "'.concat(variableName, '".');
    }
    function UniqueVariableNames(context) {
      var knownVariableNames = /* @__PURE__ */ Object.create(null);
      return {
        OperationDefinition: function OperationDefinition() {
          knownVariableNames = /* @__PURE__ */ Object.create(null);
        },
        VariableDefinition: function VariableDefinition(node) {
          var variableName = node.variable.name.value;
          if (knownVariableNames[variableName]) {
            context.reportError(new _GraphQLError.GraphQLError(duplicateVariableMessage(variableName), [knownVariableNames[variableName], node.variable.name]));
          } else {
            knownVariableNames[variableName] = node.variable.name;
          }
        }
      };
    }
  }
});

// ../api/node_modules/graphql/validation/rules/NoUndefinedVariables.js
var require_NoUndefinedVariables = __commonJS({
  "../api/node_modules/graphql/validation/rules/NoUndefinedVariables.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", {
      value: true
    });
    exports.undefinedVarMessage = undefinedVarMessage;
    exports.NoUndefinedVariables = NoUndefinedVariables;
    var _GraphQLError = require_GraphQLError();
    function undefinedVarMessage(varName, opName) {
      return opName ? 'Variable "$'.concat(varName, '" is not defined by operation "').concat(opName, '".') : 'Variable "$'.concat(varName, '" is not defined.');
    }
    function NoUndefinedVariables(context) {
      var variableNameDefined = /* @__PURE__ */ Object.create(null);
      return {
        OperationDefinition: {
          enter: function enter() {
            variableNameDefined = /* @__PURE__ */ Object.create(null);
          },
          leave: function leave(operation) {
            var usages = context.getRecursiveVariableUsages(operation);
            for (var _i2 = 0; _i2 < usages.length; _i2++) {
              var _ref2 = usages[_i2];
              var node = _ref2.node;
              var varName = node.name.value;
              if (variableNameDefined[varName] !== true) {
                context.reportError(new _GraphQLError.GraphQLError(undefinedVarMessage(varName, operation.name && operation.name.value), [node, operation]));
              }
            }
          }
        },
        VariableDefinition: function VariableDefinition(node) {
          variableNameDefined[node.variable.name.value] = true;
        }
      };
    }
  }
});

// ../api/node_modules/graphql/validation/rules/NoUnusedVariables.js
var require_NoUnusedVariables = __commonJS({
  "../api/node_modules/graphql/validation/rules/NoUnusedVariables.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", {
      value: true
    });
    exports.unusedVariableMessage = unusedVariableMessage;
    exports.NoUnusedVariables = NoUnusedVariables;
    var _GraphQLError = require_GraphQLError();
    function unusedVariableMessage(varName, opName) {
      return opName ? 'Variable "$'.concat(varName, '" is never used in operation "').concat(opName, '".') : 'Variable "$'.concat(varName, '" is never used.');
    }
    function NoUnusedVariables(context) {
      var variableDefs = [];
      return {
        OperationDefinition: {
          enter: function enter() {
            variableDefs = [];
          },
          leave: function leave(operation) {
            var variableNameUsed = /* @__PURE__ */ Object.create(null);
            var usages = context.getRecursiveVariableUsages(operation);
            var opName = operation.name ? operation.name.value : null;
            for (var _i2 = 0; _i2 < usages.length; _i2++) {
              var _ref2 = usages[_i2];
              var node = _ref2.node;
              variableNameUsed[node.name.value] = true;
            }
            for (var _i4 = 0, _variableDefs2 = variableDefs; _i4 < _variableDefs2.length; _i4++) {
              var variableDef = _variableDefs2[_i4];
              var variableName = variableDef.variable.name.value;
              if (variableNameUsed[variableName] !== true) {
                context.reportError(new _GraphQLError.GraphQLError(unusedVariableMessage(variableName, opName), variableDef));
              }
            }
          }
        },
        VariableDefinition: function VariableDefinition(def) {
          variableDefs.push(def);
        }
      };
    }
  }
});

// ../api/node_modules/graphql/validation/rules/KnownDirectives.js
var require_KnownDirectives = __commonJS({
  "../api/node_modules/graphql/validation/rules/KnownDirectives.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", {
      value: true
    });
    exports.unknownDirectiveMessage = unknownDirectiveMessage;
    exports.misplacedDirectiveMessage = misplacedDirectiveMessage;
    exports.KnownDirectives = KnownDirectives;
    var _GraphQLError = require_GraphQLError();
    var _kinds = require_kinds();
    var _directiveLocation = require_directiveLocation();
    var _directives = require_directives();
    function unknownDirectiveMessage(directiveName) {
      return 'Unknown directive "'.concat(directiveName, '".');
    }
    function misplacedDirectiveMessage(directiveName, location) {
      return 'Directive "'.concat(directiveName, '" may not be used on ').concat(location, ".");
    }
    function KnownDirectives(context) {
      var locationsMap = /* @__PURE__ */ Object.create(null);
      var schema = context.getSchema();
      var definedDirectives = schema ? schema.getDirectives() : _directives.specifiedDirectives;
      for (var _i2 = 0; _i2 < definedDirectives.length; _i2++) {
        var directive = definedDirectives[_i2];
        locationsMap[directive.name] = directive.locations;
      }
      var astDefinitions = context.getDocument().definitions;
      for (var _i4 = 0; _i4 < astDefinitions.length; _i4++) {
        var def = astDefinitions[_i4];
        if (def.kind === _kinds.Kind.DIRECTIVE_DEFINITION) {
          locationsMap[def.name.value] = def.locations.map(function(name) {
            return name.value;
          });
        }
      }
      return {
        Directive: function Directive(node, key, parent, path, ancestors) {
          var name = node.name.value;
          var locations = locationsMap[name];
          if (!locations) {
            context.reportError(new _GraphQLError.GraphQLError(unknownDirectiveMessage(name), node));
            return;
          }
          var candidateLocation = getDirectiveLocationForASTPath(ancestors);
          if (candidateLocation && locations.indexOf(candidateLocation) === -1) {
            context.reportError(new _GraphQLError.GraphQLError(misplacedDirectiveMessage(name, candidateLocation), node));
          }
        }
      };
    }
    function getDirectiveLocationForASTPath(ancestors) {
      var appliedTo = ancestors[ancestors.length - 1];
      if (!Array.isArray(appliedTo)) {
        switch (appliedTo.kind) {
          case _kinds.Kind.OPERATION_DEFINITION:
            switch (appliedTo.operation) {
              case "query":
                return _directiveLocation.DirectiveLocation.QUERY;
              case "mutation":
                return _directiveLocation.DirectiveLocation.MUTATION;
              case "subscription":
                return _directiveLocation.DirectiveLocation.SUBSCRIPTION;
            }
            break;
          case _kinds.Kind.FIELD:
            return _directiveLocation.DirectiveLocation.FIELD;
          case _kinds.Kind.FRAGMENT_SPREAD:
            return _directiveLocation.DirectiveLocation.FRAGMENT_SPREAD;
          case _kinds.Kind.INLINE_FRAGMENT:
            return _directiveLocation.DirectiveLocation.INLINE_FRAGMENT;
          case _kinds.Kind.FRAGMENT_DEFINITION:
            return _directiveLocation.DirectiveLocation.FRAGMENT_DEFINITION;
          case _kinds.Kind.VARIABLE_DEFINITION:
            return _directiveLocation.DirectiveLocation.VARIABLE_DEFINITION;
          case _kinds.Kind.SCHEMA_DEFINITION:
          case _kinds.Kind.SCHEMA_EXTENSION:
            return _directiveLocation.DirectiveLocation.SCHEMA;
          case _kinds.Kind.SCALAR_TYPE_DEFINITION:
          case _kinds.Kind.SCALAR_TYPE_EXTENSION:
            return _directiveLocation.DirectiveLocation.SCALAR;
          case _kinds.Kind.OBJECT_TYPE_DEFINITION:
          case _kinds.Kind.OBJECT_TYPE_EXTENSION:
            return _directiveLocation.DirectiveLocation.OBJECT;
          case _kinds.Kind.FIELD_DEFINITION:
            return _directiveLocation.DirectiveLocation.FIELD_DEFINITION;
          case _kinds.Kind.INTERFACE_TYPE_DEFINITION:
          case _kinds.Kind.INTERFACE_TYPE_EXTENSION:
            return _directiveLocation.DirectiveLocation.INTERFACE;
          case _kinds.Kind.UNION_TYPE_DEFINITION:
          case _kinds.Kind.UNION_TYPE_EXTENSION:
            return _directiveLocation.DirectiveLocation.UNION;
          case _kinds.Kind.ENUM_TYPE_DEFINITION:
          case _kinds.Kind.ENUM_TYPE_EXTENSION:
            return _directiveLocation.DirectiveLocation.ENUM;
          case _kinds.Kind.ENUM_VALUE_DEFINITION:
            return _directiveLocation.DirectiveLocation.ENUM_VALUE;
          case _kinds.Kind.INPUT_OBJECT_TYPE_DEFINITION:
          case _kinds.Kind.INPUT_OBJECT_TYPE_EXTENSION:
            return _directiveLocation.DirectiveLocation.INPUT_OBJECT;
          case _kinds.Kind.INPUT_VALUE_DEFINITION: {
            var parentNode = ancestors[ancestors.length - 3];
            return parentNode.kind === _kinds.Kind.INPUT_OBJECT_TYPE_DEFINITION ? _directiveLocation.DirectiveLocation.INPUT_FIELD_DEFINITION : _directiveLocation.DirectiveLocation.ARGUMENT_DEFINITION;
          }
        }
      }
    }
  }
});

// ../api/node_modules/graphql/validation/rules/UniqueDirectivesPerLocation.js
var require_UniqueDirectivesPerLocation = __commonJS({
  "../api/node_modules/graphql/validation/rules/UniqueDirectivesPerLocation.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", {
      value: true
    });
    exports.duplicateDirectiveMessage = duplicateDirectiveMessage;
    exports.UniqueDirectivesPerLocation = UniqueDirectivesPerLocation;
    var _GraphQLError = require_GraphQLError();
    var _kinds = require_kinds();
    var _directives = require_directives();
    function duplicateDirectiveMessage(directiveName) {
      return 'The directive "'.concat(directiveName, '" can only be used once at this location.');
    }
    function UniqueDirectivesPerLocation(context) {
      var uniqueDirectiveMap = /* @__PURE__ */ Object.create(null);
      var schema = context.getSchema();
      var definedDirectives = schema ? schema.getDirectives() : _directives.specifiedDirectives;
      for (var _i2 = 0; _i2 < definedDirectives.length; _i2++) {
        var directive = definedDirectives[_i2];
        uniqueDirectiveMap[directive.name] = !directive.isRepeatable;
      }
      var astDefinitions = context.getDocument().definitions;
      for (var _i4 = 0; _i4 < astDefinitions.length; _i4++) {
        var def = astDefinitions[_i4];
        if (def.kind === _kinds.Kind.DIRECTIVE_DEFINITION) {
          uniqueDirectiveMap[def.name.value] = !def.repeatable;
        }
      }
      return {
        enter: function enter(node) {
          var directives = node.directives;
          if (directives) {
            var knownDirectives = /* @__PURE__ */ Object.create(null);
            for (var _i6 = 0; _i6 < directives.length; _i6++) {
              var _directive = directives[_i6];
              var directiveName = _directive.name.value;
              if (uniqueDirectiveMap[directiveName]) {
                if (knownDirectives[directiveName]) {
                  context.reportError(new _GraphQLError.GraphQLError(duplicateDirectiveMessage(directiveName), [knownDirectives[directiveName], _directive]));
                } else {
                  knownDirectives[directiveName] = _directive;
                }
              }
            }
          }
        }
      };
    }
  }
});

// ../api/node_modules/graphql/validation/rules/KnownArgumentNames.js
var require_KnownArgumentNames = __commonJS({
  "../api/node_modules/graphql/validation/rules/KnownArgumentNames.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", {
      value: true
    });
    exports.unknownArgMessage = unknownArgMessage;
    exports.unknownDirectiveArgMessage = unknownDirectiveArgMessage;
    exports.KnownArgumentNames = KnownArgumentNames;
    exports.KnownArgumentNamesOnDirectives = KnownArgumentNamesOnDirectives;
    var _didYouMean = _interopRequireDefault(require_didYouMean());
    var _suggestionList = _interopRequireDefault(require_suggestionList());
    var _GraphQLError = require_GraphQLError();
    var _kinds = require_kinds();
    var _directives = require_directives();
    function _interopRequireDefault(obj) {
      return obj && obj.__esModule ? obj : { default: obj };
    }
    function ownKeys(object, enumerableOnly) {
      var keys = Object.keys(object);
      if (Object.getOwnPropertySymbols) {
        var symbols = Object.getOwnPropertySymbols(object);
        if (enumerableOnly)
          symbols = symbols.filter(function(sym) {
            return Object.getOwnPropertyDescriptor(object, sym).enumerable;
          });
        keys.push.apply(keys, symbols);
      }
      return keys;
    }
    function _objectSpread(target) {
      for (var i = 1; i < arguments.length; i++) {
        var source = arguments[i] != null ? arguments[i] : {};
        if (i % 2) {
          ownKeys(source, true).forEach(function(key) {
            _defineProperty(target, key, source[key]);
          });
        } else if (Object.getOwnPropertyDescriptors) {
          Object.defineProperties(target, Object.getOwnPropertyDescriptors(source));
        } else {
          ownKeys(source).forEach(function(key) {
            Object.defineProperty(target, key, Object.getOwnPropertyDescriptor(source, key));
          });
        }
      }
      return target;
    }
    function _defineProperty(obj, key, value) {
      if (key in obj) {
        Object.defineProperty(obj, key, { value, enumerable: true, configurable: true, writable: true });
      } else {
        obj[key] = value;
      }
      return obj;
    }
    function unknownArgMessage(argName, fieldName, typeName, suggestedArgs) {
      return 'Unknown argument "'.concat(argName, '" on field "').concat(fieldName, '" of type "').concat(typeName, '".') + (0, _didYouMean.default)(suggestedArgs.map(function(x) {
        return '"'.concat(x, '"');
      }));
    }
    function unknownDirectiveArgMessage(argName, directiveName, suggestedArgs) {
      return 'Unknown argument "'.concat(argName, '" on directive "@').concat(directiveName, '".') + (0, _didYouMean.default)(suggestedArgs.map(function(x) {
        return '"'.concat(x, '"');
      }));
    }
    function KnownArgumentNames(context) {
      return _objectSpread({}, KnownArgumentNamesOnDirectives(context), {
        Argument: function Argument(argNode) {
          var argDef = context.getArgument();
          var fieldDef = context.getFieldDef();
          var parentType = context.getParentType();
          if (!argDef && fieldDef && parentType) {
            var argName = argNode.name.value;
            var knownArgsNames = fieldDef.args.map(function(arg) {
              return arg.name;
            });
            context.reportError(new _GraphQLError.GraphQLError(unknownArgMessage(argName, fieldDef.name, parentType.name, (0, _suggestionList.default)(argName, knownArgsNames)), argNode));
          }
        }
      });
    }
    function KnownArgumentNamesOnDirectives(context) {
      var directiveArgs = /* @__PURE__ */ Object.create(null);
      var schema = context.getSchema();
      var definedDirectives = schema ? schema.getDirectives() : _directives.specifiedDirectives;
      for (var _i2 = 0; _i2 < definedDirectives.length; _i2++) {
        var directive = definedDirectives[_i2];
        directiveArgs[directive.name] = directive.args.map(function(arg) {
          return arg.name;
        });
      }
      var astDefinitions = context.getDocument().definitions;
      for (var _i4 = 0; _i4 < astDefinitions.length; _i4++) {
        var def = astDefinitions[_i4];
        if (def.kind === _kinds.Kind.DIRECTIVE_DEFINITION) {
          directiveArgs[def.name.value] = def.arguments ? def.arguments.map(function(arg) {
            return arg.name.value;
          }) : [];
        }
      }
      return {
        Directive: function Directive(directiveNode) {
          var directiveName = directiveNode.name.value;
          var knownArgs = directiveArgs[directiveName];
          if (directiveNode.arguments && knownArgs) {
            for (var _i6 = 0, _directiveNode$argume2 = directiveNode.arguments; _i6 < _directiveNode$argume2.length; _i6++) {
              var argNode = _directiveNode$argume2[_i6];
              var argName = argNode.name.value;
              if (knownArgs.indexOf(argName) === -1) {
                var suggestions = (0, _suggestionList.default)(argName, knownArgs);
                context.reportError(new _GraphQLError.GraphQLError(unknownDirectiveArgMessage(argName, directiveName, suggestions), argNode));
              }
            }
          }
          return false;
        }
      };
    }
  }
});

// ../api/node_modules/graphql/validation/rules/UniqueArgumentNames.js
var require_UniqueArgumentNames = __commonJS({
  "../api/node_modules/graphql/validation/rules/UniqueArgumentNames.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", {
      value: true
    });
    exports.duplicateArgMessage = duplicateArgMessage;
    exports.UniqueArgumentNames = UniqueArgumentNames;
    var _GraphQLError = require_GraphQLError();
    function duplicateArgMessage(argName) {
      return 'There can be only one argument named "'.concat(argName, '".');
    }
    function UniqueArgumentNames(context) {
      var knownArgNames = /* @__PURE__ */ Object.create(null);
      return {
        Field: function Field() {
          knownArgNames = /* @__PURE__ */ Object.create(null);
        },
        Directive: function Directive() {
          knownArgNames = /* @__PURE__ */ Object.create(null);
        },
        Argument: function Argument(node) {
          var argName = node.name.value;
          if (knownArgNames[argName]) {
            context.reportError(new _GraphQLError.GraphQLError(duplicateArgMessage(argName), [knownArgNames[argName], node.name]));
          } else {
            knownArgNames[argName] = node.name;
          }
          return false;
        }
      };
    }
  }
});

// ../api/node_modules/graphql/validation/rules/ValuesOfCorrectType.js
var require_ValuesOfCorrectType = __commonJS({
  "../api/node_modules/graphql/validation/rules/ValuesOfCorrectType.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", {
      value: true
    });
    exports.badValueMessage = badValueMessage;
    exports.badEnumValueMessage = badEnumValueMessage;
    exports.requiredFieldMessage = requiredFieldMessage;
    exports.unknownFieldMessage = unknownFieldMessage;
    exports.ValuesOfCorrectType = ValuesOfCorrectType;
    var _objectValues3 = _interopRequireDefault(require_objectValues());
    var _keyMap = _interopRequireDefault(require_keyMap());
    var _inspect = _interopRequireDefault(require_inspect());
    var _isInvalid = _interopRequireDefault(require_isInvalid());
    var _didYouMean = _interopRequireDefault(require_didYouMean());
    var _suggestionList = _interopRequireDefault(require_suggestionList());
    var _GraphQLError = require_GraphQLError();
    var _printer = require_printer();
    var _definition = require_definition();
    function _interopRequireDefault(obj) {
      return obj && obj.__esModule ? obj : { default: obj };
    }
    function badValueMessage(typeName, valueName, message) {
      return "Expected type ".concat(typeName, ", found ").concat(valueName) + (message ? "; ".concat(message) : ".");
    }
    function badEnumValueMessage(typeName, valueName, suggestedValues) {
      return "Expected type ".concat(typeName, ", found ").concat(valueName, ".") + (0, _didYouMean.default)("the enum value", suggestedValues);
    }
    function requiredFieldMessage(typeName, fieldName, fieldTypeName) {
      return "Field ".concat(typeName, ".").concat(fieldName, " of required type ").concat(fieldTypeName, " was not provided.");
    }
    function unknownFieldMessage(typeName, fieldName, suggestedFields) {
      return 'Field "'.concat(fieldName, '" is not defined by type ').concat(typeName, ".") + (0, _didYouMean.default)(suggestedFields);
    }
    function ValuesOfCorrectType(context) {
      return {
        NullValue: function NullValue(node) {
          var type = context.getInputType();
          if ((0, _definition.isNonNullType)(type)) {
            context.reportError(new _GraphQLError.GraphQLError(badValueMessage((0, _inspect.default)(type), (0, _printer.print)(node)), node));
          }
        },
        ListValue: function ListValue(node) {
          var type = (0, _definition.getNullableType)(context.getParentInputType());
          if (!(0, _definition.isListType)(type)) {
            isValidScalar(context, node);
            return false;
          }
        },
        ObjectValue: function ObjectValue(node) {
          var type = (0, _definition.getNamedType)(context.getInputType());
          if (!(0, _definition.isInputObjectType)(type)) {
            isValidScalar(context, node);
            return false;
          }
          var fieldNodeMap = (0, _keyMap.default)(node.fields, function(field) {
            return field.name.value;
          });
          for (var _i2 = 0, _objectValues2 = (0, _objectValues3.default)(type.getFields()); _i2 < _objectValues2.length; _i2++) {
            var fieldDef = _objectValues2[_i2];
            var fieldNode = fieldNodeMap[fieldDef.name];
            if (!fieldNode && (0, _definition.isRequiredInputField)(fieldDef)) {
              var typeStr = (0, _inspect.default)(fieldDef.type);
              context.reportError(new _GraphQLError.GraphQLError(requiredFieldMessage(type.name, fieldDef.name, typeStr), node));
            }
          }
        },
        ObjectField: function ObjectField(node) {
          var parentType = (0, _definition.getNamedType)(context.getParentInputType());
          var fieldType = context.getInputType();
          if (!fieldType && (0, _definition.isInputObjectType)(parentType)) {
            var suggestions = (0, _suggestionList.default)(node.name.value, Object.keys(parentType.getFields()));
            context.reportError(new _GraphQLError.GraphQLError(unknownFieldMessage(parentType.name, node.name.value, suggestions), node));
          }
        },
        EnumValue: function EnumValue(node) {
          var type = (0, _definition.getNamedType)(context.getInputType());
          if (!(0, _definition.isEnumType)(type)) {
            isValidScalar(context, node);
          } else if (!type.getValue(node.value)) {
            context.reportError(new _GraphQLError.GraphQLError(badEnumValueMessage(type.name, (0, _printer.print)(node), enumTypeSuggestion(type, node)), node));
          }
        },
        IntValue: function IntValue(node) {
          return isValidScalar(context, node);
        },
        FloatValue: function FloatValue(node) {
          return isValidScalar(context, node);
        },
        StringValue: function StringValue(node) {
          return isValidScalar(context, node);
        },
        BooleanValue: function BooleanValue(node) {
          return isValidScalar(context, node);
        }
      };
    }
    function isValidScalar(context, node) {
      var locationType = context.getInputType();
      if (!locationType) {
        return;
      }
      var type = (0, _definition.getNamedType)(locationType);
      if (!(0, _definition.isScalarType)(type)) {
        var message = (0, _definition.isEnumType)(type) ? badEnumValueMessage((0, _inspect.default)(locationType), (0, _printer.print)(node), enumTypeSuggestion(type, node)) : badValueMessage((0, _inspect.default)(locationType), (0, _printer.print)(node));
        context.reportError(new _GraphQLError.GraphQLError(message, node));
        return;
      }
      try {
        var parseResult = type.parseLiteral(node, void 0);
        if ((0, _isInvalid.default)(parseResult)) {
          context.reportError(new _GraphQLError.GraphQLError(badValueMessage((0, _inspect.default)(locationType), (0, _printer.print)(node)), node));
        }
      } catch (error) {
        context.reportError(new _GraphQLError.GraphQLError(badValueMessage((0, _inspect.default)(locationType), (0, _printer.print)(node), error.message), node, void 0, void 0, void 0, error));
      }
    }
    function enumTypeSuggestion(type, node) {
      var allNames = type.getValues().map(function(value) {
        return value.name;
      });
      return (0, _suggestionList.default)((0, _printer.print)(node), allNames);
    }
  }
});

// ../api/node_modules/graphql/validation/rules/ProvidedRequiredArguments.js
var require_ProvidedRequiredArguments = __commonJS({
  "../api/node_modules/graphql/validation/rules/ProvidedRequiredArguments.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", {
      value: true
    });
    exports.missingFieldArgMessage = missingFieldArgMessage;
    exports.missingDirectiveArgMessage = missingDirectiveArgMessage;
    exports.ProvidedRequiredArguments = ProvidedRequiredArguments;
    exports.ProvidedRequiredArgumentsOnDirectives = ProvidedRequiredArgumentsOnDirectives;
    var _inspect = _interopRequireDefault(require_inspect());
    var _keyMap = _interopRequireDefault(require_keyMap());
    var _GraphQLError = require_GraphQLError();
    var _kinds = require_kinds();
    var _printer = require_printer();
    var _directives = require_directives();
    var _definition = require_definition();
    function _interopRequireDefault(obj) {
      return obj && obj.__esModule ? obj : { default: obj };
    }
    function ownKeys(object, enumerableOnly) {
      var keys = Object.keys(object);
      if (Object.getOwnPropertySymbols) {
        var symbols = Object.getOwnPropertySymbols(object);
        if (enumerableOnly)
          symbols = symbols.filter(function(sym) {
            return Object.getOwnPropertyDescriptor(object, sym).enumerable;
          });
        keys.push.apply(keys, symbols);
      }
      return keys;
    }
    function _objectSpread(target) {
      for (var i = 1; i < arguments.length; i++) {
        var source = arguments[i] != null ? arguments[i] : {};
        if (i % 2) {
          ownKeys(source, true).forEach(function(key) {
            _defineProperty(target, key, source[key]);
          });
        } else if (Object.getOwnPropertyDescriptors) {
          Object.defineProperties(target, Object.getOwnPropertyDescriptors(source));
        } else {
          ownKeys(source).forEach(function(key) {
            Object.defineProperty(target, key, Object.getOwnPropertyDescriptor(source, key));
          });
        }
      }
      return target;
    }
    function _defineProperty(obj, key, value) {
      if (key in obj) {
        Object.defineProperty(obj, key, { value, enumerable: true, configurable: true, writable: true });
      } else {
        obj[key] = value;
      }
      return obj;
    }
    function missingFieldArgMessage(fieldName, argName, type) {
      return 'Field "'.concat(fieldName, '" argument "').concat(argName, '" of type "').concat(type, '" is required, but it was not provided.');
    }
    function missingDirectiveArgMessage(directiveName, argName, type) {
      return 'Directive "@'.concat(directiveName, '" argument "').concat(argName, '" of type "').concat(type, '" is required, but it was not provided.');
    }
    function ProvidedRequiredArguments(context) {
      return _objectSpread({}, ProvidedRequiredArgumentsOnDirectives(context), {
        Field: {
          leave: function leave(fieldNode) {
            var fieldDef = context.getFieldDef();
            if (!fieldDef) {
              return false;
            }
            var argNodes = fieldNode.arguments || [];
            var argNodeMap = (0, _keyMap.default)(argNodes, function(arg) {
              return arg.name.value;
            });
            for (var _i2 = 0, _fieldDef$args2 = fieldDef.args; _i2 < _fieldDef$args2.length; _i2++) {
              var argDef = _fieldDef$args2[_i2];
              var argNode = argNodeMap[argDef.name];
              if (!argNode && (0, _definition.isRequiredArgument)(argDef)) {
                context.reportError(new _GraphQLError.GraphQLError(missingFieldArgMessage(fieldDef.name, argDef.name, (0, _inspect.default)(argDef.type)), fieldNode));
              }
            }
          }
        }
      });
    }
    function ProvidedRequiredArgumentsOnDirectives(context) {
      var requiredArgsMap = /* @__PURE__ */ Object.create(null);
      var schema = context.getSchema();
      var definedDirectives = schema ? schema.getDirectives() : _directives.specifiedDirectives;
      for (var _i4 = 0; _i4 < definedDirectives.length; _i4++) {
        var directive = definedDirectives[_i4];
        requiredArgsMap[directive.name] = (0, _keyMap.default)(directive.args.filter(_definition.isRequiredArgument), function(arg) {
          return arg.name;
        });
      }
      var astDefinitions = context.getDocument().definitions;
      for (var _i6 = 0; _i6 < astDefinitions.length; _i6++) {
        var def = astDefinitions[_i6];
        if (def.kind === _kinds.Kind.DIRECTIVE_DEFINITION) {
          requiredArgsMap[def.name.value] = (0, _keyMap.default)(def.arguments ? def.arguments.filter(isRequiredArgumentNode) : [], function(arg) {
            return arg.name.value;
          });
        }
      }
      return {
        Directive: {
          leave: function leave(directiveNode) {
            var directiveName = directiveNode.name.value;
            var requiredArgs = requiredArgsMap[directiveName];
            if (requiredArgs) {
              var argNodes = directiveNode.arguments || [];
              var argNodeMap = (0, _keyMap.default)(argNodes, function(arg) {
                return arg.name.value;
              });
              for (var _i8 = 0, _Object$keys2 = Object.keys(requiredArgs); _i8 < _Object$keys2.length; _i8++) {
                var argName = _Object$keys2[_i8];
                if (!argNodeMap[argName]) {
                  var argType = requiredArgs[argName].type;
                  context.reportError(new _GraphQLError.GraphQLError(missingDirectiveArgMessage(directiveName, argName, (0, _definition.isType)(argType) ? (0, _inspect.default)(argType) : (0, _printer.print)(argType)), directiveNode));
                }
              }
            }
          }
        }
      };
    }
    function isRequiredArgumentNode(arg) {
      return arg.type.kind === _kinds.Kind.NON_NULL_TYPE && arg.defaultValue == null;
    }
  }
});

// ../api/node_modules/graphql/validation/rules/VariablesInAllowedPosition.js
var require_VariablesInAllowedPosition = __commonJS({
  "../api/node_modules/graphql/validation/rules/VariablesInAllowedPosition.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", {
      value: true
    });
    exports.badVarPosMessage = badVarPosMessage;
    exports.VariablesInAllowedPosition = VariablesInAllowedPosition;
    var _inspect = _interopRequireDefault(require_inspect());
    var _GraphQLError = require_GraphQLError();
    var _kinds = require_kinds();
    var _definition = require_definition();
    var _typeFromAST = require_typeFromAST();
    var _typeComparators = require_typeComparators();
    function _interopRequireDefault(obj) {
      return obj && obj.__esModule ? obj : { default: obj };
    }
    function badVarPosMessage(varName, varType, expectedType) {
      return 'Variable "$'.concat(varName, '" of type "').concat(varType, '" used in position expecting type "').concat(expectedType, '".');
    }
    function VariablesInAllowedPosition(context) {
      var varDefMap = /* @__PURE__ */ Object.create(null);
      return {
        OperationDefinition: {
          enter: function enter() {
            varDefMap = /* @__PURE__ */ Object.create(null);
          },
          leave: function leave(operation) {
            var usages = context.getRecursiveVariableUsages(operation);
            for (var _i2 = 0; _i2 < usages.length; _i2++) {
              var _ref2 = usages[_i2];
              var node = _ref2.node;
              var type = _ref2.type;
              var defaultValue = _ref2.defaultValue;
              var varName = node.name.value;
              var varDef = varDefMap[varName];
              if (varDef && type) {
                var schema = context.getSchema();
                var varType = (0, _typeFromAST.typeFromAST)(schema, varDef.type);
                if (varType && !allowedVariableUsage(schema, varType, varDef.defaultValue, type, defaultValue)) {
                  context.reportError(new _GraphQLError.GraphQLError(badVarPosMessage(varName, (0, _inspect.default)(varType), (0, _inspect.default)(type)), [varDef, node]));
                }
              }
            }
          }
        },
        VariableDefinition: function VariableDefinition(node) {
          varDefMap[node.variable.name.value] = node;
        }
      };
    }
    function allowedVariableUsage(schema, varType, varDefaultValue, locationType, locationDefaultValue) {
      if ((0, _definition.isNonNullType)(locationType) && !(0, _definition.isNonNullType)(varType)) {
        var hasNonNullVariableDefaultValue = varDefaultValue != null && varDefaultValue.kind !== _kinds.Kind.NULL;
        var hasLocationDefaultValue = locationDefaultValue !== void 0;
        if (!hasNonNullVariableDefaultValue && !hasLocationDefaultValue) {
          return false;
        }
        var nullableLocationType = locationType.ofType;
        return (0, _typeComparators.isTypeSubTypeOf)(schema, varType, nullableLocationType);
      }
      return (0, _typeComparators.isTypeSubTypeOf)(schema, varType, locationType);
    }
  }
});

// ../api/node_modules/graphql/validation/rules/OverlappingFieldsCanBeMerged.js
var require_OverlappingFieldsCanBeMerged = __commonJS({
  "../api/node_modules/graphql/validation/rules/OverlappingFieldsCanBeMerged.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", {
      value: true
    });
    exports.fieldsConflictMessage = fieldsConflictMessage;
    exports.OverlappingFieldsCanBeMerged = OverlappingFieldsCanBeMerged;
    var _find = _interopRequireDefault(require_find());
    var _objectEntries3 = _interopRequireDefault(require_objectEntries());
    var _inspect = _interopRequireDefault(require_inspect());
    var _GraphQLError = require_GraphQLError();
    var _kinds = require_kinds();
    var _printer = require_printer();
    var _definition = require_definition();
    var _typeFromAST = require_typeFromAST();
    function _interopRequireDefault(obj) {
      return obj && obj.__esModule ? obj : { default: obj };
    }
    function fieldsConflictMessage(responseName, reason) {
      return 'Fields "'.concat(responseName, '" conflict because ').concat(reasonMessage(reason), ". ") + "Use different aliases on the fields to fetch both if this was intentional.";
    }
    function reasonMessage(reason) {
      if (Array.isArray(reason)) {
        return reason.map(function(_ref) {
          var responseName = _ref[0], subreason = _ref[1];
          return 'subfields "'.concat(responseName, '" conflict because ').concat(reasonMessage(subreason));
        }).join(" and ");
      }
      return reason;
    }
    function OverlappingFieldsCanBeMerged(context) {
      var comparedFragmentPairs = new PairSet();
      var cachedFieldsAndFragmentNames = /* @__PURE__ */ new Map();
      return {
        SelectionSet: function SelectionSet(selectionSet) {
          var conflicts = findConflictsWithinSelectionSet(context, cachedFieldsAndFragmentNames, comparedFragmentPairs, context.getParentType(), selectionSet);
          for (var _i2 = 0; _i2 < conflicts.length; _i2++) {
            var _ref3 = conflicts[_i2];
            var _ref2$ = _ref3[0];
            var responseName = _ref2$[0];
            var reason = _ref2$[1];
            var fields1 = _ref3[1];
            var fields2 = _ref3[2];
            context.reportError(new _GraphQLError.GraphQLError(fieldsConflictMessage(responseName, reason), fields1.concat(fields2)));
          }
        }
      };
    }
    function findConflictsWithinSelectionSet(context, cachedFieldsAndFragmentNames, comparedFragmentPairs, parentType, selectionSet) {
      var conflicts = [];
      var _getFieldsAndFragment = getFieldsAndFragmentNames(context, cachedFieldsAndFragmentNames, parentType, selectionSet), fieldMap = _getFieldsAndFragment[0], fragmentNames = _getFieldsAndFragment[1];
      collectConflictsWithin(context, conflicts, cachedFieldsAndFragmentNames, comparedFragmentPairs, fieldMap);
      if (fragmentNames.length !== 0) {
        var comparedFragments = /* @__PURE__ */ Object.create(null);
        for (var i = 0; i < fragmentNames.length; i++) {
          collectConflictsBetweenFieldsAndFragment(context, conflicts, cachedFieldsAndFragmentNames, comparedFragments, comparedFragmentPairs, false, fieldMap, fragmentNames[i]);
          for (var j = i + 1; j < fragmentNames.length; j++) {
            collectConflictsBetweenFragments(context, conflicts, cachedFieldsAndFragmentNames, comparedFragmentPairs, false, fragmentNames[i], fragmentNames[j]);
          }
        }
      }
      return conflicts;
    }
    function collectConflictsBetweenFieldsAndFragment(context, conflicts, cachedFieldsAndFragmentNames, comparedFragments, comparedFragmentPairs, areMutuallyExclusive, fieldMap, fragmentName) {
      if (comparedFragments[fragmentName]) {
        return;
      }
      comparedFragments[fragmentName] = true;
      var fragment = context.getFragment(fragmentName);
      if (!fragment) {
        return;
      }
      var _getReferencedFieldsA = getReferencedFieldsAndFragmentNames(context, cachedFieldsAndFragmentNames, fragment), fieldMap2 = _getReferencedFieldsA[0], fragmentNames2 = _getReferencedFieldsA[1];
      if (fieldMap === fieldMap2) {
        return;
      }
      collectConflictsBetween(context, conflicts, cachedFieldsAndFragmentNames, comparedFragmentPairs, areMutuallyExclusive, fieldMap, fieldMap2);
      for (var i = 0; i < fragmentNames2.length; i++) {
        collectConflictsBetweenFieldsAndFragment(context, conflicts, cachedFieldsAndFragmentNames, comparedFragments, comparedFragmentPairs, areMutuallyExclusive, fieldMap, fragmentNames2[i]);
      }
    }
    function collectConflictsBetweenFragments(context, conflicts, cachedFieldsAndFragmentNames, comparedFragmentPairs, areMutuallyExclusive, fragmentName1, fragmentName2) {
      if (fragmentName1 === fragmentName2) {
        return;
      }
      if (comparedFragmentPairs.has(fragmentName1, fragmentName2, areMutuallyExclusive)) {
        return;
      }
      comparedFragmentPairs.add(fragmentName1, fragmentName2, areMutuallyExclusive);
      var fragment1 = context.getFragment(fragmentName1);
      var fragment2 = context.getFragment(fragmentName2);
      if (!fragment1 || !fragment2) {
        return;
      }
      var _getReferencedFieldsA2 = getReferencedFieldsAndFragmentNames(context, cachedFieldsAndFragmentNames, fragment1), fieldMap1 = _getReferencedFieldsA2[0], fragmentNames1 = _getReferencedFieldsA2[1];
      var _getReferencedFieldsA3 = getReferencedFieldsAndFragmentNames(context, cachedFieldsAndFragmentNames, fragment2), fieldMap2 = _getReferencedFieldsA3[0], fragmentNames2 = _getReferencedFieldsA3[1];
      collectConflictsBetween(context, conflicts, cachedFieldsAndFragmentNames, comparedFragmentPairs, areMutuallyExclusive, fieldMap1, fieldMap2);
      for (var j = 0; j < fragmentNames2.length; j++) {
        collectConflictsBetweenFragments(context, conflicts, cachedFieldsAndFragmentNames, comparedFragmentPairs, areMutuallyExclusive, fragmentName1, fragmentNames2[j]);
      }
      for (var i = 0; i < fragmentNames1.length; i++) {
        collectConflictsBetweenFragments(context, conflicts, cachedFieldsAndFragmentNames, comparedFragmentPairs, areMutuallyExclusive, fragmentNames1[i], fragmentName2);
      }
    }
    function findConflictsBetweenSubSelectionSets(context, cachedFieldsAndFragmentNames, comparedFragmentPairs, areMutuallyExclusive, parentType1, selectionSet1, parentType2, selectionSet2) {
      var conflicts = [];
      var _getFieldsAndFragment2 = getFieldsAndFragmentNames(context, cachedFieldsAndFragmentNames, parentType1, selectionSet1), fieldMap1 = _getFieldsAndFragment2[0], fragmentNames1 = _getFieldsAndFragment2[1];
      var _getFieldsAndFragment3 = getFieldsAndFragmentNames(context, cachedFieldsAndFragmentNames, parentType2, selectionSet2), fieldMap2 = _getFieldsAndFragment3[0], fragmentNames2 = _getFieldsAndFragment3[1];
      collectConflictsBetween(context, conflicts, cachedFieldsAndFragmentNames, comparedFragmentPairs, areMutuallyExclusive, fieldMap1, fieldMap2);
      if (fragmentNames2.length !== 0) {
        var comparedFragments = /* @__PURE__ */ Object.create(null);
        for (var j = 0; j < fragmentNames2.length; j++) {
          collectConflictsBetweenFieldsAndFragment(context, conflicts, cachedFieldsAndFragmentNames, comparedFragments, comparedFragmentPairs, areMutuallyExclusive, fieldMap1, fragmentNames2[j]);
        }
      }
      if (fragmentNames1.length !== 0) {
        var _comparedFragments = /* @__PURE__ */ Object.create(null);
        for (var i = 0; i < fragmentNames1.length; i++) {
          collectConflictsBetweenFieldsAndFragment(context, conflicts, cachedFieldsAndFragmentNames, _comparedFragments, comparedFragmentPairs, areMutuallyExclusive, fieldMap2, fragmentNames1[i]);
        }
      }
      for (var _i3 = 0; _i3 < fragmentNames1.length; _i3++) {
        for (var _j = 0; _j < fragmentNames2.length; _j++) {
          collectConflictsBetweenFragments(context, conflicts, cachedFieldsAndFragmentNames, comparedFragmentPairs, areMutuallyExclusive, fragmentNames1[_i3], fragmentNames2[_j]);
        }
      }
      return conflicts;
    }
    function collectConflictsWithin(context, conflicts, cachedFieldsAndFragmentNames, comparedFragmentPairs, fieldMap) {
      for (var _i5 = 0, _objectEntries2 = (0, _objectEntries3.default)(fieldMap); _i5 < _objectEntries2.length; _i5++) {
        var _ref5 = _objectEntries2[_i5];
        var responseName = _ref5[0];
        var fields = _ref5[1];
        if (fields.length > 1) {
          for (var i = 0; i < fields.length; i++) {
            for (var j = i + 1; j < fields.length; j++) {
              var conflict = findConflict(context, cachedFieldsAndFragmentNames, comparedFragmentPairs, false, responseName, fields[i], fields[j]);
              if (conflict) {
                conflicts.push(conflict);
              }
            }
          }
        }
      }
    }
    function collectConflictsBetween(context, conflicts, cachedFieldsAndFragmentNames, comparedFragmentPairs, parentFieldsAreMutuallyExclusive, fieldMap1, fieldMap2) {
      for (var _i7 = 0, _Object$keys2 = Object.keys(fieldMap1); _i7 < _Object$keys2.length; _i7++) {
        var responseName = _Object$keys2[_i7];
        var fields2 = fieldMap2[responseName];
        if (fields2) {
          var fields1 = fieldMap1[responseName];
          for (var i = 0; i < fields1.length; i++) {
            for (var j = 0; j < fields2.length; j++) {
              var conflict = findConflict(context, cachedFieldsAndFragmentNames, comparedFragmentPairs, parentFieldsAreMutuallyExclusive, responseName, fields1[i], fields2[j]);
              if (conflict) {
                conflicts.push(conflict);
              }
            }
          }
        }
      }
    }
    function findConflict(context, cachedFieldsAndFragmentNames, comparedFragmentPairs, parentFieldsAreMutuallyExclusive, responseName, field1, field2) {
      var parentType1 = field1[0], node1 = field1[1], def1 = field1[2];
      var parentType2 = field2[0], node2 = field2[1], def2 = field2[2];
      var areMutuallyExclusive = parentFieldsAreMutuallyExclusive || parentType1 !== parentType2 && (0, _definition.isObjectType)(parentType1) && (0, _definition.isObjectType)(parentType2);
      var type1 = def1 && def1.type;
      var type2 = def2 && def2.type;
      if (!areMutuallyExclusive) {
        var name1 = node1.name.value;
        var name2 = node2.name.value;
        if (name1 !== name2) {
          return [[responseName, "".concat(name1, " and ").concat(name2, " are different fields")], [node1], [node2]];
        }
        if (!sameArguments(node1.arguments || [], node2.arguments || [])) {
          return [[responseName, "they have differing arguments"], [node1], [node2]];
        }
      }
      if (type1 && type2 && doTypesConflict(type1, type2)) {
        return [[responseName, "they return conflicting types ".concat((0, _inspect.default)(type1), " and ").concat((0, _inspect.default)(type2))], [node1], [node2]];
      }
      var selectionSet1 = node1.selectionSet;
      var selectionSet2 = node2.selectionSet;
      if (selectionSet1 && selectionSet2) {
        var conflicts = findConflictsBetweenSubSelectionSets(context, cachedFieldsAndFragmentNames, comparedFragmentPairs, areMutuallyExclusive, (0, _definition.getNamedType)(type1), selectionSet1, (0, _definition.getNamedType)(type2), selectionSet2);
        return subfieldConflicts(conflicts, responseName, node1, node2);
      }
    }
    function sameArguments(arguments1, arguments2) {
      if (arguments1.length !== arguments2.length) {
        return false;
      }
      return arguments1.every(function(argument1) {
        var argument2 = (0, _find.default)(arguments2, function(argument) {
          return argument.name.value === argument1.name.value;
        });
        if (!argument2) {
          return false;
        }
        return sameValue(argument1.value, argument2.value);
      });
    }
    function sameValue(value1, value2) {
      return !value1 && !value2 || (0, _printer.print)(value1) === (0, _printer.print)(value2);
    }
    function doTypesConflict(type1, type2) {
      if ((0, _definition.isListType)(type1)) {
        return (0, _definition.isListType)(type2) ? doTypesConflict(type1.ofType, type2.ofType) : true;
      }
      if ((0, _definition.isListType)(type2)) {
        return true;
      }
      if ((0, _definition.isNonNullType)(type1)) {
        return (0, _definition.isNonNullType)(type2) ? doTypesConflict(type1.ofType, type2.ofType) : true;
      }
      if ((0, _definition.isNonNullType)(type2)) {
        return true;
      }
      if ((0, _definition.isLeafType)(type1) || (0, _definition.isLeafType)(type2)) {
        return type1 !== type2;
      }
      return false;
    }
    function getFieldsAndFragmentNames(context, cachedFieldsAndFragmentNames, parentType, selectionSet) {
      var cached = cachedFieldsAndFragmentNames.get(selectionSet);
      if (!cached) {
        var nodeAndDefs = /* @__PURE__ */ Object.create(null);
        var fragmentNames = /* @__PURE__ */ Object.create(null);
        _collectFieldsAndFragmentNames(context, parentType, selectionSet, nodeAndDefs, fragmentNames);
        cached = [nodeAndDefs, Object.keys(fragmentNames)];
        cachedFieldsAndFragmentNames.set(selectionSet, cached);
      }
      return cached;
    }
    function getReferencedFieldsAndFragmentNames(context, cachedFieldsAndFragmentNames, fragment) {
      var cached = cachedFieldsAndFragmentNames.get(fragment.selectionSet);
      if (cached) {
        return cached;
      }
      var fragmentType = (0, _typeFromAST.typeFromAST)(context.getSchema(), fragment.typeCondition);
      return getFieldsAndFragmentNames(context, cachedFieldsAndFragmentNames, fragmentType, fragment.selectionSet);
    }
    function _collectFieldsAndFragmentNames(context, parentType, selectionSet, nodeAndDefs, fragmentNames) {
      for (var _i9 = 0, _selectionSet$selecti2 = selectionSet.selections; _i9 < _selectionSet$selecti2.length; _i9++) {
        var selection = _selectionSet$selecti2[_i9];
        switch (selection.kind) {
          case _kinds.Kind.FIELD: {
            var fieldName = selection.name.value;
            var fieldDef = void 0;
            if ((0, _definition.isObjectType)(parentType) || (0, _definition.isInterfaceType)(parentType)) {
              fieldDef = parentType.getFields()[fieldName];
            }
            var responseName = selection.alias ? selection.alias.value : fieldName;
            if (!nodeAndDefs[responseName]) {
              nodeAndDefs[responseName] = [];
            }
            nodeAndDefs[responseName].push([parentType, selection, fieldDef]);
            break;
          }
          case _kinds.Kind.FRAGMENT_SPREAD:
            fragmentNames[selection.name.value] = true;
            break;
          case _kinds.Kind.INLINE_FRAGMENT: {
            var typeCondition = selection.typeCondition;
            var inlineFragmentType = typeCondition ? (0, _typeFromAST.typeFromAST)(context.getSchema(), typeCondition) : parentType;
            _collectFieldsAndFragmentNames(context, inlineFragmentType, selection.selectionSet, nodeAndDefs, fragmentNames);
            break;
          }
        }
      }
    }
    function subfieldConflicts(conflicts, responseName, node1, node2) {
      if (conflicts.length > 0) {
        return [[responseName, conflicts.map(function(_ref6) {
          var reason = _ref6[0];
          return reason;
        })], conflicts.reduce(function(allFields, _ref7) {
          var fields1 = _ref7[1];
          return allFields.concat(fields1);
        }, [node1]), conflicts.reduce(function(allFields, _ref8) {
          var fields2 = _ref8[2];
          return allFields.concat(fields2);
        }, [node2])];
      }
    }
    var PairSet = /* @__PURE__ */ function() {
      function PairSet2() {
        this._data = /* @__PURE__ */ Object.create(null);
      }
      var _proto = PairSet2.prototype;
      _proto.has = function has(a, b, areMutuallyExclusive) {
        var first = this._data[a];
        var result = first && first[b];
        if (result === void 0) {
          return false;
        }
        if (areMutuallyExclusive === false) {
          return result === false;
        }
        return true;
      };
      _proto.add = function add(a, b, areMutuallyExclusive) {
        _pairSetAdd(this._data, a, b, areMutuallyExclusive);
        _pairSetAdd(this._data, b, a, areMutuallyExclusive);
      };
      return PairSet2;
    }();
    function _pairSetAdd(data, a, b, areMutuallyExclusive) {
      var map = data[a];
      if (!map) {
        map = /* @__PURE__ */ Object.create(null);
        data[a] = map;
      }
      map[b] = areMutuallyExclusive;
    }
  }
});

// ../api/node_modules/graphql/validation/rules/UniqueInputFieldNames.js
var require_UniqueInputFieldNames = __commonJS({
  "../api/node_modules/graphql/validation/rules/UniqueInputFieldNames.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", {
      value: true
    });
    exports.duplicateInputFieldMessage = duplicateInputFieldMessage;
    exports.UniqueInputFieldNames = UniqueInputFieldNames;
    var _GraphQLError = require_GraphQLError();
    function duplicateInputFieldMessage(fieldName) {
      return 'There can be only one input field named "'.concat(fieldName, '".');
    }
    function UniqueInputFieldNames(context) {
      var knownNameStack = [];
      var knownNames = /* @__PURE__ */ Object.create(null);
      return {
        ObjectValue: {
          enter: function enter() {
            knownNameStack.push(knownNames);
            knownNames = /* @__PURE__ */ Object.create(null);
          },
          leave: function leave() {
            knownNames = knownNameStack.pop();
          }
        },
        ObjectField: function ObjectField(node) {
          var fieldName = node.name.value;
          if (knownNames[fieldName]) {
            context.reportError(new _GraphQLError.GraphQLError(duplicateInputFieldMessage(fieldName), [knownNames[fieldName], node.name]));
          } else {
            knownNames[fieldName] = node.name;
          }
        }
      };
    }
  }
});

// ../api/node_modules/graphql/validation/rules/LoneSchemaDefinition.js
var require_LoneSchemaDefinition = __commonJS({
  "../api/node_modules/graphql/validation/rules/LoneSchemaDefinition.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", {
      value: true
    });
    exports.schemaDefinitionNotAloneMessage = schemaDefinitionNotAloneMessage;
    exports.canNotDefineSchemaWithinExtensionMessage = canNotDefineSchemaWithinExtensionMessage;
    exports.LoneSchemaDefinition = LoneSchemaDefinition;
    var _GraphQLError = require_GraphQLError();
    function schemaDefinitionNotAloneMessage() {
      return "Must provide only one schema definition.";
    }
    function canNotDefineSchemaWithinExtensionMessage() {
      return "Cannot define a new schema within a schema extension.";
    }
    function LoneSchemaDefinition(context) {
      var oldSchema = context.getSchema();
      var alreadyDefined = oldSchema && (oldSchema.astNode || oldSchema.getQueryType() || oldSchema.getMutationType() || oldSchema.getSubscriptionType());
      var schemaDefinitionsCount = 0;
      return {
        SchemaDefinition: function SchemaDefinition(node) {
          if (alreadyDefined) {
            context.reportError(new _GraphQLError.GraphQLError(canNotDefineSchemaWithinExtensionMessage(), node));
            return;
          }
          if (schemaDefinitionsCount > 0) {
            context.reportError(new _GraphQLError.GraphQLError(schemaDefinitionNotAloneMessage(), node));
          }
          ++schemaDefinitionsCount;
        }
      };
    }
  }
});

// ../api/node_modules/graphql/validation/rules/UniqueOperationTypes.js
var require_UniqueOperationTypes = __commonJS({
  "../api/node_modules/graphql/validation/rules/UniqueOperationTypes.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", {
      value: true
    });
    exports.duplicateOperationTypeMessage = duplicateOperationTypeMessage;
    exports.existedOperationTypeMessage = existedOperationTypeMessage;
    exports.UniqueOperationTypes = UniqueOperationTypes;
    var _GraphQLError = require_GraphQLError();
    function duplicateOperationTypeMessage(operation) {
      return "There can be only one ".concat(operation, " type in schema.");
    }
    function existedOperationTypeMessage(operation) {
      return "Type for ".concat(operation, " already defined in the schema. It cannot be redefined.");
    }
    function UniqueOperationTypes(context) {
      var schema = context.getSchema();
      var definedOperationTypes = /* @__PURE__ */ Object.create(null);
      var existingOperationTypes = schema ? {
        query: schema.getQueryType(),
        mutation: schema.getMutationType(),
        subscription: schema.getSubscriptionType()
      } : {};
      return {
        SchemaDefinition: checkOperationTypes,
        SchemaExtension: checkOperationTypes
      };
      function checkOperationTypes(node) {
        if (node.operationTypes) {
          for (var _i2 = 0, _ref2 = node.operationTypes || []; _i2 < _ref2.length; _i2++) {
            var operationType = _ref2[_i2];
            var operation = operationType.operation;
            var alreadyDefinedOperationType = definedOperationTypes[operation];
            if (existingOperationTypes[operation]) {
              context.reportError(new _GraphQLError.GraphQLError(existedOperationTypeMessage(operation), operationType));
            } else if (alreadyDefinedOperationType) {
              context.reportError(new _GraphQLError.GraphQLError(duplicateOperationTypeMessage(operation), [alreadyDefinedOperationType, operationType]));
            } else {
              definedOperationTypes[operation] = operationType;
            }
          }
        }
        return false;
      }
    }
  }
});

// ../api/node_modules/graphql/validation/rules/UniqueTypeNames.js
var require_UniqueTypeNames = __commonJS({
  "../api/node_modules/graphql/validation/rules/UniqueTypeNames.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", {
      value: true
    });
    exports.duplicateTypeNameMessage = duplicateTypeNameMessage;
    exports.existedTypeNameMessage = existedTypeNameMessage;
    exports.UniqueTypeNames = UniqueTypeNames;
    var _GraphQLError = require_GraphQLError();
    function duplicateTypeNameMessage(typeName) {
      return 'There can be only one type named "'.concat(typeName, '".');
    }
    function existedTypeNameMessage(typeName) {
      return 'Type "'.concat(typeName, '" already exists in the schema. It cannot also be defined in this type definition.');
    }
    function UniqueTypeNames(context) {
      var knownTypeNames = /* @__PURE__ */ Object.create(null);
      var schema = context.getSchema();
      return {
        ScalarTypeDefinition: checkTypeName,
        ObjectTypeDefinition: checkTypeName,
        InterfaceTypeDefinition: checkTypeName,
        UnionTypeDefinition: checkTypeName,
        EnumTypeDefinition: checkTypeName,
        InputObjectTypeDefinition: checkTypeName
      };
      function checkTypeName(node) {
        var typeName = node.name.value;
        if (schema && schema.getType(typeName)) {
          context.reportError(new _GraphQLError.GraphQLError(existedTypeNameMessage(typeName), node.name));
          return;
        }
        if (knownTypeNames[typeName]) {
          context.reportError(new _GraphQLError.GraphQLError(duplicateTypeNameMessage(typeName), [knownTypeNames[typeName], node.name]));
        } else {
          knownTypeNames[typeName] = node.name;
        }
        return false;
      }
    }
  }
});

// ../api/node_modules/graphql/validation/rules/UniqueEnumValueNames.js
var require_UniqueEnumValueNames = __commonJS({
  "../api/node_modules/graphql/validation/rules/UniqueEnumValueNames.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", {
      value: true
    });
    exports.duplicateEnumValueNameMessage = duplicateEnumValueNameMessage;
    exports.existedEnumValueNameMessage = existedEnumValueNameMessage;
    exports.UniqueEnumValueNames = UniqueEnumValueNames;
    var _GraphQLError = require_GraphQLError();
    var _definition = require_definition();
    function duplicateEnumValueNameMessage(typeName, valueName) {
      return 'Enum value "'.concat(typeName, ".").concat(valueName, '" can only be defined once.');
    }
    function existedEnumValueNameMessage(typeName, valueName) {
      return 'Enum value "'.concat(typeName, ".").concat(valueName, '" already exists in the schema. It cannot also be defined in this type extension.');
    }
    function UniqueEnumValueNames(context) {
      var schema = context.getSchema();
      var existingTypeMap = schema ? schema.getTypeMap() : /* @__PURE__ */ Object.create(null);
      var knownValueNames = /* @__PURE__ */ Object.create(null);
      return {
        EnumTypeDefinition: checkValueUniqueness,
        EnumTypeExtension: checkValueUniqueness
      };
      function checkValueUniqueness(node) {
        var typeName = node.name.value;
        if (!knownValueNames[typeName]) {
          knownValueNames[typeName] = /* @__PURE__ */ Object.create(null);
        }
        if (node.values) {
          var valueNames = knownValueNames[typeName];
          for (var _i2 = 0, _node$values2 = node.values; _i2 < _node$values2.length; _i2++) {
            var valueDef = _node$values2[_i2];
            var valueName = valueDef.name.value;
            var existingType = existingTypeMap[typeName];
            if ((0, _definition.isEnumType)(existingType) && existingType.getValue(valueName)) {
              context.reportError(new _GraphQLError.GraphQLError(existedEnumValueNameMessage(typeName, valueName), valueDef.name));
            } else if (valueNames[valueName]) {
              context.reportError(new _GraphQLError.GraphQLError(duplicateEnumValueNameMessage(typeName, valueName), [valueNames[valueName], valueDef.name]));
            } else {
              valueNames[valueName] = valueDef.name;
            }
          }
        }
        return false;
      }
    }
  }
});

// ../api/node_modules/graphql/validation/rules/UniqueFieldDefinitionNames.js
var require_UniqueFieldDefinitionNames = __commonJS({
  "../api/node_modules/graphql/validation/rules/UniqueFieldDefinitionNames.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", {
      value: true
    });
    exports.duplicateFieldDefinitionNameMessage = duplicateFieldDefinitionNameMessage;
    exports.existedFieldDefinitionNameMessage = existedFieldDefinitionNameMessage;
    exports.UniqueFieldDefinitionNames = UniqueFieldDefinitionNames;
    var _GraphQLError = require_GraphQLError();
    var _definition = require_definition();
    function duplicateFieldDefinitionNameMessage(typeName, fieldName) {
      return 'Field "'.concat(typeName, ".").concat(fieldName, '" can only be defined once.');
    }
    function existedFieldDefinitionNameMessage(typeName, fieldName) {
      return 'Field "'.concat(typeName, ".").concat(fieldName, '" already exists in the schema. It cannot also be defined in this type extension.');
    }
    function UniqueFieldDefinitionNames(context) {
      var schema = context.getSchema();
      var existingTypeMap = schema ? schema.getTypeMap() : /* @__PURE__ */ Object.create(null);
      var knownFieldNames = /* @__PURE__ */ Object.create(null);
      return {
        InputObjectTypeDefinition: checkFieldUniqueness,
        InputObjectTypeExtension: checkFieldUniqueness,
        InterfaceTypeDefinition: checkFieldUniqueness,
        InterfaceTypeExtension: checkFieldUniqueness,
        ObjectTypeDefinition: checkFieldUniqueness,
        ObjectTypeExtension: checkFieldUniqueness
      };
      function checkFieldUniqueness(node) {
        var typeName = node.name.value;
        if (!knownFieldNames[typeName]) {
          knownFieldNames[typeName] = /* @__PURE__ */ Object.create(null);
        }
        if (node.fields) {
          var fieldNames = knownFieldNames[typeName];
          for (var _i2 = 0, _node$fields2 = node.fields; _i2 < _node$fields2.length; _i2++) {
            var fieldDef = _node$fields2[_i2];
            var fieldName = fieldDef.name.value;
            if (hasField(existingTypeMap[typeName], fieldName)) {
              context.reportError(new _GraphQLError.GraphQLError(existedFieldDefinitionNameMessage(typeName, fieldName), fieldDef.name));
            } else if (fieldNames[fieldName]) {
              context.reportError(new _GraphQLError.GraphQLError(duplicateFieldDefinitionNameMessage(typeName, fieldName), [fieldNames[fieldName], fieldDef.name]));
            } else {
              fieldNames[fieldName] = fieldDef.name;
            }
          }
        }
        return false;
      }
    }
    function hasField(type, fieldName) {
      if ((0, _definition.isObjectType)(type) || (0, _definition.isInterfaceType)(type) || (0, _definition.isInputObjectType)(type)) {
        return type.getFields()[fieldName];
      }
      return false;
    }
  }
});

// ../api/node_modules/graphql/validation/rules/UniqueDirectiveNames.js
var require_UniqueDirectiveNames = __commonJS({
  "../api/node_modules/graphql/validation/rules/UniqueDirectiveNames.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", {
      value: true
    });
    exports.duplicateDirectiveNameMessage = duplicateDirectiveNameMessage;
    exports.existedDirectiveNameMessage = existedDirectiveNameMessage;
    exports.UniqueDirectiveNames = UniqueDirectiveNames;
    var _GraphQLError = require_GraphQLError();
    function duplicateDirectiveNameMessage(directiveName) {
      return 'There can be only one directive named "'.concat(directiveName, '".');
    }
    function existedDirectiveNameMessage(directiveName) {
      return 'Directive "'.concat(directiveName, '" already exists in the schema. It cannot be redefined.');
    }
    function UniqueDirectiveNames(context) {
      var knownDirectiveNames = /* @__PURE__ */ Object.create(null);
      var schema = context.getSchema();
      return {
        DirectiveDefinition: function DirectiveDefinition(node) {
          var directiveName = node.name.value;
          if (schema && schema.getDirective(directiveName)) {
            context.reportError(new _GraphQLError.GraphQLError(existedDirectiveNameMessage(directiveName), node.name));
            return;
          }
          if (knownDirectiveNames[directiveName]) {
            context.reportError(new _GraphQLError.GraphQLError(duplicateDirectiveNameMessage(directiveName), [knownDirectiveNames[directiveName], node.name]));
          } else {
            knownDirectiveNames[directiveName] = node.name;
          }
          return false;
        }
      };
    }
  }
});

// ../api/node_modules/graphql/validation/rules/PossibleTypeExtensions.js
var require_PossibleTypeExtensions = __commonJS({
  "../api/node_modules/graphql/validation/rules/PossibleTypeExtensions.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", {
      value: true
    });
    exports.extendingUnknownTypeMessage = extendingUnknownTypeMessage;
    exports.extendingDifferentTypeKindMessage = extendingDifferentTypeKindMessage;
    exports.PossibleTypeExtensions = PossibleTypeExtensions;
    var _didYouMean = _interopRequireDefault(require_didYouMean());
    var _suggestionList = _interopRequireDefault(require_suggestionList());
    var _GraphQLError = require_GraphQLError();
    var _kinds = require_kinds();
    var _predicates = require_predicates();
    var _definition = require_definition();
    var _defKindToExtKind;
    function _interopRequireDefault(obj) {
      return obj && obj.__esModule ? obj : { default: obj };
    }
    function _defineProperty(obj, key, value) {
      if (key in obj) {
        Object.defineProperty(obj, key, { value, enumerable: true, configurable: true, writable: true });
      } else {
        obj[key] = value;
      }
      return obj;
    }
    function extendingUnknownTypeMessage(typeName, suggestedTypes) {
      return 'Cannot extend type "'.concat(typeName, '" because it is not defined.') + (0, _didYouMean.default)(suggestedTypes.map(function(x) {
        return '"'.concat(x, '"');
      }));
    }
    function extendingDifferentTypeKindMessage(typeName, kind) {
      return "Cannot extend non-".concat(kind, ' type "').concat(typeName, '".');
    }
    function PossibleTypeExtensions(context) {
      var schema = context.getSchema();
      var definedTypes = /* @__PURE__ */ Object.create(null);
      for (var _i2 = 0, _context$getDocument$2 = context.getDocument().definitions; _i2 < _context$getDocument$2.length; _i2++) {
        var def = _context$getDocument$2[_i2];
        if ((0, _predicates.isTypeDefinitionNode)(def)) {
          definedTypes[def.name.value] = def;
        }
      }
      return {
        ScalarTypeExtension: checkExtension,
        ObjectTypeExtension: checkExtension,
        InterfaceTypeExtension: checkExtension,
        UnionTypeExtension: checkExtension,
        EnumTypeExtension: checkExtension,
        InputObjectTypeExtension: checkExtension
      };
      function checkExtension(node) {
        var typeName = node.name.value;
        var defNode = definedTypes[typeName];
        var existingType = schema && schema.getType(typeName);
        if (defNode) {
          var expectedKind = defKindToExtKind[defNode.kind];
          if (expectedKind !== node.kind) {
            context.reportError(new _GraphQLError.GraphQLError(extendingDifferentTypeKindMessage(typeName, extensionKindToTypeName(expectedKind)), [defNode, node]));
          }
        } else if (existingType) {
          var _expectedKind = typeToExtKind(existingType);
          if (_expectedKind !== node.kind) {
            context.reportError(new _GraphQLError.GraphQLError(extendingDifferentTypeKindMessage(typeName, extensionKindToTypeName(_expectedKind)), node));
          }
        } else {
          var allTypeNames = Object.keys(definedTypes);
          if (schema) {
            allTypeNames = allTypeNames.concat(Object.keys(schema.getTypeMap()));
          }
          var suggestedTypes = (0, _suggestionList.default)(typeName, allTypeNames);
          context.reportError(new _GraphQLError.GraphQLError(extendingUnknownTypeMessage(typeName, suggestedTypes), node.name));
        }
      }
    }
    var defKindToExtKind = (_defKindToExtKind = {}, _defineProperty(_defKindToExtKind, _kinds.Kind.SCALAR_TYPE_DEFINITION, _kinds.Kind.SCALAR_TYPE_EXTENSION), _defineProperty(_defKindToExtKind, _kinds.Kind.OBJECT_TYPE_DEFINITION, _kinds.Kind.OBJECT_TYPE_EXTENSION), _defineProperty(_defKindToExtKind, _kinds.Kind.INTERFACE_TYPE_DEFINITION, _kinds.Kind.INTERFACE_TYPE_EXTENSION), _defineProperty(_defKindToExtKind, _kinds.Kind.UNION_TYPE_DEFINITION, _kinds.Kind.UNION_TYPE_EXTENSION), _defineProperty(_defKindToExtKind, _kinds.Kind.ENUM_TYPE_DEFINITION, _kinds.Kind.ENUM_TYPE_EXTENSION), _defineProperty(_defKindToExtKind, _kinds.Kind.INPUT_OBJECT_TYPE_DEFINITION, _kinds.Kind.INPUT_OBJECT_TYPE_EXTENSION), _defKindToExtKind);
    function typeToExtKind(type) {
      if ((0, _definition.isScalarType)(type)) {
        return _kinds.Kind.SCALAR_TYPE_EXTENSION;
      } else if ((0, _definition.isObjectType)(type)) {
        return _kinds.Kind.OBJECT_TYPE_EXTENSION;
      } else if ((0, _definition.isInterfaceType)(type)) {
        return _kinds.Kind.INTERFACE_TYPE_EXTENSION;
      } else if ((0, _definition.isUnionType)(type)) {
        return _kinds.Kind.UNION_TYPE_EXTENSION;
      } else if ((0, _definition.isEnumType)(type)) {
        return _kinds.Kind.ENUM_TYPE_EXTENSION;
      } else if ((0, _definition.isInputObjectType)(type)) {
        return _kinds.Kind.INPUT_OBJECT_TYPE_EXTENSION;
      }
    }
    function extensionKindToTypeName(kind) {
      switch (kind) {
        case _kinds.Kind.SCALAR_TYPE_EXTENSION:
          return "scalar";
        case _kinds.Kind.OBJECT_TYPE_EXTENSION:
          return "object";
        case _kinds.Kind.INTERFACE_TYPE_EXTENSION:
          return "interface";
        case _kinds.Kind.UNION_TYPE_EXTENSION:
          return "union";
        case _kinds.Kind.ENUM_TYPE_EXTENSION:
          return "enum";
        case _kinds.Kind.INPUT_OBJECT_TYPE_EXTENSION:
          return "input object";
        default:
          return "unknown type";
      }
    }
  }
});

// ../api/node_modules/graphql/validation/specifiedRules.js
var require_specifiedRules = __commonJS({
  "../api/node_modules/graphql/validation/specifiedRules.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", {
      value: true
    });
    exports.specifiedSDLRules = exports.specifiedRules = void 0;
    var _ExecutableDefinitions = require_ExecutableDefinitions();
    var _UniqueOperationNames = require_UniqueOperationNames();
    var _LoneAnonymousOperation = require_LoneAnonymousOperation();
    var _SingleFieldSubscriptions = require_SingleFieldSubscriptions();
    var _KnownTypeNames = require_KnownTypeNames();
    var _FragmentsOnCompositeTypes = require_FragmentsOnCompositeTypes();
    var _VariablesAreInputTypes = require_VariablesAreInputTypes();
    var _ScalarLeafs = require_ScalarLeafs();
    var _FieldsOnCorrectType = require_FieldsOnCorrectType();
    var _UniqueFragmentNames = require_UniqueFragmentNames();
    var _KnownFragmentNames = require_KnownFragmentNames();
    var _NoUnusedFragments = require_NoUnusedFragments();
    var _PossibleFragmentSpreads = require_PossibleFragmentSpreads();
    var _NoFragmentCycles = require_NoFragmentCycles();
    var _UniqueVariableNames = require_UniqueVariableNames();
    var _NoUndefinedVariables = require_NoUndefinedVariables();
    var _NoUnusedVariables = require_NoUnusedVariables();
    var _KnownDirectives = require_KnownDirectives();
    var _UniqueDirectivesPerLocation = require_UniqueDirectivesPerLocation();
    var _KnownArgumentNames = require_KnownArgumentNames();
    var _UniqueArgumentNames = require_UniqueArgumentNames();
    var _ValuesOfCorrectType = require_ValuesOfCorrectType();
    var _ProvidedRequiredArguments = require_ProvidedRequiredArguments();
    var _VariablesInAllowedPosition = require_VariablesInAllowedPosition();
    var _OverlappingFieldsCanBeMerged = require_OverlappingFieldsCanBeMerged();
    var _UniqueInputFieldNames = require_UniqueInputFieldNames();
    var _LoneSchemaDefinition = require_LoneSchemaDefinition();
    var _UniqueOperationTypes = require_UniqueOperationTypes();
    var _UniqueTypeNames = require_UniqueTypeNames();
    var _UniqueEnumValueNames = require_UniqueEnumValueNames();
    var _UniqueFieldDefinitionNames = require_UniqueFieldDefinitionNames();
    var _UniqueDirectiveNames = require_UniqueDirectiveNames();
    var _PossibleTypeExtensions = require_PossibleTypeExtensions();
    var specifiedRules = Object.freeze([_ExecutableDefinitions.ExecutableDefinitions, _UniqueOperationNames.UniqueOperationNames, _LoneAnonymousOperation.LoneAnonymousOperation, _SingleFieldSubscriptions.SingleFieldSubscriptions, _KnownTypeNames.KnownTypeNames, _FragmentsOnCompositeTypes.FragmentsOnCompositeTypes, _VariablesAreInputTypes.VariablesAreInputTypes, _ScalarLeafs.ScalarLeafs, _FieldsOnCorrectType.FieldsOnCorrectType, _UniqueFragmentNames.UniqueFragmentNames, _KnownFragmentNames.KnownFragmentNames, _NoUnusedFragments.NoUnusedFragments, _PossibleFragmentSpreads.PossibleFragmentSpreads, _NoFragmentCycles.NoFragmentCycles, _UniqueVariableNames.UniqueVariableNames, _NoUndefinedVariables.NoUndefinedVariables, _NoUnusedVariables.NoUnusedVariables, _KnownDirectives.KnownDirectives, _UniqueDirectivesPerLocation.UniqueDirectivesPerLocation, _KnownArgumentNames.KnownArgumentNames, _UniqueArgumentNames.UniqueArgumentNames, _ValuesOfCorrectType.ValuesOfCorrectType, _ProvidedRequiredArguments.ProvidedRequiredArguments, _VariablesInAllowedPosition.VariablesInAllowedPosition, _OverlappingFieldsCanBeMerged.OverlappingFieldsCanBeMerged, _UniqueInputFieldNames.UniqueInputFieldNames]);
    exports.specifiedRules = specifiedRules;
    var specifiedSDLRules = Object.freeze([_LoneSchemaDefinition.LoneSchemaDefinition, _UniqueOperationTypes.UniqueOperationTypes, _UniqueTypeNames.UniqueTypeNames, _UniqueEnumValueNames.UniqueEnumValueNames, _UniqueFieldDefinitionNames.UniqueFieldDefinitionNames, _UniqueDirectiveNames.UniqueDirectiveNames, _KnownTypeNames.KnownTypeNames, _KnownDirectives.KnownDirectives, _UniqueDirectivesPerLocation.UniqueDirectivesPerLocation, _PossibleTypeExtensions.PossibleTypeExtensions, _KnownArgumentNames.KnownArgumentNamesOnDirectives, _UniqueArgumentNames.UniqueArgumentNames, _UniqueInputFieldNames.UniqueInputFieldNames, _ProvidedRequiredArguments.ProvidedRequiredArgumentsOnDirectives]);
    exports.specifiedSDLRules = specifiedSDLRules;
  }
});

// ../api/node_modules/graphql/validation/ValidationContext.js
var require_ValidationContext = __commonJS({
  "../api/node_modules/graphql/validation/ValidationContext.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", {
      value: true
    });
    exports.ValidationContext = exports.SDLValidationContext = exports.ASTValidationContext = void 0;
    var _kinds = require_kinds();
    var _visitor = require_visitor();
    var _TypeInfo = require_TypeInfo();
    function _inheritsLoose(subClass, superClass) {
      subClass.prototype = Object.create(superClass.prototype);
      subClass.prototype.constructor = subClass;
      subClass.__proto__ = superClass;
    }
    var ASTValidationContext = /* @__PURE__ */ function() {
      function ASTValidationContext2(ast, onError) {
        this._ast = ast;
        this._errors = [];
        this._fragments = void 0;
        this._fragmentSpreads = /* @__PURE__ */ new Map();
        this._recursivelyReferencedFragments = /* @__PURE__ */ new Map();
        this._onError = onError;
      }
      var _proto = ASTValidationContext2.prototype;
      _proto.reportError = function reportError(error) {
        this._errors.push(error);
        if (this._onError) {
          this._onError(error);
        }
      };
      _proto.getErrors = function getErrors() {
        return this._errors;
      };
      _proto.getDocument = function getDocument() {
        return this._ast;
      };
      _proto.getFragment = function getFragment(name) {
        var fragments = this._fragments;
        if (!fragments) {
          this._fragments = fragments = this.getDocument().definitions.reduce(function(frags, statement) {
            if (statement.kind === _kinds.Kind.FRAGMENT_DEFINITION) {
              frags[statement.name.value] = statement;
            }
            return frags;
          }, /* @__PURE__ */ Object.create(null));
        }
        return fragments[name];
      };
      _proto.getFragmentSpreads = function getFragmentSpreads(node) {
        var spreads = this._fragmentSpreads.get(node);
        if (!spreads) {
          spreads = [];
          var setsToVisit = [node];
          while (setsToVisit.length !== 0) {
            var set = setsToVisit.pop();
            for (var _i2 = 0, _set$selections2 = set.selections; _i2 < _set$selections2.length; _i2++) {
              var selection = _set$selections2[_i2];
              if (selection.kind === _kinds.Kind.FRAGMENT_SPREAD) {
                spreads.push(selection);
              } else if (selection.selectionSet) {
                setsToVisit.push(selection.selectionSet);
              }
            }
          }
          this._fragmentSpreads.set(node, spreads);
        }
        return spreads;
      };
      _proto.getRecursivelyReferencedFragments = function getRecursivelyReferencedFragments(operation) {
        var fragments = this._recursivelyReferencedFragments.get(operation);
        if (!fragments) {
          fragments = [];
          var collectedNames = /* @__PURE__ */ Object.create(null);
          var nodesToVisit = [operation.selectionSet];
          while (nodesToVisit.length !== 0) {
            var node = nodesToVisit.pop();
            for (var _i4 = 0, _this$getFragmentSpre2 = this.getFragmentSpreads(node); _i4 < _this$getFragmentSpre2.length; _i4++) {
              var spread = _this$getFragmentSpre2[_i4];
              var fragName = spread.name.value;
              if (collectedNames[fragName] !== true) {
                collectedNames[fragName] = true;
                var fragment = this.getFragment(fragName);
                if (fragment) {
                  fragments.push(fragment);
                  nodesToVisit.push(fragment.selectionSet);
                }
              }
            }
          }
          this._recursivelyReferencedFragments.set(operation, fragments);
        }
        return fragments;
      };
      return ASTValidationContext2;
    }();
    exports.ASTValidationContext = ASTValidationContext;
    var SDLValidationContext = /* @__PURE__ */ function(_ASTValidationContext) {
      _inheritsLoose(SDLValidationContext2, _ASTValidationContext);
      function SDLValidationContext2(ast, schema, onError) {
        var _this;
        _this = _ASTValidationContext.call(this, ast, onError) || this;
        _this._schema = schema;
        return _this;
      }
      var _proto2 = SDLValidationContext2.prototype;
      _proto2.getSchema = function getSchema() {
        return this._schema;
      };
      return SDLValidationContext2;
    }(ASTValidationContext);
    exports.SDLValidationContext = SDLValidationContext;
    var ValidationContext = /* @__PURE__ */ function(_ASTValidationContext2) {
      _inheritsLoose(ValidationContext2, _ASTValidationContext2);
      function ValidationContext2(schema, ast, typeInfo, onError) {
        var _this2;
        _this2 = _ASTValidationContext2.call(this, ast, onError) || this;
        _this2._schema = schema;
        _this2._typeInfo = typeInfo;
        _this2._variableUsages = /* @__PURE__ */ new Map();
        _this2._recursiveVariableUsages = /* @__PURE__ */ new Map();
        return _this2;
      }
      var _proto3 = ValidationContext2.prototype;
      _proto3.getSchema = function getSchema() {
        return this._schema;
      };
      _proto3.getVariableUsages = function getVariableUsages(node) {
        var usages = this._variableUsages.get(node);
        if (!usages) {
          var newUsages = [];
          var typeInfo = new _TypeInfo.TypeInfo(this._schema);
          (0, _visitor.visit)(node, (0, _visitor.visitWithTypeInfo)(typeInfo, {
            VariableDefinition: function VariableDefinition() {
              return false;
            },
            Variable: function Variable(variable) {
              newUsages.push({
                node: variable,
                type: typeInfo.getInputType(),
                defaultValue: typeInfo.getDefaultValue()
              });
            }
          }));
          usages = newUsages;
          this._variableUsages.set(node, usages);
        }
        return usages;
      };
      _proto3.getRecursiveVariableUsages = function getRecursiveVariableUsages(operation) {
        var usages = this._recursiveVariableUsages.get(operation);
        if (!usages) {
          usages = this.getVariableUsages(operation);
          for (var _i6 = 0, _this$getRecursivelyR2 = this.getRecursivelyReferencedFragments(operation); _i6 < _this$getRecursivelyR2.length; _i6++) {
            var frag = _this$getRecursivelyR2[_i6];
            usages = usages.concat(this.getVariableUsages(frag));
          }
          this._recursiveVariableUsages.set(operation, usages);
        }
        return usages;
      };
      _proto3.getType = function getType() {
        return this._typeInfo.getType();
      };
      _proto3.getParentType = function getParentType() {
        return this._typeInfo.getParentType();
      };
      _proto3.getInputType = function getInputType() {
        return this._typeInfo.getInputType();
      };
      _proto3.getParentInputType = function getParentInputType() {
        return this._typeInfo.getParentInputType();
      };
      _proto3.getFieldDef = function getFieldDef() {
        return this._typeInfo.getFieldDef();
      };
      _proto3.getDirective = function getDirective() {
        return this._typeInfo.getDirective();
      };
      _proto3.getArgument = function getArgument() {
        return this._typeInfo.getArgument();
      };
      return ValidationContext2;
    }(ASTValidationContext);
    exports.ValidationContext = ValidationContext;
  }
});

// ../api/node_modules/graphql/validation/validate.js
var require_validate2 = __commonJS({
  "../api/node_modules/graphql/validation/validate.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", {
      value: true
    });
    exports.validate = validate;
    exports.validateSDL = validateSDL;
    exports.assertValidSDL = assertValidSDL;
    exports.assertValidSDLExtension = assertValidSDLExtension;
    exports.ABORT_VALIDATION = void 0;
    var _devAssert = _interopRequireDefault(require_devAssert());
    var _GraphQLError = require_GraphQLError();
    var _visitor = require_visitor();
    var _validate = require_validate();
    var _TypeInfo = require_TypeInfo();
    var _specifiedRules = require_specifiedRules();
    var _ValidationContext = require_ValidationContext();
    function _interopRequireDefault(obj) {
      return obj && obj.__esModule ? obj : { default: obj };
    }
    var ABORT_VALIDATION = Object.freeze({});
    exports.ABORT_VALIDATION = ABORT_VALIDATION;
    function validate(schema, documentAST) {
      var rules = arguments.length > 2 && arguments[2] !== void 0 ? arguments[2] : _specifiedRules.specifiedRules;
      var typeInfo = arguments.length > 3 && arguments[3] !== void 0 ? arguments[3] : new _TypeInfo.TypeInfo(schema);
      var options = arguments.length > 4 ? arguments[4] : void 0;
      documentAST || (0, _devAssert.default)(0, "Must provide document");
      (0, _validate.assertValidSchema)(schema);
      var abortObj = Object.freeze({});
      var errors = [];
      var maxErrors = options && options.maxErrors;
      var context = new _ValidationContext.ValidationContext(schema, documentAST, typeInfo, function(error) {
        if (maxErrors != null && errors.length >= maxErrors) {
          errors.push(new _GraphQLError.GraphQLError("Too many validation errors, error limit reached. Validation aborted."));
          throw abortObj;
        }
        errors.push(error);
      });
      var visitor = (0, _visitor.visitInParallel)(rules.map(function(rule) {
        return rule(context);
      }));
      try {
        (0, _visitor.visit)(documentAST, (0, _visitor.visitWithTypeInfo)(typeInfo, visitor));
      } catch (e) {
        if (e !== abortObj) {
          throw e;
        }
      }
      return errors;
    }
    function validateSDL(documentAST, schemaToExtend) {
      var rules = arguments.length > 2 && arguments[2] !== void 0 ? arguments[2] : _specifiedRules.specifiedSDLRules;
      var errors = [];
      var context = new _ValidationContext.SDLValidationContext(documentAST, schemaToExtend, function(error) {
        errors.push(error);
      });
      var visitors = rules.map(function(rule) {
        return rule(context);
      });
      (0, _visitor.visit)(documentAST, (0, _visitor.visitInParallel)(visitors));
      return errors;
    }
    function assertValidSDL(documentAST) {
      var errors = validateSDL(documentAST);
      if (errors.length !== 0) {
        throw new Error(errors.map(function(error) {
          return error.message;
        }).join("\n\n"));
      }
    }
    function assertValidSDLExtension(documentAST, schema) {
      var errors = validateSDL(documentAST, schema);
      if (errors.length !== 0) {
        throw new Error(errors.map(function(error) {
          return error.message;
        }).join("\n\n"));
      }
    }
  }
});

// ../api/node_modules/graphql/jsutils/memoize3.js
var require_memoize3 = __commonJS({
  "../api/node_modules/graphql/jsutils/memoize3.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", {
      value: true
    });
    exports.default = memoize3;
    function memoize3(fn) {
      var cache0;
      function memoized(a1, a2, a3) {
        if (!cache0) {
          cache0 = /* @__PURE__ */ new WeakMap();
        }
        var cache1 = cache0.get(a1);
        var cache2;
        if (cache1) {
          cache2 = cache1.get(a2);
          if (cache2) {
            var cachedValue = cache2.get(a3);
            if (cachedValue !== void 0) {
              return cachedValue;
            }
          }
        } else {
          cache1 = /* @__PURE__ */ new WeakMap();
          cache0.set(a1, cache1);
        }
        if (!cache2) {
          cache2 = /* @__PURE__ */ new WeakMap();
          cache1.set(a2, cache2);
        }
        var newValue = fn(a1, a2, a3);
        cache2.set(a3, newValue);
        return newValue;
      }
      return memoized;
    }
  }
});

// ../api/node_modules/graphql/jsutils/promiseReduce.js
var require_promiseReduce = __commonJS({
  "../api/node_modules/graphql/jsutils/promiseReduce.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", {
      value: true
    });
    exports.default = promiseReduce;
    var _isPromise = _interopRequireDefault(require_isPromise());
    function _interopRequireDefault(obj) {
      return obj && obj.__esModule ? obj : { default: obj };
    }
    function promiseReduce(values, callback, initialValue) {
      return values.reduce(function(previous, value) {
        return (0, _isPromise.default)(previous) ? previous.then(function(resolved) {
          return callback(resolved, value);
        }) : callback(previous, value);
      }, initialValue);
    }
  }
});

// ../api/node_modules/graphql/jsutils/promiseForObject.js
var require_promiseForObject = __commonJS({
  "../api/node_modules/graphql/jsutils/promiseForObject.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", {
      value: true
    });
    exports.default = promiseForObject;
    function promiseForObject(object) {
      var keys = Object.keys(object);
      var valuesAndPromises = keys.map(function(name) {
        return object[name];
      });
      return Promise.all(valuesAndPromises).then(function(values) {
        return values.reduce(function(resolvedObject, value, i) {
          resolvedObject[keys[i]] = value;
          return resolvedObject;
        }, /* @__PURE__ */ Object.create(null));
      });
    }
  }
});

// ../api/node_modules/graphql/jsutils/Path.js
var require_Path = __commonJS({
  "../api/node_modules/graphql/jsutils/Path.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", {
      value: true
    });
    exports.addPath = addPath;
    exports.pathToArray = pathToArray;
    function addPath(prev, key) {
      return {
        prev,
        key
      };
    }
    function pathToArray(path) {
      var flattened = [];
      var curr = path;
      while (curr) {
        flattened.push(curr.key);
        curr = curr.prev;
      }
      return flattened.reverse();
    }
  }
});

// ../api/node_modules/graphql/error/locatedError.js
var require_locatedError = __commonJS({
  "../api/node_modules/graphql/error/locatedError.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", {
      value: true
    });
    exports.locatedError = locatedError;
    var _GraphQLError = require_GraphQLError();
    function locatedError(originalError, nodes, path) {
      if (originalError && Array.isArray(originalError.path)) {
        return originalError;
      }
      return new _GraphQLError.GraphQLError(originalError && originalError.message, originalError && originalError.nodes || nodes, originalError && originalError.source, originalError && originalError.positions, path, originalError);
    }
  }
});

// ../api/node_modules/graphql/utilities/getOperationRootType.js
var require_getOperationRootType = __commonJS({
  "../api/node_modules/graphql/utilities/getOperationRootType.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", {
      value: true
    });
    exports.getOperationRootType = getOperationRootType;
    var _GraphQLError = require_GraphQLError();
    function getOperationRootType(schema, operation) {
      if (operation.operation === "query") {
        var queryType = schema.getQueryType();
        if (!queryType) {
          throw new _GraphQLError.GraphQLError("Schema does not define the required query root type.", operation);
        }
        return queryType;
      }
      if (operation.operation === "mutation") {
        var mutationType = schema.getMutationType();
        if (!mutationType) {
          throw new _GraphQLError.GraphQLError("Schema is not configured for mutations.", operation);
        }
        return mutationType;
      }
      if (operation.operation === "subscription") {
        var subscriptionType = schema.getSubscriptionType();
        if (!subscriptionType) {
          throw new _GraphQLError.GraphQLError("Schema is not configured for subscriptions.", operation);
        }
        return subscriptionType;
      }
      throw new _GraphQLError.GraphQLError("Can only have query, mutation and subscription operations.", operation);
    }
  }
});

// ../api/node_modules/graphql/jsutils/printPathArray.js
var require_printPathArray = __commonJS({
  "../api/node_modules/graphql/jsutils/printPathArray.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", {
      value: true
    });
    exports.default = printPathArray;
    function printPathArray(path) {
      return path.map(function(key) {
        return typeof key === "number" ? "[" + key.toString() + "]" : "." + key;
      }).join("");
    }
  }
});

// ../api/node_modules/graphql/utilities/valueFromAST.js
var require_valueFromAST = __commonJS({
  "../api/node_modules/graphql/utilities/valueFromAST.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", {
      value: true
    });
    exports.valueFromAST = valueFromAST;
    var _objectValues3 = _interopRequireDefault(require_objectValues());
    var _keyMap = _interopRequireDefault(require_keyMap());
    var _inspect = _interopRequireDefault(require_inspect());
    var _invariant = _interopRequireDefault(require_invariant());
    var _isInvalid = _interopRequireDefault(require_isInvalid());
    var _kinds = require_kinds();
    var _definition = require_definition();
    function _interopRequireDefault(obj) {
      return obj && obj.__esModule ? obj : { default: obj };
    }
    function valueFromAST(valueNode, type, variables) {
      if (!valueNode) {
        return;
      }
      if ((0, _definition.isNonNullType)(type)) {
        if (valueNode.kind === _kinds.Kind.NULL) {
          return;
        }
        return valueFromAST(valueNode, type.ofType, variables);
      }
      if (valueNode.kind === _kinds.Kind.NULL) {
        return null;
      }
      if (valueNode.kind === _kinds.Kind.VARIABLE) {
        var variableName = valueNode.name.value;
        if (!variables || (0, _isInvalid.default)(variables[variableName])) {
          return;
        }
        var variableValue = variables[variableName];
        if (variableValue === null && (0, _definition.isNonNullType)(type)) {
          return;
        }
        return variableValue;
      }
      if ((0, _definition.isListType)(type)) {
        var itemType = type.ofType;
        if (valueNode.kind === _kinds.Kind.LIST) {
          var coercedValues = [];
          for (var _i2 = 0, _valueNode$values2 = valueNode.values; _i2 < _valueNode$values2.length; _i2++) {
            var itemNode = _valueNode$values2[_i2];
            if (isMissingVariable(itemNode, variables)) {
              if ((0, _definition.isNonNullType)(itemType)) {
                return;
              }
              coercedValues.push(null);
            } else {
              var itemValue = valueFromAST(itemNode, itemType, variables);
              if ((0, _isInvalid.default)(itemValue)) {
                return;
              }
              coercedValues.push(itemValue);
            }
          }
          return coercedValues;
        }
        var coercedValue = valueFromAST(valueNode, itemType, variables);
        if ((0, _isInvalid.default)(coercedValue)) {
          return;
        }
        return [coercedValue];
      }
      if ((0, _definition.isInputObjectType)(type)) {
        if (valueNode.kind !== _kinds.Kind.OBJECT) {
          return;
        }
        var coercedObj = /* @__PURE__ */ Object.create(null);
        var fieldNodes = (0, _keyMap.default)(valueNode.fields, function(field2) {
          return field2.name.value;
        });
        for (var _i4 = 0, _objectValues2 = (0, _objectValues3.default)(type.getFields()); _i4 < _objectValues2.length; _i4++) {
          var field = _objectValues2[_i4];
          var fieldNode = fieldNodes[field.name];
          if (!fieldNode || isMissingVariable(fieldNode.value, variables)) {
            if (field.defaultValue !== void 0) {
              coercedObj[field.name] = field.defaultValue;
            } else if ((0, _definition.isNonNullType)(field.type)) {
              return;
            }
            continue;
          }
          var fieldValue = valueFromAST(fieldNode.value, field.type, variables);
          if ((0, _isInvalid.default)(fieldValue)) {
            return;
          }
          coercedObj[field.name] = fieldValue;
        }
        return coercedObj;
      }
      if ((0, _definition.isEnumType)(type)) {
        if (valueNode.kind !== _kinds.Kind.ENUM) {
          return;
        }
        var enumValue = type.getValue(valueNode.value);
        if (!enumValue) {
          return;
        }
        return enumValue.value;
      }
      if ((0, _definition.isScalarType)(type)) {
        var result;
        try {
          result = type.parseLiteral(valueNode, variables);
        } catch (_error) {
          return;
        }
        if ((0, _isInvalid.default)(result)) {
          return;
        }
        return result;
      }
      (0, _invariant.default)(false, "Unexpected input type: " + (0, _inspect.default)(type));
    }
    function isMissingVariable(valueNode, variables) {
      return valueNode.kind === _kinds.Kind.VARIABLE && (!variables || (0, _isInvalid.default)(variables[valueNode.name.value]));
    }
  }
});

// ../api/node_modules/graphql/utilities/coerceInputValue.js
var require_coerceInputValue = __commonJS({
  "../api/node_modules/graphql/utilities/coerceInputValue.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", {
      value: true
    });
    exports.coerceInputValue = coerceInputValue;
    var _iterall = require_iterall();
    var _objectValues3 = _interopRequireDefault(require_objectValues());
    var _inspect = _interopRequireDefault(require_inspect());
    var _invariant = _interopRequireDefault(require_invariant());
    var _didYouMean = _interopRequireDefault(require_didYouMean());
    var _isObjectLike = _interopRequireDefault(require_isObjectLike());
    var _suggestionList = _interopRequireDefault(require_suggestionList());
    var _printPathArray = _interopRequireDefault(require_printPathArray());
    var _Path = require_Path();
    var _GraphQLError = require_GraphQLError();
    var _definition = require_definition();
    function _interopRequireDefault(obj) {
      return obj && obj.__esModule ? obj : { default: obj };
    }
    function coerceInputValue(inputValue, type) {
      var onError = arguments.length > 2 && arguments[2] !== void 0 ? arguments[2] : defaultOnError;
      return coerceInputValueImpl(inputValue, type, onError);
    }
    function defaultOnError(path, invalidValue, error) {
      var errorPrefix = "Invalid value " + (0, _inspect.default)(invalidValue);
      if (path.length > 0) {
        errorPrefix += ' at "value'.concat((0, _printPathArray.default)(path), '": ');
      }
      error.message = errorPrefix + ": " + error.message;
      throw error;
    }
    function coerceInputValueImpl(inputValue, type, onError, path) {
      if ((0, _definition.isNonNullType)(type)) {
        if (inputValue != null) {
          return coerceInputValueImpl(inputValue, type.ofType, onError, path);
        }
        onError((0, _Path.pathToArray)(path), inputValue, new _GraphQLError.GraphQLError("Expected non-nullable type ".concat((0, _inspect.default)(type), " not to be null.")));
        return;
      }
      if (inputValue == null) {
        return null;
      }
      if ((0, _definition.isListType)(type)) {
        var itemType = type.ofType;
        if ((0, _iterall.isCollection)(inputValue)) {
          var coercedValue = [];
          (0, _iterall.forEach)(inputValue, function(itemValue, index) {
            coercedValue.push(coerceInputValueImpl(itemValue, itemType, onError, (0, _Path.addPath)(path, index)));
          });
          return coercedValue;
        }
        return [coerceInputValueImpl(inputValue, itemType, onError, path)];
      }
      if ((0, _definition.isInputObjectType)(type)) {
        if (!(0, _isObjectLike.default)(inputValue)) {
          onError((0, _Path.pathToArray)(path), inputValue, new _GraphQLError.GraphQLError("Expected type ".concat(type.name, " to be an object.")));
          return;
        }
        var _coercedValue = {};
        var fieldDefs = type.getFields();
        for (var _i2 = 0, _objectValues2 = (0, _objectValues3.default)(fieldDefs); _i2 < _objectValues2.length; _i2++) {
          var field = _objectValues2[_i2];
          var fieldValue = inputValue[field.name];
          if (fieldValue === void 0) {
            if (field.defaultValue !== void 0) {
              _coercedValue[field.name] = field.defaultValue;
            } else if ((0, _definition.isNonNullType)(field.type)) {
              var typeStr = (0, _inspect.default)(field.type);
              onError((0, _Path.pathToArray)(path), inputValue, new _GraphQLError.GraphQLError("Field ".concat(field.name, " of required type ").concat(typeStr, " was not provided.")));
            }
            continue;
          }
          _coercedValue[field.name] = coerceInputValueImpl(fieldValue, field.type, onError, (0, _Path.addPath)(path, field.name));
        }
        for (var _i4 = 0, _Object$keys2 = Object.keys(inputValue); _i4 < _Object$keys2.length; _i4++) {
          var fieldName = _Object$keys2[_i4];
          if (!fieldDefs[fieldName]) {
            var suggestions = (0, _suggestionList.default)(fieldName, Object.keys(type.getFields()));
            onError((0, _Path.pathToArray)(path), inputValue, new _GraphQLError.GraphQLError('Field "'.concat(fieldName, '" is not defined by type ').concat(type.name, ".") + (0, _didYouMean.default)(suggestions)));
          }
        }
        return _coercedValue;
      }
      if ((0, _definition.isScalarType)(type)) {
        var parseResult;
        try {
          parseResult = type.parseValue(inputValue);
        } catch (error) {
          onError((0, _Path.pathToArray)(path), inputValue, new _GraphQLError.GraphQLError("Expected type ".concat(type.name, ". ") + error.message, void 0, void 0, void 0, void 0, error));
          return;
        }
        if (parseResult === void 0) {
          onError((0, _Path.pathToArray)(path), inputValue, new _GraphQLError.GraphQLError("Expected type ".concat(type.name, ".")));
        }
        return parseResult;
      }
      if ((0, _definition.isEnumType)(type)) {
        if (typeof inputValue === "string") {
          var enumValue = type.getValue(inputValue);
          if (enumValue) {
            return enumValue.value;
          }
        }
        var _suggestions = (0, _suggestionList.default)(String(inputValue), type.getValues().map(function(enumValue2) {
          return enumValue2.name;
        }));
        onError((0, _Path.pathToArray)(path), inputValue, new _GraphQLError.GraphQLError("Expected type ".concat(type.name, ".") + (0, _didYouMean.default)(_suggestions)));
        return;
      }
      (0, _invariant.default)(false, "Unexpected input type: " + (0, _inspect.default)(type));
    }
  }
});

// ../api/node_modules/graphql/execution/values.js
var require_values = __commonJS({
  "../api/node_modules/graphql/execution/values.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", {
      value: true
    });
    exports.getVariableValues = getVariableValues;
    exports.getArgumentValues = getArgumentValues;
    exports.getDirectiveValues = getDirectiveValues;
    var _find = _interopRequireDefault(require_find());
    var _keyMap = _interopRequireDefault(require_keyMap());
    var _inspect = _interopRequireDefault(require_inspect());
    var _printPathArray = _interopRequireDefault(require_printPathArray());
    var _GraphQLError = require_GraphQLError();
    var _kinds = require_kinds();
    var _printer = require_printer();
    var _definition = require_definition();
    var _typeFromAST = require_typeFromAST();
    var _valueFromAST = require_valueFromAST();
    var _coerceInputValue = require_coerceInputValue();
    function _interopRequireDefault(obj) {
      return obj && obj.__esModule ? obj : { default: obj };
    }
    function getVariableValues(schema, varDefNodes, inputs, options) {
      var maxErrors = options && options.maxErrors;
      var errors = [];
      try {
        var coerced = coerceVariableValues(schema, varDefNodes, inputs, function(error) {
          if (maxErrors != null && errors.length >= maxErrors) {
            throw new _GraphQLError.GraphQLError("Too many errors processing variables, error limit reached. Execution aborted.");
          }
          errors.push(error);
        });
        if (errors.length === 0) {
          return {
            coerced
          };
        }
      } catch (error) {
        errors.push(error);
      }
      return {
        errors
      };
    }
    function coerceVariableValues(schema, varDefNodes, inputs, onError) {
      var coercedValues = {};
      var _loop = function _loop2(_i22) {
        var varDefNode = varDefNodes[_i22];
        var varName = varDefNode.variable.name.value;
        var varType = (0, _typeFromAST.typeFromAST)(schema, varDefNode.type);
        if (!(0, _definition.isInputType)(varType)) {
          var varTypeStr = (0, _printer.print)(varDefNode.type);
          onError(new _GraphQLError.GraphQLError('Variable "$'.concat(varName, '" expected value of type "').concat(varTypeStr, '" which cannot be used as an input type.'), varDefNode.type));
          return "continue";
        }
        if (!hasOwnProperty(inputs, varName)) {
          if (varDefNode.defaultValue) {
            coercedValues[varName] = (0, _valueFromAST.valueFromAST)(varDefNode.defaultValue, varType);
          } else if ((0, _definition.isNonNullType)(varType)) {
            var _varTypeStr = (0, _inspect.default)(varType);
            onError(new _GraphQLError.GraphQLError('Variable "$'.concat(varName, '" of required type "').concat(_varTypeStr, '" was not provided.'), varDefNode));
          }
          return "continue";
        }
        var value = inputs[varName];
        if (value === null && (0, _definition.isNonNullType)(varType)) {
          var _varTypeStr2 = (0, _inspect.default)(varType);
          onError(new _GraphQLError.GraphQLError('Variable "$'.concat(varName, '" of non-null type "').concat(_varTypeStr2, '" must not be null.'), varDefNode));
          return "continue";
        }
        coercedValues[varName] = (0, _coerceInputValue.coerceInputValue)(value, varType, function(path, invalidValue, error) {
          var prefix = 'Variable "$'.concat(varName, '" got invalid value ') + (0, _inspect.default)(invalidValue);
          if (path.length > 0) {
            prefix += ' at "'.concat(varName).concat((0, _printPathArray.default)(path), '"');
          }
          onError(new _GraphQLError.GraphQLError(prefix + "; " + error.message, varDefNode, void 0, void 0, void 0, error.originalError));
        });
      };
      for (var _i2 = 0; _i2 < varDefNodes.length; _i2++) {
        var _ret = _loop(_i2);
        if (_ret === "continue")
          continue;
      }
      return coercedValues;
    }
    function getArgumentValues(def, node, variableValues) {
      var coercedValues = {};
      var argNodeMap = (0, _keyMap.default)(node.arguments || [], function(arg) {
        return arg.name.value;
      });
      for (var _i4 = 0, _def$args2 = def.args; _i4 < _def$args2.length; _i4++) {
        var argDef = _def$args2[_i4];
        var name = argDef.name;
        var argType = argDef.type;
        var argumentNode = argNodeMap[name];
        if (!argumentNode) {
          if (argDef.defaultValue !== void 0) {
            coercedValues[name] = argDef.defaultValue;
          } else if ((0, _definition.isNonNullType)(argType)) {
            throw new _GraphQLError.GraphQLError('Argument "'.concat(name, '" of required type "').concat((0, _inspect.default)(argType), '" ') + "was not provided.", node);
          }
          continue;
        }
        var valueNode = argumentNode.value;
        var isNull = valueNode.kind === _kinds.Kind.NULL;
        if (valueNode.kind === _kinds.Kind.VARIABLE) {
          var variableName = valueNode.name.value;
          if (variableValues == null || !hasOwnProperty(variableValues, variableName)) {
            if (argDef.defaultValue !== void 0) {
              coercedValues[name] = argDef.defaultValue;
            } else if ((0, _definition.isNonNullType)(argType)) {
              throw new _GraphQLError.GraphQLError('Argument "'.concat(name, '" of required type "').concat((0, _inspect.default)(argType), '" ') + 'was provided the variable "$'.concat(variableName, '" which was not provided a runtime value.'), valueNode);
            }
            continue;
          }
          isNull = variableValues[variableName] == null;
        }
        if (isNull && (0, _definition.isNonNullType)(argType)) {
          throw new _GraphQLError.GraphQLError('Argument "'.concat(name, '" of non-null type "').concat((0, _inspect.default)(argType), '" ') + "must not be null.", valueNode);
        }
        var coercedValue = (0, _valueFromAST.valueFromAST)(valueNode, argType, variableValues);
        if (coercedValue === void 0) {
          throw new _GraphQLError.GraphQLError('Argument "'.concat(name, '" has invalid value ').concat((0, _printer.print)(valueNode), "."), valueNode);
        }
        coercedValues[name] = coercedValue;
      }
      return coercedValues;
    }
    function getDirectiveValues(directiveDef, node, variableValues) {
      var directiveNode = node.directives && (0, _find.default)(node.directives, function(directive) {
        return directive.name.value === directiveDef.name;
      });
      if (directiveNode) {
        return getArgumentValues(directiveDef, directiveNode, variableValues);
      }
    }
    function hasOwnProperty(obj, prop) {
      return Object.prototype.hasOwnProperty.call(obj, prop);
    }
  }
});

// ../api/node_modules/graphql/execution/execute.js
var require_execute = __commonJS({
  "../api/node_modules/graphql/execution/execute.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", {
      value: true
    });
    exports.execute = execute;
    exports.assertValidExecutionArguments = assertValidExecutionArguments;
    exports.buildExecutionContext = buildExecutionContext;
    exports.collectFields = collectFields;
    exports.buildResolveInfo = buildResolveInfo;
    exports.resolveFieldValueOrError = resolveFieldValueOrError;
    exports.getFieldDef = getFieldDef;
    exports.defaultFieldResolver = exports.defaultTypeResolver = void 0;
    var _iterall = require_iterall();
    var _inspect = _interopRequireDefault(require_inspect());
    var _memoize = _interopRequireDefault(require_memoize3());
    var _invariant = _interopRequireDefault(require_invariant());
    var _devAssert = _interopRequireDefault(require_devAssert());
    var _isInvalid = _interopRequireDefault(require_isInvalid());
    var _isNullish = _interopRequireDefault(require_isNullish());
    var _isPromise = _interopRequireDefault(require_isPromise());
    var _isObjectLike = _interopRequireDefault(require_isObjectLike());
    var _promiseReduce = _interopRequireDefault(require_promiseReduce());
    var _promiseForObject = _interopRequireDefault(require_promiseForObject());
    var _Path = require_Path();
    var _GraphQLError = require_GraphQLError();
    var _locatedError = require_locatedError();
    var _kinds = require_kinds();
    var _validate = require_validate();
    var _introspection = require_introspection();
    var _directives = require_directives();
    var _definition = require_definition();
    var _typeFromAST = require_typeFromAST();
    var _getOperationRootType = require_getOperationRootType();
    var _values = require_values();
    function _interopRequireDefault(obj) {
      return obj && obj.__esModule ? obj : { default: obj };
    }
    function execute(argsOrSchema, document, rootValue, contextValue, variableValues, operationName, fieldResolver, typeResolver) {
      return arguments.length === 1 ? executeImpl(argsOrSchema) : executeImpl({
        schema: argsOrSchema,
        document,
        rootValue,
        contextValue,
        variableValues,
        operationName,
        fieldResolver,
        typeResolver
      });
    }
    function executeImpl(args) {
      var schema = args.schema, document = args.document, rootValue = args.rootValue, contextValue = args.contextValue, variableValues = args.variableValues, operationName = args.operationName, fieldResolver = args.fieldResolver, typeResolver = args.typeResolver;
      assertValidExecutionArguments(schema, document, variableValues);
      var exeContext = buildExecutionContext(schema, document, rootValue, contextValue, variableValues, operationName, fieldResolver, typeResolver);
      if (Array.isArray(exeContext)) {
        return {
          errors: exeContext
        };
      }
      var data = executeOperation(exeContext, exeContext.operation, rootValue);
      return buildResponse(exeContext, data);
    }
    function buildResponse(exeContext, data) {
      if ((0, _isPromise.default)(data)) {
        return data.then(function(resolved) {
          return buildResponse(exeContext, resolved);
        });
      }
      return exeContext.errors.length === 0 ? {
        data
      } : {
        errors: exeContext.errors,
        data
      };
    }
    function assertValidExecutionArguments(schema, document, rawVariableValues) {
      document || (0, _devAssert.default)(0, "Must provide document");
      (0, _validate.assertValidSchema)(schema);
      rawVariableValues == null || (0, _isObjectLike.default)(rawVariableValues) || (0, _devAssert.default)(0, "Variables must be provided as an Object where each property is a variable value. Perhaps look to see if an unparsed JSON string was provided.");
    }
    function buildExecutionContext(schema, document, rootValue, contextValue, rawVariableValues, operationName, fieldResolver, typeResolver) {
      var operation;
      var hasMultipleAssumedOperations = false;
      var fragments = /* @__PURE__ */ Object.create(null);
      for (var _i2 = 0, _document$definitions2 = document.definitions; _i2 < _document$definitions2.length; _i2++) {
        var definition = _document$definitions2[_i2];
        switch (definition.kind) {
          case _kinds.Kind.OPERATION_DEFINITION:
            if (!operationName && operation) {
              hasMultipleAssumedOperations = true;
            } else if (!operationName || definition.name && definition.name.value === operationName) {
              operation = definition;
            }
            break;
          case _kinds.Kind.FRAGMENT_DEFINITION:
            fragments[definition.name.value] = definition;
            break;
        }
      }
      if (!operation) {
        if (operationName) {
          return [new _GraphQLError.GraphQLError('Unknown operation named "'.concat(operationName, '".'))];
        }
        return [new _GraphQLError.GraphQLError("Must provide an operation.")];
      }
      if (hasMultipleAssumedOperations) {
        return [new _GraphQLError.GraphQLError("Must provide operation name if query contains multiple operations.")];
      }
      var coercedVariableValues = (0, _values.getVariableValues)(schema, operation.variableDefinitions || [], rawVariableValues || {}, {
        maxErrors: 50
      });
      if (coercedVariableValues.errors) {
        return coercedVariableValues.errors;
      }
      return {
        schema,
        fragments,
        rootValue,
        contextValue,
        operation,
        variableValues: coercedVariableValues.coerced,
        fieldResolver: fieldResolver || defaultFieldResolver,
        typeResolver: typeResolver || defaultTypeResolver,
        errors: []
      };
    }
    function executeOperation(exeContext, operation, rootValue) {
      var type = (0, _getOperationRootType.getOperationRootType)(exeContext.schema, operation);
      var fields = collectFields(exeContext, type, operation.selectionSet, /* @__PURE__ */ Object.create(null), /* @__PURE__ */ Object.create(null));
      var path = void 0;
      try {
        var result = operation.operation === "mutation" ? executeFieldsSerially(exeContext, type, rootValue, path, fields) : executeFields(exeContext, type, rootValue, path, fields);
        if ((0, _isPromise.default)(result)) {
          return result.then(void 0, function(error) {
            exeContext.errors.push(error);
            return Promise.resolve(null);
          });
        }
        return result;
      } catch (error) {
        exeContext.errors.push(error);
        return null;
      }
    }
    function executeFieldsSerially(exeContext, parentType, sourceValue, path, fields) {
      return (0, _promiseReduce.default)(Object.keys(fields), function(results, responseName) {
        var fieldNodes = fields[responseName];
        var fieldPath = (0, _Path.addPath)(path, responseName);
        var result = resolveField(exeContext, parentType, sourceValue, fieldNodes, fieldPath);
        if (result === void 0) {
          return results;
        }
        if ((0, _isPromise.default)(result)) {
          return result.then(function(resolvedResult) {
            results[responseName] = resolvedResult;
            return results;
          });
        }
        results[responseName] = result;
        return results;
      }, /* @__PURE__ */ Object.create(null));
    }
    function executeFields(exeContext, parentType, sourceValue, path, fields) {
      var results = /* @__PURE__ */ Object.create(null);
      var containsPromise = false;
      for (var _i4 = 0, _Object$keys2 = Object.keys(fields); _i4 < _Object$keys2.length; _i4++) {
        var responseName = _Object$keys2[_i4];
        var fieldNodes = fields[responseName];
        var fieldPath = (0, _Path.addPath)(path, responseName);
        var result = resolveField(exeContext, parentType, sourceValue, fieldNodes, fieldPath);
        if (result !== void 0) {
          results[responseName] = result;
          if (!containsPromise && (0, _isPromise.default)(result)) {
            containsPromise = true;
          }
        }
      }
      if (!containsPromise) {
        return results;
      }
      return (0, _promiseForObject.default)(results);
    }
    function collectFields(exeContext, runtimeType, selectionSet, fields, visitedFragmentNames) {
      for (var _i6 = 0, _selectionSet$selecti2 = selectionSet.selections; _i6 < _selectionSet$selecti2.length; _i6++) {
        var selection = _selectionSet$selecti2[_i6];
        switch (selection.kind) {
          case _kinds.Kind.FIELD: {
            if (!shouldIncludeNode(exeContext, selection)) {
              continue;
            }
            var name = getFieldEntryKey(selection);
            if (!fields[name]) {
              fields[name] = [];
            }
            fields[name].push(selection);
            break;
          }
          case _kinds.Kind.INLINE_FRAGMENT: {
            if (!shouldIncludeNode(exeContext, selection) || !doesFragmentConditionMatch(exeContext, selection, runtimeType)) {
              continue;
            }
            collectFields(exeContext, runtimeType, selection.selectionSet, fields, visitedFragmentNames);
            break;
          }
          case _kinds.Kind.FRAGMENT_SPREAD: {
            var fragName = selection.name.value;
            if (visitedFragmentNames[fragName] || !shouldIncludeNode(exeContext, selection)) {
              continue;
            }
            visitedFragmentNames[fragName] = true;
            var fragment = exeContext.fragments[fragName];
            if (!fragment || !doesFragmentConditionMatch(exeContext, fragment, runtimeType)) {
              continue;
            }
            collectFields(exeContext, runtimeType, fragment.selectionSet, fields, visitedFragmentNames);
            break;
          }
        }
      }
      return fields;
    }
    function shouldIncludeNode(exeContext, node) {
      var skip = (0, _values.getDirectiveValues)(_directives.GraphQLSkipDirective, node, exeContext.variableValues);
      if (skip && skip.if === true) {
        return false;
      }
      var include = (0, _values.getDirectiveValues)(_directives.GraphQLIncludeDirective, node, exeContext.variableValues);
      if (include && include.if === false) {
        return false;
      }
      return true;
    }
    function doesFragmentConditionMatch(exeContext, fragment, type) {
      var typeConditionNode = fragment.typeCondition;
      if (!typeConditionNode) {
        return true;
      }
      var conditionalType = (0, _typeFromAST.typeFromAST)(exeContext.schema, typeConditionNode);
      if (conditionalType === type) {
        return true;
      }
      if ((0, _definition.isAbstractType)(conditionalType)) {
        return exeContext.schema.isPossibleType(conditionalType, type);
      }
      return false;
    }
    function getFieldEntryKey(node) {
      return node.alias ? node.alias.value : node.name.value;
    }
    function resolveField(exeContext, parentType, source, fieldNodes, path) {
      var fieldNode = fieldNodes[0];
      var fieldName = fieldNode.name.value;
      var fieldDef = getFieldDef(exeContext.schema, parentType, fieldName);
      if (!fieldDef) {
        return;
      }
      var resolveFn = fieldDef.resolve || exeContext.fieldResolver;
      var info = buildResolveInfo(exeContext, fieldDef, fieldNodes, parentType, path);
      var result = resolveFieldValueOrError(exeContext, fieldDef, fieldNodes, resolveFn, source, info);
      return completeValueCatchingError(exeContext, fieldDef.type, fieldNodes, info, path, result);
    }
    function buildResolveInfo(exeContext, fieldDef, fieldNodes, parentType, path) {
      return {
        fieldName: fieldDef.name,
        fieldNodes,
        returnType: fieldDef.type,
        parentType,
        path,
        schema: exeContext.schema,
        fragments: exeContext.fragments,
        rootValue: exeContext.rootValue,
        operation: exeContext.operation,
        variableValues: exeContext.variableValues
      };
    }
    function resolveFieldValueOrError(exeContext, fieldDef, fieldNodes, resolveFn, source, info) {
      try {
        var args = (0, _values.getArgumentValues)(fieldDef, fieldNodes[0], exeContext.variableValues);
        var _contextValue = exeContext.contextValue;
        var result = resolveFn(source, args, _contextValue, info);
        return (0, _isPromise.default)(result) ? result.then(void 0, asErrorInstance) : result;
      } catch (error) {
        return asErrorInstance(error);
      }
    }
    function asErrorInstance(error) {
      if (error instanceof Error) {
        return error;
      }
      return new Error("Unexpected error value: " + (0, _inspect.default)(error));
    }
    function completeValueCatchingError(exeContext, returnType, fieldNodes, info, path, result) {
      try {
        var completed;
        if ((0, _isPromise.default)(result)) {
          completed = result.then(function(resolved) {
            return completeValue(exeContext, returnType, fieldNodes, info, path, resolved);
          });
        } else {
          completed = completeValue(exeContext, returnType, fieldNodes, info, path, result);
        }
        if ((0, _isPromise.default)(completed)) {
          return completed.then(void 0, function(error) {
            return handleFieldError(error, fieldNodes, path, returnType, exeContext);
          });
        }
        return completed;
      } catch (error) {
        return handleFieldError(error, fieldNodes, path, returnType, exeContext);
      }
    }
    function handleFieldError(rawError, fieldNodes, path, returnType, exeContext) {
      var error = (0, _locatedError.locatedError)(asErrorInstance(rawError), fieldNodes, (0, _Path.pathToArray)(path));
      if ((0, _definition.isNonNullType)(returnType)) {
        throw error;
      }
      exeContext.errors.push(error);
      return null;
    }
    function completeValue(exeContext, returnType, fieldNodes, info, path, result) {
      if (result instanceof Error) {
        throw result;
      }
      if ((0, _definition.isNonNullType)(returnType)) {
        var completed = completeValue(exeContext, returnType.ofType, fieldNodes, info, path, result);
        if (completed === null) {
          throw new Error("Cannot return null for non-nullable field ".concat(info.parentType.name, ".").concat(info.fieldName, "."));
        }
        return completed;
      }
      if ((0, _isNullish.default)(result)) {
        return null;
      }
      if ((0, _definition.isListType)(returnType)) {
        return completeListValue(exeContext, returnType, fieldNodes, info, path, result);
      }
      if ((0, _definition.isLeafType)(returnType)) {
        return completeLeafValue(returnType, result);
      }
      if ((0, _definition.isAbstractType)(returnType)) {
        return completeAbstractValue(exeContext, returnType, fieldNodes, info, path, result);
      }
      if ((0, _definition.isObjectType)(returnType)) {
        return completeObjectValue(exeContext, returnType, fieldNodes, info, path, result);
      }
      (0, _invariant.default)(false, "Cannot complete value of unexpected output type: " + (0, _inspect.default)(returnType));
    }
    function completeListValue(exeContext, returnType, fieldNodes, info, path, result) {
      if (!(0, _iterall.isCollection)(result)) {
        throw new _GraphQLError.GraphQLError("Expected Iterable, but did not find one for field ".concat(info.parentType.name, ".").concat(info.fieldName, "."));
      }
      var itemType = returnType.ofType;
      var containsPromise = false;
      var completedResults = [];
      (0, _iterall.forEach)(result, function(item, index) {
        var fieldPath = (0, _Path.addPath)(path, index);
        var completedItem = completeValueCatchingError(exeContext, itemType, fieldNodes, info, fieldPath, item);
        if (!containsPromise && (0, _isPromise.default)(completedItem)) {
          containsPromise = true;
        }
        completedResults.push(completedItem);
      });
      return containsPromise ? Promise.all(completedResults) : completedResults;
    }
    function completeLeafValue(returnType, result) {
      var serializedResult = returnType.serialize(result);
      if ((0, _isInvalid.default)(serializedResult)) {
        throw new Error('Expected a value of type "'.concat((0, _inspect.default)(returnType), '" but ') + "received: ".concat((0, _inspect.default)(result)));
      }
      return serializedResult;
    }
    function completeAbstractValue(exeContext, returnType, fieldNodes, info, path, result) {
      var resolveTypeFn = returnType.resolveType || exeContext.typeResolver;
      var contextValue = exeContext.contextValue;
      var runtimeType = resolveTypeFn(result, contextValue, info, returnType);
      if ((0, _isPromise.default)(runtimeType)) {
        return runtimeType.then(function(resolvedRuntimeType) {
          return completeObjectValue(exeContext, ensureValidRuntimeType(resolvedRuntimeType, exeContext, returnType, fieldNodes, info, result), fieldNodes, info, path, result);
        });
      }
      return completeObjectValue(exeContext, ensureValidRuntimeType(runtimeType, exeContext, returnType, fieldNodes, info, result), fieldNodes, info, path, result);
    }
    function ensureValidRuntimeType(runtimeTypeOrName, exeContext, returnType, fieldNodes, info, result) {
      var runtimeType = typeof runtimeTypeOrName === "string" ? exeContext.schema.getType(runtimeTypeOrName) : runtimeTypeOrName;
      if (!(0, _definition.isObjectType)(runtimeType)) {
        throw new _GraphQLError.GraphQLError("Abstract type ".concat(returnType.name, " must resolve to an Object type at runtime for field ").concat(info.parentType.name, ".").concat(info.fieldName, " with ") + "value ".concat((0, _inspect.default)(result), ', received "').concat((0, _inspect.default)(runtimeType), '". ') + "Either the ".concat(returnType.name, ' type should provide a "resolveType" function or each possible type should provide an "isTypeOf" function.'), fieldNodes);
      }
      if (!exeContext.schema.isPossibleType(returnType, runtimeType)) {
        throw new _GraphQLError.GraphQLError('Runtime Object type "'.concat(runtimeType.name, '" is not a possible type for "').concat(returnType.name, '".'), fieldNodes);
      }
      return runtimeType;
    }
    function completeObjectValue(exeContext, returnType, fieldNodes, info, path, result) {
      if (returnType.isTypeOf) {
        var isTypeOf = returnType.isTypeOf(result, exeContext.contextValue, info);
        if ((0, _isPromise.default)(isTypeOf)) {
          return isTypeOf.then(function(resolvedIsTypeOf) {
            if (!resolvedIsTypeOf) {
              throw invalidReturnTypeError(returnType, result, fieldNodes);
            }
            return collectAndExecuteSubfields(exeContext, returnType, fieldNodes, path, result);
          });
        }
        if (!isTypeOf) {
          throw invalidReturnTypeError(returnType, result, fieldNodes);
        }
      }
      return collectAndExecuteSubfields(exeContext, returnType, fieldNodes, path, result);
    }
    function invalidReturnTypeError(returnType, result, fieldNodes) {
      return new _GraphQLError.GraphQLError('Expected value of type "'.concat(returnType.name, '" but got: ').concat((0, _inspect.default)(result), "."), fieldNodes);
    }
    function collectAndExecuteSubfields(exeContext, returnType, fieldNodes, path, result) {
      var subFieldNodes = collectSubfields(exeContext, returnType, fieldNodes);
      return executeFields(exeContext, returnType, result, path, subFieldNodes);
    }
    var collectSubfields = (0, _memoize.default)(_collectSubfields);
    function _collectSubfields(exeContext, returnType, fieldNodes) {
      var subFieldNodes = /* @__PURE__ */ Object.create(null);
      var visitedFragmentNames = /* @__PURE__ */ Object.create(null);
      for (var _i8 = 0; _i8 < fieldNodes.length; _i8++) {
        var node = fieldNodes[_i8];
        if (node.selectionSet) {
          subFieldNodes = collectFields(exeContext, returnType, node.selectionSet, subFieldNodes, visitedFragmentNames);
        }
      }
      return subFieldNodes;
    }
    var defaultTypeResolver = function defaultTypeResolver2(value, contextValue, info, abstractType) {
      if ((0, _isObjectLike.default)(value) && typeof value.__typename === "string") {
        return value.__typename;
      }
      var possibleTypes = info.schema.getPossibleTypes(abstractType);
      var promisedIsTypeOfResults = [];
      for (var i = 0; i < possibleTypes.length; i++) {
        var type = possibleTypes[i];
        if (type.isTypeOf) {
          var isTypeOfResult = type.isTypeOf(value, contextValue, info);
          if ((0, _isPromise.default)(isTypeOfResult)) {
            promisedIsTypeOfResults[i] = isTypeOfResult;
          } else if (isTypeOfResult) {
            return type;
          }
        }
      }
      if (promisedIsTypeOfResults.length) {
        return Promise.all(promisedIsTypeOfResults).then(function(isTypeOfResults) {
          for (var _i9 = 0; _i9 < isTypeOfResults.length; _i9++) {
            if (isTypeOfResults[_i9]) {
              return possibleTypes[_i9];
            }
          }
        });
      }
    };
    exports.defaultTypeResolver = defaultTypeResolver;
    var defaultFieldResolver = function defaultFieldResolver2(source, args, contextValue, info) {
      if ((0, _isObjectLike.default)(source) || typeof source === "function") {
        var property = source[info.fieldName];
        if (typeof property === "function") {
          return source[info.fieldName](args, contextValue, info);
        }
        return property;
      }
    };
    exports.defaultFieldResolver = defaultFieldResolver;
    function getFieldDef(schema, parentType, fieldName) {
      if (fieldName === _introspection.SchemaMetaFieldDef.name && schema.getQueryType() === parentType) {
        return _introspection.SchemaMetaFieldDef;
      } else if (fieldName === _introspection.TypeMetaFieldDef.name && schema.getQueryType() === parentType) {
        return _introspection.TypeMetaFieldDef;
      } else if (fieldName === _introspection.TypeNameMetaFieldDef.name) {
        return _introspection.TypeNameMetaFieldDef;
      }
      return parentType.getFields()[fieldName];
    }
  }
});

// ../api/node_modules/graphql/graphql.js
var require_graphql = __commonJS({
  "../api/node_modules/graphql/graphql.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", {
      value: true
    });
    exports.graphql = graphql;
    exports.graphqlSync = graphqlSync;
    var _isPromise = _interopRequireDefault(require_isPromise());
    var _parser = require_parser();
    var _validate = require_validate2();
    var _validate2 = require_validate();
    var _execute = require_execute();
    function _interopRequireDefault(obj) {
      return obj && obj.__esModule ? obj : { default: obj };
    }
    function graphql(argsOrSchema, source, rootValue, contextValue, variableValues, operationName, fieldResolver, typeResolver) {
      var _arguments = arguments;
      return new Promise(function(resolve) {
        return resolve(_arguments.length === 1 ? graphqlImpl(argsOrSchema) : graphqlImpl({
          schema: argsOrSchema,
          source,
          rootValue,
          contextValue,
          variableValues,
          operationName,
          fieldResolver,
          typeResolver
        }));
      });
    }
    function graphqlSync(argsOrSchema, source, rootValue, contextValue, variableValues, operationName, fieldResolver, typeResolver) {
      var result = arguments.length === 1 ? graphqlImpl(argsOrSchema) : graphqlImpl({
        schema: argsOrSchema,
        source,
        rootValue,
        contextValue,
        variableValues,
        operationName,
        fieldResolver,
        typeResolver
      });
      if ((0, _isPromise.default)(result)) {
        throw new Error("GraphQL execution failed to complete synchronously.");
      }
      return result;
    }
    function graphqlImpl(args) {
      var schema = args.schema, source = args.source, rootValue = args.rootValue, contextValue = args.contextValue, variableValues = args.variableValues, operationName = args.operationName, fieldResolver = args.fieldResolver, typeResolver = args.typeResolver;
      var schemaValidationErrors = (0, _validate2.validateSchema)(schema);
      if (schemaValidationErrors.length > 0) {
        return {
          errors: schemaValidationErrors
        };
      }
      var document;
      try {
        document = (0, _parser.parse)(source);
      } catch (syntaxError) {
        return {
          errors: [syntaxError]
        };
      }
      var validationErrors = (0, _validate.validate)(schema, document);
      if (validationErrors.length > 0) {
        return {
          errors: validationErrors
        };
      }
      return (0, _execute.execute)({
        schema,
        document,
        rootValue,
        contextValue,
        variableValues,
        operationName,
        fieldResolver,
        typeResolver
      });
    }
  }
});

// ../api/node_modules/graphql/type/index.js
var require_type = __commonJS({
  "../api/node_modules/graphql/type/index.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", {
      value: true
    });
    Object.defineProperty(exports, "isSchema", {
      enumerable: true,
      get: function get() {
        return _schema.isSchema;
      }
    });
    Object.defineProperty(exports, "assertSchema", {
      enumerable: true,
      get: function get() {
        return _schema.assertSchema;
      }
    });
    Object.defineProperty(exports, "GraphQLSchema", {
      enumerable: true,
      get: function get() {
        return _schema.GraphQLSchema;
      }
    });
    Object.defineProperty(exports, "isType", {
      enumerable: true,
      get: function get() {
        return _definition.isType;
      }
    });
    Object.defineProperty(exports, "isScalarType", {
      enumerable: true,
      get: function get() {
        return _definition.isScalarType;
      }
    });
    Object.defineProperty(exports, "isObjectType", {
      enumerable: true,
      get: function get() {
        return _definition.isObjectType;
      }
    });
    Object.defineProperty(exports, "isInterfaceType", {
      enumerable: true,
      get: function get() {
        return _definition.isInterfaceType;
      }
    });
    Object.defineProperty(exports, "isUnionType", {
      enumerable: true,
      get: function get() {
        return _definition.isUnionType;
      }
    });
    Object.defineProperty(exports, "isEnumType", {
      enumerable: true,
      get: function get() {
        return _definition.isEnumType;
      }
    });
    Object.defineProperty(exports, "isInputObjectType", {
      enumerable: true,
      get: function get() {
        return _definition.isInputObjectType;
      }
    });
    Object.defineProperty(exports, "isListType", {
      enumerable: true,
      get: function get() {
        return _definition.isListType;
      }
    });
    Object.defineProperty(exports, "isNonNullType", {
      enumerable: true,
      get: function get() {
        return _definition.isNonNullType;
      }
    });
    Object.defineProperty(exports, "isInputType", {
      enumerable: true,
      get: function get() {
        return _definition.isInputType;
      }
    });
    Object.defineProperty(exports, "isOutputType", {
      enumerable: true,
      get: function get() {
        return _definition.isOutputType;
      }
    });
    Object.defineProperty(exports, "isLeafType", {
      enumerable: true,
      get: function get() {
        return _definition.isLeafType;
      }
    });
    Object.defineProperty(exports, "isCompositeType", {
      enumerable: true,
      get: function get() {
        return _definition.isCompositeType;
      }
    });
    Object.defineProperty(exports, "isAbstractType", {
      enumerable: true,
      get: function get() {
        return _definition.isAbstractType;
      }
    });
    Object.defineProperty(exports, "isWrappingType", {
      enumerable: true,
      get: function get() {
        return _definition.isWrappingType;
      }
    });
    Object.defineProperty(exports, "isNullableType", {
      enumerable: true,
      get: function get() {
        return _definition.isNullableType;
      }
    });
    Object.defineProperty(exports, "isNamedType", {
      enumerable: true,
      get: function get() {
        return _definition.isNamedType;
      }
    });
    Object.defineProperty(exports, "isRequiredArgument", {
      enumerable: true,
      get: function get() {
        return _definition.isRequiredArgument;
      }
    });
    Object.defineProperty(exports, "isRequiredInputField", {
      enumerable: true,
      get: function get() {
        return _definition.isRequiredInputField;
      }
    });
    Object.defineProperty(exports, "assertType", {
      enumerable: true,
      get: function get() {
        return _definition.assertType;
      }
    });
    Object.defineProperty(exports, "assertScalarType", {
      enumerable: true,
      get: function get() {
        return _definition.assertScalarType;
      }
    });
    Object.defineProperty(exports, "assertObjectType", {
      enumerable: true,
      get: function get() {
        return _definition.assertObjectType;
      }
    });
    Object.defineProperty(exports, "assertInterfaceType", {
      enumerable: true,
      get: function get() {
        return _definition.assertInterfaceType;
      }
    });
    Object.defineProperty(exports, "assertUnionType", {
      enumerable: true,
      get: function get() {
        return _definition.assertUnionType;
      }
    });
    Object.defineProperty(exports, "assertEnumType", {
      enumerable: true,
      get: function get() {
        return _definition.assertEnumType;
      }
    });
    Object.defineProperty(exports, "assertInputObjectType", {
      enumerable: true,
      get: function get() {
        return _definition.assertInputObjectType;
      }
    });
    Object.defineProperty(exports, "assertListType", {
      enumerable: true,
      get: function get() {
        return _definition.assertListType;
      }
    });
    Object.defineProperty(exports, "assertNonNullType", {
      enumerable: true,
      get: function get() {
        return _definition.assertNonNullType;
      }
    });
    Object.defineProperty(exports, "assertInputType", {
      enumerable: true,
      get: function get() {
        return _definition.assertInputType;
      }
    });
    Object.defineProperty(exports, "assertOutputType", {
      enumerable: true,
      get: function get() {
        return _definition.assertOutputType;
      }
    });
    Object.defineProperty(exports, "assertLeafType", {
      enumerable: true,
      get: function get() {
        return _definition.assertLeafType;
      }
    });
    Object.defineProperty(exports, "assertCompositeType", {
      enumerable: true,
      get: function get() {
        return _definition.assertCompositeType;
      }
    });
    Object.defineProperty(exports, "assertAbstractType", {
      enumerable: true,
      get: function get() {
        return _definition.assertAbstractType;
      }
    });
    Object.defineProperty(exports, "assertWrappingType", {
      enumerable: true,
      get: function get() {
        return _definition.assertWrappingType;
      }
    });
    Object.defineProperty(exports, "assertNullableType", {
      enumerable: true,
      get: function get() {
        return _definition.assertNullableType;
      }
    });
    Object.defineProperty(exports, "assertNamedType", {
      enumerable: true,
      get: function get() {
        return _definition.assertNamedType;
      }
    });
    Object.defineProperty(exports, "getNullableType", {
      enumerable: true,
      get: function get() {
        return _definition.getNullableType;
      }
    });
    Object.defineProperty(exports, "getNamedType", {
      enumerable: true,
      get: function get() {
        return _definition.getNamedType;
      }
    });
    Object.defineProperty(exports, "GraphQLScalarType", {
      enumerable: true,
      get: function get() {
        return _definition.GraphQLScalarType;
      }
    });
    Object.defineProperty(exports, "GraphQLObjectType", {
      enumerable: true,
      get: function get() {
        return _definition.GraphQLObjectType;
      }
    });
    Object.defineProperty(exports, "GraphQLInterfaceType", {
      enumerable: true,
      get: function get() {
        return _definition.GraphQLInterfaceType;
      }
    });
    Object.defineProperty(exports, "GraphQLUnionType", {
      enumerable: true,
      get: function get() {
        return _definition.GraphQLUnionType;
      }
    });
    Object.defineProperty(exports, "GraphQLEnumType", {
      enumerable: true,
      get: function get() {
        return _definition.GraphQLEnumType;
      }
    });
    Object.defineProperty(exports, "GraphQLInputObjectType", {
      enumerable: true,
      get: function get() {
        return _definition.GraphQLInputObjectType;
      }
    });
    Object.defineProperty(exports, "GraphQLList", {
      enumerable: true,
      get: function get() {
        return _definition.GraphQLList;
      }
    });
    Object.defineProperty(exports, "GraphQLNonNull", {
      enumerable: true,
      get: function get() {
        return _definition.GraphQLNonNull;
      }
    });
    Object.defineProperty(exports, "isDirective", {
      enumerable: true,
      get: function get() {
        return _directives.isDirective;
      }
    });
    Object.defineProperty(exports, "assertDirective", {
      enumerable: true,
      get: function get() {
        return _directives.assertDirective;
      }
    });
    Object.defineProperty(exports, "GraphQLDirective", {
      enumerable: true,
      get: function get() {
        return _directives.GraphQLDirective;
      }
    });
    Object.defineProperty(exports, "isSpecifiedDirective", {
      enumerable: true,
      get: function get() {
        return _directives.isSpecifiedDirective;
      }
    });
    Object.defineProperty(exports, "specifiedDirectives", {
      enumerable: true,
      get: function get() {
        return _directives.specifiedDirectives;
      }
    });
    Object.defineProperty(exports, "GraphQLIncludeDirective", {
      enumerable: true,
      get: function get() {
        return _directives.GraphQLIncludeDirective;
      }
    });
    Object.defineProperty(exports, "GraphQLSkipDirective", {
      enumerable: true,
      get: function get() {
        return _directives.GraphQLSkipDirective;
      }
    });
    Object.defineProperty(exports, "GraphQLDeprecatedDirective", {
      enumerable: true,
      get: function get() {
        return _directives.GraphQLDeprecatedDirective;
      }
    });
    Object.defineProperty(exports, "DEFAULT_DEPRECATION_REASON", {
      enumerable: true,
      get: function get() {
        return _directives.DEFAULT_DEPRECATION_REASON;
      }
    });
    Object.defineProperty(exports, "isSpecifiedScalarType", {
      enumerable: true,
      get: function get() {
        return _scalars.isSpecifiedScalarType;
      }
    });
    Object.defineProperty(exports, "specifiedScalarTypes", {
      enumerable: true,
      get: function get() {
        return _scalars.specifiedScalarTypes;
      }
    });
    Object.defineProperty(exports, "GraphQLInt", {
      enumerable: true,
      get: function get() {
        return _scalars.GraphQLInt;
      }
    });
    Object.defineProperty(exports, "GraphQLFloat", {
      enumerable: true,
      get: function get() {
        return _scalars.GraphQLFloat;
      }
    });
    Object.defineProperty(exports, "GraphQLString", {
      enumerable: true,
      get: function get() {
        return _scalars.GraphQLString;
      }
    });
    Object.defineProperty(exports, "GraphQLBoolean", {
      enumerable: true,
      get: function get() {
        return _scalars.GraphQLBoolean;
      }
    });
    Object.defineProperty(exports, "GraphQLID", {
      enumerable: true,
      get: function get() {
        return _scalars.GraphQLID;
      }
    });
    Object.defineProperty(exports, "isIntrospectionType", {
      enumerable: true,
      get: function get() {
        return _introspection.isIntrospectionType;
      }
    });
    Object.defineProperty(exports, "introspectionTypes", {
      enumerable: true,
      get: function get() {
        return _introspection.introspectionTypes;
      }
    });
    Object.defineProperty(exports, "__Schema", {
      enumerable: true,
      get: function get() {
        return _introspection.__Schema;
      }
    });
    Object.defineProperty(exports, "__Directive", {
      enumerable: true,
      get: function get() {
        return _introspection.__Directive;
      }
    });
    Object.defineProperty(exports, "__DirectiveLocation", {
      enumerable: true,
      get: function get() {
        return _introspection.__DirectiveLocation;
      }
    });
    Object.defineProperty(exports, "__Type", {
      enumerable: true,
      get: function get() {
        return _introspection.__Type;
      }
    });
    Object.defineProperty(exports, "__Field", {
      enumerable: true,
      get: function get() {
        return _introspection.__Field;
      }
    });
    Object.defineProperty(exports, "__InputValue", {
      enumerable: true,
      get: function get() {
        return _introspection.__InputValue;
      }
    });
    Object.defineProperty(exports, "__EnumValue", {
      enumerable: true,
      get: function get() {
        return _introspection.__EnumValue;
      }
    });
    Object.defineProperty(exports, "__TypeKind", {
      enumerable: true,
      get: function get() {
        return _introspection.__TypeKind;
      }
    });
    Object.defineProperty(exports, "TypeKind", {
      enumerable: true,
      get: function get() {
        return _introspection.TypeKind;
      }
    });
    Object.defineProperty(exports, "SchemaMetaFieldDef", {
      enumerable: true,
      get: function get() {
        return _introspection.SchemaMetaFieldDef;
      }
    });
    Object.defineProperty(exports, "TypeMetaFieldDef", {
      enumerable: true,
      get: function get() {
        return _introspection.TypeMetaFieldDef;
      }
    });
    Object.defineProperty(exports, "TypeNameMetaFieldDef", {
      enumerable: true,
      get: function get() {
        return _introspection.TypeNameMetaFieldDef;
      }
    });
    Object.defineProperty(exports, "validateSchema", {
      enumerable: true,
      get: function get() {
        return _validate.validateSchema;
      }
    });
    Object.defineProperty(exports, "assertValidSchema", {
      enumerable: true,
      get: function get() {
        return _validate.assertValidSchema;
      }
    });
    var _schema = require_schema();
    var _definition = require_definition();
    var _directives = require_directives();
    var _scalars = require_scalars();
    var _introspection = require_introspection();
    var _validate = require_validate();
  }
});

// ../api/node_modules/graphql/language/index.js
var require_language = __commonJS({
  "../api/node_modules/graphql/language/index.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", {
      value: true
    });
    Object.defineProperty(exports, "Source", {
      enumerable: true,
      get: function get() {
        return _source.Source;
      }
    });
    Object.defineProperty(exports, "getLocation", {
      enumerable: true,
      get: function get() {
        return _location.getLocation;
      }
    });
    Object.defineProperty(exports, "printLocation", {
      enumerable: true,
      get: function get() {
        return _printLocation.printLocation;
      }
    });
    Object.defineProperty(exports, "printSourceLocation", {
      enumerable: true,
      get: function get() {
        return _printLocation.printSourceLocation;
      }
    });
    Object.defineProperty(exports, "Kind", {
      enumerable: true,
      get: function get() {
        return _kinds.Kind;
      }
    });
    Object.defineProperty(exports, "TokenKind", {
      enumerable: true,
      get: function get() {
        return _tokenKind.TokenKind;
      }
    });
    Object.defineProperty(exports, "createLexer", {
      enumerable: true,
      get: function get() {
        return _lexer.createLexer;
      }
    });
    Object.defineProperty(exports, "parse", {
      enumerable: true,
      get: function get() {
        return _parser.parse;
      }
    });
    Object.defineProperty(exports, "parseValue", {
      enumerable: true,
      get: function get() {
        return _parser.parseValue;
      }
    });
    Object.defineProperty(exports, "parseType", {
      enumerable: true,
      get: function get() {
        return _parser.parseType;
      }
    });
    Object.defineProperty(exports, "print", {
      enumerable: true,
      get: function get() {
        return _printer.print;
      }
    });
    Object.defineProperty(exports, "visit", {
      enumerable: true,
      get: function get() {
        return _visitor.visit;
      }
    });
    Object.defineProperty(exports, "visitInParallel", {
      enumerable: true,
      get: function get() {
        return _visitor.visitInParallel;
      }
    });
    Object.defineProperty(exports, "visitWithTypeInfo", {
      enumerable: true,
      get: function get() {
        return _visitor.visitWithTypeInfo;
      }
    });
    Object.defineProperty(exports, "getVisitFn", {
      enumerable: true,
      get: function get() {
        return _visitor.getVisitFn;
      }
    });
    Object.defineProperty(exports, "BREAK", {
      enumerable: true,
      get: function get() {
        return _visitor.BREAK;
      }
    });
    Object.defineProperty(exports, "isDefinitionNode", {
      enumerable: true,
      get: function get() {
        return _predicates.isDefinitionNode;
      }
    });
    Object.defineProperty(exports, "isExecutableDefinitionNode", {
      enumerable: true,
      get: function get() {
        return _predicates.isExecutableDefinitionNode;
      }
    });
    Object.defineProperty(exports, "isSelectionNode", {
      enumerable: true,
      get: function get() {
        return _predicates.isSelectionNode;
      }
    });
    Object.defineProperty(exports, "isValueNode", {
      enumerable: true,
      get: function get() {
        return _predicates.isValueNode;
      }
    });
    Object.defineProperty(exports, "isTypeNode", {
      enumerable: true,
      get: function get() {
        return _predicates.isTypeNode;
      }
    });
    Object.defineProperty(exports, "isTypeSystemDefinitionNode", {
      enumerable: true,
      get: function get() {
        return _predicates.isTypeSystemDefinitionNode;
      }
    });
    Object.defineProperty(exports, "isTypeDefinitionNode", {
      enumerable: true,
      get: function get() {
        return _predicates.isTypeDefinitionNode;
      }
    });
    Object.defineProperty(exports, "isTypeSystemExtensionNode", {
      enumerable: true,
      get: function get() {
        return _predicates.isTypeSystemExtensionNode;
      }
    });
    Object.defineProperty(exports, "isTypeExtensionNode", {
      enumerable: true,
      get: function get() {
        return _predicates.isTypeExtensionNode;
      }
    });
    Object.defineProperty(exports, "DirectiveLocation", {
      enumerable: true,
      get: function get() {
        return _directiveLocation.DirectiveLocation;
      }
    });
    var _source = require_source();
    var _location = require_location();
    var _printLocation = require_printLocation();
    var _kinds = require_kinds();
    var _tokenKind = require_tokenKind();
    var _lexer = require_lexer();
    var _parser = require_parser();
    var _printer = require_printer();
    var _visitor = require_visitor();
    var _predicates = require_predicates();
    var _directiveLocation = require_directiveLocation();
  }
});

// ../api/node_modules/graphql/execution/index.js
var require_execution = __commonJS({
  "../api/node_modules/graphql/execution/index.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", {
      value: true
    });
    Object.defineProperty(exports, "responsePathAsArray", {
      enumerable: true,
      get: function get() {
        return _Path.pathToArray;
      }
    });
    Object.defineProperty(exports, "execute", {
      enumerable: true,
      get: function get() {
        return _execute.execute;
      }
    });
    Object.defineProperty(exports, "defaultFieldResolver", {
      enumerable: true,
      get: function get() {
        return _execute.defaultFieldResolver;
      }
    });
    Object.defineProperty(exports, "defaultTypeResolver", {
      enumerable: true,
      get: function get() {
        return _execute.defaultTypeResolver;
      }
    });
    Object.defineProperty(exports, "getDirectiveValues", {
      enumerable: true,
      get: function get() {
        return _values.getDirectiveValues;
      }
    });
    var _Path = require_Path();
    var _execute = require_execute();
    var _values = require_values();
  }
});

// ../api/node_modules/graphql/subscription/mapAsyncIterator.js
var require_mapAsyncIterator = __commonJS({
  "../api/node_modules/graphql/subscription/mapAsyncIterator.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", {
      value: true
    });
    exports.default = mapAsyncIterator;
    var _iterall = require_iterall();
    function _defineProperty(obj, key, value) {
      if (key in obj) {
        Object.defineProperty(obj, key, { value, enumerable: true, configurable: true, writable: true });
      } else {
        obj[key] = value;
      }
      return obj;
    }
    function mapAsyncIterator(iterable, callback, rejectCallback) {
      var iterator = (0, _iterall.getAsyncIterator)(iterable);
      var $return;
      var abruptClose;
      if (typeof iterator.return === "function") {
        $return = iterator.return;
        abruptClose = function abruptClose2(error) {
          var rethrow = function rethrow2() {
            return Promise.reject(error);
          };
          return $return.call(iterator).then(rethrow, rethrow);
        };
      }
      function mapResult(result) {
        return result.done ? result : asyncMapValue(result.value, callback).then(iteratorResult, abruptClose);
      }
      var mapReject;
      if (rejectCallback) {
        var reject = rejectCallback;
        mapReject = function mapReject2(error) {
          return asyncMapValue(error, reject).then(iteratorResult, abruptClose);
        };
      }
      return _defineProperty({
        next: function next() {
          return iterator.next().then(mapResult, mapReject);
        },
        return: function _return() {
          return $return ? $return.call(iterator).then(mapResult, mapReject) : Promise.resolve({
            value: void 0,
            done: true
          });
        },
        throw: function _throw(error) {
          if (typeof iterator.throw === "function") {
            return iterator.throw(error).then(mapResult, mapReject);
          }
          return Promise.reject(error).catch(abruptClose);
        }
      }, _iterall.$$asyncIterator, function() {
        return this;
      });
    }
    function asyncMapValue(value, callback) {
      return new Promise(function(resolve) {
        return resolve(callback(value));
      });
    }
    function iteratorResult(value) {
      return {
        value,
        done: false
      };
    }
  }
});

// ../api/node_modules/graphql/subscription/subscribe.js
var require_subscribe = __commonJS({
  "../api/node_modules/graphql/subscription/subscribe.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", {
      value: true
    });
    exports.subscribe = subscribe;
    exports.createSourceEventStream = createSourceEventStream;
    var _iterall = require_iterall();
    var _inspect = _interopRequireDefault(require_inspect());
    var _Path = require_Path();
    var _GraphQLError = require_GraphQLError();
    var _locatedError = require_locatedError();
    var _execute = require_execute();
    var _getOperationRootType = require_getOperationRootType();
    var _mapAsyncIterator = _interopRequireDefault(require_mapAsyncIterator());
    function _interopRequireDefault(obj) {
      return obj && obj.__esModule ? obj : { default: obj };
    }
    function subscribe(argsOrSchema, document, rootValue, contextValue, variableValues, operationName, fieldResolver, subscribeFieldResolver) {
      return arguments.length === 1 ? subscribeImpl(argsOrSchema) : subscribeImpl({
        schema: argsOrSchema,
        document,
        rootValue,
        contextValue,
        variableValues,
        operationName,
        fieldResolver,
        subscribeFieldResolver
      });
    }
    function reportGraphQLError(error) {
      if (error instanceof _GraphQLError.GraphQLError) {
        return {
          errors: [error]
        };
      }
      throw error;
    }
    function subscribeImpl(args) {
      var schema = args.schema, document = args.document, rootValue = args.rootValue, contextValue = args.contextValue, variableValues = args.variableValues, operationName = args.operationName, fieldResolver = args.fieldResolver, subscribeFieldResolver = args.subscribeFieldResolver;
      var sourcePromise = createSourceEventStream(schema, document, rootValue, contextValue, variableValues, operationName, subscribeFieldResolver);
      var mapSourceToResponse = function mapSourceToResponse2(payload) {
        return (0, _execute.execute)(schema, document, payload, contextValue, variableValues, operationName, fieldResolver);
      };
      return sourcePromise.then(function(resultOrStream) {
        return (0, _iterall.isAsyncIterable)(resultOrStream) ? (0, _mapAsyncIterator.default)(resultOrStream, mapSourceToResponse, reportGraphQLError) : resultOrStream;
      });
    }
    function createSourceEventStream(schema, document, rootValue, contextValue, variableValues, operationName, fieldResolver) {
      (0, _execute.assertValidExecutionArguments)(schema, document, variableValues);
      try {
        var exeContext = (0, _execute.buildExecutionContext)(schema, document, rootValue, contextValue, variableValues, operationName, fieldResolver);
        if (Array.isArray(exeContext)) {
          return Promise.resolve({
            errors: exeContext
          });
        }
        var type = (0, _getOperationRootType.getOperationRootType)(schema, exeContext.operation);
        var fields = (0, _execute.collectFields)(exeContext, type, exeContext.operation.selectionSet, /* @__PURE__ */ Object.create(null), /* @__PURE__ */ Object.create(null));
        var responseNames = Object.keys(fields);
        var responseName = responseNames[0];
        var fieldNodes = fields[responseName];
        var fieldNode = fieldNodes[0];
        var fieldName = fieldNode.name.value;
        var fieldDef = (0, _execute.getFieldDef)(schema, type, fieldName);
        if (!fieldDef) {
          throw new _GraphQLError.GraphQLError('The subscription field "'.concat(fieldName, '" is not defined.'), fieldNodes);
        }
        var resolveFn = fieldDef.subscribe || exeContext.fieldResolver;
        var path = (0, _Path.addPath)(void 0, responseName);
        var info = (0, _execute.buildResolveInfo)(exeContext, fieldDef, fieldNodes, type, path);
        var result = (0, _execute.resolveFieldValueOrError)(exeContext, fieldDef, fieldNodes, resolveFn, rootValue, info);
        return Promise.resolve(result).then(function(eventStream) {
          if (eventStream instanceof Error) {
            return {
              errors: [(0, _locatedError.locatedError)(eventStream, fieldNodes, (0, _Path.pathToArray)(path))]
            };
          }
          if ((0, _iterall.isAsyncIterable)(eventStream)) {
            return eventStream;
          }
          throw new Error("Subscription field must return Async Iterable. Received: " + (0, _inspect.default)(eventStream));
        });
      } catch (error) {
        return error instanceof _GraphQLError.GraphQLError ? Promise.resolve({
          errors: [error]
        }) : Promise.reject(error);
      }
    }
  }
});

// ../api/node_modules/graphql/subscription/index.js
var require_subscription = __commonJS({
  "../api/node_modules/graphql/subscription/index.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", {
      value: true
    });
    Object.defineProperty(exports, "subscribe", {
      enumerable: true,
      get: function get() {
        return _subscribe.subscribe;
      }
    });
    Object.defineProperty(exports, "createSourceEventStream", {
      enumerable: true,
      get: function get() {
        return _subscribe.createSourceEventStream;
      }
    });
    var _subscribe = require_subscribe();
  }
});

// ../api/node_modules/graphql/validation/index.js
var require_validation = __commonJS({
  "../api/node_modules/graphql/validation/index.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", {
      value: true
    });
    Object.defineProperty(exports, "validate", {
      enumerable: true,
      get: function get() {
        return _validate.validate;
      }
    });
    Object.defineProperty(exports, "ValidationContext", {
      enumerable: true,
      get: function get() {
        return _ValidationContext.ValidationContext;
      }
    });
    Object.defineProperty(exports, "specifiedRules", {
      enumerable: true,
      get: function get() {
        return _specifiedRules.specifiedRules;
      }
    });
    Object.defineProperty(exports, "ExecutableDefinitionsRule", {
      enumerable: true,
      get: function get() {
        return _ExecutableDefinitions.ExecutableDefinitions;
      }
    });
    Object.defineProperty(exports, "FieldsOnCorrectTypeRule", {
      enumerable: true,
      get: function get() {
        return _FieldsOnCorrectType.FieldsOnCorrectType;
      }
    });
    Object.defineProperty(exports, "FragmentsOnCompositeTypesRule", {
      enumerable: true,
      get: function get() {
        return _FragmentsOnCompositeTypes.FragmentsOnCompositeTypes;
      }
    });
    Object.defineProperty(exports, "KnownArgumentNamesRule", {
      enumerable: true,
      get: function get() {
        return _KnownArgumentNames.KnownArgumentNames;
      }
    });
    Object.defineProperty(exports, "KnownDirectivesRule", {
      enumerable: true,
      get: function get() {
        return _KnownDirectives.KnownDirectives;
      }
    });
    Object.defineProperty(exports, "KnownFragmentNamesRule", {
      enumerable: true,
      get: function get() {
        return _KnownFragmentNames.KnownFragmentNames;
      }
    });
    Object.defineProperty(exports, "KnownTypeNamesRule", {
      enumerable: true,
      get: function get() {
        return _KnownTypeNames.KnownTypeNames;
      }
    });
    Object.defineProperty(exports, "LoneAnonymousOperationRule", {
      enumerable: true,
      get: function get() {
        return _LoneAnonymousOperation.LoneAnonymousOperation;
      }
    });
    Object.defineProperty(exports, "NoFragmentCyclesRule", {
      enumerable: true,
      get: function get() {
        return _NoFragmentCycles.NoFragmentCycles;
      }
    });
    Object.defineProperty(exports, "NoUndefinedVariablesRule", {
      enumerable: true,
      get: function get() {
        return _NoUndefinedVariables.NoUndefinedVariables;
      }
    });
    Object.defineProperty(exports, "NoUnusedFragmentsRule", {
      enumerable: true,
      get: function get() {
        return _NoUnusedFragments.NoUnusedFragments;
      }
    });
    Object.defineProperty(exports, "NoUnusedVariablesRule", {
      enumerable: true,
      get: function get() {
        return _NoUnusedVariables.NoUnusedVariables;
      }
    });
    Object.defineProperty(exports, "OverlappingFieldsCanBeMergedRule", {
      enumerable: true,
      get: function get() {
        return _OverlappingFieldsCanBeMerged.OverlappingFieldsCanBeMerged;
      }
    });
    Object.defineProperty(exports, "PossibleFragmentSpreadsRule", {
      enumerable: true,
      get: function get() {
        return _PossibleFragmentSpreads.PossibleFragmentSpreads;
      }
    });
    Object.defineProperty(exports, "ProvidedRequiredArgumentsRule", {
      enumerable: true,
      get: function get() {
        return _ProvidedRequiredArguments.ProvidedRequiredArguments;
      }
    });
    Object.defineProperty(exports, "ScalarLeafsRule", {
      enumerable: true,
      get: function get() {
        return _ScalarLeafs.ScalarLeafs;
      }
    });
    Object.defineProperty(exports, "SingleFieldSubscriptionsRule", {
      enumerable: true,
      get: function get() {
        return _SingleFieldSubscriptions.SingleFieldSubscriptions;
      }
    });
    Object.defineProperty(exports, "UniqueArgumentNamesRule", {
      enumerable: true,
      get: function get() {
        return _UniqueArgumentNames.UniqueArgumentNames;
      }
    });
    Object.defineProperty(exports, "UniqueDirectivesPerLocationRule", {
      enumerable: true,
      get: function get() {
        return _UniqueDirectivesPerLocation.UniqueDirectivesPerLocation;
      }
    });
    Object.defineProperty(exports, "UniqueFragmentNamesRule", {
      enumerable: true,
      get: function get() {
        return _UniqueFragmentNames.UniqueFragmentNames;
      }
    });
    Object.defineProperty(exports, "UniqueInputFieldNamesRule", {
      enumerable: true,
      get: function get() {
        return _UniqueInputFieldNames.UniqueInputFieldNames;
      }
    });
    Object.defineProperty(exports, "UniqueOperationNamesRule", {
      enumerable: true,
      get: function get() {
        return _UniqueOperationNames.UniqueOperationNames;
      }
    });
    Object.defineProperty(exports, "UniqueVariableNamesRule", {
      enumerable: true,
      get: function get() {
        return _UniqueVariableNames.UniqueVariableNames;
      }
    });
    Object.defineProperty(exports, "ValuesOfCorrectTypeRule", {
      enumerable: true,
      get: function get() {
        return _ValuesOfCorrectType.ValuesOfCorrectType;
      }
    });
    Object.defineProperty(exports, "VariablesAreInputTypesRule", {
      enumerable: true,
      get: function get() {
        return _VariablesAreInputTypes.VariablesAreInputTypes;
      }
    });
    Object.defineProperty(exports, "VariablesInAllowedPositionRule", {
      enumerable: true,
      get: function get() {
        return _VariablesInAllowedPosition.VariablesInAllowedPosition;
      }
    });
    Object.defineProperty(exports, "LoneSchemaDefinitionRule", {
      enumerable: true,
      get: function get() {
        return _LoneSchemaDefinition.LoneSchemaDefinition;
      }
    });
    Object.defineProperty(exports, "UniqueOperationTypesRule", {
      enumerable: true,
      get: function get() {
        return _UniqueOperationTypes.UniqueOperationTypes;
      }
    });
    Object.defineProperty(exports, "UniqueTypeNamesRule", {
      enumerable: true,
      get: function get() {
        return _UniqueTypeNames.UniqueTypeNames;
      }
    });
    Object.defineProperty(exports, "UniqueEnumValueNamesRule", {
      enumerable: true,
      get: function get() {
        return _UniqueEnumValueNames.UniqueEnumValueNames;
      }
    });
    Object.defineProperty(exports, "UniqueFieldDefinitionNamesRule", {
      enumerable: true,
      get: function get() {
        return _UniqueFieldDefinitionNames.UniqueFieldDefinitionNames;
      }
    });
    Object.defineProperty(exports, "UniqueDirectiveNamesRule", {
      enumerable: true,
      get: function get() {
        return _UniqueDirectiveNames.UniqueDirectiveNames;
      }
    });
    Object.defineProperty(exports, "PossibleTypeExtensionsRule", {
      enumerable: true,
      get: function get() {
        return _PossibleTypeExtensions.PossibleTypeExtensions;
      }
    });
    var _validate = require_validate2();
    var _ValidationContext = require_ValidationContext();
    var _specifiedRules = require_specifiedRules();
    var _ExecutableDefinitions = require_ExecutableDefinitions();
    var _FieldsOnCorrectType = require_FieldsOnCorrectType();
    var _FragmentsOnCompositeTypes = require_FragmentsOnCompositeTypes();
    var _KnownArgumentNames = require_KnownArgumentNames();
    var _KnownDirectives = require_KnownDirectives();
    var _KnownFragmentNames = require_KnownFragmentNames();
    var _KnownTypeNames = require_KnownTypeNames();
    var _LoneAnonymousOperation = require_LoneAnonymousOperation();
    var _NoFragmentCycles = require_NoFragmentCycles();
    var _NoUndefinedVariables = require_NoUndefinedVariables();
    var _NoUnusedFragments = require_NoUnusedFragments();
    var _NoUnusedVariables = require_NoUnusedVariables();
    var _OverlappingFieldsCanBeMerged = require_OverlappingFieldsCanBeMerged();
    var _PossibleFragmentSpreads = require_PossibleFragmentSpreads();
    var _ProvidedRequiredArguments = require_ProvidedRequiredArguments();
    var _ScalarLeafs = require_ScalarLeafs();
    var _SingleFieldSubscriptions = require_SingleFieldSubscriptions();
    var _UniqueArgumentNames = require_UniqueArgumentNames();
    var _UniqueDirectivesPerLocation = require_UniqueDirectivesPerLocation();
    var _UniqueFragmentNames = require_UniqueFragmentNames();
    var _UniqueInputFieldNames = require_UniqueInputFieldNames();
    var _UniqueOperationNames = require_UniqueOperationNames();
    var _UniqueVariableNames = require_UniqueVariableNames();
    var _ValuesOfCorrectType = require_ValuesOfCorrectType();
    var _VariablesAreInputTypes = require_VariablesAreInputTypes();
    var _VariablesInAllowedPosition = require_VariablesInAllowedPosition();
    var _LoneSchemaDefinition = require_LoneSchemaDefinition();
    var _UniqueOperationTypes = require_UniqueOperationTypes();
    var _UniqueTypeNames = require_UniqueTypeNames();
    var _UniqueEnumValueNames = require_UniqueEnumValueNames();
    var _UniqueFieldDefinitionNames = require_UniqueFieldDefinitionNames();
    var _UniqueDirectiveNames = require_UniqueDirectiveNames();
    var _PossibleTypeExtensions = require_PossibleTypeExtensions();
  }
});

// ../api/node_modules/graphql/error/formatError.js
var require_formatError = __commonJS({
  "../api/node_modules/graphql/error/formatError.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", {
      value: true
    });
    exports.formatError = formatError;
    var _devAssert = _interopRequireDefault(require_devAssert());
    function _interopRequireDefault(obj) {
      return obj && obj.__esModule ? obj : { default: obj };
    }
    function formatError(error) {
      error || (0, _devAssert.default)(0, "Received null or undefined error.");
      var message = error.message || "An unknown error occurred.";
      var locations = error.locations;
      var path = error.path;
      var extensions = error.extensions;
      return extensions ? {
        message,
        locations,
        path,
        extensions
      } : {
        message,
        locations,
        path
      };
    }
  }
});

// ../api/node_modules/graphql/error/index.js
var require_error = __commonJS({
  "../api/node_modules/graphql/error/index.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", {
      value: true
    });
    Object.defineProperty(exports, "GraphQLError", {
      enumerable: true,
      get: function get() {
        return _GraphQLError.GraphQLError;
      }
    });
    Object.defineProperty(exports, "printError", {
      enumerable: true,
      get: function get() {
        return _GraphQLError.printError;
      }
    });
    Object.defineProperty(exports, "syntaxError", {
      enumerable: true,
      get: function get() {
        return _syntaxError.syntaxError;
      }
    });
    Object.defineProperty(exports, "locatedError", {
      enumerable: true,
      get: function get() {
        return _locatedError.locatedError;
      }
    });
    Object.defineProperty(exports, "formatError", {
      enumerable: true,
      get: function get() {
        return _formatError.formatError;
      }
    });
    var _GraphQLError = require_GraphQLError();
    var _syntaxError = require_syntaxError();
    var _locatedError = require_locatedError();
    var _formatError = require_formatError();
  }
});

// ../api/node_modules/graphql/utilities/introspectionQuery.js
var require_introspectionQuery = __commonJS({
  "../api/node_modules/graphql/utilities/introspectionQuery.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", {
      value: true
    });
    exports.getIntrospectionQuery = getIntrospectionQuery;
    exports.introspectionQuery = void 0;
    function getIntrospectionQuery(options) {
      var descriptions = !(options && options.descriptions === false);
      return "\n    query IntrospectionQuery {\n      __schema {\n        queryType { name }\n        mutationType { name }\n        subscriptionType { name }\n        types {\n          ...FullType\n        }\n        directives {\n          name\n          ".concat(descriptions ? "description" : "", "\n          locations\n          args {\n            ...InputValue\n          }\n        }\n      }\n    }\n\n    fragment FullType on __Type {\n      kind\n      name\n      ").concat(descriptions ? "description" : "", "\n      fields(includeDeprecated: true) {\n        name\n        ").concat(descriptions ? "description" : "", "\n        args {\n          ...InputValue\n        }\n        type {\n          ...TypeRef\n        }\n        isDeprecated\n        deprecationReason\n      }\n      inputFields {\n        ...InputValue\n      }\n      interfaces {\n        ...TypeRef\n      }\n      enumValues(includeDeprecated: true) {\n        name\n        ").concat(descriptions ? "description" : "", "\n        isDeprecated\n        deprecationReason\n      }\n      possibleTypes {\n        ...TypeRef\n      }\n    }\n\n    fragment InputValue on __InputValue {\n      name\n      ").concat(descriptions ? "description" : "", "\n      type { ...TypeRef }\n      defaultValue\n    }\n\n    fragment TypeRef on __Type {\n      kind\n      name\n      ofType {\n        kind\n        name\n        ofType {\n          kind\n          name\n          ofType {\n            kind\n            name\n            ofType {\n              kind\n              name\n              ofType {\n                kind\n                name\n                ofType {\n                  kind\n                  name\n                  ofType {\n                    kind\n                    name\n                  }\n                }\n              }\n            }\n          }\n        }\n      }\n    }\n  ");
    }
    var introspectionQuery = getIntrospectionQuery();
    exports.introspectionQuery = introspectionQuery;
  }
});

// ../api/node_modules/graphql/utilities/getOperationAST.js
var require_getOperationAST = __commonJS({
  "../api/node_modules/graphql/utilities/getOperationAST.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", {
      value: true
    });
    exports.getOperationAST = getOperationAST;
    var _kinds = require_kinds();
    function getOperationAST(documentAST, operationName) {
      var operation = null;
      for (var _i2 = 0, _documentAST$definiti2 = documentAST.definitions; _i2 < _documentAST$definiti2.length; _i2++) {
        var definition = _documentAST$definiti2[_i2];
        if (definition.kind === _kinds.Kind.OPERATION_DEFINITION) {
          if (!operationName) {
            if (operation) {
              return null;
            }
            operation = definition;
          } else if (definition.name && definition.name.value === operationName) {
            return definition;
          }
        }
      }
      return operation;
    }
  }
});

// ../api/node_modules/graphql/utilities/introspectionFromSchema.js
var require_introspectionFromSchema = __commonJS({
  "../api/node_modules/graphql/utilities/introspectionFromSchema.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", {
      value: true
    });
    exports.introspectionFromSchema = introspectionFromSchema;
    var _invariant = _interopRequireDefault(require_invariant());
    var _isPromise = _interopRequireDefault(require_isPromise());
    var _parser = require_parser();
    var _execute = require_execute();
    var _introspectionQuery = require_introspectionQuery();
    function _interopRequireDefault(obj) {
      return obj && obj.__esModule ? obj : { default: obj };
    }
    function introspectionFromSchema(schema, options) {
      var queryAST = (0, _parser.parse)((0, _introspectionQuery.getIntrospectionQuery)(options));
      var result = (0, _execute.execute)(schema, queryAST);
      !(0, _isPromise.default)(result) && !result.errors && result.data || (0, _invariant.default)(0);
      return result.data;
    }
  }
});

// ../api/node_modules/graphql/utilities/buildClientSchema.js
var require_buildClientSchema = __commonJS({
  "../api/node_modules/graphql/utilities/buildClientSchema.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", {
      value: true
    });
    exports.buildClientSchema = buildClientSchema;
    var _objectValues = _interopRequireDefault(require_objectValues());
    var _inspect = _interopRequireDefault(require_inspect());
    var _devAssert = _interopRequireDefault(require_devAssert());
    var _keyValMap = _interopRequireDefault(require_keyValMap());
    var _isObjectLike = _interopRequireDefault(require_isObjectLike());
    var _parser = require_parser();
    var _directives = require_directives();
    var _scalars = require_scalars();
    var _introspection = require_introspection();
    var _schema = require_schema();
    var _definition = require_definition();
    var _valueFromAST = require_valueFromAST();
    function _interopRequireDefault(obj) {
      return obj && obj.__esModule ? obj : { default: obj };
    }
    function buildClientSchema(introspection, options) {
      (0, _isObjectLike.default)(introspection) && (0, _isObjectLike.default)(introspection.__schema) || (0, _devAssert.default)(0, 'Invalid or incomplete introspection result. Ensure that you are passing "data" property of introspection response and no "errors" was returned alongside: ' + (0, _inspect.default)(introspection));
      var schemaIntrospection = introspection.__schema;
      var typeMap = (0, _keyValMap.default)(schemaIntrospection.types, function(typeIntrospection) {
        return typeIntrospection.name;
      }, function(typeIntrospection) {
        return buildType(typeIntrospection);
      });
      for (var _i2 = 0, _ref2 = [].concat(_scalars.specifiedScalarTypes, _introspection.introspectionTypes); _i2 < _ref2.length; _i2++) {
        var stdType = _ref2[_i2];
        if (typeMap[stdType.name]) {
          typeMap[stdType.name] = stdType;
        }
      }
      var queryType = schemaIntrospection.queryType ? getObjectType(schemaIntrospection.queryType) : null;
      var mutationType = schemaIntrospection.mutationType ? getObjectType(schemaIntrospection.mutationType) : null;
      var subscriptionType = schemaIntrospection.subscriptionType ? getObjectType(schemaIntrospection.subscriptionType) : null;
      var directives = schemaIntrospection.directives ? schemaIntrospection.directives.map(buildDirective) : [];
      return new _schema.GraphQLSchema({
        query: queryType,
        mutation: mutationType,
        subscription: subscriptionType,
        types: (0, _objectValues.default)(typeMap),
        directives,
        assumeValid: options && options.assumeValid,
        allowedLegacyNames: options && options.allowedLegacyNames
      });
      function getType(typeRef) {
        if (typeRef.kind === _introspection.TypeKind.LIST) {
          var itemRef = typeRef.ofType;
          if (!itemRef) {
            throw new Error("Decorated type deeper than introspection query.");
          }
          return (0, _definition.GraphQLList)(getType(itemRef));
        }
        if (typeRef.kind === _introspection.TypeKind.NON_NULL) {
          var nullableRef = typeRef.ofType;
          if (!nullableRef) {
            throw new Error("Decorated type deeper than introspection query.");
          }
          var nullableType = getType(nullableRef);
          return (0, _definition.GraphQLNonNull)((0, _definition.assertNullableType)(nullableType));
        }
        if (!typeRef.name) {
          throw new Error("Unknown type reference: " + (0, _inspect.default)(typeRef));
        }
        return getNamedType(typeRef.name);
      }
      function getNamedType(typeName) {
        var type = typeMap[typeName];
        if (!type) {
          throw new Error("Invalid or incomplete schema, unknown type: ".concat(typeName, ". Ensure that a full introspection query is used in order to build a client schema."));
        }
        return type;
      }
      function getInputType(typeRef) {
        var type = getType(typeRef);
        if ((0, _definition.isInputType)(type)) {
          return type;
        }
        throw new Error("Introspection must provide input type for arguments, but received: " + (0, _inspect.default)(type) + ".");
      }
      function getOutputType(typeRef) {
        var type = getType(typeRef);
        if ((0, _definition.isOutputType)(type)) {
          return type;
        }
        throw new Error("Introspection must provide output type for fields, but received: " + (0, _inspect.default)(type) + ".");
      }
      function getObjectType(typeRef) {
        var type = getType(typeRef);
        return (0, _definition.assertObjectType)(type);
      }
      function getInterfaceType(typeRef) {
        var type = getType(typeRef);
        return (0, _definition.assertInterfaceType)(type);
      }
      function buildType(type) {
        if (type && type.name && type.kind) {
          switch (type.kind) {
            case _introspection.TypeKind.SCALAR:
              return buildScalarDef(type);
            case _introspection.TypeKind.OBJECT:
              return buildObjectDef(type);
            case _introspection.TypeKind.INTERFACE:
              return buildInterfaceDef(type);
            case _introspection.TypeKind.UNION:
              return buildUnionDef(type);
            case _introspection.TypeKind.ENUM:
              return buildEnumDef(type);
            case _introspection.TypeKind.INPUT_OBJECT:
              return buildInputObjectDef(type);
          }
        }
        throw new Error("Invalid or incomplete introspection result. Ensure that a full introspection query is used in order to build a client schema:" + (0, _inspect.default)(type));
      }
      function buildScalarDef(scalarIntrospection) {
        return new _definition.GraphQLScalarType({
          name: scalarIntrospection.name,
          description: scalarIntrospection.description
        });
      }
      function buildObjectDef(objectIntrospection) {
        if (!objectIntrospection.interfaces) {
          throw new Error("Introspection result missing interfaces: " + (0, _inspect.default)(objectIntrospection));
        }
        return new _definition.GraphQLObjectType({
          name: objectIntrospection.name,
          description: objectIntrospection.description,
          interfaces: function interfaces() {
            return objectIntrospection.interfaces.map(getInterfaceType);
          },
          fields: function fields() {
            return buildFieldDefMap(objectIntrospection);
          }
        });
      }
      function buildInterfaceDef(interfaceIntrospection) {
        return new _definition.GraphQLInterfaceType({
          name: interfaceIntrospection.name,
          description: interfaceIntrospection.description,
          fields: function fields() {
            return buildFieldDefMap(interfaceIntrospection);
          }
        });
      }
      function buildUnionDef(unionIntrospection) {
        if (!unionIntrospection.possibleTypes) {
          throw new Error("Introspection result missing possibleTypes: " + (0, _inspect.default)(unionIntrospection));
        }
        return new _definition.GraphQLUnionType({
          name: unionIntrospection.name,
          description: unionIntrospection.description,
          types: function types() {
            return unionIntrospection.possibleTypes.map(getObjectType);
          }
        });
      }
      function buildEnumDef(enumIntrospection) {
        if (!enumIntrospection.enumValues) {
          throw new Error("Introspection result missing enumValues: " + (0, _inspect.default)(enumIntrospection));
        }
        return new _definition.GraphQLEnumType({
          name: enumIntrospection.name,
          description: enumIntrospection.description,
          values: (0, _keyValMap.default)(enumIntrospection.enumValues, function(valueIntrospection) {
            return valueIntrospection.name;
          }, function(valueIntrospection) {
            return {
              description: valueIntrospection.description,
              deprecationReason: valueIntrospection.deprecationReason
            };
          })
        });
      }
      function buildInputObjectDef(inputObjectIntrospection) {
        if (!inputObjectIntrospection.inputFields) {
          throw new Error("Introspection result missing inputFields: " + (0, _inspect.default)(inputObjectIntrospection));
        }
        return new _definition.GraphQLInputObjectType({
          name: inputObjectIntrospection.name,
          description: inputObjectIntrospection.description,
          fields: function fields() {
            return buildInputValueDefMap(inputObjectIntrospection.inputFields);
          }
        });
      }
      function buildFieldDefMap(typeIntrospection) {
        if (!typeIntrospection.fields) {
          throw new Error("Introspection result missing fields: " + (0, _inspect.default)(typeIntrospection));
        }
        return (0, _keyValMap.default)(typeIntrospection.fields, function(fieldIntrospection) {
          return fieldIntrospection.name;
        }, function(fieldIntrospection) {
          if (!fieldIntrospection.args) {
            throw new Error("Introspection result missing field args: " + (0, _inspect.default)(fieldIntrospection));
          }
          return {
            description: fieldIntrospection.description,
            deprecationReason: fieldIntrospection.deprecationReason,
            type: getOutputType(fieldIntrospection.type),
            args: buildInputValueDefMap(fieldIntrospection.args)
          };
        });
      }
      function buildInputValueDefMap(inputValueIntrospections) {
        return (0, _keyValMap.default)(inputValueIntrospections, function(inputValue) {
          return inputValue.name;
        }, buildInputValue);
      }
      function buildInputValue(inputValueIntrospection) {
        var type = getInputType(inputValueIntrospection.type);
        var defaultValue = inputValueIntrospection.defaultValue ? (0, _valueFromAST.valueFromAST)((0, _parser.parseValue)(inputValueIntrospection.defaultValue), type) : void 0;
        return {
          description: inputValueIntrospection.description,
          type,
          defaultValue
        };
      }
      function buildDirective(directiveIntrospection) {
        if (!directiveIntrospection.args) {
          throw new Error("Introspection result missing directive args: " + (0, _inspect.default)(directiveIntrospection));
        }
        if (!directiveIntrospection.locations) {
          throw new Error("Introspection result missing directive locations: " + (0, _inspect.default)(directiveIntrospection));
        }
        return new _directives.GraphQLDirective({
          name: directiveIntrospection.name,
          description: directiveIntrospection.description,
          locations: directiveIntrospection.locations.slice(),
          args: buildInputValueDefMap(directiveIntrospection.args)
        });
      }
    }
  }
});

// ../api/node_modules/graphql/utilities/buildASTSchema.js
var require_buildASTSchema = __commonJS({
  "../api/node_modules/graphql/utilities/buildASTSchema.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", {
      value: true
    });
    exports.buildASTSchema = buildASTSchema;
    exports.getDescription = getDescription;
    exports.buildSchema = buildSchema;
    exports.ASTDefinitionBuilder = void 0;
    var _objectValues = _interopRequireDefault(require_objectValues());
    var _keyMap = _interopRequireDefault(require_keyMap());
    var _inspect = _interopRequireDefault(require_inspect());
    var _invariant = _interopRequireDefault(require_invariant());
    var _devAssert = _interopRequireDefault(require_devAssert());
    var _keyValMap = _interopRequireDefault(require_keyValMap());
    var _kinds = require_kinds();
    var _tokenKind = require_tokenKind();
    var _parser = require_parser();
    var _predicates = require_predicates();
    var _blockString = require_blockString();
    var _validate = require_validate2();
    var _values = require_values();
    var _scalars = require_scalars();
    var _introspection = require_introspection();
    var _schema = require_schema();
    var _directives = require_directives();
    var _definition = require_definition();
    var _valueFromAST = require_valueFromAST();
    function _interopRequireDefault(obj) {
      return obj && obj.__esModule ? obj : { default: obj };
    }
    function buildASTSchema(documentAST, options) {
      documentAST && documentAST.kind === _kinds.Kind.DOCUMENT || (0, _devAssert.default)(0, "Must provide valid Document AST");
      if (!options || !(options.assumeValid || options.assumeValidSDL)) {
        (0, _validate.assertValidSDL)(documentAST);
      }
      var schemaDef;
      var typeDefs = [];
      var directiveDefs = [];
      for (var _i2 = 0, _documentAST$definiti2 = documentAST.definitions; _i2 < _documentAST$definiti2.length; _i2++) {
        var def = _documentAST$definiti2[_i2];
        if (def.kind === _kinds.Kind.SCHEMA_DEFINITION) {
          schemaDef = def;
        } else if ((0, _predicates.isTypeDefinitionNode)(def)) {
          typeDefs.push(def);
        } else if (def.kind === _kinds.Kind.DIRECTIVE_DEFINITION) {
          directiveDefs.push(def);
        }
      }
      var astBuilder = new ASTDefinitionBuilder(options, function(typeName) {
        var type = typeMap[typeName];
        if (type === void 0) {
          throw new Error('Type "'.concat(typeName, '" not found in document.'));
        }
        return type;
      });
      var typeMap = keyByNameNode(typeDefs, function(node) {
        return astBuilder.buildType(node);
      });
      var operationTypes = schemaDef ? getOperationTypes(schemaDef) : {
        query: "Query",
        mutation: "Mutation",
        subscription: "Subscription"
      };
      var directives = directiveDefs.map(function(def2) {
        return astBuilder.buildDirective(def2);
      });
      if (!directives.some(function(directive) {
        return directive.name === "skip";
      })) {
        directives.push(_directives.GraphQLSkipDirective);
      }
      if (!directives.some(function(directive) {
        return directive.name === "include";
      })) {
        directives.push(_directives.GraphQLIncludeDirective);
      }
      if (!directives.some(function(directive) {
        return directive.name === "deprecated";
      })) {
        directives.push(_directives.GraphQLDeprecatedDirective);
      }
      return new _schema.GraphQLSchema({
        query: operationTypes.query ? typeMap[operationTypes.query] : null,
        mutation: operationTypes.mutation ? typeMap[operationTypes.mutation] : null,
        subscription: operationTypes.subscription ? typeMap[operationTypes.subscription] : null,
        types: (0, _objectValues.default)(typeMap),
        directives,
        astNode: schemaDef,
        assumeValid: options && options.assumeValid,
        allowedLegacyNames: options && options.allowedLegacyNames
      });
      function getOperationTypes(schema) {
        var opTypes = {};
        for (var _i4 = 0, _schema$operationType2 = schema.operationTypes; _i4 < _schema$operationType2.length; _i4++) {
          var operationType = _schema$operationType2[_i4];
          opTypes[operationType.operation] = operationType.type.name.value;
        }
        return opTypes;
      }
    }
    var stdTypeMap = (0, _keyMap.default)(_scalars.specifiedScalarTypes.concat(_introspection.introspectionTypes), function(type) {
      return type.name;
    });
    var ASTDefinitionBuilder = /* @__PURE__ */ function() {
      function ASTDefinitionBuilder2(options, resolveType) {
        this._options = options;
        this._resolveType = resolveType;
      }
      var _proto = ASTDefinitionBuilder2.prototype;
      _proto.getNamedType = function getNamedType(node) {
        var name = node.name.value;
        return stdTypeMap[name] || this._resolveType(name);
      };
      _proto.getWrappedType = function getWrappedType(node) {
        if (node.kind === _kinds.Kind.LIST_TYPE) {
          return new _definition.GraphQLList(this.getWrappedType(node.type));
        }
        if (node.kind === _kinds.Kind.NON_NULL_TYPE) {
          return new _definition.GraphQLNonNull(this.getWrappedType(node.type));
        }
        return this.getNamedType(node);
      };
      _proto.buildDirective = function buildDirective(directive) {
        var _this = this;
        var locations = directive.locations.map(function(_ref) {
          var value = _ref.value;
          return value;
        });
        return new _directives.GraphQLDirective({
          name: directive.name.value,
          description: getDescription(directive, this._options),
          locations,
          isRepeatable: directive.repeatable,
          args: keyByNameNode(directive.arguments || [], function(arg) {
            return _this.buildArg(arg);
          }),
          astNode: directive
        });
      };
      _proto.buildField = function buildField(field) {
        var _this2 = this;
        return {
          type: this.getWrappedType(field.type),
          description: getDescription(field, this._options),
          args: keyByNameNode(field.arguments || [], function(arg) {
            return _this2.buildArg(arg);
          }),
          deprecationReason: getDeprecationReason(field),
          astNode: field
        };
      };
      _proto.buildArg = function buildArg(value) {
        var type = this.getWrappedType(value.type);
        return {
          type,
          description: getDescription(value, this._options),
          defaultValue: (0, _valueFromAST.valueFromAST)(value.defaultValue, type),
          astNode: value
        };
      };
      _proto.buildInputField = function buildInputField(value) {
        var type = this.getWrappedType(value.type);
        return {
          type,
          description: getDescription(value, this._options),
          defaultValue: (0, _valueFromAST.valueFromAST)(value.defaultValue, type),
          astNode: value
        };
      };
      _proto.buildEnumValue = function buildEnumValue(value) {
        return {
          description: getDescription(value, this._options),
          deprecationReason: getDeprecationReason(value),
          astNode: value
        };
      };
      _proto.buildType = function buildType(astNode) {
        var name = astNode.name.value;
        if (stdTypeMap[name]) {
          return stdTypeMap[name];
        }
        switch (astNode.kind) {
          case _kinds.Kind.OBJECT_TYPE_DEFINITION:
            return this._makeTypeDef(astNode);
          case _kinds.Kind.INTERFACE_TYPE_DEFINITION:
            return this._makeInterfaceDef(astNode);
          case _kinds.Kind.ENUM_TYPE_DEFINITION:
            return this._makeEnumDef(astNode);
          case _kinds.Kind.UNION_TYPE_DEFINITION:
            return this._makeUnionDef(astNode);
          case _kinds.Kind.SCALAR_TYPE_DEFINITION:
            return this._makeScalarDef(astNode);
          case _kinds.Kind.INPUT_OBJECT_TYPE_DEFINITION:
            return this._makeInputObjectDef(astNode);
        }
        (0, _invariant.default)(false, "Unexpected type definition node: " + (0, _inspect.default)(astNode));
      };
      _proto._makeTypeDef = function _makeTypeDef(astNode) {
        var _this3 = this;
        var interfaceNodes = astNode.interfaces;
        var fieldNodes = astNode.fields;
        var interfaces = interfaceNodes && interfaceNodes.length > 0 ? function() {
          return interfaceNodes.map(function(ref) {
            return _this3.getNamedType(ref);
          });
        } : [];
        var fields = fieldNodes && fieldNodes.length > 0 ? function() {
          return keyByNameNode(fieldNodes, function(field) {
            return _this3.buildField(field);
          });
        } : /* @__PURE__ */ Object.create(null);
        return new _definition.GraphQLObjectType({
          name: astNode.name.value,
          description: getDescription(astNode, this._options),
          interfaces,
          fields,
          astNode
        });
      };
      _proto._makeInterfaceDef = function _makeInterfaceDef(astNode) {
        var _this4 = this;
        var fieldNodes = astNode.fields;
        var fields = fieldNodes && fieldNodes.length > 0 ? function() {
          return keyByNameNode(fieldNodes, function(field) {
            return _this4.buildField(field);
          });
        } : /* @__PURE__ */ Object.create(null);
        return new _definition.GraphQLInterfaceType({
          name: astNode.name.value,
          description: getDescription(astNode, this._options),
          fields,
          astNode
        });
      };
      _proto._makeEnumDef = function _makeEnumDef(astNode) {
        var _this5 = this;
        var valueNodes = astNode.values || [];
        return new _definition.GraphQLEnumType({
          name: astNode.name.value,
          description: getDescription(astNode, this._options),
          values: keyByNameNode(valueNodes, function(value) {
            return _this5.buildEnumValue(value);
          }),
          astNode
        });
      };
      _proto._makeUnionDef = function _makeUnionDef(astNode) {
        var _this6 = this;
        var typeNodes = astNode.types;
        var types = typeNodes && typeNodes.length > 0 ? function() {
          return typeNodes.map(function(ref) {
            return _this6.getNamedType(ref);
          });
        } : [];
        return new _definition.GraphQLUnionType({
          name: astNode.name.value,
          description: getDescription(astNode, this._options),
          types,
          astNode
        });
      };
      _proto._makeScalarDef = function _makeScalarDef(astNode) {
        return new _definition.GraphQLScalarType({
          name: astNode.name.value,
          description: getDescription(astNode, this._options),
          astNode
        });
      };
      _proto._makeInputObjectDef = function _makeInputObjectDef(def) {
        var _this7 = this;
        var fields = def.fields;
        return new _definition.GraphQLInputObjectType({
          name: def.name.value,
          description: getDescription(def, this._options),
          fields: fields ? function() {
            return keyByNameNode(fields, function(field) {
              return _this7.buildInputField(field);
            });
          } : /* @__PURE__ */ Object.create(null),
          astNode: def
        });
      };
      return ASTDefinitionBuilder2;
    }();
    exports.ASTDefinitionBuilder = ASTDefinitionBuilder;
    function keyByNameNode(list, valFn) {
      return (0, _keyValMap.default)(list, function(_ref2) {
        var name = _ref2.name;
        return name.value;
      }, valFn);
    }
    function getDeprecationReason(node) {
      var deprecated = (0, _values.getDirectiveValues)(_directives.GraphQLDeprecatedDirective, node);
      return deprecated && deprecated.reason;
    }
    function getDescription(node, options) {
      if (node.description) {
        return node.description.value;
      }
      if (options && options.commentDescriptions) {
        var rawValue = getLeadingCommentBlock(node);
        if (rawValue !== void 0) {
          return (0, _blockString.dedentBlockStringValue)("\n" + rawValue);
        }
      }
    }
    function getLeadingCommentBlock(node) {
      var loc = node.loc;
      if (!loc) {
        return;
      }
      var comments = [];
      var token = loc.startToken.prev;
      while (token && token.kind === _tokenKind.TokenKind.COMMENT && token.next && token.prev && token.line + 1 === token.next.line && token.line !== token.prev.line) {
        var value = String(token.value);
        comments.push(value);
        token = token.prev;
      }
      return comments.reverse().join("\n");
    }
    function buildSchema(source, options) {
      return buildASTSchema((0, _parser.parse)(source, options), options);
    }
  }
});

// ../api/node_modules/graphql/utilities/extendSchema.js
var require_extendSchema = __commonJS({
  "../api/node_modules/graphql/utilities/extendSchema.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", {
      value: true
    });
    exports.extendSchema = extendSchema;
    var _flatMap = _interopRequireDefault(require_flatMap());
    var _objectValues = _interopRequireDefault(require_objectValues());
    var _inspect = _interopRequireDefault(require_inspect());
    var _mapValue = _interopRequireDefault(require_mapValue());
    var _invariant = _interopRequireDefault(require_invariant());
    var _devAssert = _interopRequireDefault(require_devAssert());
    var _keyValMap = _interopRequireDefault(require_keyValMap());
    var _kinds = require_kinds();
    var _predicates = require_predicates();
    var _validate = require_validate2();
    var _directives = require_directives();
    var _scalars = require_scalars();
    var _introspection = require_introspection();
    var _schema = require_schema();
    var _definition = require_definition();
    var _buildASTSchema = require_buildASTSchema();
    function _interopRequireDefault(obj) {
      return obj && obj.__esModule ? obj : { default: obj };
    }
    function ownKeys(object, enumerableOnly) {
      var keys = Object.keys(object);
      if (Object.getOwnPropertySymbols) {
        var symbols = Object.getOwnPropertySymbols(object);
        if (enumerableOnly)
          symbols = symbols.filter(function(sym) {
            return Object.getOwnPropertyDescriptor(object, sym).enumerable;
          });
        keys.push.apply(keys, symbols);
      }
      return keys;
    }
    function _objectSpread(target) {
      for (var i = 1; i < arguments.length; i++) {
        var source = arguments[i] != null ? arguments[i] : {};
        if (i % 2) {
          ownKeys(source, true).forEach(function(key) {
            _defineProperty(target, key, source[key]);
          });
        } else if (Object.getOwnPropertyDescriptors) {
          Object.defineProperties(target, Object.getOwnPropertyDescriptors(source));
        } else {
          ownKeys(source).forEach(function(key) {
            Object.defineProperty(target, key, Object.getOwnPropertyDescriptor(source, key));
          });
        }
      }
      return target;
    }
    function _defineProperty(obj, key, value) {
      if (key in obj) {
        Object.defineProperty(obj, key, { value, enumerable: true, configurable: true, writable: true });
      } else {
        obj[key] = value;
      }
      return obj;
    }
    function extendSchema(schema, documentAST, options) {
      (0, _schema.assertSchema)(schema);
      documentAST && documentAST.kind === _kinds.Kind.DOCUMENT || (0, _devAssert.default)(0, "Must provide valid Document AST");
      if (!options || !(options.assumeValid || options.assumeValidSDL)) {
        (0, _validate.assertValidSDLExtension)(documentAST, schema);
      }
      var typeDefs = [];
      var typeExtsMap = /* @__PURE__ */ Object.create(null);
      var directiveDefs = [];
      var schemaDef;
      var schemaExts = [];
      for (var _i2 = 0, _documentAST$definiti2 = documentAST.definitions; _i2 < _documentAST$definiti2.length; _i2++) {
        var def = _documentAST$definiti2[_i2];
        if (def.kind === _kinds.Kind.SCHEMA_DEFINITION) {
          schemaDef = def;
        } else if (def.kind === _kinds.Kind.SCHEMA_EXTENSION) {
          schemaExts.push(def);
        } else if ((0, _predicates.isTypeDefinitionNode)(def)) {
          typeDefs.push(def);
        } else if ((0, _predicates.isTypeExtensionNode)(def)) {
          var extendedTypeName = def.name.value;
          var existingTypeExts = typeExtsMap[extendedTypeName];
          typeExtsMap[extendedTypeName] = existingTypeExts ? existingTypeExts.concat([def]) : [def];
        } else if (def.kind === _kinds.Kind.DIRECTIVE_DEFINITION) {
          directiveDefs.push(def);
        }
      }
      if (Object.keys(typeExtsMap).length === 0 && typeDefs.length === 0 && directiveDefs.length === 0 && schemaExts.length === 0 && !schemaDef) {
        return schema;
      }
      var schemaConfig = schema.toConfig();
      var astBuilder = new _buildASTSchema.ASTDefinitionBuilder(options, function(typeName) {
        var type2 = typeMap[typeName];
        if (type2 === void 0) {
          throw new Error('Unknown type: "'.concat(typeName, '".'));
        }
        return type2;
      });
      var typeMap = (0, _keyValMap.default)(typeDefs, function(node) {
        return node.name.value;
      }, function(node) {
        return astBuilder.buildType(node);
      });
      for (var _i4 = 0, _schemaConfig$types2 = schemaConfig.types; _i4 < _schemaConfig$types2.length; _i4++) {
        var existingType = _schemaConfig$types2[_i4];
        typeMap[existingType.name] = extendNamedType(existingType);
      }
      var operationTypes = {
        query: schemaConfig.query && schemaConfig.query.name,
        mutation: schemaConfig.mutation && schemaConfig.mutation.name,
        subscription: schemaConfig.subscription && schemaConfig.subscription.name
      };
      if (schemaDef) {
        for (var _i6 = 0, _schemaDef$operationT2 = schemaDef.operationTypes; _i6 < _schemaDef$operationT2.length; _i6++) {
          var _ref2 = _schemaDef$operationT2[_i6];
          var operation = _ref2.operation;
          var type = _ref2.type;
          operationTypes[operation] = type.name.value;
        }
      }
      for (var _i8 = 0; _i8 < schemaExts.length; _i8++) {
        var schemaExt = schemaExts[_i8];
        if (schemaExt.operationTypes) {
          for (var _i10 = 0, _schemaExt$operationT2 = schemaExt.operationTypes; _i10 < _schemaExt$operationT2.length; _i10++) {
            var _ref4 = _schemaExt$operationT2[_i10];
            var _operation = _ref4.operation;
            var _type = _ref4.type;
            operationTypes[_operation] = _type.name.value;
          }
        }
      }
      var allowedLegacyNames = schemaConfig.allowedLegacyNames.concat(options && options.allowedLegacyNames || []);
      return new _schema.GraphQLSchema({
        query: getMaybeTypeByName(operationTypes.query),
        mutation: getMaybeTypeByName(operationTypes.mutation),
        subscription: getMaybeTypeByName(operationTypes.subscription),
        types: (0, _objectValues.default)(typeMap),
        directives: getMergedDirectives(),
        astNode: schemaDef || schemaConfig.astNode,
        extensionASTNodes: schemaConfig.extensionASTNodes.concat(schemaExts),
        allowedLegacyNames
      });
      function replaceType(type2) {
        if ((0, _definition.isListType)(type2)) {
          return new _definition.GraphQLList(replaceType(type2.ofType));
        } else if ((0, _definition.isNonNullType)(type2)) {
          return new _definition.GraphQLNonNull(replaceType(type2.ofType));
        }
        return replaceNamedType(type2);
      }
      function replaceNamedType(type2) {
        return typeMap[type2.name];
      }
      function getMaybeTypeByName(typeName) {
        return typeName ? typeMap[typeName] : null;
      }
      function getMergedDirectives() {
        var existingDirectives = schema.getDirectives().map(extendDirective);
        existingDirectives || (0, _devAssert.default)(0, "schema must have default directives");
        return existingDirectives.concat(directiveDefs.map(function(node) {
          return astBuilder.buildDirective(node);
        }));
      }
      function extendNamedType(type2) {
        if ((0, _introspection.isIntrospectionType)(type2) || (0, _scalars.isSpecifiedScalarType)(type2)) {
          return type2;
        } else if ((0, _definition.isScalarType)(type2)) {
          return extendScalarType(type2);
        } else if ((0, _definition.isObjectType)(type2)) {
          return extendObjectType(type2);
        } else if ((0, _definition.isInterfaceType)(type2)) {
          return extendInterfaceType(type2);
        } else if ((0, _definition.isUnionType)(type2)) {
          return extendUnionType(type2);
        } else if ((0, _definition.isEnumType)(type2)) {
          return extendEnumType(type2);
        } else if ((0, _definition.isInputObjectType)(type2)) {
          return extendInputObjectType(type2);
        }
        (0, _invariant.default)(false, "Unexpected type: " + (0, _inspect.default)(type2));
      }
      function extendDirective(directive) {
        var config = directive.toConfig();
        return new _directives.GraphQLDirective(_objectSpread({}, config, {
          args: (0, _mapValue.default)(config.args, extendArg)
        }));
      }
      function extendInputObjectType(type2) {
        var config = type2.toConfig();
        var extensions = typeExtsMap[config.name] || [];
        var fieldNodes = (0, _flatMap.default)(extensions, function(node) {
          return node.fields || [];
        });
        return new _definition.GraphQLInputObjectType(_objectSpread({}, config, {
          fields: function fields() {
            return _objectSpread({}, (0, _mapValue.default)(config.fields, function(field) {
              return _objectSpread({}, field, {
                type: replaceType(field.type)
              });
            }), {}, (0, _keyValMap.default)(fieldNodes, function(field) {
              return field.name.value;
            }, function(field) {
              return astBuilder.buildInputField(field);
            }));
          },
          extensionASTNodes: config.extensionASTNodes.concat(extensions)
        }));
      }
      function extendEnumType(type2) {
        var config = type2.toConfig();
        var extensions = typeExtsMap[type2.name] || [];
        var valueNodes = (0, _flatMap.default)(extensions, function(node) {
          return node.values || [];
        });
        return new _definition.GraphQLEnumType(_objectSpread({}, config, {
          values: _objectSpread({}, config.values, {}, (0, _keyValMap.default)(valueNodes, function(value) {
            return value.name.value;
          }, function(value) {
            return astBuilder.buildEnumValue(value);
          })),
          extensionASTNodes: config.extensionASTNodes.concat(extensions)
        }));
      }
      function extendScalarType(type2) {
        var config = type2.toConfig();
        var extensions = typeExtsMap[config.name] || [];
        return new _definition.GraphQLScalarType(_objectSpread({}, config, {
          extensionASTNodes: config.extensionASTNodes.concat(extensions)
        }));
      }
      function extendObjectType(type2) {
        var config = type2.toConfig();
        var extensions = typeExtsMap[config.name] || [];
        var interfaceNodes = (0, _flatMap.default)(extensions, function(node) {
          return node.interfaces || [];
        });
        var fieldNodes = (0, _flatMap.default)(extensions, function(node) {
          return node.fields || [];
        });
        return new _definition.GraphQLObjectType(_objectSpread({}, config, {
          interfaces: function interfaces() {
            return [].concat(type2.getInterfaces().map(replaceNamedType), interfaceNodes.map(function(node) {
              return astBuilder.getNamedType(node);
            }));
          },
          fields: function fields() {
            return _objectSpread({}, (0, _mapValue.default)(config.fields, extendField), {}, (0, _keyValMap.default)(fieldNodes, function(node) {
              return node.name.value;
            }, function(node) {
              return astBuilder.buildField(node);
            }));
          },
          extensionASTNodes: config.extensionASTNodes.concat(extensions)
        }));
      }
      function extendInterfaceType(type2) {
        var config = type2.toConfig();
        var extensions = typeExtsMap[config.name] || [];
        var fieldNodes = (0, _flatMap.default)(extensions, function(node) {
          return node.fields || [];
        });
        return new _definition.GraphQLInterfaceType(_objectSpread({}, config, {
          fields: function fields() {
            return _objectSpread({}, (0, _mapValue.default)(config.fields, extendField), {}, (0, _keyValMap.default)(fieldNodes, function(node) {
              return node.name.value;
            }, function(node) {
              return astBuilder.buildField(node);
            }));
          },
          extensionASTNodes: config.extensionASTNodes.concat(extensions)
        }));
      }
      function extendUnionType(type2) {
        var config = type2.toConfig();
        var extensions = typeExtsMap[config.name] || [];
        var typeNodes = (0, _flatMap.default)(extensions, function(node) {
          return node.types || [];
        });
        return new _definition.GraphQLUnionType(_objectSpread({}, config, {
          types: function types() {
            return [].concat(type2.getTypes().map(replaceNamedType), typeNodes.map(function(node) {
              return astBuilder.getNamedType(node);
            }));
          },
          extensionASTNodes: config.extensionASTNodes.concat(extensions)
        }));
      }
      function extendField(field) {
        return _objectSpread({}, field, {
          type: replaceType(field.type),
          args: (0, _mapValue.default)(field.args, extendArg)
        });
      }
      function extendArg(arg) {
        return _objectSpread({}, arg, {
          type: replaceType(arg.type)
        });
      }
    }
  }
});

// ../api/node_modules/graphql/utilities/lexicographicSortSchema.js
var require_lexicographicSortSchema = __commonJS({
  "../api/node_modules/graphql/utilities/lexicographicSortSchema.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", {
      value: true
    });
    exports.lexicographicSortSchema = lexicographicSortSchema;
    var _objectValues = _interopRequireDefault(require_objectValues());
    var _inspect = _interopRequireDefault(require_inspect());
    var _invariant = _interopRequireDefault(require_invariant());
    var _keyValMap = _interopRequireDefault(require_keyValMap());
    var _schema = require_schema();
    var _directives = require_directives();
    var _introspection = require_introspection();
    var _definition = require_definition();
    function _interopRequireDefault(obj) {
      return obj && obj.__esModule ? obj : { default: obj };
    }
    function ownKeys(object, enumerableOnly) {
      var keys = Object.keys(object);
      if (Object.getOwnPropertySymbols) {
        var symbols = Object.getOwnPropertySymbols(object);
        if (enumerableOnly)
          symbols = symbols.filter(function(sym) {
            return Object.getOwnPropertyDescriptor(object, sym).enumerable;
          });
        keys.push.apply(keys, symbols);
      }
      return keys;
    }
    function _objectSpread(target) {
      for (var i = 1; i < arguments.length; i++) {
        var source = arguments[i] != null ? arguments[i] : {};
        if (i % 2) {
          ownKeys(source, true).forEach(function(key) {
            _defineProperty(target, key, source[key]);
          });
        } else if (Object.getOwnPropertyDescriptors) {
          Object.defineProperties(target, Object.getOwnPropertyDescriptors(source));
        } else {
          ownKeys(source).forEach(function(key) {
            Object.defineProperty(target, key, Object.getOwnPropertyDescriptor(source, key));
          });
        }
      }
      return target;
    }
    function _defineProperty(obj, key, value) {
      if (key in obj) {
        Object.defineProperty(obj, key, { value, enumerable: true, configurable: true, writable: true });
      } else {
        obj[key] = value;
      }
      return obj;
    }
    function lexicographicSortSchema(schema) {
      var schemaConfig = schema.toConfig();
      var typeMap = (0, _keyValMap.default)(sortByName(schemaConfig.types), function(type) {
        return type.name;
      }, sortNamedType);
      return new _schema.GraphQLSchema(_objectSpread({}, schemaConfig, {
        types: (0, _objectValues.default)(typeMap),
        directives: sortByName(schemaConfig.directives).map(sortDirective),
        query: replaceMaybeType(schemaConfig.query),
        mutation: replaceMaybeType(schemaConfig.mutation),
        subscription: replaceMaybeType(schemaConfig.subscription)
      }));
      function replaceType(type) {
        if ((0, _definition.isListType)(type)) {
          return new _definition.GraphQLList(replaceType(type.ofType));
        } else if ((0, _definition.isNonNullType)(type)) {
          return new _definition.GraphQLNonNull(replaceType(type.ofType));
        }
        return replaceNamedType(type);
      }
      function replaceNamedType(type) {
        return typeMap[type.name];
      }
      function replaceMaybeType(maybeType) {
        return maybeType && replaceNamedType(maybeType);
      }
      function sortDirective(directive) {
        var config = directive.toConfig();
        return new _directives.GraphQLDirective(_objectSpread({}, config, {
          locations: sortBy(config.locations, function(x) {
            return x;
          }),
          args: sortArgs(config.args)
        }));
      }
      function sortArgs(args) {
        return sortObjMap(args, function(arg) {
          return _objectSpread({}, arg, {
            type: replaceType(arg.type)
          });
        });
      }
      function sortFields(fieldsMap) {
        return sortObjMap(fieldsMap, function(field) {
          return _objectSpread({}, field, {
            type: replaceType(field.type),
            args: sortArgs(field.args)
          });
        });
      }
      function sortInputFields(fieldsMap) {
        return sortObjMap(fieldsMap, function(field) {
          return _objectSpread({}, field, {
            type: replaceType(field.type)
          });
        });
      }
      function sortTypes(arr) {
        return sortByName(arr).map(replaceNamedType);
      }
      function sortNamedType(type) {
        if ((0, _definition.isScalarType)(type) || (0, _introspection.isIntrospectionType)(type)) {
          return type;
        } else if ((0, _definition.isObjectType)(type)) {
          var config = type.toConfig();
          return new _definition.GraphQLObjectType(_objectSpread({}, config, {
            interfaces: function interfaces() {
              return sortTypes(config.interfaces);
            },
            fields: function fields() {
              return sortFields(config.fields);
            }
          }));
        } else if ((0, _definition.isInterfaceType)(type)) {
          var _config = type.toConfig();
          return new _definition.GraphQLInterfaceType(_objectSpread({}, _config, {
            fields: function fields() {
              return sortFields(_config.fields);
            }
          }));
        } else if ((0, _definition.isUnionType)(type)) {
          var _config2 = type.toConfig();
          return new _definition.GraphQLUnionType(_objectSpread({}, _config2, {
            types: function types() {
              return sortTypes(_config2.types);
            }
          }));
        } else if ((0, _definition.isEnumType)(type)) {
          var _config3 = type.toConfig();
          return new _definition.GraphQLEnumType(_objectSpread({}, _config3, {
            values: sortObjMap(_config3.values)
          }));
        } else if ((0, _definition.isInputObjectType)(type)) {
          var _config4 = type.toConfig();
          return new _definition.GraphQLInputObjectType(_objectSpread({}, _config4, {
            fields: function fields() {
              return sortInputFields(_config4.fields);
            }
          }));
        }
        (0, _invariant.default)(false, "Unexpected type: " + (0, _inspect.default)(type));
      }
    }
    function sortObjMap(map, sortValueFn) {
      var sortedMap = /* @__PURE__ */ Object.create(null);
      var sortedKeys = sortBy(Object.keys(map), function(x) {
        return x;
      });
      for (var _i2 = 0; _i2 < sortedKeys.length; _i2++) {
        var key = sortedKeys[_i2];
        var value = map[key];
        sortedMap[key] = sortValueFn ? sortValueFn(value) : value;
      }
      return sortedMap;
    }
    function sortByName(array) {
      return sortBy(array, function(obj) {
        return obj.name;
      });
    }
    function sortBy(array, mapToKey) {
      return array.slice().sort(function(obj1, obj2) {
        var key1 = mapToKey(obj1);
        var key2 = mapToKey(obj2);
        return key1.localeCompare(key2);
      });
    }
  }
});

// ../api/node_modules/graphql/utilities/schemaPrinter.js
var require_schemaPrinter = __commonJS({
  "../api/node_modules/graphql/utilities/schemaPrinter.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", {
      value: true
    });
    exports.printSchema = printSchema;
    exports.printIntrospectionSchema = printIntrospectionSchema;
    exports.printType = printType;
    var _flatMap = _interopRequireDefault(require_flatMap());
    var _objectValues = _interopRequireDefault(require_objectValues());
    var _inspect = _interopRequireDefault(require_inspect());
    var _invariant = _interopRequireDefault(require_invariant());
    var _printer = require_printer();
    var _blockString = require_blockString();
    var _introspection = require_introspection();
    var _scalars = require_scalars();
    var _directives = require_directives();
    var _definition = require_definition();
    var _astFromValue = require_astFromValue();
    function _interopRequireDefault(obj) {
      return obj && obj.__esModule ? obj : { default: obj };
    }
    function printSchema(schema, options) {
      return printFilteredSchema(schema, function(n) {
        return !(0, _directives.isSpecifiedDirective)(n);
      }, isDefinedType, options);
    }
    function printIntrospectionSchema(schema, options) {
      return printFilteredSchema(schema, _directives.isSpecifiedDirective, _introspection.isIntrospectionType, options);
    }
    function isDefinedType(type) {
      return !(0, _scalars.isSpecifiedScalarType)(type) && !(0, _introspection.isIntrospectionType)(type);
    }
    function printFilteredSchema(schema, directiveFilter, typeFilter, options) {
      var directives = schema.getDirectives().filter(directiveFilter);
      var typeMap = schema.getTypeMap();
      var types = (0, _objectValues.default)(typeMap).sort(function(type1, type2) {
        return type1.name.localeCompare(type2.name);
      }).filter(typeFilter);
      return [printSchemaDefinition(schema)].concat(directives.map(function(directive) {
        return printDirective(directive, options);
      }), types.map(function(type) {
        return printType(type, options);
      })).filter(Boolean).join("\n\n") + "\n";
    }
    function printSchemaDefinition(schema) {
      if (isSchemaOfCommonNames(schema)) {
        return;
      }
      var operationTypes = [];
      var queryType = schema.getQueryType();
      if (queryType) {
        operationTypes.push("  query: ".concat(queryType.name));
      }
      var mutationType = schema.getMutationType();
      if (mutationType) {
        operationTypes.push("  mutation: ".concat(mutationType.name));
      }
      var subscriptionType = schema.getSubscriptionType();
      if (subscriptionType) {
        operationTypes.push("  subscription: ".concat(subscriptionType.name));
      }
      return "schema {\n".concat(operationTypes.join("\n"), "\n}");
    }
    function isSchemaOfCommonNames(schema) {
      var queryType = schema.getQueryType();
      if (queryType && queryType.name !== "Query") {
        return false;
      }
      var mutationType = schema.getMutationType();
      if (mutationType && mutationType.name !== "Mutation") {
        return false;
      }
      var subscriptionType = schema.getSubscriptionType();
      if (subscriptionType && subscriptionType.name !== "Subscription") {
        return false;
      }
      return true;
    }
    function printType(type, options) {
      if ((0, _definition.isScalarType)(type)) {
        return printScalar(type, options);
      } else if ((0, _definition.isObjectType)(type)) {
        return printObject(type, options);
      } else if ((0, _definition.isInterfaceType)(type)) {
        return printInterface(type, options);
      } else if ((0, _definition.isUnionType)(type)) {
        return printUnion(type, options);
      } else if ((0, _definition.isEnumType)(type)) {
        return printEnum(type, options);
      } else if ((0, _definition.isInputObjectType)(type)) {
        return printInputObject(type, options);
      }
      (0, _invariant.default)(false, "Unexpected type: " + (0, _inspect.default)(type));
    }
    function printScalar(type, options) {
      return printDescription(options, type) + "scalar ".concat(type.name);
    }
    function printObject(type, options) {
      var interfaces = type.getInterfaces();
      var implementedInterfaces = interfaces.length ? " implements " + interfaces.map(function(i) {
        return i.name;
      }).join(" & ") : "";
      return printDescription(options, type) + "type ".concat(type.name).concat(implementedInterfaces) + printFields(options, type);
    }
    function printInterface(type, options) {
      return printDescription(options, type) + "interface ".concat(type.name) + printFields(options, type);
    }
    function printUnion(type, options) {
      var types = type.getTypes();
      var possibleTypes = types.length ? " = " + types.join(" | ") : "";
      return printDescription(options, type) + "union " + type.name + possibleTypes;
    }
    function printEnum(type, options) {
      var values = type.getValues().map(function(value, i) {
        return printDescription(options, value, "  ", !i) + "  " + value.name + printDeprecated(value);
      });
      return printDescription(options, type) + "enum ".concat(type.name) + printBlock(values);
    }
    function printInputObject(type, options) {
      var fields = (0, _objectValues.default)(type.getFields()).map(function(f, i) {
        return printDescription(options, f, "  ", !i) + "  " + printInputValue(f);
      });
      return printDescription(options, type) + "input ".concat(type.name) + printBlock(fields);
    }
    function printFields(options, type) {
      var fields = (0, _objectValues.default)(type.getFields()).map(function(f, i) {
        return printDescription(options, f, "  ", !i) + "  " + f.name + printArgs(options, f.args, "  ") + ": " + String(f.type) + printDeprecated(f);
      });
      return printBlock(fields);
    }
    function printBlock(items) {
      return items.length !== 0 ? " {\n" + items.join("\n") + "\n}" : "";
    }
    function printArgs(options, args) {
      var indentation = arguments.length > 2 && arguments[2] !== void 0 ? arguments[2] : "";
      if (args.length === 0) {
        return "";
      }
      if (args.every(function(arg) {
        return !arg.description;
      })) {
        return "(" + args.map(printInputValue).join(", ") + ")";
      }
      return "(\n" + args.map(function(arg, i) {
        return printDescription(options, arg, "  " + indentation, !i) + "  " + indentation + printInputValue(arg);
      }).join("\n") + "\n" + indentation + ")";
    }
    function printInputValue(arg) {
      var defaultAST = (0, _astFromValue.astFromValue)(arg.defaultValue, arg.type);
      var argDecl = arg.name + ": " + String(arg.type);
      if (defaultAST) {
        argDecl += " = ".concat((0, _printer.print)(defaultAST));
      }
      return argDecl;
    }
    function printDirective(directive, options) {
      return printDescription(options, directive) + "directive @" + directive.name + printArgs(options, directive.args) + (directive.isRepeatable ? " repeatable" : "") + " on " + directive.locations.join(" | ");
    }
    function printDeprecated(fieldOrEnumVal) {
      if (!fieldOrEnumVal.isDeprecated) {
        return "";
      }
      var reason = fieldOrEnumVal.deprecationReason;
      var reasonAST = (0, _astFromValue.astFromValue)(reason, _scalars.GraphQLString);
      if (reasonAST && reason !== "" && reason !== _directives.DEFAULT_DEPRECATION_REASON) {
        return " @deprecated(reason: " + (0, _printer.print)(reasonAST) + ")";
      }
      return " @deprecated";
    }
    function printDescription(options, def) {
      var indentation = arguments.length > 2 && arguments[2] !== void 0 ? arguments[2] : "";
      var firstInBlock = arguments.length > 3 && arguments[3] !== void 0 ? arguments[3] : true;
      if (!def.description) {
        return "";
      }
      var lines = descriptionLines(def.description, 120 - indentation.length);
      if (options && options.commentDescriptions) {
        return printDescriptionWithComments(lines, indentation, firstInBlock);
      }
      var text = lines.join("\n");
      var preferMultipleLines = text.length > 70;
      var blockString = (0, _blockString.printBlockString)(text, "", preferMultipleLines);
      var prefix = indentation && !firstInBlock ? "\n" + indentation : indentation;
      return prefix + blockString.replace(/\n/g, "\n" + indentation) + "\n";
    }
    function printDescriptionWithComments(lines, indentation, firstInBlock) {
      var description = indentation && !firstInBlock ? "\n" : "";
      for (var _i2 = 0; _i2 < lines.length; _i2++) {
        var line = lines[_i2];
        if (line === "") {
          description += indentation + "#\n";
        } else {
          description += indentation + "# " + line + "\n";
        }
      }
      return description;
    }
    function descriptionLines(description, maxLen) {
      var rawLines = description.split("\n");
      return (0, _flatMap.default)(rawLines, function(line) {
        if (line.length < maxLen + 5) {
          return line;
        }
        return breakLine(line, maxLen);
      });
    }
    function breakLine(line, maxLen) {
      var parts = line.split(new RegExp("((?: |^).{15,".concat(maxLen - 40, "}(?= |$))")));
      if (parts.length < 4) {
        return [line];
      }
      var sublines = [parts[0] + parts[1] + parts[2]];
      for (var i = 3; i < parts.length; i += 2) {
        sublines.push(parts[i].slice(1) + parts[i + 1]);
      }
      return sublines;
    }
  }
});

// ../api/node_modules/graphql/utilities/coerceValue.js
var require_coerceValue = __commonJS({
  "../api/node_modules/graphql/utilities/coerceValue.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", {
      value: true
    });
    exports.coerceValue = coerceValue;
    var _inspect = _interopRequireDefault(require_inspect());
    var _printPathArray = _interopRequireDefault(require_printPathArray());
    var _Path = require_Path();
    var _GraphQLError = require_GraphQLError();
    var _coerceInputValue = require_coerceInputValue();
    function _interopRequireDefault(obj) {
      return obj && obj.__esModule ? obj : { default: obj };
    }
    function coerceValue(inputValue, type, blameNode, path) {
      var errors = [];
      var value = (0, _coerceInputValue.coerceInputValue)(inputValue, type, function(errorPath, invalidValue, error) {
        var errorPrefix = "Invalid value " + (0, _inspect.default)(invalidValue);
        var pathArray = [].concat((0, _Path.pathToArray)(path), errorPath);
        if (pathArray.length > 0) {
          errorPrefix += ' at "value'.concat((0, _printPathArray.default)(pathArray), '"');
        }
        errors.push(new _GraphQLError.GraphQLError(errorPrefix + ": " + error.message, blameNode, void 0, void 0, void 0, error.originalError));
      });
      return errors.length > 0 ? {
        errors,
        value: void 0
      } : {
        errors: void 0,
        value
      };
    }
  }
});

// ../api/node_modules/graphql/utilities/isValidJSValue.js
var require_isValidJSValue = __commonJS({
  "../api/node_modules/graphql/utilities/isValidJSValue.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", {
      value: true
    });
    exports.isValidJSValue = isValidJSValue;
    var _coerceValue = require_coerceValue();
    function isValidJSValue(value, type) {
      var errors = (0, _coerceValue.coerceValue)(value, type).errors;
      return errors ? errors.map(function(error) {
        return error.message;
      }) : [];
    }
  }
});

// ../api/node_modules/graphql/utilities/isValidLiteralValue.js
var require_isValidLiteralValue = __commonJS({
  "../api/node_modules/graphql/utilities/isValidLiteralValue.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", {
      value: true
    });
    exports.isValidLiteralValue = isValidLiteralValue;
    var _kinds = require_kinds();
    var _visitor = require_visitor();
    var _ValuesOfCorrectType = require_ValuesOfCorrectType();
    var _ValidationContext = require_ValidationContext();
    var _schema = require_schema();
    var _TypeInfo = require_TypeInfo();
    function isValidLiteralValue(type, valueNode) {
      var emptySchema = new _schema.GraphQLSchema({});
      var emptyDoc = {
        kind: _kinds.Kind.DOCUMENT,
        definitions: []
      };
      var typeInfo = new _TypeInfo.TypeInfo(emptySchema, void 0, type);
      var context = new _ValidationContext.ValidationContext(emptySchema, emptyDoc, typeInfo);
      var visitor = (0, _ValuesOfCorrectType.ValuesOfCorrectType)(context);
      (0, _visitor.visit)(valueNode, (0, _visitor.visitWithTypeInfo)(typeInfo, visitor));
      return context.getErrors();
    }
  }
});

// ../api/node_modules/graphql/utilities/concatAST.js
var require_concatAST = __commonJS({
  "../api/node_modules/graphql/utilities/concatAST.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", {
      value: true
    });
    exports.concatAST = concatAST;
    var _flatMap = _interopRequireDefault(require_flatMap());
    function _interopRequireDefault(obj) {
      return obj && obj.__esModule ? obj : { default: obj };
    }
    function concatAST(asts) {
      return {
        kind: "Document",
        definitions: (0, _flatMap.default)(asts, function(ast) {
          return ast.definitions;
        })
      };
    }
  }
});

// ../api/node_modules/graphql/utilities/separateOperations.js
var require_separateOperations = __commonJS({
  "../api/node_modules/graphql/utilities/separateOperations.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", {
      value: true
    });
    exports.separateOperations = separateOperations;
    var _visitor = require_visitor();
    function separateOperations(documentAST) {
      var operations = [];
      var fragments = /* @__PURE__ */ Object.create(null);
      var positions = /* @__PURE__ */ new Map();
      var depGraph = /* @__PURE__ */ Object.create(null);
      var fromName;
      var idx = 0;
      (0, _visitor.visit)(documentAST, {
        OperationDefinition: function OperationDefinition(node) {
          fromName = opName(node);
          operations.push(node);
          positions.set(node, idx++);
        },
        FragmentDefinition: function FragmentDefinition(node) {
          fromName = node.name.value;
          fragments[fromName] = node;
          positions.set(node, idx++);
        },
        FragmentSpread: function FragmentSpread(node) {
          var toName = node.name.value;
          (depGraph[fromName] || (depGraph[fromName] = /* @__PURE__ */ Object.create(null)))[toName] = true;
        }
      });
      var separatedDocumentASTs = /* @__PURE__ */ Object.create(null);
      for (var _i2 = 0; _i2 < operations.length; _i2++) {
        var operation = operations[_i2];
        var operationName = opName(operation);
        var dependencies = /* @__PURE__ */ Object.create(null);
        collectTransitiveDependencies(dependencies, depGraph, operationName);
        var definitions = [operation];
        for (var _i4 = 0, _Object$keys2 = Object.keys(dependencies); _i4 < _Object$keys2.length; _i4++) {
          var name = _Object$keys2[_i4];
          definitions.push(fragments[name]);
        }
        definitions.sort(function(n1, n2) {
          return (positions.get(n1) || 0) - (positions.get(n2) || 0);
        });
        separatedDocumentASTs[operationName] = {
          kind: "Document",
          definitions
        };
      }
      return separatedDocumentASTs;
    }
    function opName(operation) {
      return operation.name ? operation.name.value : "";
    }
    function collectTransitiveDependencies(collected, depGraph, fromName) {
      var immediateDeps = depGraph[fromName];
      if (immediateDeps) {
        for (var _i6 = 0, _Object$keys4 = Object.keys(immediateDeps); _i6 < _Object$keys4.length; _i6++) {
          var toName = _Object$keys4[_i6];
          if (!collected[toName]) {
            collected[toName] = true;
            collectTransitiveDependencies(collected, depGraph, toName);
          }
        }
      }
    }
  }
});

// ../api/node_modules/graphql/utilities/stripIgnoredCharacters.js
var require_stripIgnoredCharacters = __commonJS({
  "../api/node_modules/graphql/utilities/stripIgnoredCharacters.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", {
      value: true
    });
    exports.stripIgnoredCharacters = stripIgnoredCharacters;
    var _inspect = _interopRequireDefault(require_inspect());
    var _source = require_source();
    var _tokenKind = require_tokenKind();
    var _lexer = require_lexer();
    var _blockString = require_blockString();
    function _interopRequireDefault(obj) {
      return obj && obj.__esModule ? obj : { default: obj };
    }
    function stripIgnoredCharacters(source) {
      var sourceObj = typeof source === "string" ? new _source.Source(source) : source;
      if (!(sourceObj instanceof _source.Source)) {
        throw new TypeError("Must provide string or Source. Received: ".concat((0, _inspect.default)(sourceObj)));
      }
      var body = sourceObj.body;
      var lexer = (0, _lexer.createLexer)(sourceObj);
      var strippedBody = "";
      var wasLastAddedTokenNonPunctuator = false;
      while (lexer.advance().kind !== _tokenKind.TokenKind.EOF) {
        var currentToken = lexer.token;
        var tokenKind = currentToken.kind;
        var isNonPunctuator = !(0, _lexer.isPunctuatorToken)(currentToken);
        if (wasLastAddedTokenNonPunctuator) {
          if (isNonPunctuator || currentToken.kind === _tokenKind.TokenKind.SPREAD) {
            strippedBody += " ";
          }
        }
        var tokenBody = body.slice(currentToken.start, currentToken.end);
        if (tokenKind === _tokenKind.TokenKind.BLOCK_STRING) {
          strippedBody += dedentBlockString(tokenBody);
        } else {
          strippedBody += tokenBody;
        }
        wasLastAddedTokenNonPunctuator = isNonPunctuator;
      }
      return strippedBody;
    }
    function dedentBlockString(blockStr) {
      var rawStr = blockStr.slice(3, -3);
      var body = (0, _blockString.dedentBlockStringValue)(rawStr);
      var lines = body.split(/\r\n|[\n\r]/g);
      if ((0, _blockString.getBlockStringIndentation)(lines) > 0) {
        body = "\n" + body;
      }
      var lastChar = body[body.length - 1];
      var hasTrailingQuote = lastChar === '"' && body.slice(-4) !== '\\"""';
      if (hasTrailingQuote || lastChar === "\\") {
        body += "\n";
      }
      return '"""' + body + '"""';
    }
  }
});

// ../api/node_modules/graphql/utilities/findBreakingChanges.js
var require_findBreakingChanges = __commonJS({
  "../api/node_modules/graphql/utilities/findBreakingChanges.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", {
      value: true
    });
    exports.findBreakingChanges = findBreakingChanges;
    exports.findDangerousChanges = findDangerousChanges;
    exports.DangerousChangeType = exports.BreakingChangeType = void 0;
    var _objectValues = _interopRequireDefault(require_objectValues());
    var _keyMap = _interopRequireDefault(require_keyMap());
    var _inspect = _interopRequireDefault(require_inspect());
    var _invariant = _interopRequireDefault(require_invariant());
    var _printer = require_printer();
    var _visitor = require_visitor();
    var _definition = require_definition();
    var _astFromValue = require_astFromValue();
    function _interopRequireDefault(obj) {
      return obj && obj.__esModule ? obj : { default: obj };
    }
    function ownKeys(object, enumerableOnly) {
      var keys = Object.keys(object);
      if (Object.getOwnPropertySymbols) {
        var symbols = Object.getOwnPropertySymbols(object);
        if (enumerableOnly)
          symbols = symbols.filter(function(sym) {
            return Object.getOwnPropertyDescriptor(object, sym).enumerable;
          });
        keys.push.apply(keys, symbols);
      }
      return keys;
    }
    function _objectSpread(target) {
      for (var i = 1; i < arguments.length; i++) {
        var source = arguments[i] != null ? arguments[i] : {};
        if (i % 2) {
          ownKeys(source, true).forEach(function(key) {
            _defineProperty(target, key, source[key]);
          });
        } else if (Object.getOwnPropertyDescriptors) {
          Object.defineProperties(target, Object.getOwnPropertyDescriptors(source));
        } else {
          ownKeys(source).forEach(function(key) {
            Object.defineProperty(target, key, Object.getOwnPropertyDescriptor(source, key));
          });
        }
      }
      return target;
    }
    function _defineProperty(obj, key, value) {
      if (key in obj) {
        Object.defineProperty(obj, key, { value, enumerable: true, configurable: true, writable: true });
      } else {
        obj[key] = value;
      }
      return obj;
    }
    var BreakingChangeType = Object.freeze({
      TYPE_REMOVED: "TYPE_REMOVED",
      TYPE_CHANGED_KIND: "TYPE_CHANGED_KIND",
      TYPE_REMOVED_FROM_UNION: "TYPE_REMOVED_FROM_UNION",
      VALUE_REMOVED_FROM_ENUM: "VALUE_REMOVED_FROM_ENUM",
      REQUIRED_INPUT_FIELD_ADDED: "REQUIRED_INPUT_FIELD_ADDED",
      INTERFACE_REMOVED_FROM_OBJECT: "INTERFACE_REMOVED_FROM_OBJECT",
      FIELD_REMOVED: "FIELD_REMOVED",
      FIELD_CHANGED_KIND: "FIELD_CHANGED_KIND",
      REQUIRED_ARG_ADDED: "REQUIRED_ARG_ADDED",
      ARG_REMOVED: "ARG_REMOVED",
      ARG_CHANGED_KIND: "ARG_CHANGED_KIND",
      DIRECTIVE_REMOVED: "DIRECTIVE_REMOVED",
      DIRECTIVE_ARG_REMOVED: "DIRECTIVE_ARG_REMOVED",
      REQUIRED_DIRECTIVE_ARG_ADDED: "REQUIRED_DIRECTIVE_ARG_ADDED",
      DIRECTIVE_LOCATION_REMOVED: "DIRECTIVE_LOCATION_REMOVED"
    });
    exports.BreakingChangeType = BreakingChangeType;
    var DangerousChangeType = Object.freeze({
      VALUE_ADDED_TO_ENUM: "VALUE_ADDED_TO_ENUM",
      TYPE_ADDED_TO_UNION: "TYPE_ADDED_TO_UNION",
      OPTIONAL_INPUT_FIELD_ADDED: "OPTIONAL_INPUT_FIELD_ADDED",
      OPTIONAL_ARG_ADDED: "OPTIONAL_ARG_ADDED",
      INTERFACE_ADDED_TO_OBJECT: "INTERFACE_ADDED_TO_OBJECT",
      ARG_DEFAULT_VALUE_CHANGE: "ARG_DEFAULT_VALUE_CHANGE"
    });
    exports.DangerousChangeType = DangerousChangeType;
    function findBreakingChanges(oldSchema, newSchema) {
      var breakingChanges = findSchemaChanges(oldSchema, newSchema).filter(function(change) {
        return change.type in BreakingChangeType;
      });
      return breakingChanges;
    }
    function findDangerousChanges(oldSchema, newSchema) {
      var dangerousChanges = findSchemaChanges(oldSchema, newSchema).filter(function(change) {
        return change.type in DangerousChangeType;
      });
      return dangerousChanges;
    }
    function findSchemaChanges(oldSchema, newSchema) {
      return [].concat(findTypeChanges(oldSchema, newSchema), findDirectiveChanges(oldSchema, newSchema));
    }
    function findDirectiveChanges(oldSchema, newSchema) {
      var schemaChanges = [];
      var directivesDiff = diff(oldSchema.getDirectives(), newSchema.getDirectives());
      for (var _i2 = 0, _directivesDiff$remov2 = directivesDiff.removed; _i2 < _directivesDiff$remov2.length; _i2++) {
        var oldDirective = _directivesDiff$remov2[_i2];
        schemaChanges.push({
          type: BreakingChangeType.DIRECTIVE_REMOVED,
          description: "".concat(oldDirective.name, " was removed.")
        });
      }
      for (var _i4 = 0, _directivesDiff$persi2 = directivesDiff.persisted; _i4 < _directivesDiff$persi2.length; _i4++) {
        var _ref2 = _directivesDiff$persi2[_i4];
        var _oldDirective = _ref2[0];
        var newDirective = _ref2[1];
        var argsDiff = diff(_oldDirective.args, newDirective.args);
        for (var _i6 = 0, _argsDiff$added2 = argsDiff.added; _i6 < _argsDiff$added2.length; _i6++) {
          var newArg = _argsDiff$added2[_i6];
          if ((0, _definition.isRequiredArgument)(newArg)) {
            schemaChanges.push({
              type: BreakingChangeType.REQUIRED_DIRECTIVE_ARG_ADDED,
              description: "A required arg ".concat(newArg.name, " on directive ").concat(_oldDirective.name, " was added.")
            });
          }
        }
        for (var _i8 = 0, _argsDiff$removed2 = argsDiff.removed; _i8 < _argsDiff$removed2.length; _i8++) {
          var oldArg = _argsDiff$removed2[_i8];
          schemaChanges.push({
            type: BreakingChangeType.DIRECTIVE_ARG_REMOVED,
            description: "".concat(oldArg.name, " was removed from ").concat(_oldDirective.name, ".")
          });
        }
        for (var _i10 = 0, _oldDirective$locatio2 = _oldDirective.locations; _i10 < _oldDirective$locatio2.length; _i10++) {
          var location = _oldDirective$locatio2[_i10];
          if (newDirective.locations.indexOf(location) === -1) {
            schemaChanges.push({
              type: BreakingChangeType.DIRECTIVE_LOCATION_REMOVED,
              description: "".concat(location, " was removed from ").concat(_oldDirective.name, ".")
            });
          }
        }
      }
      return schemaChanges;
    }
    function findTypeChanges(oldSchema, newSchema) {
      var schemaChanges = [];
      var typesDiff = diff((0, _objectValues.default)(oldSchema.getTypeMap()), (0, _objectValues.default)(newSchema.getTypeMap()));
      for (var _i12 = 0, _typesDiff$removed2 = typesDiff.removed; _i12 < _typesDiff$removed2.length; _i12++) {
        var oldType = _typesDiff$removed2[_i12];
        schemaChanges.push({
          type: BreakingChangeType.TYPE_REMOVED,
          description: "".concat(oldType.name, " was removed.")
        });
      }
      for (var _i14 = 0, _typesDiff$persisted2 = typesDiff.persisted; _i14 < _typesDiff$persisted2.length; _i14++) {
        var _ref4 = _typesDiff$persisted2[_i14];
        var _oldType = _ref4[0];
        var newType = _ref4[1];
        if ((0, _definition.isEnumType)(_oldType) && (0, _definition.isEnumType)(newType)) {
          schemaChanges.push.apply(schemaChanges, findEnumTypeChanges(_oldType, newType));
        } else if ((0, _definition.isUnionType)(_oldType) && (0, _definition.isUnionType)(newType)) {
          schemaChanges.push.apply(schemaChanges, findUnionTypeChanges(_oldType, newType));
        } else if ((0, _definition.isInputObjectType)(_oldType) && (0, _definition.isInputObjectType)(newType)) {
          schemaChanges.push.apply(schemaChanges, findInputObjectTypeChanges(_oldType, newType));
        } else if ((0, _definition.isObjectType)(_oldType) && (0, _definition.isObjectType)(newType)) {
          schemaChanges.push.apply(schemaChanges, findObjectTypeChanges(_oldType, newType));
        } else if ((0, _definition.isInterfaceType)(_oldType) && (0, _definition.isInterfaceType)(newType)) {
          schemaChanges.push.apply(schemaChanges, findFieldChanges(_oldType, newType));
        } else if (_oldType.constructor !== newType.constructor) {
          schemaChanges.push({
            type: BreakingChangeType.TYPE_CHANGED_KIND,
            description: "".concat(_oldType.name, " changed from ") + "".concat(typeKindName(_oldType), " to ").concat(typeKindName(newType), ".")
          });
        }
      }
      return schemaChanges;
    }
    function findInputObjectTypeChanges(oldType, newType) {
      var schemaChanges = [];
      var fieldsDiff = diff((0, _objectValues.default)(oldType.getFields()), (0, _objectValues.default)(newType.getFields()));
      for (var _i16 = 0, _fieldsDiff$added2 = fieldsDiff.added; _i16 < _fieldsDiff$added2.length; _i16++) {
        var newField = _fieldsDiff$added2[_i16];
        if ((0, _definition.isRequiredInputField)(newField)) {
          schemaChanges.push({
            type: BreakingChangeType.REQUIRED_INPUT_FIELD_ADDED,
            description: "A required field ".concat(newField.name, " on input type ").concat(oldType.name, " was added.")
          });
        } else {
          schemaChanges.push({
            type: DangerousChangeType.OPTIONAL_INPUT_FIELD_ADDED,
            description: "An optional field ".concat(newField.name, " on input type ").concat(oldType.name, " was added.")
          });
        }
      }
      for (var _i18 = 0, _fieldsDiff$removed2 = fieldsDiff.removed; _i18 < _fieldsDiff$removed2.length; _i18++) {
        var oldField = _fieldsDiff$removed2[_i18];
        schemaChanges.push({
          type: BreakingChangeType.FIELD_REMOVED,
          description: "".concat(oldType.name, ".").concat(oldField.name, " was removed.")
        });
      }
      for (var _i20 = 0, _fieldsDiff$persisted2 = fieldsDiff.persisted; _i20 < _fieldsDiff$persisted2.length; _i20++) {
        var _ref6 = _fieldsDiff$persisted2[_i20];
        var _oldField = _ref6[0];
        var _newField = _ref6[1];
        var isSafe = isChangeSafeForInputObjectFieldOrFieldArg(_oldField.type, _newField.type);
        if (!isSafe) {
          schemaChanges.push({
            type: BreakingChangeType.FIELD_CHANGED_KIND,
            description: "".concat(oldType.name, ".").concat(_oldField.name, " changed type from ") + "".concat(String(_oldField.type), " to ").concat(String(_newField.type), ".")
          });
        }
      }
      return schemaChanges;
    }
    function findUnionTypeChanges(oldType, newType) {
      var schemaChanges = [];
      var possibleTypesDiff = diff(oldType.getTypes(), newType.getTypes());
      for (var _i22 = 0, _possibleTypesDiff$ad2 = possibleTypesDiff.added; _i22 < _possibleTypesDiff$ad2.length; _i22++) {
        var newPossibleType = _possibleTypesDiff$ad2[_i22];
        schemaChanges.push({
          type: DangerousChangeType.TYPE_ADDED_TO_UNION,
          description: "".concat(newPossibleType.name, " was added to union type ").concat(oldType.name, ".")
        });
      }
      for (var _i24 = 0, _possibleTypesDiff$re2 = possibleTypesDiff.removed; _i24 < _possibleTypesDiff$re2.length; _i24++) {
        var oldPossibleType = _possibleTypesDiff$re2[_i24];
        schemaChanges.push({
          type: BreakingChangeType.TYPE_REMOVED_FROM_UNION,
          description: "".concat(oldPossibleType.name, " was removed from union type ").concat(oldType.name, ".")
        });
      }
      return schemaChanges;
    }
    function findEnumTypeChanges(oldType, newType) {
      var schemaChanges = [];
      var valuesDiff = diff(oldType.getValues(), newType.getValues());
      for (var _i26 = 0, _valuesDiff$added2 = valuesDiff.added; _i26 < _valuesDiff$added2.length; _i26++) {
        var newValue = _valuesDiff$added2[_i26];
        schemaChanges.push({
          type: DangerousChangeType.VALUE_ADDED_TO_ENUM,
          description: "".concat(newValue.name, " was added to enum type ").concat(oldType.name, ".")
        });
      }
      for (var _i28 = 0, _valuesDiff$removed2 = valuesDiff.removed; _i28 < _valuesDiff$removed2.length; _i28++) {
        var oldValue = _valuesDiff$removed2[_i28];
        schemaChanges.push({
          type: BreakingChangeType.VALUE_REMOVED_FROM_ENUM,
          description: "".concat(oldValue.name, " was removed from enum type ").concat(oldType.name, ".")
        });
      }
      return schemaChanges;
    }
    function findObjectTypeChanges(oldType, newType) {
      var schemaChanges = findFieldChanges(oldType, newType);
      var interfacesDiff = diff(oldType.getInterfaces(), newType.getInterfaces());
      for (var _i30 = 0, _interfacesDiff$added2 = interfacesDiff.added; _i30 < _interfacesDiff$added2.length; _i30++) {
        var newInterface = _interfacesDiff$added2[_i30];
        schemaChanges.push({
          type: DangerousChangeType.INTERFACE_ADDED_TO_OBJECT,
          description: "".concat(newInterface.name, " added to interfaces implemented by ").concat(oldType.name, ".")
        });
      }
      for (var _i32 = 0, _interfacesDiff$remov2 = interfacesDiff.removed; _i32 < _interfacesDiff$remov2.length; _i32++) {
        var oldInterface = _interfacesDiff$remov2[_i32];
        schemaChanges.push({
          type: BreakingChangeType.INTERFACE_REMOVED_FROM_OBJECT,
          description: "".concat(oldType.name, " no longer implements interface ").concat(oldInterface.name, ".")
        });
      }
      return schemaChanges;
    }
    function findFieldChanges(oldType, newType) {
      var schemaChanges = [];
      var fieldsDiff = diff((0, _objectValues.default)(oldType.getFields()), (0, _objectValues.default)(newType.getFields()));
      for (var _i34 = 0, _fieldsDiff$removed4 = fieldsDiff.removed; _i34 < _fieldsDiff$removed4.length; _i34++) {
        var oldField = _fieldsDiff$removed4[_i34];
        schemaChanges.push({
          type: BreakingChangeType.FIELD_REMOVED,
          description: "".concat(oldType.name, ".").concat(oldField.name, " was removed.")
        });
      }
      for (var _i36 = 0, _fieldsDiff$persisted4 = fieldsDiff.persisted; _i36 < _fieldsDiff$persisted4.length; _i36++) {
        var _ref8 = _fieldsDiff$persisted4[_i36];
        var _oldField2 = _ref8[0];
        var newField = _ref8[1];
        schemaChanges.push.apply(schemaChanges, findArgChanges(oldType, _oldField2, newField));
        var isSafe = isChangeSafeForObjectOrInterfaceField(_oldField2.type, newField.type);
        if (!isSafe) {
          schemaChanges.push({
            type: BreakingChangeType.FIELD_CHANGED_KIND,
            description: "".concat(oldType.name, ".").concat(_oldField2.name, " changed type from ") + "".concat(String(_oldField2.type), " to ").concat(String(newField.type), ".")
          });
        }
      }
      return schemaChanges;
    }
    function findArgChanges(oldType, oldField, newField) {
      var schemaChanges = [];
      var argsDiff = diff(oldField.args, newField.args);
      for (var _i38 = 0, _argsDiff$removed4 = argsDiff.removed; _i38 < _argsDiff$removed4.length; _i38++) {
        var oldArg = _argsDiff$removed4[_i38];
        schemaChanges.push({
          type: BreakingChangeType.ARG_REMOVED,
          description: "".concat(oldType.name, ".").concat(oldField.name, " arg ").concat(oldArg.name, " was removed.")
        });
      }
      for (var _i40 = 0, _argsDiff$persisted2 = argsDiff.persisted; _i40 < _argsDiff$persisted2.length; _i40++) {
        var _ref10 = _argsDiff$persisted2[_i40];
        var _oldArg = _ref10[0];
        var newArg = _ref10[1];
        var isSafe = isChangeSafeForInputObjectFieldOrFieldArg(_oldArg.type, newArg.type);
        if (!isSafe) {
          schemaChanges.push({
            type: BreakingChangeType.ARG_CHANGED_KIND,
            description: "".concat(oldType.name, ".").concat(oldField.name, " arg ").concat(_oldArg.name, " has changed type from ") + "".concat(String(_oldArg.type), " to ").concat(String(newArg.type), ".")
          });
        } else if (_oldArg.defaultValue !== void 0) {
          if (newArg.defaultValue === void 0) {
            schemaChanges.push({
              type: DangerousChangeType.ARG_DEFAULT_VALUE_CHANGE,
              description: "".concat(oldType.name, ".").concat(oldField.name, " arg ").concat(_oldArg.name, " defaultValue was removed.")
            });
          } else {
            var oldValueStr = stringifyValue(_oldArg.defaultValue, _oldArg.type);
            var newValueStr = stringifyValue(newArg.defaultValue, newArg.type);
            if (oldValueStr !== newValueStr) {
              schemaChanges.push({
                type: DangerousChangeType.ARG_DEFAULT_VALUE_CHANGE,
                description: "".concat(oldType.name, ".").concat(oldField.name, " arg ").concat(_oldArg.name, " has changed defaultValue from ").concat(oldValueStr, " to ").concat(newValueStr, ".")
              });
            }
          }
        }
      }
      for (var _i42 = 0, _argsDiff$added4 = argsDiff.added; _i42 < _argsDiff$added4.length; _i42++) {
        var _newArg = _argsDiff$added4[_i42];
        if ((0, _definition.isRequiredArgument)(_newArg)) {
          schemaChanges.push({
            type: BreakingChangeType.REQUIRED_ARG_ADDED,
            description: "A required arg ".concat(_newArg.name, " on ").concat(oldType.name, ".").concat(oldField.name, " was added.")
          });
        } else {
          schemaChanges.push({
            type: DangerousChangeType.OPTIONAL_ARG_ADDED,
            description: "An optional arg ".concat(_newArg.name, " on ").concat(oldType.name, ".").concat(oldField.name, " was added.")
          });
        }
      }
      return schemaChanges;
    }
    function isChangeSafeForObjectOrInterfaceField(oldType, newType) {
      if ((0, _definition.isListType)(oldType)) {
        return (0, _definition.isListType)(newType) && isChangeSafeForObjectOrInterfaceField(oldType.ofType, newType.ofType) || (0, _definition.isNonNullType)(newType) && isChangeSafeForObjectOrInterfaceField(oldType, newType.ofType);
      }
      if ((0, _definition.isNonNullType)(oldType)) {
        return (0, _definition.isNonNullType)(newType) && isChangeSafeForObjectOrInterfaceField(oldType.ofType, newType.ofType);
      }
      return (0, _definition.isNamedType)(newType) && oldType.name === newType.name || (0, _definition.isNonNullType)(newType) && isChangeSafeForObjectOrInterfaceField(oldType, newType.ofType);
    }
    function isChangeSafeForInputObjectFieldOrFieldArg(oldType, newType) {
      if ((0, _definition.isListType)(oldType)) {
        return (0, _definition.isListType)(newType) && isChangeSafeForInputObjectFieldOrFieldArg(oldType.ofType, newType.ofType);
      }
      if ((0, _definition.isNonNullType)(oldType)) {
        return (0, _definition.isNonNullType)(newType) && isChangeSafeForInputObjectFieldOrFieldArg(oldType.ofType, newType.ofType) || !(0, _definition.isNonNullType)(newType) && isChangeSafeForInputObjectFieldOrFieldArg(oldType.ofType, newType);
      }
      return (0, _definition.isNamedType)(newType) && oldType.name === newType.name;
    }
    function typeKindName(type) {
      if ((0, _definition.isScalarType)(type)) {
        return "a Scalar type";
      }
      if ((0, _definition.isObjectType)(type)) {
        return "an Object type";
      }
      if ((0, _definition.isInterfaceType)(type)) {
        return "an Interface type";
      }
      if ((0, _definition.isUnionType)(type)) {
        return "a Union type";
      }
      if ((0, _definition.isEnumType)(type)) {
        return "an Enum type";
      }
      if ((0, _definition.isInputObjectType)(type)) {
        return "an Input type";
      }
      (0, _invariant.default)(false, "Unexpected type: " + (0, _inspect.default)(type));
    }
    function stringifyValue(value, type) {
      var ast = (0, _astFromValue.astFromValue)(value, type);
      ast != null || (0, _invariant.default)(0);
      var sortedAST = (0, _visitor.visit)(ast, {
        ObjectValue: function ObjectValue(objectNode) {
          var fields = [].concat(objectNode.fields).sort(function(fieldA, fieldB) {
            return fieldA.name.value.localeCompare(fieldB.name.value);
          });
          return _objectSpread({}, objectNode, {
            fields
          });
        }
      });
      return (0, _printer.print)(sortedAST);
    }
    function diff(oldArray, newArray) {
      var added = [];
      var removed = [];
      var persisted = [];
      var oldMap = (0, _keyMap.default)(oldArray, function(_ref11) {
        var name = _ref11.name;
        return name;
      });
      var newMap = (0, _keyMap.default)(newArray, function(_ref12) {
        var name = _ref12.name;
        return name;
      });
      for (var _i44 = 0; _i44 < oldArray.length; _i44++) {
        var oldItem = oldArray[_i44];
        var newItem = newMap[oldItem.name];
        if (newItem === void 0) {
          removed.push(oldItem);
        } else {
          persisted.push([oldItem, newItem]);
        }
      }
      for (var _i46 = 0; _i46 < newArray.length; _i46++) {
        var _newItem = newArray[_i46];
        if (oldMap[_newItem.name] === void 0) {
          added.push(_newItem);
        }
      }
      return {
        added,
        persisted,
        removed
      };
    }
  }
});

// ../api/node_modules/graphql/utilities/findDeprecatedUsages.js
var require_findDeprecatedUsages = __commonJS({
  "../api/node_modules/graphql/utilities/findDeprecatedUsages.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", {
      value: true
    });
    exports.findDeprecatedUsages = findDeprecatedUsages;
    var _GraphQLError = require_GraphQLError();
    var _visitor = require_visitor();
    var _definition = require_definition();
    var _TypeInfo = require_TypeInfo();
    function findDeprecatedUsages(schema, ast) {
      var errors = [];
      var typeInfo = new _TypeInfo.TypeInfo(schema);
      (0, _visitor.visit)(ast, (0, _visitor.visitWithTypeInfo)(typeInfo, {
        Field: function Field(node) {
          var fieldDef = typeInfo.getFieldDef();
          if (fieldDef && fieldDef.isDeprecated) {
            var parentType = typeInfo.getParentType();
            if (parentType) {
              var reason = fieldDef.deprecationReason;
              errors.push(new _GraphQLError.GraphQLError("The field ".concat(parentType.name, ".").concat(fieldDef.name, " is deprecated.") + (reason ? " " + reason : ""), node));
            }
          }
        },
        EnumValue: function EnumValue(node) {
          var enumVal = typeInfo.getEnumValue();
          if (enumVal && enumVal.isDeprecated) {
            var type = (0, _definition.getNamedType)(typeInfo.getInputType());
            if (type) {
              var reason = enumVal.deprecationReason;
              errors.push(new _GraphQLError.GraphQLError("The enum value ".concat(type.name, ".").concat(enumVal.name, " is deprecated.") + (reason ? " " + reason : ""), node));
            }
          }
        }
      }));
      return errors;
    }
  }
});

// ../api/node_modules/graphql/utilities/index.js
var require_utilities = __commonJS({
  "../api/node_modules/graphql/utilities/index.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", {
      value: true
    });
    Object.defineProperty(exports, "getIntrospectionQuery", {
      enumerable: true,
      get: function get() {
        return _introspectionQuery.getIntrospectionQuery;
      }
    });
    Object.defineProperty(exports, "introspectionQuery", {
      enumerable: true,
      get: function get() {
        return _introspectionQuery.introspectionQuery;
      }
    });
    Object.defineProperty(exports, "getOperationAST", {
      enumerable: true,
      get: function get() {
        return _getOperationAST.getOperationAST;
      }
    });
    Object.defineProperty(exports, "getOperationRootType", {
      enumerable: true,
      get: function get() {
        return _getOperationRootType.getOperationRootType;
      }
    });
    Object.defineProperty(exports, "introspectionFromSchema", {
      enumerable: true,
      get: function get() {
        return _introspectionFromSchema.introspectionFromSchema;
      }
    });
    Object.defineProperty(exports, "buildClientSchema", {
      enumerable: true,
      get: function get() {
        return _buildClientSchema.buildClientSchema;
      }
    });
    Object.defineProperty(exports, "buildASTSchema", {
      enumerable: true,
      get: function get() {
        return _buildASTSchema.buildASTSchema;
      }
    });
    Object.defineProperty(exports, "buildSchema", {
      enumerable: true,
      get: function get() {
        return _buildASTSchema.buildSchema;
      }
    });
    Object.defineProperty(exports, "getDescription", {
      enumerable: true,
      get: function get() {
        return _buildASTSchema.getDescription;
      }
    });
    Object.defineProperty(exports, "extendSchema", {
      enumerable: true,
      get: function get() {
        return _extendSchema.extendSchema;
      }
    });
    Object.defineProperty(exports, "lexicographicSortSchema", {
      enumerable: true,
      get: function get() {
        return _lexicographicSortSchema.lexicographicSortSchema;
      }
    });
    Object.defineProperty(exports, "printSchema", {
      enumerable: true,
      get: function get() {
        return _schemaPrinter.printSchema;
      }
    });
    Object.defineProperty(exports, "printType", {
      enumerable: true,
      get: function get() {
        return _schemaPrinter.printType;
      }
    });
    Object.defineProperty(exports, "printIntrospectionSchema", {
      enumerable: true,
      get: function get() {
        return _schemaPrinter.printIntrospectionSchema;
      }
    });
    Object.defineProperty(exports, "typeFromAST", {
      enumerable: true,
      get: function get() {
        return _typeFromAST.typeFromAST;
      }
    });
    Object.defineProperty(exports, "valueFromAST", {
      enumerable: true,
      get: function get() {
        return _valueFromAST.valueFromAST;
      }
    });
    Object.defineProperty(exports, "valueFromASTUntyped", {
      enumerable: true,
      get: function get() {
        return _valueFromASTUntyped.valueFromASTUntyped;
      }
    });
    Object.defineProperty(exports, "astFromValue", {
      enumerable: true,
      get: function get() {
        return _astFromValue.astFromValue;
      }
    });
    Object.defineProperty(exports, "TypeInfo", {
      enumerable: true,
      get: function get() {
        return _TypeInfo.TypeInfo;
      }
    });
    Object.defineProperty(exports, "coerceInputValue", {
      enumerable: true,
      get: function get() {
        return _coerceInputValue.coerceInputValue;
      }
    });
    Object.defineProperty(exports, "coerceValue", {
      enumerable: true,
      get: function get() {
        return _coerceValue.coerceValue;
      }
    });
    Object.defineProperty(exports, "isValidJSValue", {
      enumerable: true,
      get: function get() {
        return _isValidJSValue.isValidJSValue;
      }
    });
    Object.defineProperty(exports, "isValidLiteralValue", {
      enumerable: true,
      get: function get() {
        return _isValidLiteralValue.isValidLiteralValue;
      }
    });
    Object.defineProperty(exports, "concatAST", {
      enumerable: true,
      get: function get() {
        return _concatAST.concatAST;
      }
    });
    Object.defineProperty(exports, "separateOperations", {
      enumerable: true,
      get: function get() {
        return _separateOperations.separateOperations;
      }
    });
    Object.defineProperty(exports, "stripIgnoredCharacters", {
      enumerable: true,
      get: function get() {
        return _stripIgnoredCharacters.stripIgnoredCharacters;
      }
    });
    Object.defineProperty(exports, "isEqualType", {
      enumerable: true,
      get: function get() {
        return _typeComparators.isEqualType;
      }
    });
    Object.defineProperty(exports, "isTypeSubTypeOf", {
      enumerable: true,
      get: function get() {
        return _typeComparators.isTypeSubTypeOf;
      }
    });
    Object.defineProperty(exports, "doTypesOverlap", {
      enumerable: true,
      get: function get() {
        return _typeComparators.doTypesOverlap;
      }
    });
    Object.defineProperty(exports, "assertValidName", {
      enumerable: true,
      get: function get() {
        return _assertValidName.assertValidName;
      }
    });
    Object.defineProperty(exports, "isValidNameError", {
      enumerable: true,
      get: function get() {
        return _assertValidName.isValidNameError;
      }
    });
    Object.defineProperty(exports, "BreakingChangeType", {
      enumerable: true,
      get: function get() {
        return _findBreakingChanges.BreakingChangeType;
      }
    });
    Object.defineProperty(exports, "DangerousChangeType", {
      enumerable: true,
      get: function get() {
        return _findBreakingChanges.DangerousChangeType;
      }
    });
    Object.defineProperty(exports, "findBreakingChanges", {
      enumerable: true,
      get: function get() {
        return _findBreakingChanges.findBreakingChanges;
      }
    });
    Object.defineProperty(exports, "findDangerousChanges", {
      enumerable: true,
      get: function get() {
        return _findBreakingChanges.findDangerousChanges;
      }
    });
    Object.defineProperty(exports, "findDeprecatedUsages", {
      enumerable: true,
      get: function get() {
        return _findDeprecatedUsages.findDeprecatedUsages;
      }
    });
    var _introspectionQuery = require_introspectionQuery();
    var _getOperationAST = require_getOperationAST();
    var _getOperationRootType = require_getOperationRootType();
    var _introspectionFromSchema = require_introspectionFromSchema();
    var _buildClientSchema = require_buildClientSchema();
    var _buildASTSchema = require_buildASTSchema();
    var _extendSchema = require_extendSchema();
    var _lexicographicSortSchema = require_lexicographicSortSchema();
    var _schemaPrinter = require_schemaPrinter();
    var _typeFromAST = require_typeFromAST();
    var _valueFromAST = require_valueFromAST();
    var _valueFromASTUntyped = require_valueFromASTUntyped();
    var _astFromValue = require_astFromValue();
    var _TypeInfo = require_TypeInfo();
    var _coerceInputValue = require_coerceInputValue();
    var _coerceValue = require_coerceValue();
    var _isValidJSValue = require_isValidJSValue();
    var _isValidLiteralValue = require_isValidLiteralValue();
    var _concatAST = require_concatAST();
    var _separateOperations = require_separateOperations();
    var _stripIgnoredCharacters = require_stripIgnoredCharacters();
    var _typeComparators = require_typeComparators();
    var _assertValidName = require_assertValidName();
    var _findBreakingChanges = require_findBreakingChanges();
    var _findDeprecatedUsages = require_findDeprecatedUsages();
  }
});

// ../api/node_modules/graphql/index.js
var require_graphql2 = __commonJS({
  "../api/node_modules/graphql/index.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", {
      value: true
    });
    Object.defineProperty(exports, "version", {
      enumerable: true,
      get: function get() {
        return _version.version;
      }
    });
    Object.defineProperty(exports, "versionInfo", {
      enumerable: true,
      get: function get() {
        return _version.versionInfo;
      }
    });
    Object.defineProperty(exports, "graphql", {
      enumerable: true,
      get: function get() {
        return _graphql.graphql;
      }
    });
    Object.defineProperty(exports, "graphqlSync", {
      enumerable: true,
      get: function get() {
        return _graphql.graphqlSync;
      }
    });
    Object.defineProperty(exports, "GraphQLSchema", {
      enumerable: true,
      get: function get() {
        return _type.GraphQLSchema;
      }
    });
    Object.defineProperty(exports, "GraphQLDirective", {
      enumerable: true,
      get: function get() {
        return _type.GraphQLDirective;
      }
    });
    Object.defineProperty(exports, "GraphQLScalarType", {
      enumerable: true,
      get: function get() {
        return _type.GraphQLScalarType;
      }
    });
    Object.defineProperty(exports, "GraphQLObjectType", {
      enumerable: true,
      get: function get() {
        return _type.GraphQLObjectType;
      }
    });
    Object.defineProperty(exports, "GraphQLInterfaceType", {
      enumerable: true,
      get: function get() {
        return _type.GraphQLInterfaceType;
      }
    });
    Object.defineProperty(exports, "GraphQLUnionType", {
      enumerable: true,
      get: function get() {
        return _type.GraphQLUnionType;
      }
    });
    Object.defineProperty(exports, "GraphQLEnumType", {
      enumerable: true,
      get: function get() {
        return _type.GraphQLEnumType;
      }
    });
    Object.defineProperty(exports, "GraphQLInputObjectType", {
      enumerable: true,
      get: function get() {
        return _type.GraphQLInputObjectType;
      }
    });
    Object.defineProperty(exports, "GraphQLList", {
      enumerable: true,
      get: function get() {
        return _type.GraphQLList;
      }
    });
    Object.defineProperty(exports, "GraphQLNonNull", {
      enumerable: true,
      get: function get() {
        return _type.GraphQLNonNull;
      }
    });
    Object.defineProperty(exports, "specifiedScalarTypes", {
      enumerable: true,
      get: function get() {
        return _type.specifiedScalarTypes;
      }
    });
    Object.defineProperty(exports, "GraphQLInt", {
      enumerable: true,
      get: function get() {
        return _type.GraphQLInt;
      }
    });
    Object.defineProperty(exports, "GraphQLFloat", {
      enumerable: true,
      get: function get() {
        return _type.GraphQLFloat;
      }
    });
    Object.defineProperty(exports, "GraphQLString", {
      enumerable: true,
      get: function get() {
        return _type.GraphQLString;
      }
    });
    Object.defineProperty(exports, "GraphQLBoolean", {
      enumerable: true,
      get: function get() {
        return _type.GraphQLBoolean;
      }
    });
    Object.defineProperty(exports, "GraphQLID", {
      enumerable: true,
      get: function get() {
        return _type.GraphQLID;
      }
    });
    Object.defineProperty(exports, "specifiedDirectives", {
      enumerable: true,
      get: function get() {
        return _type.specifiedDirectives;
      }
    });
    Object.defineProperty(exports, "GraphQLIncludeDirective", {
      enumerable: true,
      get: function get() {
        return _type.GraphQLIncludeDirective;
      }
    });
    Object.defineProperty(exports, "GraphQLSkipDirective", {
      enumerable: true,
      get: function get() {
        return _type.GraphQLSkipDirective;
      }
    });
    Object.defineProperty(exports, "GraphQLDeprecatedDirective", {
      enumerable: true,
      get: function get() {
        return _type.GraphQLDeprecatedDirective;
      }
    });
    Object.defineProperty(exports, "TypeKind", {
      enumerable: true,
      get: function get() {
        return _type.TypeKind;
      }
    });
    Object.defineProperty(exports, "DEFAULT_DEPRECATION_REASON", {
      enumerable: true,
      get: function get() {
        return _type.DEFAULT_DEPRECATION_REASON;
      }
    });
    Object.defineProperty(exports, "introspectionTypes", {
      enumerable: true,
      get: function get() {
        return _type.introspectionTypes;
      }
    });
    Object.defineProperty(exports, "__Schema", {
      enumerable: true,
      get: function get() {
        return _type.__Schema;
      }
    });
    Object.defineProperty(exports, "__Directive", {
      enumerable: true,
      get: function get() {
        return _type.__Directive;
      }
    });
    Object.defineProperty(exports, "__DirectiveLocation", {
      enumerable: true,
      get: function get() {
        return _type.__DirectiveLocation;
      }
    });
    Object.defineProperty(exports, "__Type", {
      enumerable: true,
      get: function get() {
        return _type.__Type;
      }
    });
    Object.defineProperty(exports, "__Field", {
      enumerable: true,
      get: function get() {
        return _type.__Field;
      }
    });
    Object.defineProperty(exports, "__InputValue", {
      enumerable: true,
      get: function get() {
        return _type.__InputValue;
      }
    });
    Object.defineProperty(exports, "__EnumValue", {
      enumerable: true,
      get: function get() {
        return _type.__EnumValue;
      }
    });
    Object.defineProperty(exports, "__TypeKind", {
      enumerable: true,
      get: function get() {
        return _type.__TypeKind;
      }
    });
    Object.defineProperty(exports, "SchemaMetaFieldDef", {
      enumerable: true,
      get: function get() {
        return _type.SchemaMetaFieldDef;
      }
    });
    Object.defineProperty(exports, "TypeMetaFieldDef", {
      enumerable: true,
      get: function get() {
        return _type.TypeMetaFieldDef;
      }
    });
    Object.defineProperty(exports, "TypeNameMetaFieldDef", {
      enumerable: true,
      get: function get() {
        return _type.TypeNameMetaFieldDef;
      }
    });
    Object.defineProperty(exports, "isSchema", {
      enumerable: true,
      get: function get() {
        return _type.isSchema;
      }
    });
    Object.defineProperty(exports, "isDirective", {
      enumerable: true,
      get: function get() {
        return _type.isDirective;
      }
    });
    Object.defineProperty(exports, "isType", {
      enumerable: true,
      get: function get() {
        return _type.isType;
      }
    });
    Object.defineProperty(exports, "isScalarType", {
      enumerable: true,
      get: function get() {
        return _type.isScalarType;
      }
    });
    Object.defineProperty(exports, "isObjectType", {
      enumerable: true,
      get: function get() {
        return _type.isObjectType;
      }
    });
    Object.defineProperty(exports, "isInterfaceType", {
      enumerable: true,
      get: function get() {
        return _type.isInterfaceType;
      }
    });
    Object.defineProperty(exports, "isUnionType", {
      enumerable: true,
      get: function get() {
        return _type.isUnionType;
      }
    });
    Object.defineProperty(exports, "isEnumType", {
      enumerable: true,
      get: function get() {
        return _type.isEnumType;
      }
    });
    Object.defineProperty(exports, "isInputObjectType", {
      enumerable: true,
      get: function get() {
        return _type.isInputObjectType;
      }
    });
    Object.defineProperty(exports, "isListType", {
      enumerable: true,
      get: function get() {
        return _type.isListType;
      }
    });
    Object.defineProperty(exports, "isNonNullType", {
      enumerable: true,
      get: function get() {
        return _type.isNonNullType;
      }
    });
    Object.defineProperty(exports, "isInputType", {
      enumerable: true,
      get: function get() {
        return _type.isInputType;
      }
    });
    Object.defineProperty(exports, "isOutputType", {
      enumerable: true,
      get: function get() {
        return _type.isOutputType;
      }
    });
    Object.defineProperty(exports, "isLeafType", {
      enumerable: true,
      get: function get() {
        return _type.isLeafType;
      }
    });
    Object.defineProperty(exports, "isCompositeType", {
      enumerable: true,
      get: function get() {
        return _type.isCompositeType;
      }
    });
    Object.defineProperty(exports, "isAbstractType", {
      enumerable: true,
      get: function get() {
        return _type.isAbstractType;
      }
    });
    Object.defineProperty(exports, "isWrappingType", {
      enumerable: true,
      get: function get() {
        return _type.isWrappingType;
      }
    });
    Object.defineProperty(exports, "isNullableType", {
      enumerable: true,
      get: function get() {
        return _type.isNullableType;
      }
    });
    Object.defineProperty(exports, "isNamedType", {
      enumerable: true,
      get: function get() {
        return _type.isNamedType;
      }
    });
    Object.defineProperty(exports, "isRequiredArgument", {
      enumerable: true,
      get: function get() {
        return _type.isRequiredArgument;
      }
    });
    Object.defineProperty(exports, "isRequiredInputField", {
      enumerable: true,
      get: function get() {
        return _type.isRequiredInputField;
      }
    });
    Object.defineProperty(exports, "isSpecifiedScalarType", {
      enumerable: true,
      get: function get() {
        return _type.isSpecifiedScalarType;
      }
    });
    Object.defineProperty(exports, "isIntrospectionType", {
      enumerable: true,
      get: function get() {
        return _type.isIntrospectionType;
      }
    });
    Object.defineProperty(exports, "isSpecifiedDirective", {
      enumerable: true,
      get: function get() {
        return _type.isSpecifiedDirective;
      }
    });
    Object.defineProperty(exports, "assertSchema", {
      enumerable: true,
      get: function get() {
        return _type.assertSchema;
      }
    });
    Object.defineProperty(exports, "assertDirective", {
      enumerable: true,
      get: function get() {
        return _type.assertDirective;
      }
    });
    Object.defineProperty(exports, "assertType", {
      enumerable: true,
      get: function get() {
        return _type.assertType;
      }
    });
    Object.defineProperty(exports, "assertScalarType", {
      enumerable: true,
      get: function get() {
        return _type.assertScalarType;
      }
    });
    Object.defineProperty(exports, "assertObjectType", {
      enumerable: true,
      get: function get() {
        return _type.assertObjectType;
      }
    });
    Object.defineProperty(exports, "assertInterfaceType", {
      enumerable: true,
      get: function get() {
        return _type.assertInterfaceType;
      }
    });
    Object.defineProperty(exports, "assertUnionType", {
      enumerable: true,
      get: function get() {
        return _type.assertUnionType;
      }
    });
    Object.defineProperty(exports, "assertEnumType", {
      enumerable: true,
      get: function get() {
        return _type.assertEnumType;
      }
    });
    Object.defineProperty(exports, "assertInputObjectType", {
      enumerable: true,
      get: function get() {
        return _type.assertInputObjectType;
      }
    });
    Object.defineProperty(exports, "assertListType", {
      enumerable: true,
      get: function get() {
        return _type.assertListType;
      }
    });
    Object.defineProperty(exports, "assertNonNullType", {
      enumerable: true,
      get: function get() {
        return _type.assertNonNullType;
      }
    });
    Object.defineProperty(exports, "assertInputType", {
      enumerable: true,
      get: function get() {
        return _type.assertInputType;
      }
    });
    Object.defineProperty(exports, "assertOutputType", {
      enumerable: true,
      get: function get() {
        return _type.assertOutputType;
      }
    });
    Object.defineProperty(exports, "assertLeafType", {
      enumerable: true,
      get: function get() {
        return _type.assertLeafType;
      }
    });
    Object.defineProperty(exports, "assertCompositeType", {
      enumerable: true,
      get: function get() {
        return _type.assertCompositeType;
      }
    });
    Object.defineProperty(exports, "assertAbstractType", {
      enumerable: true,
      get: function get() {
        return _type.assertAbstractType;
      }
    });
    Object.defineProperty(exports, "assertWrappingType", {
      enumerable: true,
      get: function get() {
        return _type.assertWrappingType;
      }
    });
    Object.defineProperty(exports, "assertNullableType", {
      enumerable: true,
      get: function get() {
        return _type.assertNullableType;
      }
    });
    Object.defineProperty(exports, "assertNamedType", {
      enumerable: true,
      get: function get() {
        return _type.assertNamedType;
      }
    });
    Object.defineProperty(exports, "getNullableType", {
      enumerable: true,
      get: function get() {
        return _type.getNullableType;
      }
    });
    Object.defineProperty(exports, "getNamedType", {
      enumerable: true,
      get: function get() {
        return _type.getNamedType;
      }
    });
    Object.defineProperty(exports, "validateSchema", {
      enumerable: true,
      get: function get() {
        return _type.validateSchema;
      }
    });
    Object.defineProperty(exports, "assertValidSchema", {
      enumerable: true,
      get: function get() {
        return _type.assertValidSchema;
      }
    });
    Object.defineProperty(exports, "Source", {
      enumerable: true,
      get: function get() {
        return _language.Source;
      }
    });
    Object.defineProperty(exports, "getLocation", {
      enumerable: true,
      get: function get() {
        return _language.getLocation;
      }
    });
    Object.defineProperty(exports, "printLocation", {
      enumerable: true,
      get: function get() {
        return _language.printLocation;
      }
    });
    Object.defineProperty(exports, "printSourceLocation", {
      enumerable: true,
      get: function get() {
        return _language.printSourceLocation;
      }
    });
    Object.defineProperty(exports, "createLexer", {
      enumerable: true,
      get: function get() {
        return _language.createLexer;
      }
    });
    Object.defineProperty(exports, "TokenKind", {
      enumerable: true,
      get: function get() {
        return _language.TokenKind;
      }
    });
    Object.defineProperty(exports, "parse", {
      enumerable: true,
      get: function get() {
        return _language.parse;
      }
    });
    Object.defineProperty(exports, "parseValue", {
      enumerable: true,
      get: function get() {
        return _language.parseValue;
      }
    });
    Object.defineProperty(exports, "parseType", {
      enumerable: true,
      get: function get() {
        return _language.parseType;
      }
    });
    Object.defineProperty(exports, "print", {
      enumerable: true,
      get: function get() {
        return _language.print;
      }
    });
    Object.defineProperty(exports, "visit", {
      enumerable: true,
      get: function get() {
        return _language.visit;
      }
    });
    Object.defineProperty(exports, "visitInParallel", {
      enumerable: true,
      get: function get() {
        return _language.visitInParallel;
      }
    });
    Object.defineProperty(exports, "visitWithTypeInfo", {
      enumerable: true,
      get: function get() {
        return _language.visitWithTypeInfo;
      }
    });
    Object.defineProperty(exports, "getVisitFn", {
      enumerable: true,
      get: function get() {
        return _language.getVisitFn;
      }
    });
    Object.defineProperty(exports, "BREAK", {
      enumerable: true,
      get: function get() {
        return _language.BREAK;
      }
    });
    Object.defineProperty(exports, "Kind", {
      enumerable: true,
      get: function get() {
        return _language.Kind;
      }
    });
    Object.defineProperty(exports, "DirectiveLocation", {
      enumerable: true,
      get: function get() {
        return _language.DirectiveLocation;
      }
    });
    Object.defineProperty(exports, "isDefinitionNode", {
      enumerable: true,
      get: function get() {
        return _language.isDefinitionNode;
      }
    });
    Object.defineProperty(exports, "isExecutableDefinitionNode", {
      enumerable: true,
      get: function get() {
        return _language.isExecutableDefinitionNode;
      }
    });
    Object.defineProperty(exports, "isSelectionNode", {
      enumerable: true,
      get: function get() {
        return _language.isSelectionNode;
      }
    });
    Object.defineProperty(exports, "isValueNode", {
      enumerable: true,
      get: function get() {
        return _language.isValueNode;
      }
    });
    Object.defineProperty(exports, "isTypeNode", {
      enumerable: true,
      get: function get() {
        return _language.isTypeNode;
      }
    });
    Object.defineProperty(exports, "isTypeSystemDefinitionNode", {
      enumerable: true,
      get: function get() {
        return _language.isTypeSystemDefinitionNode;
      }
    });
    Object.defineProperty(exports, "isTypeDefinitionNode", {
      enumerable: true,
      get: function get() {
        return _language.isTypeDefinitionNode;
      }
    });
    Object.defineProperty(exports, "isTypeSystemExtensionNode", {
      enumerable: true,
      get: function get() {
        return _language.isTypeSystemExtensionNode;
      }
    });
    Object.defineProperty(exports, "isTypeExtensionNode", {
      enumerable: true,
      get: function get() {
        return _language.isTypeExtensionNode;
      }
    });
    Object.defineProperty(exports, "execute", {
      enumerable: true,
      get: function get() {
        return _execution.execute;
      }
    });
    Object.defineProperty(exports, "defaultFieldResolver", {
      enumerable: true,
      get: function get() {
        return _execution.defaultFieldResolver;
      }
    });
    Object.defineProperty(exports, "defaultTypeResolver", {
      enumerable: true,
      get: function get() {
        return _execution.defaultTypeResolver;
      }
    });
    Object.defineProperty(exports, "responsePathAsArray", {
      enumerable: true,
      get: function get() {
        return _execution.responsePathAsArray;
      }
    });
    Object.defineProperty(exports, "getDirectiveValues", {
      enumerable: true,
      get: function get() {
        return _execution.getDirectiveValues;
      }
    });
    Object.defineProperty(exports, "subscribe", {
      enumerable: true,
      get: function get() {
        return _subscription.subscribe;
      }
    });
    Object.defineProperty(exports, "createSourceEventStream", {
      enumerable: true,
      get: function get() {
        return _subscription.createSourceEventStream;
      }
    });
    Object.defineProperty(exports, "validate", {
      enumerable: true,
      get: function get() {
        return _validation.validate;
      }
    });
    Object.defineProperty(exports, "ValidationContext", {
      enumerable: true,
      get: function get() {
        return _validation.ValidationContext;
      }
    });
    Object.defineProperty(exports, "specifiedRules", {
      enumerable: true,
      get: function get() {
        return _validation.specifiedRules;
      }
    });
    Object.defineProperty(exports, "ExecutableDefinitionsRule", {
      enumerable: true,
      get: function get() {
        return _validation.ExecutableDefinitionsRule;
      }
    });
    Object.defineProperty(exports, "FieldsOnCorrectTypeRule", {
      enumerable: true,
      get: function get() {
        return _validation.FieldsOnCorrectTypeRule;
      }
    });
    Object.defineProperty(exports, "FragmentsOnCompositeTypesRule", {
      enumerable: true,
      get: function get() {
        return _validation.FragmentsOnCompositeTypesRule;
      }
    });
    Object.defineProperty(exports, "KnownArgumentNamesRule", {
      enumerable: true,
      get: function get() {
        return _validation.KnownArgumentNamesRule;
      }
    });
    Object.defineProperty(exports, "KnownDirectivesRule", {
      enumerable: true,
      get: function get() {
        return _validation.KnownDirectivesRule;
      }
    });
    Object.defineProperty(exports, "KnownFragmentNamesRule", {
      enumerable: true,
      get: function get() {
        return _validation.KnownFragmentNamesRule;
      }
    });
    Object.defineProperty(exports, "KnownTypeNamesRule", {
      enumerable: true,
      get: function get() {
        return _validation.KnownTypeNamesRule;
      }
    });
    Object.defineProperty(exports, "LoneAnonymousOperationRule", {
      enumerable: true,
      get: function get() {
        return _validation.LoneAnonymousOperationRule;
      }
    });
    Object.defineProperty(exports, "NoFragmentCyclesRule", {
      enumerable: true,
      get: function get() {
        return _validation.NoFragmentCyclesRule;
      }
    });
    Object.defineProperty(exports, "NoUndefinedVariablesRule", {
      enumerable: true,
      get: function get() {
        return _validation.NoUndefinedVariablesRule;
      }
    });
    Object.defineProperty(exports, "NoUnusedFragmentsRule", {
      enumerable: true,
      get: function get() {
        return _validation.NoUnusedFragmentsRule;
      }
    });
    Object.defineProperty(exports, "NoUnusedVariablesRule", {
      enumerable: true,
      get: function get() {
        return _validation.NoUnusedVariablesRule;
      }
    });
    Object.defineProperty(exports, "OverlappingFieldsCanBeMergedRule", {
      enumerable: true,
      get: function get() {
        return _validation.OverlappingFieldsCanBeMergedRule;
      }
    });
    Object.defineProperty(exports, "PossibleFragmentSpreadsRule", {
      enumerable: true,
      get: function get() {
        return _validation.PossibleFragmentSpreadsRule;
      }
    });
    Object.defineProperty(exports, "ProvidedRequiredArgumentsRule", {
      enumerable: true,
      get: function get() {
        return _validation.ProvidedRequiredArgumentsRule;
      }
    });
    Object.defineProperty(exports, "ScalarLeafsRule", {
      enumerable: true,
      get: function get() {
        return _validation.ScalarLeafsRule;
      }
    });
    Object.defineProperty(exports, "SingleFieldSubscriptionsRule", {
      enumerable: true,
      get: function get() {
        return _validation.SingleFieldSubscriptionsRule;
      }
    });
    Object.defineProperty(exports, "UniqueArgumentNamesRule", {
      enumerable: true,
      get: function get() {
        return _validation.UniqueArgumentNamesRule;
      }
    });
    Object.defineProperty(exports, "UniqueDirectivesPerLocationRule", {
      enumerable: true,
      get: function get() {
        return _validation.UniqueDirectivesPerLocationRule;
      }
    });
    Object.defineProperty(exports, "UniqueFragmentNamesRule", {
      enumerable: true,
      get: function get() {
        return _validation.UniqueFragmentNamesRule;
      }
    });
    Object.defineProperty(exports, "UniqueInputFieldNamesRule", {
      enumerable: true,
      get: function get() {
        return _validation.UniqueInputFieldNamesRule;
      }
    });
    Object.defineProperty(exports, "UniqueOperationNamesRule", {
      enumerable: true,
      get: function get() {
        return _validation.UniqueOperationNamesRule;
      }
    });
    Object.defineProperty(exports, "UniqueVariableNamesRule", {
      enumerable: true,
      get: function get() {
        return _validation.UniqueVariableNamesRule;
      }
    });
    Object.defineProperty(exports, "ValuesOfCorrectTypeRule", {
      enumerable: true,
      get: function get() {
        return _validation.ValuesOfCorrectTypeRule;
      }
    });
    Object.defineProperty(exports, "VariablesAreInputTypesRule", {
      enumerable: true,
      get: function get() {
        return _validation.VariablesAreInputTypesRule;
      }
    });
    Object.defineProperty(exports, "VariablesInAllowedPositionRule", {
      enumerable: true,
      get: function get() {
        return _validation.VariablesInAllowedPositionRule;
      }
    });
    Object.defineProperty(exports, "LoneSchemaDefinitionRule", {
      enumerable: true,
      get: function get() {
        return _validation.LoneSchemaDefinitionRule;
      }
    });
    Object.defineProperty(exports, "UniqueOperationTypesRule", {
      enumerable: true,
      get: function get() {
        return _validation.UniqueOperationTypesRule;
      }
    });
    Object.defineProperty(exports, "UniqueTypeNamesRule", {
      enumerable: true,
      get: function get() {
        return _validation.UniqueTypeNamesRule;
      }
    });
    Object.defineProperty(exports, "UniqueEnumValueNamesRule", {
      enumerable: true,
      get: function get() {
        return _validation.UniqueEnumValueNamesRule;
      }
    });
    Object.defineProperty(exports, "UniqueFieldDefinitionNamesRule", {
      enumerable: true,
      get: function get() {
        return _validation.UniqueFieldDefinitionNamesRule;
      }
    });
    Object.defineProperty(exports, "UniqueDirectiveNamesRule", {
      enumerable: true,
      get: function get() {
        return _validation.UniqueDirectiveNamesRule;
      }
    });
    Object.defineProperty(exports, "PossibleTypeExtensionsRule", {
      enumerable: true,
      get: function get() {
        return _validation.PossibleTypeExtensionsRule;
      }
    });
    Object.defineProperty(exports, "GraphQLError", {
      enumerable: true,
      get: function get() {
        return _error.GraphQLError;
      }
    });
    Object.defineProperty(exports, "syntaxError", {
      enumerable: true,
      get: function get() {
        return _error.syntaxError;
      }
    });
    Object.defineProperty(exports, "locatedError", {
      enumerable: true,
      get: function get() {
        return _error.locatedError;
      }
    });
    Object.defineProperty(exports, "printError", {
      enumerable: true,
      get: function get() {
        return _error.printError;
      }
    });
    Object.defineProperty(exports, "formatError", {
      enumerable: true,
      get: function get() {
        return _error.formatError;
      }
    });
    Object.defineProperty(exports, "getIntrospectionQuery", {
      enumerable: true,
      get: function get() {
        return _utilities.getIntrospectionQuery;
      }
    });
    Object.defineProperty(exports, "introspectionQuery", {
      enumerable: true,
      get: function get() {
        return _utilities.introspectionQuery;
      }
    });
    Object.defineProperty(exports, "getOperationAST", {
      enumerable: true,
      get: function get() {
        return _utilities.getOperationAST;
      }
    });
    Object.defineProperty(exports, "getOperationRootType", {
      enumerable: true,
      get: function get() {
        return _utilities.getOperationRootType;
      }
    });
    Object.defineProperty(exports, "introspectionFromSchema", {
      enumerable: true,
      get: function get() {
        return _utilities.introspectionFromSchema;
      }
    });
    Object.defineProperty(exports, "buildClientSchema", {
      enumerable: true,
      get: function get() {
        return _utilities.buildClientSchema;
      }
    });
    Object.defineProperty(exports, "buildASTSchema", {
      enumerable: true,
      get: function get() {
        return _utilities.buildASTSchema;
      }
    });
    Object.defineProperty(exports, "buildSchema", {
      enumerable: true,
      get: function get() {
        return _utilities.buildSchema;
      }
    });
    Object.defineProperty(exports, "getDescription", {
      enumerable: true,
      get: function get() {
        return _utilities.getDescription;
      }
    });
    Object.defineProperty(exports, "extendSchema", {
      enumerable: true,
      get: function get() {
        return _utilities.extendSchema;
      }
    });
    Object.defineProperty(exports, "lexicographicSortSchema", {
      enumerable: true,
      get: function get() {
        return _utilities.lexicographicSortSchema;
      }
    });
    Object.defineProperty(exports, "printSchema", {
      enumerable: true,
      get: function get() {
        return _utilities.printSchema;
      }
    });
    Object.defineProperty(exports, "printType", {
      enumerable: true,
      get: function get() {
        return _utilities.printType;
      }
    });
    Object.defineProperty(exports, "printIntrospectionSchema", {
      enumerable: true,
      get: function get() {
        return _utilities.printIntrospectionSchema;
      }
    });
    Object.defineProperty(exports, "typeFromAST", {
      enumerable: true,
      get: function get() {
        return _utilities.typeFromAST;
      }
    });
    Object.defineProperty(exports, "valueFromAST", {
      enumerable: true,
      get: function get() {
        return _utilities.valueFromAST;
      }
    });
    Object.defineProperty(exports, "valueFromASTUntyped", {
      enumerable: true,
      get: function get() {
        return _utilities.valueFromASTUntyped;
      }
    });
    Object.defineProperty(exports, "astFromValue", {
      enumerable: true,
      get: function get() {
        return _utilities.astFromValue;
      }
    });
    Object.defineProperty(exports, "TypeInfo", {
      enumerable: true,
      get: function get() {
        return _utilities.TypeInfo;
      }
    });
    Object.defineProperty(exports, "coerceInputValue", {
      enumerable: true,
      get: function get() {
        return _utilities.coerceInputValue;
      }
    });
    Object.defineProperty(exports, "coerceValue", {
      enumerable: true,
      get: function get() {
        return _utilities.coerceValue;
      }
    });
    Object.defineProperty(exports, "isValidJSValue", {
      enumerable: true,
      get: function get() {
        return _utilities.isValidJSValue;
      }
    });
    Object.defineProperty(exports, "isValidLiteralValue", {
      enumerable: true,
      get: function get() {
        return _utilities.isValidLiteralValue;
      }
    });
    Object.defineProperty(exports, "concatAST", {
      enumerable: true,
      get: function get() {
        return _utilities.concatAST;
      }
    });
    Object.defineProperty(exports, "separateOperations", {
      enumerable: true,
      get: function get() {
        return _utilities.separateOperations;
      }
    });
    Object.defineProperty(exports, "stripIgnoredCharacters", {
      enumerable: true,
      get: function get() {
        return _utilities.stripIgnoredCharacters;
      }
    });
    Object.defineProperty(exports, "isEqualType", {
      enumerable: true,
      get: function get() {
        return _utilities.isEqualType;
      }
    });
    Object.defineProperty(exports, "isTypeSubTypeOf", {
      enumerable: true,
      get: function get() {
        return _utilities.isTypeSubTypeOf;
      }
    });
    Object.defineProperty(exports, "doTypesOverlap", {
      enumerable: true,
      get: function get() {
        return _utilities.doTypesOverlap;
      }
    });
    Object.defineProperty(exports, "assertValidName", {
      enumerable: true,
      get: function get() {
        return _utilities.assertValidName;
      }
    });
    Object.defineProperty(exports, "isValidNameError", {
      enumerable: true,
      get: function get() {
        return _utilities.isValidNameError;
      }
    });
    Object.defineProperty(exports, "BreakingChangeType", {
      enumerable: true,
      get: function get() {
        return _utilities.BreakingChangeType;
      }
    });
    Object.defineProperty(exports, "DangerousChangeType", {
      enumerable: true,
      get: function get() {
        return _utilities.DangerousChangeType;
      }
    });
    Object.defineProperty(exports, "findBreakingChanges", {
      enumerable: true,
      get: function get() {
        return _utilities.findBreakingChanges;
      }
    });
    Object.defineProperty(exports, "findDangerousChanges", {
      enumerable: true,
      get: function get() {
        return _utilities.findDangerousChanges;
      }
    });
    Object.defineProperty(exports, "findDeprecatedUsages", {
      enumerable: true,
      get: function get() {
        return _utilities.findDeprecatedUsages;
      }
    });
    var _version = require_version();
    var _graphql = require_graphql();
    var _type = require_type();
    var _language = require_language();
    var _execution = require_execution();
    var _subscription = require_subscription();
    var _validation = require_validation();
    var _error = require_error();
    var _utilities = require_utilities();
  }
});

// ../api/node_modules/graphql-tag/lib/graphql-tag.umd.js
var require_graphql_tag_umd = __commonJS({
  "../api/node_modules/graphql-tag/lib/graphql-tag.umd.js"(exports, module) {
    (function(global2, factory) {
      typeof exports === "object" && typeof module !== "undefined" ? factory(exports, require_tslib(), require_graphql2()) : typeof define === "function" && define.amd ? define(["exports", "tslib", "graphql"], factory) : (global2 = typeof globalThis !== "undefined" ? globalThis : global2 || self, factory(global2["graphql-tag"] = {}, global2.tslib, global2.graphql));
    })(exports, function(exports2, tslib, graphql) {
      "use strict";
      var docCache = /* @__PURE__ */ new Map();
      var fragmentSourceMap = /* @__PURE__ */ new Map();
      var printFragmentWarnings = true;
      var experimentalFragmentVariables = false;
      function normalize(string) {
        return string.replace(/[\s,]+/g, " ").trim();
      }
      function cacheKeyFromLoc(loc) {
        return normalize(loc.source.body.substring(loc.start, loc.end));
      }
      function processFragments(ast) {
        var seenKeys = /* @__PURE__ */ new Set();
        var definitions = [];
        ast.definitions.forEach(function(fragmentDefinition) {
          if (fragmentDefinition.kind === "FragmentDefinition") {
            var fragmentName = fragmentDefinition.name.value;
            var sourceKey = cacheKeyFromLoc(fragmentDefinition.loc);
            var sourceKeySet = fragmentSourceMap.get(fragmentName);
            if (sourceKeySet && !sourceKeySet.has(sourceKey)) {
              if (printFragmentWarnings) {
                console.warn("Warning: fragment with name " + fragmentName + " already exists.\ngraphql-tag enforces all fragment names across your application to be unique; read more about\nthis in the docs: http://dev.apollodata.com/core/fragments.html#unique-names");
              }
            } else if (!sourceKeySet) {
              fragmentSourceMap.set(fragmentName, sourceKeySet = /* @__PURE__ */ new Set());
            }
            sourceKeySet.add(sourceKey);
            if (!seenKeys.has(sourceKey)) {
              seenKeys.add(sourceKey);
              definitions.push(fragmentDefinition);
            }
          } else {
            definitions.push(fragmentDefinition);
          }
        });
        return tslib.__assign(tslib.__assign({}, ast), { definitions });
      }
      function stripLoc(doc) {
        var workSet = new Set(doc.definitions);
        workSet.forEach(function(node) {
          if (node.loc)
            delete node.loc;
          Object.keys(node).forEach(function(key) {
            var value = node[key];
            if (value && typeof value === "object") {
              workSet.add(value);
            }
          });
        });
        var loc = doc.loc;
        if (loc) {
          delete loc.startToken;
          delete loc.endToken;
        }
        return doc;
      }
      function parseDocument(source) {
        var cacheKey = normalize(source);
        if (!docCache.has(cacheKey)) {
          var parsed = graphql.parse(source, {
            experimentalFragmentVariables,
            allowLegacyFragmentVariables: experimentalFragmentVariables
          });
          if (!parsed || parsed.kind !== "Document") {
            throw new Error("Not a valid GraphQL document.");
          }
          docCache.set(cacheKey, stripLoc(processFragments(parsed)));
        }
        return docCache.get(cacheKey);
      }
      function gql2(literals) {
        var args = [];
        for (var _i = 1; _i < arguments.length; _i++) {
          args[_i - 1] = arguments[_i];
        }
        if (typeof literals === "string") {
          literals = [literals];
        }
        var result = literals[0];
        args.forEach(function(arg, i) {
          if (arg && arg.kind === "Document") {
            result += arg.loc.source.body;
          } else {
            result += arg;
          }
          result += literals[i + 1];
        });
        return parseDocument(result);
      }
      function resetCaches() {
        docCache.clear();
        fragmentSourceMap.clear();
      }
      function disableFragmentWarnings() {
        printFragmentWarnings = false;
      }
      function enableExperimentalFragmentVariables() {
        experimentalFragmentVariables = true;
      }
      function disableExperimentalFragmentVariables() {
        experimentalFragmentVariables = false;
      }
      var extras = {
        gql: gql2,
        resetCaches,
        disableFragmentWarnings,
        enableExperimentalFragmentVariables,
        disableExperimentalFragmentVariables
      };
      (function(gql_1) {
        gql_1.gql = extras.gql, gql_1.resetCaches = extras.resetCaches, gql_1.disableFragmentWarnings = extras.disableFragmentWarnings, gql_1.enableExperimentalFragmentVariables = extras.enableExperimentalFragmentVariables, gql_1.disableExperimentalFragmentVariables = extras.disableExperimentalFragmentVariables;
      })(gql2 || (gql2 = {}));
      gql2["default"] = gql2;
      var gql$1 = gql2;
      exports2.default = gql$1;
      exports2.disableExperimentalFragmentVariables = disableExperimentalFragmentVariables;
      exports2.disableFragmentWarnings = disableFragmentWarnings;
      exports2.enableExperimentalFragmentVariables = enableExperimentalFragmentVariables;
      exports2.gql = gql2;
      exports2.resetCaches = resetCaches;
      Object.defineProperty(exports2, "__esModule", { value: true });
    });
  }
});

// ../api/node_modules/graphql-tag/main.js
var require_main = __commonJS({
  "../api/node_modules/graphql-tag/main.js"(exports, module) {
    module.exports = require_graphql_tag_umd().gql;
  }
});

// src/formElements/sortFormElements.ts
function sortFormElements(elements) {
  if (elements.length === 0) {
    return [];
  }
  const Welcome = elements.find((el) => el.typeId === "WelcomeMessage");
  const ThankYou = elements.find((el) => el.typeId === "ThankYou");
  const SaveScreen = elements.find((el) => el.typeId === "SaveScreen");
  const FeatureName = elements.find((el) => el.typeId === "FeatureName");
  const SAPRange = elements.find((el) => el.typeId === "SAPRange");
  const Consent = elements.find((el) => el.typeId === "Consent");
  const bodyElements = elements.filter((el) => el.typeId !== "WelcomeMessage" && el.typeId !== "ThankYou" && el.typeId !== "SaveScreen" && el.typeId !== "FeatureName" && el.typeId !== "SAPRange" && el.typeId !== "Consent");
  bodyElements.sort((a, b) => {
    return a.position - b.position;
  });
  const pre = [];
  const post = [];
  if (Welcome) {
    pre.push(Welcome);
  }
  if (Consent) {
    pre.push(Consent);
  }
  if (FeatureName) {
    pre.push(FeatureName);
  }
  if (SAPRange) {
    pre.push(SAPRange);
  }
  if (SaveScreen) {
    post.push(SaveScreen);
  }
  if (ThankYou) {
    post.push(ThankYou);
  }
  if (Welcome || ThankYou) {
    if (!Welcome) {
      throw new Error("WelcomeMessage FormElement not in Form");
    }
    if (!ThankYou) {
      throw new Error("ThankYou FormElement not in Form");
    }
    if (!SaveScreen) {
      throw new Error("SaveScreen FormElement is not in Form");
    }
    return [...pre, ...bodyElements, ...post];
  } else {
    return [...pre, ...bodyElements, ...post];
  }
}

// src/formElements/registerComponent.ts
var components = {};
var componentExportHelpers = {};
var defaultColumnsGetter = (settings, exportId) => [
  exportId
];
var defaultAnswersGetter = (settings, exportId, answer) => ({ [exportId]: answer });
var defaultGetValueForRuleEvaluation = (value) => value;
var defaultShouldDisplaySubordinateElementFunction = () => false;
function registerComponent(options) {
  componentExportHelpers[options.name] = {
    getColumns: options.getColumns || defaultColumnsGetter,
    getAnswers: options.getAnswers || defaultAnswersGetter,
    getValueForRuleEvaluation: options.getValueForRuleEvaluation || defaultGetValueForRuleEvaluation,
    shouldDisplaySubordinateElement: options.shouldDisplaySubordinateElement || defaultShouldDisplaySubordinateElementFunction
  };
  if (global.window) {
    import(
      /* webpackMode: "eager" */
      `./${options.fname || options.name}.tsx`
    ).then((component) => {
      components[options.name] = component.default;
    });
  }
}

// src/formElements/index.ts
registerComponent({ name: "WelcomeMessage" });
registerComponent({
  name: "Name",
  getColumns: (componentSettings, exportId) => {
    return [exportId, `is_facilitated`, `facilitator_name`];
  },
  getAnswers: (settings, exportId, answer) => {
    return {
      [exportId]: answer.name,
      is_facilitated: !!(answer.facilitator && answer.facilitator.length > 0),
      facilitator_name: answer.facilitator
    };
  }
});
registerComponent({ name: "Email" });
registerComponent({
  name: "Consent",
  getColumns: (componentSettings, exportId) => {
    return [exportId, `${exportId}_doc_version`, `${exportId}_doc_clicked`];
  },
  getAnswers: (settings, exportId, answer) => {
    return {
      [exportId]: !!answer.consented,
      [`${exportId}_doc_version`]: answer.docVersion,
      [`${exportId}_doc_clicked`]: !!answer.clickedDoc
    };
  }
});
registerComponent({
  name: "MultipleChoice",
  getColumns: (componentSettings, exportId) => {
    return [exportId];
  },
  getAnswers: (settings, exportId, answer) => {
    return {
      [exportId]: Array.isArray(answer) ? answer[0] : answer || void 0
    };
  }
});
registerComponent({ name: "ShortText" });
registerComponent({ name: "TextArea" });
registerComponent({ name: "Number" });
registerComponent({ name: "Rating" });
registerComponent({ name: "Statement" });
registerComponent({ name: "YesNo" });
registerComponent({ name: "ComboBox" });
registerComponent({
  name: "Matrix",
  getColumns: (componentSettings, exportId) => {
    return (componentSettings.rows || []).map((option) => `${exportId}_${option.value || option.label}`);
  },
  getAnswers: (settings, exportId, answer) => {
    return (settings.rows || []).reduce((prev, option) => {
      prev[`${exportId}_${option.value || option.label}`] = answer[option.value || option.label];
      return prev;
    }, {});
  }
});
registerComponent({ name: "ThankYou" });
registerComponent({ name: "SingleSpatialInput" });
registerComponent({ name: "MultiSpatialInput" });
registerComponent({
  name: "SpatialAccessPriorityInput",
  fname: "SpatialAccessPriority/SpatialAccessPriority",
  getColumns: (componentSettings, exportId) => {
    return [`${exportId}_sectors`, `${exportId}_feature_ids`];
  },
  getAnswers: (settings, exportId, answer) => {
    if (Array.isArray(answer)) {
      return {
        [`${exportId}_sectors`]: [
          "Unknown -- https://github.com/seasketch/next/commit/3a69e33b14dd444b240edc24aa95d754099e2c25"
        ],
        [`${exportId}_feature_ids`]: answer
      };
    } else {
      return {
        [`${exportId}_sectors`]: answer.sectors,
        [`${exportId}_feature_ids`]: answer.collection || []
      };
    }
  },
  getValueForRuleEvaluation: (value, componentSettings) => {
    return value.sectors;
  },
  shouldDisplaySubordinateElement: function(elementId, componentSettings, value) {
    const sectors = (value == null ? void 0 : value.sectors) || [];
    const visibilitySettings = (componentSettings == null ? void 0 : componentSettings.subordinateVisibilitySettings) || {};
    for (const sector of sectors) {
      if (visibilitySettings[elementId] && visibilitySettings[elementId].indexOf(sector) !== -1) {
        return true;
      }
    }
    return false;
  }
});
registerComponent({ name: "FeatureName" });
registerComponent({ name: "SAPRange" });
registerComponent({ name: "SaveScreen" });

// src/generated/graphql.ts
var import_client = __toESM(require_main());
var Apollo = __toESM(require_main());
var UpdateTerrainExaggerationFragmentDoc = import_client.gql`
    fragment UpdateTerrainExaggeration on Basemap {
  terrainExaggeration
}
    `;
var NewLabelsLayerFragmentDoc = import_client.gql`
    fragment NewLabelsLayer on Basemap {
  labelsLayerId
}
    `;
var NewTerrainFragmentDoc = import_client.gql`
    fragment NewTerrain on Basemap {
  terrainUrl
  terrainOptional
  terrainVisibilityDefault
}
    `;
var NewBasemapFragmentDoc = import_client.gql`
    fragment NewBasemap on Basemap {
  id
  projectId
  attribution
  description
  labelsLayerId
  name
  nodeId
  terrainExaggeration
  terrainOptional
  url
  type
  tileSize
  thumbnail
  terrainUrl
  terrainTileSize
}
    `;
var NewQueryParametersFragmentDoc = import_client.gql`
    fragment NewQueryParameters on DataSource {
  queryParameters
}
    `;
var UpdateHighDpiFragmentDoc = import_client.gql`
    fragment UpdateHighDPI on DataSource {
  useDevicePixelRatio
}
    `;
var UpdateFormatFragmentDoc = import_client.gql`
    fragment UpdateFormat on DataSource {
  queryParameters
}
    `;
var NewGlStyleFragmentDoc = import_client.gql`
    fragment NewGLStyle on DataLayer {
  mapboxGlStyles
}
    `;
var NewRenderUnderFragmentDoc = import_client.gql`
    fragment NewRenderUnder on DataLayer {
  renderUnder
}
    `;
var NewZIndexFragmentDoc = import_client.gql`
    fragment NewZIndex on DataLayer {
  zIndex
}
    `;
var NewElementFragmentDoc = import_client.gql`
    fragment NewElement on FormElement {
  body
  componentSettings
  exportId
  formId
  id
  isRequired
  position
  jumpToId
  type {
    componentName
    isHidden
    isInput
    isSingleUseOnly
    isSurveysOnly
    label
    supportedOperators
  }
  typeId
  backgroundColor
  secondaryColor
  backgroundImage
  layout
  backgroundPalette
  textVariant
  unsplashAuthorUrl
  unsplashAuthorName
  backgroundWidth
  backgroundHeight
}
    `;
var LogicRuleEditorFormElementFragmentDoc = import_client.gql`
    fragment LogicRuleEditorFormElement on FormElement {
  id
  body
  typeId
  formId
  jumpToId
  componentSettings
  exportId
  isRequired
  type {
    supportedOperators
    isInput
  }
}
    `;
var LogicRuleEditorRuleFragmentDoc = import_client.gql`
    fragment LogicRuleEditorRule on FormLogicRule {
  booleanOperator
  command
  formElementId
  id
  jumpToId
  position
  conditions {
    id
    operator
    ruleId
    subjectId
    value
  }
}
    `;
var NewRuleFragmentDoc = import_client.gql`
    fragment NewRule on FormLogicRule {
  booleanOperator
  command
  id
  jumpToId
  position
  formElementId
  conditions {
    id
    operator
    value
    subjectId
    ruleId
  }
}
    `;
var NewSurveyFragmentDoc = import_client.gql`
    fragment NewSurvey on Survey {
  id
  accessType
  invitedGroups {
    id
    name
  }
  isDisabled
  limitToSingleResponse
  name
  submittedResponseCount
  projectId
}
    `;
var NewGroupFragmentDoc = import_client.gql`
    fragment NewGroup on Group {
  id
  projectId
  name
}
    `;
var NewInviteEmailFragmentDoc = import_client.gql`
    fragment NewInviteEmail on InviteEmail {
  id
  toAddress
  createdAt
  status
  tokenExpiresAt
  error
  updatedAt
}
    `;
var NewLayerOptionsFragmentDoc = import_client.gql`
    fragment NewLayerOptions on OptionalBasemapLayer {
  options
}
    `;
var UpdateAlternateLanguageSettingsFragmentDoc = import_client.gql`
    fragment UpdateAlternateLanguageSettings on FormElement {
  alternateLanguageSettings
}
    `;
var UpdateComponentSettingsFragmentDoc = import_client.gql`
    fragment UpdateComponentSettings on FormElement {
  componentSettings
}
    `;
var UpdateBodyFragmentDoc = import_client.gql`
    fragment UpdateBody on FormElement {
  body
}
    `;
var BasemapDetailsFragmentDoc = import_client.gql`
    fragment BasemapDetails on Basemap {
  id
  attribution
  interactivitySettings {
    cursor
    id
    layers
    longTemplate
    shortTemplate
    type
  }
  labelsLayerId
  name
  optionalBasemapLayers {
    basemapId
    id
    defaultVisibility
    description
    options
    groupType
    layers
    metadata
    name
  }
  description
  projectId
  terrainExaggeration
  terrainMaxZoom
  terrainOptional
  terrainTileSize
  terrainUrl
  terrainVisibilityDefault
  thumbnail
  tileSize
  type
  url
}
    `;
var SurveyListDetailsFragmentDoc = import_client.gql`
    fragment SurveyListDetails on Survey {
  id
  accessType
  showProgress
  invitedGroups {
    id
    name
  }
  isDisabled
  limitToSingleResponse
  name
  submittedResponseCount
  practiceResponseCount
  projectId
  isTemplate
  showFacilitationOption
  supportedLanguages
}
    `;
var AddFormElementTypeDetailsFragmentDoc = import_client.gql`
    fragment AddFormElementTypeDetails on FormElementType {
  componentName
  isHidden
  isInput
  isSingleUseOnly
  isSurveysOnly
  label
  supportedOperators
  isSpatial
  allowedLayouts
}
    `;
var FormElementDetailsFragmentDoc = import_client.gql`
    fragment FormElementDetails on FormElement {
  body
  componentSettings
  alternateLanguageSettings
  exportId
  formId
  id
  isRequired
  position
  jumpToId
  type {
    ...AddFormElementTypeDetails
  }
  isInput
  typeId
  backgroundColor
  secondaryColor
  backgroundImage
  layout
  backgroundPalette
  textVariant
  unsplashAuthorUrl
  unsplashAuthorName
  backgroundWidth
  backgroundHeight
  subordinateTo
}
    ${AddFormElementTypeDetailsFragmentDoc}`;
var LogicRuleDetailsFragmentDoc = import_client.gql`
    fragment LogicRuleDetails on FormLogicRule {
  booleanOperator
  command
  id
  jumpToId
  position
  formElementId
  conditions {
    id
    operator
    value
    subjectId
    ruleId
  }
}
    `;
var SketchClassDetailsFragmentDoc = import_client.gql`
    fragment SketchClassDetails on SketchClass {
  id
  mapboxGlStyle
  formElementId
  geometryType
  geoprocessingClientName
  geoprocessingClientUrl
  geoprocessingProjectUrl
  allowMulti
  form {
    formElements {
      ...FormElementDetails
    }
    id
    logicRules {
      ...LogicRuleDetails
    }
  }
}
    ${FormElementDetailsFragmentDoc}
${LogicRuleDetailsFragmentDoc}`;
var FormElementFullDetailsFragmentDoc = import_client.gql`
    fragment FormElementFullDetails on FormElement {
  ...FormElementDetails
  sketchClass {
    ...SketchClassDetails
  }
}
    ${FormElementDetailsFragmentDoc}
${SketchClassDetailsFragmentDoc}`;
var SurveyAppRuleFragmentDoc = import_client.gql`
    fragment SurveyAppRule on FormLogicRule {
  booleanOperator
  command
  conditions {
    id
    operator
    ruleId
    subjectId
    value
  }
  formElementId
  id
  jumpToId
  position
}
    `;
var SurveyAppFormElementFragmentDoc = import_client.gql`
    fragment SurveyAppFormElement on FormElement {
  id
  componentSettings
  alternateLanguageSettings
  body
  isRequired
  isInput
  position
  typeId
  formId
  type {
    componentName
    isInput
    isSingleUseOnly
    isSurveysOnly
    label
    isSpatial
    allowedLayouts
    supportedOperators
    isHidden
  }
  sketchClass {
    ...SketchClassDetails
  }
  backgroundColor
  secondaryColor
  backgroundImage
  layout
  textVariant
  unsplashAuthorName
  unsplashAuthorUrl
  backgroundWidth
  backgroundHeight
  jumpToId
  subordinateTo
}
    ${SketchClassDetailsFragmentDoc}`;
var SurveyAppSurveyFragmentDoc = import_client.gql`
    fragment SurveyAppSurvey on Survey {
  id
  name
  accessType
  isDisabled
  showProgress
  showFacilitationOption
  supportedLanguages
  form {
    id
    logicRules {
      ...SurveyAppRule
    }
    formElements {
      ...SurveyAppFormElement
    }
  }
}
    ${SurveyAppRuleFragmentDoc}
${SurveyAppFormElementFragmentDoc}`;
var ParticipantListDetailsFragmentDoc = import_client.gql`
    fragment ParticipantListDetails on User {
  id
  bannedFromForums
  isAdmin
  profile {
    email
    fullname
    nickname
    picture
  }
  groups {
    id
    name
  }
  canonicalEmail
}
    `;
var UserListDetailsFragmentDoc = import_client.gql`
    fragment UserListDetails on User {
  id
  isAdmin
  canonicalEmail
  bannedFromForums
  groups {
    name
    id
  }
  onboarded
  participationStatus
  profile {
    email
    fullname
    nickname
    picture
  }
}
    `;
var InviteDetailsFragmentDoc = import_client.gql`
    fragment InviteDetails on ProjectInvite {
  createdAt
  email
  fullname
  groups {
    id
    name
  }
  id
  status
  makeAdmin
  wasUsed
}
    `;
var InviteEmailDetailsFragmentDoc = import_client.gql`
    fragment InviteEmailDetails on InviteEmail {
  id
  toAddress
  createdAt
  status
  tokenExpiresAt
  error
  updatedAt
}
    `;
var ProjectBucketSettingDocument = import_client.gql`
    query ProjectBucketSetting($slug: String!) {
  projectBySlug(slug: $slug) {
    __typename
    id
    dataSourcesBucket {
      url
      region
      name
      location {
        geojson
      }
    }
  }
  dataSourcesBucketsConnection {
    nodes {
      url
      name
      region
      location {
        geojson
      }
    }
  }
}
    `;
var UpdateProjectStorageBucketDocument = import_client.gql`
    mutation UpdateProjectStorageBucket($slug: String!, $bucket: String!) {
  updateProjectBySlug(input: {slug: $slug, patch: {dataSourcesBucketId: $bucket}}) {
    clientMutationId
    project {
      __typename
      id
      dataSourcesBucket {
        url
        region
        name
      }
    }
  }
}
    `;
var GetAclDocument = import_client.gql`
    query GetAcl($nodeId: ID!) {
  aclByNodeId(nodeId: $nodeId) {
    id
    nodeId
    type
    groups {
      id
      name
      memberCount
    }
  }
}
    `;
var UpdateAclTypeDocument = import_client.gql`
    mutation UpdateAclType($nodeId: ID!, $type: AccessControlListType!) {
  updateAclByNodeId(input: {nodeId: $nodeId, patch: {type: $type}}) {
    acl {
      id
      nodeId
      type
    }
  }
}
    `;
var AddGroupToAclDocument = import_client.gql`
    mutation AddGroupToAcl($id: Int!, $groupId: Int!) {
  addGroupToAcl(input: {aclId: $id, groupId: $groupId}) {
    acl {
      groups {
        id
        name
      }
    }
  }
}
    `;
var RemoveGroupFromAclDocument = import_client.gql`
    mutation RemoveGroupFromAcl($id: Int!, $groupId: Int!) {
  removeGroupFromAcl(input: {aclId: $id, groupId: $groupId}) {
    acl {
      groups {
        id
        name
      }
    }
  }
}
    `;
var GroupsDocument = import_client.gql`
    query Groups($projectSlug: String!) {
  projectBySlug(slug: $projectSlug) {
    id
    groups {
      id
      name
      memberCount
    }
  }
}
    `;
var CreateTableOfContentsItemDocument = import_client.gql`
    mutation CreateTableOfContentsItem($title: String!, $stableId: String!, $projectId: Int!, $isFolder: Boolean!, $parentStableId: String, $metadata: JSON, $bounds: [BigFloat], $dataLayerId: Int) {
  createTableOfContentsItem(
    input: {tableOfContentsItem: {title: $title, stableId: $stableId, projectId: $projectId, parentStableId: $parentStableId, metadata: $metadata, bounds: $bounds, dataLayerId: $dataLayerId, isFolder: $isFolder}}
  ) {
    tableOfContentsItem {
      id
      title
      stableId
      projectId
      parentStableId
      isClickOffOnly
      isDraft
      isFolder
      metadata
      bounds
      dataLayerId
    }
  }
}
    `;
var CreateArcGisDynamicDataSourceDocument = import_client.gql`
    mutation CreateArcGISDynamicDataSource($projectId: Int!, $url: String!, $attribution: String, $bounds: [BigFloat], $queryParameters: JSON) {
  createDataSource(
    input: {dataSource: {projectId: $projectId, type: ARCGIS_VECTOR, url: $url, attribution: $attribution, bounds: $bounds, queryParameters: $queryParameters}}
  ) {
    dataSource {
      id
      projectId
      type
      url
    }
  }
}
    `;
var CreateArcGisImageSourceDocument = import_client.gql`
    mutation CreateArcGISImageSource($projectId: Int!, $url: String!, $attribution: String, $bounds: [BigFloat], $queryParameters: JSON, $enableHighDPI: Boolean, $supportsDynamicLayers: Boolean!) {
  createDataSource(
    input: {dataSource: {projectId: $projectId, type: ARCGIS_DYNAMIC_MAPSERVER, url: $url, attribution: $attribution, bounds: $bounds, queryParameters: $queryParameters, useDevicePixelRatio: $enableHighDPI, supportsDynamicLayers: $supportsDynamicLayers}}
  ) {
    dataSource {
      id
      url
    }
  }
}
    `;
var CreateSeaSketchVectorSourceDocument = import_client.gql`
    mutation CreateSeaSketchVectorSource($projectId: Int!, $attribution: String, $bounds: [BigFloat]!, $byteLength: Int!, $originalSourceUrl: String, $importType: DataSourceImportTypes!, $enhancedSecurity: Boolean!) {
  createDataSource(
    input: {dataSource: {projectId: $projectId, type: SEASKETCH_VECTOR, attribution: $attribution, bounds: $bounds, byteLength: $byteLength, originalSourceUrl: $originalSourceUrl, importType: $importType, enhancedSecurity: $enhancedSecurity}}
  ) {
    dataSource {
      id
      projectId
      type
      url
      presignedUploadUrl
      bucketId
      enhancedSecurity
      objectKey
    }
  }
}
    `;
var CreateDataLayerDocument = import_client.gql`
    mutation CreateDataLayer($projectId: Int!, $dataSourceId: Int!, $mapboxGlStyles: JSON, $renderUnder: RenderUnderType, $sublayer: String) {
  createDataLayer(
    input: {dataLayer: {projectId: $projectId, dataSourceId: $dataSourceId, mapboxGlStyles: $mapboxGlStyles, renderUnder: $renderUnder, sublayer: $sublayer}}
  ) {
    dataLayer {
      id
      dataSourceId
      zIndex
      interactivitySettings {
        cursor
        id
        longTemplate
        shortTemplate
        type
      }
    }
  }
}
    `;
var GetOrCreateSpriteDocument = import_client.gql`
    mutation GetOrCreateSprite($height: Int!, $width: Int!, $pixelRatio: Int!, $projectId: Int!, $smallestImage: Upload!) {
  getOrCreateSprite(
    height: $height
    pixelRatio: $pixelRatio
    projectId: $projectId
    smallestImage: $smallestImage
    width: $width
  ) {
    id
    md5
    projectId
    type
    spriteImages {
      spriteId
      height
      pixelRatio
      url
      width
    }
  }
}
    `;
var AddImageToSpriteDocument = import_client.gql`
    mutation AddImageToSprite($spriteId: Int!, $width: Int!, $height: Int!, $pixelRatio: Int!, $image: Upload!) {
  addImageToSprite(
    height: $height
    width: $width
    pixelRatio: $pixelRatio
    spriteId: $spriteId
    image: $image
  ) {
    id
    md5
    projectId
    type
    spriteImages {
      spriteId
      height
      pixelRatio
      url
      width
    }
  }
}
    `;
var VerifyProjectInviteDocument = import_client.gql`
    query VerifyProjectInvite($token: String!) {
  verifyProjectInvite(token: $token) {
    claims {
      admin
      email
      fullname
      inviteId
      projectId
      wasUsed
      projectSlug
    }
    error
    existingAccount
  }
}
    `;
var ConfirmProjectInviteDocument = import_client.gql`
    mutation ConfirmProjectInvite($token: String!) {
  confirmProjectInvite(token: $token) {
    admin
    email
    fullname
    inviteId
    projectId
    projectName
    wasUsed
    projectSlug
  }
}
    `;
var ResendEmailVerificationDocument = import_client.gql`
    mutation ResendEmailVerification {
  resendVerificationEmail {
    success
    error
  }
}
    `;
var RequestInviteOnlyProjectAccessDocument = import_client.gql`
    mutation RequestInviteOnlyProjectAccess($projectId: Int!) {
  joinProject(input: {projectId: $projectId}) {
    clientMutationId
  }
}
    `;
var GetBasemapsDocument = import_client.gql`
    query GetBasemaps($slug: String!) {
  projectBySlug(slug: $slug) {
    id
    basemaps {
      ...BasemapDetails
    }
  }
}
    ${BasemapDetailsFragmentDoc}`;
var CreateBasemapDocument = import_client.gql`
    mutation CreateBasemap($projectId: Int, $name: String!, $thumbnail: Upload!, $tileSize: Int, $type: BasemapType!, $url: String!) {
  createBasemap(
    input: {basemap: {projectId: $projectId, name: $name, thumbnail: $thumbnail, tileSize: $tileSize, type: $type, url: $url}}
  ) {
    basemap {
      id
      attribution
      interactivitySettings {
        cursor
        id
        layers
        longTemplate
        shortTemplate
        type
      }
      labelsLayerId
      name
      optionalBasemapLayers {
        basemapId
        id
        defaultVisibility
        description
        options
        groupType
        layers
        metadata
        name
      }
      description
      projectId
      terrainExaggeration
      terrainMaxZoom
      terrainOptional
      terrainTileSize
      terrainUrl
      terrainVisibilityDefault
      thumbnail
      tileSize
      type
      url
    }
  }
}
    `;
var GetBasemapDocument = import_client.gql`
    query GetBasemap($id: Int!) {
  basemap(id: $id) {
    id
    attribution
    interactivitySettings {
      cursor
      id
      layers
      longTemplate
      shortTemplate
      type
    }
    description
    labelsLayerId
    name
    optionalBasemapLayers {
      basemapId
      defaultVisibility
      description
      options
      groupType
      id
      layers
      metadata
      name
    }
    projectId
    terrainExaggeration
    terrainMaxZoom
    terrainOptional
    terrainTileSize
    terrainUrl
    terrainVisibilityDefault
    thumbnail
    tileSize
    type
    url
  }
}
    `;
var UpdateBasemapDocument = import_client.gql`
    mutation UpdateBasemap($id: Int!, $name: String) {
  updateBasemap(input: {id: $id, patch: {name: $name}}) {
    basemap {
      name
      id
    }
  }
}
    `;
var UpdateBasemapUrlDocument = import_client.gql`
    mutation UpdateBasemapUrl($id: Int!, $url: String!) {
  updateBasemap(input: {id: $id, patch: {url: $url}}) {
    basemap {
      url
      id
    }
  }
}
    `;
var UpdateBasemapLabelsLayerDocument = import_client.gql`
    mutation UpdateBasemapLabelsLayer($id: Int!, $layer: String) {
  updateBasemap(input: {id: $id, patch: {labelsLayerId: $layer}}) {
    basemap {
      id
      labelsLayerId
    }
  }
}
    `;
var Toggle3dTerrainDocument = import_client.gql`
    mutation Toggle3dTerrain($id: Int!, $terrainUrl: String) {
  updateBasemap(input: {id: $id, patch: {terrainUrl: $terrainUrl}}) {
    basemap {
      id
      terrainUrl
    }
  }
}
    `;
var Set3dTerrainDocument = import_client.gql`
    mutation Set3dTerrain($id: Int!, $terrainUrl: String, $terrainOptional: Boolean, $terrainVisibilityDefault: Boolean) {
  updateBasemap(
    input: {id: $id, patch: {terrainUrl: $terrainUrl, terrainOptional: $terrainOptional, terrainVisibilityDefault: $terrainVisibilityDefault}}
  ) {
    basemap {
      id
      terrainUrl
      terrainVisibilityDefault
      terrainOptional
    }
  }
}
    `;
var UpdateTerrainExaggerationDocument = import_client.gql`
    mutation UpdateTerrainExaggeration($id: Int!, $terrainExaggeration: BigFloat!) {
  updateBasemap(
    input: {id: $id, patch: {terrainExaggeration: $terrainExaggeration}}
  ) {
    basemap {
      id
      terrainExaggeration
    }
  }
}
    `;
var DeleteBasemapDocument = import_client.gql`
    mutation DeleteBasemap($id: Int!) {
  deleteBasemap(input: {id: $id}) {
    basemap {
      id
    }
  }
}
    `;
var OptionalLayerDocument = import_client.gql`
    query OptionalLayer($id: Int!) {
  optionalBasemapLayer(id: $id) {
    id
    basemapId
    defaultVisibility
    description
    options
    groupType
    layers
    metadata
    name
  }
}
    `;
var UpdateOptionalLayerNameDocument = import_client.gql`
    mutation UpdateOptionalLayerName($id: Int!, $name: String!) {
  updateOptionalBasemapLayer(input: {id: $id, patch: {name: $name}}) {
    optionalBasemapLayer {
      id
      name
    }
  }
}
    `;
var CreateOptionalLayerDocument = import_client.gql`
    mutation CreateOptionalLayer($name: String!, $basemapId: Int!, $groupType: OptionalBasemapLayersGroupType, $options: JSON) {
  createOptionalBasemapLayer(
    input: {optionalBasemapLayer: {name: $name, basemapId: $basemapId, groupType: $groupType, options: $options}}
  ) {
    optionalBasemapLayer {
      id
      basemapId
      defaultVisibility
      description
      options
      groupType
      layers
      metadata
      name
    }
  }
}
    `;
var UpdateOptionalLayerDocument = import_client.gql`
    mutation UpdateOptionalLayer($id: Int!, $name: String, $description: String, $defaultVisibility: Boolean, $metadata: JSON) {
  updateOptionalBasemapLayer(
    input: {id: $id, patch: {name: $name, description: $description, defaultVisibility: $defaultVisibility, metadata: $metadata}}
  ) {
    optionalBasemapLayer {
      name
      description
      id
      defaultVisibility
      metadata
    }
  }
}
    `;
var DeleteOptionalLayerDocument = import_client.gql`
    mutation DeleteOptionalLayer($id: Int!) {
  deleteOptionalBasemapLayer(input: {id: $id}) {
    optionalBasemapLayer {
      id
    }
  }
}
    `;
var UpdateOptionalBasemapLayerLayerListDocument = import_client.gql`
    mutation UpdateOptionalBasemapLayerLayerList($id: Int!, $layers: [String]) {
  updateOptionalBasemapLayer(input: {id: $id, patch: {layers: $layers}}) {
    optionalBasemapLayer {
      id
      layers
    }
  }
}
    `;
var UpdateOptionalBasemapLayerOptionsDocument = import_client.gql`
    mutation UpdateOptionalBasemapLayerOptions($id: Int!, $options: JSON!) {
  updateOptionalBasemapLayer(input: {id: $id, patch: {options: $options}}) {
    optionalBasemapLayer {
      id
      options
    }
  }
}
    `;
var GetOptionalBasemapLayerDocument = import_client.gql`
    query GetOptionalBasemapLayer($id: Int!) {
  optionalBasemapLayer(id: $id) {
    id
    basemapId
    name
    description
    defaultVisibility
    groupType
    layers
    metadata
    options
  }
}
    `;
var GetOptionalBasemapLayerMetadataDocument = import_client.gql`
    query GetOptionalBasemapLayerMetadata($id: Int!) {
  optionalBasemapLayer(id: $id) {
    id
    metadata
  }
}
    `;
var UpdateOptionalBasemapLayerMetadataDocument = import_client.gql`
    mutation UpdateOptionalBasemapLayerMetadata($id: Int!, $metadata: JSON) {
  updateOptionalBasemapLayer(input: {id: $id, patch: {metadata: $metadata}}) {
    optionalBasemapLayer {
      id
      metadata
    }
  }
}
    `;
var UpdateInteractivitySettingsLayersDocument = import_client.gql`
    mutation UpdateInteractivitySettingsLayers($id: Int!, $layers: [String]) {
  updateInteractivitySetting(input: {id: $id, patch: {layers: $layers}}) {
    interactivitySetting {
      layers
      id
    }
  }
}
    `;
var CreateProjectDocument = import_client.gql`
    mutation CreateProject($name: String!, $slug: String!) {
  createProject(input: {name: $name, slug: $slug}) {
    project {
      id
      url
      slug
    }
  }
}
    `;
var CurrentProjectMetadataDocument = import_client.gql`
    query CurrentProjectMetadata {
  currentProject {
    id
    slug
    url
    name
    description
    logoLink
    logoUrl
    accessControl
    sessionIsAdmin
    isFeatured
  }
  currentProjectPublicDetails {
    id
    accessControl
    slug
    name
    logoUrl
    supportEmail
  }
  currentProjectAccessStatus
  me {
    id
    profile {
      fullname
      nickname
      email
      picture
      bio
      affiliations
    }
  }
}
    `;
var DraftTableOfContentsDocument = import_client.gql`
    query DraftTableOfContents($slug: String!) {
  projectBySlug(slug: $slug) {
    id
    draftTableOfContentsItems {
      id
      dataLayerId
      title
      acl {
        id
        type
      }
      isClickOffOnly
      isFolder
      stableId
      parentStableId
      showRadioChildren
      bounds
      sortIndex
      hideChildren
      enableDownload
    }
  }
}
    `;
var LayersAndSourcesForItemsDocument = import_client.gql`
    query layersAndSourcesForItems($slug: String!, $tableOfContentsItemIds: [Int]!) {
  projectBySlug(slug: $slug) {
    id
    dataSourcesForItems(tableOfContentsItemIds: $tableOfContentsItemIds) {
      attribution
      bounds
      bucketId
      buffer
      byteLength
      cluster
      clusterMaxZoom
      clusterProperties
      clusterRadius
      coordinates
      createdAt
      encoding
      enhancedSecurity
      id
      importType
      lineMetrics
      maxzoom
      minzoom
      objectKey
      originalSourceUrl
      queryParameters
      scheme
      tiles
      tileSize
      tolerance
      type
      url
      urls
      useDevicePixelRatio
      supportsDynamicLayers
    }
    dataLayersForItems(tableOfContentsItemIds: $tableOfContentsItemIds) {
      interactivitySettings {
        id
        cursor
        longTemplate
        shortTemplate
        type
      }
      sprites {
        id
        spriteImages {
          pixelRatio
          height
          width
          url
        }
        type
      }
      zIndex
      dataSourceId
      id
      mapboxGlStyles
      renderUnder
      sourceLayer
      sublayer
    }
  }
}
    `;
var CreateFolderDocument = import_client.gql`
    mutation CreateFolder($title: String!, $stableId: String!, $projectId: Int!, $parentStableId: String, $isClickOffOnly: Boolean, $showRadioChildren: Boolean, $hideChildren: Boolean) {
  createTableOfContentsItem(
    input: {tableOfContentsItem: {title: $title, stableId: $stableId, projectId: $projectId, parentStableId: $parentStableId, isFolder: true, isClickOffOnly: $isClickOffOnly, showRadioChildren: $showRadioChildren, hideChildren: $hideChildren}}
  ) {
    tableOfContentsItem {
      id
      title
      stableId
      projectId
      parentStableId
      isClickOffOnly
      isDraft
      isFolder
      showRadioChildren
      isClickOffOnly
      sortIndex
      hideChildren
      enableDownload
    }
  }
}
    `;
var DeleteBranchDocument = import_client.gql`
    mutation DeleteBranch($id: Int!) {
  deleteTableOfContentsBranch(input: {tableOfContentsItemId: $id}) {
    clientMutationId
  }
}
    `;
var UpdateTableOfContentsItemChildrenDocument = import_client.gql`
    mutation UpdateTableOfContentsItemChildren($id: Int, $childIds: [Int]!) {
  updateTableOfContentsItemChildren(input: {parentId: $id, childIds: $childIds}) {
    tableOfContentsItems {
      id
      sortIndex
      parentStableId
    }
  }
}
    `;
var GetFolderDocument = import_client.gql`
    query GetFolder($id: Int!) {
  tableOfContentsItem(id: $id) {
    id
    bounds
    isClickOffOnly
    showRadioChildren
    title
    hideChildren
  }
}
    `;
var UpdateFolderDocument = import_client.gql`
    mutation UpdateFolder($id: Int!, $bounds: [BigFloat], $isClickOffOnly: Boolean, $showRadioChildren: Boolean, $title: String, $hideChildren: Boolean) {
  updateTableOfContentsItem(
    input: {id: $id, patch: {bounds: $bounds, isClickOffOnly: $isClickOffOnly, showRadioChildren: $showRadioChildren, title: $title, hideChildren: $hideChildren}}
  ) {
    tableOfContentsItem {
      id
      bounds
      isClickOffOnly
      showRadioChildren
      hideChildren
      title
    }
  }
}
    `;
var GetLayerItemDocument = import_client.gql`
    query GetLayerItem($id: Int!) {
  tableOfContentsItem(id: $id) {
    id
    acl {
      nodeId
      id
      type
      groups {
        id
        name
      }
    }
    bounds
    dataLayerId
    metadata
    parentStableId
    projectId
    stableId
    title
    enableDownload
    dataLayer {
      id
      zIndex
      mapboxGlStyles
      interactivitySettingsId
      renderUnder
      sourceLayer
      sublayer
      sprites {
        id
        spriteImages {
          pixelRatio
          height
          width
          url
        }
        type
      }
      dataSourceId
      dataSource {
        id
        attribution
        bounds
        bucketId
        buffer
        byteLength
        cluster
        clusterMaxZoom
        clusterProperties
        clusterRadius
        coordinates
        createdAt
        encoding
        enhancedSecurity
        generateId
        importType
        lineMetrics
        maxzoom
        minzoom
        objectKey
        originalSourceUrl
        promoteId
        queryParameters
        scheme
        tiles
        tileSize
        tolerance
        type
        url
        urls
        useDevicePixelRatio
        supportsDynamicLayers
      }
    }
  }
}
    `;
var UpdateTableOfContentsItemDocument = import_client.gql`
    mutation UpdateTableOfContentsItem($id: Int!, $title: String, $bounds: [BigFloat], $metadata: JSON) {
  updateTableOfContentsItem(
    input: {id: $id, patch: {title: $title, bounds: $bounds, metadata: $metadata}}
  ) {
    tableOfContentsItem {
      id
      bounds
      metadata
      title
    }
  }
}
    `;
var UpdateEnableDownloadDocument = import_client.gql`
    mutation UpdateEnableDownload($id: Int!, $enableDownload: Boolean) {
  updateTableOfContentsItem(
    input: {id: $id, patch: {enableDownload: $enableDownload}}
  ) {
    tableOfContentsItem {
      id
      enableDownload
    }
  }
}
    `;
var UpdateLayerDocument = import_client.gql`
    mutation UpdateLayer($id: Int!, $renderUnder: RenderUnderType, $mapboxGlStyles: JSON, $sublayer: String) {
  updateDataLayer(
    input: {id: $id, patch: {renderUnder: $renderUnder, mapboxGlStyles: $mapboxGlStyles, sublayer: $sublayer}}
  ) {
    dataLayer {
      id
      zIndex
      renderUnder
      mapboxGlStyles
      sublayer
      sprites {
        id
        spriteImages {
          pixelRatio
          height
          width
          url
        }
        type
      }
    }
  }
}
    `;
var UpdateDataSourceDocument = import_client.gql`
    mutation UpdateDataSource($id: Int!, $attribution: String) {
  updateDataSource(input: {id: $id, patch: {attribution: $attribution}}) {
    dataSource {
      id
      attribution
      bounds
      bucketId
      buffer
      byteLength
      cluster
      clusterMaxZoom
      clusterProperties
      clusterRadius
      coordinates
      createdAt
      encoding
      enhancedSecurity
      generateId
      importType
      lineMetrics
      maxzoom
      minzoom
      objectKey
      originalSourceUrl
      promoteId
      queryParameters
      scheme
      tiles
      tileSize
      tolerance
      type
      url
      urls
      useDevicePixelRatio
      supportsDynamicLayers
    }
  }
}
    `;
var InteractivitySettingsForLayerDocument = import_client.gql`
    query InteractivitySettingsForLayer($layerId: Int!) {
  dataLayer(id: $layerId) {
    id
    sourceLayer
    interactivitySettings {
      cursor
      id
      longTemplate
      shortTemplate
      type
    }
  }
}
    `;
var UpdateInteractivitySettingsDocument = import_client.gql`
    mutation UpdateInteractivitySettings($id: Int!, $type: InteractivityType, $cursor: CursorType, $longTemplate: String, $shortTemplate: String) {
  updateInteractivitySetting(
    input: {id: $id, patch: {type: $type, cursor: $cursor, longTemplate: $longTemplate, shortTemplate: $shortTemplate}}
  ) {
    interactivitySetting {
      id
      type
      cursor
      longTemplate
      shortTemplate
    }
  }
}
    `;
var DataSourceUrlPropertiesDocument = import_client.gql`
    query DataSourceUrlProperties($id: Int!) {
  dataSource(id: $id) {
    id
    type
    bucketId
    objectKey
    url
    originalSourceUrl
    queryParameters
  }
}
    `;
var UpdateZIndexesDocument = import_client.gql`
    mutation UpdateZIndexes($dataLayerIds: [Int]!) {
  updateZIndexes(input: {dataLayerIds: $dataLayerIds}) {
    dataLayers {
      id
      zIndex
    }
  }
}
    `;
var UpdateRenderUnderTypeDocument = import_client.gql`
    mutation UpdateRenderUnderType($layerId: Int!, $renderUnder: RenderUnderType) {
  updateDataLayer(input: {id: $layerId, patch: {renderUnder: $renderUnder}}) {
    dataLayer {
      id
      renderUnder
    }
  }
}
    `;
var UpdateQueryParametersDocument = import_client.gql`
    mutation UpdateQueryParameters($sourceId: Int!, $queryParameters: JSON!) {
  updateDataSource(
    input: {id: $sourceId, patch: {queryParameters: $queryParameters}}
  ) {
    dataSource {
      id
      queryParameters
    }
  }
}
    `;
var UpdateEnableHighDpiRequestsDocument = import_client.gql`
    mutation UpdateEnableHighDPIRequests($sourceId: Int!, $useDevicePixelRatio: Boolean!) {
  updateDataSource(
    input: {id: $sourceId, patch: {useDevicePixelRatio: $useDevicePixelRatio}}
  ) {
    dataSource {
      id
      useDevicePixelRatio
    }
  }
}
    `;
var GetMetadataDocument = import_client.gql`
    query GetMetadata($itemId: Int!) {
  tableOfContentsItem(id: $itemId) {
    id
    metadata
  }
}
    `;
var UpdateMetadataDocument = import_client.gql`
    mutation UpdateMetadata($itemId: Int!, $metadata: JSON!) {
  updateTableOfContentsItem(input: {id: $itemId, patch: {metadata: $metadata}}) {
    tableOfContentsItem {
      id
      metadata
    }
  }
}
    `;
var ProjectHostingQuotaDocument = import_client.gql`
    query ProjectHostingQuota($slug: String!) {
  projectBySlug(slug: $slug) {
    id
    dataHostingQuota
    dataHostingQuotaUsed
  }
}
    `;
var InteractivitySettingsByIdDocument = import_client.gql`
    query InteractivitySettingsById($id: Int!) {
  interactivitySetting(id: $id) {
    cursor
    id
    layers
    longTemplate
    shortTemplate
    type
  }
}
    `;
var PublishTableOfContentsDocument = import_client.gql`
    mutation PublishTableOfContents($projectId: Int!) {
  publishTableOfContents(input: {projectId: $projectId}) {
    tableOfContentsItems {
      id
    }
  }
}
    `;
var ProjectAccessControlSettingsDocument = import_client.gql`
    query ProjectAccessControlSettings($slug: String!) {
  projectBySlug(slug: $slug) {
    __typename
    id
    accessControl
    isListed
  }
}
    `;
var UpdateProjectAccessControlSettingsDocument = import_client.gql`
    mutation updateProjectAccessControlSettings($slug: String!, $accessControl: ProjectAccessControlSetting, $isListed: Boolean) {
  updateProjectBySlug(
    input: {slug: $slug, patch: {accessControl: $accessControl, isListed: $isListed}}
  ) {
    clientMutationId
    project {
      __typename
      id
      accessControl
      isListed
    }
  }
}
    `;
var ProjectRegionDocument = import_client.gql`
    query ProjectRegion($slug: String!) {
  projectBySlug(slug: $slug) {
    __typename
    id
    region {
      geojson
    }
  }
}
    `;
var UpdateProjectRegionDocument = import_client.gql`
    mutation UpdateProjectRegion($slug: String!, $region: GeoJSON!) {
  updateProjectBySlug(input: {slug: $slug, patch: {region: $region}}) {
    clientMutationId
    project {
      __typename
      id
      region {
        geojson
      }
    }
  }
}
    `;
var GetProjectBySlugDocument = import_client.gql`
    query GetProjectBySlug($slug: String!) {
  projectBySlug(slug: $slug) {
    id
    name
  }
}
    `;
var ProjectSlugExistsDocument = import_client.gql`
    query ProjectSlugExists($slug: String!) {
  projectBySlug(slug: $slug) {
    id
  }
}
    `;
var PublishedTableOfContentsDocument = import_client.gql`
    query PublishedTableOfContents($slug: String!) {
  projectBySlug(slug: $slug) {
    id
    tableOfContentsItems {
      id
      acl {
        id
        type
      }
      bounds
      dataLayerId
      enableDownload
      hideChildren
      isClickOffOnly
      isFolder
      parentStableId
      showRadioChildren
      sortIndex
      stableId
      title
    }
  }
}
    `;
var SimpleProjectListDocument = import_client.gql`
    query SimpleProjectList($first: Int, $offset: Int) {
  projectsConnection(first: $first, offset: $offset) {
    nodes {
      id
      name
      slug
      description
      url
    }
  }
}
    `;
var SurveysDocument = import_client.gql`
    query Surveys($projectId: Int!) {
  project(id: $projectId) {
    id
    surveys {
      ...SurveyListDetails
    }
  }
}
    ${SurveyListDetailsFragmentDoc}`;
var CreateSurveyDocument = import_client.gql`
    mutation CreateSurvey($name: String!, $projectId: Int!, $templateId: Int) {
  makeSurvey(input: {projectId: $projectId, name: $name, templateId: $templateId}) {
    survey {
      ...SurveyListDetails
    }
  }
}
    ${SurveyListDetailsFragmentDoc}`;
var SurveyByIdDocument = import_client.gql`
    query SurveyById($id: Int!) {
  survey(id: $id) {
    ...SurveyListDetails
  }
}
    ${SurveyListDetailsFragmentDoc}`;
var SurveyFormEditorDetailsDocument = import_client.gql`
    query SurveyFormEditorDetails($id: Int!, $slug: String!) {
  projectBySlug(slug: $slug) {
    name
  }
  formElementTypes {
    ...AddFormElementTypeDetails
  }
  survey(id: $id) {
    ...SurveyListDetails
    form {
      id
      isTemplate
      surveyId
      templateName
      templateType
      formElements {
        ...FormElementFullDetails
      }
      logicRules {
        ...LogicRuleDetails
      }
    }
  }
  currentProject {
    name
    url
    region {
      geojson
    }
  }
}
    ${AddFormElementTypeDetailsFragmentDoc}
${SurveyListDetailsFragmentDoc}
${FormElementFullDetailsFragmentDoc}
${LogicRuleDetailsFragmentDoc}`;
var FormElementTypesDocument = import_client.gql`
    query FormElementTypes {
  formElementTypes {
    ...AddFormElementTypeDetails
  }
}
    ${AddFormElementTypeDetailsFragmentDoc}`;
var UpdateSurveyBaseSettingsDocument = import_client.gql`
    mutation UpdateSurveyBaseSettings($id: Int!, $showProgress: Boolean, $showFacilitationOption: Boolean, $supportedLanguages: [String]) {
  updateSurvey(
    input: {id: $id, patch: {showProgress: $showProgress, showFacilitationOption: $showFacilitationOption, supportedLanguages: $supportedLanguages}}
  ) {
    survey {
      id
      showProgress
      showFacilitationOption
      supportedLanguages
    }
  }
}
    `;
var UpdateFormElementSketchClassDocument = import_client.gql`
    mutation UpdateFormElementSketchClass($id: Int!, $geometryType: SketchGeometryType, $allowMulti: Boolean, $mapboxGlStyle: JSON, $geoprocessingClientName: String, $geoprocessingClientUrl: String, $geoprocessingProjectUrl: String) {
  updateSketchClass(
    input: {id: $id, patch: {geometryType: $geometryType, allowMulti: $allowMulti, mapboxGlStyle: $mapboxGlStyle, geoprocessingClientName: $geoprocessingClientName, geoprocessingClientUrl: $geoprocessingClientUrl, geoprocessingProjectUrl: $geoprocessingProjectUrl}}
  ) {
    sketchClass {
      id
      geometryType
      allowMulti
      mapboxGlStyle
      geoprocessingClientName
      geoprocessingClientUrl
      geoprocessingProjectUrl
    }
  }
}
    `;
var UpdateFormElementDocument = import_client.gql`
    mutation UpdateFormElement($id: Int!, $isRequired: Boolean, $body: JSON, $exportId: String, $componentSettings: JSON, $alternateLanguageSettings: JSON, $jumpToId: Int, $typeId: String) {
  updateFormElement(
    input: {id: $id, patch: {isRequired: $isRequired, body: $body, exportId: $exportId, componentSettings: $componentSettings, jumpToId: $jumpToId, typeId: $typeId, alternateLanguageSettings: $alternateLanguageSettings}}
  ) {
    formElement {
      id
      isRequired
      body
      exportId
      componentSettings
      alternateLanguageSettings
      jumpToId
      typeId
    }
  }
}
    `;
var UpdateComponentSettingsDocument = import_client.gql`
    mutation UpdateComponentSettings($id: Int!, $componentSettings: JSON) {
  updateFormElement(
    input: {id: $id, patch: {componentSettings: $componentSettings}}
  ) {
    formElement {
      id
      componentSettings
    }
  }
}
    `;
var UpdateAlternateLanguageSettingsDocument = import_client.gql`
    mutation UpdateAlternateLanguageSettings($id: Int!, $alternateLanguageSettings: JSON) {
  updateFormElement(
    input: {id: $id, patch: {alternateLanguageSettings: $alternateLanguageSettings}}
  ) {
    formElement {
      id
      alternateLanguageSettings
    }
  }
}
    `;
var UpdateFormElementBodyDocument = import_client.gql`
    mutation UpdateFormElementBody($id: Int!, $body: JSON!) {
  updateFormElement(input: {id: $id, patch: {body: $body}}) {
    formElement {
      id
      body
    }
  }
}
    `;
var UpdateFormElementOrderDocument = import_client.gql`
    mutation UpdateFormElementOrder($elementIds: [Int]) {
  setFormElementOrder(input: {elementIds: $elementIds}) {
    formElements {
      id
      position
    }
  }
}
    `;
var AddFormElementDocument = import_client.gql`
    mutation AddFormElement($body: JSON!, $componentSettings: JSON!, $formId: Int!, $componentType: String!, $position: Int, $exportId: String, $subordinateTo: Int, $isRequired: Boolean!) {
  createFormElement(
    input: {formElement: {body: $body, componentSettings: $componentSettings, formId: $formId, isRequired: $isRequired, typeId: $componentType, position: $position, exportId: $exportId, subordinateTo: $subordinateTo}}
  ) {
    formElement {
      ...FormElementFullDetails
    }
  }
}
    ${FormElementFullDetailsFragmentDoc}`;
var DeleteFormElementDocument = import_client.gql`
    mutation DeleteFormElement($id: Int!) {
  deleteFormElement(input: {id: $id}) {
    formElement {
      id
    }
  }
}
    `;
var UpdateFormDocument = import_client.gql`
    mutation UpdateForm($id: Int!, $isTemplate: Boolean, $templateName: String) {
  updateForm(
    input: {id: $id, patch: {isTemplate: $isTemplate, templateName: $templateName}}
  ) {
    form {
      id
      isTemplate
      templateName
    }
  }
}
    `;
var GetPhotosDocument = import_client.gql`
    query GetPhotos($query: String!) {
  getUnsplashPhotos(query: $query) {
    results {
      blur_hash
      color
      description
      height
      width
      id
      links {
        download_location
      }
      urls {
        full
        raw
        regular
        small
        thumb
      }
      user {
        id
        name
        username
        links {
          html
        }
      }
    }
  }
}
    `;
var UpdateFormElementBackgroundDocument = import_client.gql`
    mutation UpdateFormElementBackground($id: Int!, $backgroundColor: String, $secondaryColor: String, $backgroundPalette: [String], $textVariant: FormElementTextVariant, $layout: FormElementLayout) {
  updateFormElement(
    input: {id: $id, patch: {backgroundColor: $backgroundColor, secondaryColor: $secondaryColor, backgroundPalette: $backgroundPalette, textVariant: $textVariant, layout: $layout}}
  ) {
    formElement {
      id
      backgroundColor
      secondaryColor
      backgroundImage
      layout
      backgroundPalette
      textVariant
      unsplashAuthorName
      unsplashAuthorUrl
    }
  }
}
    `;
var SetFormElementBackgroundDocument = import_client.gql`
    mutation SetFormElementBackground($id: Int!, $backgroundColor: String!, $secondaryColor: String!, $backgroundUrl: String!, $downloadUrl: String!, $backgroundPalette: [String]!, $unsplashAuthorUrl: String!, $unsplashAuthorName: String!, $backgroundWidth: Int!, $backgroundHeight: Int!) {
  setFormElementBackground(
    backgroundColor: $backgroundColor
    secondaryColor: $secondaryColor
    backgroundPalette: $backgroundPalette
    backgroundUrl: $backgroundUrl
    downloadUrl: $downloadUrl
    id: $id
    unsplashAuthorName: $unsplashAuthorName
    unsplashAuthorUrl: $unsplashAuthorUrl
    backgroundHeight: $backgroundHeight
    backgroundWidth: $backgroundWidth
  ) {
    id
    backgroundColor
    secondaryColor
    backgroundImage
    backgroundPalette
    unsplashAuthorName
    unsplashAuthorUrl
    backgroundWidth
    backgroundHeight
  }
}
    `;
var ClearFormElementStyleDocument = import_client.gql`
    mutation clearFormElementStyle($id: Int!) {
  clearFormElementStyle(input: {formElementId: $id}) {
    formElement {
      id
      backgroundColor
      backgroundImage
      backgroundPalette
      unsplashAuthorName
      unsplashAuthorUrl
      textVariant
      secondaryColor
    }
  }
}
    `;
var CreateLogicRuleForSurveyDocument = import_client.gql`
    mutation createLogicRuleForSurvey($formElementId: Int!, $operator: FieldRuleOperator!, $jumpToId: Int!) {
  createSurveyJumpRule(
    input: {formElementId: $formElementId, booleanOperator: OR, jumpToId: $jumpToId, operator: $operator}
  ) {
    formLogicRule {
      id
      position
      booleanOperator
      command
      formElementId
      jumpToId
      conditions {
        id
        operator
        ruleId
        subjectId
        value
      }
    }
  }
}
    `;
var UpdateFormLogicRuleDocument = import_client.gql`
    mutation UpdateFormLogicRule($id: Int!, $jumpToId: Int, $booleanOperator: FormLogicOperator, $formElementId: Int) {
  updateFormLogicRule(
    input: {id: $id, patch: {jumpToId: $jumpToId, booleanOperator: $booleanOperator, formElementId: $formElementId}}
  ) {
    formLogicRule {
      id
      booleanOperator
      command
      jumpToId
      position
      formElementId
    }
  }
}
    `;
var UpdateLogicConditionDocument = import_client.gql`
    mutation UpdateLogicCondition($id: Int!, $operator: FieldRuleOperator, $value: JSON, $subjectId: Int) {
  updateFormLogicCondition(
    input: {id: $id, patch: {operator: $operator, value: $value, subjectId: $subjectId}}
  ) {
    formLogicCondition {
      id
      ruleId
      operator
      subjectId
      value
    }
  }
}
    `;
var DeleteLogicConditionDocument = import_client.gql`
    mutation DeleteLogicCondition($id: Int!) {
  deleteFormLogicCondition(input: {id: $id}) {
    formLogicCondition {
      id
      ruleId
    }
  }
}
    `;
var DeleteLogicRuleDocument = import_client.gql`
    mutation DeleteLogicRule($id: Int!) {
  deleteFormLogicRule(input: {id: $id}) {
    formLogicRule {
      id
      formElementId
    }
  }
}
    `;
var AddConditionDocument = import_client.gql`
    mutation AddCondition($operator: FieldRuleOperator!, $ruleId: Int!, $subjectId: Int!, $value: JSON) {
  createFormLogicCondition(
    input: {formLogicCondition: {operator: $operator, ruleId: $ruleId, subjectId: $subjectId, value: $value}}
  ) {
    formLogicCondition {
      id
      operator
      ruleId
      subjectId
      value
    }
  }
}
    `;
var UpdateSurveyDraftStatusDocument = import_client.gql`
    mutation UpdateSurveyDraftStatus($id: Int!, $isDisabled: Boolean!) {
  updateSurvey(input: {id: $id, patch: {isDisabled: $isDisabled}}) {
    survey {
      id
      isDisabled
    }
  }
}
    `;
var UploadConsentDocDocument = import_client.gql`
    mutation UploadConsentDoc($document: Upload!, $formElementId: Int!, $version: Int!) {
  uploadConsentDocument(
    document: $document
    formElementId: $formElementId
    version: $version
  ) {
    id
    componentSettings
  }
}
    `;
var SurveyResponsesDocument = import_client.gql`
    query SurveyResponses($surveyId: Int!) {
  survey(id: $surveyId) {
    form {
      formElements {
        ...FormElementDetails
      }
      logicRules {
        ...SurveyAppRule
      }
    }
    id
    practiceResponseCount
    submittedResponseCount
    surveyResponsesConnection {
      nodes {
        id
        surveyId
        bypassedDuplicateSubmissionControl
        updatedAt
        accountEmail
        userId
        createdAt
        data
        isDuplicateEntry
        isDuplicateIp
        isPractice
        isUnrecognizedUserAgent
      }
    }
  }
}
    ${FormElementDetailsFragmentDoc}
${SurveyAppRuleFragmentDoc}`;
var SurveyMapDetailsDocument = import_client.gql`
    query SurveyMapDetails($surveyId: Int!) {
  survey(id: $surveyId) {
    form {
      formElements {
        ...FormElementDetails
      }
      id
    }
  }
}
    ${FormElementDetailsFragmentDoc}`;
var SurveyDocument = import_client.gql`
    query Survey($id: Int!) {
  me {
    isAdmin
    profile {
      email
      fullname
    }
  }
  currentProject {
    name
    url
    region {
      geojson
    }
  }
  survey(id: $id) {
    ...SurveyAppSurvey
  }
}
    ${SurveyAppSurveyFragmentDoc}`;
var CreateResponseDocument = import_client.gql`
    mutation CreateResponse($surveyId: Int!, $isDraft: Boolean!, $bypassedDuplicateSubmissionControl: Boolean!, $responseData: JSON!, $facilitated: Boolean!, $practice: Boolean!) {
  createSurveyResponse(
    input: {surveyId: $surveyId, draft: $isDraft, responseData: $responseData, bypassedSubmissionControl: $bypassedDuplicateSubmissionControl, facilitated: $facilitated, practice: $practice}
  ) {
    clientMutationId
    surveyResponse {
      id
    }
  }
}
    `;
var GetBasemapsAndRegionDocument = import_client.gql`
    query GetBasemapsAndRegion {
  currentProject {
    id
    basemaps {
      ...BasemapDetails
    }
    region {
      geojson
    }
  }
}
    ${BasemapDetailsFragmentDoc}`;
var UpdateProjectNameDocument = import_client.gql`
    mutation UpdateProjectName($name: String!, $slug: String!, $clientMutationId: String) {
  updateProjectBySlug(
    input: {slug: $slug, clientMutationId: $clientMutationId, patch: {name: $name}}
  ) {
    clientMutationId
    project {
      id
      name
    }
  }
}
    `;
var UpdateProjectSettingsDocument = import_client.gql`
    mutation UpdateProjectSettings($slug: String!, $clientMutationId: String, $name: String, $description: String, $logoUrl: Upload, $logoLink: String, $isFeatured: Boolean) {
  updateProjectBySlug(
    input: {slug: $slug, clientMutationId: $clientMutationId, patch: {name: $name, description: $description, logoUrl: $logoUrl, logoLink: $logoLink, isFeatured: $isFeatured}}
  ) {
    clientMutationId
    project {
      id
      name
      description
      logoUrl
      logoLink
    }
  }
}
    `;
var UserAdminCountsDocument = import_client.gql`
    query UserAdminCounts($slug: String!) {
  projectBySlug(slug: $slug) {
    id
    accessControl
    participantCount
    adminCount
    inviteCounts {
      count
      status
    }
    groups {
      id
      name
      memberCount
    }
    unapprovedParticipantCount
  }
}
    `;
var CreateGroupDocument = import_client.gql`
    mutation CreateGroup($projectId: Int!, $name: String!) {
  createGroup(input: {group: {name: $name, projectId: $projectId}}) {
    group {
      id
      name
      projectId
    }
  }
}
    `;
var ParticipantsDocument = import_client.gql`
    query Participants($slug: String!, $offset: Int, $first: Int) {
  root: projectBySlug(slug: $slug) {
    id
    participants(offset: $offset, first: $first) {
      ...ParticipantListDetails
    }
  }
}
    ${ParticipantListDetailsFragmentDoc}`;
var AdminsDocument = import_client.gql`
    query Admins($slug: String!, $offset: Int, $first: Int) {
  root: projectBySlug(slug: $slug) {
    id
    participants: admins(offset: $offset, first: $first) {
      ...ParticipantListDetails
    }
  }
}
    ${ParticipantListDetailsFragmentDoc}`;
var GroupMembersDocument = import_client.gql`
    query GroupMembers($groupId: Int!, $offset: Int, $first: Int) {
  root: group(id: $groupId) {
    participants: members(offset: $offset, first: $first) {
      ...ParticipantListDetails
    }
  }
}
    ${ParticipantListDetailsFragmentDoc}`;
var UserSettingsListsDocument = import_client.gql`
    query UserSettingsLists {
  currentProject {
    id
    groups {
      name
      id
    }
    invitesConnection {
      nodes {
        ...InviteDetails
      }
    }
    participants {
      ...UserListDetails
    }
    accessControl
  }
}
    ${InviteDetailsFragmentDoc}
${UserListDetailsFragmentDoc}`;
var UserInfoDocument = import_client.gql`
    query UserInfo($userId: Int!) {
  user(id: $userId) {
    id
    isAdmin
    canonicalEmail
    bannedFromForums
    emailNotificationPreference {
      unsubscribeAll
    }
    groups {
      name
      id
    }
    onboarded
    participationStatus
    profile {
      affiliations
      bio
      email
      fullname
      nickname
      picture
    }
  }
  currentProject {
    id
    groups {
      name
      id
    }
  }
}
    `;
var ToggleAdminAccessDocument = import_client.gql`
    mutation toggleAdminAccess($userId: Int!, $projectId: Int!) {
  toggleAdminAccess(input: {projectId: $projectId, userId: $userId}) {
    clientMutationId
    isAdmin: boolean
  }
}
    `;
var SetUserGroupsDocument = import_client.gql`
    mutation setUserGroups($userId: Int!, $projectId: Int!, $groupIds: [Int]!) {
  setUserGroups(
    input: {userId: $userId, projectId: $projectId, groups: $groupIds}
  ) {
    groupIds: integers
  }
}
    `;
var ToggleForumPostingBanDocument = import_client.gql`
    mutation toggleForumPostingBan($userId: Int!, $projectId: Int!) {
  toggleForumPostingBan(input: {userId: $userId, projectId: $projectId}) {
    isBanned: boolean
  }
}
    `;
var DeleteGroupDocument = import_client.gql`
    mutation deleteGroup($groupId: Int!) {
  deleteGroup(input: {id: $groupId}) {
    group {
      id
    }
  }
}
    `;
var CreateProjectInvitesDocument = import_client.gql`
    mutation createProjectInvites($projectId: Int!, $makeAdmin: Boolean!, $groupNames: [String]!, $userDetails: [ProjectInviteOptionInput]!, $sendEmailNow: Boolean!) {
  createProjectInvites(
    input: {projectId: $projectId, makeAdmin: $makeAdmin, groupNames: $groupNames, projectInviteOptions: $userDetails, sendEmailNow: $sendEmailNow}
  ) {
    projectInvites {
      ...InviteDetails
    }
  }
}
    ${InviteDetailsFragmentDoc}`;
var ProjectInvitesDocument = import_client.gql`
    query ProjectInvites($projectId: Int!, $status: [InviteStatus], $orderBy: InviteOrderBy, $cursor: Cursor, $limit: Int) {
  project(id: $projectId) {
    id
    invitesConnection(
      statuses: $status
      orderBy: $orderBy
      after: $cursor
      first: $limit
    ) {
      edges {
        node {
          ...InviteDetails
        }
      }
      pageInfo {
        hasNextPage
        endCursor
      }
    }
  }
}
    ${InviteDetailsFragmentDoc}`;
var InviteEditorModalQueryDocument = import_client.gql`
    query InviteEditorModalQuery($inviteId: Int!) {
  currentProject {
    id
    groups {
      id
      name
    }
  }
  projectInvite(id: $inviteId) {
    id
    makeAdmin
    email
    fullname
    status
    groups {
      id
      name
    }
    wasUsed
    inviteEmails {
      ...InviteEmailDetails
    }
  }
}
    ${InviteEmailDetailsFragmentDoc}`;
var UpdateProjectInviteDocument = import_client.gql`
    mutation UpdateProjectInvite($id: Int!, $makeAdmin: Boolean!, $email: String!, $fullname: String, $groups: [Int]!) {
  updateProjectInvite(
    input: {inviteId: $id, makeAdmin: $makeAdmin, email: $email, groups: $groups, fullname: $fullname}
  ) {
    projectInvite {
      id
      makeAdmin
      groups {
        id
        name
      }
      email
      fullname
      inviteEmails {
        ...InviteEmailDetails
      }
    }
  }
}
    ${InviteEmailDetailsFragmentDoc}`;
var DeleteProjectInviteDocument = import_client.gql`
    mutation DeleteProjectInvite($id: Int!) {
  deleteProjectInvite(input: {id: $id}) {
    projectInvite {
      id
    }
  }
}
    `;
var SendInviteDocument = import_client.gql`
    mutation SendInvite($id: Int!) {
  sendProjectInvites(input: {inviteIds: [$id]}) {
    inviteEmails {
      ...InviteEmailDetails
      projectInvite {
        id
        status
      }
    }
  }
}
    ${InviteEmailDetailsFragmentDoc}`;
var RenameGroupDocument = import_client.gql`
    mutation RenameGroup($id: Int!, $name: String!) {
  updateGroup(input: {id: $id, patch: {name: $name}}) {
    group {
      id
      name
    }
  }
}
    `;
var SendInvitesDocument = import_client.gql`
    mutation SendInvites($ids: [Int]!) {
  sendProjectInvites(input: {inviteIds: $ids}) {
    inviteEmails {
      ...InviteEmailDetails
      projectInviteId
      projectInvite {
        id
        status
      }
    }
  }
}
    ${InviteEmailDetailsFragmentDoc}`;
var ProjectInviteEmailStatusSubscriptionDocument = import_client.gql`
    subscription ProjectInviteEmailStatusSubscription {
  projectInviteStateUpdated {
    invite {
      opaqueId: id
      status
    }
  }
}
    `;
var UpdateProfileDocument = import_client.gql`
    mutation UpdateProfile($userId: Int!, $affiliations: String, $email: Email, $fullname: String, $nickname: String, $picture: Upload) {
  updateProfileByUserId(
    input: {userId: $userId, patch: {affiliations: $affiliations, email: $email, fullname: $fullname, nickname: $nickname, picture: $picture}}
  ) {
    profile {
      user {
        id
        profile {
          picture
        }
      }
    }
  }
}
    `;

// src/surveys/paging.ts
function getUnskippedInputElementsForCompletedResponse(sortedFormElements, rules, answers) {
  const ThankYou = sortedFormElements.find((el) => el.typeId === "ThankYou");
  if (!ThankYou) {
    throw new Error(`Could not find ThankYou element`);
  }
  const path = calculatePathToElement(ThankYou.id, sortedFormElements, rules, answers);
  return path.filter((el) => el.isInput);
}
function calculatePathToElement(currentId, sortedFormElements, rules, answers) {
  const currentIndex = sortedFormElements.findIndex((el) => el.id === currentId);
  if (currentIndex === 0) {
    return [sortedFormElements[0]];
  }
  const path = [];
  let recursionLimit = 2e4;
  let step = sortedFormElements[0];
  path.push(sortedFormElements[0]);
  while (step !== null && recursionLimit--) {
    step = getNextFormElement(step, sortedFormElements, rules, answers);
    if (step) {
      path.push(step);
      if (step.id === currentId) {
        return path;
      }
      if (sortedFormElements.indexOf(step) > currentIndex && !step.subordinateTo) {
        throw new Error("Stepped past current formElement!");
      }
    }
  }
  if (recursionLimit < 1) {
    throw new Error(`Reached recursion limit while calculating survey path`);
  } else {
    throw new Error(`Never reached currentIndex while calculating survey path`);
  }
}
function getNextFormElement(current, sortedFormElements, rules, answers) {
  const subordinateElements = sortedFormElements.filter((el) => !!el.subordinateTo);
  sortedFormElements = sortedFormElements.filter((el) => !el.subordinateTo);
  const originalAnswers = answers;
  answers = __spreadValues({}, answers);
  for (const el of sortedFormElements) {
    if (answers[el.id] !== void 0) {
      const C = componentExportHelpers[el.typeId];
      if (!C) {
        throw new Error(`Could not find component ${el.typeId}`);
      }
      answers[el.id] = C.getValueForRuleEvaluation(answers[el.id], el.componentSettings);
    }
  }
  const matchingSubordinateElements = subordinateElements.filter((el) => el.subordinateTo === current.id).filter((el) => componentExportHelpers[current.typeId].shouldDisplaySubordinateElement(el.id, current.componentSettings, originalAnswers[current.id]));
  if (matchingSubordinateElements.length) {
    return matchingSubordinateElements[0];
  } else if (current.subordinateTo) {
    const parent = sortedFormElements.find((el) => el.id === current.subordinateTo);
    if (!parent) {
      throw new Error("Parent of subordinate not found");
    }
    const siblings = subordinateElements.filter((el) => el.subordinateTo === current.subordinateTo).filter((el) => componentExportHelpers[parent.typeId].shouldDisplaySubordinateElement(el.id, parent.componentSettings, originalAnswers[parent.id]));
    const idx = siblings.indexOf(current);
    if (idx === siblings.length - 1) {
      const currentIndex2 = sortedFormElements.indexOf(parent);
      return sortedFormElements[currentIndex2 + 1];
    } else {
      return siblings[idx + 1];
    }
  }
  const currentIndex = sortedFormElements.indexOf(current);
  let nextByPosition = sortedFormElements[currentIndex + 1];
  let nextByJumpToId = current.jumpToId ? sortedFormElements.find((el) => el.id === current.jumpToId) : void 0;
  if (nextByJumpToId && sortedFormElements.indexOf(nextByJumpToId) < currentIndex) {
    console.warn(`Ignoring invalid skip logic rule that would jump backward in survey`);
    nextByJumpToId = void 0;
  }
  if (currentIndex === 0) {
    return nextByPosition;
  } else if (currentIndex === sortedFormElements.length - 1) {
    return null;
  } else if (currentIndex === sortedFormElements.length - 3) {
    return nextByPosition;
  } else if (currentIndex === sortedFormElements.length - 2) {
    return nextByPosition;
  } else {
    const currentRules = rules.filter((rule) => rule.formElementId === current.id).sort((a, b) => a.position - b.position);
    for (const rule of currentRules) {
      if (evaluateRule(rule, answers)) {
        const next = sortedFormElements.find((el) => el.id === rule.jumpToId);
        if (!next) {
          console.warn(`Could not find FormElement refered to by jumpToId=${rule.jumpToId}`);
        } else if (sortedFormElements.indexOf(next) < currentIndex) {
          console.warn(`Skipping logic rule that would mean jumping backwards`);
        } else {
          return next;
        }
      }
    }
    return nextByJumpToId || nextByPosition;
  }
}
function evaluateRule(rule, answers) {
  for (const condition of rule.conditions || []) {
    const answer = answers[condition.subjectId];
    if (evaluateCondition(condition.operator, condition.value, answer)) {
      if (rule.booleanOperator === "OR" /* Or */) {
        return true;
      }
    } else {
      if (rule.booleanOperator === "AND" /* And */) {
        return false;
      }
    }
  }
  return rule.booleanOperator === "AND" /* And */;
}
function evaluateCondition(operator, value, answer) {
  switch (operator) {
    case "CONTAINS" /* Contains */:
      if (Array.isArray(answer)) {
        return answer.indexOf(value) !== -1;
      } else {
        return answer == value;
      }
    case "EQUAL" /* Equal */:
      if (Array.isArray(answer)) {
        return answer.indexOf(value) !== -1;
      } else {
        return answer == value;
      }
    case "GREATER_THAN" /* GreaterThan */:
      return answer > value;
    case "IS_BLANK" /* IsBlank */:
      return answer == null || answer == void 0 || answer == "" || answer == " ";
    case "LESS_THAN" /* LessThan */:
      return answer < value;
    case "NOT_EQUAL" /* NotEqual */:
      if (Array.isArray(answer)) {
        return answer.indexOf(value) === -1;
      } else {
        return answer != value;
      }
    default:
      throw new Error(`Unsupported operator ${operator}`);
  }
}

// src/formElements/ExportUtils.ts
function getAnswers(componentName, exportId, componentSettings, answer) {
  return componentExportHelpers[componentName].getAnswers(componentSettings, exportId, answer);
}
function getDataForExport(responses, formElements, rules) {
  const sortedElements = sortFormElements(formElements);
  const rows = [];
  const columns = [
    "id",
    "survey_id",
    "created_at_utc",
    "updated_at_utc",
    "is_practice",
    "is_duplicate_ip",
    "is_logged_in",
    "account_email"
  ];
  for (const element of sortedElements) {
    if (element.isInput) {
      columns.push(...componentExportHelpers[element.typeId].getColumns(element.componentSettings, element.exportId));
    }
  }
  for (const response of responses) {
    const row = {
      id: response.id,
      survey_id: response.surveyId,
      created_at_utc: new Date(response.createdAt).toISOString(),
      is_practice: response.isPractice,
      updated_at_utc: response.updatedAt ? new Date(response.updatedAt).toISOString() : null,
      is_duplicate_ip: response.isDuplicateIp,
      is_logged_in: !!response.userId,
      account_email: response.accountEmail || null
    };
    const elements = getUnskippedInputElementsForCompletedResponse(sortedElements, rules, response.data);
    const answers = getAnswersAsProperties(elements, response.data);
    rows.push(__spreadValues(__spreadValues({}, row), answers));
  }
  return { rows, columns };
}
function getAnswersAsProperties(sortedElements, data) {
  const answers = {};
  for (const element of sortedElements) {
    const answer = data[element.id];
    if (answer !== void 0) {
      const columnData = getAnswers(element.typeId, element.exportId, element.componentSettings, answer);
      for (const col in columnData) {
        answers[col] = columnData[col];
      }
    }
  }
  return answers;
}
function normalizeSpatialProperties(surveyId, collection, formElements) {
  const sortedElements = sortFormElements(formElements);
  const features = [];
  for (const feature of collection.features) {
    const responseData = feature.properties.response_data;
    const newProperties = __spreadValues(__spreadValues(__spreadValues({
      survey_id: surveyId,
      response_id: feature.properties.response_id
    }, getAnswersAsProperties(sortedElements, feature.properties)), feature.properties.area_sq_meters ? { area_sq_meters: feature.properties.area_sq_meters } : {}), responseData.sectors ? { sector: feature.properties.sector } : {});
    if (!responseData || !responseData.sectors || responseData.sectors.indexOf(feature.properties.sector) !== -1) {
      features.push(__spreadProps(__spreadValues({}, feature), {
        properties: newProperties
      }));
    } else {
    }
  }
  return __spreadProps(__spreadValues({}, collection), {
    features
  });
}
export {
  getAnswers,
  getDataForExport,
  normalizeSpatialProperties
};
/*! *****************************************************************************
Copyright (c) Microsoft Corporation.

Permission to use, copy, modify, and/or distribute this software for any
purpose with or without fee is hereby granted.

THE SOFTWARE IS PROVIDED "AS IS" AND THE AUTHOR DISCLAIMS ALL WARRANTIES WITH
REGARD TO THIS SOFTWARE INCLUDING ALL IMPLIED WARRANTIES OF MERCHANTABILITY
AND FITNESS. IN NO EVENT SHALL THE AUTHOR BE LIABLE FOR ANY SPECIAL, DIRECT,
INDIRECT, OR CONSEQUENTIAL DAMAGES OR ANY DAMAGES WHATSOEVER RESULTING FROM
LOSS OF USE, DATA OR PROFITS, WHETHER IN AN ACTION OF CONTRACT, NEGLIGENCE OR
OTHER TORTIOUS ACTION, ARISING OUT OF OR IN CONNECTION WITH THE USE OR
PERFORMANCE OF THIS SOFTWARE.
***************************************************************************** */
