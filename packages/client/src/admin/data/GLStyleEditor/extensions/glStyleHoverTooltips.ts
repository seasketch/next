/* eslint-disable i18next/no-literal-string */
import { Tooltip, hoverTooltip } from "@codemirror/view";
import { syntaxTree } from "@codemirror/language";
import { evaluateStyleContext } from "./glStyleAutocomplete";
import styleSpec from "mapbox-gl/src/style-spec/reference/v8.json";
import { doc } from "prettier";

export const glStyleHoverTooltips = hoverTooltip((view, pos, side) => {
  let { from, to, text } = view.state.doc.lineAt(pos);
  let start = pos,
    end = pos;
  while (start > from && /\w/.test(text[start - from - 1])) start--;
  while (end < to && /\w/.test(text[end - from])) end++;
  if ((start == pos && side < 0) || (end == pos && side > 0)) return null;
  const state = view.state;
  const around = syntaxTree(state).resolveInner(pos);
  if (
    around.type.name === "String" ||
    around.type.name === "PropertyValue" ||
    around.type.name === "PropertyName"
  ) {
    const evaluatedContext = evaluateStyleContext(
      around,
      // @ts-ignore
      {
        explicit: true,
        state: state,
        pos,
      }
    );
    console.log(evaluatedContext);
    if (
      (evaluatedContext?.type === "LayerRootPropertyName" ||
        evaluatedContext?.type === "PropertyName") &&
      evaluatedContext.value
    ) {
      const specDetails =
        evaluatedContext.type === "LayerRootPropertyName"
          ? // @ts-ignore
            styleSpec.layer[evaluatedContext.value]
          : // @ts-ignore
            styleSpec[
              `${evaluatedContext.category}_${evaluatedContext.layerType}`
            ][evaluatedContext.value];
      if (specDetails) {
        return {
          pos: start,
          end,
          above: true,
          create(view) {
            let dom = document.createElement("div");
            dom.style.setProperty("min-width", "300px");
            let header = document.createElement("a");
            header.setAttribute("title", "View mapbox documentation");
            const iconLink = document.createElement("div");
            iconLink.className = "inline-block";
            iconLink.innerHTML = `
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="w-3 h-3">
                <path stroke-linecap="round" stroke-linejoin="round" d="M13.5 6H5.25A2.25 2.25 0 003 8.25v10.5A2.25 2.25 0 005.25 21h10.5A2.25 2.25 0 0018 18.75V10.5m-10.5 6L21 3m0 0h-5.25M21 3v5.25" />
              </svg>
            `;
            header.setAttribute(
              "href",
              evaluatedContext.type === "LayerRootPropertyName"
                ? `https://docs.mapbox.com/mapbox-gl-js/style-spec/layers/#${evaluatedContext.value}`
                : `https://docs.mapbox.com/mapbox-gl-js/style-spec/layers/#${evaluatedContext.category}-${evaluatedContext.layerType}-${evaluatedContext.value}`
            );
            header.setAttribute("target", "_blank");
            dom.appendChild(header);
            header.className = "text-sm font-mono flex w-72 items-center gap-1";
            header.style.color = "#629ccd";
            header.innerHTML = `<span className="flex-1">${evaluatedContext.value}</span>`;
            header.appendChild(iconLink);
            const typeInfo = document.createElement("div");
            typeInfo.className = "text-xs text-gray-500 truncate";
            typeInfo.style.setProperty("max-width", "300px");
            typeInfo.textContent = `${
              specDetails.required ? "required" : "optional"
            } ${specDetails.type}.${
              specDetails.type === "number" && specDetails.minimum !== undefined
                ? // eslint-disable-next-line i18next/no-literal-string
                  ` min=${specDetails.minimum}`
                : ""
            }${
              specDetails.type === "number" && specDetails.maximum !== undefined
                ? // eslint-disable-next-line i18next/no-literal-string
                  ` max=${specDetails.maximum}`
                : ""
            }${
              specDetails.default !== undefined
                ? // eslint-disable-next-line i18next/no-literal-string
                  ` default=${specDetails.default}`
                : ""
            }`;
            dom.appendChild(typeInfo);
            let body = document.createElement("div");
            dom.appendChild(body);
            dom.className = "max-w-xs p-2";
            body.className = "text-sm";
            body.textContent = specDetails.doc;
            return { dom };
          },
        };
      }
    }
  }
  return null;
});
