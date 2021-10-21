import { createContext, RefObject, useState } from "react";
import {
  FormElement,
  FormElementTextVariant,
  FormElementBackgroundImagePlacement,
} from "../generated/graphql";
import ProgressBar from "./ProgressBar";
import useBodyBackground from "../useBodyBackground";
import { useMediaQuery } from "beautiful-react-hooks";
import { colord, extend } from "colord";
import a11yPlugin from "colord/plugins/a11y";
import { CameraIcon } from "@heroicons/react/solid";
import { Trans } from "react-i18next";
import { AnimatePresence, motion } from "framer-motion";
import { sizes, srcSet } from "./ImagePreloader";

extend([a11yPlugin]);

require("./surveys.css");

export const SurveyAppLayout: React.FunctionComponent<{
  progress: number;
  embeddedInAdmin?: boolean;
  showProgress?: boolean;
  style?: ComputedFormElementStyle;
  unsplashUserName?: string;
  unsplashUserUrl?: string;
}> = ({
  progress,
  children,
  embeddedInAdmin,
  showProgress,
  style,
  unsplashUserName,
  unsplashUserUrl,
}) => {
  const isSmall = useMediaQuery("(max-width: 767px)");

  style = style || getCurrentStyle(undefined, undefined, isSmall);
  useBodyBackground(
    bgStyle(
      style.backgroundImagePlacement,
      style.backgroundImage,
      style.backgroundColor
    ),
    !!embeddedInAdmin
  );

  const right =
    style.backgroundImagePlacement ===
    FormElementBackgroundImagePlacement.Right;
  const left =
    style.backgroundImagePlacement === FormElementBackgroundImagePlacement.Left;
  const top =
    style.backgroundImagePlacement === FormElementBackgroundImagePlacement.Top;
  const cover =
    style.backgroundImagePlacement ===
    FormElementBackgroundImagePlacement.Cover;

  let isDark = colord(style.backgroundColor || "#efefef").isDark();
  let textClass = "text-white";
  if (style.textVariant === FormElementTextVariant.Dynamic) {
    textClass = isDark ? "text-white" : "text-grey-800";
  } else if (style.textVariant === FormElementTextVariant.Light) {
    textClass = "text-white";
  } else {
    textClass = "text-grey-800";
  }

  return (
    <SurveyStyleContext.Provider value={style}>
      <div className={`w-full relative`}>
        {showProgress && (
          <ProgressBar progress={progress} skipAnimation={embeddedInAdmin} />
        )}
        <div
          className={`${top ? "" : "flex h-full"} ${
            cover ? "justify-center" : ""
          } ${right ? "flex-row-reverse" : "flex-row"}`}
          style={{
            height: top
              ? "auto"
              : embeddedInAdmin
              ? "calc(100vh - 56px)"
              : "100vh",
          }}
        >
          {!cover && (
            <div
              className={`flex-1 w-full relative ${
                top ? "h-32 md:h-52 lg:h-64" : "h-full"
              } overflow-hidden`}
            >
              <AnimatePresence initial={false} presenceAffectsLayout={false}>
                <motion.img
                  key={style.backgroundImage}
                  variants={{
                    enter: { opacity: 0, zIndex: 1 },
                    current: { opacity: 1, zIndex: 1 },
                    exit: { opacity: 0, zIndex: 0 },
                  }}
                  transition={{
                    opacity: { duration: embeddedInAdmin ? 0 : 0.5 },
                  }}
                  initial="enter"
                  animate="current"
                  exit="exit"
                  alt={"Survey page background"}
                  className="w-full h-full object-cover absolute top-0"
                  src={`${style.backgroundImage}?&auto=format&w=1280`}
                  style={{
                    ...(top
                      ? {
                          WebkitMaskImage:
                            "linear-gradient(to top, transparent 0%, black 100%)",
                          maskImage:
                            "linear-gradient(to top, transparent 0%, black 100%)",
                        }
                      : {}),
                    // transition: embeddedInAdmin ? "none" : "all 500ms",
                    willChange: "opacity",
                  }}
                  srcSet={srcSet(style!.backgroundImage)}
                  sizes={sizes(style!.backgroundImagePlacement)}
                />
              </AnimatePresence>
              <UnsplashCredit
                name={unsplashUserName}
                url={unsplashUserUrl}
                isDark={
                  style.textVariant === FormElementTextVariant.Dynamic
                    ? isDark
                    : style.textVariant === FormElementTextVariant.Dark
                }
                layout={style.backgroundImagePlacement}
              />
            </div>
          )}
          <div
            className={`px-5 max-w-xl mx-auto ${textClass} survey-content ${
              top
                ? "w-full"
                : "flex-0 flex flex-col center-ish max-h-full overflow-y-auto w-full md:w-128 lg:w-160 xl:w-full 2xl:mx-12"
            }`}
          >
            <div className="max-h-full pt-5">{children}</div>
          </div>
          {cover && (
            <UnsplashCredit
              name={unsplashUserName}
              url={unsplashUserUrl}
              isDark={
                style.textVariant === FormElementTextVariant.Dynamic
                  ? isDark
                  : style.textVariant === FormElementTextVariant.Dark
              }
              layout={style.backgroundImagePlacement}
            />
          )}
        </div>
      </div>
    </SurveyStyleContext.Provider>
  );
};

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
};

