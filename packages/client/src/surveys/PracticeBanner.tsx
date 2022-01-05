import { Trans } from "react-i18next";

export default function PracticeBanner({
  onPracticeClick,
}: {
  onPracticeClick?: () => void;
}) {
  return (
    <div
      onClick={onPracticeClick}
      className={`absolute z-10 w-full bg-yellow-300 text-yellow-700 text-xs lg:text-sm bg-opacity-50 text-center font-medium border-b border-black border-opacity-20 ${
        onPracticeClick ? "cursor-pointer" : ""
      }`}
    >
      <Trans ns="surveys">Practice Mode</Trans>
    </div>
  );
}
