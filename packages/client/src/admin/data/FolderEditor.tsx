import { useEffect, useState } from "react";
import {
  useUpdateTableOfContentsItemMutation,
  useGetFolderQuery,
  useUpdateFolderMutation,
} from "../../generated/graphql";
import { useTranslation, Trans } from "react-i18next";
import Spinner from "../../components/Spinner";
import MutableAutosaveInput from "../MutableAutosaveInput";
import AccessControlListEditor from "../../components/AccessControlListEditor";
import { folderToType, FolderType, typeToFolderProps } from "./EditFolderModal";
import { MutationStateIndicator } from "../../components/MutationStateIndicator";
import TranslatedPropControl from "../../components/TranslatedPropControl";
import useIsSuperuser from "../../useIsSuperuser";
import { CopyIcon } from "@radix-ui/react-icons";
import * as Tooltip from "@radix-ui/react-tooltip";

export default function FolderEditor({
  id,
  onRequestClose,
}: {
  id: number;
  onRequestClose?: () => void;
}) {
  const { t } = useTranslation("admin");
  const { data } = useGetFolderQuery({
    variables: {
      id,
    },
  });
  const [mutateItem, mutateItemState] = useUpdateTableOfContentsItemMutation();
  const [mutateFolder, mutateFolderState] = useUpdateFolderMutation();

  const isSuperuser = useIsSuperuser();
  const folder = data?.tableOfContentsItem;

  const [state, setState] = useState<{ title: string; folderType: FolderType }>(
    { title: "", folderType: FolderType.DEFAULT }
  );
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
  }, [folder]);
  const updateType = (value: FolderType) => {
    setState((prev) => ({
      ...prev,
      folderType: value,
    }));
    mutateFolder({
      variables: {
        id,
        ...typeToFolderProps(value),
      },
    });
  };

  const [copied, setCopied] = useState(false);

  return (
    <div
      className="bg-white z-30 absolute bottom-0 w-128 flex flex-col"
      style={{ height: "calc(100vh)" }}
    >
      <div className="flex-0 p-4 shadow-sm bg-gray-700 text-primary-300 flex items-center">
        <h4 className="font-medium text-indigo-100 flex-1">
          {t("Edit Folder")}
        </h4>
        <button
          className="bg-gray-300 bg-opacity-25 float-right rounded-full p-1 cursor-pointer focus:ring-blue-300"
          onClick={onRequestClose}
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            className="w-5 h-5 text-white"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M6 18L18 6M6 6l12 12"
            />
          </svg>
        </button>
      </div>
      {!folder && <Spinner />}
      {folder && (
        <div className="flex-1 overflow-y-auto px-4 pb-4">
          <div className="md:max-w-sm mt-5 relative">
            <MutableAutosaveInput
              // autofocus
              mutation={mutateItem}
              mutationStatus={mutateItemState}
              propName="title"
              value={folder?.title || ""}
              label={t("Name")}
              variables={{ id }}
            />
            <TranslatedPropControl
              id={folder.id}
              label={t("Folder Name")}
              propName="title"
              typeName="TableOfContentsItem"
              defaultValue={folder.title}
              className="p-0.5 absolute -right-9 top-8 -mt-0.5 border rounded hover:shadow-sm"
            />
          </div>
          <div>
            <fieldset className="mt-6 mb-8">
              <legend className="text-sm font-medium text-gray-700 relative">
                <Trans ns="admin">Folder type</Trans>
                <MutationStateIndicator
                  state={
                    mutateFolderState.called
                      ? mutateFolderState.loading
                        ? "SAVING"
                        : "SAVED"
                      : "NONE"
                  }
                  error={Boolean(mutateFolderState.error)}
                />
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
          </div>
          <div className="mt-5">
            {folder.acl?.nodeId && (
              <AccessControlListEditor nodeId={folder.acl?.nodeId} />
            )}
          </div>
          {isSuperuser && (
            <div className="mt-5 relative">
              <h5 className="block text-sm font-medium leading-5 text-gray-800 ">
                {t("Reference ID")}
              </h5>
              <div className="relative w-32">
                <input
                  className="rounded border-gray-200 text-sm font-mono mt-2 w-full"
                  disabled
                  type="text"
                  value={folder.stableId}
                />
                <button className="text-primary-500 absolute right-2 top-1/2 -mt-1">
                  <CopyIcon />
                </button>
                <Tooltip.Provider>
                  <Tooltip.Root open={copied} onOpenChange={setCopied}>
                    <Tooltip.Trigger asChild>
                      <button
                        className="text-primary-500 absolute right-2 top-1/2 -mt-1"
                        onClick={() => {
                          navigator.clipboard.writeText(folder.stableId);
                          setCopied(true);
                          setTimeout(() => setCopied(false), 2000);
                        }}
                      >
                        <CopyIcon />
                      </button>
                    </Tooltip.Trigger>
                    <Tooltip.Content
                      side="right"
                      align="center"
                      className="bg-black text-white p-1 rounded z-50"
                    >
                      {t("Copied")}
                      <Tooltip.Arrow className="text-black fill-current" />
                    </Tooltip.Content>
                  </Tooltip.Root>
                </Tooltip.Provider>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
