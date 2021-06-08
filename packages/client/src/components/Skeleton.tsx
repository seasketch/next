import React from "react";

export default function Skeleton({ className }: { className?: string }) {
  return (
    <div
      className={`inline-block seasketch-skeleton ${
        className ? className : "h-4 rounded mt-1 mb-1 w-full"
      }`}
    ></div>
  );
}
