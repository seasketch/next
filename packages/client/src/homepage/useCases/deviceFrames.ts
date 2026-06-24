/* eslint-disable i18next/no-literal-string */

import { CLOUDFLARE_IMAGES } from "./cloudflareImages";

export type DeviceFrameSpec = {
  id: string;
  frameSrc: string;
  frameSize: { width: number; height: number };
  screen: { x: number; y: number; width: number; height: number };
  /** CSS border-radius applied to the screen clip (matches display corner radius). */
  screenRadius?: string;
  /** Optional object-position for the screen capture (e.g. crop capture bleed). */
  screenObjectPosition?: string;
};

// Screen insets measured from frame PNG transparent screen holes.
// iPhone + iPad: device-frames-media index.json
// MacBook Pro 14: measured from mockup-device-frames Apple Design Resources export

export const iphone16ProBlackTitanium: DeviceFrameSpec = {
  id: "iphone-16-pro-black-titanium",
  frameSrc: "/uses/device-frames/iphone-16-pro-black-titanium-frame.png",
  frameSize: { width: 1406, height: 2822 },
  screen: { x: 102, y: 100, width: 1206, height: 2622 },
  screenRadius: "8%",
};

export const ipadPro11PortraitSpaceBlack: DeviceFrameSpec = {
  id: "ipad-pro-11-portrait-space-black",
  frameSrc: "/uses/device-frames/ipad-pro-11-portrait-space-black-frame.png",
  frameSize: { width: 1868, height: 2620 },
  screen: { x: 99, y: 100, width: 1668, height: 2420 },
  screenRadius: "2.5%",
};

export const ipadPro11LandscapeSpaceBlack: DeviceFrameSpec = {
  id: "ipad-pro-11-landscape-space-black",
  frameSrc: `${CLOUDFLARE_IMAGES}/771c864f-f6dd-4839-4dfc-31fd84243e00/public`,
  frameSize: { width: 2620, height: 1868 },
  screen: { x: 100, y: 100, width: 2420, height: 1668 },
  screenRadius: "2.5%",
};

export const macbookPro14: DeviceFrameSpec = {
  id: "macbook-pro-14",
  frameSrc: `${CLOUDFLARE_IMAGES}/3c8e4377-4b87-43af-55a7-7037abe64000/public`,
  frameSize: { width: 3944, height: 2564 },
  // Inner display hole: opaque bezel ends ~x461–3482, y365–2262 (alpha measured on frame PNG).
  screen: { x: 461, y: 300, width: 3022, height: 1965 },
  screenRadius: "0.4%",
  // Crop a few pixels of browser-chrome bleed from Playwright captures.
  screenObjectPosition: "50% 10px",
};
