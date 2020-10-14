import React from "react";

export interface SegmentControlProps {
  segments: string[];
  value: string;
  onClick?: (segment: string) => void;
  // disabled?: boolean;
}

export default function SegmentControl(props: SegmentControlProps) {
  const index = props.segments.indexOf(props.value);
  if (index === -1) {
    throw new Error("Unknown SegmentControl value " + props.value);
  }
  let position = `${(index / props.segments.length) * 100}%`;
  return (
    <div className=" bg-cool-gray-200 flex rounded-md relative border-cool-gray-200 border-2">
      <span
        className="transition-all duration-75 text-sm rounded p-0.5 bg-white shadow-md absolute"
        style={{
          left: position,
          width: `${(1 / props.segments.length) * 100}%`,
        }}
      >
        &nbsp;
      </span>
      {props.segments.map((segment) => (
        <span
          onClick={(e) => {
            if (props.onClick) {
              props.onClick(segment);
            }
          }}
          key={segment}
          className="text-gray-800 select-none text-sm flex-1 text-center cursor-pointer rounded-md p-0.5 z-10"
        >
          {segment}
        </span>
      ))}
    </div>
  );
}
