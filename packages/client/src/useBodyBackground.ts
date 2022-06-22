import { useEffect, useState } from "react";

export default function useBodyBackground(
  backgroundStyle?: CSSStyleDeclaration["background"],
  skipAnimation?: boolean
) {
  const [prevBackground, setPrevBackground] = useState(
    document.body.style.background
  );

  useEffect(() => {
    document.body.style.setProperty("background", backgroundStyle || "#efefef");
  }, [backgroundStyle]);

  useEffect(() => {
    document.body.style.setProperty("transition", "none");
  }, [skipAnimation]);

  useEffect(() => {
    setPrevBackground(document.body.style.background);
    // looks convoluted because I'm trying to avoid a flash of background
    // transition upon first page load
    document.body.style.setProperty(
      "transition",
      "background-image 0ms, background-color 0ms"
    );
    // Doesn't seem to help safari 15
    // document.body.style.setProperty("min-height", "--webkit-fill-available");
    if (!skipAnimation) {
      setTimeout(() => {
        document.body.style.setProperty(
          "transition",
          "background-image 500ms, background-color 500ms"
        );
      }, 100);
    } else {
      document.body.style.setProperty("transition", "none");
    }
    return () => document.body.style.setProperty("background", prevBackground);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
}
