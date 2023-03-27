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
(function () { return __awaiter(void 0, void 0, void 0, function () {
    var namespaces, res, data, terms, termsToAdd, termsToUpdate, _i, namespaces_1, namespace, data_1, _loop_1, key, _a, terms_1, term, updated, data_2, _b, statusCode, body, data_3, translations;
    return __generator(this, function (_c) {
        switch (_c.label) {
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
                res = _c.sent();
                data = JSON.parse(res.body);
                if (data.response.status !== "success") {
                    throw new Error("API response was ".concat(data.response.status));
                }
                terms = data.result.terms;
                console.log("Publishing namespaces ".concat(namespaces.join(", ")));
                termsToAdd = [];
                termsToUpdate = [];
                for (_i = 0, namespaces_1 = namespaces; _i < namespaces_1.length; _i++) {
                    namespace = namespaces_1[_i];
                    data_1 = JSON.parse(fs
                        .readFileSync(path.join(__dirname, "../src/lang/en/".concat(namespace, ".json")))
                        .toString());
                    _loop_1 = function (key) {
                        var existing = terms.find(function (t) { return t.term === key; });
                        if (existing) {
                            existing.obsolete = false;
                            if (existing.tags.indexOf(namespace) === -1) {
                                existing.tags.push(namespace);
                                termsToUpdate.push(existing);
                            }
                        }
                        else {
                            termsToAdd.push({
                                term: key,
                                english: data_1[key],
                                tags: [namespace],
                            });
                        }
                    };
                    for (key in data_1) {
                        _loop_1(key);
                    }
                }
                for (_a = 0, terms_1 = terms; _a < terms_1.length; _a++) {
                    term = terms_1[_a];
                    if (term.obsolete !== false) {
                        term.tags.push("obsolete");
                        termsToUpdate.push(term);
                    }
                    else if (term.obsolete === false &&
                        term.tags.indexOf("obsolete") !== -1) {
                        term.tags = term.tags.filter(function (t) { return t !== "obsolete"; });
                        termsToUpdate.push(term);
                    }
                }
                if (!termsToUpdate.length) return [3 /*break*/, 3];
                return [4 /*yield*/, post("https://api.poeditor.com/v2/terms/update", {
                        form: {
                            api_token: process.env.POEDITOR_API_TOKEN,
                            id: process.env.POEDITOR_PROJECT,
                            data: JSON.stringify(termsToUpdate),
                        },
                    })];
            case 2:
                updated = _c.sent();
                data_2 = JSON.parse(updated.body);
                if (data_2.response.status !== "success") {
                    throw new Error("API response was ".concat(data_2.response.status));
                }
                else {
                    console.log("updated ".concat(data_2.result.terms.updated, " terms"));
                }
                _c.label = 3;
            case 3:
                if (!termsToAdd.length) return [3 /*break*/, 6];
                return [4 /*yield*/, post("https://api.poeditor.com/v2/terms/add", {
                        form: {
                            api_token: process.env.POEDITOR_API_TOKEN,
                            id: process.env.POEDITOR_PROJECT,
                            data: JSON.stringify(termsToAdd),
                        },
                    })];
            case 4:
                _b = _c.sent(), statusCode = _b.statusCode, body = _b.body;
                data_3 = JSON.parse(body);
                if (data_3.response.status !== "success") {
                    throw new Error("API response was ".concat(data_3.response.status, ". ").concat(data_3.response.message));
                }
                else {
                    console.log("added ".concat(data_3.result.terms.added, " terms"));
                }
                return [4 /*yield*/, post("https://api.poeditor.com/v2/translations/add", {
                        form: {
                            api_token: process.env.POEDITOR_API_TOKEN,
                            id: process.env.POEDITOR_PROJECT,
                            language: "en",
                            data: JSON.stringify(termsToAdd
                                .filter(function (t) { var _a; return (_a = t.english) === null || _a === void 0 ? void 0 : _a.length; })
                                .map(function (t) { return ({
                                term: t.term,
                                translation: {
                                    content: t.english,
                                },
                            }); })),
                        },
                    })];
            case 5:
                translations = _c.sent();
                data_3 = JSON.parse(translations.body);
                if (data_3.response.status !== "success") {
                    throw new Error("API response was ".concat(data_3.response.status));
                }
                else {
                    console.log("added default en translations for ".concat(data_3.result.translations.added, " terms"));
                }
                _c.label = 6;
            case 6:
                if (termsToAdd.length === 0 && termsToUpdate.length === 0) {
                    console.log("No new or updated terms.");
                }
                return [2 /*return*/];
        }
    });
}); })();
