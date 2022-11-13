/* eslint-disable i18next/no-literal-string */
import CodeMirror, { ReactCodeMirrorRef } from "@uiw/react-codemirror";
import { keymap, EditorView } from "@codemirror/view";
import { json, jsonParseLinter, jsonLanguage } from "@codemirror/lang-json";
import { sublime } from "@uiw/codemirror-theme-sublime";
import { linter, lintGutter } from "@codemirror/lint";
import { color } from "./extensions/glStyleColor";
import {
  glStyleLinter,
  validateGLStyleFragment,
} from "./extensions/glStyleValidator";
import { glStyleAutocomplete } from "./extensions/glStyleAutocomplete";
import { useCallback, useMemo, useRef, useState } from "react";
import { useDebouncedFn } from "beautiful-react-hooks";
import { defaultKeymap } from "@codemirror/commands";
import {
  formatGLStyle,
  formatJSONCommand,
  formatJSONKeyBinding,
} from "./formatCommand";
import { Trans } from "react-i18next";
import useDialog from "../../../components/useDialog";
import { getBestSpriteImage, sprites } from "./extensions/glStyleSprites";
import {
  useSpritesQuery,
  GetSpriteDocument,
  GetSpriteQuery,
} from "../../../generated/graphql";
import getSlug from "../../../getSlug";
import SpritePopover from "./SpritePopover";

interface GLStyleEditorProps {
  initialStyle?: string;
  onChange?: (newStyle: string) => void;
  dataLayerId?: number;
  className?: string;
}

const jsonCompletions = jsonLanguage.data.of({
  autocomplete: glStyleAutocomplete,
});

function Button({ className, ...props }: any) {
  return (
    <button
      className={`bg-gray-400 hover:bg-gray-300 bg-gradient-to-b rounded-sm p-0 px-1 text-sm shadow ${className}`}
      {...props}
    >
      {props.children}
    </button>
  );
}
/**
 * This is an uncontrolled component. Changes to initialStyle after initial rendering will not
 * change the value of the editor.
 * @param props
 * @returns
 */
export default function GLStyleEditor(props: GLStyleEditorProps) {
  const [value] = useState(formatGLStyle(props.initialStyle || ""));
  const onChange = useDebouncedFn(props.onChange || (() => {}), 100, {});
  const editorRef = useRef<ReactCodeMirrorRef>(null);
  const dialog = useDialog();

  const spriteQuery = useSpritesQuery({
    variables: {
      slug: getSlug(),
    },
  });

  const [spriteState, setSpriteState] = useState<null | {
    from: number;
    to: number;
    view: EditorView;
    value: string;
    target: HTMLSpanElement;
    selectedSpriteId: number | null;
  }>(null);

  const extensions = useMemo(() => {
    return [
      json(),
      jsonCompletions,
      lintGutter(),
      linter(jsonParseLinter()),
      glStyleLinter,
      color,
      sprites({
        getSpriteUrl: async (id) => {
          const sprite = (spriteQuery.data?.projectBySlug?.sprites || []).find(
            (s) => s.id === id
          );
          if (sprite) {
            return getBestSpriteImage(sprite).url;
          } else {
          }
          const results = await spriteQuery.client.query<GetSpriteQuery>({
            query: GetSpriteDocument,
            variables: {
              id,
            },
          });
          if (results.data.sprite?.spriteImages) {
            return getBestSpriteImage(results.data.sprite).url;
          } else {
            throw new Error("Could not find sprite with id " + id);
          }
        },
        onSpriteClick: (event) => {
          setSpriteState((prev) => ({
            ...event,
            selectedSpriteId: /seasketch:\/\/sprites\/(\d+)/.test(event.value)
              ? parseInt(event.value.match(/seasketch:\/\/sprites\/(\d+)/)![1])
              : null,
          }));
        },
      }),
      keymap.of([formatJSONKeyBinding, ...defaultKeymap]),
    ];
  }, [spriteQuery, setSpriteState]);

  const onSpriteChange = useCallback(
    (selectedSpriteId: number | null, value?: string) => {
      if (selectedSpriteId === null) {
        setSpriteState(null);
      } else {
        setSpriteState((prev) => ({
          ...prev!,
          selectedSpriteId: selectedSpriteId,
          to: prev!.from + (value ? value.length : 0),
        }));
      }
    },
    [setSpriteState]
  );

  return (
    <div
      className="flex flex-col h-full overflow-hidden"
      style={{ backgroundColor: "rgb(48, 56, 65)" }}
    >
      <div
        className="p-2 border-b border-black border-opacity-30 z-10 shadow flex space-x-2 flex-0"
        style={{ backgroundColor: "#303841" }}
      >
        <Button
          onClick={() => {
            if (editorRef.current?.view) {
              const editorView = editorRef.current?.view;
              formatJSONCommand(editorView);
            }
          }}
          // eslint-disable-next-line i18next/no-literal-string
          title="format code (cmd-f)"
        >
          <Trans ns="admin:data">format</Trans>
        </Button>
        <Button
          onClick={() => {
            const mac = navigator.appVersion.indexOf("Mac");
            dialog.alert(
              <div>
                <p className="my-2">
                  <span className="font-mono bg-gray-100 rounded p-1">
                    Control-Space
                  </span>{" "}
                  autocomplete
                </p>
                <p className="my-2">
                  <span className="font-mono bg-gray-100 rounded p-1">
                    {mac ? "Command" : "Ctrl"}-f
                  </span>{" "}
                  format code
                </p>
              </div>
            );
          }}
        >
          <Trans ns="admin:data">key shortcuts...</Trans>
        </Button>
      </div>

      <SpritePopover spriteState={spriteState} onChange={onSpriteChange} />

      <CodeMirror
        className="flex-1 overflow-y-auto"
        value={value}
        ref={editorRef}
        theme={sublime}
        extensions={extensions}
        basicSetup={{
          defaultKeymap: false,
          foldGutter: true,
          searchKeymap: false,
        }}
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
    </div>
  );
}
