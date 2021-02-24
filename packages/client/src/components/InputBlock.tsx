import { MutationResult } from "@apollo/client";
import React, { FunctionComponent, ReactNode } from "react";
import MutationStatusIndicator from "./MutationStatusIndicator";

export interface InputBlockProps {
  title: string | ReactNode;
  input: ReactNode;
  className?: string;
  mutationStatus?: Pick<MutationResult<any>, "called" | "loading" | "error">;
  /* defaults to "large" */
  labelType?: "large" | "small";
}

const InputBlock: FunctionComponent<InputBlockProps> = ({
  input,
  title,
  className,
  children,
  mutationStatus,
  labelType,
}) => {
  labelType = labelType || "large";
  return (
    <div className={`mt-1 ${className}`}>
      <div className="flex mb-2 ">
        <div className="flex-1 font-medium flex-rows items-center pr-4 mt-0.5 self-center ">
          <div className="flex items-center">
            <span
              className={
                labelType === "small"
                  ? "text-sm font-medium leading-5 text-gray-700 mb-1"
                  : "mb-1"
              }
            >
              {title}
            </span>
            {mutationStatus && (
              <MutationStatusIndicator
                className="ml-2 mb-1"
                mutationStatus={mutationStatus}
              />
            )}
          </div>
          <div className="text-sm text-gray-600 font-normal">{children}</div>
        </div>
        <div className="flex-2  text-right flex items-center">{input}</div>
      </div>
    </div>
  );
};

export default InputBlock;
