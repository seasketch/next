import { FormEvent, useEffect, useState } from "react";
import { Trans, useTranslation } from "react-i18next";
import Modal from "../../components/Modal";
import Spinner from "../../components/Spinner";
import TextInput from "../../components/TextInput";
import {
  TableOfContentsItem,
  useCreateFolderMutation,
  useGetFolderQuery,
  useUpdateFolderMutation,
} from "../../generated/graphql";
import useProjectId from "../../useProjectId";
import { generateStableId } from "./arcgis/arcgis";

export interface EditFolderModalProps {
  folderId?: number;
  onRequestClose?: (created: boolean) => void;
  className?: string;
  createNew?: boolean;
}

enum FolderType {
  DEFAULT,
  CLICK_OFF_ONLY,
  RADIO_CHILDREN,
  HIDE_CHILDREN,
}

export default function EditFolderModal({
  folderId,
  onRequestClose,
  className,
  createNew,
}: EditFolderModalProps) {
  const { data, loading } = useGetFolderQuery({
    variables: {
      id: folderId!,
    },
  });
  const projectId = useProjectId();
  const [mutate, mutationState] = useUpdateFolderMutation();
  const [create, createFolderState] = useCreateFolderMutation();
  const folder = data?.tableOfContentsItem;
  const [state, setState] = useState<{ title: string; folderType: FolderType }>(
    { title: "", folderType: FolderType.DEFAULT }
  );
  const [postCreateActionFinishing, setPostCreateActionFinishing] =
    useState(false);

  useEffect(() => {
    if (folder) {
      setState({
        title: folder.title,
        folderType: folderToType(folder),
      });
    } else {
      setState({
        title: "",
        folderType: FolderType.DEFAULT,
      });
    }
  }, [folder, createNew]);

  const onSave = async (e?: FormEvent) => {
    e?.preventDefault();
    try {
      if (createNew) {
        setPostCreateActionFinishing(true);
        await create({
          variables: {
            projectId: projectId!,
            stableId: generateStableId(),
            title: state.title,
            ...typeToFolderProps(state.folderType),
          },
        });
        if (!createFolderState.error && onRequestClose) {
          await onRequestClose(true);
          setPostCreateActionFinishing(false);
        }
      } else {
        await mutate({
          variables: {
            id: folderId!,
            title: state.title,
            ...typeToFolderProps(state.folderType),
          },
        });
        if (!mutationState.error && onRequestClose) {
          onRequestClose(false);
        }
      }
    } catch (e) {
      setPostCreateActionFinishing(false);
      console.error(e);
    }
  };

  const updateType = (value: FolderType) => {
    setState((prev) => ({
      ...prev,
      folderType: value,
    }));
  };
  const { t } = useTranslation("admin");

  const error = mutationState.error || createFolderState.error;
  const isLoading =
    mutationState.loading ||
    createFolderState.loading ||
    postCreateActionFinishing;
  return (
    <Modal
      className={`${className}`}
      footer={[
        {
          disabled: isLoading,
          label: t("Save"),
          loading: isLoading,
          variant: "primary",
          onClick: onSave,
        },
        {
          disabled: isLoading,
          label: t("Cancel"),
          onClick: () => {
            if (onRequestClose) {
              onRequestClose(false);
            }
          },
        },
      ]}
      onRequestClose={() => {}}
      title={createNew ? t("New Folder") : t("Edit Folder")}
    >
      {loading && <Spinner />}
      {(folder || !!createNew) && (
        <div className={``}>
          <form onSubmit={onSave}>
            <div className="max-w-xs">
              <TextInput
                autoFocus
                error={error ? error.message : undefined}
                name="folder-name"
                label={t("Name")}
                disabled={loading || isLoading}
                value={state.title}
                onChange={(val) =>
                  setState((prev) => ({
                    ...prev,
                    title: val,
                  }))
                }
              />
            </div>
            <fieldset className="mt-6 mb-8">
              <legend className="text-sm font-medium text-gray-700">
                <Trans ns="admin">Folder type</Trans>
              </legend>
              <div className="mt-2 space-y-4 pr-8 pl-2">
                <div className="relative flex items-start">
                  <div className="flex items-center h-5">
                    <input
                      onChange={() => updateType(FolderType.DEFAULT)}
                      checked={state.folderType === FolderType.DEFAULT}
                      id={FolderType.DEFAULT.toString()}
                      name={FolderType.DEFAULT.toString()}
                      type="radio"
                      className="focus:ring-blue-400 h-4 w-4 text-primary-500 border-gray-300"
                    />
                  </div>
                  <div className="ml-3 text-sm">
                    <label
                      htmlFor={FolderType.DEFAULT.toString()}
                      className="font-medium text-gray-700"
                    >
                      <Trans ns="admin">Default</Trans>
                    </label>
                    <p className="text-gray-500">
                      <Trans ns="admin">
                        Folder can be expanded and layers within can be toggled
                        individually.
                      </Trans>
                    </p>
                  </div>
                </div>
                <div className="relative flex items-start">
                  <div className="flex items-center h-5">
                    <input
                      onChange={() => updateType(FolderType.CLICK_OFF_ONLY)}
                      checked={state.folderType === FolderType.CLICK_OFF_ONLY}
                      id={FolderType.CLICK_OFF_ONLY.toString()}
                      name={FolderType.CLICK_OFF_ONLY.toString()}
                      type="radio"
                      className="focus:ring-blue-400 h-4 w-4 text-primary-500 border-gray-300"
                    />
                  </div>
                  <div className="ml-3 text-sm">
                    <label
                      htmlFor={FolderType.CLICK_OFF_ONLY.toString()}
                      className="font-medium text-gray-700"
                    >
                      <Trans ns="admin">Check-off only</Trans>
                    </label>
                    <p className="text-gray-500">
                      <Trans ns="admin">
                        Folders of this type do not enable users to turn on all
                        layers at once. They can use the folder to toggle all
                        layers <i>off</i>.
                      </Trans>
                    </p>
                  </div>
                </div>
                <div className="relative flex items-start">
                  <div className="flex items-center h-5">
                    <input
                      onChange={() => updateType(FolderType.HIDE_CHILDREN)}
                      checked={state.folderType === FolderType.HIDE_CHILDREN}
                      id={FolderType.HIDE_CHILDREN.toString()}
                      name={FolderType.HIDE_CHILDREN.toString()}
                      type="radio"
                      className="focus:ring-blue-400 h-4 w-4 text-primary-500 border-gray-300"
                    />
                  </div>
                  <div className="ml-3 text-sm">
                    <label
                      htmlFor={FolderType.HIDE_CHILDREN.toString()}
                      className="font-medium text-gray-700"
                    >
                      <Trans ns="admin">Hidden children</Trans>
                    </label>
                    <p className="text-gray-500">
                      <Trans ns="admin">
                        Folders of this type cannot be expanded to reveal the
                        layers within. This can be used to make multiple layers
                        appear as one in the table of contents.
                      </Trans>
                    </p>
                  </div>
                </div>
                <div className="relative flex items-start">
                  <div className="flex items-center h-5">
                    <input
                      onChange={() => updateType(FolderType.RADIO_CHILDREN)}
                      checked={state.folderType === FolderType.RADIO_CHILDREN}
                      id={FolderType.RADIO_CHILDREN.toString()}
                      name={FolderType.RADIO_CHILDREN.toString()}
                      type="radio"
                      className="focus:ring-blue-400 h-4 w-4 text-primary-500 border-gray-300"
                    />
                  </div>
                  <div className="ml-3 text-sm">
                    <label
                      htmlFor={FolderType.RADIO_CHILDREN.toString()}
                      className="font-medium text-gray-700"
                    >
                      <Trans ns="admin">Radio children</Trans>
                    </label>
                    <p className="text-gray-500">
                      <Trans ns="admin">
                        Only a single item within this folder can be turned on
                        at one time.
                      </Trans>
                    </p>
                  </div>
                </div>
              </div>
            </fieldset>
          </form>
        </div>
      )}
    </Modal>
  );
}

