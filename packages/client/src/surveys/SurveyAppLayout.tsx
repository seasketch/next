import {
  FormElementTextVariant,
  FormElementLayout,
  BasemapDetailsFragment,
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
import { Trans } from "react-i18next";
import { createPortal } from "react-dom";
import { useEffect, useRef, useState } from "react";
import { SurveyMapPortalContext } from "../formElements/FormElement";

require("./surveys.css");

export const SurveyAppLayout: React.FunctionComponent<{
  progress: number;
  embeddedInAdmin?: boolean;
  showProgress?: boolean;
  style?: ComputedFormElementStyle;
  unsplashUserName?: string;
  unsplashUserUrl?: string;
  practice?: boolean;
  onPracticeClick?: () => void;
}> = ({
  practice,
  progress,
  children,
  embeddedInAdmin,
  showProgress,
  style,
  unsplashUserName,
  unsplashUserUrl,
  onPracticeClick,
}) => {
  style = style || defaultStyle;
  useBodyBackground(
    surveyBackground(
      style.layout,
      style.backgroundImage,
      style.backgroundColor
    ),
    !!embeddedInAdmin
  );

  const mapPortalRef = useRef<HTMLDivElement | null>(null);
  const right = style.layout === FormElementLayout.Right;
  const left = style.layout === FormElementLayout.Left;
  const top = style.layout === FormElementLayout.Top;
  const topImage =
    style.layout === FormElementLayout.MapStacked ||
    style.layout === FormElementLayout.Top;
  const cover = style.layout === FormElementLayout.Cover;
  const mapStacked = style.layout === FormElementLayout.MapStacked;

  // const [animationComplete, setAnimationComplete] = useState(false);
  useEffect(() => {
    if (!embeddedInAdmin) {
      window.document.body.classList.add("survey");
    }
    return () => {
      window.document.body.classList.remove("survey");
    };
  });

  const content = (
    <SurveyMapPortalContext.Provider value={mapPortalRef.current}>
      <AnimatePresence initial={false} presenceAffectsLayout={false}>
        <SurveyStyleContext.Provider value={style}>
          {practice && (
            <div
              onClick={onPracticeClick}
              className={`absolute z-10 w-full bg-yellow-300 text-yellow-700 text-xs lg:text-sm bg-opacity-50 text-center font-medium border-b border-black border-opacity-20 ${
                onPracticeClick ? "cursor-pointer" : ""
              }`}
            >
              <Trans ns="surveys">Practice mode</Trans>
            </div>
          )}
          {showProgress && (
            <ProgressBar
              className={practice ? "top-4 lg:top-5" : ""}
              progress={progress}
              skipAnimation={embeddedInAdmin}
            />
          )}
          <div
            className={` ${
              topImage
                ? mapStacked
                  ? "flex-col flex h-full"
                  : ""
                : "flex h-screen"
            } ${cover ? "justify-center" : ""} ${
              right ? "flex-row-reverse" : "flex-row"
            }`}
            style={
              mapStacked
                ? {
                    // position: "relative",
                    // inset: 0,
                    width: "100vw",
                    // height: full
                    // minHeight: "100vh",
                    // height: "calc(100vh - env(safe-area-inset-bottom))",
                    // top: 0,
                    // bottom: 0,
                    // left: 0,
                    // right: 0,
                    // height: embeddedInAdmin ? "calc(100vh - 56px)" : "100vh",
                  }
                : {
                    // height: topImage
                    //   ? "auto"
                    //   : embeddedInAdmin
                    //   ? "calc(100vh - 56px)"
                    //   : "100vh",
                  }
            }
          >
            {!cover && (
              <div
                className={`w-full relative ${
                  topImage
                    ? mapStacked
                      ? "h-0 md:h-0 lg:h-0 pb-2 md:pb-5 flex-none"
                      : "h-32 md:h-52 lg:h-64 flex-none"
                    : "h-full max-w-4xl"
                } overflow-hidden`}
              >
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
                  className={`${
                    mapStacked ? "w-0 h-0" : "w-full h-full"
                  } object-cover absolute top-0`}
                  src={
                    /data:/.test(style.backgroundImage)
                      ? `${style.backgroundImage}`
                      : `${style.backgroundImage}?&auto=format&w=1280`
                  }
                  style={{
                    ...(topImage
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
                  sizes={sizes(style!.layout)}
                />
                <UnsplashCredit
                  name={unsplashUserName}
                  url={unsplashUserUrl}
                  isDark={
                    style.textVariant === FormElementTextVariant.Dynamic
                      ? style.isDark
                      : style.textVariant === FormElementTextVariant.Dark
                  }
                  layout={style.layout}
                />
              </div>
            )}

            <div
              className={`items-center p-5 flex-0 ${
                style.textClass
              } survey-content ${
                topImage
                  ? "w-full"
                  : "flex flex-col center-ish max-h-full overflow-y-auto w-full"
              }`}
            >
              <div className="max-h-full max-w-xl mx-auto">{children}</div>
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
                layout={style.layout}
              />
            )}
          </div>
          <div
            className={`w-full h-full flex-1 relative mx-auto overflow-hidden ${
              mapStacked ? "block" : "hidden"
            }`}
            ref={mapPortalRef}
          ></div>
        </SurveyStyleContext.Provider>
      </AnimatePresence>
    </SurveyMapPortalContext.Provider>
  );
  if (embeddedInAdmin) {
    return <div className={`w-full h-full relative`}>{content}</div>;
  } else {
    return createPortal(content, window.document.body);
  }
};

export default SurveyAppLayout;
