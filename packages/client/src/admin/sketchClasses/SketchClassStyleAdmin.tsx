import { useDebouncedFn } from "beautiful-react-hooks";
import { useGlobalErrorHandler } from "../../components/GlobalErrorHandler";
import {
  AdminSketchingDetailsFragment,
  ExtendedGeostatsType,
  SketchGeometryType,
  useUpdateSketchClassStyleMutation,
} from "../../generated/graphql";
import GLStyleEditor from "../data/GLStyleEditor/GLStyleEditor";
import { FormElementOption } from "../../formElements/FormElementOptionsInput";
import { useEffect, useMemo, useRef, useState } from "react";
import { Map } from "mapbox-gl";
import scorpion from "./scorpion.json";
import point from "./point.json";
import line from "./line.json";
import { Feature } from "geojson";
import bbox from "@turf/bbox";
import {
  GeostatsAttributeType,
  GeostatsLayer,
  LegacyGeostatsLayer,
} from "@seasketch/geostats-types";

export default function SketchClassStyleAdmin({
  sketchClass,
}: {
  sketchClass: AdminSketchingDetailsFragment;
}) {
  const onError = useGlobalErrorHandler();
  const [mutate, mutationState] = useUpdateSketchClassStyleMutation({
    onError,
  });
  const [map, setMap] = useState<Map | null>(null);
  const [sketchAttributeValues, setSketchAttributeValues] = useState<{
    [exportId: string]: any;
  }>(getDefaultSketchProperties(sketchClass));

  const [bounds, setBounds] = useState<[number, number, number, number] | null>(
    null
  );

  const mapContainer = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (mapContainer.current) {
      if (map) {
        map.remove();
      }
      const m = new Map({
        container: mapContainer.current!,
        center: [-119.57150866402623, 34.075223633555865],
        zoom: 10.35,
        style: "mapbox://styles/mapbox/streets-v12",
        accessToken: process.env.REACT_APP_MAPBOX_TOKEN,
      });
      let data = scorpion as any;
      if (sketchClass.geometryType === SketchGeometryType.Point) {
        data = point;
      } else if (sketchClass.geometryType === SketchGeometryType.Linestring) {
        data = line;
      }
      setBounds(bbox(data) as [number, number, number, number]);
      data.properties = sketchAttributeValues;
      m.on("load", () => {
        setMap(m);
        m.addSource("sketch", {
          type: "geojson",
          // @ts-ignore
          data,
        });
        const glStyle = Array.isArray(sketchClass.mapboxGlStyle)
          ? sketchClass.mapboxGlStyle
          : [];
        let i = 0;
        for (const layer of glStyle) {
          m.addLayer({
            // eslint-disable-next-line i18next/no-literal-string
            id: `sketch-${i++}`,
            ...layer,
            source: "sketch",
          });
        }
      });
      return () => {
        m.remove();
      };
    }
    // No need to include mapboxGlStyle in the dependency array
    // We'll update it manually in the update function
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mapContainer, sketchClass.geometryType]);

  const update = useDebouncedFn(
    (id: number, newStyle: string) => {
      mutate({
        variables: {
          id,
          style: newStyle ? JSON.parse(newStyle) : null,
        },
      });
    },
    500,
    {
      trailing: true,
    }
  );

  useEffect(() => {
    if (map && map.getStyle()) {
      // remove existing layers with ids starting with sketch-
      const layers = map.getStyle().layers || [];
      for (const layer of layers) {
        if (layer.id.startsWith("sketch-")) {
          map.removeLayer(layer.id);
        }
      }
      let i = 0;
      for (const layer of Array.isArray(sketchClass.mapboxGlStyle)
        ? sketchClass.mapboxGlStyle
        : []) {
        map.addLayer({
          // eslint-disable-next-line i18next/no-literal-string
          id: `sketch-${i++}`,
          ...layer,
          source: "sketch",
        });
      }
    }
  }, [map, sketchClass.mapboxGlStyle]);

  const geostats = useMemo(() => {
    return sketchClassToGeostats(sketchClass);
  }, [sketchClass.form?.formElements, sketchClass.geometryType]);

  const relevantProps = useMemo(() => {
    const props = extractRelevantPropsFromStyle(
      sketchClass.mapboxGlStyle || []
    );
    return props.map((exportId) => {
      const fe = sketchClass.form?.formElements?.find(
        (fe) =>
          fe.exportId === exportId ||
          (exportId === "name" && fe.type?.componentName === "FeatureName")
      );
      return fe;
    });
  }, [sketchClass.mapboxGlStyle]);

  useEffect(() => {
    if (map && "getSource" in map) {
      try {
        const data = map?.getSource("sketch");
        let newData = scorpion as any;
        if (sketchClass.geometryType === SketchGeometryType.Point) {
          newData = point;
        } else if (sketchClass.geometryType === SketchGeometryType.Linestring) {
          newData = line;
        }
        if (data && data.type === "geojson") {
          // @ts-ignore
          newData.properties = sketchAttributeValues;
          // @ts-ignore
          data.setData(newData);
        }
      } catch (e) {
        console.error(e);
      }
    }
  }, [sketchAttributeValues, map, sketchClass]);

  return (
    <div className="flex flex-col bg-gray-700 h-full">
      <div ref={mapContainer} className="h-64 bg-green-800"></div>
      {/* eslint-disable-next-line i18next/no-literal-string */}
      <div className="flex items-center space-x-1 p-1 bg-gray-600">
        {relevantProps.map((fe) => {
          if (fe?.type?.componentName === "FeatureName") {
            return (
              <input
                className="text-xs p-1 bg-gray-500 rounded-sm"
                type="text"
                placeholder="Sketch Name"
                value={sketchAttributeValues.name || ""}
                onChange={(e) => {
                  setSketchAttributeValues((prev) => ({
                    ...prev,
                    name: e.target.value,
                  }));
                }}
              />
            );
          } else {
            switch (fe?.type?.geostatsType) {
              case ExtendedGeostatsType.String:
                if (
                  fe?.componentSettings?.options &&
                  fe?.componentSettings?.options?.length > 0
                ) {
                  return (
                    <select
                      className="text-xs rounded-sm p-1 bg-gray-500 pr-2"
                      value={sketchAttributeValues[fe.generatedExportId]}
                      onChange={(e) => {
                        setSketchAttributeValues((prev) => ({
                          ...prev,
                          [fe.generatedExportId]: e.target.value,
                        }));
                      }}
                    >
                      {fe?.componentSettings?.options?.map(
                        (option: FormElementOption) => {
                          return (
                            <option value={option.value || option.label}>
                              {option.label}
                            </option>
                          );
                        }
                      )}
                    </select>
                  );
                } else {
                  return (
                    <input
                      type="text"
                      value={sketchAttributeValues[fe.generatedExportId]}
                    />
                  );
                }
              case ExtendedGeostatsType.Boolean:
                return (
                  <div className="text-xs inline-block px-2 space-x-2">
                    <label>{fe.generatedLabel || ""}</label>
                    <input
                      className="rounded bg-gray-500"
                      type="checkbox"
                      checked={sketchAttributeValues[fe.generatedExportId]}
                      onChange={(e) => {
                        setSketchAttributeValues((prev) => ({
                          ...prev,
                          [fe.generatedExportId]: e.target.checked,
                        }));
                      }}
                    />
                  </div>
                );
              case ExtendedGeostatsType.Number:
                return (
                  <input
                    className="text-xs p-1 bg-gray-500 rounded-sm"
                    type="number"
                    value={sketchAttributeValues[fe.generatedExportId]}
                    onChange={(e) => {
                      setSketchAttributeValues((prev) => ({
                        ...prev,
                        [fe.generatedExportId]: e.target.value,
                      }));
                    }}
                  />
                );
              case ExtendedGeostatsType.Array:
                if (
                  fe.type?.geostatsArrayOf === ExtendedGeostatsType.String &&
                  fe.componentSettings.options
                ) {
                  return (
                    <select
                      // This just gets ugly and difficult to use if set to multiple.
                      // Wait to enable until someone asks for it.
                      // -cb aug 14, 2023
                      // multiple={fe.componentSettings.multipleSelect == true}
                      className="text-xs rounded-sm p-1 bg-gray-500 pr-2 max-h-8"
                      value={sketchAttributeValues[fe.generatedExportId]}
                      onChange={(e) => {
                        const options = e.target.options;
                        const selectedOptions = [];
                        const selectedValues: string[] = [];

                        for (let i = 0; i < options.length; i++) {
                          if (options[i].selected) {
                            selectedOptions.push(options[i]);
                            selectedValues.push(options[i].value);
                          }
                        }
                        setSketchAttributeValues((prev) => ({
                          ...prev,
                          [fe.generatedExportId]: selectedValues,
                        }));
                      }}
                    >
                      {fe?.componentSettings?.options?.map(
                        (option: FormElementOption) => {
                          return (
                            <option value={option.value || option.label}>
                              {option.label}
                            </option>
                          );
                        }
                      )}
                    </select>
                  );
                }
                break;
            }
            // return components[fe?.type?.componentName || ""].displayName;
          }
          // return fe?.type?.componentName || "";
          return null;
        })}
      </div>
      <GLStyleEditor
        className="flex-1 overflow-hidden"
        initialStyle={JSON.stringify(sketchClass.mapboxGlStyle || [])}
        onChange={(newStyle) => {
          update(sketchClass.id, newStyle);
        }}
        geostats={geostats}
        bounds={bounds || undefined}
        onRequestShowBounds={() => {
          map?.fitBounds(bounds!, { padding: 20 });
        }}
      />
    </div>
  );
}

