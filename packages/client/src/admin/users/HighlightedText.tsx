import Fuse from "fuse.js";
import strind from "strind";

export default function HighlightedText({
  match,
  text,
}: {
  match?: Fuse.FuseResultMatch;
  text?: string;
}) {
  if (!text) {
    return <span></span>;
  } else if (match) {
    const parts = strind(text, [...match.indices], ({ chars, matches }) => {
      return {
        text: chars,
        isHighlighted: matches,
      };
    });
    return (
      <>
        {(parts.matched as { text: string; isHighlighted: boolean }[]).map(
          ({ text, isHighlighted }, index) => {
            return (
              <span
                key={index}
                className={`${isHighlighted ? "bg-yellow-100" : "bg-white"}`}
              >
                {text}
              </span>
            );
          }
        )}
      </>
    );
  } else {
    return <span>{text}</span>;
  }
}
