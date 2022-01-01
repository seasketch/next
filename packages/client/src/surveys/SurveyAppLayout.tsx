import {
  FormElementTextVariant,
  FormElementLayout,
} from "../generated/graphql";
import ProgressBar from "./ProgressBar";
import { AnimatePresence } from "framer-motion";
import UnsplashCredit from "./UnsplashCredit";
import {
  ComputedFormElementStyle,
  defaultStyle,
  SurveyStyleContext,
} from "./appearance";
import { createPortal } from "react-dom";
import {
  createContext,
  ReactNode,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import { SurveyMapPortalContext } from "../formElements/FormElement";
import PracticeBanner from "./PracticeBanner";
import SurveyHeroImage from "./SurveyHeroImage";

require("./surveys.css");

type LayoutContext = {
  mapPortal: HTMLDivElement | null;
  style: ComputedFormElementStyle & { isDark: boolean; isSmall: boolean };
  navigatingBackwards?: boolean;
};

export const SurveyLayoutContext = createContext({
  mapPortal: null,
  style: {},
} as LayoutContext);

export const SurveyAppLayout: React.FunctionComponent<{
  progress: number;
  embeddedInAdmin?: boolean;
  showProgress?: boolean;
  style?: ComputedFormElementStyle;
  unsplashUserName?: string;
  unsplashUserUrl?: string;
  practice?: boolean;
  onPracticeClick?: () => void;
  navigatingBackwards?: boolean;
  navigation?: ReactNode;
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
  navigatingBackwards,
  navigation,
}) => {
  style = style || defaultStyle;
  const [mapPortal, setMapPortal] = useState<HTMLDivElement | null>(null);
  const mapPortalRef = useCallback((node) => {
    if (node !== null) {
      setMapPortal(node);
    }
  }, []);

  const [layoutContext, setLayoutContext] = useState<LayoutContext>({
    mapPortal: null,
    style: style,
    navigatingBackwards,
  });

  useEffect(() => {
    if (style) {
      setLayoutContext({
        style,
        mapPortal,
      });
    }
  }, [style, mapPortal]);

  useEffect(() => {
    if (!embeddedInAdmin) {
      window.document.documentElement.classList.add("survey");
    }
    return () => {
      window.document.documentElement.classList.remove("survey");
    };
  }, []);

  // eslint-disable-next-line i18next/no-literal-string
  let grid: string;
  let navPosition: string =
    "fixed bottom-3 right-3 md:bottom-6 md:right-6 lg:bottom-10 lg:right-10";
  switch (style.layout) {
    case FormElementLayout.Cover:
      // eslint-disable-next-line i18next/no-literal-string
      grid = `
        [row2-start] "content content" 100% [row2-end]
        / auto auto
      `;
      navPosition =
        "fixed bottom-3 right-3 md:bottom-6 md:right-6 lg:bottom-10 lg:right-10";
      break;
    case FormElementLayout.MapStacked:
      // eslint-disable-next-line i18next/no-literal-string
      grid = `
        [row2-start] "content content" auto [row2-end]
        [row2-start] "map map" 1fr [row2-end]
        / auto auto
      `;
      navPosition =
        "fixed bottom-3 right-3 md:bottom-6 md:right-6 lg:bottom-10 lg:right-5";
      break;
    case FormElementLayout.Left:
      // eslint-disable-next-line i18next/no-literal-string
      grid = `
        [row1-start] "content hero-image" 100% [row1-end]
        / minmax(480px, 1fr) 1fr
      `;
      navPosition =
        "fixed bottom-3 right-3 md:bottom-6 md:right-6 lg:bottom-10 lg:right-10";
      break;
    case FormElementLayout.Right:
      // eslint-disable-next-line i18next/no-literal-string
      grid = `
        [row1-start] "hero-image content" 100% [row1-end]
        / 1fr minmax(480px, 1fr)
      `;
      navPosition =
        "fixed bottom-3 right-3 md:right-1/2 md:bottom-6 md:pr-4 lg:bottom-10 lg:pr-8";
      break;
    case FormElementLayout.MapSidebarLeft:
      // eslint-disable-next-line i18next/no-literal-string
      grid = `
        [row0-start] "sidebar-header map" min-content [row0-end]
        [row1-start] "content map" auto [row1-end]
        / minmax(480px, 1fr) 2fr
      `;
      break;
    case FormElementLayout.MapSidebarRight:
      // eslint-disable-next-line i18next/no-literal-string
      grid = `
        [row0-start] "map sidebar-header" min-content [row0-end]
        [row1-start] "map content" auto [row1-end]
        / 2fr minmax(480px, 1fr)
      `;
      navPosition =
        "fixed bottom-3 left-96 md:bottom-6 md:right-6 lg:bottom-10 lg:right-10";
      break;
    case FormElementLayout.MapFullscreen:
      // eslint-disable-next-line i18next/no-literal-string
      grid = `
        [row0-start] "map" 1fr [row0-end]
        [row0-start] "content" 0px [row0-end]
        / 1fr
      `;
      break;
    default:
      // FormElementLayout.Top
      // eslint-disable-next-line i18next/no-literal-string
      grid = `
        [row1-start] "hero-image hero-image" auto [row1-end]
        [row2-start] "content content" 1fr [row2-end]
        / auto auto
      `;
      break;
  }

  let centerIsh =
    // only vertically pad content if not one of these layouts
    style.layout !== FormElementLayout.Top &&
    style.layout !== FormElementLayout.MapStacked &&
    style.layout !== FormElementLayout.MapSidebarRight &&
    style.layout !== FormElementLayout.MapSidebarLeft
      ? "center-ish"
      : "";

  // TODO: Debugging. Erase this
  // centerIsh = "";

  const mapLayout =
    style.layout === FormElementLayout.MapStacked ||
    style.layout === FormElementLayout.MapSidebarRight ||
    style.layout === FormElementLayout.MapSidebarLeft ||
    style.layout === FormElementLayout.MapFullscreen;

  let scrollContentArea =
    style.layout === FormElementLayout.Left ||
    style.layout === FormElementLayout.Right ||
    style.layout === FormElementLayout.MapSidebarLeft ||
    style.layout === FormElementLayout.MapSidebarRight;

  const content = (
    <SurveyLayoutContext.Provider value={layoutContext}>
      <SurveyMapPortalContext.Provider value={mapPortal}>
        <SurveyStyleContext.Provider value={style}>
          <AnimatePresence initial={false} presenceAffectsLayout={false}>
            <div
              className={`grid overflow-hidden ${
                scrollContentArea ? "h-full" : ""
              }`}
              style={{ grid }}
            >
              {!scrollContentArea && (
                <div className="fixed z-10 right-3 bottom-3 lg:p-5 xl:p-10 2xl:p-14 3xl:p-20">
                  {navigation}
                </div>
              )}
              {practice && <PracticeBanner onPracticeClick={onPracticeClick} />}
              {showProgress && (
                <ProgressBar
                  className={practice ? "top-4 lg:top-5" : ""}
                  progress={progress}
                  skipAnimation={embeddedInAdmin}
                />
              )}
              <SurveyHeroImage
                style={{ gridArea: "hero-image" }}
                surveyStyle={style}
                embeddedInAdmin={embeddedInAdmin}
                unsplashCredit={
                  unsplashUserName && unsplashUserUrl
                    ? { name: unsplashUserName, url: unsplashUserUrl }
                    : undefined
                }
              />

              <div
                style={{
                  gridArea: "content",
                }}
                className={`relative md:flex md:flex-col ${
                  scrollContentArea && "overflow-y-auto"
                } p-3 lg:p-5 xl:p-10 2xl:p-14 3xl:p-20 ${centerIsh} ${
                  style.textClass
                }`}
              >
                {scrollContentArea && (
                  <div
                    className="sticky w-full flex justify-end z-10  pointer-events-none"
                    style={{
                      top: "calc(100% - 40px)",
                      height: 0,
                      overflow: "visible",
                    }}
                  >
                    {navigation}
                  </div>
                )}
                <div
                  className={`mx-auto ${
                    !scrollContentArea && "-mt-12 sm:mt-0"
                  } max-w-2xl`}
                >
                  {children}
                </div>
              </div>
              {style.layout === FormElementLayout.Cover && (
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
              {/* Map portal element */}
              {mapLayout && (
                <div
                  className="relative"
                  style={{
                    gridArea: "map",
                  }}
                  ref={mapPortalRef}
                />
              )}
            </div>
            {/* </div> */}
          </AnimatePresence>
        </SurveyStyleContext.Provider>
      </SurveyMapPortalContext.Provider>
    </SurveyLayoutContext.Provider>
  );
  if (embeddedInAdmin) {
    return <div className={`w-full h-full relative`}>{content}</div>;
  } else {
    return createPortal(content, window.document.body);
  }
};

export default SurveyAppLayout;
