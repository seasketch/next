import React from "react";

export default function ExcludeLayerToggle({
  excluded,
  onClick,
}: {
  excluded: boolean;
  onClick: () => void;
}) {
  const className = "w-5 h-5 text-primary-600";
  return (
    <button
      title={excluded ? "Include layer" : "Exclude layer"}
      className="-ml-1 mr-1 cursor-pointer"
      onClick={onClick}
    >
      {!excluded ? (
        <svg
          xmlns="http://www.w3.org/2000/svg"
          fill="none"
          viewBox="0 0 24 24"
          className={className}
          stroke="currentColor"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M15 12H9m12 0a9 9 0 11-18 0 9 9 0 0118 0z"
          />
        </svg>
      ) : (
        <svg
          xmlns="http://www.w3.org/2000/svg"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          className={className}
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M12 9v3m0 0v3m0-3h3m-3 0H9m12 0a9 9 0 11-18 0 9 9 0 0118 0z"
          />
        </svg>
      )}
    </button>
  );
}
