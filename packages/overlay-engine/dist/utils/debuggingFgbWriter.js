"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.DebuggingFgbWriter = void 0;
const gdal_async_1 = __importDefault(require("gdal-async"));
class DebuggingFgbWriter {
    constructor(path, fields, layerName = "layer") {
        this.fieldDefinitions = fields;
        this.fieldIndexMap = new Map();
        try {
            // Create the dataset with FlatGeobuf driver
            this.writer = gdal_async_1.default.open(path, "w", "FlatGeobuf");
            // Create a spatial reference system (WGS84)
            const srs = new gdal_async_1.default.SpatialReference();
            // Note: Using a simple approach for SRS - may need adjustment based on actual GDAL API
            // Create the layer with unknown geometry type initially
            this.layer = this.writer.layers.create(layerName, srs, gdal_async_1.default.wkbUnknown);
            // Add fields to the layer
            fields.forEach((field, index) => {
                const gdalType = this.convertFieldTypeToGdal(field.type);
                const fieldDefn = new gdal_async_1.default.FieldDefn(field.name, gdalType);
                // Set field properties if available
                if (field.width && typeof fieldDefn.width !== "undefined") {
                    fieldDefn.width = field.width;
                }
                if (field.precision && typeof fieldDefn.precision !== "undefined") {
                    fieldDefn.precision = field.precision;
                }
                this.layer.fields.add(fieldDefn);
                this.fieldIndexMap.set(field.name, index);
            });
        }
        catch (error) {
            throw new Error(`Failed to initialize FGB writer: ${error instanceof Error ? error.message : String(error)}`);
        }
    }
    convertFieldTypeToGdal(type) {
        // Using any to avoid type conflicts with GDAL constants
        switch (type) {
            case "string":
                return gdal_async_1.default.OFTString;
            case "integer":
                return gdal_async_1.default.OFTInteger;
            case "real":
                return gdal_async_1.default.OFTReal;
            case "date":
                return gdal_async_1.default.OFTDate;
            case "time":
                return gdal_async_1.default.OFTTime;
            case "datetime":
                return gdal_async_1.default.OFTDateTime;
            default:
                return gdal_async_1.default.OFTString;
        }
    }
    convertGeoJsonGeometryToGdal(geometry) {
        return gdal_async_1.default.Geometry.fromGeoJson(geometry);
    }
    validateFeatureProperties(feature) {
        const properties = feature.properties || {};
        // Check for required fields
        for (const field of this.fieldDefinitions) {
            if (!(field.name in properties)) {
                throw new Error(`Missing required field: ${field.name}`);
            }
            const value = properties[field.name];
            // Type validation
            switch (field.type) {
                case "string":
                    if (typeof value !== "string") {
                        throw new Error(`Field ${field.name} must be a string, got ${typeof value}`);
                    }
                    if (field.width && value.length > field.width) {
                        throw new Error(`Field ${field.name} exceeds maximum width of ${field.width}`);
                    }
                    break;
                case "integer":
                    if (!Number.isInteger(value)) {
                        throw new Error(`Field ${field.name} must be an integer, got ${typeof value}`);
                    }
                    break;
                case "real":
                    if (typeof value !== "number" || isNaN(value)) {
                        throw new Error(`Field ${field.name} must be a valid number, got ${typeof value}`);
                    }
                    break;
                case "date":
                case "time":
                case "datetime":
                    if (!(value instanceof Date) && typeof value !== "string") {
                        throw new Error(`Field ${field.name} must be a Date or string, got ${typeof value}`);
                    }
                    break;
            }
        }
    }
    addFeature(feature) {
        try {
            // Validate the feature properties against the schema
            this.validateFeatureProperties(feature);
            // Create a new GDAL feature using the layer
            const gdalFeature = new gdal_async_1.default.Feature(this.layer);
            // Set the geometry
            if (feature.geometry) {
                const gdalGeometry = this.convertGeoJsonGeometryToGdal(feature.geometry);
                gdalFeature.setGeometry(gdalGeometry);
            }
            // Set the properties
            const properties = feature.properties || {};
            for (const [fieldName, value] of Object.entries(properties)) {
                const fieldIndex = this.fieldIndexMap.get(fieldName);
                if (fieldIndex !== undefined) {
                    const field = this.fieldDefinitions[fieldIndex];
                    // Convert value to appropriate GDAL format
                    let gdalValue = value;
                    if (field.type === "date" ||
                        field.type === "time" ||
                        field.type === "datetime") {
                        if (typeof value === "string") {
                            gdalValue = new Date(value);
                        }
                        else {
                            gdalValue = value;
                        }
                    }
                    gdalFeature.fields.set(fieldIndex, gdalValue);
                }
            }
            // Add the feature to the layer
            this.layer.features.add(gdalFeature);
        }
        catch (error) {
            throw new Error(`Failed to add feature: ${error instanceof Error ? error.message : String(error)}`);
        }
    }
    async close() {
        try {
            // Close the dataset (layer will be closed automatically)
            if (this.writer) {
                await this.writer.close();
            }
        }
        catch (error) {
            throw new Error(`Failed to close FGB writer: ${error instanceof Error ? error.message : String(error)}`);
        }
    }
    /**
     * Get statistics about the written features
     */
    getStats() {
        return {
            featureCount: this.layer.features.count(),
            fieldCount: this.fieldDefinitions.length,
        };
    }
}
exports.DebuggingFgbWriter = DebuggingFgbWriter;
//# sourceMappingURL=debuggingFgbWriter.js.map