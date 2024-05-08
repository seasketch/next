import { Trans, useTranslation } from "react-i18next";
import Modal from "../../components/Modal";
import {
  useSetProjectDataHostingRetentionPeriodMutation,
  useProjectHostingRetentionPeriodQuery,
  useEstimatedDataHostingQuotaUsageQuery,
} from "../../generated/graphql";
import getSlug from "../../getSlug";
import { useGlobalErrorHandler } from "../../components/GlobalErrorHandler";
import { useEffect, useState } from "react";
import RadioGroup from "../../components/RadioGroup";
import Warning from "../../components/Warning";
import Skeleton from "../../components/Skeleton";
import bytes from "bytes";

export default function DataHostingRetentionPeriodModal({
  onRequestClose,
  projectId,
}: {
  onRequestClose: () => void;
  projectId: number;
}) {
  const { t } = useTranslation("admin:data");
  const onError = useGlobalErrorHandler();
  const { data, loading, error } = useProjectHostingRetentionPeriodQuery({
    variables: {
      slug: getSlug(),
    },
    onError,
  });

  const [days, setDays] = useState<number | null>(null);
  const { data: estimate, loading: estimateLoading } =
    useEstimatedDataHostingQuotaUsageQuery({
      variables: {
        slug: getSlug(),
        newRetentionPeriod: days === null ? null : { days },
      },
      onError,
    });
  useEffect(() => {
    setDays(data?.projectBySlug?.dataHostingRetentionPeriod?.days || null);
  }, [data?.projectBySlug?.dataHostingRetentionPeriod]);
  const [mutate, mState] = useSetProjectDataHostingRetentionPeriodMutation({
    variables: {
      id: projectId,
      period: days === null ? null : { days },
    },
  });

  const isChanged =
    days !== (data?.projectBySlug?.dataHostingRetentionPeriod?.days || null);

  return (
    <Modal
      loading={loading}
      title={t("Archived Data Layer Retention Policy")}
      onRequestClose={onRequestClose}
      footer={[
        {
          disabled: !isChanged,
          label: t("Save"),
          autoFocus: true,
          variant: "primary",
          loading: mState.loading,
          onClick: async () => {
            await mutate({
              variables: {
                id: projectId,
                period: days === null ? null : { days },
              },
            });
            onRequestClose();
          },
        },
        {
          label: t("Cancel"),
          onClick: onRequestClose,
        },
      ]}
    >
      <p className="text-sm text-gray-500">
        <Trans ns="admin:data">
          Archived data layers hosted on SeaSketch count against your project's
          storage quota. You may choose to keep these previous versions of
          layers indefinitely, or have them automatically deleted after a period
          of time.
        </Trans>
      </p>
      <RadioGroup
        value={days}
        onChange={(days) => setDays(days)}
        items={[
          {
            label: t("Keep indefinitely"),
            value: null,
            description: t(
              "Archived data layers will only be deleted when done so manually"
            ),
          },
          {
            label: t("30 days"),
            value: 30,
            description: t(
              "Archived data layers will be deleted after 30 days"
            ),
          },
          {
            label: t("6 months"),
            value: 180,
            description: t(
              "Archived data layers will be deleted after 180 days"
            ),
          },
          {
            label: t("1 year"),
            value: 365,
            description: t(
              "Archived data layers will be deleted after 365 days"
            ),
          },
        ]}
      />
      {
        estimateLoading ? (
          <div className="p-4">
            <Skeleton className="h-3 w-full" />
            <Skeleton className="h-3 w-3/4" />
          </div>
        ) : isChanged ? (
          <Warning level="info">
            {days === null ? (
              <Trans ns="admin:data">
                Saving this setting will immediately stop automatic deletion of
                archived data layer versions.
              </Trans>
            ) : (
              <Trans ns="admin:data">
                Saving these settings will apply the new retention policy within
                the next few minutes, deleting{" "}
                {{
                  layers:
                    estimate?.projectBySlug
                      ?.estimateDeletedDataForRetentionChange?.numSources || 0,
                }}{" "}
                sources and freeing up{" "}
                {{
                  bytes: bytes(
                    parseInt(
                      estimate?.projectBySlug?.estimateDeletedDataForRetentionChange?.bytes?.toString() ||
                        "0"
                    )
                  ),
                }}{" "}
                of storage.
              </Trans>
            )}
          </Warning>
        ) : null //<div className="h-20"></div>
      }
    </Modal>
  );
}
