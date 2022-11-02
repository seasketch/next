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
      return [];
    }
  } else {
    return [new Error("Root element must be an array of 1 or more layers")];
  }
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
    const [prefix, message] = styleErrorMessage.split(":");
    const sourceMapKey = prefix
      .replace("layers", "")
      .replace(/\[(\d+)\]/g, "/$1")
      .replace(/\./g, "/");
    return {
      sourceMapKey,
      message,
    };
  } else {
    return { message: styleErrorMessage };
  }
}
