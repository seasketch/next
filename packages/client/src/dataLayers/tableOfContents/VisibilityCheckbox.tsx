import React from "react";

export default function VisibilityCheckbox(props: {
  id: number;
  onClick?: () => void;
  disabled: boolean;
  visibility: boolean | "mixed";
  error?: boolean;
}) {
  return (
    <input
      disabled={props.disabled}
      className={`cursor-pointer mr-2 form-checkbox`}
      style={props.error === true ? { backgroundColor: "#c54141" } : {}}
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
