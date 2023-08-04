import { EditorView, KeyBinding } from "@codemirror/view";
import prettier from "prettier/standalone";
import babel from "prettier/parser-babel";
import {
  RawSourceMap,
  SourceMapConsumer,
  SourceMapGenerator,
} from "source-map";
import parse from "json-to-ast";

/**
 * Formats the JSON in the editor using prettier and creates a source map
 * so that the cursor position is preserved.
 * @param view
 * @returns
 */
export function formatJSONCommand(view: EditorView) {
  try {
    const jsonString = view.state.toJSON().doc;
    const originalAst = parse(jsonString);
    const parsed = JSON.parse(jsonString);
    const formatted = formatGLStyle(JSON.stringify(parsed));
    const formattedAst = parse(formatted);

    const sourceMapGenerator = new SourceMapGenerator({
      file: "formatted.json",
    });

    function addMappingsFromAST(originalNode: any, formattedNode: any) {
      if (originalNode.loc && formattedNode.loc) {
        const originalPos = originalNode.loc.start;
        const formattedPos = formattedNode.loc.start;

        sourceMapGenerator.addMapping({
          source: "input.json",
          original: { line: originalPos.line, column: originalPos.column },
          generated: { line: formattedPos.line, column: formattedPos.column },
        });
      }

      if (
        "value" in originalNode &&
        typeof originalNode.value === "object" &&
        "value" in formattedNode &&
        typeof formattedNode.value === "object"
      ) {
        addMappingsFromAST(originalNode.value, formattedNode.value);
      }

      if ("children" in originalNode && "children" in formattedNode) {
        const originalChildren = originalNode.children;
        const formattedChildren = formattedNode.children;
        for (
          let i = 0;
          i < originalChildren.length && i < formattedChildren.length;
          i++
        ) {
          addMappingsFromAST(originalChildren[i], formattedChildren[i]);
        }
      }
    }

    addMappingsFromAST(originalAst, formattedAst);
    const sourceMap = sourceMapGenerator.toString();
    const sourceMapConsumer = new SourceMapConsumer(
      sourceMap as unknown as RawSourceMap
    );

    const lineAt = view.state.doc.lineAt(view.state.selection.main.head);
    const originalPosition = {
      line: lineAt.number,
      column: 1 + (view.state.selection.ranges[0].head - lineAt.from),
    };

    const newPosition = sourceMapConsumer.generatedPositionFor({
      source: "input.json",
      line: originalPosition.line,
      column: originalPosition.column,
    });

    view.coordsAtPos(view.state.selection.main.head);
    const lines = formatted.split("\n");
    const charsToLine = lines.slice(0, newPosition.line - 1).join("\n").length;
    const newSelection = charsToLine + newPosition.column;

    view.dispatch(
      view.state.update({
        changes: {
          from: 0,
          to: view.state.doc.length,
          insert: formatted,
        },
        selection: { anchor: newSelection },
      })
    );
  } catch (e) {
    console.error(e);
    // do nothing. let linter handle it
  }
  return true;
}

export const formatJSONKeyBinding: KeyBinding = {
  key: "Mod-f",
  run: formatJSONCommand,
  preventDefault: true,
};

export function formatGLStyle(style: string) {
  return prettier.format(style, {
    parser: "json",
    plugins: [babel],
    printWidth: 50,
  });
}
