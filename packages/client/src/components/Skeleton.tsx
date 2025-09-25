export default function Skeleton({ className }: { className?: string }) {
  return (
    <div
      className={`inline-block seasketch-skeleton rounded-sm ${
        className ? className : "h-4 mt-1 mb-1 w-full"
      }`}
    ></div>
  );
}
