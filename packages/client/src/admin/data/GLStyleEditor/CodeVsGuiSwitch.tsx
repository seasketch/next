import { CodeIcon, SliderIcon } from "@radix-ui/react-icons";
import { useTranslation } from "react-i18next";

export default function CodeVsGuiSwitch({
  value,
  onChange,
  className,
}: {
  value: "code" | "style";
  onChange: (value: "code" | "style") => void;
  className?: string;
}) {
  const width = 90;
  // eslint-disable-next-line i18next/no-literal-string
  const { t } = useTranslation("admin:data");
  return (
    <div
      className={`text-sm flex relative items-center transition-colors border-2 rounded-md h-3/4 ${className} bg-gray-600 border-gray-600`}
    >
      <button
        onClick={() => onChange("style")}
        style={{ width }}
        className={`flex items-center justify-center space-x-1 z-10 py-1 px-2 ${
          value === "style" ? " text-black" : " text-gray-300"
        }`}
      >
        <SliderIcon className="w-4 h-4" />
        <span>{t("Editor")}</span>
      </button>
      <button
        onClick={() => onChange("code")}
        style={{ width }}
        className={`flex items-center justify-center space-x-1 z-10 py-1 px-2 ${
          value === "code" ? "text-black" : " text-gray-300"
        }`}
      >
        <CodeIcon className="w-4 h-4" />
        <span>{t("Code")}</span>
      </button>
      <div
        style={{
          width,
          transform:
            value === "style" ? "translateX(0)" : `translateX(${width}px)`,
        }}
        className={`transition-all h-full bg-indigo-200 absolute left-0  rounded shadow`}
      ></div>
    </div>
    // <div
    //   className={`flex items-center justify-end pr-2 relative ${
    //     value === "code" ? "text-blue-300" : "text-black"
    //   } ${className}`}
    // >
    //   {value === "code" ? (
    //     <CodeIcon className="pointer-events-none w-5 h-5 absolute right-10 " />
    //   ) : (
    //     <SliderIcon className="pointer-events-none w-4 h-4 absolute right-10 " />
    //   )}
    //   <select
    //     value={value}
    //     onChange={(e) => onChange(e.target.value as "style" | "code")}
    //     className={`text-sm rounded py-0.5 my-0   border-none pr-14 ${
    //       value === "code"
    //         ? "bg-gray-700 shadow"
    //         : "border border-gray-900 shadow-sm"
    //     }`}
    //   >
    //     <option value="style">{t("Style Editor")}</option>
    //     <option value="code">{t("Code Editor")}</option>
    //   </select>
    // </div>
  );
}
