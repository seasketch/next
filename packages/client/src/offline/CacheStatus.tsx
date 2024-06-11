import { ReactNode } from "react";
import Badge from "../components/Badge";
import Spinner from "../components/Spinner";

function AssetTypeCount({ label, count }: { label: string; count: number }) {
  return (
    <Badge>
      {label}
      <span className="font-mono font-bold px-2 bg-opacity-10">{count}</span>
    </Badge>
  );
}

const formatPercent = Intl.NumberFormat(undefined, {
  unit: "percent",
  maximumFractionDigits: 0,
}).format;

function CacheProgress({
  description,
  percent,
  loading,
  className,
}: {
  description?: string | ReactNode;
  percent: number;
  loading?: boolean;
  className?: string;
}) {
  const barColor = percent === 100 ? "bg-primary-500" : "bg-yellow-600";
  return (
    <div className={className}>
      {" "}
      <div className="bg-gray-200 w-full h-2 my-2">
        <div
          className={`h-full ${barColor} transition-all`}
          style={{ width: `${percent}%` }}
        ></div>
      </div>
      <div className="flex text-sm text-gray-500">
        <div className="flex-1 truncate pr-5">{description}</div>
        {loading && (
          <div className="overflow-visible h-5 w-1">
            <Spinner className="" />
          </div>
        )}
        <span className="text-mono ml-5">{formatPercent(percent)}%</span>
      </div>
    </div>
  );
}

export { AssetTypeCount, CacheProgress };
