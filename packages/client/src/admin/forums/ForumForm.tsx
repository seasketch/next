import TextInput from "../../components/TextInput";
import {
  SketchGeometryType,
  ForumListDetailsFragment,
  useUpdateForumMutation,
  DeleteForumDocument,
} from "../../generated/graphql";
import { Trans as I18n, useTranslation } from "react-i18next";
import { useGlobalErrorHandler } from "../../components/GlobalErrorHandler";
import MutableAutosaveInput from "../MutableAutosaveInput";
import InputBlock from "../../components/InputBlock";
import Switch from "../../components/Switch";
import AccessControlListEditor from "../../components/AccessControlListEditor";
import { useCallback, useMemo, useState } from "react";
import Button from "../../components/Button";
import useDialog from "../../components/useDialog";
import getSlug from "../../getSlug";
import { useDelete } from "../../graphqlHookWrappers";

const Trans = (props: any) => <I18n ns="admin:sketching" {...props} />;

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
  const [mutate, mutationState] = useUpdateForumMutation({
    variables: {
      id: forum.id,
    },
    onError,
  });
  const [selectedTab, setSelectedTab] = useState("settings");

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
      <div className="bg-white flex-1 max-w-xl shadow z-0 w-128 overflow-hidden">
        {selectedTab === "settings" && (
          <div className="p-4 space-y-4">
            <div className="">
              <MutableAutosaveInput
                value={forum.name}
                label={<Trans>Name</Trans>}
                mutation={mutateName}
                mutationStatus={mutateNameState}
                propName="name"
              />
            </div>
            <div className="">
              <MutableAutosaveInput
                textArea
                value={forum.description || ""}
                label={<Trans>Description</Trans>}
                mutation={mutateDescription}
                mutationStatus={mutateDescriptionState}
                propName="description"
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
                title={<Trans>Archive</Trans>}
                description={
                  <Trans>
                    Enable if you would like to disable and hide this forum.
                    Topics and posts will not be deleted but will only be
                    accessible to adminstrators.
                  </Trans>
                }
              />
            </div>
            <InputBlock
              input={
                <Button
                  disabled={Boolean(forum.postCount && forum.postCount >= 10)}
                  label={<Trans>Delete</Trans>}
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
              title={<Trans>Delete Forum</Trans>}
              description={
                !forum.postCount || forum.postCount < 10 ? (
                  <Trans>
                    This Forum can still be deleted since it has fewer than 10
                    posts. All related posts will be deleted.
                  </Trans>
                ) : (
                  <Trans>
                    You can only delete forums if they have not been used to
                    create more than 10 posts. Archive it instead if you would
                    like to hide it.
                  </Trans>
                )
              }
            />
          </div>
        )}
      </div>
    </div>
  );
}
