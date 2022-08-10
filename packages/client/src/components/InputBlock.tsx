import { MutationResult } from "@apollo/client";
import { FunctionComponent, ReactNode } from "react";
import MutationStatusIndicator from "./MutationStatusIndicator";

export interface InputBlockProps {
  title: string | ReactNode;
  input: ReactNode;
  className?: string;
  mutationStatus?: Pick<MutationResult<any>, "called" | "loading" | "error">;
  /* defaults to "large" */
  labelType?: "large" | "small";
  flexDirection?: "column" | "row";
  description?: string | ReactNode;
}

const InputBlock: FunctionComponent<InputBlockProps> = ({
  input,
  title,
  className,
  children,
  mutationStatus,
  labelType,
  flexDirection,
  description,
}) => {
  labelType = labelType || "large";
  return (
    <div className={`${className}`}>
      <div
        className={`flex items-center mb-2 `}
        style={{ flexDirection: flexDirection || "row" }}
      >
        <div
          className={`flex-1 flex-row items-center pr-4 ${
            flexDirection === "column" && "w-full"
          }`}
        >
          <div className="flex flex-row items-center">
            <span
              className={
                labelType === "small"
                  ? "text-sm font-medium leading-5 text-gray-800"
                  : "mb-0"
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
        <div
          className={`text-right flex items-center ${
            flexDirection === "column" && "w-full"
          }`}
        >
          {input}
        </div>
      </div>
      {description && <p className="text-gray-500 text-sm">{description}</p>}
    </div>
  );
};

export default InputBlock;
