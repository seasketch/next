import { RefObject } from "react";
import { SearchIcon } from "@heroicons/react/outline";
import { XCircleIcon } from "@heroicons/react/solid";
import { Trans, useTranslation } from "react-i18next";

export default function ListSearchInput({
  value,
  onChange,
  inputRef,
  id = "search",
}: {
  value: string;
  onChange: (value: string) => void;
  inputRef?: RefObject<HTMLInputElement>;
  id?: string;
}) {
  const { t } = useTranslation("admin");
  return (
    <div className="max-w-xs flex-none">
      <label htmlFor={id} className="sr-only">
        <Trans ns="admin">Search</Trans>
      </label>
      <div className="relative rounded-md shadow-sm">
        <div
          className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none"
          aria-hidden="true"
        >
          <SearchIcon
            className="mr-3 h-4 w-4 text-gray-400"
            aria-hidden="true"
          />
        </div>
        <input
          ref={inputRef}
          type="text"
          name="search"
          id={id}
          className="focus:ring-blue-300 focus:border-blue-300 block w-full pl-9 sm:text-sm border-gray-300 rounded-md"
          placeholder={t("Search")}
          value={value}
          onChange={(e) => onChange(e.target.value)}
        />
        <div
          className={`${
            value?.length > 0 ? "visible" : "hidden"
          } cursor-pointer absolute inset-y-0 right-2 pl-3 flex items-center`}
          onClick={() => onChange("")}
          aria-hidden="true"
        >
          <XCircleIcon className="w-4 h-4 text-gray-400" />
        </div>
      </div>
    </div>
  );
}
