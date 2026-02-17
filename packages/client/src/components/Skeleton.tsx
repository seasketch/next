export default function Skeleton({
  className,
  strong,
}: {
  className?: string;
  strong?: boolean;
}) {
  return (
    <div
      className={`inline-block ${
        strong ? " seasketch-skeleton-strong" : "seasketch-skeleton"
      } rounded-sm ${className ? className : "h-4 mt-1 mb-1 w-full"}`}
    ></div>
  );
}
