/* eslint-disable i18next/no-literal-string */
import { JobFragment } from "../generated/graphql";
import Modal from "./Modal";
import { Trans, useTranslation } from "react-i18next";

export default function WorkerJobDetails({
  job,
  onRequestClose,
}: {
  job: JobFragment;
  onRequestClose: () => void;
}) {
  const { t } = useTranslation("common");
  return (
    <Modal
      title={<Trans ns="common">Job Status</Trans>}
      onRequestClose={onRequestClose}
      open={true}
      footer={[
        {
          label: t("Close"),
          onClick: onRequestClose,
        },
        {
          label: t("Contact Support"),
          onClick: () => {
            window.open(
              `mailto:support@seasketch.org?subject=Job Key ${job.key}`,
              "_blank"
            );
          },
        },
      ]}
    >
      <div className="">
        <dl>
          <div className="bg-gray-50 px-4 py-5 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-6">
            <dt className="text-sm font-medium text-gray-500">Job Key</dt>
            <dd className="mt-1 text-sm text-gray-900 sm:col-span-2 sm:mt-0">
              {job.key}
            </dd>
          </div>
          <div className="bg-white px-4 py-5 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-6">
            <dt className="text-sm font-medium text-gray-500">Attempts</dt>
            <dd className="mt-1 text-sm text-gray-900 sm:col-span-2 sm:mt-0">
              {job.attempts} / {job.maxAttempts}
            </dd>
          </div>
          <div className="bg-gray-50 px-4 py-5 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-6">
            <dt className="text-sm font-medium text-gray-500">
              Last attempted
            </dt>
            <dd className="mt-1 text-sm text-gray-900 sm:col-span-2 sm:mt-0">
              {new Date(job.runAt).toLocaleString()}
            </dd>
          </div>
          <div className="bg-gray-50 px-4 py-5 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-6">
            <dt className="text-sm font-medium text-gray-500">
              Last Error Message
            </dt>
            <dd className="mt-1 text-sm text-gray-900 sm:col-span-2 sm:mt-0">
              {job.lastError}
            </dd>
          </div>

          <div className="bg-white px-4 py-5 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-6">
            <dt className="text-sm font-medium text-gray-500">Lock status</dt>
            <dd className="mt-1 text-sm text-gray-900 sm:col-span-2 sm:mt-0">
              {job.lockedAt
                ? t("Locked at") + " " + new Date(job.lockedAt).toLocaleString()
                : "Not locked"}
            </dd>
          </div>
          <div className="bg-white px-4 py-5 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-6">
            <dt className="text-sm font-medium text-gray-500">Task ID</dt>
            <dd className="mt-1 text-sm text-gray-900 sm:col-span-2 sm:mt-0">
              {job.taskIdentifier}
            </dd>
          </div>
        </dl>
      </div>
    </Modal>
  );
}
