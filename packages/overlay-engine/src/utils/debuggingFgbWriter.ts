import gdal from "gdal-async";
import {
  Feature,
  Geometry,
  Point,
  LineString,
  Polygon,
  MultiPoint,
  MultiLineString,
  MultiPolygon,
  GeometryCollection,
} from "geojson";

export interface FieldDefinition {
  name: string;
  type: "string" | "integer" | "real" | "date" | "time" | "datetime";
  width?: number;
  precision?: number;
}

export class DebuggingFgbWriter {
  private writer: gdal.Dataset;
  private layer: gdal.Layer;
  private fieldDefinitions: FieldDefinition[];
  private fieldIndexMap: Map<string, number>;

  constructor(
    path: string,
    fields: FieldDefinition[],
    layerName: string = "layer"
  ) {
    this.fieldDefinitions = fields;
    this.fieldIndexMap = new Map();

    try {
      // Create the dataset with FlatGeobuf driver
      this.writer = gdal.open(path, "w", "FlatGeobuf");

      // Create a spatial reference system (WGS84)
      const srs = new gdal.SpatialReference();
      // Note: Using a simple approach for SRS - may need adjustment based on actual GDAL API

      // Create the layer with unknown geometry type initially
      this.layer = this.writer.layers.create(layerName, srs, gdal.wkbUnknown);

      // Add fields to the layer
      fields.forEach((field, index) => {
        const gdalType = this.convertFieldTypeToGdal(field.type);
        const fieldDefn = new gdal.FieldDefn(field.name, gdalType);

        // Set field properties if available
        if (field.width && typeof fieldDefn.width !== "undefined") {
          (fieldDefn as any).width = field.width;
        }
        if (field.precision && typeof fieldDefn.precision !== "undefined") {
          (fieldDefn as any).precision = field.precision;
        }

        this.layer.fields.add(fieldDefn);
        this.fieldIndexMap.set(field.name, index);
      });
    } catch (error) {
      throw new Error(
        `Failed to initialize FGB writer: ${
          error instanceof Error ? error.message : String(error)
        }`
      );
    }
  }

  private convertFieldTypeToGdal(type: FieldDefinition["type"]): any {
    // Using any to avoid type conflicts with GDAL constants
    switch (type) {
      case "string":
        return (gdal as any).OFTString;
      case "integer":
        return (gdal as any).OFTInteger;
      case "real":
        return (gdal as any).OFTReal;
      case "date":
        return (gdal as any).OFTDate;
      case "time":
        return (gdal as any).OFTTime;
      case "datetime":
        return (gdal as any).OFTDateTime;
      default:
        return (gdal as any).OFTString;
    }
  }

  private convertGeoJsonGeometryToGdal(geometry: Geometry): any {
    return gdal.Geometry.fromGeoJson(geometry);
  }

  private validateFeatureProperties(feature: Feature<any>): void {
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
            throw new Error(
              `Field ${field.name} must be a string, got ${typeof value}`
            );
          }
          if (field.width && value.length > field.width) {
            throw new Error(
              `Field ${field.name} exceeds maximum width of ${field.width}`
            );
          }
          break;

        case "integer":
          if (!Number.isInteger(value)) {
            throw new Error(
              `Field ${field.name} must be an integer, got ${typeof value}`
            );
          }
          break;

        case "real":
          if (typeof value !== "number" || isNaN(value)) {
            throw new Error(
              `Field ${field.name} must be a valid number, got ${typeof value}`
            );
          }
          break;

        case "date":
        case "time":
        case "datetime":
          if (!(value instanceof Date) && typeof value !== "string") {
            throw new Error(
              `Field ${
                field.name
              } must be a Date or string, got ${typeof value}`
            );
          }
          break;
      }
    }
  }

  addFeature(feature: Feature<any>): void {
    try {
      // Validate the feature properties against the schema
      this.validateFeatureProperties(feature);

      // Create a new GDAL feature using the layer
      const gdalFeature = new (gdal as any).Feature(this.layer);

      // Set the geometry
      if (feature.geometry) {
        const gdalGeometry = this.convertGeoJsonGeometryToGdal(
          feature.geometry
        );
        gdalFeature.setGeometry(gdalGeometry);
      }

      // Set the properties
      const properties = feature.properties || {};
      for (const [fieldName, value] of Object.entries(properties)) {
        const fieldIndex = this.fieldIndexMap.get(fieldName);
        if (fieldIndex !== undefined) {
          const field = this.fieldDefinitions[fieldIndex];

          // Convert value to appropriate GDAL format
          let gdalValue: any = value;
          if (
            field.type === "date" ||
            field.type === "time" ||
            field.type === "datetime"
          ) {
            if (typeof value === "string") {
              gdalValue = new Date(value);
            } else {
              gdalValue = value;
            }
          }

          gdalFeature.fields.set(fieldIndex, gdalValue);
        }
      }

      // Add the feature to the layer
      this.layer.features.add(gdalFeature);
    } catch (error) {
      throw new Error(
        `Failed to add feature: ${
          error instanceof Error ? error.message : String(error)
        }`
      );
    }
  }

  async close(): Promise<void> {
    try {
      // Close the dataset (layer will be closed automatically)
      if (this.writer) {
        await this.writer.close();
      }
    } catch (error) {
      throw new Error(
        `Failed to close FGB writer: ${
          error instanceof Error ? error.message : String(error)
        }`
      );
    }
  }

  /**
   * Get statistics about the written features
   */
  getStats(): { featureCount: number; fieldCount: number } {
    return {
      featureCount: this.layer.features.count(),
      fieldCount: this.fieldDefinitions.length,
    };
  }
}
