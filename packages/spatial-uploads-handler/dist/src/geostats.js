"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
function geostats(json, layerName) {
    var layer = {
        layer: layerName,
        count: 0,
        geometry: isFeatureCollection(json)
            ? json.features[0].geometry.type
            : json.geometry.type,
        attributeCount: 0,
        attributes: [],
    };
    var attributeData = {};
    var attributeValues = {};
    function addFeature(feature) {
        if (layer.geometry !== feature.geometry.type) {
            if (layer.geometry === "Polygon" &&
                feature.geometry.type === "MultiPolygon") {
                layer.geometry = "MultiPolygon";
            }
            else if (layer.geometry === "LineString" &&
                feature.geometry.type === "MultiLineString") {
                layer.geometry = "MultiLineString";
            }
            else if (layer.geometry === "Point" &&
                feature.geometry.type === "MultiPoint") {
                layer.geometry = "MultiPoint";
            }
        }
        layer.count++;
        for (var propName in feature.properties) {
            var value = feature.properties[propName];
            if (!(propName in attributeData)) {
                var type_1 = attributeType(value);
                attributeData[propName] = {
                    attribute: propName,
                    count: 0,
                    values: [],
                    type: type_1,
                    max: type_1 === "number" ? value : undefined,
                    min: type_1 === "number" ? value : undefined,
                };
            }
            var attr = attributeData[propName];
            var type = attributeType(value);
            if (type !== attr.type && type !== "null") {
                console.log("found non matching type", attr.type, type);
                attr.type = "mixed";
            }
            if (attr.type !== "object" && attr.type !== "array") {
                if (!(propName in attributeValues)) {
                    attributeValues[propName] = new Set();
                }
                if (attributeValues[propName].size < 1000) {
                    attributeValues[propName].add(value);
                }
                if (attr.type === "number") {
                    if (!attr.max || value > attr.max) {
                        attr.max = value;
                    }
                    if (!attr.min || value < attr.min) {
                        attr.min = value;
                    }
                }
            }
        }
    }
    if (isFeatureCollection(json)) {
        for (var _i = 0, _a = json.features; _i < _a.length; _i++) {
            var feature = _a[_i];
            addFeature(feature);
        }
    }
    else {
        addFeature(json);
    }
    layer.attributes = Object.values(attributeData);
    for (var _b = 0, _c = layer.attributes; _b < _c.length; _b++) {
        var attr = _c[_b];
        var values = attributeValues[attr.attribute];
        if (values) {
            attr.count = values.size;
            attr.values = Array.from(values);
        }
    }
    layer.attributeCount = layer.attributes.length;
    return layer;
}
exports.default = geostats;
function isFeatureCollection(json) {
    return json.type === "FeatureCollection";
}
function attributeType(value) {
    if (value === null) {
        return "null";
    }
    switch (typeof value) {
        case "string":
            return "string";
        case "boolean":
            return "boolean";
        case "bigint":
        case "number":
            return "number";
        case "object":
            if (Array.isArray(value)) {
                return "array";
            }
            else {
                return "object";
            }
        default:
            throw new Error("Unrecognized attribute type " + typeof value);
    }
}
