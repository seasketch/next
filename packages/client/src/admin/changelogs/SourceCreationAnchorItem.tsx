import { InformationCircleIcon } from "@heroicons/react/outline";
import { Trans, useTranslation } from "react-i18next";
import ChangeLogTimelineItem, {
  ChangeLogAuthorProfile,
} from "./ChangeLogTimelineItem";
import { CHANGE_LOG_INTRODUCTION_DATE } from "./constants";
import { PlusCircledIcon } from "@radix-ui/react-icons";

const introDateFormatter = new Intl.DateTimeFormat(undefined, {
  dateStyle: "long",
});

export default function SourceCreationAnchorItem({
  isFolder,
  createdAt,
  profile,
}: {
  isFolder: boolean;
  createdAt: Date;
  profile?: ChangeLogAuthorProfile | null;
}) {
  const { t } = useTranslation("admin:data");
  const isLegacy = createdAt < CHANGE_LOG_INTRODUCTION_DATE;
  const introDateLabel = introDateFormatter.format(
    CHANGE_LOG_INTRODUCTION_DATE
  );

  const summary = isFolder ? (
    <Trans ns="admin:data">created this folder.</Trans>
  ) : (
    <Trans ns="admin:data">created this layer.</Trans>
  );

  const footer = isLegacy ? (
    <div className="rounded-lg border border-gray-200 bg-gray-50 px-3 py-2.5">
      <div className="flex gap-2.5">
        <InformationCircleIcon
          className="h-4 w-4 flex-none text-gray-400"
          aria-hidden
        />
        <div className="min-w-0 space-y-1.5 text-xs leading-snug text-gray-600">
          <p className="font-medium text-gray-700">
            {t("Detailed change history started {{introDate}}", {
              introDate: CHANGE_LOG_INTRODUCTION_DATE.toLocaleDateString(),
            })}
          </p>
          <p className="text-gray-500">
            {t("Edits and updates made before that date were not logged.")}
          </p>
        </div>
      </div>
    </div>
  ) : undefined;

  return (
    <ChangeLogTimelineItem
      profile={profile}
      date={createdAt}
      icon={<PlusCircledIcon className="h-5 w-5" />}
      iconClassName={"bg-emerald-50 text-emerald-700 ring-1 ring-emerald-100"}
      last
      summary={summary}
      footer={footer}
    />
  );
}
