/* eslint-disable i18next/no-literal-string */
import { validate } from "@mapbox/mapbox-gl-style-spec";
import { Diagnostic, linter } from "@codemirror/lint";
const jsonSourceMap = require("json-source-map");

export function validateGLStyleFragment(layers: any) {
  if (Array.isArray(layers) && layers.length > 0) {
    let errors = validate({
      version: 8,
      name: "SeaSketch",
      glyphs: "https://seasketch/{range}/{fontstack}",
      layers: layers.map((layer: any, index: number) => ({
        ...layer,
        source: "1",
        "source-layer": "mock",
        id: index.toString(),
      })),
      sources: { 1: { type: "vector" } },
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

export const glStyleLinter = linter((view) => {
  let diagnostics: Diagnostic[] = [];
  try {
    const doc = view.state.toJSON().doc;
    const sourceMap = jsonSourceMap.parse(doc);
    const layers = JSON.parse(view.state.toJSON().doc);
    const errors = validateGLStyleFragment(layers);
    if (errors.length) {
      for (const error of errors) {
        const { sourceMapKey, message } = parseErrorMessage(error.message);
        const pointer = sourceMapKey
          ? sourceMap.pointers[sourceMapKey]
          : undefined;
        if (pointer) {
          const isPropertyIssue = /property/.test(message);
          diagnostics.push({
            message,
            severity: "error",
            from: isPropertyIssue ? pointer.key.pos : pointer.value.pos,
            to: isPropertyIssue ? pointer.keyEnd.pos : pointer.valueEnd.pos,
          });
        } else {
          diagnostics.push({
            message,
            severity: "error",
            from: 0,
            to: doc.length - 1,
          });
        }
      }
    }
  } catch (e) {
    // Let json linter handle it if there is a problem parsing
  }
  return diagnostics;
});

function parseErrorMessage(styleErrorMessage: string): {
  sourceMapKey?: string;
  message: string;
} {
  if (/:/.test(styleErrorMessage)) {
    const parts = styleErrorMessage.split(":");
    const prefix = parts[0];
    const message = parts.slice(1).join(":");
    const sourceMapKey = prefix
      .replace("layers", "")
      .replace(/\[(\d+)\]/g, "/$1")
      .replace(/\./g, "/");
    return {
      sourceMapKey,
      message: message,
    };
  } else {
    return { message: styleErrorMessage };
  }
}