const defaultStyle = {
  backgroundColor: "white",
  secondaryColor: "rgb(46, 115, 182)",
  textVariant: FormElementTextVariant.Dynamic,
  backgroundImagePlacement: FormElementBackgroundImagePlacement.Top,
  backgroundImage: "",
};

export function getCurrentStyle(
  formElements: FormElementStyleProps[] | undefined | null,
  current: FormElementStyleProps | undefined,
  isSmall: boolean
): ComputedFormElementStyle {
  if (!formElements || !current || formElements.length === 0) {
    return defaultStyle;
  }
  const index = formElements.indexOf(current) || 0;
  let style: FormElementStyleProps = formElements[0];
  for (var i = 1; i <= index; i++) {
    if (formElements[i]) {
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
  return style as ComputedFormElementStyle;
}

const bgStyle = (
  layout: FormElementBackgroundImagePlacement,
  image: string,
  color: string
) => {
  let position = "";
  // eslint-disable-next-line i18next/no-literal-string
  image = `url(${image}&auto=compress,format&w=1280)`;
  switch (layout) {
    case FormElementBackgroundImagePlacement.Cover:
      position = "center / cover no-repeat";
      break;
    case FormElementBackgroundImagePlacement.Top:
      position = "fixed no-repeat";
      const c = colord(color);
      const secondaryColor = c.darken(0.1).saturate(0.2).toHex();
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
};

export default SurveyAppLayout;

function UnsplashCredit({
  name,
  url,
  layout,
  isDark,
}: {
  name?: string;
  url?: string;
  layout: FormElementBackgroundImagePlacement;
  isDark: boolean;
}) {
  if (name && url) {
    return (
      <p
        className={`z-10 ${
          isDark ? "text-white" : "text-gray-800"
        } p-2 font-medium text-sm hidden sm:block opacity-50 ${
          layout === FormElementBackgroundImagePlacement.Cover
            ? "absolute bottom-0 left-0"
            : layout === FormElementBackgroundImagePlacement.Left
            ? "absolute bottom-0"
            : layout === FormElementBackgroundImagePlacement.Top
            ? "hidden"
            : "absolute bottom-0 right-0"
        }`}
      >
        <CameraIcon className="w-5 h-5 inline -mt-0.5 mr-1" />
        <span>
          <Trans ns="surveys">
            Photo by{" "}
            <a
              rel="no-referrer"
              href={url + "?utm_source=SeaSketch&utm_medium=referral"}
              className="underline"
            >
              {name}
            </a>{" "}
            on{" "}
            <a
              className="underline"
              href="https://unsplash.com?utm_source=SeaSketch&utm_medium=referral"
            >
              Unsplash
            </a>
            .
          </Trans>
        </span>
      </p>
    );
  } else {
    return null;
  }
}

export const SurveyStyleContext = createContext(defaultStyle);
