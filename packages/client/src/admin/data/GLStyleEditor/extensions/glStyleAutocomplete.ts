/* eslint-disable i18next/no-literal-string */
import { CompletionContext, Completion } from "@codemirror/autocomplete";
import { syntaxTree } from "@codemirror/language";
import { SyntaxNode } from "@lezer/common";
import styleSpec from "mapbox-gl/src/style-spec/reference/v8.json";
import { GeoJsonGeometryTypes } from "geojson";
import { formatJSONCommand } from "../formatCommand";
import { schemeTableau10, interpolatePlasma } from "d3-scale-chromatic";

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
    } else if (
      around.type.name !== "String" &&
      around.type.name !== "PropertyValue" &&
      around.type.name !== "PropertyName"
    ) {
      if (context.explicit) {
        return {
          from: word.from,
          options: [
            {
              label: "Test",
              info: "Test",
            },
          ],
        };
      }
      return null;
    } else {
      const evaluatedContext = evaluateStyleContext(around, context);
      if (evaluatedContext) {
        const completions = getCompletionsForEvaluatedContext(
          evaluatedContext,
          layer
        );
        if (completions && completions.length) {
          return {
            from: word.from,
            options: completions,
          };
        }
      }
      return null;
    }
  };

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

type LayerType =
  | "fill"
  | "line"
  | "symbol"
  | "circle"
  | "raster"
  | "background";

type PropertyValueType =
  | "color"
  | "opacity"
  | "resolvedImage"
  | "number"
  | "boolean"
  | "paint"
  | "layout"
  | string;

interface PropertyNameOption {
  name: string;
  doc: string;
  valueType: PropertyValueType;
}

interface LayerRootPropertyNameStyleContext {
  type: "LayerRootPropertyName";
  /** Properties that have already been specified */
  usedPropertyNames: string[];
  values: PropertyNameOption[];
}

interface LayerRootPropertyValueStyleContext {
  type: "LayerRootPropertyValue";
  propertyName: string;
  propertyValueType: PropertyValueType;
  enumValues?: { value: string; doc: string }[];
  expressions:
    | false
    | {
        supported: boolean;
        feature: boolean;
        zoom: boolean;
        interpolate: boolean;
      };
}

interface PropertyNameStyleContext {
  category: "layout" | "paint";
  type: "PropertyName";
  layerType: LayerType;
  values: PropertyNameOption[];
}

interface PropertyValueStyleContext {
  category: "layout" | "paint";
  type: "PropertyValue";
  layerType: LayerType;
  propertyName: string;
  propertyValueType: PropertyValueType;
  enumValues?: { value: string; doc: string }[];
  expressions:
    | false
    | {
        feature: boolean;
        zoom: boolean;
        interpolate: boolean;
      };
}

interface ExpressionFnStyleContext {
  type: "ExpressionFn";
  propertyContext: PropertyValueStyleContext;
  isRootExpression: boolean;
  matchingValues: { name: string; doc: string; group?: string }[];
  ArrayNode: SyntaxNode;
}

interface ExpressionArgStyleContext {
  type: "ExpressionArg";
  propertyContext: PropertyValueStyleContext;
  isRootExpression: boolean;
  // not implemented but may be a good idea for future improvement
  // parentExpressionArgContext?: ExpressionArgStyleContext;
  expressionFnName: string;
  position: number;
  /** If a sibling argument uses a get expression to get an attribute value, include that attributes name */
  siblingGetAttribute?: string;
  siblingStringArgumentValues: string[];
  isLastArgument: boolean;
}

type EvaluatedStyleContext =
  | LayerRootPropertyNameStyleContext
  | LayerRootPropertyValueStyleContext
  | PropertyNameStyleContext
  | PropertyValueStyleContext
  | ExpressionFnStyleContext
  | ExpressionArgStyleContext;

const BANNED_PROPERTY_NAMES = ["id", "source", "source-layer"];

/**
 * Parses the style document and returns a context object with details of the
 * document structure at the given node and the autocomplete options available,
 * extracted from the mapbox-gl-style schema.
 *
 * This function returns both the standard autocomplete options and some extra
 * details about the surrounding context so that more complex "snippet" options
 * can be built if needed. For example, if the user is working on a fill
 * property value, additional code could build an interpolate-hcl snippet based
 * on the knowlege that the context is a PropertyValue and the value expected
 * is color.
 *
 * The implementation works by walking up the syntax tree from the given node
 * until reaching the root, and then building up knowlege of the context while
 * walking back down the tree. For example, determining note only that
 * autcomplete is requested for an expression, but that the expression is
 * embedded within fill layer -> paint -> fill-color.
 *
 * @param node SyntaxNode where autocomplete is being requested. Must be one of:
 *   * Property value
 *   * Property name
 *   * Expression function name
 *   * Expression function string argument
 *
 *   Otherwise null will be returned.
 * @param context CompletionContext
 * @returns EvaluatedStyleContext | null
 */
