/* eslint-disable i18next/no-literal-string */
import CodeMirror, { ReactCodeMirrorRef } from "@uiw/react-codemirror";
import { keymap, EditorView } from "@codemirror/view";
import { json, jsonParseLinter, jsonLanguage } from "@codemirror/lang-json";
import { sublime } from "@uiw/codemirror-theme-sublime";
import { linter, lintGutter } from "@codemirror/lint";
import { color } from "./extensions/glStyleColor";
import { glStyleLinter } from "./extensions/glStyleValidator";
import * as Menubar from "@radix-ui/react-menubar";
import {
  MenuBarContent,
  MenuBarItem,
  MenuBarLabel,
  MenuBarSeparator,
  MenuBarSubmenu,
  MenubarRadioItem,
  MenubarTrigger,
} from "../../../components/Menubar";
import {
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
  AdminSketchingDetailsFragment,
} from "../../../generated/graphql";
import getSlug from "../../../getSlug";
import SpritePopover from "./SpritePopover";
import { validateGLStyleFragment } from "./extensions/validateGLStyleFragment";
import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import {
  CaretDownIcon,
  ChevronRightIcon,
  CodeIcon,
  GearIcon,
  SliderIcon,
} from "@radix-ui/react-icons";
import { undo, undoDepth, redo, redoDepth } from "@codemirror/commands";
import { MapContext } from "../../../dataLayers/MapContextManager";
import GeostatsModal, { Geostats } from "./GeostatsModal";
import { glStyleHoverTooltips } from "./extensions/glStyleHoverTooltips";
import { GeostatsLayer, isRasterInfo } from "@seasketch/geostats-types";
import { Trans, useTranslation } from "react-i18next";
import GUIStyleEditor from "../GUIStyleEditor";
import CodeVsGuiSwitch from "./CodeVsGuiSwitch";

require("./RadixDropdown.css");

interface GLStyleEditorProps {
  initialStyle?: string;
  type?: "vector" | "raster";
  onChange?: (newStyle: string) => void;
  className?: string;
  geostats?: GeostatsLayer;
  bounds?: [number, number, number, number];
  tocItemId?: string;
  onRequestShowBounds?: (bounds: [number, number, number, number]) => void;
}

/**
 * This is an uncontrolled component. Changes to initialStyle after initial rendering will not
 * change the value of the editor.
 * @param props
 * @returns
 */