function folderToType(
  folder: Pick<
    TableOfContentsItem,
    | "id"
    | "bounds"
    | "isClickOffOnly"
    | "showRadioChildren"
    | "title"
    | "hideChildren"
  >
): FolderType {
  if (folder.hideChildren) {
    return FolderType.HIDE_CHILDREN;
  } else if (folder.isClickOffOnly) {
    return FolderType.CLICK_OFF_ONLY;
  } else if (folder.showRadioChildren) {
    return FolderType.RADIO_CHILDREN;
  }
  return FolderType.DEFAULT;
}

function typeToFolderProps(
  type: FolderType
): Pick<
  TableOfContentsItem,
  "isClickOffOnly" | "showRadioChildren" | "hideChildren"
> {
  if (type === FolderType.CLICK_OFF_ONLY) {
    return {
      isClickOffOnly: true,
      showRadioChildren: false,
      hideChildren: false,
    };
  } else if (type === FolderType.HIDE_CHILDREN) {
    return {
      isClickOffOnly: false,
      showRadioChildren: false,
      hideChildren: true,
    };
  } else if (type === FolderType.RADIO_CHILDREN) {
    return {
      isClickOffOnly: false,
      showRadioChildren: true,
      hideChildren: false,
    };
  }
  return {
    isClickOffOnly: false,
    showRadioChildren: false,
    hideChildren: false,
  };
}
