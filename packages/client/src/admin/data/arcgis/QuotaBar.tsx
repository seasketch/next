import bytes from "bytes";
import React from "react";

interface QuotaBarProps {
  total: number;
  remaining: number;
  additional?: number;
}

export default function QuotaBar(props: QuotaBarProps) {
  let additionalWidth = null;
  if (props.additional) {
    additionalWidth = Math.round((props.additional / props.total) * 100);
    if (additionalWidth >= 1) {
      additionalWidth = `${additionalWidth}%`;
    } else {
      additionalWidth = "2px";
    }
  }
  return (
    <div className="mb-2">
      <div className="bg-gray-300 w-full my-4 h-3 mb-1">
        <div
          className="bg-primary-300 float-left h-3"
          style={{
            width: `${Math.round(
              ((props.total - props.remaining) / props.total) * 100
            )}%`,
          }}
        >
          &nbsp;
        </div>
        {additionalWidth && (
          <div
            className="bg-primary-600 float-left h-3"
            style={{
              width: `${additionalWidth}`,
            }}
          >
            &nbsp;
          </div>
        )}
      </div>
      <span className="text-sm text-gray-500">
        {bytes(props.remaining, { decimalPlaces: 0 })} /{" "}
        {bytes(props.total, { decimalPlaces: 0 })} currently remaining
      </span>
    </div>
  );
}
