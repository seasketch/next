import { useContext } from "react";
import { Trans } from "react-i18next";
import { FilterInputServiceContext } from "../../formElements/FilterInputContext";
import Spinner from "../../components/Spinner";

const NumberFormatter = new Intl.NumberFormat("en-US", {
  maximumFractionDigits: 1,
});

export default function FilteredPlanningUnitCountHeader() {
  const context = useContext(FilterInputServiceContext);
  return (
    <div
      className={`border-b bg-gray-50 text-sm ${
        context.updatingCount ? "opacity-50" : "opacity-100"
      }`}
    >
      <div className={`w-full flex items-center p-2 px-4 `}>
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
      {context.stopInformation && (
        <div className={`w-full flex items-center pb-2 px-4`}>
          {context.stopInformation.resolution === 11 ? (
            <div>
              <Trans ns="sketching">
                Full resolution cells are being shown, roughly equivalent to a{" "}
                <b>
                  {context.stopInformation.area.toString()}{" "}
                  {context.stopInformation.unit}
                </b>{" "}
                square grid.
              </Trans>
            </div>
          ) : (
            <div>
              <Trans ns="sketching">
                Downsampled cells are displayed, roughly equivalent to a{" "}
                <b>
                  {NumberFormatter.format(context.stopInformation.area)}{" "}
                  {context.stopInformation.unit}
                </b>{" "}
                square grid. Zoom in to see the full resolution cells.
              </Trans>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
