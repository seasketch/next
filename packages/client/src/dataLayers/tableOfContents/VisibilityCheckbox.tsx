export default function VisibilityCheckbox(props: {
  id: number;
  onClick?: () => void;
  disabled: boolean;
  visibility: boolean | "mixed";
  error?: boolean;
  radio?: boolean;
  className?: string;
  loading?: boolean;
}) {
  return (
    <>
      {/* {props.disabled && (
        <FolderIcon className="z-10 text-cool-gray-400 w-5 h-5 -mr-0.5 -ml-0.5 bg-transparent" />
      )} */}
      <input
        disabled={props.disabled}
        className={`cursor-pointer ${
          props.radio
            ? `rounded-xl ${props.visibility === true ? "ring-1" : ""}`
            : "rounded-md"
        } focus:outline-none focus:shadow-outline-blue focus:border-blue-300 focus:ring focus:ring-blue-200 focus:ring-opacity-50 sm:text-sm sm:leading-5 ${
          props.disabled
            ? "pointer-events-none border-gray-200 bg-gray-100"
            : "border-gray-300"
        } ${props.className} ${props.loading ? "transform rotate-45" : ""}`}
        style={{
          ...(props.error === true
            ? { color: "#c54141" }
            : { color: "rgba(50, 100, 245)" }),
          ...(props.radio ? { backgroundImage: "none" } : {}),
        }}
        // @ts-ignore
        indeterminate={(props.visibility === "mixed").toString()}
        onChange={(e) => {
          if (props.onClick) {
            props.onClick();
          }
        }}
        onClick={(e) => {
          e.stopPropagation();
        }}
        aria-checked={props.visibility}
        type="checkbox"
        checked={
          props.visibility === "mixed" || props.visibility === true
            ? true
            : false
        }
      />
    </>
  );
}
