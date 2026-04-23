import { useRef } from "react";

let intersectionClipUid = 0;

/** Venn-style intersection glyph (matches geography clipping-layer UI). */
export default function IntersectionIcon({
  size = 24,
  className,
}: {
  size?: number;
  className?: string;
}) {
  const clipPathIdRef = useRef("");
  if (!clipPathIdRef.current) {
    intersectionClipUid += 1;
    // Technical SVG id prefix (not user-visible copy).
    // eslint-disable-next-line i18next/no-literal-string
    clipPathIdRef.current = `intersection-clip-${intersectionClipUid}`;
  }
  const clipPathId = clipPathIdRef.current;

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 32 32"
      className={className}
      aria-hidden
      focusable="false"
    >
      <defs>
        <clipPath id={clipPathId}>
          <circle cx="12" cy="16" r="8" />
        </clipPath>
      </defs>
      <circle cx="12" cy="16" r="8" fill="currentColor" fillOpacity="0.2" />
      <circle cx="20" cy="16" r="8" fill="currentColor" fillOpacity="0.2" />
      <circle
        cx="20"
        cy="16"
        r="8"
        fill="currentColor"
        fillOpacity="0.7"
        clipPath={`url(#${clipPathId})`}
      />
      <circle
        cx="12"
        cy="16"
        r="8"
        stroke="currentColor"
        strokeWidth="1.5"
        fill="none"
      />
      <circle
        cx="20"
        cy="16"
        r="8"
        stroke="currentColor"
        strokeWidth="1.5"
        fill="none"
      />
    </svg>
  );
}
