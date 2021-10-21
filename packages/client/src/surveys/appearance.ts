import {
  FormElement,
  FormElementTextVariant,
  FormElementBackgroundImagePlacement,
} from "../generated/graphql";
import { colord, extend } from "colord";
import a11yPlugin from "colord/plugins/a11y";
import { createContext } from "react";
import { useMediaQuery } from "beautiful-react-hooks";
extend([a11yPlugin]);

export type FormElementStyleProps = Pick<
  FormElement,
  | "backgroundColor"
  | "backgroundImage"
  | "backgroundImagePlacement"
  | "textVariant"
  | "secondaryColor"
>;
export type ComputedFormElementStyle = {
  backgroundColor: string;
  backgroundImage: string;
  backgroundImagePlacement: FormElementBackgroundImagePlacement;
  textVariant: FormElementTextVariant;
  secondaryColor: string;
  textClass: string;
  isDark: boolean;
};

export const defaultStyle = {
  backgroundColor: "rgb(23, 74, 85)",
  secondaryColor: "rgb(46, 115, 182)",
  textVariant: FormElementTextVariant.Dynamic,
  backgroundImagePlacement: FormElementBackgroundImagePlacement.Top,
  backgroundImage: "",
  textClass: "text-white",
  isDark: true,
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
  formElements: FormElementStyleProps[] | undefined | null,
  current: FormElementStyleProps | undefined
): ComputedFormElementStyle {
  const isSmall = useMediaQuery("(max-width: 767px)");
  if (!formElements || !current || formElements.length === 0) {
    return defaultStyle;
  }
  const index = formElements.indexOf(current) || 0;
  let style: FormElementStyleProps = formElements[0];
  for (var i = 1; i <= index; i++) {
    if (formElements[i] && formElements[i].backgroundImage) {
      style = {
        backgroundColor:
          formElements[i].backgroundColor ||
          style.backgroundColor ||
          defaultStyle.backgroundColor,
        secondaryColor:
          formElements[i].secondaryColor ||
          style.secondaryColor ||
          defaultStyle.secondaryColor,
        textVariant:
          formElements[i].textVariant ||
          style.textVariant ||
          defaultStyle.textVariant,
        backgroundImagePlacement:
          formElements[i].backgroundImagePlacement ||
          style.backgroundImagePlacement ||
          defaultStyle.backgroundImagePlacement,
        backgroundImage:
          formElements[i].backgroundImage ||
          style.backgroundImage ||
          defaultStyle.backgroundImage,
      };
    }
  }
  if (isSmall) {
    if (
      style.backgroundImagePlacement !==
      FormElementBackgroundImagePlacement.Cover
    ) {
      style = {
        ...style,
        backgroundImagePlacement: FormElementBackgroundImagePlacement.Top,
      };
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

  return { ...style, textClass, isDark } as ComputedFormElementStyle;
}

export function surveyBackground(
  layout: FormElementBackgroundImagePlacement,
  image: string,
  color: string
) {
  let position = "";
  // eslint-disable-next-line i18next/no-literal-string
  image = `url(${image}&auto=compress,format&w=1280)`;
  switch (layout) {
    case FormElementBackgroundImagePlacement.Cover:
      position = "center / cover no-repeat";
      break;
    case FormElementBackgroundImagePlacement.Top:
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
