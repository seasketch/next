// Adapted from https://vhudyma-blog.eu/detect-mobile-device-in-react/
import { useMediaQuery } from "beautiful-react-hooks";
import { useState, useEffect } from "react";

function detectMobileTouchDevice() {
  let hasTouchScreen = false;
  if ("maxTouchPoints" in navigator) {
    hasTouchScreen = navigator.maxTouchPoints > 0;
  } else if ("msMaxTouchPoints" in navigator) {
    // @ts-ignore
    hasTouchScreen = navigator.msMaxTouchPoints > 0;
  } else {
    // @ts-ignore
    const mQ = window.matchMedia && matchMedia("(pointer:coarse)");
    if (mQ && mQ.media === "(pointer:coarse)") {
      hasTouchScreen = !!mQ.matches;
    } else if ("orientation" in window) {
      hasTouchScreen = true; // deprecated, but good fallback
    } else {
      // Only as a last resort, fall back to user agent sniffing
      var UA = navigator.userAgent;
      hasTouchScreen =
        /\b(BlackBerry|webOS|iPhone|IEMobile)\b/i.test(UA) ||
        /\b(Android|Windows Phone|iPad|iPod)\b/i.test(UA);
    }
  }
  return hasTouchScreen;
}

let _isMobile = detectMobileTouchDevice();

export default function useMobileDeviceDetector() {
  const [isMobile, setIsMobile] = useState(_isMobile);

  const matches = useMediaQuery("(pointer:coarse)");

  useEffect(() => {
    setIsMobile(detectMobileTouchDevice());
  }, [matches]);

  return isMobile;
}
