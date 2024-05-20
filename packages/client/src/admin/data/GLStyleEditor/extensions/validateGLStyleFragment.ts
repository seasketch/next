/* eslint-disable i18next/no-literal-string */
// Duplicated in packages/api/src/validatedGLStyleFragment.ts
// Don't forget to update both!
import { validate } from "@mapbox/mapbox-gl-style-spec";

export function validateGLStyleFragment(
  layers: any,
  type?: "vector" | "raster"
) {
  type = type || "vector";
  if (Array.isArray(layers) && layers.length > 0) {
    let errors = validate({
      version: 8,
      name: "SeaSketch",
      glyphs: "https://seasketch/{range}/{fontstack}",
      layers: layers.map((layer: any, index: number) => ({
        ...layer,
        source: type === "vector" ? "1" : "2",
        "source-layer": "mock",
        id: index.toString(),
      })),
      sources: {
        1: { type: "vector", tiles: [""] },
        2: { type: "raster", tiles: [""] },
      },
    });
    if (errors.length) {
      return errors;
    } else {
      return checkSeaSketchSpecificRules(layers, "");
    }
  } else {
    return [new Error("Root element must be an array of 1 or more layers")];
  }
}

const validSpriteRe = /^seasketch:\/\/sprites\/\d+$/;
const imageProps = [
  "icon-image",
  "background-pattern",
  "line-pattern",
  "fill-pattern",
  "fill-extrusion-pattern",
];

const disallowedLayerProps = ["id", "source", "source-layer"];

function checkSeaSketchSpecificRules(
  fragment: any,
  path: string,
  errors?: Error[]
): Error[] {
  if (!errors) {
    errors = [];
    for (const layer of fragment as any[]) {
      for (const key of disallowedLayerProps) {
        if (key in layer) {
          errors.push(
            new Error(
              `layers[${fragment.indexOf(
                layer
              )}].${key}: ${key} property is not allowed. It will be automatically populated by SeaSketch.`
            )
          );
        }
      }
      checkSeaSketchSpecificRules(
        layer,
        `layers[${fragment.indexOf(layer)}]`,
        errors
      );
    }
  } else {
    if (typeof fragment === "object") {
      for (const key in fragment) {
        if (typeof fragment[key] === "object") {
          checkSeaSketchSpecificRules(fragment[key], path + "." + key, errors);
        } else if (
          typeof fragment[key] === "string" &&
          imageProps.indexOf(key) !== -1
        ) {
          if (!validSpriteRe.test(fragment[key])) {
            errors.push(
              new Error(
                `${path}.${key}: Sprite properties must be in the form of "seasketch://sprites/ID". ID must be numeric.`
              )
            );
          }
        }
      }
    }
  }
  return errors;
}
