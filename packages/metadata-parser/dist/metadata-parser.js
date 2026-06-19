"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.metadataToProseMirror = metadataToProseMirror;
// @ts-ignore
const xml2js_1 = require("xml2js");
const fgdcToProsemirror_1 = require("./fgdcToProsemirror");
const iso19139ToProseMirror_1 = require("./iso19139ToProseMirror");
async function metadataToProseMirror(xmlString) {
    try {
        const data = await (0, xml2js_1.parseStringPromise)(xmlString);
        if (data["gmd:MD_Metadata"]) {
            return (0, iso19139ToProseMirror_1.iso19139ToProseMirror)(data);
        }
        else if (data["metadata"] && data["metadata"]["idinfo"]) {
            return (0, fgdcToProsemirror_1.fgdcToProseMirror)(data);
        }
        else {
            return null;
        }
    }
    catch (error) {
        throw new Error(`Error processing XML: ${error.message}`);
    }
}
//# sourceMappingURL=metadata-parser.js.map