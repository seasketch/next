/* eslint-disable i18next/no-literal-string */
import { DeviceFrameSpec } from "./deviceFrames";

type ContactFooterMask = {
  className: string;
};

type AppleDeviceFrameProps = {
  spec: DeviceFrameSpec;
  screenSrc: string;
  screenAlt: string;
  className?: string;
  hideContactFooter?: ContactFooterMask;
};

export default function AppleDeviceFrame({
  spec,
  screenSrc,
  screenAlt,
  className,
  hideContactFooter,
}: AppleDeviceFrameProps) {
  const { frameSize, screen, frameSrc, screenRadius, screenObjectPosition } =
    spec;

  return (
    <div
      className={`relative isolate w-full overflow-hidden ${className ?? ""}`}
      style={{ aspectRatio: `${frameSize.width} / ${frameSize.height}` }}
    >
      <div
        className="absolute overflow-hidden bg-black"
        style={{
          left: `${(screen.x / frameSize.width) * 100}%`,
          top: `${(screen.y / frameSize.height) * 100}%`,
          width: `${(screen.width / frameSize.width) * 100}%`,
          height: `${(screen.height / frameSize.height) * 100}%`,
          borderRadius: screenRadius,
        }}
      >
        <img
          src={screenSrc}
          alt={screenAlt}
          className="block h-full w-full object-cover"
          style={{
            objectPosition: screenObjectPosition ?? "top",
          }}
        />
        {hideContactFooter ? (
          <div
            aria-hidden
            className={`pointer-events-none absolute ${hideContactFooter.className}`}
          />
        ) : null}
      </div>
      <img
        src={frameSrc}
        alt=""
        aria-hidden
        className="pointer-events-none absolute inset-0 z-10 h-full w-full"
      />
    </div>
  );
}
