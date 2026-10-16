import { useCallback, useState } from "react";
import { useTranslation } from "react-i18next";
import { useHistory } from "react-router-dom";
import ProfilePhoto from "../../admin/users/ProfilePhoto";
import Button from "../../components/Button";
import { useGlobalErrorHandler } from "../../components/GlobalErrorHandler";
import useDialog from "../../components/useDialog";
import {
  AuthorProfileFragment,
  ForumsDocument,
  TopicListDocument,
  TopicListQuery,
  useCreateTopicMutation,
} from "../../generated/graphql";
import getSlug from "../../getSlug";
import useLocalStorage from "../../useLocalStorage";
import UserProfileModal from "../UserProfileModal";
import PostContentEditor from "./PostContentEditor";
import ReactNodeViewPortalsProvider from "./ReactNodeView/PortalProvider";
import TopicTitleInput from "./TopicTitleInput";
import { nameForProfile } from "./TopicListItem";
import {
  forumMessageIsEmpty,
  isMissingTopicTitleError,
  isTopicTitleConstraintError,
  topicTitleProblem,
} from "./topicTitle";

const accessibleSketchIds: number[] = [];
export default function NewTopicForm({
  profile,
  forumId,
}: {
  profile: AuthorProfileFragment;
  forumId: number;
}) {
  const { t } = useTranslation("forums");
  const [storedTitle, setTitle, clearTitle] = useLocalStorage(
    `post-title-${getSlug()}`,
    ""
  );
  const title = typeof storedTitle === "string" ? storedTitle : "";
  const [content, setContent, clearContent] = useLocalStorage<unknown>(
    `post-content-${getSlug()}`,
    undefined
  );
  const [modalOpen, setModalOpen] = useState(false);
  const [hasBookmarkErrors, setHasBookmarkErrors] = useState(false);
  const [attemptedSubmit, setAttemptedSubmit] = useState(false);
  const [serverRejectedTitle, setServerRejectedTitle] = useState(false);
  const history = useHistory();
  const dialog = useDialog();
  const onCancel = useCallback(() => {
    clearTitle();
    clearContent();
    history.replace(`/${getSlug()}/app/forums/${forumId}`);
  }, [clearTitle, clearContent, history, forumId]);

  const openProfileModal = useCallback(() => {
    setModalOpen(true);
  }, [setModalOpen]);

  const onError = useGlobalErrorHandler();
  const [createTopic, mutationState] = useCreateTopicMutation({
    variables: {
      forumId,
      content,
      title,
    },
    onError: (error) => {
      if (isTopicTitleConstraintError(error)) {
        setServerRejectedTitle(true);
        return;
      }
      if (isMissingTopicTitleError(error)) {
        setAttemptedSubmit(true);
        return;
      }
      onError(error);
    },
    refetchQueries: [ForumsDocument],
    onCompleted: (data) => {
      clearTitle();
      clearContent();
      history.replace(
        `/${getSlug()}/app/forums/${forumId}/${data.createTopic.id}/`
      );
    },
    update: async (cache, result) => {
      const topic = result.data?.createTopic;
      if (topic) {
        const data = cache.readQuery<TopicListQuery>({
          query: TopicListDocument,
          variables: {
            forumId,
          },
        });
        if (data?.forum?.topicsConnection?.nodes) {
          cache.writeQuery({
            query: TopicListDocument,
            variables: {
              forumId,
            },
            data: {
              ...data,
              forum: {
                ...data.forum,
                topicsConnection: {
                  ...data.forum.topicsConnection,
                  nodes: [
                    ...data.forum.topicsConnection.nodes.filter(
                      (n) => n.id !== topic.id
                    ),
                    topic,
                  ],
                },
              },
            },
          });
        }
      }
    },
  });

  const onContentChange = useCallback(
    (next: unknown, errors: boolean) => {
      setContent(next);
      setHasBookmarkErrors(errors);
    },
    [setContent]
  );

  const titleTooLong =
    topicTitleProblem(title) === "tooLong" || serverRejectedTitle;
  const bodyMissing = attemptedSubmit && forumMessageIsEmpty(content);

  const onPost = useCallback(async () => {
    setAttemptedSubmit(true);
    if (topicTitleProblem(title) || serverRejectedTitle) {
      return;
    }
    if (forumMessageIsEmpty(content)) {
      return;
    }
    if (hasBookmarkErrors) {
      const proceed = await dialog.confirm(t("Map Bookmark Errors"), {
        description: t(
          "Your bookmarks refer to Sketches that are no longer posted. You should re-create these bookmarks before posting."
        ),
        primaryButtonText: t("Post anyways"),
      });
      if (!proceed) {
        return;
      }
    }
    await createTopic().catch(() => {
      // Unexpected failures are shown by onError. Title-length failures stay
      // next to the title field.
    });
  }, [
    title,
    serverRejectedTitle,
    content,
    hasBookmarkErrors,
    dialog,
    t,
    createTopic,
  ]);

  return (
    <div className="overflow-auto">
      <div
        className={`bg-white shadow ${
          mutationState.loading ? "opacity-70" : ""
        }`}
      >
        <div className="grid grid-cols-[auto_minmax(0,1fr)] items-center border-b p-1 pt-2 px-2 pb-1.5">
          <button
            onClick={openProfileModal}
            className="row-start-1 row-span-2 ml-0.5 flex h-12 w-12 items-center self-center"
          >
            <ProfilePhoto {...profile} canonicalEmail="" />
          </button>
          <button
            onClick={openProfileModal}
            className="col-start-2 pl-3 text-left text-sm hover:text-gray-600"
          >
            {nameForProfile(profile)}
          </button>
          <TopicTitleInput
            autoFocus={!content}
            title={title}
            showRequired={attemptedSubmit}
            serverRejected={serverRejectedTitle}
            onChange={(value) => {
              setServerRejectedTitle(false);
              setTitle(value);
            }}
          />
        </div>
        <ReactNodeViewPortalsProvider>
          <PostContentEditor
            // TODO: use bookmark data
            disabled={mutationState.loading}
            autofocus={Boolean(title && title.length)}
            initialContent={content}
            onChange={onContentChange}
            accessibleSketchIds={accessibleSketchIds}
          />
        </ReactNodeViewPortalsProvider>
      </div>
      {bodyMissing && (
        <p role="alert" className="px-4 pt-3 text-sm text-red-600">
          {t("Write a message before posting.")}
        </p>
      )}
      <div className="flex justify-end items-center p-2 py-3 space-x-2">
        <Button label={t("Cancel")} onClick={onCancel} />
        <Button
          loading={mutationState.loading}
          disabled={mutationState.loading || titleTooLong}
          label={t("Post New Topic")}
          primary
          onClick={onPost}
        />
      </div>
      {modalOpen && (
        <UserProfileModal onRequestClose={() => setModalOpen(false)} />
      )}
    </div>
  );
}
