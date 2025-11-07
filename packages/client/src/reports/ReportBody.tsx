import { Trans } from "react-i18next";
import { useReportContext } from "./ReportContext";
import { ReportCardFactory } from "./ReportCard";

export function ReportBody() {
  const { report, selectedTabId, dependencies } = useReportContext();

  if (!report?.tabs || report.tabs.length === 0) {
    return null;
  }

  return (
    <div className="relative">
      {report.tabs.map((tab) => {
        const isActive = tab.id === selectedTabId;
        return (
          <div
            key={tab.id}
            className={
              isActive
                ? "p-4 space-y-2 relative w-full left-0"
                : "p-4 space-y-2 hidden"
            }
          >
            {tab.cards?.length === 0 && (
              <div>
                <p className="text-sm text-gray-500">
                  <Trans ns="admin:sketching">This tab is empty</Trans>
                </p>
              </div>
            )}
            {tab.cards?.map((card) => {
              const { metrics, loading, errors, overlaySources } =
                dependencies[card.id];
              return (
                <ReportCardFactory
                  key={card.id}
                  config={card}
                  metrics={metrics}
                  sources={overlaySources}
                  loading={loading}
                  errors={errors}
                />
              );
            })}
          </div>
        );
      })}
    </div>
  );
}
