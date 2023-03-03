import { useCallback, useState } from "react";
import { useTranslation } from "react-i18next";
import { useHistory } from "react-router-dom";
import ProfilePhoto from "../../admin/users/ProfilePhoto";
import Button from "../../components/Button";
import { useGlobalErrorHandler } from "../../components/GlobalErrorHandler";
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
import { nameForProfile } from "./TopicListItem";

const accessibleSketchIds: number[] = [];
export default function NewTopicForm({
  profile,
  forumId,
}: {
  profile: AuthorProfileFragment;
  forumId: number;
}) {
  const { t } = useTranslation("forums");
  const [title, setTitle, clearTitle] = useLocalStorage(
    `post-title-${getSlug()}`,
    ""
  );
  const [content, setContent, clearContent] = useLocalStorage(
    `post-content-${getSlug()}`,
    undefined
  );
  const [modalOpen, setModalOpen] = useState(false);
  const history = useHistory();
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
    onError,
    refetchQueries: [ForumsDocument],
    onCompleted: () => {
      clearTitle();
      clearContent();
      history.replace(`/${getSlug()}/app/forums/${forumId}`);
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

  return (
    <div>
      <div
        className={`bg-white shadow ${
          mutationState.loading ? "opacity-70" : ""
        }`}
      >
        <div className="flex border-b p-1 pt-2 px-2 pb-1.5 items-center">
          <button
            onClick={openProfileModal}
            className="ml-0.5 w-12 h-12 flex items-center"
          >
            <ProfilePhoto {...profile} canonicalEmail="" />
          </button>
          <div className="flex-1">
            <button
              onClick={openProfileModal}
              className="text-sm pl-3 hover:text-gray-600"
            >
              {nameForProfile(profile)}
            </button>
            <input
              autoFocus={!content}
              className="-mt-0.5 pb-1 pt-0 pl-3 border-none outline-none focus:outline-none active:outline-none focus:border-none focus:ring-0 w-full font-semibold text-lg"
              type="text"
              value={title}
              placeholder={t("New Topic Title...")}
              onChange={(e) => setTitle(e.target.value)}
            />
          </div>
        </div>
        <ReactNodeViewPortalsProvider>
          <PostContentEditor
            // TODO: use bookmark data
            disabled={mutationState.loading}
            autofocus={Boolean(title && title.length)}
            initialContent={content}
            onChange={setContent}
            accessibleSketchIds={accessibleSketchIds}
          />
        </ReactNodeViewPortalsProvider>
      </div>
      <div className="flex justify-end items-center p-2 py-3 space-x-2">
        <Button label={t("Cancel")} onClick={onCancel} />
        <Button
          loading={mutationState.loading}
          disabled={mutationState.loading}
          label={t("Post New Topic")}
          primary
          onClick={async () => {
            await createTopic();
          }}
        />
      </div>
      {modalOpen && (
        <UserProfileModal onRequestClose={() => setModalOpen(false)} />
      )}
    </div>
  );
}
