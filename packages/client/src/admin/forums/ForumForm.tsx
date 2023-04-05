import {
  ForumListDetailsFragment,
  useUpdateForumMutation,
  DeleteForumDocument,
} from "../../generated/graphql";
import { useTranslation } from "react-i18next";
import { useGlobalErrorHandler } from "../../components/GlobalErrorHandler";
import MutableAutosaveInput from "../MutableAutosaveInput";
import InputBlock from "../../components/InputBlock";
import Switch from "../../components/Switch";
import AccessControlListEditor from "../../components/AccessControlListEditor";
import { useCallback, useState } from "react";
import Button from "../../components/Button";
import useDialog from "../../components/useDialog";
import { useDelete } from "../../graphqlHookWrappers";
import TranslatedPropControl from "../../components/TranslatedPropControl";

export default function ForumForm({
  forum,
  onDelete,
}: {
  forum: ForumListDetailsFragment;
  onDelete?: (id: number) => void;
}) {
  const onError = useGlobalErrorHandler();
  const { t } = useTranslation("admin:forums");
  const [mutateName, mutateNameState] = useUpdateForumMutation({
    variables: {
      id: forum.id,
    },
    onError,
  });
  const [mutateDescription, mutateDescriptionState] = useUpdateForumMutation({
    variables: {
      id: forum.id,
    },
    onError,
  });
  const [mutate] = useUpdateForumMutation({
    variables: {
      id: forum.id,
    },
    onError,
  });
  const [selectedTab] = useState("settings");

  const { confirmDelete } = useDialog();

  const del = useDelete(DeleteForumDocument);

  const toggleArchived = useCallback(() => {
    const archived = !forum.archived;
    mutate({
      variables: {
        id: forum.id,
        archived,
      },
      optimisticResponse: (d) => {
        return {
          __typename: "Mutation",
          updateForum: {
            __typename: "UpdateForumPayload",
            forum: {
              __typename: "Forum",
              ...forum,
              archived,
            },
          },
        };
      },
    });
  }, [forum, mutate]);
  return (
    <div className="min-h-screen max-h-screen overflow-hidden flex-col flex">
      <div className="p-2 py-3 bg-gray-700">
        <h1 className="text-lg font-semibold flex items-center text-gray-50">
          <span className="flex-1">{forum.name}</span>
        </h1>
      </div>
      <div className="bg-white flex-1 max-w-xl shadow z-0 w-128 overflow-x-hidden overflow-y-auto">
        {selectedTab === "settings" && (
          <div className="p-4 space-y-4">
            <div className="flex w-full items-center">
              <div className="flex-1">
                <MutableAutosaveInput
                  value={forum.name}
                  label={t("Name")}
                  mutation={mutateName}
                  mutationStatus={mutateNameState}
                  propName="name"
                />
              </div>
              <TranslatedPropControl
                id={forum.id}
                label={t("Forum Name")}
                propName="name"
                typeName="Forum"
                defaultValue={forum.name}
                className="p-0.5 border rounded hover:shadow-sm -mb-5 ml-2"
              />
            </div>
            <div className="flex w-full items-center">
              <div className="flex-1">
                <MutableAutosaveInput
                  textArea
                  value={forum.description || ""}
                  label={t("Description")}
                  mutation={mutateDescription}
                  mutationStatus={mutateDescriptionState}
                  propName="description"
                />
              </div>
              <TranslatedPropControl
                id={forum.id}
                label={t("Forum Description")}
                propName="description"
                typeName="Forum"
                defaultValue={forum.description}
                className="p-0.5 border rounded hover:shadow-sm -mb-5 ml-2"
              />
            </div>
            {forum.readAcl?.nodeId && (
              <AccessControlListEditor
                legend={t("Permission to read")}
                nodeId={forum.readAcl?.nodeId}
              />
            )}
            {forum.writeAcl?.nodeId && (
              <AccessControlListEditor
                legend={t("Permission to post")}
                nodeId={forum.writeAcl?.nodeId}
              />
            )}
            <div className="">
              <InputBlock
                input={
                  <Switch
                    isToggled={forum.archived!!}
                    onClick={toggleArchived}
                  />
                }
                title={t("Archive")}
                description={t(
                  "Enable if you would like to disable and hide this forum. Topics and posts will not be deleted but will only be accessible to adminstrators."
                )}
              />
            </div>
            <InputBlock
              input={
                <Button
                  disabled={Boolean(forum.postCount && forum.postCount >= 10)}
                  label={t("Delete")}
                  onClick={async () => {
                    if (!forum.postCount || forum.postCount < 10) {
                      confirmDelete({
                        message:
                          "Are you sure you want to delete this Forum and all associated posts?",
                        onDelete: async () => {
                          await del(forum);
                        },
                      });
                    }
                  }}
                />
              }
              title={t("Delete Forum")}
              description={
                !forum.postCount || forum.postCount < 10
                  ? t(
                      "This Forum can still be deleted since it has fewer than 10 posts. All related posts will be deleted."
                    )
                  : t(
                      "You can only delete forums if they have not been used to create more than 10 posts. Archive it instead if you would like to hide it."
                    )
              }
            />
          </div>
        )}
      </div>
    </div>
  );
}
