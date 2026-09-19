import {
  CheckCircleIcon,
  CollectionIcon,
  ExclamationIcon,
  FolderIcon,
  MinusCircleIcon,
} from "@heroicons/react/outline";
import { Trans, useTranslation } from "react-i18next";
import Modal from "../../components/Modal";

export default function MockPublishTableOfContentsItemModal({
  item,
  onRequestClose,
  onConfirm,
}: {
  item: {
    id: number;
    isFolder: boolean;
    title: string;
  };
  onRequestClose: () => void;
  onConfirm: () => void;
}) {
  const { t } = useTranslation("admin:data");

  return (
    <Modal
      title={
        item.isFolder ? t("Publish folder") : t("Publish individual layer")
      }
      onRequestClose={onRequestClose}
      disableBackdropClick
      panelClassName="sm:max-w-xl"
      footer={[
        {
          autoFocus: true,
          label: item.isFolder
            ? t("Publish folder")
            : t("Publish individual layer"),
          variant: "primary",
          onClick: onConfirm,
        },
        {
          label: t("Cancel"),
          onClick: onRequestClose,
        },
      ]}
    >
      <div className="space-y-5">
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 flex-none items-center justify-center rounded-full bg-primary-50 text-primary-700">
            {item.isFolder ? (
              <FolderIcon className="h-5 w-5" aria-hidden />
            ) : (
              <CollectionIcon className="h-5 w-5" aria-hidden />
            )}
          </div>
          <div>
            <h4 className="font-medium text-gray-900">{item.title}</h4>
            <p className="mt-1 text-sm leading-5 text-gray-600">
              {item.isFolder ? (
                <Trans ns="admin:data">
                  Publish this folder and all layers and folders inside it.
                </Trans>
              ) : (
                <Trans ns="admin:data">
                  Publish only this layer without publishing other draft
                  changes.
                </Trans>
              )}
            </p>
          </div>
        </div>

        <div className="overflow-hidden rounded-lg border border-gray-200">
          <div className="flex items-start gap-3 border-b border-gray-100 px-4 py-3">
            <CheckCircleIcon
              className="mt-0.5 h-5 w-5 flex-none text-emerald-600"
              aria-hidden
            />
            <div>
              <p className="text-sm font-medium text-gray-800">
                <Trans ns="admin:data">What will be published</Trans>
              </p>
              <p className="mt-1 text-sm text-gray-500">
                {item.isFolder ? (
                  <Trans ns="admin:data">
                    The complete folder subtree, including unchanged layers, so
                    its public structure stays consistent.
                  </Trans>
                ) : (
                  <Trans ns="admin:data">
                    All draft modifications to this layer, such as
                    cartography, popups, metadata, and access control
                    settings.
                  </Trans>
                )}
              </p>
            </div>
          </div>
          <div className="flex items-start gap-3 px-4 py-3">
            <MinusCircleIcon
              className="mt-0.5 h-5 w-5 flex-none text-slate-400"
              aria-hidden
            />
            <div>
              <p className="text-sm font-medium text-gray-800">
                <Trans ns="admin:data">What will not be published</Trans>
              </p>
              <p className="mt-1 text-sm text-gray-500">
                <Trans ns="admin:data">
                  Changes elsewhere in the overlay list will remain in draft.
                  Their public versions will not be affected.
                </Trans>
              </p>
            </div>
          </div>
        </div>

        {item.isFolder && (
          <div className="flex gap-3 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3">
            <ExclamationIcon
              className="h-5 w-5 flex-none text-amber-600"
              aria-hidden
            />
            <div>
              <p className="text-sm font-medium text-amber-900">
                <Trans ns="admin:data">
                  Pauses inside this folder will be cleared
                </Trans>
              </p>
              <p className="mt-1 text-sm leading-5 text-amber-800">
                <Trans ns="admin:data">
                  Two paused descendant layers will be resumed and included.
                  Future project publishes may include their changes.
                </Trans>
              </p>
            </div>
          </div>
        )}
      </div>
    </Modal>
  );
}
