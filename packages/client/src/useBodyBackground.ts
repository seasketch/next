import { useEffect, useState } from "react";

export default function useBodyBackground(
  backgroundStyle: CSSStyleDeclaration["background"]
) {
  const [prevBackground, setPrevBackground] = useState(
    document.body.style.background
  );
  useEffect(() => {
    setPrevBackground(document.body.style.background);
    return () => document.body.style.setProperty("background", prevBackground);
  }, []);
  useEffect(() => {
    document.body.style.setProperty("background", backgroundStyle);
  }, [backgroundStyle]);
}
