import { Style } from "mapbox-gl";
import React, { useEffect, useState } from "react";
import { GeoJsonGeometryTypes } from "geojson";
import { Controlled as CodeMirror } from "react-codemirror2";
import "codemirror/lib/codemirror.css";
import "codemirror/theme/material.css";
import "codemirror-colorpicker/dist/codemirror-colorpicker.css";
import "codemirror-colorpicker";
import "codemirror/addon/lint/lint.css";
// @ts-ignore
import { validate } from "@mapbox/mapbox-gl-style-spec";
import useDebounce from "../../useDebounce";
import Modal from "../../components/Modal";
import Spinner from "../../components/Spinner";
import Button from "../../components/Button";
import { styleForFeatureLayer } from "@seasketch/mapbox-gl-esri-sources";
import {
  createImageBlobFromDataURI,
  getOrCreateSpritesFromImageSet,
  replaceSpriteIds,
} from "./arcgis/arcgis";
import {
  useGetOrCreateSpriteMutation,
  useAddImageToSpriteMutation,
} from "../../generated/graphql";
import { useParams } from "react-router-dom";
import useProjectId from "../../useProjectId";
import { Trans, useTranslation } from "react-i18next";
require("codemirror/addon/lint/lint");
require("codemirror/addon/lint/json-lint");
require("codemirror/mode/javascript/javascript");
// @ts-ignore
window.jsonlint = require("jsonlint-mod");

interface GLStyleEditorProps {
  initialStyle?: string;
  onChange?: (newStyle: string) => void;
  geometryType: GeoJsonGeometryTypes;
  /** If given, user will be provided an option to reset to this source */
  arcgisServerSource?: string;
  /** If provided, a "reset style" button will appear */
  resetStyle?: string;
  dataLayerId?: number;
}

export default function GLStyleEditor(props: GLStyleEditorProps) {
  const [style, setStyle] = useState<string>(props.initialStyle || "");
  const debouncedStyle = useDebounce(style, 50);
  const [styleErrors, setStyleErrors] = useState<Error[]>([]);
  const [jsonErrors, setJsonErrors] = useState<boolean>(false);
  const [resettingStyle, setResettingStyle] = useState(false);
  const [errorResettingStyle, setErrorResettingStyle] = useState<string>();
  const [createSprite, createSpriteState] = useGetOrCreateSpriteMutation();
  const [addImageToSprite] = useAddImageToSpriteMutation();
  const projectId = useProjectId();
  const { t } = useTranslation("admin");

  useEffect(() => {
    if (debouncedStyle) {
      try {
        const styleJSON = JSON.parse(debouncedStyle);
        const errors = validate({
          version: 8,
          name: "SeaSketch",
          glyphs: "https://seasketch/{range}/{fontstack}",
          layers: styleJSON.map((layer: any, index: number) => ({
            ...layer,
            source: "1",
            id: index.toString(),
          })),
          sources: { 1: {} },
        });
        setStyleErrors(errors.slice(0, -1));
        if (
          props.onChange &&
          debouncedStyle &&
          !errors.slice(0, -1).length &&
          !jsonErrors
        ) {
          props.onChange(debouncedStyle);
        }
      } catch (e) {
        setStyleErrors([]);
      }
    } else {
      setStyleErrors([]);
    }
  }, [debouncedStyle]);

  return (
    <>
      <CodeMirror
        className={`h-auto border ${
          styleErrors.length > 0 || jsonErrors ? "border-red-300" : "my-2"
        }`}
        value={style}
        // defineMode={{
        //   // @ts-ignore
        //   fn: (cm: any) => {
        //     console.log("cm", cm);
        //     return cm;
        //   },
        //   name: "thing",
        // }}
        options={{
          mode: "application/json",
          // mode: "thing",
          gutters: ["CodeMirror-lint-markers"],
          lint: true,
          lineNumbers: true,
          // colorpicker: true,
          colorpicker: {
            mode: "edit",
          },
          json: true,
        }}
        editorDidMount={(editor, value) => {
          // fix for colors not immediately showing up
          editor.refresh();
        }}
        onBeforeChange={(editor, data, value) => {
          setStyle(value);
          try {
            const s = JSON.parse(value);
            setJsonErrors(false);
          } catch (e) {
            setJsonErrors(true);
          }
        }}
        onChange={(editor, data, value) => {}}
      />
      {styleErrors.length > 0 && (
        <div className="text-sm bg-red-200 p-1 px-2" style={{ fontSize: 13 }}>
          {styleErrors.map((e, i) => (
            <p key={i}>{e.message.toString()}</p>
          ))}
        </div>
      )}
      {props.arcgisServerSource && (
        <button
          disabled={style === undefined}
          className={`text-sm underline text-primary-600 ${
            style === undefined ? "pointer-events-none opacity-50" : ""
          }`}
          onClick={() => {
            if (
              window.confirm("Are you sure you want to clear your changes?")
            ) {
              // updateSettings("mapboxLayers", undefined);
              setResettingStyle(true);
              styleForFeatureLayer(
                props.arcgisServerSource!,
                "source-id-fill-in"
              )
                .then(async ({ imageList, layers }) => {
                  let replacementIds: { [oldId: string]: string } = {};
                  if (imageList) {
                    const imageSetJSON = imageList.toJSON();
                    if (imageSetJSON.length) {
                      replacementIds = await getOrCreateSpritesFromImageSet(
                        imageList,
                        projectId!,
                        createSprite,
                        addImageToSprite
                      );
                    }
                  }
                  let newStyle = JSON.stringify(
                    layers.map((l) => {
                      return {
                        ...l,
                        id: undefined,
                        source: undefined,
                      };
                    }),
                    null,
                    "  "
                  );
                  if (Object.keys(replacementIds).length) {
                    newStyle = JSON.stringify(
                      replaceSpriteIds(JSON.parse(newStyle), replacementIds),
                      null,
                      "  "
                    );
                  }
                  setStyle(newStyle);
                  setResettingStyle(false);
                })
                .catch((e) => {
                  setResettingStyle(false);
                  setErrorResettingStyle(e.message);
                });
              // setTimeout(() => {
              //   setResettingStyle(false);
              //   setErrorResettingStyle("Failed to fetch");
              // }, 1000);
            }
          }}
        >
          <Trans ns="admin">Reset to original ArcGIS style</Trans>
        </button>
      )}
      <Modal
        open={resettingStyle || !!errorResettingStyle}
        footer={
          errorResettingStyle ? (
            <>
              <Button
                label={t("Cancel")}
                onClick={() => {
                  setErrorResettingStyle(undefined);
                  setResettingStyle(false);
                }}
              />
            </>
          ) : null
        }
      >
        {resettingStyle && (
          <div className="sm:max-w-lg flex">
            <div className="align-middle mr-2 flex-0 flex justify-center">
              <Spinner className="" />
            </div>
            <div className="flex-1">
              <Trans ns="admin">
                Resetting style from{" "}
                <a
                  className="underline text-primary-500"
                  href={props.arcgisServerSource}
                  target="_blank"
                  rel="noreferrer"
                >
                  original source
                </a>
              </Trans>
            </div>
          </div>
        )}
        {errorResettingStyle && <span>{errorResettingStyle}</span>}
      </Modal>
    </>
  );
}
