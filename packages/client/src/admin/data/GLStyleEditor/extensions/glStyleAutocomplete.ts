import { CompletionContext } from "@codemirror/autocomplete";
import { syntaxTree } from "@codemirror/language";
import { SyntaxNode } from "@lezer/common";
import styleSpec from "mapbox-gl/src/style-spec/reference/v8.json";
import { GeoJsonGeometryTypes } from "geojson";

export interface GeostatsAttribute {
  attribute: string;
  count: number;
  type: GeostatsAttributeType;
  values: (string | number | boolean | null)[];
  min?: number;
  max?: number;
}

export type GeostatsAttributeType =
  | "string"
  | "number"
  | "boolean"
  | "null"
  | "mixed"
  | "object"
  | "array";

export interface GeostatsLayer {
  layer: string;
  count: number;
  geometry: GeoJsonGeometryTypes;
  attributeCount: number;
  attributes: GeostatsAttribute[];
}

export const glStyleAutocomplete =
  (layer?: GeostatsLayer) => (context: CompletionContext) => {
    let word = context.matchBefore(/[\w-]*/);
    let { state, pos } = context,
      around = syntaxTree(state).resolveInner(pos),
      tree = around.resolve(pos, -1);
    for (
      let scan = pos, before;
      around === tree && (before = tree.childBefore(scan));

    ) {
      let last = before.lastChild;
      if (!last || !last.type.isError || last.from < last.to) break;
      around = tree = before;
      scan = last.from;
    }

    if (!word) {
      return null;
    } else {
      const styleContext = getStyleContext(around, context, layer);
      if (styleContext) {
        return {
          from: word.from,
          options: styleContext.values,
        };
      } else {
        return null;
      }
    }
  };

function getStyleContext(
  node: SyntaxNode,
  completionContext: CompletionContext,
  layer?: GeostatsLayer
) {
  const contextState = completionContext.state;
  if (
    node.type.name === "String" ||
    node.type.name === "Property" ||
    node.type.name === "PropertyName"
  ) {
    const context: StyleContext = {
      layer: {},
      values: [],
      type:
        node.type.name === "String" || node.type.name === "Property"
          ? "PropertyValue"
          : "PropertyName",
    };
    if (context) {
      const property = node.parent;
      const propertyNameNode = property?.firstChild;
      if (!property || !propertyNameNode) {
        return;
      }
      const name = contextState.sliceDoc(
        propertyNameNode.from,
        propertyNameNode.to
      );
      context.propertyName = name.replace(/"/g, "");
      // get parent of property, if any (e.g. nested within paint or layout)
      if (
        property.parent?.name === "Object" &&
        property.parent?.parent?.name === "Array"
      ) {
        // in a property like "type" or maxzoom at the top level of a layer
        if (context.type === "PropertyValue") {
          const specInfo = (styleSpec.layer as any)[context.propertyName!];
          if (specInfo && specInfo.type === "enum") {
            context.values = valuesToCompletions(specInfo.values);
          }
        } else {
          const info = styleSpec.layer as any;
          for (const key in info) {
            // Exclue values like id, source-layer, id
            if (info[key].type !== "string") {
              context.values.push({
                label: key,
                detail: info[key].doc,
              });
            }
          }
        }
      } else if (
        property.parent?.name === "Object" &&
        property.parent?.parent?.name === "Property"
      ) {
        // nested within something like layout or paint
        // we'll need the layer type to get completions
        const layerParent = property.parent.parent.parent;
        if (layerParent) {
          context.layer.type = layerTypeFromNode(
            layerParent,
            completionContext
          );
          if (context.layer.type) {
            const parentPropertyNameNode = property.parent.parent.firstChild;
            if (parentPropertyNameNode) {
              const parentPropertyName = contextState
                .sliceDoc(
                  parentPropertyNameNode.from,
                  parentPropertyNameNode.to
                )
                .replace(/"/g, "");
              context.parentProperty = {
                name: parentPropertyName,
                specKey: parentPropertyName + "_" + context.layer.type!,
              };
              if (context.type === "PropertyValue") {
                const specInfo = (styleSpec as any)[
                  context.parentProperty.specKey
                ][context.propertyName!];
                if (specInfo && specInfo.type === "enum") {
                  context.values = valuesToCompletions(specInfo.values);
                }
              } else {
                const info = (styleSpec as any)[context.parentProperty.specKey];
                for (const key in info) {
                  context.values.push({
                    label: key,
                    detail: info[key].doc,
                  });
                }
              }
            }
          }
        }
      } else if (property.name === "Array") {
        const children = property.getChildren("String");
        if (children.length) {
          const [functionName, ...args] = children.map((node) => {
            return contextState.sliceDoc(node.from, node.to).replace(/"/g, "");
          });
          // @ts-ignore
          const nodeIsFunctionName = children[0].index === node.index;
          if (nodeIsFunctionName) {
            context.values = valuesToCompletions(
              styleSpec.expression_name.values
            );
          } else {
            let argumentPosition = children.findIndex(
              // @ts-ignore
              (child) => child.index === node.index
            );
            if (argumentPosition > -1) {
              argumentPosition--;
            }

            if (
              layer?.attributes?.length &&
              functionName === "get" &&
              argumentPosition === 0
            ) {
              context.values = layer.attributes.map((a) => {
                return {
                  label: a.attribute,
                  detail: a.type,
                };
              });
            }
          }
        }
        // we're in an argument to a function?
      }
    }
    return context as StyleContext;
  }
}

function layerTypeFromNode(node: SyntaxNode, context: CompletionContext) {
  for (const child of node.getChildren("Property")) {
    const propName = child.firstChild;
    if (propName) {
      const name = context.state.sliceDoc(propName.from, propName.to);
      if (name === `"type"` && child.lastChild) {
        const propValue = child.lastChild;
        return context.state
          .sliceDoc(propValue.from, propValue.to)
          .replace(/"/g, "");
      }
    }
  }
}

function valuesToCompletions(values: { [label: string]: { doc?: string } }) {
  const completions: { label: string; detail?: string }[] = [];
  for (const label of Object.keys(values)) {
    completions.push({
      label,
      detail: values[label].doc,
    });
  }
  return completions;
}

interface StyleContext {
  type: "PropertyValue" | "PropertyName";
  layer: {
    type?: string;
  };
  parentProperty?: {
    name: string;
    specKey: string;
  };
  propertyName?: string;
  values: { label: string; detail?: string }[];
}
