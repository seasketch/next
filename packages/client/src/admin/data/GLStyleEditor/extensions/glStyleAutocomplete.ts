/* eslint-disable i18next/no-literal-string */
import { CompletionContext, Completion } from "@codemirror/autocomplete";
import { syntaxTree } from "@codemirror/language";
import { SyntaxNode } from "@lezer/common";
import styleSpec from "mapbox-gl/src/style-spec/reference/v8.json";
import { GeoJsonGeometryTypes } from "geojson";
import { formatJSONCommand } from "../formatCommand";
import { SpriteDetailsFragment } from "../../../../generated/graphql";
import { ExtendedGeostatsLayer } from "../GLStyleEditor";
import {
  schemeTableau10,
  interpolatePlasma as interpolateColorScale,
} from "d3-scale-chromatic";

console.log(
  [1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((n) => interpolateColorScale(n / 10))
);
export interface GeostatsAttribute {
  attribute: string;
  count: number;
  type: GeostatsAttributeType;
  values: (string | number | boolean | null)[];
  min?: number;
  max?: number;
  quantiles?: number[];
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

type LayerType =
  | "fill"
  | "line"
  | "symbol"
  | "circle"
  | "raster"
  | "background"
  | "heatmap";

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
  defaultValue?: any;
}

interface RootContext {
  type: "Root";
  existingLayerTypes: LayerType[];
  ArrayNode: SyntaxNode;
}

interface LayerRootPropertyNameStyleContext {
  type: "LayerRootPropertyName";
  value?: string;
  values: PropertyNameOption[];
  PropertyNode: SyntaxNode;
  hasValue: boolean;
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
  value: string;
}

interface PropertyNameStyleContext {
  category: "layout" | "paint";
  type: "PropertyName";
  layerType: LayerType;
  values: PropertyNameOption[];
  PropertyNode: SyntaxNode;
  hasValue: boolean;
  value?: string;
}

interface PropertyValueStyleContext {
  category: "layout" | "paint" | "filter";
  type: "PropertyValue";
  layerType: LayerType;
  propertyName: string;
  propertyValueType: PropertyValueType;
  enumValues?: { value: string; doc: string }[];
  ContainerNode: SyntaxNode;
  expressions:
    | false
    | {
        feature: boolean;
        zoom: boolean;
        interpolate: boolean;
      };
  value: string;
}

interface ExpressionFnStyleContext {
  type: "ExpressionFn";
  propertyContext: PropertyValueStyleContext;
  isRootExpression: boolean;
  matchingValues: { name: string; doc: string; group?: string }[];
  SurroundingNode: SyntaxNode;
  value?: string;
}

interface InterpolationTypeStyleContext {
  type: "InterpolationType";
  propertyContext: PropertyValueStyleContext;
  isRootExpression: boolean;
  SurroundingNode: SyntaxNode;
  value?: string;
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
  | ExpressionArgStyleContext
  | RootContext
  | InterpolationTypeStyleContext;

export interface InsertLayerOption {
  type: LayerType;
  label: string;
  propertyChoice?: {
    property: string;
    values?: any[];
    min?: number;
    max?: number;
    type: PropertyValueType;
    typeArrayOf?: PropertyValueType;
  };
  layer: any;
}

export const glStyleAutocomplete =
  (layer?: GeostatsLayer, sprites?: SpriteDetailsFragment[]) =>
  (context: CompletionContext) => {
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
      around.type.name === "String" ||
      around.type.name === "PropertyValue" ||
      around.type.name === "PropertyName" ||
      (context.explicit &&
        around.type.name === "Array" &&
        around.parent?.type.name === "JsonText")
    ) {
      const evaluatedContext = evaluateStyleContext(around, context);
      if (evaluatedContext) {
        const completions = getCompletionsForEvaluatedContext(
          evaluatedContext,
          sprites || [],
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
    return null;
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
          .replace(/"/g, "") as LayerType;
      }
    }
  }
}

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
export function evaluateStyleContext(
  node: SyntaxNode,
  context: CompletionContext
): EvaluatedStyleContext | null {
  let styleContext: EvaluatedStyleContext | null = null;
  if (
    node.type.name === "Array" &&
    node.parent?.type.name === "JsonText" &&
    context.explicit
  ) {
    styleContext = {
      type: "Root",
      existingLayerTypes: node
        .getChildren("Object")
        .map((layer) => {
          for (const property of layer.getChildren("Property")) {
            const PropertyName = property.getChild("PropertyName");
            if (PropertyName) {
              const name = context.state.sliceDoc(
                PropertyName.from,
                PropertyName.to
              );
              if (name === `"type"` && property.lastChild) {
                const propValue = property.lastChild;
                return context.state
                  .sliceDoc(propValue.from, propValue.to)
                  .replace(/"/g, "") as LayerType;
              }
            }
          }
        })
        .filter((v) => v) as LayerType[],
      ArrayNode: node,
    };
    return styleContext;
  }
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
      const usedPropertyNames = getPropertyNamesFromObject(
        LayerObject,
        context
      );
      const currentProperty = node.parent!;
      // Get a list of all property names that are not already used, as well
      // as banned property names that should not be suggested like source & id.
      const excludedPropertyNames = [
        ...BANNED_PROPERTY_NAMES,
        ...usedPropertyNames,
      ].filter((v) => v !== currentValue);
      // Return context indicating that the user is working on a property name
      // directly on the layer object, and provide a list of all property names
      // that are not already used.
      styleContext = {
        type: "LayerRootPropertyName",
        value: currentValue,
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
        PropertyNode: currentProperty,
        hasValue: Boolean(
          currentProperty.getChild("PropertyVaue") ||
            currentProperty.getChild("String")
        ),
      };
      return styleContext;
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
      styleContext = {
        type: "LayerRootPropertyValue",
        value: context.state.sliceDoc(node.from, node.to).replace(/"/g, ""),
        propertyName,
        propertyValueType: spec.type,
        enumValues: spec.values
          ? Object.entries(spec.values).map(([value, details]) => ({
              value,
              doc: (details as any).doc,
            }))
          : undefined,
        expressions: false,
      };
      return styleContext;
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
    if (
      layerPropertyName === "layout" ||
      layerPropertyName === "paint" ||
      layerPropertyName === "filter"
    ) {
      const layerType = layerTypeFromNode(LayerObject, context);
      if (!layerType) {
        return null;
      }
      const currentProperty =
        layerPropertyName === "filter"
          ? path[INDEXES.LayerProperty]
          : path[INDEXES.SubProperty];
      const currentPropertyName = getPropertyName(currentProperty, context);
      const specKey = `${layerPropertyName}_${layerType}`;
      // @ts-ignore
      const specBase = styleSpec[specKey];
      if (path.length >= 6 || currentPropertyName === "filter") {
        // working within a property underneath layout or paint. Possibly within
        // an expression
        const usedPropertyNames = getPropertyNamesFromObject(
          currentProperty.parent!,
          context
        );
        if (
          node.type.name === "PropertyName" &&
          layerPropertyName !== "filter"
        ) {
          styleContext = {
            type: "PropertyName",
            value: currentPropertyName || undefined,
            category: layerPropertyName,
            layerType,
            hasValue: Boolean(
              currentProperty.getChild("PropertyVaue") ||
                currentProperty.getChild("String")
            ),
            PropertyNode: currentProperty,
            values: Object.keys(specBase)
              .map((name) => ({
                name,
                doc: specBase[name].doc,
                valueType: specBase[name].type,
                defaultValue: specBase[name].default,
              }))
              .filter((v) => !usedPropertyNames.includes(v.name)),
          };
          return styleContext;
        } else if (
          node.type.name === "PropertyValue" ||
          node.type.name === "String"
        ) {
          // within the property value. Possibly embedded within an expression
          if (!currentPropertyName) {
            // Don't have enough information to provide autocomplete context
            return null;
          }
          const currentPropertySpec =
            currentPropertyName === "filter"
              ? // @ts-ignore
                styleSpec[`filter_${layerType}`]
              : specBase[currentPropertyName];
          if (!currentPropertySpec) {
            // Don't have enough information to provide autocomplete context
            return null;
          }
          const currentPropertyContext: PropertyValueStyleContext = {
            type: "PropertyValue",
            value: context.state.sliceDoc(node.from, node.to).replace(/"/g, ""),
            category: layerPropertyName,
            layerType,
            propertyName: currentPropertyName,
            ContainerNode: currentProperty,
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
          };
          if (path.length === 6 && currentPropertyName !== "filter") {
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
            let argPosition = position - 1;
            const isRootExpression =
              currentPropertyName === "filter"
                ? path.length === 5
                : path.length === 7;

            if (isFnName) {
              if (!isRootExpression) {
                const ParentExpressionName =
                  ArrayNode.parent?.getChild("String");
                if (
                  ParentExpressionName &&
                  ParentExpressionName.type.name === "String"
                ) {
                  const parentExpressionName = context.state.sliceDoc(
                    ParentExpressionName.from,
                    ParentExpressionName.to
                  );
                  if (/interpolate/.test(parentExpressionName)) {
                    let position = 0;
                    let child = ArrayNode;
                    while (
                      child.prevSibling &&
                      child.prevSibling.type.name !== "["
                    ) {
                      child = child.prevSibling;
                      position++;
                    }
                    if (position === 1) {
                      styleContext = {
                        type: "InterpolationType",
                        value: currentExpressionName,
                        isRootExpression,
                        propertyContext: currentPropertyContext,
                        SurroundingNode: ArrayNode,
                      };
                      return styleContext;
                    }
                  }
                }
              }
              styleContext = {
                type: "ExpressionFn",
                value: currentExpressionName,
                isRootExpression,
                propertyContext: currentPropertyContext,
                matchingValues: Object.entries(
                  styleSpec.expression_name.values
                ).map(([name, details]) => ({
                  name,
                  doc: (details as any).doc,
                  group: (details as any).group,
                })),
                SurroundingNode: ArrayNode,
              };
              return styleContext;
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

              styleContext = {
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
              };
              return styleContext;
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
    group,
  }: {
    label: string;
    info?: string;
    detail?: string;
    expression: string;
    group?: string;
  }
) {
  return {
    label,
    info,
    detail,
    section: group,
    apply: (view, completion, from, to) => {
      const insertComma = expressionNode.parent!.nextSibling?.type.name === "⚠";

      view.dispatch({
        changes: {
          from: expressionNode.from,
          to: expressionNode.to,
          insert: insertComma ? expression + ", " : expression,
        },
        scrollIntoView: true,
        selection: {
          anchor: expressionNode.from + expression.length,
        },
      });
      formatJSONCommand(view);
    },
  } as Completion;
}

function replacePropertyCompletion(
  propertyNode: SyntaxNode,
  {
    label,
    info,
    detail,
    expression,
    section,
  }: Completion & { expression: string; section?: string }
) {
  return {
    label,
    info,
    detail,
    section,
    apply: (view, completion, from, to) => {
      const errors = propertyNode.getChild("⚠");
      const nextSibling = propertyNode.nextSibling;
      const nextSiblingType = nextSibling?.type.name;
      let insertComma = Boolean(errors);
      if (
        nextSibling &&
        errors &&
        propertyNode.to === nextSibling?.from &&
        nextSiblingType === "}"
      ) {
        // Inserting a new property at the end of an object, butted up agains
        // the ending }. Should not insert a comma.
        insertComma = false;
      } else if (nextSibling && errors && propertyNode.to < nextSibling?.from) {
        // Inserting a new property in the middle or at the begining of an
        // object. Should insert a comma.
        insertComma = true;
      }
      view.dispatch({
        changes: {
          from: propertyNode.from,
          to: errors && insertComma ? errors.from : propertyNode.to,
          insert: insertComma ? expression + ", " : expression,
        },
        scrollIntoView: true,
        selection: {
          anchor: propertyNode.from + expression.length + (insertComma ? 1 : 2),
        },
      });
      formatJSONCommand(view);
    },
  } as Completion;
}

function getPlaceholderValue(
  context: PropertyValueStyleContext,
  index: number,
  type: "categorical" | "linear" = "categorical",
  attributeName?: string
) {
  const isScaleRank = /rank/i.test(attributeName || "");
  const { propertyValueType } = context;
  if (propertyValueType === "color") {
    if (type === "categorical") {
      return `"${schemeTableau10[index]}"`;
    } else {
      return `"${interpolateColorScale(index)}"`;
    }
  } else if (propertyValueType === "number") {
    if (isScaleRank) {
      // Flip order of values if scalerank is detected. Common in naturalearth
      // Rank goes from 0 to 10, 10 being low rank.
      index = 1 - index;
    }
    if (context.propertyName === "circle-radius") {
      return `${Math.max(1, index * 20)}`;
    } else if (/opacity/.test(context.propertyName)) {
      return Math.max(Math.min(index, 1), 0);
    } else {
      return `${Math.max(1, index * 4)}`;
    }
  } else if (propertyValueType === "boolean") {
    return `${index % 2 === 0}`;
  } else if (propertyValueType === "enum" && context.enumValues) {
    return `"${context.enumValues[index].value}"`;
  } else {
    return `"${index}"`;
  }
}

let colorChoiceCounter = 9;

function getCompletionsForEvaluatedContext(
  styleContext: EvaluatedStyleContext,
  sprites: SpriteDetailsFragment[],
  layer?: GeostatsLayer
) {
  const completions: Completion[] = [];
  if (styleContext.type === "Root") {
    return null;
  } else if (
    styleContext.type === "LayerRootPropertyName" ||
    styleContext.type === "PropertyName"
  ) {
    for (const value of styleContext.values) {
      if (
        styleContext.type === "PropertyName" &&
        value.valueType === "color" &&
        styleContext.PropertyNode &&
        !styleContext.hasValue
      ) {
        completions.push(
          replacePropertyCompletion(styleContext.PropertyNode, {
            label: value.name,
            detail: value.valueType,
            info: value.doc,
            expression: `"${value.name}": "${
              schemeTableau10[colorChoiceCounter++ % 10]
            }"`,
          })
        );
      } else if (
        styleContext.type === "PropertyName" &&
        value.defaultValue !== undefined &&
        styleContext.PropertyNode &&
        !styleContext.hasValue
      ) {
        completions.push(
          replacePropertyCompletion(styleContext.PropertyNode, {
            label: value.name,
            detail: value.valueType,
            info: value.doc,
            expression: `"${value.name}": ${
              value.valueType === "string" ||
              value.valueType === "resolvedImage" ||
              value.valueType === "enum"
                ? `"${value.defaultValue}"`
                : value.defaultValue
            }`,
          })
        );
      } else if (
        styleContext.type === "LayerRootPropertyName" &&
        !styleContext.hasValue &&
        styleContext.PropertyNode
      ) {
        let defaultValue: string | undefined;
        if (value.name === "maxzoom") {
          defaultValue = "12";
        } else if (value.name === "minzoom") {
          defaultValue = "5";
        } else if (value.name === "paint" || value.name === "layout") {
          defaultValue = "{}";
        } else if (value.name === "filter") {
          defaultValue = `["==", ["get", ""], ""]`;
        } else if (value.name === "type") {
          if (layer?.geometry === "Point" || layer?.geometry === "MultiPoint") {
            defaultValue = `"circle"`;
          } else if (
            layer?.geometry === "LineString" ||
            layer?.geometry === "MultiLineString"
          ) {
            defaultValue = `"line"`;
          } else if (
            layer?.geometry === "Polygon" ||
            layer?.geometry === "MultiPolygon"
          ) {
            defaultValue = `"fill"`;
          }
        } else if (value.valueType === "string") {
          defaultValue = `""`;
        }
        if (defaultValue) {
          completions.push(
            replacePropertyCompletion(styleContext.PropertyNode, {
              label: value.name,
              detail: value.valueType,
              info: value.doc,
              expression: `"${value.name}": ${defaultValue}`,
            })
          );
        } else {
          completions.push({
            label: value.name,
            detail: value.valueType,
            info: value.doc,
            // boost: BOOSTS[value.name],
          });
        }
      } else {
        completions.push({
          label: value.name,
          detail: value.valueType,
          info: value.doc,
          // boost: BOOSTS[value.name],
        });
      }
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
        if (
          styleContext.isRootExpression &&
          valueType === "boolean" &&
          value.group !== "Decision"
        ) {
          // Show only expressions that retunr a boolean;
          continue;
        }
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
        ...(layer?.attributes || [])
          .filter(
            (a) =>
              a.type === "boolean" ||
              styleContext.propertyContext.propertyValueType !== "boolean"
          )
          .map(
            (a) =>
              ({
                label: `get(${a.attribute})`,
                detail: a.type,
                apply: (view, completion, from, to) => {
                  // TODO: add a function to handle these types of changes
                  // TODO: add a trailing comma if needed to finish property
                  const expression = `["get", "${a.attribute}"]`;
                  view.dispatch({
                    changes: {
                      from: styleContext.SurroundingNode.from,
                      to: styleContext.SurroundingNode.to,
                      insert: expression,
                    },
                    selection: {
                      anchor:
                        styleContext.SurroundingNode.from + expression.length,
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
            replaceExpressionCompletion(styleContext.SurroundingNode, {
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
              replaceExpressionCompletion(styleContext.SurroundingNode, {
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
              replaceExpressionCompletion(styleContext.SurroundingNode, {
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
          replaceExpressionCompletion(styleContext.SurroundingNode, {
            label: "step(zoom)",
            info: "Step expression with pre-populated zoom values",
            expression: `
          [
            "step",
            ["zoom"],
            ${valueType === "color" ? `"${interpolateColorScale(1 / 4)}"` : 1},
            10,
            ${valueType === "color" ? `"${interpolateColorScale(2 / 4)}"` : 3},
            12,
            ${valueType === "color" ? `"${interpolateColorScale(3 / 4)}"` : 5},
            14,
            ${valueType === "color" ? `"${interpolateColorScale(4 / 4)}"` : 7}
          ]`,
          })
        );
      }

      for (const attribute of layer?.attributes || []) {
        // add match
        if (attribute.type === "boolean" || attribute.type === "string") {
          completions.push(
            replaceExpressionCompletion(styleContext.SurroundingNode, {
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
        if (
          attribute.type === "number" &&
          expressions &&
          expressions.interpolate &&
          attribute.min !== undefined &&
          attribute.max
        ) {
          // add interpolate
          if (attribute.quantiles?.length) {
            let quantiles = attribute.quantiles;
            if (quantiles.length === 20) {
              quantiles = quantiles.reduce((acc, q, i) => {
                if (i % 2 === 0) {
                  acc.push(q);
                }
                return acc;
              }, [] as number[]);
            }
            completions.push(
              replaceExpressionCompletion(styleContext.SurroundingNode, {
                label: `interpolate(${attribute.attribute}) quantile`,
                info: "Interpolate expression with pre-populated values, using 10 quantiles",
                detail: `${attribute.type} ${attribute.min}-${attribute.max}`,
                expression: `
            [
              ${
                styleContext.propertyContext.propertyValueType === "color"
                  ? `"interpolate-hcl"`
                  : `"interpolate"`
              },
              ["linear"],
              ["get", "${attribute.attribute}"],
              ${quantiles
                .map((q, i) => {
                  return `${q},\n ${getPlaceholderValue(
                    styleContext.propertyContext,
                    i / quantiles.length,
                    "linear",
                    attribute.attribute
                  )}`;
                })
                .join(",\n")}
              ]`,
              })
            );
          }
          completions.push(
            replaceExpressionCompletion(styleContext.SurroundingNode, {
              label: `interpolate(${attribute.attribute})`,
              info: "Interpolate expression with pre-populated values",
              detail: `${attribute.type} ${attribute.min}-${attribute.max}`,
              expression: `
              [
                ${
                  styleContext.propertyContext.propertyValueType === "color"
                    ? `"interpolate-hcl"`
                    : `"interpolate"`
                },
                ["linear"],
                ["get", "${attribute.attribute}"],
                ${attribute.min},
                ${getPlaceholderValue(
                  styleContext.propertyContext,
                  0,
                  "linear",
                  attribute.attribute
                )},
                ${attribute.max},
                ${getPlaceholderValue(
                  styleContext.propertyContext,
                  1,
                  "linear",
                  attribute.attribute
                )}
                ]`,
            })
          );
        }
        if (attribute.type === "number" && expressions && expressions.feature) {
          let quantiles = attribute.quantiles;
          // reduce the number of quantiles to about 5
          if (quantiles && quantiles.length > 5) {
            const divisor = Math.floor(quantiles.length / 5);
            if (divisor > 1) {
              quantiles = quantiles.reduce((acc, q, i) => {
                if (i % divisor === 0) {
                  acc.push(q);
                }
                return acc;
              }, [] as number[]);
            }
          }
          completions.push(
            replaceExpressionCompletion(styleContext.SurroundingNode, {
              label: `step(${attribute.attribute})`,
              info: "Step expression with pre-populated values",
              detail: `${attribute.type} ${attribute.min}-${attribute.max}`,
              expression: `
            [
              "step",
              ["get", "${attribute.attribute}"],
              ${getPlaceholderValue(
                styleContext.propertyContext,
                0,
                "linear",
                attribute.attribute
              )},
              ${
                quantiles
                  ? quantiles
                      .map((q, i) => {
                        return `${q},\n ${getPlaceholderValue(
                          styleContext.propertyContext,
                          i / quantiles!.length,
                          "linear",
                          attribute.attribute
                        )}`;
                      })
                      .join(",\n")
                  : `${attribute.min},
                  ${getPlaceholderValue(
                    styleContext.propertyContext,
                    0,
                    "linear",
                    attribute.attribute
                  )},
                  ${attribute.max},
                  ${getPlaceholderValue(
                    styleContext.propertyContext,
                    1,
                    "linear",
                    attribute.attribute
                  )}`
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
  } else if (styleContext.type === "InterpolationType") {
    completions.push(
      replaceExpressionCompletion(styleContext.SurroundingNode, {
        expression: `["linear"]`,
        label: "linear",
        info: "Interpolates linearly between the pair of stops just less than and just greater than the input",
      })
    );
    completions.push(
      replaceExpressionCompletion(styleContext.SurroundingNode, {
        expression: `["exponential", 1.2]`,
        label: "exponential",
        info: "Interpolates exponentially between the stops just less than and just greater than the input. `base` controls the rate at which the output increases: higher values make the output increase more towards the high end of the range. With values close to 1 the output increases linearly.",
      })
    );

    completions.push(
      replaceExpressionCompletion(styleContext.SurroundingNode, {
        expression: `["cubic-bezier", 0, 0.5, 1, 0.5]`,
        label: "cubic-bezier",
        info: "Interpolates using the cubic bezier curve defined by the given control points.",
      })
    );
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

function insertLayerCompletion(
  node: SyntaxNode,
  {
    label,
    info,
    layer,
  }: {
    label: string;
    info?: string;
    layer: string;
  }
) {
  return {
    label,
    info,
    apply: (view, completion, from, to) => {
      view.dispatch({
        changes: {
          from: node.to - 1,
          to: node.to - 1,
          insert: layer,
        },
        scrollIntoView: true,
        selection: {
          anchor: node.from + layer.length,
        },
      });
      formatJSONCommand(view);
    },
  } as Completion;
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

export function getInsertLayerOptions(
  layer: ExtendedGeostatsLayer,
  sprites: SpriteDetailsFragment[]
) {
  const options: InsertLayerOption[] = [];
  if (layer.geometry === "Point" || layer.geometry === "MultiPoint") {
    // Add circle types
    options.push({
      label: "Simple Circle Marker",
      type: "circle",
      layer: {
        type: "circle",
        paint: {
          "circle-radius": 5,
          "circle-color": schemeTableau10[colorChoiceCounter++ % 10],
        },
        layout: {},
      },
    });

    for (const attribute of layer.attributes.filter(
      (a) => a.type === "string"
    )) {
      options.push({
        label: "Circle Marker colored by string",
        propertyChoice: {
          property: attribute.attribute,
          ...attribute,
        },
        type: "circle",
        layer: {
          type: "circle",
          paint: {
            "circle-radius": 5,
            "circle-opacity": 0.7,
            "circle-stroke-opacity": 1,
            "circle-stroke-width": 1,
            "circle-color": [
              "match",
              ["get", attribute.attribute],
              ...attribute.values
                .filter((v) => v !== null)
                .map((v, i) => {
                  return [v, schemeTableau10[i % 10]];
                })
                .flat(),
              "black",
            ],
            "circle-stroke-color": [
              "match",
              ["get", attribute.attribute],
              ...attribute.values
                .filter((v) => v !== null)
                .map((v, i) => {
                  return [v, schemeTableau10[i % 10]];
                })
                .flat(),
              "black",
            ],
          },
          layout: {},
        },
      });
    }
    for (const attribute of layer.attributes.filter(
      (a) => a.type === "number"
    )) {
      options.push({
        label: "Circle sized by number",
        propertyChoice: {
          property: attribute.attribute,
          ...attribute,
        },
        type: "circle",
        layer: {
          type: "circle",
          paint: {
            "circle-radius": [
              "interpolate",
              ["linear"],
              ["get", attribute.attribute],
              attribute.min,
              3,
              attribute.max,
              50,
            ],
            "circle-color": schemeTableau10[colorChoiceCounter++ % 10],
            "circle-stroke-width": 1,
          },
          layout: {},
        },
      });
    }
  }
  if (layer.geometry === "Polygon" || layer.geometry === "MultiPolygon") {
    options.push({
      label: "Simple Polygon Fill",
      type: "fill",
      layer: {
        type: "fill",
        paint: {
          "fill-color": schemeTableau10[colorChoiceCounter++ % 10],
          "fill-opacity": 0.8,
        },
        layout: {},
      },
    });
    options.push({
      label: "Fill with opacity interpolated by zoom",
      type: "fill",
      layer: {
        type: "fill",
        paint: {
          "fill-color": schemeTableau10[colorChoiceCounter++ % 10],
          "fill-opacity": [
            "interpolate",
            ["linear"],
            ["zoom"],
            0,
            0,
            5,
            0,
            10,
            1,
          ],
        },
        layout: {},
      },
    });
    for (const attribute of layer.attributes || []) {
      if (
        (attribute.type === "string" &&
          (attribute.attribute !== "name" || attribute.values.length > 1)) ||
        (attribute.type === "array" &&
          attribute.typeArrayOf === "string" &&
          attribute.values.length > 1)
      ) {
        options.push({
          label:
            attribute.type === "array"
              ? "Fill color by first value in string array"
              : "Fill color by string property",
          propertyChoice: {
            property: attribute.attribute,
            ...attribute,
          },
          type: "fill",
          layer: {
            type: "fill",
            paint: {
              "fill-color": [
                "match",
                attribute.type === "array"
                  ? ["at", 0, ["get", attribute.attribute]]
                  : ["get", attribute.attribute],
                ...attribute.values
                  .filter((v) => v !== null)
                  .map((v, i) => {
                    return [v, schemeTableau10[i % 10]];
                  })
                  .flat(),
                "black",
              ],
              "fill-opacity": 0.8,
            },
            layout: {},
          },
        });
      }
    }
    for (const attribute of layer.attributes || []) {
      if (attribute.type === "number") {
        const values: number[] = [];
        if (attribute.quantiles?.length) {
          let quantiles = attribute.quantiles;
          if (quantiles.length === 20) {
            quantiles = quantiles.reduce((acc, q, i) => {
              if (i % 2 === 0) {
                acc.push(q);
              }
              return acc;
            }, [] as number[]);
          }
          values.push(...quantiles);
        } else if (attribute.min && attribute.max) {
          values.push(attribute.min);
          values.push(attribute.max);
        }
        if (values.length) {
          options.push({
            label: "Color interpolated by number property",
            propertyChoice: {
              property: attribute.attribute,
              ...attribute,
            },
            type: "fill",
            layer: {
              type: "fill",
              paint: {
                "fill-color": [
                  "interpolate-hcl",
                  ["linear"],
                  ["get", attribute.attribute],
                  ...values
                    .map((v, i) => {
                      return [v, interpolateColorScale(i / values.length)];
                    })
                    .flat(),
                ],
              },
              layout: {},
            },
          });
        }
      }
    }
  }
  if (
    layer.geometry === "LineString" ||
    layer.geometry === "MultiLineString" ||
    layer.geometry === "Polygon" ||
    layer.geometry === "MultiPolygon"
  ) {
    options.push({
      label: "Simple Line",
      type: "line",
      layer: {
        type: "line",
        paint: {
          "line-color": schemeTableau10[colorChoiceCounter++ % 10],
          "line-width": 2,
        },
        layout: {},
      },
    });
    options.push({
      label: "Line with width determined by zoom",
      type: "line",
      layer: {
        type: "line",
        paint: {
          "line-color": schemeTableau10[colorChoiceCounter++ % 10],
          "line-width": ["step", ["zoom"], 0, 8, 1, 12, 3],
        },
        layout: {},
      },
    });
    for (const attribute of layer.attributes || []) {
      if (
        (attribute.type === "string" &&
          (attribute.attribute !== "name" || attribute.values.length > 1)) ||
        (attribute.type === "array" &&
          attribute.typeArrayOf === "string" &&
          attribute.values.length > 1)
      ) {
        options.push({
          label:
            attribute.type === "array"
              ? "Line color by first value in string array"
              : "Line color by string property",
          propertyChoice: {
            property: attribute.attribute,
            ...attribute,
          },
          type: "line",
          layer: {
            type: "line",
            paint: {
              "line-color": [
                "match",
                attribute.type === "array"
                  ? ["at", 0, ["get", attribute.attribute]]
                  : ["get", attribute.attribute],
                ...attribute.values
                  .filter((v) => v !== null)
                  .map((v, i) => {
                    return [v, schemeTableau10[i % 10]];
                  })
                  .flat(),
                "black",
              ],
              "line-width": 2,
            },
            layout: {},
          },
        });
      }
    }
  }
  if (layer.attributes.find((a) => a.type === "string")) {
    const isLine =
      layer.geometry === "LineString" || layer.geometry === "MultiLineString";
    for (const attribute of layer.attributes || []) {
      if (attribute.type === "string") {
        options.push({
          type: "symbol",
          label: "Label from string property",
          propertyChoice: {
            property: attribute.attribute,
            ...attribute,
          },
          layer: {
            type: "symbol",
            layout: {
              "text-field": ["get", attribute.attribute],
              "text-size": 12,
              "symbol-placement": isLine ? "line" : "point",
            },
            paint: {
              "text-color": "black",
              "text-halo-color": "white",
              "text-halo-width": 2,
            },
          },
        });
        options.push({
          type: "symbol",
          label: "Interpolated string label",
          propertyChoice: {
            property: attribute.attribute,
            ...attribute,
          },
          layer: {
            type: "symbol",
            layout: {
              "text-field": [
                "concat",
                `${attribute.attribute}: [`,
                ["get", attribute.attribute],
                "]",
              ],
              "text-size": 12,
            },
            paint: {
              "text-color": "black",
              "text-halo-color": "white",
              "text-halo-width": 2,
            },
          },
        });
      }
    }
  }
  if (layer.geometry === "MultiPoint" || layer.geometry === "Point") {
    options.push({
      type: "heatmap",
      label: "Simple Heatmap",
      layer: {
        type: "heatmap",
        paint: {
          "heatmap-intensity": [
            "interpolate",
            ["linear"],
            ["zoom"],
            0,
            1,
            9,
            3,
          ],
          "heatmap-radius": ["interpolate", ["linear"], ["zoom"], 0, 2, 9, 20],
          "heatmap-opacity": [
            "interpolate",
            ["linear"],
            ["zoom"],
            10,
            1,
            12,
            0,
          ],
        },
        layout: {},
      },
    });

    for (const attribute of (layer.attributes || []).filter(
      (a) => a.type === "number"
    )) {
      if (
        attribute.min !== undefined &&
        attribute.max &&
        attribute.max > attribute.min
      ) {
        options.push({
          type: "heatmap",
          label: "Heatmap intensity by number property",
          propertyChoice: {
            property: attribute.attribute,
            ...attribute,
          },
          layer: {
            type: "heatmap",
            paint: {
              "heatmap-intensity": [
                "interpolate",
                ["linear"],
                ["zoom"],
                0,
                1,
                9,
                1,
              ],
              "heatmap-radius": [
                "interpolate",
                ["linear"],
                ["zoom"],
                1,
                2,
                9,
                20,
              ],
              "heatmap-weight": [
                "interpolate",
                ["linear"],
                ["get", attribute.attribute],
                attribute.min,
                0,
                attribute.max,
                10,
              ],
              "heatmap-opacity": [
                "interpolate",
                ["linear"],
                ["zoom"],
                10,
                1,
                12,
                0,
              ],
            },
            layout: {},
          },
        });
      }
    }
    if (
      sprites.length &&
      (layer.geometry === "MultiPoint" || layer.geometry === "Point")
    ) {
      options.push({
        type: "symbol",
        label: "Image Symbol",
        layer: {
          type: "symbol",
          layout: {
            "icon-image": `seasketch://sprites/${sprites[0].id}`,
          },
          paint: {},
        },
      });

      for (const attribute of (layer.attributes || []).filter(
        (a) => a.type === "string"
      )) {
        options.push({
          type: "symbol",
          label: "Different image for each string value",
          propertyChoice: {
            property: attribute.attribute,
            ...attribute,
          },
          layer: {
            type: "symbol",
            layout: {
              "icon-image": [
                "match",
                ["get", attribute.attribute],
                ...attribute.values
                  .filter((v) => v !== null)
                  .map((v, i) => {
                    return [
                      v,
                      `seasketch://sprites/${sprites[i % sprites.length].id}`,
                    ];
                  })
                  .flat(),
                `seasketch://sprites/${sprites[0].id}`,
              ],
            },
            paint: {},
          },
        });
      }
    }
  }
  return options;
}
