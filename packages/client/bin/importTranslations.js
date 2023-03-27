#!/usr/bin/env node
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
        while (g && (g = 0, op[0] && (_ = 0)), _) try {
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
/* eslint-disable i18next/no-literal-string */
var request = require("request");
var fs = require("fs");
var path = require("path");
var util = require("util");
var post = util.promisify(request.post);
var get = util.promisify(request.get);
var INCLUDE_EMPTY_TERMS = false;
(function () { return __awaiter(void 0, void 0, void 0, function () {
    var namespaces, res, data, terms, _a, statusCode, body, languages, _i, _b, lang, basePath, _c, statusCode_1, body_1, translations, translated, _d, namespaces_1, namespace, translatedTerms, _e, terms_1, term;
    return __generator(this, function (_f) {
        switch (_f.label) {
            case 0:
                namespaces = [];
                fs.readdirSync(path.join(__dirname, "../src/lang/en")).forEach(function (file) {
                    if (!/admin/.test(path.basename(file, ".json"))) {
                        namespaces.push(path.basename(file, ".json"));
                    }
                });
                return [4 /*yield*/, post("https://api.poeditor.com/v2/terms/list", {
                        form: {
                            api_token: process.env.POEDITOR_API_TOKEN,
                            id: process.env.POEDITOR_PROJECT,
                            language: "en",
                        },
                    })];
            case 1:
                res = _f.sent();
                data = JSON.parse(res.body);
                if (data.response.status !== "success") {
                    throw new Error("API response was ".concat(data.response.status));
                }
                terms = data.result.terms;
                terms.sort(function (a, b) { return a.term.localeCompare(b.term); });
                console.log("Publishing namespaces ".concat(namespaces.join(", ")));
                return [4 /*yield*/, post("https://api.poeditor.com/v2/languages/list", {
                        form: {
                            api_token: process.env.POEDITOR_API_TOKEN,
                            id: process.env.POEDITOR_PROJECT,
                        },
                    })];
            case 2:
                _a = _f.sent(), statusCode = _a.statusCode, body = _a.body;
                data = JSON.parse(body);
                if (data.response.status !== "success") {
                    throw new Error("API response was ".concat(data.response.status));
                }
                languages = data.result.languages;
                _i = 0, _b = languages.filter(function (l) { return l.code !== "en"; });
                _f.label = 3;
            case 3:
                if (!(_i < _b.length)) return [3 /*break*/, 8];
                lang = _b[_i];
                if (!(lang.percentage === 0)) return [3 /*break*/, 4];
                console.log("Skipping ".concat(lang.name, " (").concat(lang.percentage, "% translated)"));
                return [3 /*break*/, 7];
            case 4:
                console.log("Importing ".concat(lang.name, " (").concat(lang.percentage, "% translated)"));
                basePath = path.join(__dirname, "../src/lang", lang.code);
                if (fs.existsSync(basePath)) {
                    // @ts-ignore
                    fs.rmSync(basePath, { recursive: true, force: true });
                }
                return [4 /*yield*/, post("https://api.poeditor.com/v2/projects/export", {
                        form: {
                            api_token: process.env.POEDITOR_API_TOKEN,
                            id: process.env.POEDITOR_PROJECT,
                            language: lang.code,
                            type: "key_value_json",
                            filters: "translated",
                            order: "terms",
                        },
                    })];
            case 5:
                _c = _f.sent(), statusCode_1 = _c.statusCode, body_1 = _c.body;
                data = JSON.parse(body_1);
                if (data.response.status !== "success") {
                    throw new Error("API response was ".concat(data.response.status));
                }
                return [4 /*yield*/, get(data.result.url)];
            case 6:
                translations = _f.sent();
                translated = JSON.parse(translations.body);
                fs.mkdirSync(basePath);
                for (_d = 0, namespaces_1 = namespaces; _d < namespaces_1.length; _d++) {
                    namespace = namespaces_1[_d];
                    translatedTerms = {};
                    for (_e = 0, terms_1 = terms; _e < terms_1.length; _e++) {
                        term = terms_1[_e];
                        if ((translated[term.term] || INCLUDE_EMPTY_TERMS) &&
                            term.tags.indexOf(namespace) !== -1) {
                            translatedTerms[term.term] = translated[term.term] || "";
                        }
                    }
                    if (Object.keys(translatedTerms).length) {
                        fs.writeFileSync(path.join(basePath, "".concat(namespace, ".json")), JSON.stringify(translatedTerms, null, "  "));
                    }
                }
                _f.label = 7;
            case 7:
                _i++;
                return [3 /*break*/, 3];
            case 8: return [2 /*return*/];
        }
    });
}); })();
