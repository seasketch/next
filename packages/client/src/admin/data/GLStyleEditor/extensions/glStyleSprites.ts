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
import { SpriteDetailsFragment } from "../../../../generated/graphql";

export interface SpriteState {
  from: number;
  to: number;
  url: string;
}

const SPRITE_PROPS = [
  "icon-image",
  "fill-pattern",
  "fill-extrusion-pattern",
  "line-pattern",
  "background-pattern",
];

export function getBestSpriteImage(sprite: SpriteDetailsFragment): {
  width: number;
  height: number;
  url: string;
  pixelRatio: number;
} {
  const images = [...sprite.spriteImages] || [];
  if (images.length > 0) {
    images.sort((a, b) => b.pixelRatio - a.pixelRatio);
    return images[0];
  } else {
    return {
      pixelRatio: 1,
      width: 15,
      height: 15,
      url: errorDataUri,
    };
  }
}

const spriteState = new WeakMap<HTMLSpanElement, SpriteState>();

function spriteDecorations(
  view: EditorView,
  getSpriteUrl: (id: number) => Promise<string>
) {
  const widgets: Array<Range<Decoration>> = [];
  for (const range of view.visibleRanges) {
    syntaxTree(view.state).iterate({
      from: range.from,
      to: range.to,
      enter: ({ type, from, to, node, tree }) => {
        if (type.name === "String") {
          if (node.parent && node.parent.name === "Property") {
            const propName = node.parent.firstChild;
            if (propName) {
              const prop = view.state.doc
                .sliceString(propName.from, propName.to)
                .replace(/"/g, "");
              if (SPRITE_PROPS.indexOf(prop) !== -1) {
                // Get string value (without quotes)
                const value: string = view.state.doc
                  .sliceString(from, to)
                  .replace(/"/g, "");
                const widget = Decoration.widget({
                  widget: new SpriteWidget(
                    {
                      from,
                      to,
                      url: value,
                    },
                    getSpriteUrl
                  ),
                  side: 0,
                });
                widgets.push(widget.range(from));
              }
            }
          }
        }
      },
    });
  }
  return Decoration.set(widgets);
}

export const errorDataUri =
  "data:image/svg+xml;charset=utf-8;base64,PHN2ZyB2aWV3Qm94PSIwIDAgMjQgMjQiIGhlaWdodD0iNDgiIHdpZHRoPSI0OCIgZm9jdXNhYmxlPSJmYWxzZSIgcm9sZT0iaW1nIiBmaWxsPSJyZWQiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyIgY2xhc3M9IlN0eWxlZEljb25CYXNlLXNjLWVhOXVsai0wIGhSbkpQQyI+PHRpdGxlPkVycm9yQWx0IGljb248L3RpdGxlPjxwYXRoIGQ9Ik0xNi43MDcgMi4yOTNBLjk5Ni45OTYgMCAwIDAgMTYgMkg4YS45OTYuOTk2IDAgMCAwLS43MDcuMjkzbC01IDVBLjk5Ni45OTYgMCAwIDAgMiA4djhjMCAuMjY2LjEwNS41Mi4yOTMuNzA3bDUgNUEuOTk2Ljk5NiAwIDAgMCA4IDIyaDhjLjI2NiAwIC41Mi0uMTA1LjcwNy0uMjkzbDUtNUEuOTk2Ljk5NiAwIDAgMCAyMiAxNlY4YS45OTYuOTk2IDAgMCAwLS4yOTMtLjcwN2wtNS01ek0xMyAxN2gtMnYtMmgydjJ6bTAtNGgtMlY3aDJ2NnoiPjwvcGF0aD48L3N2Zz4=";

class SpriteWidget extends WidgetType {
  private readonly state: SpriteState;
  private getSpriteUrl: (id: number) => Promise<string>;

  constructor(
    state: SpriteState,
    getSpriteUrl: (id: number) => Promise<string>
  ) {
    super();
    this.state = state;
    this.getSpriteUrl = getSpriteUrl;
  }

  eq(other: SpriteWidget) {
    return (
      other.state.url === this.state.url &&
      other.state.from === this.state.from &&
      other.state.to === this.state.to
    );
  }

  toDOM() {
    const wrapper = document.createElement("span");
    if (/\/(\d+)$/.test(this.state.url)) {
      this.getSpriteUrl(parseInt(this.state.url.match(/\/(\d+)$/)![1]))
        .then((url) => {
          wrapper.style.backgroundImage = `url(${url})`;
          wrapper.title = "";
        })
        .catch((e) => {
          console.error(e);
          wrapper.style.backgroundImage = `url(${errorDataUri})`;
          wrapper.title = "Unknown sprite";
        });
    } else {
      wrapper.style.backgroundImage = `url(${errorDataUri})`;
      wrapper.title = "Unknown sprite";
    }

    wrapper.style.cursor = "pointer";
    wrapper.dataset.sprite = this.state.url;
    spriteState.set(wrapper, this.state);
    return wrapper;
  }

  ignoreEvent() {
    return false;
  }
}

export const spriteView = (props: SpriteExtensionProps) =>
  ViewPlugin.fromClass(
    class ColorView {
      decorations: DecorationSet;
      // dom: HTMLElement;
      pickerState?: SpriteState;
      getSpriteUrl: SpriteExtensionProps["getSpriteUrl"];
      onSpriteClick: SpriteExtensionProps["onSpriteClick"];
      // pickerListener: (event: Event) => void;

      constructor(view: EditorView) {
        this.getSpriteUrl = props.getSpriteUrl;
        this.onSpriteClick = props.onSpriteClick;
        this.decorations = spriteDecorations(view, props.getSpriteUrl);
        // const picker = view.dom.appendChild(document.createElement("input"));
        // // colorState.set(picker, this.state);
        // picker.type = "color";
        // picker.dataset["glColorPicker"] = "true";
        // this.dom = picker;
        // this.pickerListener = (event) => {
        //   const target = event.target as HTMLInputElement;
        //   // if (this.pickerState) {
        //   //   const data = this.pickerState;
        //   //   const value = target.value;
        //   //   const rgb = hexToRgb(value);
        //   //   let converted = target.value;
        //   //   if (data.colorType === ColorType.rgb) {
        //   //     converted = rgb ? `rgb(${rgb.r}, ${rgb.g}, ${rgb.b})` : value;
        //   //   } else if (data.colorType === ColorType.hsl) {
        //   //     const rgb = hexToRgb(value);
        //   //     if (rgb) {
        //   //       const { h, s, l } = RGBToHSL(rgb?.r, rgb?.g, rgb?.b);
        //   //       converted = `hsl(${h}, ${s}%, ${l}%)`;
        //   //     }
        //   //   }
        //   //   const content = `"${converted}"`;
        //   //   view.dispatch({
        //   //     changes: {
        //   //       from: data.from,
        //   //       to: data.to,
        //   //       insert: content,
        //   //     },
        //   //   });
        //   //   data.to = data.from + content.length;
        //   // }
        // };
        // picker.addEventListener("input", this.pickerListener);
      }

      update(update: ViewUpdate) {
        if (update.docChanged || update.viewportChanged) {
          this.decorations = spriteDecorations(update.view, this.getSpriteUrl);
        }
        const readOnly = update.view.contentDOM.ariaReadOnly === "true";
        const editable = update.view.contentDOM.contentEditable === "true";

        const canBeEdited = readOnly === false && editable;
        this.changePicker(update.view, canBeEdited);
      }

      destroy() {
        // this.dom.remove();
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
          if (target.nodeName !== "SPAN" || !("sprite" in target.dataset))
            return false;
          e.preventDefault();
          e.stopImmediatePropagation();
          const data = spriteState.get(target);
          if (data) {
            this.onSpriteClick({
              from: data.from,
              to: data.to,
              value: data.url,
              view,
              target: e.target as HTMLSpanElement,
            });
          }
        },
      },
    }
  );

export const spriteTheme = EditorView.baseTheme({
  "span[data-sprite]": {
    width: "15px",
    height: "15px",
    display: "inline-block",
    borderRadius: "2px",
    marginRight: "0.5ch",
    outline: "1px solid #00000060",
    overflow: "hidden",
    verticalAlign: "middle",
    marginTop: "-2px",
    backgroundSize: "contain",
    backgroundRepeat: "no-repeat",
    backgroundPosition: "center",
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

interface SpriteExtensionProps {
  getSpriteUrl: (id: number) => Promise<string>;
  onSpriteClick: (event: {
    from: number;
    to: number;
    value: string;
    view: EditorView;
    target: HTMLSpanElement;
  }) => void;
}

export const sprites: (props: SpriteExtensionProps) => Extension = (props) => [
  spriteView(props),
  spriteTheme,
];

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
