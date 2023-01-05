import { useApolloClient } from "@apollo/client";
import { useMemo, useRef } from "react";
import Skeleton from "../../components/Skeleton";
import {
  ForumTopicFragment,
  ForumTopicFragmentDoc,
  ParticipationStatus,
  useTopicDetailQuery,
} from "../../generated/graphql";
import ForumPost from "./ForumPost";
import ReplyForm from "./ReplyForm";
import { Trans as I18n } from "react-i18next";
import { AnimatePresence, motion } from "framer-motion";
import LoginOrJoinPrompt from "./LoginOrJoinPrompt";

const Trans = (props: any) => <I18n ns="forums" {...props} />;

export default function Topic({ id }: { id: number }) {
  const { data } = useTopicDetailQuery({
    variables: {
      id,
    },
    returnPartialData: true,
    fetchPolicy: "cache-and-network",
    pollInterval: 40000,
  });

  const client = useApolloClient();
  const title = useMemo(() => {
    if (data?.topic) {
      return data.topic.title;
    } else {
      const topic = client.cache.readFragment({
        fragment: ForumTopicFragmentDoc,
        // eslint-disable-next-line i18next/no-literal-string
        id: `Topic:${id}`,
        fragmentName: "ForumTopic",
      }) as ForumTopicFragment;
      if (topic) {
        return topic.title;
      } else {
        return null;
      }
    }
  }, [data?.topic, client.cache, id]);

  const lastPostID = useMemo(() => {
    if (data?.topic?.postsConnection?.nodes) {
      const nodes = data.topic.postsConnection.nodes;
      return nodes[nodes.length - 1].id;
    } else {
      return null;
    }
  }, [data?.topic?.postsConnection?.nodes]);

  const scrollable = useRef<HTMLDivElement>(null);

  return (
    <div className="max-h-full flex flex-col overflow-hidden flex-1">
      <div className="p-4 bg-gray-50 shadow z-10">
        {title ? (
          <h3 className="font-semibold">{title}</h3>
        ) : (
          <Skeleton className="w-1/2 h-5" />
        )}
      </div>
      <div ref={scrollable} className="flex-1 overflow-y-auto">
        <div className="space-y-4">
          {data?.topic?.postsConnection?.nodes?.length ? (
            <AnimatePresence initial={false}>
              {data.topic.postsConnection.nodes.map((post, i) => (
                <ForumPost
                  key={post.id}
                  isFirstPostInTopic={i === 0}
                  post={post}
                />
              ))}
            </AnimatePresence>
          ) : (
            <div className="space-y-2 mt-2">
              <Skeleton className="w-full h-5" />
              <Skeleton className="w-full h-5" />
              <Skeleton className="w-full h-5" />
              <Skeleton className="w-3/4 h-5" />
            </div>
          )}
        </div>
        {data?.me?.profile &&
          data.topic?.forum?.canPost &&
          data.topic.forum.project?.sessionParticipationStatus ===
            ParticipationStatus.ParticipantSharedProfile && (
            <ReplyForm
              key={`reply-to-${lastPostID}`}
              profile={data.me.profile}
              topicId={data.topic.id}
              onReply={() => {
                setTimeout(() => {
                  if (scrollable.current) {
                    scrollable.current.scrollTop = 99999999999999;
                  }
                }, 16);
              }}
            />
          )}
        <LoginOrJoinPrompt className="p-4 mb-8" />
      </div>
    </div>
  );
}
