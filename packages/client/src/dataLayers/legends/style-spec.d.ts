declare module "mapbox-gl/dist/style-spec/index.es.js" {
  import { Feature } from "geojson";

  export namespace expression {
    export type FeatureState = { [key: string]: any };

    export type GlobalProperties = Readonly<{
      zoom: number;
      heatmapDensity?: number;
      lineProgress?: number;
      isSupportedScript?: (script: string) => boolean;
      accumulated?: any;
    }>;

    interface StyleExpression {
      expression: any;

      evaluate(
        globals: GlobalProperties,
        feature?: Feature,
        featureState?: FeatureState
      ): any;
      evaluateWithoutErrorHandling(
        globals: GlobalProperties,
        feature?: Feature,
        featureState?: FeatureState
      ): any;
    }

    export interface ParseResultSuccess {
      result: "success";
      value: StyleExpression;
    }
    export interface ParsingError extends Error {
      key: string;
      message: string;
    }
    export interface ParseResultError {
      result: "error";
      value: ParsingError[];
    }
    export type ParseResult = ParseResultSuccess | ParseResultError;

    export type StylePropertyType =
      | "color"
      | "string"
      | "number"
      | "enum"
      | "boolean"
      | "formatted"
      | "image";

    export interface StylePropertySpecification {
      type: StylePropertyType;
    }

    export function createExpression(
      expr: any,
      propertySpec?: StylePropertySpecification
    ): ParseResult;
  }
}
