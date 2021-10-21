import {
  FormElementTextVariant,
  FormElementBackgroundImagePlacement,
} from "../generated/graphql";
import ProgressBar from "./ProgressBar";
import useBodyBackground from "../useBodyBackground";
import { AnimatePresence, motion } from "framer-motion";
import { sizes, srcSet } from "./ImagePreloader";
import UnsplashCredit from "./UnsplashCredit";
import {
  surveyBackground,
  ComputedFormElementStyle,
  defaultStyle,
  SurveyStyleContext,
} from "./appearance";

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
  style = style || defaultStyle;
  useBodyBackground(
    surveyBackground(
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
                top ? "h-32 md:h-52 lg:h-64" : "h-full max-w-4xl"
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
                    ? style.isDark
                    : style.textVariant === FormElementTextVariant.Dark
                }
                layout={style.backgroundImagePlacement}
              />
            </div>
          )}
          <div
            className={`px-5 lg:px-10 max-w-xl mx-auto ${
              style.textClass
            } survey-content ${
              top
                ? "w-full"
                : "flex-0 flex flex-col center-ish max-h-full overflow-y-auto w-full md:w-128 lg:w-160 xl:w-full 2xl:mx-auto"
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
                  ? style.isDark
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

export default SurveyAppLayout;
