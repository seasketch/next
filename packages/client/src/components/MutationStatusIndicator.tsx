import { MutationResult } from "@apollo/client";
import React, { useEffect, useState } from "react";

export interface MutationStatusIndicatorProps {
  /* Second result of an apollo graphql mutation hook. Indicator will watch for mutation load, data, and error events */
  mutationStatus: Pick<MutationResult<any>, "called" | "loading" | "error">;
  /* If set, changes to the value will clear any error indicators */
  value?: any;
  className?: string;
}

export default function MutationStatusIndicator({
  mutationStatus,
  value,
  className,
}: MutationStatusIndicatorProps) {
  const [changeSinceError, setChangeSinceError] = useState<boolean>(false);
  useEffect(() => {
    if (changeSinceError === false && mutationStatus.error) {
      setChangeSinceError(true);
    }
  }, [changeSinceError, mutationStatus.error, value]);
  const state = mutationStatus.called
    ? mutationStatus.loading
      ? "SAVING"
      : "SAVED"
    : "NONE";
  const [showSaved, setShowSaved] = useState(true);
  useEffect(() => {
    if (state === "SAVED" && showSaved) {
      const timeout = setTimeout(() => {
        setShowSaved(false);
      }, 1000);
      return () => {
        clearTimeout(timeout);
      };
    } else if (state !== "SAVED") {
      setShowSaved(true);
    }
  }, [showSaved, state]);
  const error = mutationStatus.error;
  return (
    <div className={`relative w-5 h-5 inline-block ${className}`}>
      <div
        className={`absolute flex items-center pointer-events-none transition-opacity duration-500 ${
          state && state === "SAVING" ? "opacity-100" : "opacity-0"
        }`}
      >
        <svg
          className="animate-spin h-5 w-5 text-gray-500 opacity-25"
          xmlns="http://www.w3.org/2000/svg"
          fill="none"
          viewBox="0 0 24 24"
        >
          <circle
            className="opacity-25"
            cx="12"
            cy="12"
            r="10"
            stroke="currentColor"
            strokeWidth="4"
          ></circle>
          <path
            className="opacity-75"
            fill="currentColor"
            d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
          ></path>
        </svg>
      </div>

      <div
        className={`absolute flex items-center pointer-events-none transition-opacity duration-500 ${
          state && state === "SAVED" && showSaved ? "opacity-100" : "opacity-0"
        }`}
      >
        <svg
          className="h-5 w-5 text-primary-500"
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 20 20"
          fill="currentColor"
        >
          <path
            fillRule="evenodd"
            d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
            clipRule="evenodd"
          />
        </svg>
      </div>

      {error && (
        <div
          title={error.message}
          className="absolute flex items-center cursor-pointer"
        >
          <svg
            className="h-5 w-5 text-red-500"
            fill="currentColor"
            viewBox="0 0 20 20"
          >
            <path
              fillRule="evenodd"
              d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z"
              clipRule="evenodd"
            />
          </svg>
        </div>
      )}
    </div>
  );
}
