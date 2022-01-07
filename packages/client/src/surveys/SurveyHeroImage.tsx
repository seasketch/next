import { motion } from "framer-motion";
import { CSSProperties } from "react";
import {
  FormElementLayout,
  FormElementTextVariant,
} from "../generated/graphql";
import useBodyBackground from "../useBodyBackground";
import { ComputedFormElementStyle, surveyBackground } from "./appearance";
import { sizes, srcSet } from "./ImagePreloader";
import UnsplashCredit from "./UnsplashCredit";

interface SurveyBackgroundImageProps {
  style?: CSSProperties;
  surveyStyle: ComputedFormElementStyle;
  embeddedInAdmin?: boolean;
  unsplashCredit?: {
    name: string;
    url: string;
  };
}

export default function SurveyHeroImage({
  surveyStyle,
  embeddedInAdmin,
  unsplashCredit,
  style,
}: SurveyBackgroundImageProps) {
  // Set body background in the case of a Cover layout
  useBodyBackground(
    surveyBackground(
      surveyStyle.layout,
      surveyStyle.backgroundImage,
      surveyStyle.backgroundColor
    ),
    !!embeddedInAdmin
  );

  if (
    // In spatial inputs, we just do without the bg image
    surveyStyle.layout === FormElementLayout.MapStacked ||
    surveyStyle.layout === FormElementLayout.MapSidebarLeft ||
    surveyStyle.layout === FormElementLayout.MapSidebarRight ||
    surveyStyle.layout === FormElementLayout.MapFullscreen ||
    surveyStyle.layout === FormElementLayout.MapTop ||
    // In cover layout, the background image is set directly on document.body
    surveyStyle.layout === FormElementLayout.Cover
  ) {
    return null;
  }

  return (
    <div
      style={style}
      className={
        // When using top-layout, the grid template row size it set to auto
        // so that tailwind classes can set a responsive height
        surveyStyle.layout === FormElementLayout.Top
          ? "h-32 md:h-52 lg:h-64 relative"
          : "relative"
      }
    >
      <motion.img
        key={surveyStyle.backgroundImage}
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
        className="w-full h-full object-cover"
        src={
          /data:/.test(surveyStyle.backgroundImage)
            ? `${surveyStyle.backgroundImage}`
            : `${surveyStyle.backgroundImage}?&auto=format&w=1280`
        }
        style={{
          ...(surveyStyle.layout === FormElementLayout.Top
            ? {
                WebkitMaskImage:
                  "linear-gradient(to top, transparent 0%, black 100%)",
                maskImage:
                  "linear-gradient(to top, transparent 0%, black 100%)",
              }
            : {}),
          willChange: "opacity",
        }}
        srcSet={srcSet(surveyStyle!.backgroundImage)}
        sizes={sizes(surveyStyle!.layout)}
      />
      <UnsplashCredit
        name={unsplashCredit?.name}
        url={unsplashCredit?.url}
        isDark={
          surveyStyle.textVariant === FormElementTextVariant.Dynamic
            ? surveyStyle.isDark
            : surveyStyle.textVariant === FormElementTextVariant.Dark
        }
        layout={surveyStyle.layout}
      />
    </div>
  );
}
