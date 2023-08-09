/* eslint-disable i18next/no-literal-string */
import CodeMirror, { ReactCodeMirrorRef } from "@uiw/react-codemirror";
import { keymap, EditorView } from "@codemirror/view";
import { json, jsonParseLinter, jsonLanguage } from "@codemirror/lang-json";
import { sublime } from "@uiw/codemirror-theme-sublime";
import { linter, lintGutter } from "@codemirror/lint";
import { color } from "./extensions/glStyleColor";
import { glStyleLinter } from "./extensions/glStyleValidator";
import {
  GeostatsLayer,
  getInsertLayerOptions,
  glStyleAutocomplete,
} from "./extensions/glStyleAutocomplete";
import {
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  Fragment,
  ReactNode,
} from "react";
import { useDebouncedFn } from "beautiful-react-hooks";
import { defaultKeymap } from "@codemirror/commands";
import {
  formatGLStyle,
  formatJSONCommand,
  formatJSONKeyBinding,
} from "./formatCommand";
import { getBestSpriteImage, sprites } from "./extensions/glStyleSprites";
import {
  useSpritesQuery,
  GetSpriteDocument,
  GetSpriteQuery,
} from "../../../generated/graphql";
import getSlug from "../../../getSlug";
import SpritePopover from "./SpritePopover";
import { validateGLStyleFragment } from "./extensions/validateGLStyleFragment";
import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import { CaretDownIcon, ChevronRightIcon } from "@radix-ui/react-icons";
import { undo, undoDepth, redo, redoDepth } from "@codemirror/commands";
import { MapContext } from "../../../dataLayers/MapContextManager";
import GeostatsModal, { Geostats } from "./GeostatsModal";
import { glStyleHoverTooltips } from "./extensions/glStyleHoverTooltips";

require("./RadixDropdown.css");

interface GLStyleEditorProps {
  initialStyle?: string;
  type?: "vector" | "raster";
  onChange?: (newStyle: string) => void;
  className?: string;
  geostats?: GeostatsLayer;
  bounds?: [number, number, number, number];
  tocItemId?: string;
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
  const jsonCompletions = useMemo(() => {
    return jsonLanguage.data.of({
      autocomplete: glStyleAutocomplete(props.geostats),
    });
  }, [props.geostats]);

  const type = props.type || "vector";

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

  const [geostatsModal, setGeostatsModal] = useState<null | Geostats>(null);

  useEffect(() => {
    const view = editorRef.current?.view;
    if (view) {
      const keydownHandler = (e: KeyboardEvent) => {
        if (
          (e.target as Element).tagName &&
          (e.target as Element).classList.contains("cm-content")
        ) {
          return;
        }
        if (e.key === "z" && e.metaKey) {
          if (e.shiftKey) {
            redo(view);
          } else {
            undo(view);
          }
        }
      };
      document.body.addEventListener("keydown", keydownHandler);
      return () => {
        document.body.removeEventListener("keydown", keydownHandler);
      };
    }
  }, [editorRef.current?.view]);

