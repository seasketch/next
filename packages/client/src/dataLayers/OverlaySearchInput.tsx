import { useEffect, useRef } from "react";
import Spinner from "../components/Spinner";
import { XCircleIcon } from "@heroicons/react/solid";
import { useTranslation } from "react-i18next";

export default function OverlaySearchInput({
  search,
  onChange,
  loading,
  className,
}: {
  search?: string;
  onChange?: (search: string) => void;
  loading?: boolean;
  className?: string;
}) {
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (
        (e.key === "/" || e.key === "?") &&
        // @ts-ignore
        "tagName" in e.target &&
        e.target.tagName !== "INPUT" &&
        (!("hasAttribute" in e.target) ||
          // @ts-ignore
          !e.target.hasAttribute("contenteditable"))
      ) {
        e.preventDefault();
        inputRef.current?.focus();
      }
    };
    document.body.addEventListener("keydown", handler);
    return () => {
      document.body.removeEventListener("keydown", handler);
    };
  }, [inputRef]);

  const { t } = useTranslation("homepage");

  return (
    <div className={`flex items-center relative ${className || ""}`}>
      <input
        ref={inputRef}
        value={search || ""}
        onChange={onChange ? (e) => onChange(e.target.value) : undefined}
        type="text"
        id="search"
        placeholder={t("search layers")}
        style={{ height: 26 }}
        className="text-sm rounded bg-gray-50 outline-none border-gray-300 pr-12"
      />
      <div className="w-10 h-6 -ml-12 relative flex items-center">
        <div
          className={
            (loading ? "opacity-100" : "opacity-0") +
            " transition-opacity duration-300 delay-100 flex items-center"
          }
        >
          <Spinner className={`z-10 scale-90 transform`} />
        </div>
        {Boolean(search?.length) && (
          <button onClick={onChange ? () => onChange("") : undefined}>
            <XCircleIcon className="w-5 h-5 text-gray-500 -right-0.5 top-0.5 absolute" />
          </button>
        )}
      </div>
    </div>
  );
}