function sketchClassToGeostats(
  sketchClass: AdminSketchingDetailsFragment
): GeostatsLayer {
  const inputs = (sketchClass.form?.formElements || []).filter(
    (fe) => fe.isInput && fe.type?.geostatsType
  );
  const geostats: GeostatsLayer = {
    layer: sketchClass.name,
    geometry: coerceGeometrytype(sketchClass.geometryType),
    count: 1,
    attributeCount: inputs.length,
    attributes: inputs.map((fe) => {
      const values = fe.componentSettings.options
        ? (fe.componentSettings.options as FormElementOption[]).map(
            (v) => v.value || v.label
          )
        : [];
      return {
        attribute:
          fe.type?.componentName === "FeatureName"
            ? "name"
            : fe.generatedExportId,
        type: coerceGeostatsType(fe.type?.geostatsType)!,
        typeArrayOf: coerceGeostatsType(fe.type?.geostatsArrayOf, false),
        count: values.length,
        values: values.reduce((acc, v) => {
          acc[v] = 1;
          return acc;
        }, {} as { [value: string]: number }),
      };
    }),
  };
  return geostats;
}

function coerceGeostatsType(type: any, isRequired = true) {
  if (typeof type !== "string") {
    if (isRequired) {
      throw new Error("expected string");
    } else {
      return undefined;
    }
  }
  return type.toLowerCase() as GeostatsAttributeType;
}

