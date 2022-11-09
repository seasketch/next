/* eslint-disable i18next/no-literal-string */
import {
  ViewPlugin,
  EditorView,
  ViewUpdate,
  WidgetType,
  Decoration,
  DecorationSet,
} from "@codemirror/view";
import { Extension, Range } from "@codemirror/state";
import { syntaxTree } from "@codemirror/language";
import colors from "./colorsNamed";
import hexs from "./colorsNamedHex";
import hslMatcher, { hlsStringToRGB, RGBAColor } from "./hslMatcher";

export enum ColorType {
  rgb = "RGB",
  hex = "HEX",
  named = "NAMED",
  hsl = "HSL",
}

export interface ColorState {
  from: number;
  to: number;
  alpha: string;
  colorType: ColorType;
}

const colorState = new WeakMap<HTMLSpanElement, ColorState>();

function colorDecorations(view: EditorView) {
  const widgets: Array<Range<Decoration>> = [];
  for (const range of view.visibleRanges) {
    syntaxTree(view.state).iterate({
      from: range.from,
      to: range.to,
      enter: ({ type, from, to }) => {
        if (type.name === "String") {
          // Get string value (without quotes)
          const value: string = view.state.doc
            .sliceString(from, to)
            .replace(/"/g, "");
          if (value.startsWith(`rgb`)) {
            // Check for rgb(255, 190, 22) - type values
            const match =
              /rgba?\(\s*(\d{1,3})\s*,\s*(\d{1,3})\s*,?\s*(\d{1,3})\s*(,\s*\d*\.\d*\s*)?\)/i.exec(
                value
              ) ||
              /rgba?\(\s*(\d{1,3})\s*(\d{1,3})\s*(\d{1,3})\s*(\/?\s*\d+%)?(\/\s*\d+\.\d\s*)?\)/i.exec(
                value
              );
            if (!match) return;
            // eslint-disable-next-line @typescript-eslint/no-unused-vars
            const [_, r, g, b, a] = match;
            const hex = rgbToHex(Number(r), Number(g), Number(b));
            const widget = Decoration.widget({
              widget: new ColorWidget({
                colorType: ColorType.rgb,
                color: hex,
                colorRaw: value,
                from,
                to,
                alpha: a ? a.replace(/(\/|,)/g, "") : "",
              }),
              side: 0,
            });
            widgets.push(widget.range(from));
          } else if (hslMatcher(value)) {
            // hsl() values
            // hsl(240, 100%, 50%)
            const match = hlsStringToRGB(value) as RGBAColor;
            if (!match) return;
            const { r, g, b } = match;
            const hex = rgbToHex(Number(r), Number(g), Number(b));
            const widget = Decoration.widget({
              widget: new ColorWidget({
                colorType: ColorType.hsl,
                color: hex,
                colorRaw: value,
                from,
                to,
                alpha: match.a ? match.a.toString() : "",
              }),
              side: 0,
            });
            widgets.push(widget.range(from));
            // hex values like #efefef
          } else if (/#\w\w\w\w\w\w/.test(value)) {
            const [color, alpha] = toFullHex(value);
            const widget = Decoration.widget({
              widget: new ColorWidget({
                colorType: ColorType.hex,
                color,
                colorRaw: value,
                from,
                to,
                alpha,
              }),
              side: 0,
            });
            widgets.push(widget.range(from));
          } else {
            // named colors
            const name = value as unknown as GetArrayElementType<typeof colors>;
            if (colors.includes(name)) {
              const widget = Decoration.widget({
                widget: new ColorWidget({
                  colorType: ColorType.named,
                  color: hexs[colors.indexOf(name)],
                  colorRaw: value,
                  from,
                  to,
                  alpha: "",
                }),
                side: 0,
              });
              widgets.push(widget.range(from));
            }
          }
        }
      },
    });
  }
  return Decoration.set(widgets);
}

class ColorWidget extends WidgetType {
  private readonly state: ColorState;
  private readonly color: string;
  private readonly colorRaw: string;

  constructor({
    color,
    colorRaw,
    ...state
  }: ColorState & {
    color: string;
    colorRaw: string;
  }) {
    super();
    this.state = state;
    this.color = color;
    this.colorRaw = colorRaw;
  }

  eq(other: ColorWidget) {
    return (
      other.state.colorType === this.state.colorType &&
      other.color === this.color &&
      other.state.from === this.state.from &&
      other.state.to === this.state.to &&
      other.state.alpha === this.state.alpha
    );
  }

  toDOM() {
    // const picker = document.createElement("input");
    // colorState.set(picker, this.state);
    // picker.type = "color";
    // picker.value = this.color;
    // picker.dataset["color"] = this.color;
    // picker.dataset["colorraw"] = this.colorRaw;
    const wrapper = document.createElement("span");
    // wrapper.appendChild(picker);
    wrapper.dataset["color"] = this.color;
    wrapper.dataset["colorraw"] = this.colorRaw;
    wrapper.style.backgroundColor = this.colorRaw;
    wrapper.style.cursor = "pointer";
    colorState.set(wrapper, this.state);
    return wrapper;
  }

  ignoreEvent() {
    return false;
  }
}

export const colorView = () =>
  ViewPlugin.fromClass(
    class ColorView {
      decorations: DecorationSet;
      dom: HTMLElement;
      pickerState?: ColorState;
      pickerListener: (event: Event) => void;

      constructor(view: EditorView) {
        this.decorations = colorDecorations(view);
        const picker = view.dom.appendChild(document.createElement("input"));
        // colorState.set(picker, this.state);
        picker.type = "color";
        picker.dataset["glColorPicker"] = "true";
        this.dom = picker;
        this.pickerListener = (event) => {
          const target = event.target as HTMLInputElement;
          if (this.pickerState) {
            const data = this.pickerState;
            const value = target.value;
            const rgb = hexToRgb(value);
            let converted = target.value;
            if (data.colorType === ColorType.rgb) {
              converted = rgb ? `rgb(${rgb.r}, ${rgb.g}, ${rgb.b})` : value;
            } else if (data.colorType === ColorType.hsl) {
              const rgb = hexToRgb(value);
              if (rgb) {
                const { h, s, l } = RGBToHSL(rgb?.r, rgb?.g, rgb?.b);
                converted = `hsl(${h}, ${s}%, ${l}%)`;
              }
            }
            const content = `"${converted}"`;
            view.dispatch({
              changes: {
                from: data.from,
                to: data.to,
                insert: content,
              },
            });
            data.to = data.from + content.length;
          }
        };
        this.dom.addEventListener("input", this.pickerListener);
      }

      update(update: ViewUpdate) {
        if (update.docChanged || update.viewportChanged) {
          // if (!hasColorPickerAnnotation(update)) {
          this.decorations = colorDecorations(update.view);
          // }
        }
        const readOnly = update.view.contentDOM.ariaReadOnly === "true";
        const editable = update.view.contentDOM.contentEditable === "true";

        const canBeEdited = readOnly === false && editable;
        this.changePicker(update.view, canBeEdited);
        // if (update.docChanged)
        //   this.dom.textContent = update.state.doc.length.toString();
      }

      destroy() {
        this.dom.removeEventListener("input", this.pickerListener);
        this.dom.remove();
      }

      changePicker(view: EditorView, canBeEdited: boolean) {
        const doms = view.contentDOM.querySelectorAll("input[type=color]");
        doms.forEach((inp) => {
          canBeEdited
            ? inp.removeAttribute("disabled")
            : inp.setAttribute("disabled", "");
        });
      }
    },
    {
      decorations: (v) => v.decorations,
      eventHandlers: {
        click(e, view) {
          const target = e.target as HTMLSpanElement;
          if (target.nodeName !== "SPAN" || !target.dataset.color) return false;
          const doms =
            view.dom.querySelectorAll<HTMLInputElement>("input[type=color]");
          const data = colorState.get(target);
          this.pickerState = data;
          doms.forEach((inp) => {
            inp.value = target.dataset.color!;
            inp.style.top = `${target.offsetTop}px`;
            inp.style.left = `${target.offsetLeft}px`;
            setTimeout(() => {
              inp.click();
            }, 16);
          });
        },
      },
    }
  );

export const colorTheme = EditorView.baseTheme({
  "span[data-color]": {
    width: "12px",
    height: "12px",
    display: "inline-block",
    borderRadius: "2px",
    marginRight: "0.5ch",
    outline: "1px solid #00000060",
    overflow: "hidden",
    verticalAlign: "middle",
    marginTop: "-2px",
  },
  'input[type="color"]': {
    background: "transparent",
    display: "block",
    border: "none",
    outline: "0",
    paddingLeft: "24px",
    height: "12px",
    position: "absolute",
    top: "20px",
    left: "20px",
    pointerEvents: "none",
  },
  'input[type="color"]::-webkit-color-swatch': {
    display: "none",
  },
  'input[type="color"]::-moz-color-swatch': {
    display: "none",
  },
});

export const color: Extension = [colorView(), colorTheme];

export function toFullHex(color: string): string[] {
  if (color.length === 4) {
    // 3-char hex
    return [
      `#${color[1].repeat(2)}${color[2].repeat(2)}${color[3].repeat(2)}`,
      "",
    ];
  }

  if (color.length === 5) {
    // 4-char hex (alpha)
    return [
      `#${color[1].repeat(2)}${color[2].repeat(2)}${color[3].repeat(2)}`,
      color[4].repeat(2),
    ];
  }

  if (color.length === 9) {
    // 8-char hex (alpha)
    return [`#${color.slice(1, -2)}`, color.slice(-2)];
  }

  return [color, ""];
}
/** https://stackoverflow.com/a/5624139/1334703 */
export function rgbToHex(r: number, g: number, b: number) {
  return "#" + ((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1);
}

/** https://stackoverflow.com/a/5624139/1334703 */
export function hexToRgb(hex: string) {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result
    ? {
        r: parseInt(result[1], 16),
        g: parseInt(result[2], 16),
        b: parseInt(result[3], 16),
      }
    : null;
}

/** https://css-tricks.com/converting-color-spaces-in-javascript/#aa-rgb-to-hsl */
export function RGBToHSL(r: number, g: number, b: number) {
  r /= 255;
  g /= 255;
  b /= 255;
  const max = Math.max(r, g, b),
    min = Math.min(r, g, b);
  let h = 0,
    s,
    l = (max + min) / 2;

  // eslint-disable-next-line eqeqeq
  if (max == min) {
    h = s = 0; // achromatic
  } else {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r:
        h = (g - b) / d + (g < b ? 6 : 0);
        break;
      case g:
        h = (b - r) / d + 2;
        break;
      case b:
        h = (r - g) / d + 4;
        break;
    }
    h /= 6;
  }
  return {
    h: Math.floor(h * 360),
    s: Math.floor(s * 100),
    l: Math.floor(l * 100),
  };
}

type GetArrayElementType<T extends readonly any[]> =
  T extends readonly (infer U)[] ? U : never;
