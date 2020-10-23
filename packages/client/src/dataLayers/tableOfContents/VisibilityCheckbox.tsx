import React from "react";

export default function VisibilityCheckbox(props: {
  id: number;
  onClick?: () => void;
  disabled: boolean;
  visibility: boolean | "mixed";
}) {
  return (
    <input
      disabled={props.disabled}
      className="form-checkbox cursor-pointer mr-2"
      // @ts-ignore
      indeterminate={(props.visibility === "mixed").toString()}
      onChange={(e) => {
        if (props.onClick) {
          props.onClick();
        }
      }}
      aria-checked={props.visibility}
      type="checkbox"
      checked={
        props.visibility === "mixed" || props.visibility === true ? true : false
      }
    />
  );
}