function coerceGeometrytype(type: SketchGeometryType) {
  switch (type) {
    case SketchGeometryType.Polygon:
      return "Polygon";
    case SketchGeometryType.Linestring:
      return "LineString";
    case SketchGeometryType.Point:
      return "Point";
    default:
      throw new Error("Unsupported geometry type");
      break;
  }
}

function getDefaultSketchProperties(
  sketchClass: AdminSketchingDetailsFragment
) {
  const props: { [exportId: string]: any } = {};

  for (const fe of sketchClass.form?.formElements || []) {
    if (fe.isInput && fe.type?.geostatsType) {
      switch (fe.type?.geostatsType) {
        case ExtendedGeostatsType.Number:
          props[fe.generatedExportId] = 0;
          break;
        case ExtendedGeostatsType.String:
          if (
            fe.componentSettings.options &&
            fe.componentSettings.options.length
          ) {
            const value = (
              fe.componentSettings.options as FormElementOption[]
            )[0];
            props[fe.generatedExportId] = value.value || value.label;
          } else if (fe.type.componentName === "FeatureName") {
            props["name"] = "Sketch Name";
          } else {
            props[fe.generatedExportId] = "";
          }
          break;
        case ExtendedGeostatsType.Boolean:
          props[fe.generatedExportId] = true;
          break;
        case ExtendedGeostatsType.Mixed:
          props[fe.generatedExportId] = "";
          break;
        case ExtendedGeostatsType.Null:
          props[fe.generatedExportId] = null;
          break;
        case ExtendedGeostatsType.Object:
          props[fe.generatedExportId] = {};
          break;
        case ExtendedGeostatsType.Array:
          if (fe.type?.geostatsArrayOf) {
            switch (fe.type?.geostatsArrayOf) {
              case ExtendedGeostatsType.Number:
                props[fe.generatedExportId] = [0];
                break;
              case ExtendedGeostatsType.String:
                if (
                  fe.componentSettings.options &&
                  fe.componentSettings.options.length > 0
                ) {
                  const value = (
                    fe.componentSettings.options as FormElementOption[]
                  )[0];
                  props[fe.generatedExportId] = [value.value || value.label];
                } else {
                  props[fe.generatedExportId] = [""];
                }

                break;
              case ExtendedGeostatsType.Boolean:
                props[fe.generatedExportId] = [true];
                break;
              case ExtendedGeostatsType.Mixed:
                props[fe.generatedExportId] = [""];
                break;
              case ExtendedGeostatsType.Null:
                props[fe.generatedExportId] = [null];
                break;
              case ExtendedGeostatsType.Object:
                props[fe.generatedExportId] = [{}];
                break;
            }
          } else {
            props[fe.generatedExportId] = [];
          }
          break;
      }
    }
  }
  return props;
}

export function extractRelevantPropsFromStyle(style: any) {
  const props: string[] = [];
  if (Array.isArray(style)) {
    for (const layer of style) {
      extractProps(layer, props);
    }
  }
  return props;
}

function extractProps(obj: any, props: string[]) {
  for (const key in obj) {
    if (Array.isArray(obj[key]) && obj[key].length > 0) {
      extractPropsFromExpression(obj[key], props);
    } else if (typeof obj[key] === "object") {
      extractProps(obj[key], props);
    } else {
      // end of the line
    }
  }
}

function extractPropsFromExpression(expression: Array<any>, props: string[]) {
  const expressionName = expression[0];
  if (expressionName === "get") {
    if (props.indexOf(expression[1]) === -1) {
      props.push(expression[1]);
    }
  } else {
    for (const arg of expression.slice(1)) {
      if (Array.isArray(arg)) {
        extractPropsFromExpression(arg, props);
      }
    }
  }
}
