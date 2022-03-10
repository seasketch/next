import {
  FormElement,
  FormElementTextVariant,
  FormElementLayout,
  FormElementDetailsFragment,
  Maybe,
  FormElementFullDetailsFragment,
} from "../generated/graphql";
import { colord, extend } from "colord";
import a11yPlugin from "colord/plugins/a11y";
import { createContext } from "react";
import { useMediaQuery } from "beautiful-react-hooks";
import { components } from "../formElements";
import { CameraOptions } from "mapbox-gl";
extend([a11yPlugin]);

export type FormElementStyleProps = Pick<
  FormElement,
  | "backgroundColor"
  | "backgroundImage"
  | "layout"
  | "textVariant"
  | "secondaryColor"
  | "backgroundPalette"
  | "mapBasemaps"
  | "mapCameraOptions"
> & { type?: { isSpatial: boolean } | null };
export type ComputedFormElementStyle = {
  backgroundColor: string;
  backgroundImage: string;
  layout: FormElementLayout;
  textVariant: FormElementTextVariant;
  secondaryColor: string;
  secondaryColor2: string;
  secondaryTextClass: string;
  textClass: string;
  isDark: boolean;
  isSmall: boolean;
  unsplashAuthorName?: string;
  unsplashAuthorUrl?: string;
  backgroundPalette?: string[];
  mapBasemaps: number[] | undefined;
  mapCameraOptions: CameraOptions | undefined;
};

export const defaultStyle = {
  backgroundColor: "rgb(23, 74, 85)",
  secondaryColor: "rgb(46, 115, 182)",
  secondaryColor2: colord("rgb(46, 115, 182)")
    .darken(0.1)
    .saturate(0.1)
    .toRgbString(),
  secondaryTextClass: colord("rgb(46, 115, 182)").isDark()
    ? "text-white"
    : "text-gray-900",
  textVariant: FormElementTextVariant.Dynamic,
  layout: FormElementLayout.Top,
  backgroundImage:
    "data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7",
  textClass: "text-white",
  isDark: true,
  isSmall: false,
  mapBasemaps: undefined as number[] | undefined,
  mapCameraOptions: undefined as CameraOptions | undefined,
};

/**
 * Calculates the appearance of a given page of the survey based on the theme
 * settings of the current form element + those that preceeded it if it does not
 * have its own settings.
 *
 * @param formElements
 * @param current
 * @param isSmall
 * @returns
 */
export function useCurrentStyle(
  formElements: FormElementDetailsFragment[] | undefined | null,
  current: FormElementDetailsFragment | undefined,
  stage: number
): ComputedFormElementStyle {
  const isSmall = useMediaQuery("(max-width: 767px)");
  let unsplashAuthorName: string | undefined;
  let unsplashAuthorUrl: string | undefined;
  if (!formElements || !current || formElements.length === 0) {
    return defaultStyle;
  }
  const index = formElements.indexOf(current) || 0;

  const previouslyStyledElement = getPreviouslyStyledElement(
    formElements,
    index
  );

  let style: FormElementStyleProps = {
    ...defaultStyle,
    ...(index === 0 ? current : previouslyStyledElement),
  };

  style.layout = style.layout || getPreviousLayout(formElements, index);

  if (current.backgroundColor || current.backgroundImage) {
    style = { ...current };
  }

  const prevLayout = style.layout;

  if (current.type?.allowedLayouts?.length) {
    if (current.type.allowedLayouts.indexOf(style.layout!) === -1) {
      style = { ...style };
      style.layout = current.type.allowedLayouts[0];
    }
  }
  let isDark = colord(style.backgroundColor || "#efefef").isDark();
  let textClass = "text-white";
  if (style.textVariant === FormElementTextVariant.Dynamic) {
    textClass = isDark ? "text-white" : "text-grey-800";
  } else if (style.textVariant === FormElementTextVariant.Light) {
    textClass = "text-white";
  } else {
    textClass = "text-grey-800";
  }

  // If a component has a callback to set it's own layout, trust it to set it
  const C = components[current.typeId];
  if (C.getLayout) {
    style.layout = C.getLayout(
      stage,
      current.componentSettings,
      prevLayout || style.layout || FormElementLayout.Top,
      isSmall
    );
  }
  if (
    isSmall &&
    (style.layout === FormElementLayout.Left ||
      style.layout === FormElementLayout.Right)
  ) {
    style = {
      ...style,
      layout: FormElementLayout.Top,
    };
  }

  if (
    isSmall &&
    (style.layout === FormElementLayout.MapSidebarLeft ||
      style.layout === FormElementLayout.MapSidebarRight)
  ) {
    if (stage === 1) {
      style = {
        ...style,
        layout: FormElementLayout.MapFullscreen,
      };
    } else {
      style = {
        ...style,
        layout: FormElementLayout.MapTop,
      };
    }
  }

  return {
    ...style,
    isSmall,
    textClass,
    isDark,
    secondaryColor2: colord(style.secondaryColor!)
      .darken(0.1)
      .saturate(0.1)
      .toRgbString(),
    secondaryTextClass: colord(style.secondaryColor!).isDark()
      ? "text-white"
      : "text-gray-900",
    unsplashAuthorName,
    unsplashAuthorUrl,
  } as ComputedFormElementStyle;
}

export function surveyBackground(
  layout: FormElementLayout,
  image: string,
  color: string
) {
  let position = "";
  image = /data\:/.test(image)
    ? // eslint-disable-next-line i18next/no-literal-string
      `url(${image})`
    : // eslint-disable-next-line i18next/no-literal-string
      `url(${image}&auto=compress,format&w=1280)`;
  switch (layout) {
    case FormElementLayout.Cover:
      position = "center / cover no-repeat";
      break;
    case FormElementLayout.Top:
      position = "fixed no-repeat";
      // eslint-disable-next-line i18next/no-literal-string
      // image = `linear-gradient(128deg, ${color}, ${secondaryColor})`;
      image = "";
      // color = color
      break;
    default:
      image = "";
      break;
  }
  // eslint-disable-next-line i18next/no-literal-string
  return `${position} ${image} ${color}`;
}

export const SurveyStyleContext = createContext(defaultStyle);

export function getPreviouslyStyledElement(
  sortedFormElements: FormElementFullDetailsFragment[],
  index: number
) {
  return sortedFormElements
    .slice(0, index)
    .reverse()
    .find((f) => f.backgroundColor);
}

/**
 * This really shouldn't be necessary but surveys created with an older version
 * of the tool may have pages with background colors or images set but not the
 * layout. This can result in odd layouts. Newer versions of the tool always set
 * layout when creating a page with "customized style".
 * @param sortedFormElements
 * @param index
 * @returns
 */
export function getPreviousLayout(
  sortedFormElements: FormElementFullDetailsFragment[],
  index: number
) {
  return (
    sortedFormElements
      .slice(0, index)
      .reverse()
      .find((f) => f.layout)?.layout || FormElementLayout.Top
  );
}
