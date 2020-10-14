import React, { FunctionComponent, ReactNode } from "react";

export interface InputBlockProps {
  title: string;
  input: ReactNode;
  className?: string;
}

const InputBlock: FunctionComponent<InputBlockProps> = ({
  input,
  title,
  className,
  children,
}) => {
  return (
    <div className={`mt-1 ${className}`}>
      <div className="flex mb-2">
        <div className="flex-1 font-medium flex-rows items-center pr-4 mt-0.5">
          <span>{title}</span>
          <div className="text-sm text-gray-600 font-normal">{children}</div>
        </div>
        <div className="flex-2  text-right flex items-center">{input}</div>
      </div>
    </div>
  );
};

export default InputBlock;
