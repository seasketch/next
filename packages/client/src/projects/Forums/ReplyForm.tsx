import { useCallback, useState } from "react";
import { useTranslation } from "react-i18next";
import { useHistory } from "react-router-dom";
import ProfilePhoto from "../../admin/users/ProfilePhoto";
import Button from "../../components/Button";
import { useGlobalErrorHandler } from "../../components/GlobalErrorHandler";
import {
  AuthorProfileFragment,
  TopicDetailDocument,
  TopicDetailQuery,
  useCreateReplyMutation,
} from "../../generated/graphql";
import getSlug from "../../getSlug";
import useLocalStorage from "../../useLocalStorage";
import UserProfileModal from "../UserProfileModal";
import PostContentEditor from "./PostContentEditor";
import { nameForProfile } from "./TopicListItem";
import { Trans as I18n } from "react-i18next";

const Trans = (props: any) => <I18n ns="forums" {...props} />;

export default function ReplyForm({
  profile,
  topicId,
  onReply,
}: {
  profile: AuthorProfileFragment;
  topicId: number;
  onReply?: (replyId: number) => void;
}) {
  const { t } = useTranslation("forums");
  const [content, setContent, clearContent] = useLocalStorage(
    `reply-to-${topicId}-content-${getSlug()}`,
    undefined
  );
  const [modalOpen, setModalOpen] = useState(false);
  const history = useHistory();

  const openProfileModal = useCallback(() => {
    setModalOpen(true);
  }, [setModalOpen]);

  const onError = useGlobalErrorHandler();
  const [reply, replyState] = useCreateReplyMutation({
    onError,
    variables: {
      topicId,
      content,
    },
    onCompleted: (data) => {
      clearContent();
      if (data.createPost?.post?.id && onReply) {
        onReply(data.createPost.post.id);
      }
    },
    update: async (cache, result) => {
      const post = result.data?.createPost?.post;
      if (post) {
        const data = cache.readQuery<TopicDetailQuery>({
          query: TopicDetailDocument,
          variables: {
            id: topicId,
          },
        });
        if (data?.topic?.postsConnection?.nodes) {
          cache.writeQuery({
            query: TopicDetailDocument,
            variables: {
              id: topicId,
            },
            data: {
              ...data,
              topic: {
                ...data.topic,
                postsConnection: {
                  ...data.topic.postsConnection,
                  nodes: [
                    ...data.topic.postsConnection.nodes.filter(
                      (p) => p.id !== post.id
                    ),
                    post,
                  ],
                },
              },
            },
          });
        }
      }
    },
  });

  const onSubmit = useCallback(
    async (currentOrEvent?: any) => {
      const message =
        currentOrEvent.type && currentOrEvent.type === "click"
          ? content
          : currentOrEvent;
      clearContent();
      await reply({
        variables: {
          topicId,
          content: message,
        },
      });
      clearContent();
    },
    [clearContent, reply, topicId, content]
  );

  return (
    <div className="p-4">
      <div className="bg-white shadow">
        <div
          className={`flex border-b p-1 pt-2 px-2 pb-1.5 items-center ${
            replyState.loading ? "opacity-50" : ""
          }`}
        >
          <button
            onClick={openProfileModal}
            className="ml-0.5 w-7 h-7 flex items-center"
          >
            <ProfilePhoto {...profile} canonicalEmail="" />
          </button>
          <div className="flex-1">
            <button
              onClick={openProfileModal}
              className="text-sm pl-2 hover:text-gray-600"
            >
              <Trans>
                Replying as{" "}
                <span className="font-semibold">{nameForProfile(profile)}</span>
              </Trans>
            </button>
          </div>
        </div>
        <PostContentEditor
          disabled={replyState.loading}
          onSubmit={onSubmit}
          initialContent={content}
          onChange={setContent}
        />
      </div>
      <div className="flex justify-end items-center p-2 py-3 space-x-2">
        <Button
          disabled={replyState.loading}
          loading={replyState.loading}
          label={t("Post Reply")}
          primary
          onClick={onSubmit}
        />
      </div>
      {modalOpen && (
        <UserProfileModal onRequestClose={() => setModalOpen(false)} />
      )}
    </div>
  );
}
