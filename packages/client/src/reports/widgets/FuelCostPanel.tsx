import { Trans, useTranslation } from "react-i18next";
import {
  efficiencyUnitLabel,
  formatTravelCost,
  isRecognizedCurrency,
  parseTravelCostNumber,
  priceUnitLabel,
  TravelCostEstimate,
  TravelCostSettings,
  travelCostForMeters,
} from "./travelCost";

export type FuelCostRoute = {
  id: string;
  label: string | null;
  meters: number;
  distanceText: string;
  sketchName: string | null;
};

export type FuelCostGroup = {
  sketchId: number | null;
  sketchName: string | null;
  routes: FuelCostRoute[];
};

function nearestRoute(groups: FuelCostGroup[]): FuelCostRoute | null {
  let nearest: FuelCostRoute | null = null;
  for (const group of groups) {
    for (const route of group.routes) {
      if (!nearest || route.meters < nearest.meters) nearest = route;
    }
  }
  return nearest;
}

export function FuelCostPanel({
  settings,
  groups,
  efficiencyText,
  priceText,
  onEfficiencyText,
  onPriceText,
  showRestore,
  onRestoreDefaults,
  showHeading,
}: {
  settings: TravelCostSettings;
  groups: FuelCostGroup[];
  efficiencyText: string;
  priceText: string;
  onEfficiencyText: (value: string) => void;
  onPriceText: (value: string) => void;
  showRestore: boolean;
  onRestoreDefaults: () => void;
  showHeading: boolean;
}) {
  const { t, i18n } = useTranslation("reports");
  const efficiencyLabel = efficiencyUnitLabel(settings);
  const priceLabel = priceUnitLabel(settings);
  const efficiency = parseTravelCostNumber(efficiencyText);
  const price = parseTravelCostNumber(priceText);
  const estimateFor = (meters: number): TravelCostEstimate | null => {
    if (efficiency == null || price == null) return null;
    return travelCostForMeters(meters, settings, efficiency, price);
  };
  const money = (amount: number): string | null =>
    formatTravelCost(amount, settings.currency, i18n.language);
  const nearest = nearestRoute(groups);
  const nearestCost = nearest ? estimateFor(nearest.meters) : null;
  const nearestOneWay = nearestCost ? money(nearestCost.oneWay) : null;
  const nearestRoundTrip = nearestCost ? money(nearestCost.roundTrip) : null;
  const showCosts = nearestOneWay != null && nearestRoundTrip != null;
  const currencyMissing =
    efficiency != null &&
    price != null &&
    !isRecognizedCurrency(settings.currency);

  return (
    <div
      role="tabpanel"
      aria-label={t("Fuel assumptions")}
      className="px-3 py-3"
    >
      {showHeading ? (
        <h3 className="mb-2 text-sm font-medium text-gray-900">
          {t("Fuel assumptions")}
        </h3>
      ) : null}
      <p className="mb-3 text-xs leading-snug text-gray-500">
        <Trans ns="reports">
          These assumptions can be used to estimate fuel costs based on
          particular vessel attributes and current fuel costs, if provided.
        </Trans>
      </p>
      <div className="flex flex-wrap items-end gap-x-6 gap-y-3">
        <label className="block">
          <span className="mb-1 block text-xs text-gray-500">
            {t("Fuel use")}
          </span>
          <span className="inline-flex items-center gap-2">
            <input
              type="number"
              min={0}
              step="any"
              inputMode="decimal"
              value={efficiencyText}
              aria-label={t("Fuel use")}
              className="w-24 rounded border border-gray-200 px-2 py-1 text-sm tabular-nums"
              onChange={(event) => onEfficiencyText(event.target.value)}
            />
            <span className="text-sm text-gray-600">{efficiencyLabel}</span>
          </span>
        </label>
        <label className="block">
          <span className="mb-1 block text-xs text-gray-500">{t("Price")}</span>
          <span className="inline-flex items-center gap-2">
            <input
              type="number"
              min={0}
              step="any"
              inputMode="decimal"
              value={priceText}
              aria-label={t("Price")}
              className="w-24 rounded border border-gray-200 px-2 py-1 text-sm tabular-nums"
              onChange={(event) => onPriceText(event.target.value)}
            />
            <span className="text-sm text-gray-600">{priceLabel}</span>
            {showRestore && !showHeading ? (
              <button
                type="button"
                className="text-xs text-gray-500 underline decoration-gray-300 underline-offset-2 hover:text-gray-800"
                onClick={onRestoreDefaults}
              >
                {t("restore defaults")}
              </button>
            ) : null}
          </span>
        </label>
      </div>
      {showCosts && nearest ? (
        <p className="mt-3 rounded-md bg-slate-50 px-3 py-2 text-sm leading-snug text-gray-800">
          {nearest.label
            ? t(
                nearest.sketchName
                  ? "{{name}} from {{sketch}} is the nearest, {{distance}} away. One way costs {{oneWay}}, and returning on the same route costs {{roundTrip}}."
                  : "{{name}} is the nearest, {{distance}} away. One way costs {{oneWay}}, and returning on the same route costs {{roundTrip}}.",
                {
                  name: nearest.label,
                  sketch: nearest.sketchName ?? "",
                  distance: nearest.distanceText,
                  oneWay: nearestOneWay,
                  roundTrip: nearestRoundTrip,
                }
              )
            : t(
                "The nearest route is {{distance}}. One way costs {{oneWay}}, and returning on the same route costs {{roundTrip}}.",
                {
                  distance: nearest.distanceText,
                  oneWay: nearestOneWay,
                  roundTrip: nearestRoundTrip,
                }
              )}
        </p>
      ) : (
        <p className="mt-3 text-sm text-gray-600">
          {groups.every((group) => group.routes.length === 0) ? (
            <Trans ns="reports">No water route to a point feature.</Trans>
          ) : currencyMissing ? (
            <Trans ns="reports">
              A currency code is needed before costs can be shown.
            </Trans>
          ) : (
            <Trans ns="reports">
              Enter fuel use and a price to see a cost.
            </Trans>
          )}
        </p>
      )}
    </div>
  );
}
