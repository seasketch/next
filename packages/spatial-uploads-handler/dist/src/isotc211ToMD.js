"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __generator = (this && this.__generator) || function (thisArg, body) {
    var _ = { label: 0, sent: function() { if (t[0] & 1) throw t[1]; return t[1]; }, trys: [], ops: [] }, f, y, t, g;
    return g = { next: verb(0), "throw": verb(1), "return": verb(2) }, typeof Symbol === "function" && (g[Symbol.iterator] = function() { return this; }), g;
    function verb(n) { return function (v) { return step([n, v]); }; }
    function step(op) {
        if (f) throw new TypeError("Generator is already executing.");
        while (_) try {
            if (f = 1, y && (t = op[0] & 2 ? y["return"] : op[0] ? y["throw"] || ((t = y["return"]) && t.call(y), 0) : y.next) && !(t = t.call(y, op[1])).done) return t;
            if (y = 0, t) op = [op[0] & 2, t.value];
            switch (op[0]) {
                case 0: case 1: t = op; break;
                case 4: _.label++; return { value: op[1], done: false };
                case 5: _.label++; y = op[1]; op = [0]; continue;
                case 7: op = _.ops.pop(); _.trys.pop(); continue;
                default:
                    if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) { _ = 0; continue; }
                    if (op[0] === 3 && (!t || (op[1] > t[0] && op[1] < t[3]))) { _.label = op[1]; break; }
                    if (op[0] === 6 && _.label < t[1]) { _.label = t[1]; t = op; break; }
                    if (t && _.label < t[2]) { _.label = t[2]; _.ops.push(op); break; }
                    if (t[2]) _.ops.pop();
                    _.trys.pop(); continue;
            }
            op = body.call(thisArg, _);
        } catch (e) { op = [6, e]; y = 0; } finally { f = t = 0; }
        if (op[0] & 5) throw op[1]; return { value: op[0] ? op[1] : void 0, done: true };
    }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.convertXmlToMarkdown = void 0;
var xml2js_1 = require("xml2js");
var markdown_builder_1 = require("markdown-builder");
// Set of blacklisted properties that should not be included in the Markdown output
var blacklist = new Set([
// Add XML properties to blacklist here, e.g.:
// 'gmd:fileIdentifier',
// 'gmd:language'
]);
// Function to recursively convert the parsed XML data into Markdown content
function convertObjectToMarkdown(obj, level) {
    if (level === void 0) { level = 1; }
    var doc = new markdown_builder_1.Document();
    var _loop_1 = function (key) {
        if (blacklist.has(key)) {
            return "continue";
        }
        var value = obj[key];
        if (typeof value === "object" && !Array.isArray(value)) {
            // Handle nested objects
            doc.add(new markdown_builder_1.Heading(level, key.replace(/^gmd:/, "").replace(/_/g, " ")));
            doc.add(new markdown_builder_1.Paragraph(convertObjectToMarkdown(value, level + 1)));
        }
        else if (Array.isArray(value)) {
            // Handle arrays of objects or values
            value.forEach(function (item, index) {
                doc.add(new markdown_builder_1.Heading(level, key.replace(/^gmd:/, "").replace(/_/g, " ") + " [" + (index + 1) + "]"));
                doc.add(new markdown_builder_1.Paragraph(convertObjectToMarkdown(item, level + 1)));
            });
        }
        else {
            // Handle simple key-value pairs
            doc.add(new markdown_builder_1.Paragraph(key.replace(/^gmd:/, "").replace(/_/g, " ") + ": " + value));
        }
    };
    for (var key in obj) {
        _loop_1(key);
    }
    return doc.toString();
}
// Function to validate if the XML string is ISO 19139 Metadata
function isISO19139Metadata(parsedData) {
    var _a;
    return (parsedData.hasOwnProperty("gmd:MD_Metadata") &&
        ((_a = parsedData["gmd:MD_Metadata"]) === null || _a === void 0 ? void 0 : _a.hasOwnProperty("$")) &&
        parsedData["gmd:MD_Metadata"]["$"].hasOwnProperty("xmlns:gmd") &&
        parsedData["gmd:MD_Metadata"]["$"]["xmlns:gmd"] ===
            "http://www.isotc211.org/2005/gmd");
}
// Function to convert the XML string into a Markdown string
function convertXmlToMarkdown(xmlString) {
    return __awaiter(this, void 0, void 0, function () {
        var parsedData, markdownContent, error_1;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    _a.trys.push([0, 2, , 3]);
                    return [4 /*yield*/, xml2js_1.parseStringPromise(xmlString)];
                case 1:
                    parsedData = _a.sent();
                    if (!isISO19139Metadata(parsedData)) {
                        throw new Error("The provided XML is not ISO 19139 Metadata.");
                    }
                    markdownContent = convertObjectToMarkdown(parsedData);
                    return [2 /*return*/, markdownContent];
                case 2:
                    error_1 = _a.sent();
                    throw new Error("Error processing XML: " + error_1.message);
                case 3: return [2 /*return*/];
            }
        });
    });
}
exports.convertXmlToMarkdown = convertXmlToMarkdown;
