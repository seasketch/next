/* eslint-disable i18next/no-literal-string */
import { Tooltip, hoverTooltip } from "@codemirror/view";
import { syntaxTree } from "@codemirror/language";
import { evaluateStyleContext } from "./glStyleAutocomplete";
import styleSpec from "mapbox-gl/src/style-spec/reference/v8.json";
import { doc } from "prettier";

export const glStyleHoverTooltips = hoverTooltip(
  (view, pos, side) => {
    let { from, to, text } = view.state.doc.lineAt(pos);
    let start = pos,
      end = pos;
    while (start > from && /[^"]/.test(text[start - from - 1])) start--;
    while (end < to && /[^"]/.test(text[end - from])) end++;
    if ((start === pos && side < 0) || (end === pos && side > 0)) return null;
    const state = view.state;
    const around = syntaxTree(state).resolveInner(pos);
    const layer = styleSpec.layer as any;
    const spec = styleSpec as any;
    if (
      around.type.name === "String" ||
      around.type.name === "PropertyValue" ||
      around.type.name === "PropertyName"
    ) {
      const context = evaluateStyleContext(
        around,
        // @ts-ignore
        {
          explicit: true,
          state: state,
          pos,
        }
      );
      if (context === null) {
        return null;
      } else if (
        (context.type === "LayerRootPropertyName" ||
          context.type === "PropertyName") &&
        context.value
      ) {
        const specDetails =
          context.type === "LayerRootPropertyName"
            ? layer[context.value]
            : spec[`${context.category}_${context.layerType}`][context.value];
        if (specDetails) {
          return {
            pos: start,
            end,
            above: true,
            create(view) {
              return {
                dom: tooltipDom({
                  title: context.value!,
                  linkRef:
                    context.type === "LayerRootPropertyName"
                      ? context.value!
                      : `${context.category}-${context.layerType}-${context.value}`,
                  details: {
                    type: specDetails.type,
                    required: Boolean(specDetails.required),
                    min: specDetails.minimum,
                    max: specDetails.maximum,
                    default: specDetails.default,
                  },
                  body: specDetails.doc,
                }),
              };
            },
          };
        }
      } else if (
        context.type === "LayerRootPropertyValue" ||
        context.type === "PropertyValue"
      ) {
        const isEnum = context.propertyValueType === "enum";
        if (isEnum) {
          const values =
            context.type === "LayerRootPropertyValue"
              ? layer[context.propertyName].values || []
              : spec[`${context.category}_${context.layerType}`][
                  context.propertyName
                ].values || [];
          const value = values[context.value || ""];
          if (value && value.doc) {
            return {
              pos: start,
              end,
              above: true,
              create(view) {
                return {
                  dom: tooltipDom({
                    title: context.value!,
                    details: {
                      type: "enum",
                    },
                    body: value.doc,
                  }),
                };
              },
            };
          }
        }
      } else if (context.type === "ExpressionFn" && context.value) {
        const expressionName = context.value;
        const expressionDetails =
          spec.expression_name?.values?.[expressionName];
        if (expressionDetails) {
          return {
            pos: start,
            end,
            above: true,
            create(view) {
              return {
                dom: tooltipDom({
                  title: expressionName,
                  details: {
                    type: "expression",
                  },
                  body: expressionDetails.doc,
                  linkRef: expressionName,
                }),
              };
            },
          };
        }
      }
    }
    return null;
  },
  { hideOnChange: true }
);

function tooltipDom(props: {
  details: {
    type: string;
    required?: boolean;
    [key: string]: any;
  };
  title: string;
  linkRef?: string;
  body: string;
}) {
  const { linkRef, details } = props;
  const dom = document.createElement("div");
  dom.style.setProperty("min-width", "300px");
  const { required, type, ...rest } = details;
  dom.className =
    "max-w-xs p-2 shadow-lg border border-black border-opacity-20";
  dom.innerHTML = `
    ${
      linkRef
        ? `<a 
      href="https://docs.mapbox.com/mapbox-gl-js/style-spec/${
        type === "expression" ? "expressions" : "layers"
      }/#${linkRef}"
      target="_blank" 
      title="View MapBox reference documentation" 
      class="text-sm font-mono flex w-72 items-center gap-1 font-semibold"
      style="color:#629ccd;"
    >
      <span className="flex-1">${props.title}</span>
      <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="w-3 h-3">
        <path stroke-linecap="round" stroke-linejoin="round" d="M13.5 6H5.25A2.25 2.25 0 003 8.25v10.5A2.25 2.25 0 005.25 21h10.5A2.25 2.25 0 0018 18.75V10.5m-10.5 6L21 3m0 0h-5.25M21 3v5.25" />
      </svg>
    </a>`
        : `<div class="text-sm font-mono font-semibold" style="color:#99C593;">${props.title}</div>`
    }
    <div class="text-xs text-gray-500 truncate" style="max-width: 300px;">
    ${
      required !== undefined && type
        ? `
      ${required ? "Required" : "Optional"} ${type}.
    `
        : `${type}.`
    }
    ${Object.entries(rest)
      .filter(([key, value]) => value !== undefined && value !== null)
      .map(([key, value]) => {
        return `${key}=${value}`;
      })
      .join(" ")}
    </div>
    <div class="text-sm">${props.body}</div>
  `;
  return dom;
}
