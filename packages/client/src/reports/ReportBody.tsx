import React from "react";
import { Trans, useTranslation } from "react-i18next";
import { useReportContext } from "./ReportContext";
import { ReportCardFactory } from "./ReportCard";

export function ReportBody() {
  const { t } = useTranslation("admin:sketching");
  const { selectedTab } = useReportContext();

  if (!selectedTab) {
    return null;
  }

  return (
    <div className="p-4 bg-gray-50 rounded-b-lg space-y-2">
      {selectedTab.cards?.length === 0 && (
        <div>
          <p className="text-sm text-gray-500">
            <Trans ns="admin:sketching">
              No cards found. Click the + button to customize.
            </Trans>
          </p>
        </div>
      )}
      {selectedTab.cards?.map((card) => (
        <ReportCardFactory key={card.id} config={card} />
      ))}
    </div>
  );
}
