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
import {
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
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
  useGetOrCreateSpriteMutation,
} from "../../../generated/graphql";
import getSlug from "../../../getSlug";
import { usePopper } from "react-popper";
import Spinner from "../../../components/Spinner";
import { useDropzone } from "react-dropzone";
import { DataUploadDropzoneContext } from "../../uploads/DataUploadDropzone";
import useProjectId from "../../../useProjectId";

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
  const [createSprite, mutationState] = useGetOrCreateSpriteMutation();
  const projectId = useProjectId();

  const spriteQuery = useSpritesQuery({
    variables: {
      slug: getSlug(),
    },
  });

  const onDrop = useCallback(
    async (acceptedFiles: File[]) => {
      await Promise.all(
        acceptedFiles.map(async (file) => {
          const dims = await getImageDimensions(file);
          await createSprite({
            variables: {
              height: dims.height,
              width: dims.height,
              pixelRatio: 2,
              projectId: projectId!,
              smallestImage: file,
            },
          });
        })
      );
      spriteQuery.refetch();
    },
    [createSprite, spriteQuery]
  );

  const { getRootProps, getInputProps, isDragActive } = useDropzone({ onDrop });

  const [spriteState, setSpriteState] =
    useState<null | {
      from: number;
      to: number;
      view: EditorView;
      value: string;
      target: HTMLSpanElement;
      selectedSpriteId: number;
    }>(null);
  const [popperElement, setPopperElement] =
    useState<HTMLDivElement | null>(null);
  const [arrowElement, setArrowElement] = useState<HTMLDivElement | null>(null);
  const { styles, attributes } = usePopper(spriteState?.target, popperElement, {
    modifiers: [{ name: "arrow", options: { element: arrowElement } }],
  });

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
          setSpriteState({
            ...event,
            selectedSpriteId: parseInt(
              event.value.match(/seasketch:\/\/sprites\/(\d+)/)![1]
            ),
          });
        },
      }),
      keymap.of([formatJSONKeyBinding, ...defaultKeymap]),
    ];
  }, [spriteQuery, setSpriteState]);

  const uploadContext = useContext(DataUploadDropzoneContext);

  useEffect(() => {
    const listener = (e: MouseEvent) => {
      if (spriteState?.target) {
        const target = e.target as HTMLElement;
        if (
          e.target &&
          popperElement &&
          (popperElement.contains(target) ||
            (target.nodeName === "SPAN" && target.dataset.sprite))
        ) {
          // do nothing. clicking within popup or the decoration
        } else {
          setSpriteState(null);
        }
      }
    };
    document.addEventListener("click", listener);
    return () => {
      document.removeEventListener("click", listener);
    };
  });

  useEffect(() => {
    if (spriteState?.target) {
      uploadContext.setDisabled(true);
    } else {
      uploadContext.setDisabled(false);
    }
  }, [spriteState?.target]);

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
      {spriteState?.target && (
        <div
          ref={setPopperElement}
          style={styles.popper}
          {...attributes.popper}
          className="bg-cool-gray-700 p-2 rounded shadow-lg z-10 border border-black border-opacity-30"
        >
          {/* <input className="hidden pointer-events-none" {...getInputProps()} /> */}
          <select className="text-xs py-1 pl-1 bg-gray-600 w-full rounded text-white mb-2">
            <option value="project">all sprites</option>
          </select>
          {spriteQuery.loading && !spriteQuery.data && <Spinner />}
          {spriteQuery.data && (
            <div {...getRootProps()} className="w-64 h-48 items-center">
              {isDragActive && (
                <div className="z-10 absolute left-0 top-0 w-full h-full flex items-center justify-center bg-indigo-600 bg-opacity-5">
                  Drop new sprites here ...
                </div>
              )}
              <h4 className="text-xs text-gray-200 py-1">project uploads</h4>
              {(spriteQuery.data.projectBySlug?.sprites || []).map((sprite) => {
                const image = getBestSpriteImage(sprite);
                return (
                  <div
                    key={sprite.id}
                    className={`float-left w-8 h-8 cursor-pointer flex items-center  ${
                      sprite.id === spriteState.selectedSpriteId
                        ? "border border-gray-600"
                        : "hover:bg-black hover:bg-opacity-10"
                    }`}
                    style={{
                      backgroundImage: `url(${image.url})`,
                      backgroundPosition: "center",
                      backgroundRepeat: "no-repeat",
                      backgroundSize: `${image.width / image.pixelRatio}px ${
                        image.height / image.pixelRatio
                      }px`,
                    }}
                    onClick={() => {
                      if (editorRef.current?.view) {
                        const insert = `"seasketch://sprites/${sprite.id}"`;
                        setSpriteState((prev) => ({
                          ...prev!,
                          selectedSpriteId: sprite.id,
                          to: prev!.from + insert.length,
                        }));
                        const view = editorRef.current.view;
                        view.dispatch({
                          changes: {
                            from: spriteState.from,
                            to: spriteState.to,
                            insert,
                          },
                        });
                      }
                    }}
                  >
                    {/* <img
                      width={image.width / image.pixelRatio}
                      height={image.height / image.pixelRatio}
                      src={image.url}
                    /> */}
                  </div>
                );
              })}
            </div>
          )}
          <div ref={setArrowElement} style={styles.arrow} className="z-10" />
        </div>
      )}
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

async function getImageDimensions(
  file: File
): Promise<{ width: number; height: number; type: string }> {
  return new Promise((resolve, reject) => {
    var reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = function (e: any) {
      //Initiate the JavaScript Image object.
      var image = new Image();

      //Set the Base64 string return from FileReader as source.
      image.src = e.target.result;

      //Validate the File Height and Width.
      image.onload = function () {
        resolve({
          type: file.type,
          width: image.width,
          height: image.height,
        });
      };
    };
  });
}