function evaluateStyleContext(
  node: SyntaxNode,
  context: CompletionContext
): EvaluatedStyleContext | null {
  // This function only works if the cursor is within a property name or value,
  // or an expression function name or string argument.
  if (
    node.type.name !== "String" &&
    node.type.name !== "PropertyValue" &&
    node.type.name !== "PropertyName"
  ) {
    return null;
  }
  // Walk up the syntax tree until we reach the root, building up a list of
  // nodes in path along the way. Path is listed from top level to the node.
  const { jsonTextRoot, path } = getRoot(node);
  if (path.length < 4) {
    // Not far enough into the document to provide any autocomplete context
    // The cursor is outside any property of a layer object
    return null;
  }
  const LayerObject = path[INDEXES.LayerObject];
  if (path.length === 4) {
    // Working directly on a Layer object.
    if (node.type.name === "PropertyName") {
      // Cursor is working on a property name within the layer object
      const currentValue = context.state
        .sliceDoc(node.from, node.to)
        .replace(/[":]/g, "");
      // Get a list of all property names that are not already used, as well
      // as banned property names that should not be suggested like source & id.
      const excludedPropertyNames = [
        ...BANNED_PROPERTY_NAMES,
        ...getPropertyNamesFromObject(LayerObject, context),
      ].filter((v) => v !== currentValue);
      // Return context indicating that the user is working on a property name
      // directly on the layer object, and provide a list of all property names
      // that are not already used.
      return {
        type: "LayerRootPropertyName",
        values: Object.entries(styleSpec.layer)
          .filter(([name]) => !excludedPropertyNames.includes(name))
          .map((entry) => {
            const [name, details] = entry;
            return {
              name,
              doc: details.doc,
              valueType: details.type,
            };
          }),
      } as LayerRootPropertyNameStyleContext;
    } else if (
      node.type.name === "PropertyValue" ||
      node.type.name === "String"
    ) {
      // Working on a property value directly on a layer object
      const propertyName = getPropertyName(
        path[INDEXES.LayerProperty],
        context
      );
      if (!propertyName || propertyName === "") {
        // If the property name is missing or blank we lack knowledge to provide
        // any autocomplete context.
        return null;
      }

      // @ts-ignore
      const spec = styleSpec["layer"][propertyName];
      if (!spec) {
        return null;
      }

      // Return context indicating that the user is working on a property value
      // directly on the layer object, and provide a list of all possible values
      // for the property.
      return {
        type: "LayerRootPropertyValue",
        propertyName,
        propertyValueType: spec.type,
        enumValues: spec.values
          ? Object.entries(spec.values).map(([value, details]) => ({
              value,
              doc: (details as any).doc,
            }))
          : undefined,
        expressions: false,
      } as LayerRootPropertyValueStyleContext;
    } else {
      // It shouldn't really be possible to reach here, so I'm issuing a
      // warning for future debugging.
      console.error("Unexpected node type", node.type.name);
      return null;
    }
  } else {
    // working on an expression within filter, or within a layout or paint
    // property (or deeper)
    const layerPropertyName = getPropertyName(
      path[INDEXES.LayerProperty],
      context
    );
    if (!layerPropertyName || layerPropertyName === "") {
      return null;
    }
    if (layerPropertyName === "filter") {
      // TODO: work on expression here
      return null;
    } else if (
      layerPropertyName === "layout" ||
      layerPropertyName === "paint"
    ) {
      const layerType = layerTypeFromNode(LayerObject, context);
      if (!layerType) {
        return null;
      }
      const currentProperty = path[INDEXES.SubProperty];
      const currentPropertyName = getPropertyName(currentProperty, context);
      const specKey = `${layerPropertyName}_${layerType}`;
      // @ts-ignore
      const specBase = styleSpec[specKey];
      if (path.length >= 6) {
        // working within a property underneath layout or paint. Possibly within
        // an expression
        if (node.type.name === "PropertyName") {
          return {
            type: "PropertyName",
            category: layerPropertyName,
            layerType,
            values: Object.keys(specBase).map((name) => ({
              name,
              doc: specBase[name].doc,
              valueType: specBase[name].type,
            })),
          } as PropertyNameStyleContext;
        } else if (
          node.type.name === "PropertyValue" ||
          node.type.name === "String"
        ) {
          // within the property value. Possibly embedded within an expression
          if (!currentPropertyName) {
            // Don't have enough information to provide autocomplete context
            return null;
          }
          const currentPropertySpec = specBase[currentPropertyName];
          if (!currentPropertySpec) {
            // Don't have enough information to provide autocomplete context
            return null;
          }
          const currentPropertyContext = {
            type: "PropertyValue",
            category: layerPropertyName,
            layerType,
            propertyName: currentPropertyName,
            propertyValueType: currentPropertySpec.type,
            enumValues: currentPropertySpec.values
              ? Object.entries(currentPropertySpec.values).map(
                  ([value, details]) => ({
                    value,
                    doc: (details as any).doc,
                  })
                )
              : undefined,
            expressions: currentPropertySpec.expression
              ? {
                  supported: true,
                  feature:
                    currentPropertySpec.expression!.parameters.includes(
                      "feature"
                    ),
                  zoom: currentPropertySpec.expression!.parameters.includes(
                    "zoom"
                  ),
                  interpolate: Boolean(
                    currentPropertySpec.expression!.interpolated
                  ),
                }
              : false,
          } as PropertyValueStyleContext;
          if (path.length === 6) {
            // working directly on a string value of the property
            return currentPropertyContext;
          } else {
            // within an expression. possibly many levels deep
            // get the expression node (the Array node)
            const ArrayNode = node.parent;
            if (!ArrayNode || ArrayNode.type.name !== "Array") {
              console.warn("Expected Array node", ArrayNode?.type.name);
              return null;
            }
            const ExpressionFnNameNode = ArrayNode.getChild("String");
            if (
              !ExpressionFnNameNode ||
              ExpressionFnNameNode.type.name !== "String"
            ) {
              console.warn(
                "Expected String node",
                ExpressionFnNameNode?.type.name
              );
              return null;
            }
            const currentExpressionName = context.state
              .sliceDoc(ExpressionFnNameNode.from, ExpressionFnNameNode.to)
              .replace(/"/g, "");

            let position = 0;
            let child = node;
            while (child.prevSibling && child.prevSibling.type.name !== "[") {
              child = child.prevSibling;
              position++;
            }

            const isFnName = position === 0;
            const argPosition = position - 1;
            const isRootExpression = path.length === 7;

            if (isFnName) {
              return {
                type: "ExpressionFn",
                isRootExpression,
                propertyContext: currentPropertyContext,
                matchingValues: Object.entries(
                  styleSpec.expression_name.values
                ).map(([name, details]) => ({
                  name,
                  doc: (details as any).doc,
                  group: (details as any).group,
                })),
                ArrayNode,
              } as ExpressionFnStyleContext;
            } else {
              // Find any sibling arguments that use a get expression to get an
              // attribute value
              let siblingGetAttribute: string | undefined;
              if (currentExpressionName !== "get") {
                const siblingExpressions = ArrayNode.getChildren("Array");
                for (const arrNode of siblingExpressions) {
                  if (arrNode.type.name === "Array") {
                    const firstChild = arrNode.getChild("String");
                    if (firstChild && firstChild.type.name === "String") {
                      const fnName = context.state
                        .sliceDoc(firstChild.from, firstChild.to)
                        .replace(/[":]/g, "");
                      if (fnName === "get") {
                        const argNode = arrNode.getChildren("String")[1];
                        if (argNode) {
                          const attributeValue = context.state
                            .sliceDoc(argNode.from, argNode.to)
                            .replace(/"/g, "");

                          if (attributeValue.length > 0) {
                            siblingGetAttribute = attributeValue;
                          }
                        }
                      }
                    }
                  }
                }
              }
              const siblingStringArgumentValues = ArrayNode.getChildren(
                "String"
              ).map((node) =>
                context.state.sliceDoc(node.from, node.to).replace(/"/g, "")
              );

              return {
                type: "ExpressionArg",
                expressionFnName: currentExpressionName,
                position: argPosition,
                isRootExpression,
                propertyContext: currentPropertyContext,
                siblingGetAttribute,
                isLastArgument: !(
                  node.nextSibling && node.nextSibling.type.name !== "]"
                ),
                siblingStringArgumentValues,
              } as ExpressionArgStyleContext;
            }
          }
        } else {
          // It shouldn't really be possible to reach here, so I'm issuing a
          // warning for future debugging.
          console.warn("Unexpected node type", node.type.name);
          return null;
        }
      } else {
        return null;
      }
    } else {
      return null;
    }
  }
}

function getPropertyName(node: SyntaxNode, context: CompletionContext) {
  if (node.type.name !== "Property") {
    throw new Error("Expected Property node");
  }
  const PropName = node.getChild("PropertyName");
  if (!PropName) {
    return null;
  }
  const propName = context.state.sliceDoc(PropName.from, PropName.to);
  return propName.toString().replace(/[":]/g, "");
}

function getPropertyNamesFromObject(
  node: SyntaxNode,
  context: CompletionContext
) {
  if (node.type.name !== "Object") {
    throw new Error("Expected Object node");
  }
  const properties = node.getChildren("Property");
  return properties.map((p) => {
    const PropName = p.getChild("PropertyName");
    if (PropName) {
      const propName = context.state.sliceDoc(PropName.from, PropName.to);
      return propName.toString().replace(/[":]/g, "");
    } else {
      return "";
    }
  });
}

const BOOSTS: { [name: string]: number } = {
  type: 2,
  layout: 1,
  paint: 1,
};

const COLOR_COMPLETIONS: Completion[] = [
  {
    label: "white",
  },
  {
    label: "black",
  },
  {
    label: "transparent",
  },
  {
    label: "red",
  },
  {
    label: "green",
  },
  {
    label: "blue",
  },
  {
    label: "yellow",
  },
  {
    label: "orange",
  },
  {
    label: "purple",
  },
  {
    label: "pink",
  },
  {
    label: "gray",
  },
  {
    label: "brown",
  },
];

function replaceExpressionCompletion(
  expressionNode: SyntaxNode,
  {
    label,
    info,
    expression,
    detail,
  }: { label: string; info?: string; detail?: string; expression: string }
) {
  return {
    label,
    info,
    detail,
    apply: (view, completion, from, to) => {
      view.dispatch({
        changes: {
          from: expressionNode.from,
          to: expressionNode.to,
          insert: expression,
        },
      });
      formatJSONCommand(view);
    },
  } as Completion;
}

function getPlaceholderValue(
  context: PropertyValueStyleContext,
  index: number,
  type: "categorical" | "linear" = "categorical"
) {
  const { propertyValueType } = context;
  if (propertyValueType === "color") {
    if (type === "categorical") {
      return `"${schemeTableau10[index]}"`;
    } else {
      return `"${interpolatePlasma(index)}"`;
    }
  } else if (propertyValueType === "number") {
    return `${index}`;
  } else if (propertyValueType === "boolean") {
    return `${index % 2 === 0}`;
  } else if (propertyValueType === "enum" && context.enumValues) {
    return `"${context.enumValues[index].value}"`;
  } else {
    return `"${index}"`;
  }
}

function getCompletionsForEvaluatedContext(
  styleContext: EvaluatedStyleContext,
  layer?: GeostatsLayer
) {
  const completions: Completion[] = [];
  if (
    styleContext.type === "LayerRootPropertyName" ||
    styleContext.type === "PropertyName"
  ) {
    for (const value of styleContext.values) {
      completions.push({
        label: value.name,
        detail: value.valueType,
        info: value.doc,
        // boost: BOOSTS[value.name],
      });
    }
  } else if (
    styleContext.type === "LayerRootPropertyValue" ||
    styleContext.type === "PropertyValue"
  ) {
    if (styleContext.enumValues && styleContext.enumValues.length > 0) {
      for (const value of styleContext.enumValues) {
        completions.push({
          label: value.value,
          info: value.doc,
          // boost: BOOSTS[value.value],
        });
      }
    }
    if (styleContext.propertyValueType === "color") {
      completions.push(...COLOR_COMPLETIONS);
    }
  } else if (styleContext.type === "ExpressionFn") {
    const valueType = styleContext.propertyContext.propertyValueType;
    for (const value of styleContext.matchingValues) {
      if (
        (value.name !== "interpolate-hcl" &&
          value.name !== "interpolate-lab") ||
        valueType === "color"
      ) {
        completions.push({
          label: value.name,
          info: value.doc,
          // boost: BOOSTS[value.name],
        });
      }
    }

    if (valueType !== "color") {
      // Unlikely to have valid color value in feature properties
      completions.push(
        ...(layer?.attributes || []).map(
          (a) =>
            ({
              label: `get(${a.attribute})`,
              detail: a.type,
              apply: (view, completion, from, to) => {
                // TODO: move cursor to appropriate position after insertion
                view.dispatch({
                  changes: {
                    from: styleContext.ArrayNode.from,
                    to: styleContext.ArrayNode.to,
                    insert: `["get", "${a.attribute}"]`,
                  },
                });
              },
            } as Completion)
        )
      );
    }

    // Add "snippets" that insert complex decision function populated with
    // matching property values from the data
    if (styleContext.isRootExpression) {
      // Zoom expressions
      const expressions = styleContext.propertyContext.expressions;
      if (expressions && expressions.zoom) {
        // interpolate
        if (expressions.interpolate) {
          completions.push(
            replaceExpressionCompletion(styleContext.ArrayNode, {
              label: "interpolate(zoom)",
              info: "Interpolate expression with pre-populated zoom values",
              expression: `
          [
            "interpolate",
            ["linear"],
            ["zoom"],
            10,
            ${getPlaceholderValue(
              styleContext.propertyContext,
              1 / 3,
              "linear"
            )},
            12,
            ${getPlaceholderValue(
              styleContext.propertyContext,
              3 / 3,
              "linear"
            )},
            16,
            ${getPlaceholderValue(
              styleContext.propertyContext,
              3 / 3,
              "linear"
            )},
          ]`,
            })
          );
          if (valueType === "color") {
            // Add interpolate-hcl
            completions.push(
              replaceExpressionCompletion(styleContext.ArrayNode, {
                label: "interpolate-hcl(zoom)",
                info: "Interpolate HCL expression with pre-populated zoom values",
                expression: `
            [
              "interpolate-hcl",
              ["linear"],
              ["zoom"],
              10,
              ${getPlaceholderValue(
                styleContext.propertyContext,
                1 / 3,
                "linear"
              )},
              12,
              ${getPlaceholderValue(
                styleContext.propertyContext,
                2 / 3,
                "linear"
              )},
              16,
              ${getPlaceholderValue(
                styleContext.propertyContext,
                3 / 3,
                "linear"
              )},
            ]`,
              })
            );

            // Add interpolate-lab
            completions.push(
              replaceExpressionCompletion(styleContext.ArrayNode, {
                label: "interpolate-lab(zoom)",
                info: "Interpolate lab expression with pre-populated zoom values",
                expression: `
            [
              "interpolate-lab",
              ["linear"],
              ["zoom"],
              10,
              ${getPlaceholderValue(
                styleContext.propertyContext,
                1 / 3,
                "linear"
              )},
              12,
              ${getPlaceholderValue(
                styleContext.propertyContext,
                2 / 3,
                "linear"
              )},
              16,
              ${getPlaceholderValue(
                styleContext.propertyContext,
                3 / 3,
                "linear"
              )},
            ]`,
              })
            );
          }
        }
        completions.push(
          replaceExpressionCompletion(styleContext.ArrayNode, {
            label: "step(zoom)",
            info: "Step expression with pre-populated zoom values",
            expression: `
          [
            "step",
            ["zoom"],
            ${valueType === "color" ? `"${interpolatePlasma(1 / 4)}"` : 1},
            10,
            ${valueType === "color" ? `"${interpolatePlasma(2 / 4)}"` : 3},
            12,
            ${valueType === "color" ? `"${interpolatePlasma(3 / 4)}"` : 5},
            14,
            ${valueType === "color" ? `"${interpolatePlasma(4 / 4)}"` : 7}
          ]`,
          })
        );
      }

      for (const attribute of layer?.attributes || []) {
        // add match
        if (attribute.type === "boolean" || attribute.type === "string") {
          completions.push(
            replaceExpressionCompletion(styleContext.ArrayNode, {
              label: `match(${attribute.attribute})`,
              info: "Match expression with pre-populated values",
              detail: `${attribute.type} ${attribute.count} values`,
              expression: `
            [
              "match",
              ["get", "${attribute.attribute}"],
              ${attribute.values
                .filter((v) => v !== null)
                .map((v, i) => {
                  const strValue =
                    typeof v === "string"
                      ? `"${v.replace(/"/g, '\\"')}"`
                      : v!.toString();
                  return `${strValue}, ${
                    valueType === "color"
                      ? `"${schemeTableau10[i % 10]}"`
                      : styleContext.propertyContext.propertyValueType ===
                          "enum" &&
                        styleContext.propertyContext.enumValues &&
                        styleContext.propertyContext.enumValues.length > 0
                      ? `"${
                          styleContext.propertyContext.enumValues[
                            i % styleContext.propertyContext.enumValues.length
                          ].value
                        }"`
                      : i
                  }`;
                })
                .join(",\n")}
              , ${
                // add default value to end
                valueType === "color"
                  ? `"black"`
                  : styleContext.propertyContext.propertyValueType === "enum" &&
                    styleContext.propertyContext.enumValues &&
                    styleContext.propertyContext.enumValues.length > 0
                  ? `"${styleContext.propertyContext.enumValues[0].value}"`
                  : 0
              }
            ]`,
            })
          );
        }
      }
    }
  } else if (styleContext.type === "ExpressionArg") {
    switch (styleContext.expressionFnName) {
      case "get":
        if (styleContext.position === 0) {
          completions.push(
            ...(layer?.attributes || []).map((a) => {
              return {
                label: a.attribute,
                detail: a.type,
              };
            })
          );
        }
        break;
      case "has":
        if (styleContext.position === 0) {
          completions.push(
            ...(layer?.attributes || []).map((a) => ({
              label: a.attribute,
              detail: a.type,
            }))
          );
        }
        break;
      case "==":
      case "!=":
        if (styleContext.siblingGetAttribute) {
          const relatedAttr = layer?.attributes?.find(
            (a) => a.attribute === styleContext.siblingGetAttribute
          );
          if (relatedAttr && relatedAttr.type === "string") {
            completions.push(
              ...relatedAttr.values.map((v) => {
                return {
                  label: v!.toString(),
                };
              })
            );
          }
        }
        break;
      case "match":
        if (styleContext.position > 0) {
          const even = styleContext.position % 2 === 0;
          if (!even) {
            const relatedAttr = layer?.attributes?.find(
              (a) => a.attribute === styleContext.siblingGetAttribute
            );
            if (relatedAttr && relatedAttr.type === "string") {
              completions.push(
                ...relatedAttr.values
                  .filter(
                    (v) =>
                      !styleContext.siblingStringArgumentValues.includes(
                        v as string
                      )
                  )
                  .map((v) => {
                    return {
                      label: v!.toString(),
                      boost: 1,
                    };
                  })
              );
            }
          }
          if (even || styleContext.isLastArgument) {
            // even arguments refer to the value to return
            completions.push(
              ...completionsForPropertyContext(styleContext.propertyContext)
            );
          }
        }
        break;
      case "step":
        // For step functions we can autocomplete the ouput values if color or
        // enum
        if (styleContext.position % 2 !== 0) {
          completions.push(
            ...completionsForEnumProperty(styleContext.propertyContext)
          );
        }
        break;
      case "case":
        // Should be able to autocomplete values the last two arguments
        if (styleContext.position > 0) {
          completions.push(
            ...completionsForPropertyContext(styleContext.propertyContext)
          );
        }
        break;
      case "interpolate":
      case "interpolate-lab":
      case "interpolate-hcl":
        // https://docs.mapbox.com/mapbox-gl-js/style-spec/expressions/#interpolate
        // can autocomplete the output values if output is color
        if (styleContext.propertyContext.propertyValueType === "color") {
          if (styleContext.position > 1) {
            // odd arguments refer to the value to return
            if (styleContext.position % 2 !== 0) {
              completions.push(...COLOR_COMPLETIONS);
            }
          }
        }
    }
  }
  return completions;
}

function completionsForEnumProperty(context: PropertyValueStyleContext) {
  return (context.enumValues || []).map((v) => {
    return {
      label: v.value,
      info: v.doc,
    };
  }) as Completion[];
}

function completionsForPropertyContext(context: PropertyValueStyleContext) {
  const completions: Completion[] = [];
  switch (context.propertyValueType) {
    case "enum":
      completions.push(...completionsForEnumProperty(context));
      break;
    case "color":
      completions.push(...COLOR_COMPLETIONS);
      break;
  }
  return completions;
}

const INDEXES = {
  LayerArray: 0,
  LayerObject: 1,
  LayerProperty: 2,
  SubProperty: 4,
};

function getRoot(
  node: SyntaxNode,
  path: SyntaxNode[] = []
): { jsonTextRoot: SyntaxNode; path: SyntaxNode[] } {
  if (node.parent) {
    path.push(node);
    return getRoot(node.parent, path);
  } else {
    return { jsonTextRoot: node, path: path.reverse() };
  }
}