  const extensions = useMemo(() => {
    return [
      json(),
      jsonCompletions,
      lintGutter(),
      linter(jsonParseLinter()),
      glStyleLinter(type),
      color,
      glStyleHoverTooltips,
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
          setSpriteState(() => ({
            ...event,
            selectedSpriteId: /seasketch:\/\/sprites\/(\d+)/.test(event.value)
              ? parseInt(event.value.match(/seasketch:\/\/sprites\/(\d+)/)![1])
              : null,
          }));
        },
      }),
      keymap.of([formatJSONKeyBinding, ...defaultKeymap]),
    ];
  }, [spriteQuery, setSpriteState, type, jsonCompletions]);

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

  const { layerTypes, insertOptions } = useMemo(() => {
    const options = props.geostats ? getInsertLayerOptions(props.geostats) : [];
    const layerTypes: string[] = [];
    for (const option of options) {
      if (!layerTypes.includes(option.layer.type)) {
        layerTypes.push(option.layer.type);
      }
    }
    return { layerTypes, insertOptions: options };
  }, [props.geostats]);

  const mapContext = useContext(MapContext);
  const visibleLayers = mapContext.manager?.getVisibleLayerReferenceIds();

  const [zoom, setZoom] = useState(0);
  useEffect(() => {
    if (mapContext.manager?.map) {
      const onZoom = () => {
        setZoom(
          Math.round((mapContext.manager?.map?.getZoom() || 0) * 10) / 10
        );
      };
      mapContext.manager.map.on("zoom", onZoom);
      setZoom(Math.round((mapContext.manager?.map?.getZoom() || 0) * 10) / 10);
      return () => {
        mapContext.manager?.map?.off("zoom", onZoom);
      };
    }
  }, [mapContext.manager?.map]);

  const mac = navigator.appVersion.indexOf("Mac");
  const editorState = editorRef.current?.view?.state;
  return (
    <div
      className="flex flex-col h-full overflow-hidden"
      style={{ backgroundColor: "rgb(48, 56, 65)" }}
    >
      <div
        className="p-2 border-b border-black border-opacity-30 z-10 shadow flex space-x-2 flex-0"
        style={{ backgroundColor: "#303841" }}
      >
        {props.tocItemId && (
          <>
            <DropdownMenu.Root>
              <DropdownTrigger label="View" ariaLabel="View menu" />
              <DropdownMenuContent>
                <DropdownMenuItem
                  disabled={!props.bounds}
                  onClick={() => {
                    if (mapContext.manager && props.geostats) {
                      mapContext.manager.map?.fitBounds(props.bounds!);
                    }
                  }}
                  label="Show layer extent"
                />
                {props.tocItemId && (
                  <DropdownMenuItem
                    label="Hide all other overlays"
                    disabled={
                      !visibleLayers ||
                      (visibleLayers.length === 1 &&
                        visibleLayers[0] === props.tocItemId)
                    }
                    onClick={() => {
                      if (mapContext.manager && props.geostats) {
                        mapContext.manager.setVisibleTocItems([
                          props.tocItemId!,
                        ]);
                      }
                    }}
                  />
                )}
                {props.geostats && (
                  <DropdownMenuItem
                    label="Open layer property details"
                    disabled={!props.geostats}
                    onClick={() => {
                      setGeostatsModal({
                        layers: [props.geostats!],
                        layerCount: 1,
                      });
                    }}
                  />
                )}
              </DropdownMenuContent>
            </DropdownMenu.Root>
          </>
        )}
        <DropdownMenu.Root>
          <DropdownTrigger label="Edit" ariaLabel="Edit menu" />
          <DropdownMenuContent>
            <DropdownMenuItem
              label="Undo"
              disabled={!Boolean(editorState) || undoDepth(editorState!) === 0}
              onClick={() => {
                if (editorRef.current?.view) {
                  const editorView = editorRef.current?.view;
                  undo(editorView);
                }
              }}
              keyCode={(mac ? "⌘" : "^") + "Z"}
            />
            <DropdownMenuItem
              label="Redo"
              disabled={!Boolean(editorState) || redoDepth(editorState!) === 0}
              onClick={() => {
                if (editorRef.current?.view) {
                  const editorView = editorRef.current?.view;
                  redo(editorView);
                }
              }}
              keyCode={(mac ? "⌘" : "^") + `+Shift+Z`}
            />
            <DropdownMenuItem
              label="Format Code"
              onClick={() => {
                if (editorRef.current?.view) {
                  const editorView = editorRef.current?.view;
                  formatJSONCommand(editorView);
                }
              }}
              keyCode={`${mac ? "⌘" : "^"}+F`}
            />

            {props.tocItemId && (
              <>
                <DropdownSeperator />
                <DropdownLabel label="Insert a new layer" />
              </>
            )}
            {layerTypes.map((type) => (
              <DropdownSubmenu
                label={type === "symbol" ? "Labels & Symbols" : type}
                key={type}
              >
                {insertOptions
                  .filter((o) => o.layer.type === type && !o.propertyChoice)
                  .map((option) => (
                    <DropdownMenuItem
                      onClick={() => {
                        if (editorRef.current?.view) {
                          const editorView = editorRef.current?.view;
                          editorView.dispatch({
                            changes: {
                              from: editorView.state.doc.length - 2,
                              to: editorView.state.doc.length - 2,
                              insert:
                                editorView.state.doc.length > 10
                                  ? "," + JSON.stringify(option.layer)
                                  : JSON.stringify(option.layer),
                            },
                            scrollIntoView: true,
                            selection: {
                              anchor: editorView.state.doc.length - 1,
                            },
                          });
                          formatJSONCommand(editorView);
                        }
                      }}
                      key={option.label + option.propertyChoice?.property}
                      label={option.label}
                    />
                  ))}
                {(() => {
                  const groups = insertOptions.reduce((set, o) => {
                    if (o.propertyChoice && o.type === type) {
                      set.add(o.label);
                    }
                    return set;
                  }, new Set<string>());

                  return [...groups].map((group) => (
                    <Fragment key={group}>
                      <DropdownLabel label={group} />
                      {insertOptions
                        .filter((v) => v.label === group)
                        .map((option) => (
                          <DropdownMenuItem
                            inset
                            key={option.label + option.propertyChoice?.property}
                            onClick={() => {
                              if (editorRef.current?.view) {
                                insertLayer(
                                  editorRef.current.view,
                                  option.layer
                                );
                              }
                            }}
                            label={option.propertyChoice?.property || ""}
                            details={
                              option.propertyChoice?.type === "string"
                                ? (option.propertyChoice!.values || []).join(
                                    ", "
                                  )
                                : option.propertyChoice?.type === "number" &&
                                  option.propertyChoice?.min !== undefined &&
                                  option.propertyChoice.max
                                ? `${option.propertyChoice.min} - ${option.propertyChoice.max}`
                                : undefined
                            }
                          />
                        ))}
                    </Fragment>
                  ));
                })()}
              </DropdownSubmenu>
            ))}
          </DropdownMenuContent>
        </DropdownMenu.Root>
        {props.tocItemId && (
          <span className="font-mono text-sm bg-gray-700 text-blue-300 text-opacity-80 px-1 py-0.5 rounded w-24 text-center tabular-nums">
            zoom{" "}
            <span className="font-mono ">
              {Math.round(zoom) === zoom ? zoom + ".0" : zoom}
            </span>
          </span>
        )}
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
        onChange={(value) => {
          try {
            const errors = validateGLStyleFragment(JSON.parse(value), type);
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
      {geostatsModal && (
        <GeostatsModal
          geostats={geostatsModal}
          onRequestClose={() => {
            setGeostatsModal(null);
          }}
        />
      )}
    </div>
  );
}

function DropdownTrigger({
  label,
  ariaLabel,
}: {
  label: string;
  ariaLabel?: string;
}) {
  return (
    <DropdownMenu.Trigger asChild>
      <button
        className="text-sm bg-gray-400 rounded-sm p-0 px-1 shadow pl-2"
        aria-label={ariaLabel}
      >
        {label} <CaretDownIcon className="inline" />
      </button>
    </DropdownMenu.Trigger>
  );
}

function DropdownMenuContent({ children }: { children: ReactNode }) {
  return (
    <DropdownMenu.Portal className="z-50">
      <DropdownMenu.Content
        className="shadow-lg bg-gray-300 bg-opacity-95 z-50 text-sm rounded-md p-1"
        style={{ minWidth: 220 }}
        sideOffset={5}
        align="start"
      >
        {children}
      </DropdownMenu.Content>
    </DropdownMenu.Portal>
  );
}

function DropdownMenuItem({
  disabled,
  onClick,
  label,
  keyCode,
  details,
  inset,
}: {
  disabled?: boolean;
  onClick: () => void;
  label: string;
  keyCode?: string;
  details?: string;
  inset?: boolean;
}) {
  return (
    <DropdownMenu.Item
      disabled={disabled}
      onClick={onClick}
      className={`RadixDropdownItem group leading-none cursor-pointer rounded flex items-center h-5 relative px-2 select-none outline-none ${
        inset ? "ml-2" : ""
      }`}
    >
      {label}
      {keyCode && <div className="ml-auto pl-1">{keyCode}</div>}
      {details && (
        <div
          style={{ maxWidth: 350 }}
          className="truncate ml-auto pl-5 text-mauve11 group-data-[highlighted]:text-white group-data-[disabled]:text-mauve8"
        >
          {details}
        </div>
      )}
    </DropdownMenu.Item>
  );
}

function DropdownSeperator() {
  return (
    <DropdownMenu.Separator
      style={{ height: 1 }}
      className="bg-gray-400 opacity-50 my-1.5 mb-1"
    />
  );
}

function DropdownLabel({ label }: { label: string }) {
  return (
    <DropdownMenu.Label className="pl-2 text-gray-500 text-sm leading-2 mb-1 mt-2">
      {label}
    </DropdownMenu.Label>
  );
}

function DropdownSubmenu({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <DropdownMenu.Sub>
      <DropdownMenu.SubTrigger className="RadixDropdownItem capitalize group leading-none cursor-pointer rounded flex items-center h-5 relative px-2 select-none outline-none ">
        {label}
        <div className="ml-auto pl-[20px] text-mauve11 group-data-[highlighted]:text-white group-data-[disabled]:text-mauve8">
          <ChevronRightIcon />
        </div>
      </DropdownMenu.SubTrigger>
      <DropdownMenu.Portal className="z-50">
        <DropdownMenu.SubContent
          className="shadow-lg bg-gray-300 bg-opacity-95 z-50 text-sm rounded-md p-1"
          sideOffset={2}
          alignOffset={-5}
        >
          {children}
        </DropdownMenu.SubContent>
      </DropdownMenu.Portal>
    </DropdownMenu.Sub>
  );
}

function insertLayer(editorView: EditorView, layer: any) {
  editorView.dispatch({
    changes: {
      from: editorView.state.doc.length - 2,
      to: editorView.state.doc.length - 2,
      insert:
        editorView.state.doc.length > 10
          ? "," + JSON.stringify(layer)
          : JSON.stringify(layer),
    },
    scrollIntoView: true,
    selection: {
      anchor: editorView.state.doc.length - 1,
    },
  });
  formatJSONCommand(editorView);
}
