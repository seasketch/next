import { expression } from "mapbox-gl/dist/style-spec/index.es.js";
import { Expression as MapboxExpression, StyleFunction } from "mapbox-gl";
import { Feature } from "geojson";

const expressionGlobals = {
  zoom: 14,
};

/** A color as returned by a Mapbox style expression. All values are in [0, 1] */
export interface RGBA {
  r: number;
  g: number;
  b: number;
  a: number;
}

interface TypeMap {
  string: string;
  number: number;
  color: RGBA;
  boolean: boolean;
  [other: string]: any;
}

// Copied from https://gist.github.com/danvk/4378b6936f9cd634fc8c9f69c4f18b81
/**
 * Class for working with Mapbox style expressions.
 *
 * See https://docs.mapbox.com/mapbox-gl-js/style-spec/#expressions
 */
export class ExpressionEvaluator<T> {
  /**
   * Parse a Mapbox style expression.
   *
   * Pass an expected type to get tigher error checking and more precise types.
   */
  static parse<T extends expression.StylePropertyType>(
    expr:
      | number
      | string
      | Readonly<StyleFunction>
      | Readonly<MapboxExpression>
      | undefined,
    expectedType?: T
  ): ExpressionEvaluator<TypeMap[T]> {
    // For details on use of this private API and plans to publicize it, see
    // https://github.com/mapbox/mapbox-gl-js/issues/7670
    let parseResult: expression.ParseResult;
    if (expectedType) {
      parseResult = expression.createExpression(expr, { type: expectedType });
      if (parseResult.result === "success") {
        return new ExpressionEvaluator<TypeMap[T]>(parseResult.value);
      }
    } else {
      parseResult = expression.createExpression(expr);
      if (parseResult.result === "success") {
        return new ExpressionEvaluator<any>(parseResult.value);
      }
    }

    throw parseResult.value[0];
  }

  constructor(public parsedExpression: expression.StyleExpression) {}

  evaluate(feature: Feature): T {
    return this.parsedExpression.evaluate(expressionGlobals, feature);
  }
}
