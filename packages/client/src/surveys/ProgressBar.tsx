export default function ProgressBar({
  progress,
  skipAnimation,
  className,
}: {
  progress: number;
  skipAnimation?: boolean;
  className?: string;
}) {
  return (
    <div
      className={`w-full bg-yellow-300 bg-opacity-30 h-2 absolute z-10 border-b border-yellow-600 border-opacity-30 p-0 ${className}`}
    >
      <div
        style={{
          width: `${progress * 100}%`,
          transition: skipAnimation ? "none" : "width 500ms",
        }}
        className=" bg-yellow-300 h-full transition-all"
      >
        &nbsp;
      </div>
    </div>
  );
}
