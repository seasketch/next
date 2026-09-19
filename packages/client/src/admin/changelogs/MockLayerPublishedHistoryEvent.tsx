import { SpeakerphoneIcon } from "@heroicons/react/outline";
import { Trans, useTranslation } from "react-i18next";
import ChangeLogTimelineItem, {
  ChangeLogAuthorProfile,
} from "./ChangeLogTimelineItem";

export default function MockLayerPublishedHistoryEvent({
  profile,
  last,
}: {
  profile?: ChangeLogAuthorProfile | null;
  last?: boolean;
}) {
  const { t } = useTranslation("admin:data");

  return (
    <ChangeLogTimelineItem
      profile={profile}
      missingProfileLabel={t("Project administrator")}
      date={new Date(Date.now() - 12 * 60 * 1000)}
      icon={<SpeakerphoneIcon className="h-5 w-5" />}
      iconClassName="bg-emerald-100 text-emerald-700"
      last={last}
      summary={
        <Trans ns="admin:data">
          published this layer individually, outside a full overlay list publish
        </Trans>
      }
    />
  );
}
