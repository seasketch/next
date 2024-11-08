import { useContext } from "react";
import { Trans } from "react-i18next";
import { FilterInputServiceContext } from "../../formElements/FilterInputContext";
import Spinner from "../../components/Spinner";

export default function FilteredPlanningUnitCountHeader() {
  const context = useContext(FilterInputServiceContext);
  console.log("context", context);
  return (
    <div
      className={`w-full flex items-center p-2 px-4 border-b bg-gray-50 text-sm ${
        context.updatingCount ? "opacity-50" : "opacity-100"
      }`}
    >
      <div className="flex-1">
        <Trans ns="sketching">
          <b className="font-semibold">
            {context?.count.toLocaleString() || 0} cells
          </b>{" "}
          matching criteria
        </Trans>
      </div>
      <div
        className={`ml-2 flex items-center transition-opacity delay-500 ${
          context.updatingCount ? "opacity-100" : "opacity-0"
        }`}
      >
        <Spinner />
      </div>
    </div>
  );
}
