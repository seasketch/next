import { Trans } from "react-i18next";
import {
  ChangeLogDetailsFragment,
  UserProfileDetailsFragment,
} from "../../generated/graphql";
import ChangeLogListItem from "./ChangeLogListItem";
import { CHANGE_LOG_INTRODUCTION_DATE } from "./constants";
import ChangeLogTimelineItem from "./ChangeLogTimelineItem";
import { ArchiveIcon } from "@heroicons/react/outline";

export default function LayerSettingsChangeLogList({
  changeLogs,
  authorProfile,
  createdAt,
}: {
  changeLogs: ChangeLogDetailsFragment[];
  authorProfile?: Pick<
    UserProfileDetailsFragment,
    "fullname" | "email" | "picture" | "affiliations" | "nickname" | "userId"
  >;
  createdAt?: Date;
}) {
  const layerCreatedBeforeChangeLogIntroduction =
    createdAt && createdAt < CHANGE_LOG_INTRODUCTION_DATE;
  const showLegacyCreatedItem =
    layerCreatedBeforeChangeLogIntroduction && authorProfile && createdAt;
  const itemCount = changeLogs.length + (showLegacyCreatedItem ? 1 : 0);
  if (itemCount === 0) {
    return null;
  }
  return (
    <div className="mt-6">
      <h3 className="py-1 text-xs font-semibold uppercase tracking-wide text-gray-500">
        <Trans ns="admin:data">History</Trans>
      </h3>
      <ul className="mt-4">
        {changeLogs.map((changeLog, index) => (
          <ChangeLogListItem
            key={changeLog.id}
            changeLog={changeLog}
            last={index === itemCount - 1}
          />
        ))}
        {showLegacyCreatedItem && (
          <ChangeLogTimelineItem
            profile={authorProfile}
            date={createdAt}
            icon={<ArchiveIcon className="h-5 w-5" />}
            iconClassName="bg-green-50 text-green-500"
            last
            summary={
              <Trans ns="admin:data">
                created this item before detailed changelog tracking began.
              </Trans>
            }
          />
        )}
      </ul>
    </div>
  );
}