export default function GLStyleEditor(props: GLStyleEditorProps) {
  const [value] = useState(formatGLStyle(props.initialStyle || ""));
  const [layers, setLayers] = useState(value);
  const onChange = useDebouncedFn(
    (newStyle: string) => {
      if (props.onChange) {
        props.onChange(newStyle);
      }
      setLayers(newStyle);
    },
    100,
    {}
  );
  const editorRef = useRef<ReactCodeMirrorRef>(null);

  const [editor, setEditor] = useState<"style" | "code">("code");
  const type = props.type || "vector";

  const spriteQuery = useSpritesQuery({
    variables: {
      slug: getSlug(),
    },
  });

  const jsonCompletions = useMemo(() => {
    return jsonLanguage.data.of({
      autocomplete: glStyleAutocomplete(
        props.geostats,
        spriteQuery?.data?.publicSprites || []
      ),
    });
  }, [props.geostats, spriteQuery.data?.publicSprites]);

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
        if (e.key === "s" && e.metaKey) {
          e.preventDefault();
          return;
        }
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
    const options = props.geostats
      ? getInsertLayerOptions(props.geostats, [
          ...(spriteQuery.data?.publicSprites || []),
          ...(spriteQuery.data?.projectBySlug?.sprites || []),
        ])
      : [];
    const layerTypes: string[] = [];
    for (const option of options) {
      if (!layerTypes.includes(option.layer.type)) {
        layerTypes.push(option.layer.type);
      }
    }
    return { layerTypes, insertOptions: options };
  }, [
    props.geostats,
    spriteQuery.data?.publicSprites,
    spriteQuery.data?.projectBySlug?.sprites,
  ]);

  const mapContext = useContext(MapContext);
  const visibleLayers = mapContext.manager?.getVisibleLayerReferenceIds();
  const { t } = useTranslation("admin:data");

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
      className="flex flex-col h-full overflow-hidden transition-colors"
      style={{
        backgroundColor: editor === "code" ? "rgb(48, 56, 65)" : "#fefefe",
      }}
    >
      <div
        className={`transition-colors p-0.5   border-opacity-30 z-10 shadow flex space-x-2 flex-0 ${
          editor === "code" ? "border-b border-black" : ""
        }`}
        style={{
          backgroundColor: editor === "code" ? "#303841" : "rgb(243, 244, 246)",
        }}
      >
        {(props.tocItemId || props.geostats) && (
          <>
            <Menubar.Root className="flex p-1 py-0.5 rounded-md z-50 items-center text-sm">
              <Menubar.Menu>
                <MenubarTrigger dark={editor === "code"}>
                  {t("View")}
                </MenubarTrigger>
                <Menubar.Portal>
                  <MenuBarContent>
                    <MenuBarItem
                      disabled={!props.bounds}
                      onClick={() => {
                        if (props.bounds && props.onRequestShowBounds) {
                          props.onRequestShowBounds(props.bounds);
                        } else if (mapContext.manager && props.bounds) {
                          mapContext.manager.map?.fitBounds(props.bounds);
                        }
                      }}
                    >
                      {t("Show layer extent")}
                    </MenuBarItem>
                    <MenuBarItem
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
                    >
                      {t("Hide all other overlays")}
                    </MenuBarItem>
                    {props.geostats && (
                      <MenuBarItem
                        disabled={!props.geostats}
                        onClick={() => {
                          setGeostatsModal({
                            layers: [props.geostats!],
                            layerCount: 1,
                          });
                        }}
                      >
                        {t("Open layer property details")}
                      </MenuBarItem>
                    )}
                  </MenuBarContent>
                </Menubar.Portal>
              </Menubar.Menu>
              <Menubar.Menu>
                <MenubarTrigger dark={editor === "code"}>
                  {t("Edit")}
                </MenubarTrigger>
                <Menubar.Portal>
                  <MenuBarContent>
                    <MenuBarItem
                      disabled={
                        !Boolean(editorState) || undoDepth(editorState!) === 0
                      }
                      onClick={() => {
                        if (editorRef.current?.view) {
                          const editorView = editorRef.current?.view;
                          undo(editorView);
                        }
                      }}
                    >
                      <span>{t("Undo")}</span>
                      <div className="ml-auto pl-1">
                        {(mac ? "⌘" : "^") + "Z"}
                      </div>
                    </MenuBarItem>
                    <MenuBarItem
                      disabled={
                        !Boolean(editorState) || redoDepth(editorState!) === 0
                      }
                      onClick={() => {
                        if (editorRef.current?.view) {
                          const editorView = editorRef.current?.view;
                          redo(editorView);
                        }
                      }}
                    >
                      <span>{t("Redo")}</span>
                      <div className="ml-auto pl-1">
                        {(mac ? "⌘" : "^") + `+Shift+Z`}
                      </div>
                    </MenuBarItem>
                    {editor === "code" && (
                      <MenuBarItem
                        onClick={() => {
                          if (editorRef.current?.view) {
                            const editorView = editorRef.current?.view;
                            formatJSONCommand(editorView);
                          }
                        }}
                      >
                        <span>{t("Format Code")}</span>
                        <div className="ml-auto pl-1">
                          {`${mac ? "⌘" : "^"}+F`}
                        </div>
                      </MenuBarItem>
                    )}
                    {props.tocItemId &&
                      editor === "code" &&
                      layerTypes.length > 0 && (
                        <>
                          <MenuBarSeparator />
                          <MenuBarLabel>{t("Insert a new layer")}</MenuBarLabel>
                        </>
                      )}
                    {editor === "code" &&
                      layerTypes.map((type) => (
                        <MenuBarSubmenu
                          label={
                            type === "symbol"
                              ? "Labels & Symbols"
                              : `${type.slice(0, 1).toUpperCase()}${type.slice(
                                  1
                                )}`
                          }
                          key={type}
                        >
                          {insertOptions
                            .filter(
                              (o) => o.layer.type === type && !o.propertyChoice
                            )
                            .map((option) => (
                              <MenuBarItem
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
                                key={
                                  option.label + option.propertyChoice?.property
                                }
                              >
                                {option.label}
                              </MenuBarItem>
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
                                <MenuBarLabel>{group}</MenuBarLabel>
                                {insertOptions
                                  .filter((v) => v.label === group)
                                  .map((option) => {
                                    const details =
                                      option.propertyChoice?.type ===
                                        "string" ||
                                      (option.propertyChoice?.type ===
                                        "array" &&
                                        option.propertyChoice?.typeArrayOf ===
                                          "string")
                                        ? (
                                            option.propertyChoice!.values || []
                                          ).join(", ")
                                        : option.propertyChoice?.type ===
                                            "number" &&
                                          option.propertyChoice?.min !==
                                            undefined &&
                                          option.propertyChoice.max
                                        ? `${option.propertyChoice.min} - ${option.propertyChoice.max}`
                                        : undefined;
                                    return (
                                      <MenuBarItem
                                        // inset
                                        key={
                                          option.label +
                                          option.propertyChoice?.property
                                        }
                                        onClick={() => {
                                          if (editorRef.current?.view) {
                                            insertLayer(
                                              editorRef.current.view,
                                              option.layer
                                            );
                                          }
                                        }}
                                      >
                                        {option.propertyChoice?.property || ""}
                                        {details && (
                                          <div
                                            className="truncate ml-auto pl-5 text-mauve11 group-data-[highlighted]:text-white group-data-[disabled]:text-mauve8"
                                            style={{ maxWidth: 350 }}
                                          >
                                            {details}
                                          </div>
                                        )}
                                      </MenuBarItem>
                                    );
                                  })}
                              </Fragment>
                            ));
                          })()}
                        </MenuBarSubmenu>
                      ))}
                  </MenuBarContent>
                </Menubar.Portal>
              </Menubar.Menu>
            </Menubar.Root>

            <div className="h-full flex items-center">
              <CodeVsGuiSwitch value={editor} onChange={setEditor} />
            </div>
            {props.tocItemId && (
              <div className="flex-1 flex items-center justify-end pr-2">
                <span
                  className={`transition-colors font-mono text-sm h-3/4 block ${
                    editor === "code"
                      ? "bg-gray-700 text-green-300 text-opacity-80 border border-opacity-0"
                      : "bg-gray-200 text-blue-500 border border-black border-opacity-5"
                  } px-1 rounded w-24 text-center tabular-nums flex items-center justify-center space-x-2`}
                >
                  <span>zoom</span>
                  <span className="font-mono ">
                    {Math.round(zoom) === zoom ? zoom + ".0" : zoom}
                  </span>
                </span>
              </div>
            )}
          </>
        )}
      </div>

      <SpritePopover spriteState={spriteState} onChange={onSpriteChange} />

      <CodeMirror
        className={`flex-1 overflow-y-auto ${
          editor === "style" ? "hidden" : "visible"
        }`}
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
      {editor === "style" && (
        <GUIStyleEditor style={layers} editorRef={editorRef} />
      )}
      {editor === "code" && (
        <p className="text-sm text-gray-100 p-4 bg-gray-700">
          <Trans ns={["admin:data"]}>
            Vector layers can be styled using{" "}
            <a
              className="underline text-primary-300"
              href="https://docs.mapbox.com/mapbox-gl-js/style-spec/layers/"
              target="_blank"
              rel="noreferrer"
            >
              MapBox GL Style Layers
            </a>
            . Don't specify a <code>source</code> or <code>id</code> property on
            your layers, those will be managed for you by SeaSketch. Press{" "}
            <span className="font-mono">Control+Space</span> to autocomplete
            string values and property names, and hover over properties to see
            documentation.
          </Trans>
        </p>
      )}
    </div>
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
