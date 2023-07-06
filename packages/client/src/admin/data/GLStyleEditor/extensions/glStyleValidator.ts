/* eslint-disable i18next/no-literal-string */
import { Diagnostic, linter } from "@codemirror/lint";
import { validateGLStyleFragment } from "./validateGLStyleFragment";
const jsonSourceMap = require("json-source-map");

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
