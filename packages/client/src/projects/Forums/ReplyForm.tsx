import { useCallback, useState } from "react";
import { useTranslation } from "react-i18next";
import ProfilePhoto from "../../admin/users/ProfilePhoto";
import Button from "../../components/Button";
import { useGlobalErrorHandler } from "../../components/GlobalErrorHandler";
import {
  AuthorProfileFragment,
  ForumsDocument,
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
import ReactNodeViewPortalsProvider from "./ReactNodeView/PortalProvider";
import useDialog from "../../components/useDialog";

const Trans = (props: any) => <I18n ns="forums" {...props} />;

export default function ReplyForm({
  profile,
  topicId,
  onReply,
  accessibleSketchIds,
}: {
  profile: AuthorProfileFragment;
  topicId: number;
  onReply?: (replyId: number) => void;
  accessibleSketchIds: number[];
}) {
  const { t } = useTranslation("forums");
  const [content, setContent, clearContent] = useLocalStorage(
    `reply-to-${topicId}-content-${getSlug()}`,
    undefined
  );
  const [modalOpen, setModalOpen] = useState(false);
  const [hasErrors, setHasErrors] = useState(false);

  const onChange = useCallback(
    (content: any, errors: boolean) => {
      const attachments: any[] = [];
      for (const node of content.content) {
        if (node.type === "attachments") {
          attachments.push(node);
        }
      }
      if (attachments.length > 1) {
        console.error("More that 1 attachment block");
      }
      setContent(content);
      setHasErrors(errors);
    },
    [setContent]
  );

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
    refetchQueries: [ForumsDocument],
    onCompleted: (data) => {
      clearContent();
      if (data.createPost.id && onReply) {
        onReply(data.createPost.id);
      }
    },
    update: async (cache, result) => {
      const post = result.data?.createPost;
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

  const dialog = useDialog();

  const onSubmit = useCallback(
    async (currentOrEvent?: any, errors?: boolean) => {
      if (errors || hasErrors) {
        if (
          !(await dialog.confirm(t("Map Bookmark Errors"), {
            description: t(
              "Your bookmarks refer to Sketches that are no longer posted. You should re-create these bookmarks before posting."
            ),
            primaryButtonText: t("Post anyways"),
          }))
        ) {
          return;
        }
      }
      const message =
        currentOrEvent.type && currentOrEvent.type === "click"
          ? content
          : currentOrEvent;
      clearContent();
      await reply({
        variables: {
          topicId,
          content: message,
          // bookmarks: bookmarks
        },
      });
      clearContent();
    },
    [clearContent, reply, topicId, content, hasErrors, dialog, t]
  );

  return (
    <div className="p-4 mb-20">
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
        <ReactNodeViewPortalsProvider>
          <PostContentEditor
            disabled={replyState.loading}
            onSubmit={onSubmit}
            initialContent={content}
            onChange={onChange}
            accessibleSketchIds={accessibleSketchIds}
          />
        </ReactNodeViewPortalsProvider>
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
