import { CameraIcon } from "@heroicons/react/solid";
import { useContext } from "react";
import { Trans } from "react-i18next";
import { FormElementLayout } from "../generated/graphql";
import { SurveyLayoutContext } from "./SurveyAppLayout";

export default function UnsplashCredit({
  name,
  url,
  layout,
  isDark,
}: {
  name?: string;
  url?: string;
  layout: FormElementLayout;
  isDark: boolean;
}) {
  const style = useContext(SurveyLayoutContext).style;
  if (
    layout === FormElementLayout.Cover ||
    style.isSmall ||
    layout === FormElementLayout.MapStacked
  ) {
    return null;
  }
  if (name && url) {
    return (
      <p
        className={`z-10 ${
          isDark ? "text-white" : "text-gray-800"
        } p-2 font-medium text-sm sm:block opacity-50 ${
          layout === FormElementLayout.Left
            ? "absolute bottom-0"
            : layout === FormElementLayout.Top
            ? "hidden sm:hidden"
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
          </Trans>
        </span>
      </p>
    );
  } else {
    return null;
  }
}
