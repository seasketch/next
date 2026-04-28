import { UploadIcon } from "@heroicons/react/outline";
import { useQuery } from "@apollo/client";
import bytes from "bytes";
import { Trans, useTranslation } from "react-i18next";
import {
  UploadChangelogSourceDetailsDocument,
  UploadChangelogSourceDetailsQuery,
  UploadChangelogSourceDetailsQueryVariables,
} from "../../../generated/queries";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "../../../components/Tooltip";
import { humanizeOutputType } from "../../data/QuotaUsageTreemap";
import BaseFieldGroupListItem, {
  ChangeValue,
  FieldGroupListItemProps,
  summary,
  valueText,
} from "./FieldGroupListItemBase";
import { PlusCircledIcon } from "@radix-ui/react-icons";

export default function LayerUploadedFieldGroupListItem(
  props: FieldGroupListItemProps
) {
  const to = summary(props.changeLog.toSummary);
  const { t } = useTranslation("admin:data");
  const filename = valueText(to.filename, t("uploaded source"));
  const sourceId = uploadSourceId(
    (props.changeLog as { meta?: unknown }).meta
  );
  const { data } = useQuery<
    UploadChangelogSourceDetailsQuery,
    UploadChangelogSourceDetailsQueryVariables
  >(UploadChangelogSourceDetailsDocument, {
    variables: { id: sourceId ?? -1 },
    skip: !sourceId,
  });
  const originalOutput = data?.dataSource?.outputs?.find(
    (output: UploadOutput) => output.isOriginal
  );
  const filenameValue = originalOutput ? (
    <UploadFilenamePopover filename={filename} output={originalOutput} />
  ) : (
    <ChangeValue>{filename}</ChangeValue>
  );

  return (
    <BaseFieldGroupListItem
      {...props}
      icon={
        to.replacement ? (
          <UploadIcon className="h-5 w-5" />
        ) : (
          <PlusCircledIcon className="h-5 w-5" />
        )
      }
      iconClassName="bg-green-50 text-green-500"
    >
      {to.replacement ? (
        <Trans ns="admin:data">
          replaced source data with {filenameValue}
        </Trans>
      ) : (
        <Trans ns="admin:data">uploaded {filenameValue}</Trans>
      )}
      {to.changelog && (
        <span className="ml-1 text-gray-500">
          <ChangeValue>{valueText(to.changelog)}</ChangeValue>
        </span>
      )}
    </BaseFieldGroupListItem>
  );
}

function uploadSourceId(meta: unknown) {
  if (!meta || typeof meta !== "object" || Array.isArray(meta)) {
    return undefined;
  }
  const value = (meta as Record<string, unknown>).data_source_id;
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === "string") {
    const parsed = parseInt(value);
    return Number.isFinite(parsed) ? parsed : undefined;
  }
  return undefined;
}

type UploadOutput = NonNullable<
  NonNullable<UploadChangelogSourceDetailsQuery["dataSource"]>["outputs"]
>[number];

function UploadFilenamePopover({
  filename,
  output,
}: {
  filename: string;
  output: UploadOutput;
}) {
  const { t } = useTranslation("admin:data");
  const downloadName = output.originalFilename || output.filename || filename;
  const fileDescription = `${bytes(parseInt(output.size), {
    unitSeparator: "",
  })} ${humanizeOutputType(output.type)}`;

  return (
    <Tooltip placement="top">
      <TooltipTrigger asChild>
        <button
          type="button"
          onClick={(event) => {
            event.currentTarget.blur();
            downloadWithFilename(output.url, downloadName);
          }}
          className="inline-flex max-w-full cursor-pointer items-center align-baseline text-sm font-medium leading-5 text-blue-600 underline decoration-blue-400 decoration-dotted underline-offset-4 hover:text-blue-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500"
        >
          <span className="min-w-0">{filename}</span>
        </button>
      </TooltipTrigger>
      <TooltipContent className=" change-log-details-tooltip">
        <div className="flex min-w-0 flex-col gap-1 px-3 py-2 text-sm">
          <div className="whitespace-nowrap font-medium text-gray-900">
            {fileDescription}
          </div>
          <div className="whitespace-nowrap text-gray-500">
            {t("Click to download")}
          </div>
        </div>
      </TooltipContent>
    </Tooltip>
  );
}

async function downloadWithFilename(url: string, filename: string) {
  try {
    const response = await fetch(url);
    const blob = await response.blob();
    const blobUrl = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = blobUrl;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(blobUrl), 2000);
  } catch {
    window.open(url, "_blank", "noopener,noreferrer");
  }
}
