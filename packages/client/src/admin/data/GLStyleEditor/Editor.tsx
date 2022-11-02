import CodeMirror from "@uiw/react-codemirror";
import { json, jsonParseLinter, jsonLanguage } from "@codemirror/lang-json";
import { sublime } from "@uiw/codemirror-theme-sublime";
import { linter, lintGutter } from "@codemirror/lint";
import { color } from "./extensions/glStyleColor";
import {
  glStyleLinter,
  validateGLStyleFragment,
} from "./extensions/glStyleValidator";
import { glStyleAutocomplete } from "./extensions/glStyleAutocomplete";
import { useState } from "react";
import { useDebouncedFn } from "beautiful-react-hooks";

interface GLStyleEditorProps {
  initialStyle?: string;
  onChange?: (newStyle: string) => void;
  dataLayerId?: number;
}

const jsonCompletions = jsonLanguage.data.of({
  autocomplete: glStyleAutocomplete,
});

const extensions = [
  json(),
  jsonCompletions,
  lintGutter(),
  linter(jsonParseLinter()),
  glStyleLinter,
  color,
];

/**
 * This is an uncontrolled component. Changes to initialStyle after initial rendering will not
 * change the value of the editor.
 * @param props
 * @returns
 */
export default function GLStyleEditor(props: GLStyleEditorProps) {
  const [value] = useState(props.initialStyle);
  const onChange = useDebouncedFn(props.onChange || (() => {}), 100, {});

  return (
    <CodeMirror
      className="rounded-md overflow-hidden"
      value={value}
      theme={sublime}
      extensions={extensions}
      onChange={(value, viewUpdate) => {
        try {
          const errors = validateGLStyleFragment(JSON.parse(value));
          if (errors.length === 0) {
            if (props.onChange) {
              onChange(value);
            }
          } else {
          }
        } catch (e) {
          // probably a json parse error
          // Styles with errors should not be saved
        }
      }}
    />
  );
}
